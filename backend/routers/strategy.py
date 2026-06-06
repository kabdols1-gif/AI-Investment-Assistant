"""
?꾨왂 愿??API Router

strategy_core 紐⑤뱢???ъ슜?섏뿬 ?꾨왂 議고쉶/?ㅽ뻾/鍮뚮뱶瑜?泥섎━?⑸땲??
"""

import time
import logging
import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from strategy_core import StrategyRegistry
import strategy_core.preset  # 10媛??꾨왂 ?먮룞 ?깅줉
from strategy_core.name_utils import sanitize_strategy_name
from strategy_core.executor import (
    execute_with_class,
    execute_from_builder_state,
    execute_custom_file,
)
from backend import authenticate, is_authenticated, get_current_mode
import kb_auth as ka
from strategy_core.dsl.codegen import StrategyCodeGenerator, generate_strategy_file
from strategy_core.dsl.parser import parse_strategy, StrategyDSLParser
from strategy_core.dsl.converter import builder_state_to_dsl

router = APIRouter()
logger = logging.getLogger(__name__)


def _api_sleep():
    """모드별 API 호출 간격 보정."""
    interval = 0.2 if ka.isPaperTrading() else 0.05
    time.sleep(interval)




# ============================================
# 醫낅ぉ紐?議고쉶 (留덉뒪?고뙆??湲곕컲)
# ============================================

def get_stock_name(code: str) -> str:
    """醫낅ぉ肄붾뱶濡?醫낅ぉ紐?議고쉶

    symbols 紐⑤뱢??留덉뒪?고뙆??罹먯떆瑜??ъ슜?섏뿬 醫낅ぉ紐낆쓣 諛섑솚?⑸땲??
    罹먯떆???녿뒗 寃쎌슦 醫낅ぉ肄붾뱶瑜?洹몃?濡?諛섑솚?⑸땲??
    """
    from backend.routers.symbols import _get_all_symbols

    all_symbols = _get_all_symbols()

    for stock in all_symbols:
        if stock["code"] == code:
            return stock["name"]

    return code


# ============================================
# Request/Response Models
# ============================================

class ExecuteRequest(BaseModel):
    strategy_id: str
    stocks: List[str]
    params: Dict[str, Any] = {}
    builder_state: Optional[Dict[str, Any]] = None


class BuildRequest(BaseModel):
    name: str
    buy_condition: str
    sell_condition: Optional[str] = None


class SignalResult(BaseModel):
    code: str
    name: str
    action: str
    strength: float
    reason: str
    target_price: Optional[int] = None


class LogEntry(BaseModel):
    type: str
    message: str
    timestamp: Optional[str] = None


class ExecuteResponse(BaseModel):
    status: str
    results: List[SignalResult] = []
    logs: List[LogEntry] = []
    message: Optional[str] = None


# ============================================
# API Endpoints
# ============================================

@router.get("")
async def list_strategies():
    """?꾨왂 紐⑸줉 議고쉶 - builder_state ?ы븿 (SSoT)"""
    return {"strategies": StrategyRegistry.get_list()}


@router.get("/custom")
async def list_custom_strategies():
    """而ㅼ뒪? ?꾨왂 紐⑸줉 議고쉶"""
    import os
    import re

    custom_strategies = []
    strategy_dir = os.path.join(os.path.dirname(__file__), "..", "..", "strategy")

    default_files = {
        'strategy_01_golden_cross.py', 'strategy_02_momentum.py',
        'strategy_03_week52_high.py', 'strategy_04_consecutive.py',
        'strategy_05_disparity.py', 'strategy_06_breakout_fail.py',
        'strategy_07_strong_close.py', 'strategy_08_volatility.py',
        'strategy_09_mean_reversion.py', 'strategy_10_trend_filter.py',
        'base_strategy.py', '__init__.py'
    }

    for filename in os.listdir(strategy_dir):
        if filename.endswith('.py') and filename not in default_files:
            filepath = os.path.join(strategy_dir, filename)

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                name = filename.replace('strategy_', '').replace('.py', '')
                buy_condition = ""
                sell_condition = ""
                description = ""

                if '"""' in content:
                    doc_start = content.find('"""', content.find('class '))
                    if doc_start > 0:
                        doc_end = content.find('"""', doc_start + 3)
                        if doc_end > 0:
                            doc = content[doc_start+3:doc_end].strip()
                            for line in doc.split('\n'):
                                line = line.strip()
                                if line.startswith('留ㅼ닔 議곌굔:'):
                                    buy_condition = line.replace('留ㅼ닔 議곌굔:', '').strip()
                                elif line.startswith('留ㅻ룄 議곌굔:'):
                                    sell_condition = line.replace('留ㅻ룄 議곌굔:', '').strip()

                            if buy_condition:
                                description = f"留ㅼ닔: {buy_condition}"

                custom_strategies.append({
                    'id': f'custom:{name}',
                    'name': name.replace('_', ' ').title(),
                    'description': description or '?ъ슜???뺤쓽 ?꾨왂',
                    'category': '而ㅼ뒪?',
                    'filename': filename,
                    'params': [],
                    'buy_condition': buy_condition,
                    'sell_condition': sell_condition,
                })
            except Exception:
                pass

    return {"strategies": custom_strategies}


@router.get("/indicators")
async def list_indicators():
    """List available indicators."""
    return {
        "indicators": [
            {"name": "ma", "label": "MA", "params": ["period"], "example": "ma(20)"},
            {"name": "ema", "label": "EMA", "params": ["period"], "example": "ema(12)"},
            {"name": "rsi", "label": "RSI", "params": ["period"], "example": "rsi(14)"},
            {"name": "macd", "label": "MACD", "params": ["fast", "slow", "signal"], "example": "macd(12,26,9)"},
            {"name": "macd_signal", "label": "MACD Signal", "params": ["fast", "slow", "signal"], "example": "macd_signal(12,26,9)"},
            {"name": "bb_upper", "label": "Bollinger Upper", "params": ["period", "std"], "example": "bb_upper(20,2)"},
            {"name": "bb_lower", "label": "Bollinger Lower", "params": ["period", "std"], "example": "bb_lower(20,2)"},
            {"name": "atr", "label": "ATR", "params": ["period"], "example": "atr(14)"},
            {"name": "adx", "label": "ADX", "params": ["period"], "example": "adx(14)"},
            {"name": "stoch_k", "label": "Stochastic %K", "params": ["period"], "example": "stoch_k(14)"},
        ],
        "variables": ["close", "open", "high", "low", "volume", "change"],
        "operators": {
            "comparison": [">", "<", ">=", "<=", "=="],
            "crossover": ["crosses_above", "crosses_below"],
            "logical": ["AND", "OR"],
        },
    }


@router.post("/execute", response_model=ExecuteResponse)
async def execute_strategy(request: ExecuteRequest):
    """?꾨왂 ?ㅽ뻾"""
    strategy_id = request.strategy_id
    stocks = request.stocks
    params = request.params
    logs = []

    def log(msg_type: str, message: str):
        logs.append(LogEntry(
            type=msg_type,
            message=message,
            timestamp=datetime.datetime.now().strftime("%H:%M:%S"),
        ))

    if not is_authenticated():
        log("error", "거래 인증이 필요합니다.")
        return ExecuteResponse(status='error', logs=logs, message='Authentication is required.')

    current_mode = get_current_mode()
    mode_display = "개발 모드" if current_mode == "vps" else "실전 모드"
    log("info", f"거래 인증을 확인했습니다. ({mode_display})")

    try:
        # 1) 濡쒖뺄 ?꾨왂 (?꾨줎?몄뿏?쒖뿉??builder_state 吏곸젒 ?꾨떖)
        if strategy_id.startswith('local_'):
            if not request.builder_state:
                log("error", "builder_state is required for local strategy execution.")
                return ExecuteResponse(status='error', logs=logs, message='builder_state is required')

            strategy_name = request.builder_state.get('metadata', {}).get('name', 'Local Strategy')
            log("info", f"Local strategy: {strategy_name}")
            log("info", f"Stocks: {', '.join(stocks)}")

            results = execute_from_builder_state(
                request.builder_state, strategy_name, stocks,
                log, get_stock_name, _api_sleep,
            )
            log("success", "Local strategy execution completed.")
            return ExecuteResponse(
                status='success',
                results=[SignalResult(**r) for r in results],
                logs=logs,
            )

        # 2) 而ㅼ뒪? ?꾨왂 (?뚯씪 湲곕컲)
        if strategy_id.startswith('custom:'):
            import os
            import re
            custom_name = strategy_id.removeprefix('custom:')
            if not re.fullmatch(r'[a-zA-Z0-9_]+', custom_name):
                raise HTTPException(400, "Invalid strategy ID")
            log("info", f"Custom strategy: {custom_name}")
            log("info", f"Stocks: {', '.join(stocks)}")

            strategy_dir = os.path.join(os.path.dirname(__file__), "..", "..", "strategy")
            results = execute_custom_file(
                custom_name, strategy_dir, stocks,
                log, get_stock_name, _api_sleep,
            )
            log("success", "Strategy execution completed.")
            return ExecuteResponse(
                status='success',
                results=[SignalResult(**r) for r in results],
                logs=logs,
            )

        # 3) ?덉??ㅽ듃由??꾨왂
        schema = StrategyRegistry.get(strategy_id)
        if not schema:
            log("error", f"Unknown strategy: {strategy_id}")
            return ExecuteResponse(status='error', logs=logs, message=f'Unknown strategy: {strategy_id}')

        # 3a) 鍮뚮뜑 ?꾩슜 ?꾨왂 (strategy_class=None)
        if schema.get('strategy_class') is None:
            builder_state = schema.get('builder_state', {})
            if not builder_state:
                log("error", f"Missing builder_state: {strategy_id}")
                return ExecuteResponse(status='error', logs=logs, message='builder_state is required')

            strategy_name = schema.get('name', strategy_id)
            log("info", f"Builder strategy: {strategy_name}")
            log("info", f"Stocks: {', '.join(stocks)}")

            results = execute_from_builder_state(
                builder_state, strategy_name, stocks,
                log, get_stock_name, _api_sleep,
            )
            log("success", "Builder strategy execution completed.")
            return ExecuteResponse(
                status='success',
                results=[SignalResult(**r) for r in results],
                logs=logs,
            )

        # 3b) 湲곕낯 ?꾨왂 (strategy_class ?ъ슜)
        results = execute_with_class(
            schema['strategy_class'], schema['param_map'], params, stocks,
            strategy_id, log, get_stock_name, _api_sleep,
        )
        log("success", "Strategy execution completed.")
        return ExecuteResponse(
            status='success',
            results=[SignalResult(**r) for r in results],
            logs=logs,
        )

    except Exception as e:
        log("error", f"Strategy execution error: {str(e)}")
        return ExecuteResponse(status='error', logs=logs, message=str(e))


@router.post("/build")
async def build_strategy(request: BuildRequest):
    """而ㅼ뒪? ?꾨왂 ?앹꽦"""
    try:
        name_snake = sanitize_strategy_name(request.name)

        parser = StrategyDSLParser()
        parser.parse(request.buy_condition)
        if request.sell_condition:
            parser.parse(request.sell_condition)

        file_path = generate_strategy_file(
            name=name_snake,
            name_ko=request.name,
            buy_condition=request.buy_condition,
            sell_condition=request.sell_condition,
            output_dir="strategy",
        )

        return {
            "status": "success",
            "message": f"?꾨왂 ?앹꽦 ?꾨즺: {file_path}",
            "file_path": file_path,
            "strategy_name": request.name,
        }

    except Exception as e:
        return {
            "status": "error",
            "message": f"?꾨왂 ?앹꽦 ?ㅽ뙣: {str(e)}",
        }


@router.post("/preview")
async def preview_strategy(request: BuildRequest):
    """而ㅼ뒪? ?꾨왂 誘몃━蹂닿린 (肄붾뱶 ?앹꽦留?"""
    try:
        name_snake = sanitize_strategy_name(request.name)

        strategy = parse_strategy(
            name=name_snake,
            name_ko=request.name,
            buy_condition=request.buy_condition,
            sell_condition=request.sell_condition,
        )

        generator = StrategyCodeGenerator()
        code = generator.generate(strategy)

        return {
            "status": "success",
            "code": code,
            "required_days": strategy.get_required_days(),
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }


@router.post("/preview-code")
async def preview_code_from_state(request: dict):
    """BuilderState ??Python 肄붾뱶 誘몃━蹂닿린"""
    try:
        builder_state = request.get("builder_state", {})
        strategy_name = builder_state.get("metadata", {}).get("name", "custom")

        buy_condition, sell_condition = builder_state_to_dsl(builder_state)

        if not buy_condition:
            return {"status": "error", "message": "留ㅼ닔 議곌굔???놁뒿?덈떎"}

        # ?대옒?ㅻ챸??snake_case: metadata.id ?곗꽑 (preset? ?곷Ц id 蹂댁쑀)
        metadata_id = builder_state.get("metadata", {}).get("id", "")
        if metadata_id and metadata_id != "custom_strategy":
            name_snake = sanitize_strategy_name(metadata_id)
        else:
            name_snake = sanitize_strategy_name(strategy_name)

        strategy_def = parse_strategy(
            name=name_snake,
            name_ko=strategy_name,
            buy_condition=buy_condition,
            sell_condition=sell_condition,
        )

        generator = StrategyCodeGenerator()
        code = generator.generate(strategy_def)

        return {
            "status": "success",
            "code": code,
            "buy_dsl": buy_condition,
            "sell_dsl": sell_condition,
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
        }

