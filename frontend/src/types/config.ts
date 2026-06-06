export type LLMProvider = "openai" | "anthropic" | "gemini" | "openai_compatible" | "local";
export type BrokerProvider =
  | "kb"
  | "korea_investment"
  | "mirae_asset"
  | "nh"
  | "samsung"
  | "kiwoom"
  | "shinhan"
  | "daishin"
  | "hana"
  | "custom";

export interface ConfigStatus {
  llm_provider: string;
  llm_model?: string | null;
  llm_base_url?: string | null;
  llm_key_registered: boolean;
  llm_key_masked?: string | null;
  kb_key_registered: boolean;
  kb_secret_registered: boolean;
  kb_key_masked?: string | null;
  kb_account_masked?: string | null;
  broker_provider?: BrokerProvider | string | null;
  broker_name?: string | null;
  kb_base_url?: string | null;
  live_enabled: boolean;
}

export interface LLMConfigRequest {
  provider: LLMProvider;
  api_key?: string | null;
  base_url?: string | null;
  model?: string | null;
}

export interface KBConfigRequest {
  broker?: BrokerProvider | null;
  api_key?: string | null;
  api_secret?: string | null;
  account?: string | null;
  product_code?: string | null;
  base_url?: string | null;
}

export interface ConfigUpdateResponse {
  status: string;
  message: string;
  config: ConfigStatus;
}

export interface KBConnectionTestResponse {
  status: "success" | "missing" | "failed";
  message: string;
  base_url: string;
  token_received: boolean;
  raw_response_masked?: Record<string, unknown> | null;
}
