/**
 * Symbols Types
 * 
 * Stock Master File Management System
 */

export interface Symbol {
  code: string;
  name: string;
  exchange: "kospi" | "kosdaq";
  exchange_name: string;
}

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
  total_count: number;
  kospi_updated: string | null;
  kosdaq_updated: string | null;
  needs_update: boolean;
}

export interface CollectResult {
  success: boolean;
  kospi_count: number;
  kosdaq_count: number;
  total_count: number;
  errors: string[];
}
