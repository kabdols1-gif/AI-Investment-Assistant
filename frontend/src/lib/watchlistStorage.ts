import type { Symbol as StockSymbol } from "@/types/symbols";

export type WatchMarket = "domestic" | "overseas";

export interface WatchItem {
  symbol: string;
  name: string;
  market: WatchMarket;
  marketLabel: string;
  exchange: string;
  price: string;
  changeRate: string;
  volumeAmount: string;
  aiComment: string;
  signal: string;
  targetPrice: string;
  stopLossPrice: string;
  favorite: boolean;
}

export const WATCHLIST_STORAGE_KEY = "ai-investment-assistant.watchlist.v1";
export const WATCHLIST_STORAGE_EVENT = "ai-investment-assistant.watchlist.updated";

export function readStoredWatchItems(): WatchItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isWatchItem);
  } catch {
    return [];
  }
}

export function writeStoredWatchItems(items: WatchItem[]) {
  if (typeof window === "undefined") return;

  try {
    if (items.length === 0) {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    } else {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
    }
    window.dispatchEvent(new Event(WATCHLIST_STORAGE_EVENT));
  } catch {
    // localStorage may be unavailable or full; keep the in-memory list usable.
  }
}

export function createWatchItemFromSymbol(symbol: StockSymbol): WatchItem {
  return {
    symbol: symbol.code,
    name: symbol.name,
    market: "domestic",
    marketLabel: "국내",
    exchange: symbol.exchange_name || symbol.exchange.toUpperCase(),
    price: "조회 전",
    changeRate: "0.00%",
    volumeAmount: "-",
    aiComment: "관심등록 후 시세와 AI 코멘트를 확인하세요.",
    signal: "관찰",
    targetPrice: "-",
    stopLossPrice: "-",
    favorite: true,
  };
}

function isWatchItem(value: unknown): value is WatchItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<WatchItem>;
  return (
    typeof item.symbol === "string" &&
    typeof item.name === "string" &&
    (item.market === "domestic" || item.market === "overseas") &&
    typeof item.marketLabel === "string" &&
    typeof item.exchange === "string" &&
    typeof item.price === "string" &&
    typeof item.changeRate === "string" &&
    typeof item.volumeAmount === "string" &&
    typeof item.aiComment === "string" &&
    typeof item.signal === "string" &&
    typeof item.targetPrice === "string" &&
    typeof item.stopLossPrice === "string" &&
    typeof item.favorite === "boolean"
  );
}
