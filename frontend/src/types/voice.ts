export type TradingMode = "simulation" | "paper" | "live";
export type VoiceSource = "voice" | "text";
export type IntentKind =
  | "get_market_briefing"
  | "get_asset_summary"
  | "get_strategy_status"
  | "recommend_strategy"
  | "create_strategy"
  | "create_strategy_candidate"
  | "create_order_draft"
  | "query_account_summary"
  | "explain_strategy"
  | "get_watchlist_summary"
  | "add_watchlist_item"
  | "set_price_alert"
  | "get_portfolio_summary"
  | "recommend_rebalancing"
  | "get_notifications"
  | "update_notification_setting"
  | "open_settings"
  | "update_voice_setting"
  | "connect_llm_key"
  | "connect_kb_openapi"
  | "unknown";

export interface VoiceCommand {
  text: string;
  source: VoiceSource;
  locale?: string;
  mode: TradingMode;
  screen?:
    | "dashboard"
    | "assets"
    | "my-strategy"
    | "market"
    | "strategy"
    | "watchlist"
    | "portfolio"
    | "notifications"
    | "logs"
    | "settings"
    | "my-settings";
}

export interface LLMIntent {
  intent: IntentKind;
  confidence: number;
  symbol_name?: string | null;
  symbol_code?: string | null;
  side: "buy" | "sell" | "hold" | "none";
  amount_krw?: number | null;
  quantity?: number | null;
  condition_type?: string | null;
  condition_params: Record<string, unknown>;
  raw_summary: string;
  assistant_message?: string | null;
  need_user_clarification: boolean;
  clarification_question?: string | null;
  mode: TradingMode;
}

export interface StrategyCard {
  title: string;
  description: string;
  symbol_name: string;
  symbol_code?: string | null;
  entry_condition: Record<string, unknown>;
  exit_condition?: Record<string, unknown> | null;
  risk_rule?: Record<string, unknown> | null;
  budget_krw?: number | null;
  status: "draft" | "validated" | "waiting_confirm" | "active" | "rejected";
}

export interface VoiceStrategyMatch {
  strategy_id: string;
  name: string;
  description: string;
  category: string;
  confidence: number;
  reason: string;
  params: Record<string, number>;
  builder_state?: Record<string, unknown> | null;
}

export interface StrategyAnalysis {
  summary: string;
  detected_symbol_name?: string | null;
  detected_symbol_code?: string | null;
  condition_summary: string;
  llm_final_answer: string;
  recommended: VoiceStrategyMatch[];
  execution_ready: boolean;
  execution_blockers: string[];
}

export interface OrderProposal {
  proposal_id: string;
  symbol_name: string;
  symbol_code: string;
  side: "buy" | "sell";
  order_type: "market" | "limit" | "conditional";
  quantity?: number | null;
  amount_krw?: number | null;
  limit_price?: number | null;
  condition?: Record<string, unknown> | null;
  risk_warnings: string[];
  requires_user_confirmation: boolean;
  requires_auth: boolean;
  mode: TradingMode;
}

export interface ConfirmOrderRequest {
  proposal: OrderProposal;
  user_confirmed: boolean;
  auth_completed: boolean;
  execution_enabled: boolean;
}

export interface ExecutionResult {
  request_id: string;
  status: "blocked" | "confirmed" | "submitted" | "filled" | "failed";
  message: string;
  order_no?: string | null;
  raw_response_masked?: Record<string, unknown> | null;
}

export interface VoiceLogEntry {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  timestamp: string;
}
