import { apiGet, apiPost } from "./client";
import type { CollectResult, MasterStatus, Symbol, SymbolSearchResponse } from "@/types/symbols";

export type SymbolMasterStatus = MasterStatus;

export type SymbolMasterCollectResult = Partial<CollectResult> & {
  counts?: Record<string, number>;
  exchange_counts?: Record<string, number>;
  errors?: string[] | Record<string, string>;
};

export function searchSymbols(query: string, limit = 20, exchange?: string): Promise<SymbolSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  if (exchange) params.set("exchange", exchange);
  return apiGet<SymbolSearchResponse>(`/api/symbols/search?${params.toString()}`);
}

export function getSymbolByCode(code: string): Promise<Symbol> {
  return apiGet<Symbol>(`/api/symbols/${encodeURIComponent(code)}`);
}

export function getSymbolMasterStatus(): Promise<SymbolMasterStatus> {
  return apiGet<SymbolMasterStatus>("/api/symbols/status");
}

export function refreshSymbolMaster(market = "all"): Promise<SymbolMasterCollectResult> {
  return apiPost<SymbolMasterCollectResult>(`/api/symbols/collect?market=${encodeURIComponent(market)}`);
}

export function getMasterStatus(): Promise<MasterStatus> {
  return getSymbolMasterStatus();
}

export function collectMasterFiles(market = "all"): Promise<CollectResult> {
  return apiPost<CollectResult>(`/api/symbols/collect?market=${encodeURIComponent(market)}`);
}
