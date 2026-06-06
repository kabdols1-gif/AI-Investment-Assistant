"""Server-side hard gates for assistant-created order proposals."""

from __future__ import annotations

from uuid import uuid4

import pandas as pd

from backend import get_current_mode, is_authenticated
from backend.schemas.voice import ConfirmOrderRequest, ExecutionResult, OrderProposal
from backend.services import secure_config
from backend.services.masking import mask_sensitive
from core.order_executor import OrderExecutor
from core.signal import Action, Signal


def _blocking_result(message: str) -> ExecutionResult:
    return ExecutionResult(
        request_id=f"guard_{uuid4().hex}",
        status="blocked",
        message=message,
    )


def _validate_proposal(proposal: OrderProposal) -> str | None:
    if proposal.symbol_code == "UNKNOWN" or not proposal.symbol_code:
        return "종목 코드가 확인되지 않았습니다."
    if proposal.side not in ("buy", "sell"):
        return "주문 방향이 올바르지 않습니다."
    if proposal.quantity is None and proposal.amount_krw is None:
        return "수량 또는 원화 금액이 필요합니다."
    if proposal.quantity is not None and proposal.quantity <= 0:
        return "수량은 0보다 커야 합니다."
    if proposal.amount_krw is not None and proposal.amount_krw <= 0:
        return "주문 금액은 0보다 커야 합니다."
    return None


def confirm_order(request: ConfirmOrderRequest) -> ExecutionResult:
    proposal = request.proposal

    validation_error = _validate_proposal(proposal)
    if validation_error:
        return _blocking_result(validation_error)

    if not request.user_confirmed:
        return _blocking_result("사용자 최종 확인이 필요합니다.")

    if not request.auth_completed:
        return _blocking_result("로컬 인증 확인이 필요합니다.")

    if proposal.mode == "simulation":
        return ExecutionResult(
            request_id=f"sim_{uuid4().hex}",
            status="confirmed",
            message="시뮬레이션 확인이 완료되었습니다. OpenAPI 주문은 제출되지 않았습니다.",
            raw_response_masked={
                "proposal_id": proposal.proposal_id,
                "mode": proposal.mode,
                "submitted": False,
            },
        )

    if proposal.mode == "live" and not secure_config.live_execution_enabled():
        return _blocking_result("실전 주문 실행은 로컬 설정에서 비활성화되어 있습니다.")

    if not request.execution_enabled:
        return _blocking_result("주문 실행 플래그가 꺼져 있어 후보가 제출되지 않았습니다.")

    if not is_authenticated():
        return _blocking_result("모의/실전 실행 전 거래 인증이 필요합니다.")

    if proposal.quantity is None:
        return _blocking_result("모의/실전 실행에는 명시적인 수량이 필요합니다.")

    action = Action.BUY if proposal.side == "buy" else Action.SELL
    signal = Signal(
        stock_code=proposal.symbol_code,
        stock_name=proposal.symbol_name,
        action=action,
        strength=1.0 if proposal.order_type == "market" else 0.7,
        reason="Voice assistant confirmed order",
        target_price=proposal.limit_price,
        quantity=proposal.quantity,
    )

    executor = OrderExecutor(env_dv=get_current_mode())
    result = executor.execute_signal(signal)
    if not isinstance(result, pd.DataFrame) or result.empty:
        return ExecutionResult(
            request_id=f"submit_{uuid4().hex}",
            status="failed",
            message="주문 제출에 실패했거나 주문 실행기에서 거절되었습니다.",
        )

    record = result.iloc[0].to_dict()
    order_no = str(record.get("ODNO") or record.get("order_id") or "")
    return ExecutionResult(
        request_id=f"submit_{uuid4().hex}",
        status="submitted",
        message="로컬 주문 실행기를 통해 주문이 제출되었습니다.",
        order_no=order_no or None,
        raw_response_masked=mask_sensitive(record),
    )
