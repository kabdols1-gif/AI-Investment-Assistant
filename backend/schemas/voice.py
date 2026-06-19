"""Schemas for the voice investment assistant."""

from typing import Any, Literal

from pydantic import BaseModel, Field


TradingMode = Literal["simulation", "paper", "live"]


class VoiceCommand(BaseModel):
    text: str = Field(..., min_length=1)
    source: Literal["voice", "text"] = "voice"
    locale: str = "ko-KR"
    mode: TradingMode = "simulation"
    screen: Literal[
        "intro",
        "home",
        "my-strategy",
        "strategy",
        "watchlist",
        "portfolio",
        "notifications",
        "logs",
        "settings",
        "voice",
    ] | None = None


class LLMIntent(BaseModel):
    intent: Literal[
        "get_market_briefing",
        "get_asset_summary",
        "get_strategy_status",
        "recommend_strategy",
        "create_strategy",
        "create_strategy_candidate",
        "create_order_draft",
        "query_account_summary",
        "explain_strategy",
        "get_watchlist_summary",
        "add_watchlist_item",
        "set_price_alert",
        "get_portfolio_summary",
        "recommend_rebalancing",
        "get_notifications",
        "update_notification_setting",
        "open_settings",
        "update_voice_setting",
        "connect_llm_key",
        "connect_kb_openapi",
        "unknown",
    ]
    confidence: float = Field(..., ge=0, le=1)
    symbol_name: str | None = None
    symbol_code: str | None = None
    side: Literal["buy", "sell", "hold", "none"] = "none"
    amount_krw: int | None = None
    quantity: int | None = None
    condition_type: str | None = None
    condition_params: dict[str, Any] = Field(default_factory=dict)
    raw_summary: str
    assistant_message: str | None = None
    need_user_clarification: bool = False
    clarification_question: str | None = None
    mode: TradingMode = "simulation"


class StrategyAnalysisRequest(BaseModel):
    intent: LLMIntent
    source_text: str = ""


class StrategyCard(BaseModel):
    title: str
    description: str
    symbol_name: str
    symbol_code: str | None = None
    entry_condition: dict[str, Any]
    exit_condition: dict[str, Any] | None = None
    risk_rule: dict[str, Any] | None = None
    budget_krw: int | None = None
    status: Literal["draft", "validated", "waiting_confirm", "active", "rejected"]


class VoiceStrategyMatch(BaseModel):
    strategy_id: str
    name: str
    description: str
    category: str
    confidence: float = Field(..., ge=0, le=1)
    reason: str
    params: dict[str, Any] = Field(default_factory=dict)
    builder_state: dict[str, Any] | None = None


class StrategyAnalysis(BaseModel):
    summary: str
    detected_symbol_name: str | None = None
    detected_symbol_code: str | None = None
    condition_summary: str
    llm_final_answer: str
    recommended: list[VoiceStrategyMatch] = Field(default_factory=list)
    execution_ready: bool = False
    execution_blockers: list[str] = Field(default_factory=list)


class OrderProposal(BaseModel):
    proposal_id: str
    symbol_name: str
    symbol_code: str
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit", "conditional"]
    quantity: int | None = None
    amount_krw: int | None = None
    limit_price: int | None = None
    condition: dict[str, Any] | None = None
    risk_warnings: list[str] = Field(default_factory=list)
    requires_user_confirmation: bool = True
    requires_auth: bool = True
    mode: TradingMode = "simulation"


class ConfirmOrderRequest(BaseModel):
    proposal: OrderProposal
    user_confirmed: bool = False
    auth_completed: bool = False
    execution_enabled: bool = False


class ExecutionResult(BaseModel):
    request_id: str
    status: Literal["blocked", "confirmed", "submitted", "filled", "failed"]
    message: str
    order_no: str | None = None
    raw_response_masked: dict[str, Any] | None = None
