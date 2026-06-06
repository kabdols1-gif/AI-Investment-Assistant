"""Convert interpreted intents into local strategy and order cards."""

from __future__ import annotations

from uuid import uuid4

from backend.routers.symbols import get_symbol_by_code, search_symbols
from backend.schemas.voice import LLMIntent, OrderProposal, StrategyCard


def _resolve_symbol(intent: LLMIntent) -> tuple[str | None, str | None]:
    if intent.symbol_code:
        stock = get_symbol_by_code(intent.symbol_code)
        return intent.symbol_code, stock["name"] if stock else intent.symbol_name

    if intent.symbol_name:
        results = search_symbols(intent.symbol_name, limit=1)
        if results:
            return results[0]["code"], results[0]["name"]

    return None, intent.symbol_name


def build_strategy_card(intent: LLMIntent) -> StrategyCard:
    code, name = _resolve_symbol(intent)
    symbol_name = name or "종목 미지정"

    condition_type = intent.condition_type or "manual_review"
    params = intent.condition_params or {}
    title = f"{symbol_name} 전략 초안"

    if condition_type == "ma_cross":
        description = "단기 이동평균선이 장기 이동평균선을 상향 돌파할 때 매수 신호를 검토합니다."
        entry = {"type": "ma_cross", "operator": "cross_above", **params}
        exit_condition = {"type": "ma_cross", "operator": "cross_below", **params}
    elif condition_type == "price_above_ma":
        description = "가격이 선택한 이동평균선을 상향 돌파할 때 매수 신호를 검토합니다."
        entry = {"type": "price_above_ma", "operator": "greater_than", **params}
        exit_condition = {"type": "price_below_ma", "operator": "less_than", **params}
    elif condition_type in ("rsi_below", "rsi_above"):
        description = "RSI 기준값을 활용해 과열/과매도 조건을 검토합니다."
        entry = {"type": condition_type, **params}
        exit_condition = None
    else:
        description = "AI 투자비서가 해석한 조건으로 만든 전략 초안입니다."
        entry = {"type": condition_type, "params": params}
        exit_condition = None

    return StrategyCard(
        title=title,
        description=description,
        symbol_name=symbol_name,
        symbol_code=code,
        entry_condition=entry,
        exit_condition=exit_condition,
        risk_rule={
            "stop_loss_percent": 5.0,
            "take_profit_percent": 10.0,
            "requires_backtest": True,
        },
        budget_krw=intent.amount_krw,
        status="draft",
    )


def build_order_proposal(intent: LLMIntent) -> OrderProposal:
    if intent.side not in ("buy", "sell"):
        raise ValueError("주문 방향은 매수 또는 매도여야 합니다.")

    code, name = _resolve_symbol(intent)
    condition = None
    order_type = "market"
    if intent.condition_type:
        order_type = "conditional"
        condition = {
            "type": intent.condition_type,
            "params": intent.condition_params,
        }

    warnings = [
        "이 항목은 주문 후보입니다. 최종 확인 전에는 주문이 제출되지 않습니다.",
        "기본값은 시뮬레이션 모드이며 OpenAPI 주문 엔드포인트를 호출하지 않습니다.",
    ]
    if not code:
        warnings.append("종목 코드가 확인되지 않았습니다. 주문 전 종목을 확정해야 합니다.")
    if intent.quantity is None and intent.amount_krw is None:
        warnings.append("실행 전 수량 또는 원화 금액이 필요합니다.")
    if intent.mode == "live":
        warnings.append("실전투자 모드는 로컬 설정에서 명시적으로 활성화하고 추가 경고를 확인해야 합니다.")

    return OrderProposal(
        proposal_id=f"voice_{uuid4().hex}",
        symbol_name=name or intent.symbol_name or "종목 미지정",
        symbol_code=code or "UNKNOWN",
        side=intent.side,
        order_type=order_type,
        quantity=intent.quantity,
        amount_krw=intent.amount_krw,
        condition=condition,
        risk_warnings=warnings,
        mode=intent.mode,
    )
