"""Voice assistant API routes."""

from fastapi import APIRouter, HTTPException

from backend.schemas.voice import (
    ConfirmOrderRequest,
    ExecutionResult,
    LLMIntent,
    OrderProposal,
    StrategyAnalysis,
    StrategyAnalysisRequest,
    StrategyCard,
    VoiceCommand,
)
from backend.services.audit_log import append_audit_event
from backend.services.intent_service import build_order_proposal, build_strategy_card
from backend.services.llm_service import llm_service
from backend.services.order_guard import confirm_order
from backend.services.strategy_analysis import analyze_strategies


router = APIRouter()


@router.post("/interpret", response_model=LLMIntent)
async def interpret_voice(command: VoiceCommand) -> LLMIntent:
    intent = await llm_service.interpret(command)
    append_audit_event(
        "voice_interpreted",
        {
            "source": command.source,
            "locale": command.locale,
            "mode": command.mode,
            "text": command.text,
            "intent": intent.model_dump(),
        },
    )
    return intent


@router.post("/strategy-card", response_model=StrategyCard)
async def create_strategy_card(intent: LLMIntent) -> StrategyCard:
    if intent.intent not in ("create_strategy", "explain_strategy"):
        raise HTTPException(status_code=422, detail="Intent is not a strategy request.")
    card = build_strategy_card(intent)
    append_audit_event("strategy_card_created", card.model_dump())
    return card


@router.post("/strategy-analysis", response_model=StrategyAnalysis)
async def create_strategy_analysis(request: StrategyAnalysisRequest) -> StrategyAnalysis:
    analysis = analyze_strategies(request.intent, request.source_text)
    append_audit_event(
        "strategy_analysis_created",
        {
            "intent": request.intent.model_dump(),
            "source_text": request.source_text,
            "analysis": analysis.model_dump(),
        },
    )
    return analysis


@router.post("/order-proposal", response_model=OrderProposal)
async def create_order_proposal(intent: LLMIntent) -> OrderProposal:
    if intent.intent != "create_order_draft":
        raise HTTPException(status_code=422, detail="Intent is not an order draft request.")
    try:
        proposal = build_order_proposal(intent)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    append_audit_event("order_proposal_created", proposal.model_dump())
    return proposal


@router.post("/confirm-order", response_model=ExecutionResult)
async def confirm_voice_order(request: ConfirmOrderRequest) -> ExecutionResult:
    result = confirm_order(request)
    append_audit_event(
        "order_confirmation_result",
        {
            "proposal_id": request.proposal.proposal_id,
            "mode": request.proposal.mode,
            "user_confirmed": request.user_confirmed,
            "auth_completed": request.auth_completed,
            "execution_enabled": request.execution_enabled,
            "result": result.model_dump(),
        },
    )
    return result
