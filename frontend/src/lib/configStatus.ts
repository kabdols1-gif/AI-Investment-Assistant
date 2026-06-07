import type { ConfigStatus } from "@/types/config";

export const DEFAULT_CONFIG_STATUS: ConfigStatus = {
  llm_provider: "openai",
  llm_model: "gpt-4.1-mini",
  llm_base_url: "https://api.openai.com/v1",
  llm_key_registered: false,
  llm_key_masked: null,
  kb_key_registered: false,
  kb_secret_registered: false,
  kb_key_masked: null,
  kb_account_masked: null,
  broker_provider: "kb",
  broker_name: "KB증권",
  kb_base_url: "https://dbaasapi.kbsec.com:32484",
  live_enabled: false,
};

export function isBrokerConnected(status: ConfigStatus | null | undefined) {
  return Boolean(status?.kb_key_registered && status?.kb_secret_registered && status?.kb_account_masked);
}
