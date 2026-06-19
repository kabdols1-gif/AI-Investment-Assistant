"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getWsBase } from "@/lib/api/client";
import { getKbCurrentPrice, type PriceData } from "@/lib/api/market";
import { isKbQuoteCode, isKrxQuoteCode, normalizeQuoteCode } from "@/lib/marketQuoteDisplay";

type QuoteMap = Record<string, PriceData | null>;

type UseMarketQuotesOptions = {
  enabled?: boolean;
  domesticExchange?: string | null;
  envDv?: string;
  realtime?: boolean;
  refreshIntervalMs?: number;
};

const quoteCache = new Map<string, PriceData>();
const quoteRequests = new Map<string, Promise<PriceData | null>>();
const DEFAULT_DOMESTIC_EXCHANGE = "KRX";
const FALLBACK_DOMESTIC_EXCHANGE = "NXT";
const REALTIME_MAX_DEVIATION_RATE = 0.15;

export function useMarketQuotes(codes: Array<string | null | undefined>, options: UseMarketQuotesOptions = {}) {
  const { domesticExchange = DEFAULT_DOMESTIC_EXCHANGE, enabled = true, envDv = "real", realtime = true, refreshIntervalMs = 30000 } = options;
  const codeKey = codes.map(normalizeQuoteCode).filter(Boolean).sort().join("|");
  const quoteCodes = useMemo(
    () => (codeKey ? Array.from(new Set(codeKey.split("|").filter(isKbQuoteCode))) : []),
    [codeKey]
  );
  const realtimeCodes = useMemo(() => quoteCodes.filter(isKrxQuoteCode), [quoteCodes]);
  const [quoteResults, setQuoteResults] = useState<QuoteMap>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const quotes = useMemo(() => buildQuoteMap(quoteCodes, quoteResults, domesticExchange), [domesticExchange, quoteCodes, quoteResults]);

  useEffect(() => {
    if (!enabled || refreshIntervalMs <= 0 || quoteCodes.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, refreshIntervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, refreshIntervalMs, quoteCodes.length]);

  useEffect(() => {
    if (!enabled || quoteCodes.length === 0) {
      return;
    }

    let cancelled = false;
    const forceRefresh = refreshTick > 0;

    quoteCodes.forEach((code) => {
      if (!forceRefresh && quoteCache.has(code)) return;

      void requestQuote(code, envDv, forceRefresh, quoteExchange(code, domesticExchange))
        .then((quote) => {
          if (cancelled) return;
          setQuoteResults((current) => ({ ...current, [code]: quote }));
        })
        .catch(() => {
          if (cancelled) return;
          setQuoteResults((current) => ({ ...current, [code]: null }));
        });
    });

    return () => {
      cancelled = true;
    };
  }, [domesticExchange, enabled, envDv, quoteCodes, refreshTick]);

  useEffect(() => {
    if (!enabled || !realtime || realtimeCodes.length === 0 || typeof window === "undefined") {
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    const codesParam = realtimeCodes.map(encodeURIComponent).join(",");
    const exchangeParam = quoteExchange(realtimeCodes[0], domesticExchange);

    const connect = () => {
      if (!active) return;
      socket?.close();
      const params = new URLSearchParams({ codes: codesParam, env_dv: envDv });
      if (exchangeParam) params.set("exchange", exchangeParam);
      socket = new WebSocket(`${getWsBase()}/api/market/ws/prices?${params.toString()}`);

      socket.onopen = () => {
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            status?: string;
            stock_code?: string;
            source?: string;
            data?: Partial<PriceData>;
          };
          if (payload.type === "status" && payload.status === "error") {
            reconnectAttempts = 5;
            socket?.close();
            return;
          }

          const code = normalizeQuoteCode(payload.stock_code ?? payload.data?.stock_code);
          if (payload.type !== "price" || !isKrxQuoteCode(code) || !payload.data) return;

          const current = getCachedQuote(code, exchangeParam);
          const quote = mergeRealtimeQuote(code, current, {
            ...payload.data,
            source: payload.source === "kis_realtime" ? "kis_realtime" : payload.data.source,
          });
          if (!hasLivePrice(quote)) return;
          if (shouldIgnoreRealtimeQuote(quote, current)) return;
          quoteCache.set(getQuoteCacheKey(code, quote.exchange ?? exchangeParam), quote);
          setQuoteResults((currentResults) => ({ ...currentResults, [code]: quote }));
        } catch {
          // Ignore malformed realtime frames.
        }
      };

      socket.onclose = () => {
        if (!active || reconnectAttempts >= 5) return;
        reconnectAttempts += 1;
        reconnectTimer = window.setTimeout(connect, 5000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [enabled, envDv, realtimeCodes, realtime, domesticExchange]);

  const getQuote = useCallback((code: string | null | undefined) => quotes[normalizeQuoteCode(code)] ?? null, [quotes]);

  return {
    quotes,
    getQuote,
    requestedCodes: quoteCodes,
  };
}

function buildQuoteMap(codes: string[], quoteResults: QuoteMap, domesticExchange?: string | null) {
  return codes.reduce<QuoteMap>((map, code) => {
    const exchange = quoteExchange(code, domesticExchange);
    map[code] = getCachedQuote(code, exchange) ?? quoteResults[code] ?? null;
    return map;
  }, {});
}

async function requestQuote(code: string, envDv: string, forceRefresh = false, exchange?: string | null) {
  const normalizedExchange = normalizeMarketExchange(exchange);
  const cached = getCachedQuote(code, normalizedExchange);
  if (cached && !forceRefresh && hasLivePrice(cached)) return cached;

  const requestKey = `${envDv}:${normalizedExchange || "-"}:${code}`;
  const existingRequest = quoteRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = fetchQuoteWithDomesticFallback(code, envDv, normalizedExchange)
    .then((quote) => {
      const scopedQuote = quote ? normalizeIncomingQuote(code, quote) : null;
      if (scopedQuote && hasLivePrice(scopedQuote)) {
        quoteCache.set(getQuoteCacheKey(code, scopedQuote.exchange ?? normalizedExchange), scopedQuote);
      }
      return scopedQuote;
    })
    .catch(() => null)
    .finally(() => {
      quoteRequests.delete(requestKey);
    });

  quoteRequests.set(requestKey, request);
  return request;
}

async function fetchQuoteWithDomesticFallback(code: string, envDv: string, exchange?: string | null) {
  const primaryQuote = await fetchQuote(code, envDv, exchange);
  if (primaryQuote && hasLivePrice(primaryQuote)) return primaryQuote;

  if (isKrxQuoteCode(code) && normalizeMarketExchange(exchange) === DEFAULT_DOMESTIC_EXCHANGE) {
    const fallbackQuote = await fetchQuote(code, envDv, FALLBACK_DOMESTIC_EXCHANGE);
    if (fallbackQuote && hasLivePrice(fallbackQuote)) return fallbackQuote;
  }

  return primaryQuote;
}

async function fetchQuote(code: string, envDv: string, exchange?: string | null) {
  try {
    const response = await getKbCurrentPrice(code, envDv, exchange);
    return response.status === "success" ? response.data ?? null : null;
  } catch {
    return null;
  }
}

function mergeRealtimeQuote(code: string, current: PriceData | null, next: Partial<PriceData>): PriceData {
  return {
    stock_code: code,
    price: numberOr(next.price, current?.price ?? 0),
    change: numberOr(next.change, current?.change ?? 0),
    change_rate: numberOr(next.change_rate, current?.change_rate ?? 0),
    open: numberOr(next.open, current?.open ?? 0),
    high: numberOr(next.high, current?.high ?? 0),
    low: numberOr(next.low, current?.low ?? 0),
    previous_close: numberOr(next.previous_close, current?.previous_close ?? 0),
    volume: numberOr(next.volume, current?.volume ?? 0),
    trading_value: numberOr(next.trading_value, current?.trading_value ?? 0),
    w52_high: numberOr(next.w52_high, current?.w52_high ?? 0),
    w52_low: numberOr(next.w52_low, current?.w52_low ?? 0),
    timestamp: next.timestamp ?? current?.timestamp ?? null,
    source: next.source ?? current?.source ?? "kis_realtime",
    exchange: next.exchange ?? current?.exchange,
    currency: next.currency ?? current?.currency,
  };
}

function getCachedQuote(code: string, exchange?: string | null) {
  const normalizedCode = normalizeQuoteCode(code);
  const cached = quoteCache.get(getQuoteCacheKey(normalizedCode, exchange));
  if (!cached) return null;
  return normalizeQuoteCode(cached.stock_code) === normalizedCode ? cached : null;
}

function normalizeIncomingQuote(code: string, quote: PriceData): PriceData | null {
  const normalizedCode = normalizeQuoteCode(code);
  const incomingCode = normalizeQuoteCode(quote.stock_code ?? normalizedCode);
  if (incomingCode !== normalizedCode) return null;
  return {
    ...quote,
    stock_code: normalizedCode,
  };
}

function numberOr(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hasLivePrice(quote: PriceData) {
  return Number.isFinite(quote.price) && quote.price > 0;
}

function shouldIgnoreRealtimeQuote(next: PriceData, current: PriceData | null) {
  if (!current || !hasLivePrice(current) || !hasLivePrice(next)) return false;
  if (!isRealtimeSource(next.source) || !isKbSource(current.source)) return false;
  return Math.abs(next.price - current.price) / current.price > REALTIME_MAX_DEVIATION_RATE;
}

function isRealtimeSource(source?: string | null) {
  return String(source || "").toLowerCase().includes("kis");
}

function isKbSource(source?: string | null) {
  return String(source || "").toLowerCase().startsWith("kb");
}

function quoteExchange(code: string, domesticExchange?: string | null) {
  return isKrxQuoteCode(code) ? domesticExchange || DEFAULT_DOMESTIC_EXCHANGE : undefined;
}

function getQuoteCacheKey(code: string, exchange?: string | null) {
  return `${normalizeMarketExchange(exchange) || "-"}:${normalizeQuoteCode(code)}`;
}

function normalizeMarketExchange(exchange?: string | null) {
  return exchange ? exchange.trim().toUpperCase() : undefined;
}
