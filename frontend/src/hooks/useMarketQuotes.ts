"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getKbCurrentPrice, type PriceData } from "@/lib/api/market";
import { isKrxQuoteCode, normalizeQuoteCode } from "@/lib/marketQuoteDisplay";

type QuoteMap = Record<string, PriceData | null>;

type UseMarketQuotesOptions = {
  enabled?: boolean;
  envDv?: string;
  refreshIntervalMs?: number;
};

const quoteCache = new Map<string, PriceData>();
const quoteRequests = new Map<string, Promise<PriceData | null>>();

export function useMarketQuotes(codes: Array<string | null | undefined>, options: UseMarketQuotesOptions = {}) {
  const { enabled = true, envDv = "real", refreshIntervalMs = 30000 } = options;
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
