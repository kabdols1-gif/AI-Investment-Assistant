import { apiGet } from "./client";

export interface AuditLogRecord {
  timestamp: string;
  event: string;
  payload: Record<string, unknown>;
  sensitive_masked: boolean;
}

export interface OpenApiLogResponse {
  status: string;
  data: {
    events: AuditLogRecord[];
    count: number;
    limit: number;
    days: number;
  };
}

export function getOpenApiLogs(limit = 100, days = 7): Promise<OpenApiLogResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    days: String(days),
  });
  return apiGet<OpenApiLogResponse>(`/api/logs/openapi?${params.toString()}`);
}
