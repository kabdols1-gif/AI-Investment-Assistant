"""종목 검색 API 라우터

종목코드/종목명으로 검색하는 API 엔드포인트
마스터파일 수집 기능 포함 (CSV 저장, 인메모리 캐시)
"""

import logging
import csv
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

# 마스터파일 다운로드 URL
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
EXCHANGE_NAMES = {
    "kospi": "코스피",
    "kosdaq": "코스닥",
    "nasdaq": "NASDAQ",
    "nyse": "NYSE",
    "amex": "AMEX",
}

# 인메모리 캐시
_symbol_cache: dict[str, list[dict]] = {}
_last_loaded: dict[str, datetime] = {}


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
    exchange_counts: dict[str, int] = Field(default_factory=dict)
    updated_at: dict[str, Optional[str]] = Field(default_factory=dict)
    needs_update: bool = True


class CollectResult(BaseModel):
    """마스터파일 수집 결과"""
    success: bool
    kospi_count: int = 0
    kosdaq_count: int = 0
    nasdaq_count: int = 0
    nyse_count: int = 0
    amex_count: int = 0
    domestic_count: int = 0
    overseas_count: int = 0
    total_count: int = 0
    exchange_counts: dict[str, int] = Field(default_factory=dict)
    errors: list[str] = []


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


def _load_from_csv(exchange: str) -> list[dict]:
    """CSV에서 종목 로드"""
    csv_path = _get_csv_path(exchange)
    if not csv_path.exists():
        return []

    symbols = []
    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = (row.get("code") or "").strip()
                name = (row.get("name") or "").strip()
                row_exchange = (row.get("exchange") or exchange).strip().lower()
                if code and name:
                    symbols.append({
                        "code": code,
                        "name": name,
                        "exchange": row_exchange,
                        "exchange_name": EXCHANGE_NAMES.get(row_exchange, row_exchange.upper()),
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
            for symbol in symbols:
                writer.writerow({
                    "code": symbol["code"],
                    "name": symbol["name"],
                    "exchange": symbol["exchange"],
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
        exchange: 거래소 필터 (kospi, kosdaq, nasdaq, nyse, amex)

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
    updated_at: dict[str, Optional[str]] = {}

    for exchange in SUPPORTED_EXCHANGES:
        symbols = _symbol_cache.get(exchange, []) or _load_from_csv(exchange)
        counts[exchange] = len(symbols)
        mtime = _get_file_mtime(_get_csv_path(exchange))
        updated_at[exchange] = mtime.isoformat() if mtime else None

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
        kospi_updated=updated_at["kospi"],
        kosdaq_updated=updated_at["kosdaq"],
        nasdaq_updated=updated_at["nasdaq"],
        nyse_updated=updated_at["nyse"],
        amex_updated=updated_at["amex"],
        exchange_counts=counts,
        updated_at=updated_at,
        needs_update=_check_needs_update(),
    )


@router.post("/collect", response_model=CollectResult)
async def collect_master_files(
    market: Optional[str] = Query(default=None, description="수집 범위: all, domestic, overseas 또는 거래소 코드"),
) -> CollectResult:
    """마스터파일 수집
    
    거래 API 서버에서 국내/해외 종목 마스터파일을 다운로드합니다.
    수집된 데이터는 master/kis/raw 및 master/kis/parsed 디렉토리에 저장됩니다.
    """
    targets = _resolve_collection_targets(market)
    return await collect_master_files_for_exchanges(targets)


# ============================================
# 검색 API
# ============================================


@router.get("/search", response_model=SymbolSearchResponse)
async def search_symbols_api(
    q: str = Query(..., min_length=1, max_length=50, description="검색어 (종목코드 또는 종목명)"),
    limit: int = Query(default=20, ge=1, le=50, description="최대 결과 수"),
    exchange: Optional[str] = Query(default=None, description="거래소 필터 (kospi, kosdaq)"),
) -> SymbolSearchResponse:
    """종목 검색

    종목코드 또는 종목명으로 검색합니다.

    Args:
        q: 검색어 (종목코드 또는 종목명)
        limit: 최대 결과 수 (1-50, 기본 20)
        exchange: 거래소 필터 (kospi, kosdaq)

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
            detail=f"지원하지 않는 거래소입니다: {exchange}. 지원 거래소: {', '.join(SUPPORTED_EXCHANGES)}",
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
                    "exchange_name": EXCHANGE_NAMES.get(exchange, exchange.upper()),
                })
    except Exception as e:
        logger.error(f"마스터파일 파싱 오류 ({exchange}): {e}")
    
    return symbols


def _parse_overseas_mst(content: bytes, exchange: str) -> list[dict]:
    """해외주식 마스터파일 파싱.

    KIS 해외 마스터 파일은 고정폭/공백 구분 형식이 섞일 수 있어,
    심볼을 첫 필드로 잡고 남은 텍스트에서 종목명을 추출하는 방식으로
    최대한 보수적으로 파싱합니다.
    """
    text = _decode_master_text(content)
    symbols: list[dict] = []
    seen: set[str] = set()

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        tab_parts = [part.strip() for part in line.split("\t")]
        if len(tab_parts) >= 7:
            code = tab_parts[4].upper()
            name = tab_parts[6] or (tab_parts[7] if len(tab_parts) > 7 else "")
        else:
            parts = [part.strip() for part in line.replace("\t", " ").split() if part.strip()]
            if len(parts) < 2:
                continue
            code = parts[0].upper()
            name = _extract_overseas_name(line, code)

        name = name.strip()

        if not _looks_like_overseas_symbol(code) or code in seen:
            continue

        symbols.append({
            "code": code,
            "name": name or code,
            "exchange": exchange,
            "exchange_name": EXCHANGE_NAMES.get(exchange, exchange.upper()),
        })
        seen.add(code)

    return symbols


def _decode_master_text(content: bytes) -> str:
    """마스터파일 텍스트 디코딩"""
    for encoding in ("utf-8-sig", "cp949", "euc-kr", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore")


def _looks_like_overseas_symbol(value: str) -> bool:
    """해외 심볼 후보 여부"""
    if not (1 <= len(value) <= 12):
        return False
    return all(char.isalnum() or char in ".-" for char in value)


def _extract_overseas_name(line: str, code: str) -> str:
    """해외 마스터 한 줄에서 종목명 추출"""
    rest = line[len(code):].strip()
    if not rest:
        return code

    chunks = [chunk.strip() for chunk in rest.replace("\t", "  ").split("  ") if chunk.strip()]
    if chunks:
        return chunks[0]

    parts = rest.split()
    return " ".join(parts[:8]).strip() or code


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
            error = "파싱된 종목이 없습니다"
            logger.warning(f"마스터파일 파싱 결과 없음: {exchange}")
            return [], error
        
        if symbols:
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


async def collect_master_files_for_exchanges(exchanges: tuple[str, ...] = SUPPORTED_EXCHANGES) -> CollectResult:
    """지정 거래소 마스터파일 수집"""
    errors: list[str] = []
    counts = {exchange: 0 for exchange in SUPPORTED_EXCHANGES}

    for exchange in exchanges:
        symbols, error = await _download_and_parse(exchange)
        if error:
            errors.append(f"{exchange}: {error}")
        else:
            counts[exchange] = len(symbols)

    domestic_count = sum(counts[exchange] for exchange in DOMESTIC_EXCHANGES)
    overseas_count = sum(counts[exchange] for exchange in OVERSEAS_EXCHANGES)

    return CollectResult(
        success=len(errors) == 0,
        kospi_count=counts["kospi"],
        kosdaq_count=counts["kosdaq"],
        nasdaq_count=counts["nasdaq"],
        nyse_count=counts["nyse"],
        amex_count=counts["amex"],
        domestic_count=domestic_count,
        overseas_count=overseas_count,
        total_count=domestic_count + overseas_count,
        exchange_counts=counts,
        errors=errors,
    )


def _resolve_collection_targets(market: Optional[str]) -> tuple[str, ...]:
    """수집 범위 문자열을 거래소 목록으로 변환"""
    if not market or market.lower() == "all":
        return SUPPORTED_EXCHANGES

    normalized = market.lower()
    if normalized == "domestic":
        return DOMESTIC_EXCHANGES
    if normalized == "overseas":
        return OVERSEAS_EXCHANGES
    if normalized in SUPPORTED_EXCHANGES:
        return (normalized,)

    raise HTTPException(
        status_code=400,
        detail=f"지원하지 않는 수집 범위입니다: {market}. all, domestic, overseas 또는 {', '.join(SUPPORTED_EXCHANGES)} 중 하나를 사용하세요.",
    )


def _check_needs_update() -> bool:
    """오늘 업데이트가 필요한지 확인"""
    for exchange in SUPPORTED_EXCHANGES:
        csv_path = _get_csv_path(exchange)
        if not csv_path.exists():
            return True
        mtime = _get_file_mtime(csv_path)
        if mtime and mtime.date() < date.today():
            return True
    return False
