/**
 * Market API
 */

import { apiGet } from "./client";

export interface OrderbookData {
  stock_code: string;
  stock_name: string;
  current_price: number;
  ask_prices: number[];
  ask_volumes: number[];
  bid_prices: number[];
  bid_volumes: number[];
  total_ask_volume: number;
  total_bid_volume: number;
  expected_price: number;
  expected_volume: number;
}

export interface OrderbookResponse {
  status: "success" | "error";
  data?: OrderbookData;
  message?: string;
}

export interface PriceData {
  stock_code?: string;
  price: number;
  change: number;
  change_rate: number;
  open?: number;
  high: number;
  low: number;
  previous_close?: number;
  volume: number;
  trading_value?: number;
  w52_high: number;
  w52_low: number;
  timestamp?: string | null;
  source?: string;
}

export interface PriceResponse {
  status: "success" | "error";
  data?: PriceData;
  message?: string;
}

export async function getOrderbook(
  stockCode: string,
  envDv: string = "vps"
): Promise<OrderbookResponse> {
  return apiGet<OrderbookResponse>(`/api/market/orderbook/${stockCode}?env_dv=${envDv}`);
}

export async function getKbCurrentPrice(
  stockCode: string,
  envDv: string = "real"
): Promise<PriceResponse> {
  return apiGet<PriceResponse>(`/api/market/price/${stockCode}?env_dv=${envDv}`);
}

export const getCurrentPrice = getKbCurrentPrice;
