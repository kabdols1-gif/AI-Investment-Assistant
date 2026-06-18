import type { PriceData } from "@/lib/api/market";
import type { MarketTone } from "@/lib/mockData";
import type { PriceTone } from "@/types/trading";

export type QuoteDirection = "up" | "down" | "neutral";

export type QuoteDisplay = {
  price: string;
  change: string;
  changeRate: string;
  volume: string;
  tradingValue: string;
  direction: QuoteDirection;
  tone: PriceTone;
  marketTone: MarketTone;
};

export const ZERO_QUOTE_DISPLAY: QuoteDisplay = {
  price: "0",
  change: "0",
  changeRate: "0%",
  volume: "0",
  tradingValue: "0",
  direction: "neutral",
  tone: "neutral",
  marketTone: "neutral",
};

export function normalizeQuoteCode(code: string | null | undefined) {
  const value = String(code ?? "").trim().toUpperCase();
  return /^\d+$/.test(value) ? value.padStart(6, "0") : value;
}

export function isKrxQuoteCode(code: string | null | undefined) {
  return /^\d{6}$/.test(normalizeQuoteCode(code));
}

export function isKbQuoteCode(code: string | null | undefined) {
  const normalized = normalizeQuoteCode(code);
  return isKrxQuoteCode(normalized) || /^[A-Z][A-Z0-9.-]{0,11}$/.test(normalized);
}

export function hasUsableQuote(quote: PriceData | null | undefined): quote is PriceData {
  return typeof quote?.price === "number" && Number.isFinite(quote.price) && quote.price > 0;
}

export function formatQuoteDisplay(quote: PriceData | null | undefined): QuoteDisplay {
  if (!hasUsableQuote(quote)) return ZERO_QUOTE_DISPLAY;

  const direction = quote.change_rate > 0 || quote.change > 0 ? "up" : quote.change_rate < 0 || quote.change < 0 ? "down" : "neutral";
  const tone = direction === "up" ? "up" : direction === "down" ? "down" : "neutral";
  return {
    price: formatPrice(quote.price, quote.currency),
    change: formatSignedPrice(quote.change, quote.currency),
    changeRate: formatSignedPercent(quote.change_rate),
    volume: quote.volume > 0 ? Math.round(quote.volume).toLocaleString("ko-KR") : "0",
    tradingValue: quote.trading_value && quote.trading_value > 0 ? formatTradingValue(quote.trading_value, quote.currency) : "0",
    direction,
    tone,
    marketTone: tone,
  };
}

export function getQuoteFromMap(quotes: Record<string, PriceData | null | undefined>, code: string | null | undefined) {
  return quotes[normalizeQuoteCode(code)] ?? null;
}

export function formatPrice(value: number, currency?: string | null) {
  if (isForeignCurrency(currency)) {
    return `${currencySymbol(currency)}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return Math.round(value).toLocaleString("ko-KR");
}

export function formatSignedPrice(value: number, currency?: string | null) {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (isForeignCurrency(currency)) {
    return `${value > 0 ? "+" : "-"}${currencySymbol(currency)}${Math.abs(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `${value > 0 ? "+" : "-"}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}`;
}

export function formatSignedPercent(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatTradingValue(value: number, currency?: string | null) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (isForeignCurrency(currency)) {
    if (value >= 1_000_000_000) return `${currencySymbol(currency)}${trimFixed(value / 1_000_000_000, 1)}B`;
    if (value >= 1_000_000) return `${currencySymbol(currency)}${trimFixed(value / 1_000_000, 1)}M`;
    return `${currencySymbol(currency)}${Math.round(value).toLocaleString("en-US")}`;
  }
  if (value >= 1_000_000_000_000) return `${trimFixed(value / 1_000_000_000_000, 1)}T`;
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000).toLocaleString("ko-KR")}B`;
  return Math.round(value).toLocaleString("ko-KR");
}

function trimFixed(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.0$/, "");
}

function isForeignCurrency(currency?: string | null) {
  const normalized = String(currency || "").trim().toUpperCase();
  return Boolean(normalized && normalized !== "KRW");
}

function currencySymbol(currency?: string | null) {
  const normalized = String(currency || "").trim().toUpperCase();
  if (normalized === "USD") return "$";
  if (normalized === "JPY") return "JPY ";
  if (normalized === "EUR") return "EUR ";
  return normalized ? `${normalized} ` : "";
}
