"""종목 검색 API 라우터

종목코드/종목명으로 검색하는 API 엔드포인트
마스터파일 수집 기능 포함 (CSV 저장, 인메모리 캐시)
"""

import asyncio
import csv
import logging
import re
import zipfile
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["symbols"])

# 마스터파일 디렉토리: broker/raw 원본, broker/parsed 파싱 결과
MASTER_ROOT = Path("master")
DEFAULT_MASTER_BROKER = "kis"
RAW_MASTER_DIR = MASTER_ROOT / DEFAULT_MASTER_BROKER / "raw"
MASTER_DIR = MASTER_ROOT / DEFAULT_MASTER_BROKER / "parsed"

# 마스터파일 다운로드 URL (코스피/코스닥만 사용)
MASTER_URLS = {
    "kospi": "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip",
    "kosdaq": "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip",
    # "konex": "https://new.real.download.dws.co.kr/common/master/konex_code.mst.zip",
    "nasdaq": "https://new.real.download.dws.co.kr/common/master/nasmst.cod.zip",
    "nyse": "https://new.real.download.dws.co.kr/common/master/nysmst.cod.zip",
    "amex": "https://new.real.download.dws.co.kr/common/master/amsmst.cod.zip",
}

DOMESTIC_EXCHANGES = ("kospi", "kosdaq")
OVERSEAS_EXCHANGES = ("nasdaq", "nyse", "amex")
SUPPORTED_EXCHANGES = DOMESTIC_EXCHANGES + OVERSEAS_EXCHANGES
COLLECTION_SCOPES = {
    "all": SUPPORTED_EXCHANGES,
    "domestic": DOMESTIC_EXCHANGES,
    "overseas": OVERSEAS_EXCHANGES,
}
EXCHANGE_NAMES = {
    "kospi": "코스피",
    "kosdaq": "코스닥",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
    "amex": "AMEX",
}
DAILY_SYMBOL_LOAD_INTERVAL_SECONDS = 60 * 60

# 인메모리 캐시
_symbol_cache: dict[str, list[dict]] = {}
_last_loaded: dict[str, datetime] = {}
_collect_lock = asyncio.Lock()
_daily_loader_task: Optional[asyncio.Task] = None


# ============================================
# 응답 스키마
# ============================================


class SymbolSearchItem(BaseModel):
    """종목 검색 결과 항목"""

    code: str = Field(..., description="종목코드", example="005930")
    name: str = Field(..., description="종목명", example="삼성전자")
    exchange: str = Field(..., description="거래소 코드", example="kospi")
    exchange_name: str = Field(..., description="거래소명", example="코스피")


class SymbolSearchResponse(BaseModel):
    """종목 검색 응답"""

    status: str = "success"
    query: str = Field(..., description="검색어")
    total: int = Field(..., description="검색 결과 수")
    items: list[SymbolSearchItem] = Field(default_factory=list, description="검색 결과 목록")


class SymbolDetailResponse(BaseModel):
    """종목 상세 정보 응답"""

    status: str = "success"
    data: Optional[SymbolSearchItem] = None
    message: Optional[str] = None


class MasterStatus(BaseModel):
    """마스터파일 상태"""
    kospi_count: int = 0
    kosdaq_count: int = 0
    nasdaq_count: int = 0
    nyse_count: int = 0
    amex_count: int = 0
    domestic_count: int = 0
    overseas_count: int = 0
    total_count: int = 0
    kospi_updated: Optional[str] = None
    kosdaq_updated: Optional[str] = None
    nasdaq_updated: Optional[str] = None
    nyse_updated: Optional[str] = None
    amex_updated: Optional[str] = None
    counts: dict[str, int] = Field(default_factory=dict)
    updated: dict[str, Optional[str]] = Field(default_factory=dict)
    needs_update: bool = True


class CollectResult(BaseModel):
    """마스터파일 수집 결과"""
    success: bool
    scope: str = "all"
    kospi_count: int = 0
    kosdaq_count: int = 0
    nasdaq_count: int = 0
    nyse_count: int = 0
    amex_count: int = 0
    domestic_count: int = 0
    overseas_count: int = 0
    total_count: int = 0
    counts: dict[str, int] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)


# ============================================
# 파일 시스템 유틸리티
# ============================================


def _ensure_master_dir():
    """마스터 디렉토리 생성"""
    RAW_MASTER_DIR.mkdir(parents=True, exist_ok=True)
    MASTER_DIR.mkdir(parents=True, exist_ok=True)


def _get_csv_path(exchange: str) -> Path:
    """CSV 파일 경로"""
    return MASTER_DIR / f"{exchange}.csv"


def _get_raw_path(exchange: str) -> Path:
    """원본 마스터파일 경로"""
    return RAW_MASTER_DIR / f"{exchange}_{date.today().isoformat()}.bin"


def _get_file_mtime(path: Path) -> Optional[datetime]:
    """파일 수정 시간"""
    if path.exists():
        return datetime.fromtimestamp(path.stat().st_mtime)
    return None


def _get_exchange_name(exchange: str) -> str:
    """거래소 표시명"""
    return EXCHANGE_NAMES.get(exchange, exchange.upper())


def _load_from_csv(exchange: str) -> list[dict]:
    """CSV에서 종목 로드"""
    csv_path = _get_csv_path(exchange)
    if not csv_path.exists():
        return []

    symbols = []
    try:
        with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                row_exchange = (row.get("exchange") or exchange).strip().lower()
                code = (row.get("code") or "").strip()
                name = (row.get("name") or "").strip()
                if code and name:
                    symbols.append({
                        "code": code,
                        "name": name,
                        "exchange": row_exchange,
                        "exchange_name": _get_exchange_name(row_exchange),
                    })
    except Exception as e:
        logger.error(f"CSV 로드 오류 ({exchange}): {e}")

    return symbols


def _save_to_csv(exchange: str, symbols: list[dict]):
    """CSV로 종목 저장"""
    _ensure_master_dir()
    csv_path = _get_csv_path(exchange)
    
    try:
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["code", "name", "exchange"])
            writer.writeheader()
            for s in symbols:
                writer.writerow({
                    "code": s["code"],
                    "name": s["name"],
                    "exchange": s["exchange"],
                })
        logger.info(f"CSV 저장 완료: {csv_path} ({len(symbols)}개)")
    except Exception as e:
        logger.error(f"CSV 저장 오류 ({exchange}): {e}")


def _get_all_symbols() -> list[dict]:
    """모든 종목 로드 (캐시 사용)
    
    strategy.py에서 종목명 조회에 사용됩니다.
    """
    global _symbol_cache, _last_loaded

    all_symbols = []

    for exchange in SUPPORTED_EXCHANGES:
        # 캐시 확인
        if exchange in _symbol_cache:
            all_symbols.extend(_symbol_cache[exchange])
        else:
            # CSV에서 로드
            symbols = _load_from_csv(exchange)
            if symbols:
                _symbol_cache[exchange] = symbols
                _last_loaded[exchange] = datetime.now()
                all_symbols.extend(symbols)

    return all_symbols


# ============================================
# 주요 종목 데이터 (데모 참고용, 검색/주문 검증 폴백으로 사용하지 않음)
# ============================================

DEMO_STOCKS_REFERENCE: list[dict] = [
    {"code": "005930", "name": "삼성전자", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "000660", "name": "SK하이닉스", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "035420", "name": "네이버", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "035720", "name": "카카오", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "005380", "name": "현대차", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "373220", "name": "LG에너지솔루션", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "207940", "name": "삼성바이오로직스", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "006400", "name": "삼성SDI", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "051910", "name": "LG화학", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "005490", "name": "POSCO홀딩스", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "068270", "name": "셀트리온", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "071050", "name": "한국금융지주", "exchange": "kospi", "exchange_name": "코스피"},
    {"code": "247540", "name": "에코프로비엠", "exchange": "kosdaq", "exchange_name": "코스닥"},
    {"code": "086520", "name": "에코프로", "exchange": "kosdaq", "exchange_name": "코스닥"},
    {"code": "091990", "name": "셀트리온헬스케어", "exchange": "kosdaq", "exchange_name": "코스닥"},
    {"code": "035900", "name": "JYP Ent.", "exchange": "kosdaq", "exchange_name": "코스닥"},
    {"code": "041510", "name": "에스엠", "exchange": "kosdaq", "exchange_name": "코스닥"},
]


# ============================================
# 검색 로직
# ============================================


def search_symbols(query: str, limit: int = 20, exchange: Optional[str] = None) -> list[dict]:
    """종목 검색 (코드 또는 이름)

    Args:
        query: 검색어 (종목코드 또는 종목명)
        limit: 최대 결과 수
        exchange: 거래소 필터 (kospi, kosdaq)

    Returns:
        검색 결과 목록
    """
    query = query.lower().strip()
    results: list[dict] = []

    # 공식 마스터파일 기반 캐시만 사용한다. 없으면 빈 결과를 반환한다.
    all_symbols = _get_all_symbols()

    for stock in all_symbols:
        # 거래소 필터
        if exchange and stock["exchange"] != exchange.lower():
            continue

        # 코드 또는 이름 매칭
        if query in stock["code"].lower() or query in stock["name"].lower():
            results.append(stock)
            if len(results) >= limit:
                break

    return results


def get_symbol_by_code(code: str) -> Optional[dict]:
    """종목코드로 종목 정보 조회

    Args:
        code: 종목코드

    Returns:
        종목 정보 또는 None
    """
    all_symbols = _get_all_symbols()
    for stock in all_symbols:
        if stock["code"] == code:
            return stock
    return None


# ============================================
# API 엔드포인트
# ============================================


# ============================================
# 마스터파일 상태/수집 API (/{code} 보다 먼저 정의해야 함)
# ============================================


@router.get("/status", response_model=MasterStatus)
async def get_master_status() -> MasterStatus:
    """마스터파일 상태 조회
    
    현재 로드된 종목 수, 마지막 업데이트 시간, 업데이트 필요 여부를 반환합니다.
    """
    counts: dict[str, int] = {}
    updated: dict[str, Optional[str]] = {}

    for exchange in SUPPORTED_EXCHANGES:
        symbols = _symbol_cache.get(exchange) or _load_from_csv(exchange)
        counts[exchange] = len(symbols)
        mtime = _get_file_mtime(_get_csv_path(exchange))
        updated[exchange] = mtime.isoformat() if mtime else None

    domestic_count = sum(counts[exchange] for exchange in DOMESTIC_EXCHANGES)
    overseas_count = sum(counts[exchange] for exchange in OVERSEAS_EXCHANGES)

    return MasterStatus(
        kospi_count=counts["kospi"],
        kosdaq_count=counts["kosdaq"],
        nasdaq_count=counts["nasdaq"],
        nyse_count=counts["nyse"],
        amex_count=counts["amex"],
        domestic_count=domestic_count,
        overseas_count=overseas_count,
        total_count=domestic_count + overseas_count,
        kospi_updated=updated["kospi"],
        kosdaq_updated=updated["kosdaq"],
        nasdaq_updated=updated["nasdaq"],
        nyse_updated=updated["nyse"],
        amex_updated=updated["amex"],
        counts=counts,
        updated=updated,
        needs_update=_check_needs_update(),
    )


@router.post("/collect", response_model=CollectResult)
async def collect_master_files(
    scope: str = Query(default="all", description="수집 범위: all, domestic, overseas"),
) -> CollectResult:
    """마스터파일 수집
    
    거래 API 서버에서 코스피/코스닥 마스터파일을 다운로드합니다.
    수집된 데이터는 master/kis/raw 및 master/kis/parsed 디렉토리에 저장됩니다.
    """
    try:
        return await collect_symbol_master_files(scope=scope)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# ============================================
# 검색 API
# ============================================


@router.get("/search", response_model=SymbolSearchResponse)
async def search_symbols_api(
    q: str = Query(..., min_length=1, max_length=50, description="검색어 (종목코드 또는 종목명)"),
    limit: int = Query(default=20, ge=1, le=50, description="최대 결과 수"),
    exchange: Optional[str] = Query(default=None, description="거래소 필터 (kospi, kosdaq, nasdaq, nyse, amex)"),
) -> SymbolSearchResponse:
    """종목 검색

    종목코드 또는 종목명으로 검색합니다.

    Args:
        q: 검색어 (종목코드 또는 종목명)
        limit: 최대 결과 수 (1-50, 기본 20)
        exchange: 거래소 필터 (kospi, kosdaq, nasdaq, nyse, amex)

    Returns:
        검색 결과

    Examples:
        - GET /api/symbols/search?q=삼성
        - GET /api/symbols/search?q=005930
        - GET /api/symbols/search?q=에코&exchange=kosdaq
    """
    # 거래소 필터 검증
    if exchange and exchange.lower() not in SUPPORTED_EXCHANGES:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 거래소입니다: {exchange}. {', '.join(SUPPORTED_EXCHANGES)} 중 하나를 지정하세요.",
        )

    results = search_symbols(q, limit=limit, exchange=exchange)

    return SymbolSearchResponse(
        query=q,
        total=len(results),
        items=[SymbolSearchItem(**stock) for stock in results],
    )


@router.get("/{code}", response_model=SymbolDetailResponse)
async def get_symbol_detail(
    code: str,
) -> SymbolDetailResponse:
    """종목 상세 정보 조회

    종목코드로 상세 정보를 조회합니다.

    Args:
        code: 종목코드 (예: 005930)

    Returns:
        종목 상세 정보

    Examples:
        - GET /api/symbols/005930
    """
    stock = get_symbol_by_code(code)

    if stock is None:
        raise HTTPException(
            status_code=404,
            detail=f"종목을 찾을 수 없습니다: {code}",
        )

    return SymbolDetailResponse(
        data=SymbolSearchItem(**stock),
    )


# ============================================
# 마스터파일 수집 API
# ============================================


def _parse_kospi_kosdaq_mst(content: bytes, exchange: str) -> list[dict]:
    """KOSPI/KOSDAQ 마스터파일 파싱
    
    파일 형식: EUC-KR 인코딩, 고정 폭 필드 (바이트 기준)
    - 0-8 (9바이트): 단축코드
    - 9-20 (12바이트): 표준코드
    - 21-60 (40바이트): 한글종목명
    """
    symbols = []
    try:
        lines = content.split(b"\n")
        for line_bytes in lines:
            if len(line_bytes) < 61:
                continue
            
            code = line_bytes[0:9].decode("euc-kr", errors="ignore").strip()
            name = line_bytes[21:61].decode("euc-kr", errors="ignore").strip()
            
            # 실제 종목코드는 6자리
            if len(code) > 6:
                code = code[-6:]
            
            if code and name:
                symbols.append({
                    "code": code,
                    "name": name,
                    "exchange": exchange,
                    "exchange_name": _get_exchange_name(exchange),
                })
    except Exception as e:
        logger.error(f"마스터파일 파싱 오류 ({exchange}): {e}")
    
    return symbols


def _decode_master_content(content: bytes) -> str:
    """마스터 파일 바이트를 텍스트로 디코딩"""
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore")


def _parse_overseas_mst(content: bytes, exchange: str) -> list[dict]:
    """NASDAQ/NYSE/AMEX 마스터파일 파싱"""
    symbols: list[dict] = []
    text = _decode_master_content(content)

    for line in text.splitlines():
        raw_line = line.strip()
        if not raw_line:
            continue

        parts = raw_line.split("\t")
        if len(parts) < 7:
            parts = [part for part in re.split(r"\s{2,}|\|", raw_line) if part]

        code = ""
        name = ""
        if len(parts) >= 7:
            code = parts[4].strip()
            name = parts[6].strip()
            if not name and len(parts) >= 8:
                name = parts[7].strip()
        elif len(parts) >= 2:
            code = parts[0].strip()
            name = parts[1].strip()

        if code and name:
            symbols.append({
                "code": code,
                "name": name,
                "exchange": exchange,
                "exchange_name": _get_exchange_name(exchange),
            })

    return symbols


async def _download_and_parse(exchange: str, timeout: float = 60.0) -> tuple[list[dict], Optional[str]]:
    """마스터파일 다운로드 및 파싱"""
    global _symbol_cache, _last_loaded
    
    url = MASTER_URLS.get(exchange)
    if not url:
        return [], f"알 수 없는 거래소: {exchange}"
    
    try:
        logger.info(f"마스터파일 다운로드 시작: {exchange}")
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
        
        content = response.content
        _ensure_master_dir()
        _get_raw_path(exchange).write_bytes(content)
        
        # ZIP 압축 해제
        extracted = content
        try:
            with zipfile.ZipFile(BytesIO(content)) as zf:
                for name in zf.namelist():
                    extracted = zf.read(name)
                    break
        except zipfile.BadZipFile:
            extracted = content
        
        # 파싱
        if exchange in DOMESTIC_EXCHANGES:
            symbols = _parse_kospi_kosdaq_mst(extracted, exchange)
        else:
            symbols = _parse_overseas_mst(extracted, exchange)

        if not symbols:
            return [], "수집된 종목이 없습니다"
        
        # CSV 저장
        _save_to_csv(exchange, symbols)
        # 캐시 업데이트
        _symbol_cache[exchange] = symbols
        _last_loaded[exchange] = datetime.now()
        logger.info(f"마스터파일 수집 완료: {exchange} - {len(symbols)}개 종목")
        
        return symbols, None
        
    except httpx.HTTPStatusError as e:
        error = f"HTTP {e.response.status_code}"
        logger.error(f"HTTP 오류 ({exchange}): {error}")
        return [], error
    except Exception as e:
        logger.error(f"수집 실패 ({exchange}): {e}")
        return [], str(e)


def _resolve_collection_scope(scope: str) -> tuple[str, ...]:
    normalized_scope = scope.lower().strip()
    exchanges = COLLECTION_SCOPES.get(normalized_scope)
    if not exchanges:
        raise ValueError(f"지원하지 않는 수집 범위입니다: {scope}. all, domestic, overseas 중 하나를 지정하세요.")
    return exchanges


def _build_collect_result(scope: str, counts: dict[str, int], errors: list[str]) -> CollectResult:
    domestic_count = sum(counts.get(exchange, 0) for exchange in DOMESTIC_EXCHANGES)
    overseas_count = sum(counts.get(exchange, 0) for exchange in OVERSEAS_EXCHANGES)

    return CollectResult(
        success=len(errors) == 0,
        scope=scope,
        kospi_count=counts.get("kospi", 0),
        kosdaq_count=counts.get("kosdaq", 0),
        nasdaq_count=counts.get("nasdaq", 0),
        nyse_count=counts.get("nyse", 0),
        amex_count=counts.get("amex", 0),
        domestic_count=domestic_count,
        overseas_count=overseas_count,
        total_count=domestic_count + overseas_count,
        counts=counts,
        errors=errors,
    )


async def collect_symbol_master_files(scope: str = "all") -> CollectResult:
    """지정 범위의 종목 마스터파일을 수집"""
    normalized_scope = scope.lower().strip()
    exchanges = _resolve_collection_scope(normalized_scope)
    counts = {exchange: 0 for exchange in SUPPORTED_EXCHANGES}
    errors: list[str] = []

    async with _collect_lock:
        for exchange in exchanges:
            symbols, error = await _download_and_parse(exchange)
            if error:
                errors.append(f"{exchange}: {error}")
            else:
                counts[exchange] = len(symbols)

    return _build_collect_result(normalized_scope, counts, errors)


async def ensure_daily_symbol_master_loaded(force: bool = False) -> Optional[CollectResult]:
    """오늘 날짜 기준으로 마스터파일이 없거나 오래됐으면 수집"""
    _get_all_symbols()
    if not force and not _check_needs_update():
        logger.info("종목 마스터파일 일일 수집 생략: 오늘 데이터가 이미 로드되었습니다.")
        return None

    logger.info("종목 마스터파일 일일 수집 시작")
    result = await collect_symbol_master_files(scope="all")
    if result.success:
        logger.info("종목 마스터파일 일일 수집 완료: %s개", result.total_count)
    else:
        logger.warning("종목 마스터파일 일일 수집 일부 실패: %s", result.errors)
    return result


async def _daily_symbol_loader_loop() -> None:
    while True:
        try:
            await ensure_daily_symbol_master_loaded()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("종목 마스터파일 일일 로더 오류: %s", e)

        await asyncio.sleep(DAILY_SYMBOL_LOAD_INTERVAL_SECONDS)


async def start_daily_symbol_loader() -> None:
    """종목 마스터파일 일일 로더 시작"""
    global _daily_loader_task

    _get_all_symbols()
    if _daily_loader_task and not _daily_loader_task.done():
        return

    _daily_loader_task = asyncio.create_task(_daily_symbol_loader_loop())


async def stop_daily_symbol_loader() -> None:
    """종목 마스터파일 일일 로더 종료"""
    global _daily_loader_task

    if not _daily_loader_task:
        return

    _daily_loader_task.cancel()
    try:
        await _daily_loader_task
    except asyncio.CancelledError:
        pass
    finally:
        _daily_loader_task = None


def _check_needs_update(exchanges: tuple[str, ...] = SUPPORTED_EXCHANGES) -> bool:
    """오늘 업데이트가 필요한지 확인"""
    for exchange in exchanges:
        csv_path = _get_csv_path(exchange)
        if not csv_path.exists():
            return True
        mtime = _get_file_mtime(csv_path)
        if not mtime or mtime.date() < date.today():
            return True
    return False
