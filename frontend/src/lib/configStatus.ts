import type { ConfigStatus } from "@/types/config";

export const DEFAULT_CONFIG_STATUS: ConfigStatus = {
  runtime_mode: "development",
  runtime_label: "development",
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
  kb_base_url: "https://ddeveloper.kbsec.com:32484",
  kb_b2c_base_url: "https://ddeveloper.kbsec.com:32484",
  kb_b2c_token_base_url: "https://ddeveloper.kbsec.com:32484",
  kb_b2b_base_url: "https://dbaasapi.kbsec.com:32484",
  kb_credential_source: "missing",
  kb_environment: {
    kbB2cBaseUrl: "https://ddeveloper.kbsec.com:32484",
    kbB2cTokenBaseUrl: "https://ddeveloper.kbsec.com:32484",
    kbB2bBaseUrl: "https://dbaasapi.kbsec.com:32484",
  },
  live_enabled: false,
};

export function isBrokerConnected(status: ConfigStatus | null | undefined) {
  return Boolean(status?.kb_key_registered && status?.kb_secret_registered && status?.kb_base_url);
}
