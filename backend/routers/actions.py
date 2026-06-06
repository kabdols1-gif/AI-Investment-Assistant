"""Action execution API.

This router is intentionally conservative. It creates the server-side boundary
for future local execution while preventing order-like actions from running
without explicit confirmation and authentication.
"""

from fastapi import APIRouter

from backend.schemas.actions import ActionExecuteRequest, ActionExecuteResponse
from backend.services.audit_log import append_audit_event


router = APIRouter()

AUTH_REQUIRED_INTENTS = {
    "create_order_draft",
    "recommend_rebalancing",
    "set_price_alert",
    "update_notification_setting",
    "update_voice_setting",
    "connect_llm_key",
    "connect_kb_openapi",
}

CONFIRMATION_REQUIRED_INTENTS = AUTH_REQUIRED_INTENTS | {
    "create_strategy",
    "create_strategy_candidate",
}


@router.post("/execute", response_model=ActionExecuteResponse)
async def execute_action(request: ActionExecuteRequest) -> ActionExecuteResponse:
    append_audit_event(
        "action_execute_requested",
        {
            "intent": request.intent,
            "confirmed": request.confirmed,
            "auth_token_present": bool(request.auth_token),
            "action_plan_count": len(request.action_plan),
        },
    )

    if request.intent in CONFIRMATION_REQUIRED_INTENTS and not request.confirmed:
        return ActionExecuteResponse(
            status="pending_confirmation",
            message="고객 확인이 필요한 실행 후보입니다. 아직 실행하지 않았습니다.",
            data={"intent": request.intent},
        )

    if request.intent in AUTH_REQUIRED_INTENTS and not request.auth_token:
        return ActionExecuteResponse(
            status="requires_auth",
            message="인증이 필요한 요청입니다. 인증 완료 후 다시 실행할 수 있습니다.",
            data={"intent": request.intent},
        )

    return ActionExecuteResponse(
        status="success",
        message="요청을 로컬 실행 stub에서 처리했습니다. 실제 주문 API는 호출하지 않았습니다.",
        data={"intent": request.intent, "executed": False},
    )
