"use client";

import { useState, useCallback, useRef } from "react";
import { getAccountInfo, getHoldings, getBalance } from "@/lib/api";
import type { AccountInfo, Holding, Balance } from "@/types/account";

// Minimum interval between API calls (in milliseconds)
const MIN_FETCH_INTERVAL = 5000; // 5 seconds
const ACCOUNT_CACHE_KEY = "aia.account.cache.v1";
const MIN_REFRESH_INDICATOR_MS = 700;

interface AccountCacheSnapshot {
  info: AccountInfo | null;
  holdings: Holding[];
  balance: Balance | null;
  lastFetchTimes: {
    info: number;
    holdings: number;
    balance: number;
  };
}

const emptyFetchTimes = {
  info: 0,
  holdings: 0,
  balance: 0,
};

let accountCache: AccountCacheSnapshot | null = null;

function readAccountCache(): AccountCacheSnapshot {
  if (accountCache) return accountCache;
  if (typeof window === "undefined") {
    accountCache = {
      info: null,
      holdings: [],
      balance: null,
      lastFetchTimes: { ...emptyFetchTimes },
    };
    return accountCache;
  }

  try {
    const raw = window.sessionStorage.getItem(ACCOUNT_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountCacheSnapshot>;
      accountCache = {
        info: parsed.info ?? null,
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        balance: parsed.balance ?? null,
        lastFetchTimes: {
          ...emptyFetchTimes,
          ...(parsed.lastFetchTimes ?? {}),
        },
      };
      return accountCache;
    }
  } catch {
    // Keep a clean in-memory cache if sessionStorage is unavailable or corrupted.
  }

  accountCache = {
    info: null,
    holdings: [],
    balance: null,
    lastFetchTimes: { ...emptyFetchTimes },
  };
  return accountCache;
}

function writeAccountCache(next: Partial<AccountCacheSnapshot>) {
  const current = readAccountCache();
  accountCache = {
    info: next.info ?? current.info,
    holdings: next.holdings ?? current.holdings,
    balance: next.balance ?? current.balance,
    lastFetchTimes: next.lastFetchTimes ?? current.lastFetchTimes,
  };

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(accountCache));
    } catch {
      // Session cache is an optimization only.
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface UseAccountResult {
  info: AccountInfo | null;
  holdings: Holding[];
  balance: Balance | null;
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;
  error: string | null;
  fetchInfo: () => Promise<void>;
  fetchHoldings: (forceRefresh?: boolean) => Promise<void>;
  fetchBalance: (forceRefresh?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  resetThrottle: () => void;
}

export function useAccount(): UseAccountResult {
  const initialCache = readAccountCache();
  const [info, setInfo] = useState<AccountInfo | null>(initialCache.info);
  const [holdings, setHoldings] = useState<Holding[]>(initialCache.holdings);
  const [balance, setBalance] = useState<Balance | null>(initialCache.balance);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(Boolean(initialCache.balance || initialCache.holdings.length > 0));
  const [error, setError] = useState<string | null>(null);

  // Track last fetch times to prevent excessive API calls
  const lastFetchTimes = useRef({ ...initialCache.lastFetchTimes });

  const persistFetchTimes = useCallback(() => {
    writeAccountCache({ lastFetchTimes: { ...lastFetchTimes.current } });
  }, []);

  const fetchInfo = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTimes.current.info < MIN_FETCH_INTERVAL) {
      return; // Skip if called too recently
    }

    setIsLoading(true);
    // Don't clear error here - preserve previous state

    try {
      const response = await getAccountInfo();
      if (response.status === "success" && response.data) {
        setInfo(response.data);
        writeAccountCache({ info: response.data });
        setError(null); // Only clear error on success
        lastFetchTimes.current.info = now;
        persistFetchTimes();
      } else {
        // Set error but DON'T clear existing data
        setError(response.message || "계좌 정보 조회 실패");
      }
    } catch (err) {
      // Set error but DON'T clear existing data
      const message = err instanceof Error ? err.message : "계좌 정보 조회 오류";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [persistFetchTimes]);

  const fetchHoldings = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimes.current.holdings < MIN_FETCH_INTERVAL) {
      return; // Skip if called too recently
    }

    setIsLoading(true);

    try {
      const response = await getHoldings(forceRefresh);
      if (response.status === "success") {
        const nextHoldings = response.data || [];
        setHoldings(nextHoldings);
        setHasLoadedOnce(true);
        writeAccountCache({ holdings: nextHoldings });
        setError(null);
        lastFetchTimes.current.holdings = now;
        persistFetchTimes();
      } else {
        // Set error but DON'T clear existing holdings
        setError(response.message || "보유 종목 조회 실패");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "보유 종목 조회 오류";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [persistFetchTimes]);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimes.current.balance < MIN_FETCH_INTERVAL) {
      return; // Skip if called too recently
    }

    setIsLoading(true);

    try {
      const response = await getBalance(forceRefresh);
      if (response.status === "success" && response.data) {
        setBalance(response.data);
        setHasLoadedOnce(true);
        writeAccountCache({ balance: response.data });
        if (response.data.holdings) {
          setHoldings(response.data.holdings);
          writeAccountCache({ holdings: response.data.holdings });
          lastFetchTimes.current.holdings = now;
        }
        setError(null);
        lastFetchTimes.current.balance = now;
        persistFetchTimes();
      } else {
        // Set error but DON'T clear existing balance
        setError(response.message || "예수금 조회 실패");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "예수금 조회 오류";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [persistFetchTimes]);

  const resetThrottle = useCallback(() => {
    lastFetchTimes.current = { info: 0, holdings: 0, balance: 0 };
    persistFetchTimes();
  }, [persistFetchTimes]);

  const refresh = useCallback(async () => {
    resetThrottle();

    const startedAt = Date.now();
    setIsLoading(true);
    setError(null);

    try {
      const now = Date.now();

      try {
        const infoResponse = await getAccountInfo();
        if (infoResponse.status === "success" && infoResponse.data) {
          setInfo(infoResponse.data);
          writeAccountCache({ info: infoResponse.data });
          lastFetchTimes.current.info = now;
        }
      } catch {
        // Balance is the critical asset view data; keep trying even if account info is unavailable.
      }

      const balanceResponse = await getBalance(true);
      if (balanceResponse.status === "success" && balanceResponse.data) {
        setBalance(balanceResponse.data);
        setHasLoadedOnce(true);
        writeAccountCache({ balance: balanceResponse.data });
        if (balanceResponse.data.holdings) {
          setHoldings(balanceResponse.data.holdings);
          writeAccountCache({ holdings: balanceResponse.data.holdings });
          lastFetchTimes.current.holdings = now;
        }
        lastFetchTimes.current.balance = now;
        persistFetchTimes();
      } else {
        setError(balanceResponse.message || "잔고평가 조회 실패");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "조회 오류";
      setError(message);
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_REFRESH_INDICATOR_MS) {
        await wait(MIN_REFRESH_INDICATOR_MS - elapsed);
      }
      setIsLoading(false);
    }
  }, [resetThrottle, persistFetchTimes]);

  return {
    info,
    holdings,
    balance,
    isLoading,
    isInitialLoading: isLoading && !hasLoadedOnce,
    isRefreshing: isLoading && hasLoadedOnce,
    hasLoadedOnce,
    error,
    fetchInfo,
    fetchHoldings,
    fetchBalance,
    refresh,
    resetThrottle,
  };
}

export default useAccount;
