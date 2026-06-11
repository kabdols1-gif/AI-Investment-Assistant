/**
 * Symbols Types
 * 
 * Stock Master File Management System
 */

export interface Symbol {
  code: string;
  name: string;
  exchange: SymbolExchange;
  exchange_name: string;
}

export type SymbolExchange = "kospi" | "kosdaq" | "nasdaq" | "nyse" | "amex";

export interface RecentViewedStockItem {
  id: string;
  code: string;
  name: string;
  price: string;
  changeRate: string;
  changeDirection: "up" | "down" | "neutral";
  volume: string;
  tradingValue: string;
  iconUrl?: string;
}

export interface HoldingSummaryItem {
  id: string;
  code: string;
  name: string;
  iconUrl?: string;
  quantity: string;
  valuationAmount: string;
  profitLossAmount: string;
  profitLossRate: string;
  todayChangeRate: string;
}

export interface WatchlistSummaryItem {
  id: string;
  code: string;
  name: string;
  iconUrl?: string;
  currentPrice: string;
  changeRate: string;
  watchReason: string;
}

export interface SymbolSearchResponse {
  query: string;
  total: number;
  items: Symbol[];
}

export interface MasterStatus {
  kospi_count: number;
  kosdaq_count: number;
  nasdaq_count: number;
  nyse_count: number;
  amex_count: number;
  domestic_count: number;
  overseas_count: number;
  total_count: number;
  kospi_updated: string | null;
  kosdaq_updated: string | null;
  nasdaq_updated: string | null;
  nyse_updated: string | null;
  amex_updated: string | null;
  exchange_counts: Record<SymbolExchange, number>;
  updated_at: Record<SymbolExchange, string | null>;
  needs_update: boolean;
}

export interface CollectResult {
  success: boolean;
  kospi_count: number;
  kosdaq_count: number;
  nasdaq_count: number;
  nyse_count: number;
  amex_count: number;
  domestic_count: number;
  overseas_count: number;
  total_count: number;
  exchange_counts: Record<SymbolExchange, number>;
  errors: string[];
}
