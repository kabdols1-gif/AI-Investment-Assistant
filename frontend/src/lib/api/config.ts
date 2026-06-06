import { apiGet, apiPost } from "./client";
import type {
  ConfigStatus,
  ConfigUpdateResponse,
  KBConnectionTestResponse,
  KBConfigRequest,
  LLMConfigRequest,
} from "@/types/config";

export function getConfigStatus(): Promise<ConfigStatus> {
  return apiGet<ConfigStatus>("/api/config/status");
}

export function saveLLMConfig(request: LLMConfigRequest): Promise<ConfigUpdateResponse> {
  return apiPost<ConfigUpdateResponse>("/api/config/llm", request);
}

export function saveKBConfig(request: KBConfigRequest): Promise<ConfigUpdateResponse> {
  return apiPost<ConfigUpdateResponse>("/api/config/kb", request);
}

export function testKBConnection(): Promise<KBConnectionTestResponse> {
  return apiPost<KBConnectionTestResponse>("/api/config/kb/test");
}
