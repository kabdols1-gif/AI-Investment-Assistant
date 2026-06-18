/**
 * Account API
 */

import { apiGet, type ApiResponse } from "./client";
import type { AccountInfo, Holding, Balance, BuyableInfo } from "@/types/account";

export async function getAccountInfo(): Promise<ApiResponse<AccountInfo>> {
  return apiGet<ApiResponse<AccountInfo>>("/api/account/info");
}

export async function getHoldings(forceRefresh = false): Promise<ApiResponse<Holding[]>> {
  const query = forceRefresh ? "?force_refresh=true" : "";
  return apiGet<ApiResponse<Holding[]>>(`/api/account/holdings${query}`);
}

export async function getBalance(forceRefresh = false): Promise<ApiResponse<Balance>> {
  const query = forceRefresh ? "?force_refresh=true" : "";
  return apiGet<ApiResponse<Balance>>(`/api/account/balance${query}`);
}

export async function getBuyableAmount(
  stockCode: string,
  price: number = 0
): Promise<ApiResponse<BuyableInfo>> {
  const query = price > 0 ? `?price=${price}` : "";
  return apiGet<ApiResponse<BuyableInfo>>(`/api/account/buyable/${stockCode}${query}`);
}
