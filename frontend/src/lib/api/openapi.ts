import { apiGet, apiPost } from "./client";

export interface KBOpenApiDefaultsResponse {
  status: string;
  data: {
    appsBaseUrl: string;
    tokenBaseUrl: string;
    tokenPath: string;
    defaultApiPrefix: string;
  };
}

export interface KBOpenApiTokenResponse {
  status: string;
  data: {
    base_url: string;
    client_id: string;
    token_received: boolean;
    raw_response_masked?: Record<string, unknown>;
  };
}

export interface KBOpenApiProxyRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  access_token?: string | null;
}

export interface KBOpenApiAppRegistrationRequest {
  hndlCcd?: string;
  tloginId: string;
  accountNo: string;
  pwd: string;
  cellPhone: string;
  email: string;
}

export interface KBOpenApiAppRegistrationResponse {
  status: string;
  data: {
    status: number;
    ok: boolean;
    body_masked: Record<string, unknown>;
  };
}

export interface KBOpenApiProxyResponse {
  status: string;
  data: {
    status: number;
    ok: boolean;
    headers: Record<string, string>;
    body: string;
    requestHeaders: Record<string, unknown>;
    issuedToken: boolean;
  };
}

export function getKBOpenApiB2CDefaults(): Promise<KBOpenApiDefaultsResponse> {
  return apiGet<KBOpenApiDefaultsResponse>("/api/openapi/kb/b2c/defaults");
}

export function issueKBOpenApiB2CToken(): Promise<KBOpenApiTokenResponse> {
  return apiPost<KBOpenApiTokenResponse>("/api/openapi/kb/b2c/token");
}

export function registerKBOpenApiB2CApp(request: KBOpenApiAppRegistrationRequest): Promise<KBOpenApiAppRegistrationResponse> {
  return apiPost<KBOpenApiAppRegistrationResponse>("/api/openapi/kb/b2c/apps", request);
}

export function proxyKBOpenApiB2C(request: KBOpenApiProxyRequest): Promise<KBOpenApiProxyResponse> {
  return apiPost<KBOpenApiProxyResponse>("/api/openapi/kb/b2c/proxy", request);
}
