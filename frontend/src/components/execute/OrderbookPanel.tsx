"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { getOrderbook, type OrderbookData } from "@/lib/api/market";
import { cn } from "@/lib/utils";
import { getWsBase } from "@/lib/api/client";

const ORDERBOOK_DISPLAY_DEPTH = 5;

interface OrderbookPanelProps {
  stockCode: string;
  stockName?: string;
  exchange?: string | null;
  currentPrice?: number | null;
  currency?: string | null;
  onPriceSelect?: (price: number) => void;
  className?: string;
  /** Enable WebSocket real-time updates */
  realtime?: boolean;
}

export function OrderbookPanel({
  stockCode,
  stockName,
  exchange,
  currentPrice,
  currency,
  onPriceSelect,
  className,
  realtime = true,
}: OrderbookPanelProps) {
  const [orderbook, setOrderbook] = useState<OrderbookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch orderbook via REST API
  const fetchOrderbook = useCallback(async () => {
    if (!stockCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getOrderbook(stockCode, "real", exchange);
      // Don't update state if unmounted during async operation
      if (!isMountedRef.current) return;

      if (response.status === "success" && response.data) {
        const scopedOrderbook = normalizeOrderbookForStock(response.data, stockCode, stockName, exchange, currency);
        if (scopedOrderbook) {
          setOrderbook(scopedOrderbook);
        }
      } else {
        setError(response.message || "호가 조회 실패");
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "호가 조회 오류");
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [stockCode, stockName, exchange, currency]);

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    // Don't connect if unmounted
    if (!isMountedRef.current) return;
    if (!realtime || !stockCode) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const params = new URLSearchParams();
      if (exchange) params.set("exchange", exchange);
      const query = params.toString();
      const wsUrl = `${getWsBase()}/api/market/ws/${encodeURIComponent(stockCode)}${query ? `?${query}` : ""}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "orderbook" && data.data) {
            const scopedOrderbook = normalizeOrderbookForStock(
              {
                ...data.data,
                stock_code: data.data.stock_code ?? data.stock_code ?? stockCode,
                stock_name: data.data.stock_name ?? stockName,
                exchange: data.data.exchange ?? data.exchange ?? exchange,
                currency: data.data.currency ?? currency,
              },
              stockCode,
              stockName,
              exchange,
              currency
            );
            if (!scopedOrderbook) return;
            setOrderbook((prev) => ({
              ...(isOrderbookForStock(prev, stockCode) ? prev : null),
              ...scopedOrderbook,
              // WS가 current_price를 보내지 않으면 기존 값 유지
              current_price: scopedOrderbook.current_price ?? prev?.current_price ?? 0,
            }));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        // Fall back to REST API
        fetchOrderbook();
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        // Only reconnect if still mounted and realtime is enabled
        if (realtime) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connectWebSocket();
            }
          }, 5000);
        }
      };

      wsRef.current = ws;
    } catch {
      // WebSocket not supported, use REST API
      setIsConnected(false);
      fetchOrderbook();
    }
  }, [stockCode, stockName, exchange, currency, realtime, fetchOrderbook]);

  // Initial fetch and WebSocket setup
  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;

    fetchOrderbook();

    if (realtime) {
      connectWebSocket();
    }

    return () => {
      // Mark as unmounted to prevent reconnection attempts
      isMountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [stockCode, realtime, fetchOrderbook, connectWebSocket]);

  const handlePriceClick = (price: number) => {
    onPriceSelect?.(price);
  };

  const currentOrderbook = isOrderbookForStock(orderbook, stockCode) ? orderbook : null;
  const displayCurrency = currentOrderbook?.currency ?? currency;
  const displayCurrentPrice = typeof currentPrice === "number" && currentPrice > 0 ? currentPrice : currentOrderbook?.current_price ?? 0;
  const askPrices = (currentOrderbook?.ask_prices || []).slice(0, ORDERBOOK_DISPLAY_DEPTH);
  const askVolumes = (currentOrderbook?.ask_volumes || []).slice(0, ORDERBOOK_DISPLAY_DEPTH);
  const bidPrices = (currentOrderbook?.bid_prices || []).slice(0, ORDERBOOK_DISPLAY_DEPTH);
  const bidVolumes = (currentOrderbook?.bid_volumes || []).slice(0, ORDERBOOK_DISPLAY_DEPTH);

  // Calculate max volume for bar sizing
  const maxVolume = Math.max(...askVolumes, ...bidVolumes, 1);

  if (isLoading && !currentOrderbook) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !currentOrderbook) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={fetchOrderbook}
          className="mt-2 text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!currentOrderbook) return null;

  return (
    <div className={cn("", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            호가창
          </span>
          {stockName && (
            <span className="max-w-24 truncate text-xs text-slate-400">
              {stockName}
            </span>
          )}
          {realtime && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                isConnected ? "text-green-500" : "text-slate-400"
              )}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>실시간</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>연결 끊김</span>
                </>
              )}
            </span>
          )}
        </div>
        <button
          onClick={fetchOrderbook}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Orderbook Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        {/* Ask (Sell) Orders - Red */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {askPrices.slice().reverse().map((price, idx) => {
            const volume = askVolumes[askVolumes.length - 1 - idx] || 0;
            const barWidth = (volume / maxVolume) * 100;

            return (
              <button
                key={`ask-${idx}`}
                data-testid="confirm-orderbook-ask-row"
                onClick={() => handlePriceClick(price)}
                className="w-full flex items-center relative hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                {/* Volume Bar (Background) */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-red-100 dark:bg-red-900/20"
                  style={{ width: `${barWidth}%` }}
                />
                {/* Content */}
                <div className="relative z-10 flex items-center justify-between w-full px-3 py-1.5">
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {volume?.toLocaleString() ?? "-"}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-red-500 font-medium">
                    {formatOrderbookPrice(price, displayCurrency)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current Price Divider */}
        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">현재가</span>
          <span className="font-mono font-bold text-sm">
            {formatOrderbookPrice(displayCurrentPrice, displayCurrency)}
          </span>
        </div>

        {/* Bid (Buy) Orders - Blue */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {bidPrices.map((price, idx) => {
            const volume = bidVolumes[idx] || 0;
            const barWidth = (volume / maxVolume) * 100;

            return (
              <button
                key={`bid-${idx}`}
                data-testid="confirm-orderbook-bid-row"
                onClick={() => handlePriceClick(price)}
                className="w-full flex items-center relative hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
              >
                {/* Volume Bar (Background) */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-blue-100 dark:bg-blue-900/20"
                  style={{ width: `${barWidth}%` }}
                />
                {/* Content */}
                <div className="relative z-10 flex items-center justify-between w-full px-3 py-1.5">
                  <span className="text-sm font-mono tabular-nums text-blue-500 font-medium">
                    {formatOrderbookPrice(price, displayCurrency)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {volume?.toLocaleString() ?? "-"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-400 rounded-full" />
          <span>매도 {currentOrderbook.total_ask_volume?.toLocaleString() ?? "-"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-400 rounded-full" />
          <span>매수 {currentOrderbook.total_bid_volume?.toLocaleString() ?? "-"}</span>
        </div>
      </div>
    </div>
  );
}

function normalizeOrderbookForStock(
  next: Partial<OrderbookData> | null | undefined,
  stockCode: string,
  stockName?: string,
  exchange?: string | null,
  currency?: string | null
): OrderbookData | null {
  if (!next || hasMismatchedStockCode(next.stock_code, stockCode)) return null;
  const normalizedCode = normalizeStockCode(stockCode);

  return {
    stock_code: normalizedCode,
    stock_name: next.stock_name ?? stockName ?? normalizedCode,
    current_price: numberOr(next.current_price, 0),
    ask_prices: Array.isArray(next.ask_prices) ? next.ask_prices : [],
    ask_volumes: Array.isArray(next.ask_volumes) ? next.ask_volumes : [],
    bid_prices: Array.isArray(next.bid_prices) ? next.bid_prices : [],
    bid_volumes: Array.isArray(next.bid_volumes) ? next.bid_volumes : [],
    total_ask_volume: numberOr(next.total_ask_volume, 0),
    total_bid_volume: numberOr(next.total_bid_volume, 0),
    expected_price: numberOr(next.expected_price, 0),
    expected_volume: numberOr(next.expected_volume, 0),
    timestamp: next.timestamp ?? null,
    source: next.source,
    exchange: next.exchange ?? exchange ?? undefined,
    currency: next.currency ?? currency ?? undefined,
  };
}

function isOrderbookForStock(orderbook: OrderbookData | null, stockCode: string) {
  return Boolean(orderbook?.stock_code) && normalizeStockCode(orderbook?.stock_code) === normalizeStockCode(stockCode);
}

function hasMismatchedStockCode(incomingCode: string | null | undefined, expectedCode: string) {
  return Boolean(incomingCode) && normalizeStockCode(incomingCode) !== normalizeStockCode(expectedCode);
}

function normalizeStockCode(code: string | null | undefined) {
  return String(code || "").trim().toUpperCase();
}

function numberOr(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatOrderbookPrice(value: number | null | undefined, currency?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
  if (isForeignCurrency(currency)) {
    return `${currencySymbol(currency)}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
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

export default OrderbookPanel;
