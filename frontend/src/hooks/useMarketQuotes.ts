"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getWsBase } from "@/lib/api/client";
import { getKbCurrentPrice, type PriceData } from "@/lib/api/market";
import { isKrxQuoteCode, normalizeQuoteCode } from "@/lib/marketQuoteDisplay";

type QuoteMap = Record<string, PriceData | null>;

type UseMarketQuotesOptions = {
  enabled?: boolean;
  envDv?: string;
  realtime?: boolean;
  refreshIntervalMs?: number;
};

const quoteCache = new Map<string, PriceData>();
const quoteRequests = new Map<string, Promise<PriceData | null>>();

export function useMarketQuotes(codes: Array<string | null | undefined>, options: UseMarketQuotesOptions = {}) {
  const { enabled = true, envDv = "real", realtime = true, refreshIntervalMs = 30000 } = options;
  const codeKey = codes.map(normalizeQuoteCode).filter(Boolean).sort().join("|");
  const quoteCodes = useMemo(
    () => (codeKey ? Array.from(new Set(codeKey.split("|").filter(isKrxQuoteCode))) : []),
    [codeKey]
  );
  const [quoteResults, setQuoteResults] = useState<QuoteMap>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const quotes = useMemo(() => buildQuoteMap(quoteCodes, quoteResults), [quoteCodes, quoteResults]);

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

      void requestQuote(code, envDv, forceRefresh)
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
  }, [enabled, envDv, quoteCodes, refreshTick]);

  useEffect(() => {
    if (!enabled || !realtime || quoteCodes.length === 0 || typeof window === "undefined") {
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    const codesParam = quoteCodes.map(encodeURIComponent).join(",");

    const connect = () => {
      if (!active) return;
      socket?.close();
      socket = new WebSocket(`${getWsBase()}/api/market/ws/prices?codes=${codesParam}&env_dv=${encodeURIComponent(envDv)}`);

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

          const current = quoteCache.get(code) ?? null;
          const quote = mergeRealtimeQuote(code, current, {
            ...payload.data,
            source: payload.source === "kis_realtime" ? "kis_realtime" : payload.data.source,
          });
          if (!hasLivePrice(quote)) return;
          quoteCache.set(code, quote);
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
  }, [enabled, envDv, quoteCodes, realtime]);

  const getQuote = useCallback((code: string | null | undefined) => quotes[normalizeQuoteCode(code)] ?? null, [quotes]);

  return {
    quotes,
    getQuote,
    requestedCodes: quoteCodes,
  };
}

function buildQuoteMap(codes: string[], quoteResults: QuoteMap) {
  return codes.reduce<QuoteMap>((map, code) => {
    map[code] = quoteCache.get(code) ?? quoteResults[code] ?? null;
    return map;
  }, {});
}

async function requestQuote(code: string, envDv: string, forceRefresh = false) {
  const cached = quoteCache.get(code);
  if (cached && !forceRefresh) return cached;

  const requestKey = `${envDv}:${code}`;
  const existingRequest = quoteRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = getKbCurrentPrice(code, envDv)
    .then((response) => {
      const quote = response.status === "success" ? response.data ?? null : null;
      if (quote) {
        quoteCache.set(code, quote);
      }
      return quote;
    })
    .catch(() => null)
    .finally(() => {
      quoteRequests.delete(requestKey);
    });

  quoteRequests.set(requestKey, request);
  return request;
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
  };
}

function numberOr(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hasLivePrice(quote: PriceData) {
  return Number.isFinite(quote.price) && quote.price > 0;
}
