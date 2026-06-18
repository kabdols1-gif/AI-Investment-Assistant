"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  ChevronDown,
  ExternalLink,
  Minus,
  Newspaper,
  Plus,
  RotateCcw,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import { LightweightCandlestickChart } from "@/components/charts/LightweightCharts";
import { useToast } from "@/components/ui";
import { useMarketQuotes } from "@/hooks";
import { getWsBase } from "@/lib/api/client";
import {
  getExecutions,
  getKbCurrentPrice,
  getOrderbook,
  type ExecutionData,
  type OrderbookData,
  type PriceData,
} from "@/lib/api/market";
import type { BrokerProviderOption } from "@/lib/brokerProviders";
import { tradingWorkspaceByStockId, watchItems } from "@/lib/mockData";
import { formatQuoteDisplay as formatSharedQuoteDisplay, getQuoteFromMap } from "@/lib/marketQuoteDisplay";
import { readStoredWatchItems, WATCHLIST_STORAGE_EVENT, type WatchItem } from "@/lib/watchlistStorage";
import type {
  BalanceEvaluationRow,
  BrokerTradeRow,
  ChartCandle,
  ExecutionRow,
  OrderBookRow,
  OrderHistoryRow,
  PriceTone,
  ProfitLossSummary,
  TradingWorkspaceData,
} from "@/types/trading";

type LeftInfoTab = "관심종목" | "현재가";
type MarketInfoTab = "호가" | "체결" | "거래원";
type OrderTab = "매수" | "매도" | "정정" | "취소";
type BottomTab = "차트" | "예수금" | "주문내역" | "매매손익" | "잔고평가" | "뉴스";
type WorkspaceOrderSide = "buy" | "sell";
type LiveQuoteStatus = "idle" | "loading" | "connected" | "polling" | "error";

const leftInfoTabs: LeftInfoTab[] = ["관심종목", "현재가"];
const marketInfoTabs: MarketInfoTab[] = ["호가", "체결", "거래원"];
const orderTabs: OrderTab[] = ["매수", "매도", "정정", "취소"];
const bottomTabs: BottomTab[] = ["차트", "예수금", "주문내역", "매매손익", "잔고평가", "뉴스"];
const orderTypes = ["보통", "시장가", "조건부", "최유리"];
const ratios = ["10%", "25%", "50%", "100%", "직접"];
const chartPeriods = ["1분", "5분", "15분", "30분", "일", "주", "월"];
const dualExchangeStockIds = new Set(["005930", "000660", "035720", "035420", "373220", "005380", "066570"]);

interface TradingWorkspaceProps {
  data: TradingWorkspaceData;
  brokerConnected: boolean;
  brokerOption: BrokerProviderOption;
  initialOrderQuantity?: string | null;
  initialOrderSide?: WorkspaceOrderSide | null;
}

export function TradingWorkspace({ data, brokerConnected, brokerOption, initialOrderQuantity, initialOrderSide }: TradingWorkspaceProps) {
  const toast = useToast();
  const initialOrderTab = initialOrderSide === "sell" ? "매도" : "매수";
  const initialQuantity = normalizeOrderQuantity(initialOrderQuantity);
  const [leftInfoTab, setLeftInfoTab] = useState<LeftInfoTab>("관심종목");
  const [marketInfoTab, setMarketInfoTab] = useState<MarketInfoTab>("호가");
  const [orderTab, setOrderTab] = useState<OrderTab>(initialOrderTab);
  const [bottomTab, setBottomTab] = useState<BottomTab>("차트");
  const [orderType, setOrderType] = useState("보통");
  const [ratio, setRatio] = useState(initialOrderSide === "sell" && initialQuantity !== "0" ? "100%" : "직접");
  const [period, setPeriod] = useState("일");
  const [orderDraft, setOrderDraft] = useState({
    stockId: data.stock.id,
    price: createPendingQuoteStock(data.stock).price,
    quantity: initialQuantity,
  });
  const [watchlistItems, setWatchlistItems] = useState<WatchItem[]>([]);
  const [livePrice, setLivePrice] = useState<PriceData | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveQuoteStatus>("idle");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [orderbookData, setOrderbookData] = useState<OrderbookData | null>(null);
  const [executionData, setExecutionData] = useState<ExecutionData[] | null>(null);
  const liveReconnectRef = useRef<number | null>(null);
  const { quotes: watchlistQuotes } = useMarketQuotes(watchlistItems.map((item) => item.symbol));
  const displayWatchlistItems = useMemo(
    () => watchlistItems.map((item) => applyQuoteToWatchItem(item, watchlistQuotes)),
    [watchlistItems, watchlistQuotes]
  );
  const liveStock = useMemo(() => mergeLiveStock(data.stock, livePrice), [data.stock, livePrice]);
  const liveData = useMemo<TradingWorkspaceData>(() => ({ ...data, stock: liveStock }), [data, liveStock]);
  const draftPrice = orderDraft.stockId === liveData.stock.id ? orderDraft.price : liveData.stock.price;
  const draftQuantity = orderDraft.stockId === liveData.stock.id ? orderDraft.quantity : "0";
  const orderCurrency = livePrice?.currency ?? orderbookData?.currency ?? inferStockCurrency(data.stock);

  useEffect(() => {
    const syncWatchlist = () => {
      const storedItems = readStoredWatchItems();
      setWatchlistItems(storedItems.length > 0 ? storedItems : (watchItems as WatchItem[]));
    };

    syncWatchlist();
    window.addEventListener(WATCHLIST_STORAGE_EVENT, syncWatchlist);
    return () => window.removeEventListener(WATCHLIST_STORAGE_EVENT, syncWatchlist);
  }, []);

  useEffect(() => {
    if (!isKbMarketDataSupported(data.stock)) {
      setLivePrice(null);
      setLiveStatus("idle");
      setLiveError(null);
      return;
    }

    let isActive = true;
    let socket: WebSocket | null = null;
    let pollTimer: number | null = null;
    const stockCode = data.stock.code;
    const exchange = data.stock.exchange;
    const realtimeSupported = isKisRealtimeSupported(data.stock);

    const fetchSnapshot = async () => {
      if (!isActive) return;
      setLiveStatus((status) => (status === "connected" ? status : "loading"));
      try {
        const response = await getKbCurrentPrice(stockCode, "real", exchange);
        if (!isActive) return;
        const snapshot = response.data;
        if (response.status === "success" && snapshot) {
          setLivePrice((current) => mergePriceData(current, snapshot));
          setLiveError(null);
          setLiveStatus((status) => (status === "connected" ? status : "polling"));
          return;
        }
        throw new Error(response.message || "현재가를 불러오지 못했습니다.");
      } catch (error) {
        if (!isActive) return;
        setLiveError(error instanceof Error ? error.message : "현재가를 불러오지 못했습니다.");
        setLiveStatus("error");
      }
    };

    const connectRealtime = () => {
      if (!isActive) return;
      socket?.close();
      socket = new WebSocket(`${getWsBase()}/api/market/ws/price/${stockCode}?env_dv=real`);

      socket.onopen = () => {
        if (!isActive) return;
        setLiveStatus("connected");
        setLiveError(null);
      };

      socket.onmessage = (event) => {
        if (!isActive) return;
        try {
          const payload = JSON.parse(event.data) as {
            type?: string;
            source?: string;
            status?: string;
            message?: string;
            data?: Partial<PriceData>;
          };
          const nextPrice = payload.data ? { ...payload.data, source: payload.source === "kis_realtime" ? "kis" : payload.data.source } : null;
          if (payload.type === "price" && nextPrice) {
            setLivePrice((current) => mergePriceData(current, nextPrice));
            setLiveStatus("connected");
            setLiveError(null);
          }
          if (payload.type === "status" && payload.status === "error") {
            setLiveError(payload.message || "실시간 시세 연결 오류");
          }
        } catch {
          // Ignore malformed realtime frames.
        }
      };

      socket.onerror = () => {
        if (!isActive) return;
        setLiveStatus((status) => (status === "connected" ? "polling" : "error"));
      };

      socket.onclose = () => {
        if (!isActive) return;
        setLiveStatus((status) => (status === "connected" ? "polling" : status));
        liveReconnectRef.current = window.setTimeout(connectRealtime, 5000);
      };
    };

    void fetchSnapshot();
    pollTimer = window.setInterval(() => void fetchSnapshot(), 30000);
    if (realtimeSupported) {
      connectRealtime();
    }

    return () => {
      isActive = false;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      if (liveReconnectRef.current !== null) {
        window.clearTimeout(liveReconnectRef.current);
        liveReconnectRef.current = null;
      }
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [data.stock]);

  useEffect(() => {
    if (!isKbMarketDataSupported(data.stock)) {
      setOrderbookData(null);
      setExecutionData(null);
      return;
    }

    let isActive = true;
    let marketDataTimer: number | null = null;
    const stockCode = data.stock.code;
    const exchange = data.stock.exchange;

    const fetchMarketDetails = async () => {
      const [orderbookResult, executionsResult] = await Promise.allSettled([
        getOrderbook(stockCode, "real", exchange),
        getExecutions(stockCode, "real", 10, exchange),
      ]);

      if (!isActive) return;

      if (
        orderbookResult.status === "fulfilled" &&
        orderbookResult.value.status === "success" &&
        orderbookResult.value.data
      ) {
        setOrderbookData(orderbookResult.value.data);
      } else {
        setOrderbookData(null);
      }

      if (
        executionsResult.status === "fulfilled" &&
        executionsResult.value.status === "success" &&
        executionsResult.value.data
      ) {
        setExecutionData(executionsResult.value.data.executions ?? []);
      } else {
        setExecutionData(null);
      }
    };

    void fetchMarketDetails();
    marketDataTimer = window.setInterval(() => void fetchMarketDetails(), 15000);

    return () => {
      isActive = false;
      if (marketDataTimer !== null) {
        window.clearInterval(marketDataTimer);
      }
    };
  }, [data.stock]);

  useEffect(() => {
    setOrderDraft((current) => {
      if (current.stockId !== data.stock.id) {
        return { ...current, stockId: data.stock.id, price: liveData.stock.price };
      }
      if (current.quantity !== "0" && current.price !== "0") return current;
      return { ...current, price: liveData.stock.price };
    });
  }, [data.stock.id, liveData.stock.price]);

  const orderAmount = useMemo(() => {
    const priceNumber = toNumber(draftPrice);
    const quantityNumber = toNumber(draftQuantity);
    return priceNumber * quantityNumber;
  }, [draftPrice, draftQuantity]);

  const previewOrder = () => {
    toast.info(`${liveData.stock.name} ${orderTab} 주문 preview가 생성되었습니다. 실전 주문은 제출되지 않았습니다.`);
  };

  const resetOrder = () => {
    setOrderType("보통");
    setRatio("직접");
    setOrderDraft({
      stockId: data.stock.id,
      price: liveData.stock.price,
      quantity: "0",
    });
  };

  const handleWatchItemSelect = (symbol: string) => {
    window.dispatchEvent(new CustomEvent("watchlist-stock-selected", { detail: { id: symbol } }));
  };

  const handleBalanceStockSell = (row: BalanceEvaluationRow) => {
    const stock = getTradingStockByName(row.name);
    if (!stock) {
      toast.warning(`${row.name} 매도 주문 정보를 찾을 수 없습니다.`);
      return;
    }

    setOrderTab("매도");
    setOrderType("보통");
    setRatio("100%");
    setOrderDraft({
      stockId: stock.id,
      price: createPendingQuoteStock(stock).price,
      quantity: getOrderQuantityFromBalance(row.quantity),
    });
    window.dispatchEvent(new CustomEvent("portfolio-stock-selected", { detail: { id: stock.id } }));
    window.requestAnimationFrame(() => {
      document.getElementById("trading-order-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    toast.info(`${stock.name} 매도 주문 화면으로 전환했습니다.`);
  };

  const handlePriceChange = (value: string) => {
    setOrderDraft((current) => ({
      stockId: data.stock.id,
      price: value,
      quantity: current.stockId === data.stock.id ? current.quantity : "0",
    }));
  };

  const handleQuantityChange = (value: string) => {
    setOrderDraft((current) => ({
      stockId: data.stock.id,
      price: current.stockId === data.stock.id ? current.price : liveData.stock.price,
      quantity: value,
    }));
  };

  return (
    <div className="space-y-2">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <StockHeader data={liveData} liveError={liveError} liveStatus={liveStatus} />

        <div className="mt-2 grid items-stretch gap-2 xl:grid-cols-[minmax(300px,0.74fr)_minmax(0,1.74fr)]">
          <div className="min-h-0 xl:row-span-2">
            <LeftStockPanel
              activeTab={leftInfoTab}
              data={liveData}
              livePrice={livePrice}
              watchlistItems={displayWatchlistItems}
              onSelectWatchItem={handleWatchItemSelect}
              onTabChange={setLeftInfoTab}
            />
          </div>

          <div className="grid min-w-0 gap-2 2xl:grid-cols-[minmax(380px,1fr)_minmax(360px,0.76fr)]">
            <MarketInfoPanel
              activeTab={marketInfoTab}
              data={liveData}
              executions={executionData}
              orderbook={orderbookData}
              onTabChange={setMarketInfoTab}
            />
            <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption}>
              <OrderFormPanel
                activeTab={orderTab}
                amount={orderAmount}
                orderType={orderType}
                price={draftPrice}
                quantity={draftQuantity}
                ratio={ratio}
                currency={orderCurrency}
                onOrderTypeChange={setOrderType}
                onPreview={previewOrder}
                onPriceChange={handlePriceChange}
                onQuantityChange={handleQuantityChange}
                onRatioChange={setRatio}
                onReset={resetOrder}
                onTabChange={setOrderTab}
              />
            </BrokerConnectionGate>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 pt-2">
              {bottomTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setBottomTab(tab)}
                  className={`h-8 rounded-t-md px-3 text-xs font-extrabold transition focus-ring ${
                    tab === bottomTab
                      ? "border-b-2 border-[#1d4ed8] text-[#071832]"
                      : "text-slate-500 hover:bg-[#fff8e1] hover:text-[#071832]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-2">
              {bottomTab === "차트" && (
                <ChartPanel candles={data.chartCandles} period={period} onPeriodChange={setPeriod} stock={liveData.stock} />
              )}
              {bottomTab === "뉴스" && <NewsPanel stock={liveData.stock} />}
              {bottomTab !== "차트" && bottomTab !== "뉴스" && (
                <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption} showNotice={false}>
                  {bottomTab === "예수금" && <CashPanel rows={data.cashSummary} />}
                  {bottomTab === "주문내역" && <OrderHistoryPanel rows={data.orderHistory} stock={liveData.stock} />}
                  {bottomTab === "매매손익" && <ProfitLossPanel rows={data.profitLoss} stock={liveData.stock} />}
                  {bottomTab === "잔고평가" && <BalancePanel rows={data.balanceEvaluation} onSellStock={handleBalanceStockSell} />}
                </BrokerConnectionGate>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function StockHeader({
  data,
  liveError,
  liveStatus,
}: {
  data: TradingWorkspaceData;
  liveError: string | null;
  liveStatus: LiveQuoteStatus;
}) {
  const { stock } = data;
  const exchangeLabel = getExchangeDisplayLabel(stock);
  const liveState = getLiveQuoteState(liveStatus, liveError);
  const LiveIcon = liveState.connected ? Wifi : WifiOff;

  return (
    <div className="grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-[#f8fafc] px-3 py-2">
        <div className="min-w-[132px] max-w-[220px] pr-1">
          <p className="truncate text-xl font-black tracking-normal text-[#071832]">{stock.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-extrabold text-slate-500">{exchangeLabel}</p>
            {liveStatus !== "idle" && (
              <span
                className={`inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-extrabold ${liveState.className}`}
                title={liveState.title}
              >
                <LiveIcon className="h-3 w-3" aria-hidden="true" />
                {liveState.label}
              </span>
            )}
          </div>
        </div>
        <StockHeaderMetric label="종목코드" value={stock.code} valueClassName="font-mono text-base text-[#071832]" />
        <StockHeaderMetric label="가격" value={stock.price} valueClassName={`text-xl ${toneTextClass(stock.tone)}`} />
        <StockHeaderMetric label="등락률" value={stock.changeRate} valueClassName={`text-lg ${toneTextClass(stock.tone)}`} />
        <StockHeaderMetric label="거래량" value={stock.volume} valueClassName="text-base text-[#071832]" />
        <StockHeaderMetric label="거래대금" value={stock.tradingValue} valueClassName="text-base text-[#071832]" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
        <span className="px-1 text-xs font-extrabold text-slate-500">종목토론</span>
        <CommunityLink href={getNaverCommunityUrl(stock.code)} label="네이버" icon="N" tone="naver" />
        <CommunityLink href={getTossCommunityUrl(stock.code)} label="토스" icon="T" tone="toss" />
      </div>
    </div>
  );
}

function StockHeaderMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName: string;
}) {
  return (
    <div className="min-w-[76px] whitespace-nowrap">
      <p className="text-[11px] font-extrabold text-slate-500">{label}</p>
      <p className={`mt-1 font-black tabular-nums ${valueClassName}`}>{value}</p>
    </div>
  );
}

function CommunityLink({
  href,
  icon,
  label,
  tone,
}: {
  href: string;
  icon: string;
  label: string;
  tone: "naver" | "toss";
}) {
  const iconClass =
    tone === "naver"
      ? "bg-[#03c75a] text-white"
      : "bg-[#2563eb] text-white";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs font-extrabold text-[#071832] transition hover:bg-[#fff8e1] focus-ring"
      aria-label={`${label} 종목토론 열기`}
      title={`${label} 종목토론 열기`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[12px] font-black ${iconClass}`} aria-hidden="true">
        {icon}
      </span>
      {label}
    </a>
  );
}

function LeftStockPanel({
  activeTab,
  data,
  livePrice,
  watchlistItems,
  onSelectWatchItem,
  onTabChange,
}: {
  activeTab: LeftInfoTab;
  data: TradingWorkspaceData;
  livePrice: PriceData | null;
  watchlistItems: WatchItem[];
  onSelectWatchItem: (symbol: string) => void;
  onTabChange: (tab: LeftInfoTab) => void;
}) {
  return (
    <div className="flex h-full min-h-[560px] flex-col rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200">
        <div className="grid grid-cols-2">
          {leftInfoTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`h-9 border-l border-slate-100 text-xs font-extrabold transition first:border-l-0 focus-ring ${
                tab === activeTab ? "border-b-2 border-[#1d4ed8] text-[#1d4ed8]" : "text-slate-500 hover:bg-[#f8fafc]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "관심종목" && (
          <WatchlistPanel activeStock={data.stock} activeStockId={data.stock.id} items={watchlistItems} onSelect={onSelectWatchItem} />
        )}
        {activeTab === "현재가" && <CurrentPricePanel livePrice={livePrice} stock={data.stock} />}
      </div>
    </div>
  );
}

function WatchlistPanel({
  activeStock,
  activeStockId,
  items,
  onSelect,
}: {
  activeStock: TradingWorkspaceData["stock"];
  activeStockId: string;
  items: WatchItem[];
  onSelect: (symbol: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center p-4 text-center text-xs font-bold text-slate-500">
        등록된 관심종목이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="grid flex-none grid-cols-[minmax(128px,1.35fr)_78px_64px_64px] rounded-t-md bg-[#f8fafc] px-2 py-1.5 text-[11px] font-extrabold text-slate-500">
        <span>종목명</span>
        <span className="text-right">현재가</span>
        <span className="text-right">대비</span>
        <span className="text-right">등락률</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = activeStockId === item.symbol;
          const market = isActive
            ? {
                price: activeStock.price,
                change: activeStock.change,
                changeRate: activeStock.changeRate,
                tone: activeStock.tone,
              }
            : getWatchItemMarket(item);

          return (
            <button
              key={item.symbol}
              type="button"
              onClick={() => onSelect(item.symbol)}
              className={`grid w-full grid-cols-[minmax(128px,1.35fr)_78px_64px_64px] items-center gap-1 border-b border-slate-100 px-2 py-2 text-left text-xs transition focus-ring ${
                isActive ? "bg-blue-50" : "hover:bg-[#fff8e1]"
              }`}
              aria-label={`${item.name} 현재 종목으로 보기`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <WatchItemLogo item={item} />
                <span className="min-w-0">
                  <span className="block truncate font-black text-[#071832]">{item.name}</span>
                  <span className="mt-0.5 block font-mono text-[10px] font-bold text-slate-500">{item.symbol}</span>
                </span>
              </span>
              <span className="text-right font-black tabular-nums text-[#071832]">{market.price}</span>
              <span className={`text-right font-extrabold tabular-nums ${toneTextClass(market.tone)}`}>{market.change}</span>
              <span className={`text-right font-extrabold tabular-nums ${toneTextClass(market.tone)}`}>{market.changeRate}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WatchItemLogo({ item }: { item: WatchItem }) {
  const iconUrl = getWatchItemIconUrl(item);

  return (
    <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-[10px] font-black text-[#071832] shadow-sm">
      <span aria-hidden={Boolean(iconUrl)}>{item.name.slice(0, 1)}</span>
      {iconUrl ? (
        <span
          className="absolute h-6 w-6 rounded bg-white bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${iconUrl})` }}
          aria-label={`${item.name} 로고`}
        />
      ) : null}
    </span>
  );
}

function MarketInfoPanel({
  activeTab,
  data,
  executions,
  orderbook,
  onTabChange,
}: {
  activeTab: MarketInfoTab;
  data: TradingWorkspaceData;
  executions: ExecutionData[] | null;
  orderbook: OrderbookData | null;
  onTabChange: (tab: MarketInfoTab) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200">
        <div className="grid grid-cols-3">
          {marketInfoTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`h-9 border-l border-slate-100 text-xs font-extrabold transition first:border-l-0 focus-ring ${
                tab === activeTab ? "border-b-2 border-[#1d4ed8] text-[#1d4ed8]" : "text-slate-500 hover:bg-[#f8fafc]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "호가" && <OrderBookPanel orderbook={orderbook} rows={data.orderBook} currentPrice={data.stock.price} />}
      {activeTab === "체결" && <ExecutionPanel executions={executions} rows={data.executions} />}
      {activeTab === "거래원" && <BrokerPanel rows={data.brokerTrades} />}
    </div>
  );
}

function CurrentPricePanel({ livePrice, stock }: { livePrice: PriceData | null; stock: TradingWorkspaceData["stock"] }) {
  const stats = [
    ["현재가", stock.price],
    ["전일대비", stock.change],
    ["등락률", stock.changeRate],
    ["거래량", stock.volume],
    ["거래대금", stock.tradingValue],
    ["시가", formatOptionalPrice(livePrice?.open, "0")],
    ["고가", formatOptionalPrice(livePrice?.high, "0")],
    ["저가", formatOptionalPrice(livePrice?.low, "0")],
    ["전일종가", formatOptionalPrice(livePrice?.previous_close, "0")],
    ["52주 최고", formatOptionalPrice(livePrice?.w52_high, "0")],
    ["52주 최저", formatOptionalPrice(livePrice?.w52_low, "0")],
    ["시가총액", "0"],
    ["PER", "0"],
    ["PBR", "0"],
  ];

  return (
    <div className="p-3">
      <div className="mb-3 rounded-lg bg-[#f8fafc] p-4">
        <p className="text-xs font-bold text-slate-500">{getExchangeDisplayLabel(stock)}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className={`text-3xl font-black tabular-nums ${toneTextClass(stock.tone)}`}>{stock.price}</span>
          <span className={`text-sm font-extrabold tabular-nums ${toneTextClass(stock.tone)}`}>{stock.change}</span>
          <span className={`text-sm font-extrabold tabular-nums ${toneTextClass(stock.tone)}`}>{stock.changeRate}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-100 px-3 py-2">
            <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
            <dd className={`mt-1 text-xs font-extrabold tabular-nums ${label === "전일대비" || label === "등락률" ? toneTextClass(stock.tone) : "text-[#071832]"}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OrderBookPanel({ orderbook, rows, currentPrice }: { orderbook: OrderbookData | null; rows: OrderBookRow[]; currentPrice: string }) {
  const displayRows = orderbook ? orderbookToRows(orderbook) : rows.map((row) => toDisplayOrderBookRow(row, currentPrice));
  const totalAskVolume = orderbook ? formatInteger(orderbook.total_ask_volume) : "0";
  const totalBidVolume = orderbook ? formatInteger(orderbook.total_bid_volume) : "0";
  const centerPrice = orderbook ? formatInteger(orderbook.current_price) : "0";

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[0.7fr_1fr_0.8fr_0.9fr_1fr_0.7fr] border-b border-slate-100 bg-[#f8fafc] px-2 py-1.5 text-center text-[11px] font-extrabold text-slate-500">
        <span>수량</span>
        <span>매도잔량</span>
        <span>호가</span>
        <span>등락률</span>
        <span>매수잔량</span>
        <span>수량</span>
      </div>
      <div>
        {displayRows.map((row, index) => {
          const isCurrent = currentPrice !== "0" && row.price === currentPrice;
          return (
            <div
              key={`${row.price}-${index}`}
              className={`grid grid-cols-[0.7fr_1fr_0.8fr_0.9fr_1fr_0.7fr] items-center px-2 py-1 text-center text-xs ${
                isCurrent ? "border-y border-[#1d4ed8] bg-blue-50" : index < 5 ? "bg-blue-50/35" : "bg-red-50/35"
              }`}
            >
              <span className="text-slate-500">{index < 5 ? "" : "0"}</span>
              <span className="font-bold tabular-nums text-slate-600">{row.askQuantity ?? ""}</span>
              <span className={`font-black tabular-nums ${toneTextClass(row.tone)}`}>{row.price}</span>
              <span className={`font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.changeRate}</span>
              <span className="font-bold tabular-nums text-slate-600">{row.bidQuantity ?? ""}</span>
              <span className="text-slate-500">{index >= 5 ? "" : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 border-t border-slate-200 px-3 py-2 text-xs font-extrabold">
        <span className="text-blue-600">총매도 {totalAskVolume}</span>
        <span className="text-center text-slate-500">{centerPrice}</span>
        <span className="text-right text-red-500">총매수 {totalBidVolume}</span>
      </div>
    </div>
  );
}

function ExecutionPanel({ executions, rows }: { executions: ExecutionData[] | null; rows: ExecutionRow[] }) {
  const displayRows = executions && executions.length > 0 ? executionsToRows(executions) : rows.map(toPendingExecutionRow);

  return (
    <div className="p-2">
      <div className="grid grid-cols-4 rounded-t-md bg-[#f8fafc] px-3 py-1.5 text-center text-xs font-extrabold text-slate-500">
        <span>시간</span>
        <span>체결가</span>
        <span>대비</span>
        <span>체결량</span>
      </div>
      {displayRows.map((row) => (
        <div key={`${row.time}-${row.quantity}`} className="grid grid-cols-4 border-b border-slate-100 px-3 py-1.5 text-center text-xs">
          <span className="tabular-nums text-slate-500">{row.time}</span>
          <span className={`font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.price}</span>
          <span className={`font-bold tabular-nums ${toneTextClass(row.tone)}`}>{row.change}</span>
          <span className="font-bold tabular-nums text-[#071832]">{row.quantity}</span>
        </div>
      ))}
    </div>
  );
}

function BrokerPanel({ rows }: { rows: BrokerTradeRow[] }) {
  const displayRows = rows.map(toPendingBrokerTradeRow);

  return (
    <div className="p-2">
      <div className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_1fr] rounded-t-md bg-[#f8fafc] px-3 py-1.5 text-center text-xs font-extrabold text-slate-500">
        <span>순위</span>
        <span>거래원</span>
        <span>매수</span>
        <span>매도</span>
        <span>순매수</span>
      </div>
      {displayRows.map((row) => (
        <div key={row.rank} className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_1fr] border-b border-slate-100 px-3 py-1.5 text-center text-xs">
          <span className="font-bold text-slate-500">{row.rank}</span>
          <span className="font-extrabold text-[#071832]">{row.broker}</span>
          <span className="tabular-nums text-red-500">{row.buy}</span>
          <span className="tabular-nums text-blue-600">{row.sell}</span>
          <span className={`font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.net}</span>
        </div>
      ))}
    </div>
  );
}

function OrderFormPanel({
  activeTab,
  amount,
  orderType,
  price,
  quantity,
  ratio,
  currency,
  onOrderTypeChange,
  onPreview,
  onPriceChange,
  onQuantityChange,
  onRatioChange,
  onReset,
  onTabChange,
}: {
  activeTab: OrderTab;
  amount: number;
  orderType: string;
  price: string;
  quantity: string;
  ratio: string;
  currency?: string | null;
  onOrderTypeChange: (value: string) => void;
  onPreview: () => void;
  onPriceChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onReset: () => void;
  onTabChange: (tab: OrderTab) => void;
}) {
  const actionClass =
    activeTab === "매도"
      ? "bg-[#1d4ed8] hover:bg-[#1e40af]"
      : activeTab === "정정"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : activeTab === "취소"
          ? "bg-violet-600 hover:bg-violet-700"
          : "bg-[#ef233c] hover:bg-[#d90429]";
  const activeClass =
    activeTab === "매도"
      ? "border-b-2 border-[#1d4ed8] text-[#1d4ed8]"
      : activeTab === "정정"
        ? "border-b-2 border-emerald-600 text-emerald-700"
        : activeTab === "취소"
          ? "border-b-2 border-violet-600 text-violet-700"
          : "border-b-2 border-[#ef233c] text-[#ef233c]";
  const actionText = activeTab === "정정" ? "정정 요청" : activeTab === "취소" ? "취소 요청" : `${activeTab} 주문`;
  const isModify = activeTab === "정정";
  const isCancel = activeTab === "취소";
  const priceUnit = currencyLabel(currency);
  const priceStep = isForeignCurrency(currency) ? 0.01 : 100;

  return (
    <div id="trading-order-panel" className="rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-4 border-b border-slate-200">
        {orderTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`h-9 border-l border-slate-100 text-xs font-extrabold first:border-l-0 transition focus-ring ${
              tab === activeTab ? activeClass : "text-slate-500 hover:bg-[#f8fafc]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-3">
        <div className="grid grid-cols-[86px_1fr] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">계좌</span>
          <button type="button" className="flex h-8 items-center justify-between rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-[#071832] focus-ring">
            0
            <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </button>
        </div>

        {!isCancel && (
          <div className="grid grid-cols-[86px_1fr] items-center gap-2">
            <span className="text-xs font-extrabold text-[#071832]">{isModify ? "정정유형" : "주문유형"}</span>
            <div className="grid grid-cols-4 gap-2">
              {orderTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onOrderTypeChange(type)}
                  className={`h-8 rounded-lg border text-xs font-extrabold transition focus-ring ${
                    type === orderType ? `${actionClass.split(" ")[0]} border-transparent text-white` : "border-slate-200 bg-white text-[#071832] hover:bg-[#fff8e1]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[86px_1fr_64px] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">주문가능금액</span>
          <span className="text-right text-xs font-black tabular-nums text-[#071832]">0</span>
          <button type="button" className="flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 text-xs font-extrabold hover:bg-[#fff8e1] focus-ring">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            계산기
          </button>
        </div>

        {(isModify || isCancel) && (
          <div className="grid grid-cols-[86px_1fr] items-center gap-2">
            <span className="text-xs font-extrabold text-[#071832]">원주문번호</span>
            <input
              value="0"
              readOnly
              className="h-8 rounded-lg border border-slate-200 bg-[#f8fafc] px-2 text-xs font-bold text-[#071832] outline-none"
            />
          </div>
        )}

        {!isCancel && <StepperField label={isModify ? "정정가격" : "가격"} unit={priceUnit} value={price} onChange={onPriceChange} step={priceStep} />}
        <StepperField label={isCancel ? "취소수량" : isModify ? "정정수량" : "수량"} unit="주" value={quantity} onChange={onQuantityChange} step={1} />

        <div className="grid grid-cols-[86px_1fr] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">{isCancel ? "취소예정금액" : isModify ? "정정예정금액" : "주문금액"}</span>
          <span className="text-right text-sm font-black tabular-nums text-[#071832]">{formatOrderAmount(amount, currency)}</span>
        </div>

        {!isCancel && <div className="grid grid-cols-5 gap-1.5">
          {ratios.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRatioChange(item)}
              className={`h-7 rounded-md border text-[11px] font-extrabold transition focus-ring ${
                item === ratio ? "border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]" : "border-slate-200 text-slate-600 hover:bg-[#fff8e1]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-500">
            {isCancel ? "선택한 원주문의 미체결 수량을 취소합니다." : isModify ? "미체결 주문의 가격 또는 수량을 정정합니다." : "주문 전 예상 금액과 수량을 확인하세요."}
          </p>
          <button type="button" onClick={onReset} className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-extrabold hover:bg-[#fff8e1] focus-ring">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            초기화
          </button>
        </div>

        <button
          type="button"
          onClick={onPreview}
          className={`h-10 w-full rounded-lg text-sm font-black text-white transition focus-ring ${actionClass}`}
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}

function StepperField({
  label,
  unit,
  value,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  step: number;
  onChange: (value: string) => void;
}) {
  const update = (next: number) => {
    onChange(Math.max(0, next).toLocaleString("ko-KR"));
  };
  const current = toNumber(value);

  return (
    <div className="grid grid-cols-[86px_1fr_38px] items-center gap-2">
      <span className="text-xs font-extrabold text-[#071832]">{label}</span>
      <div className="grid grid-cols-[36px_1fr_36px] rounded-lg border border-slate-200">
        <button type="button" onClick={() => update(current - step)} className="flex h-8 items-center justify-center border-r border-slate-200 hover:bg-[#f8fafc] focus-ring" aria-label={`${label} 낮추기`}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 px-2 text-center text-xs font-bold tabular-nums outline-none"
          inputMode="numeric"
        />
        <button type="button" onClick={() => update(current + step)} className="flex h-8 items-center justify-center border-l border-slate-200 hover:bg-[#f8fafc] focus-ring" aria-label={`${label} 높이기`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <span className="flex h-8 items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600">{unit}</span>
    </div>
  );
}

function ChartPanel({
  candles,
  period,
  stock,
  onPeriodChange,
}: {
  candles: ChartCandle[];
  period: string;
  stock: TradingWorkspaceData["stock"];
  onPeriodChange: (period: string) => void;
}) {
  const livePrice = toNumber(stock.price);
  const hasResolvedQuote = hasResolvedQuoteSource(stock.source);
  const displayPrice = hasResolvedQuote ? stock.price : "0";
  const displayChange = hasResolvedQuote ? `${stock.change} (${stock.changeRate})` : "0 (0%)";
  const periodCandles = useMemo(
    () => buildDisplayCandles(candles, period, hasResolvedQuote ? livePrice : 0),
    [candles, hasResolvedQuote, livePrice, period]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {chartPeriods.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPeriodChange(item)}
              className={`h-7 rounded-md px-2.5 text-xs font-extrabold transition focus-ring ${
                item === period ? "bg-blue-50 text-[#1d4ed8]" : "text-slate-600 hover:bg-[#fff8e1]"
              }`}
            >
              {item}
            </button>
          ))}
          <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-extrabold text-slate-600 hover:bg-[#fff8e1] focus-ring">
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            지표
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[#bfdbfe] px-2.5 py-1.5 text-xs font-extrabold text-[#1d4ed8]">기본차트</span>
        </div>
      </div>

      <div className="px-3 py-1.5 text-xs font-bold text-[#071832]">
        {stock.name} · {period} · KRX
        <span className="ml-3 text-xs text-blue-600">시 {displayPrice}</span>
        <span className="ml-2 text-xs text-blue-600">고 {displayPrice}</span>
        <span className="ml-2 text-xs text-blue-600">저 {displayPrice}</span>
        <span className="ml-2 text-xs text-blue-600">종 {displayPrice}</span>
        <span className="ml-2 text-xs text-blue-600">{displayChange}</span>
      </div>

      <div className="px-2 pb-3">
        <LightweightCandlestickChart candles={periodCandles} height={340} ariaLabel={stock.name + " " + period + " candlestick chart"} />
      </div>
    </div>
  );
}

function orderbookToRows(orderbook: OrderbookData): OrderBookRow[] {
  const currentPrice = orderbook.current_price || 0;
  const askRows: OrderBookRow[] = (orderbook.ask_prices ?? []).map((price, index) => {
    const volume = orderbook.ask_volumes?.[index] ?? 0;
    return {
      askQuantity: formatInteger(volume),
      price: formatInteger(price),
      changeRate: formatOrderbookRate(price, currentPrice),
      tone: toneFromNumber(price - currentPrice),
    };
  });
  const bidRows: OrderBookRow[] = (orderbook.bid_prices ?? []).map((price, index) => {
    const volume = orderbook.bid_volumes?.[index] ?? 0;
    return {
      price: formatInteger(price),
      changeRate: formatOrderbookRate(price, currentPrice),
      bidQuantity: formatInteger(volume),
      tone: toneFromNumber(price - currentPrice),
    };
  });

  return [...askRows.reverse(), ...bidRows].filter((row) => row.price !== "0" || row.askQuantity !== "0" || row.bidQuantity !== "0");
}

function executionsToRows(executions: ExecutionData[]): ExecutionRow[] {
  return executions.map((execution, index) => ({
    time: execution.time || String(index + 1),
    price: formatInteger(execution.price),
    change: formatSignedPrice(execution.change),
    quantity: formatInteger(execution.quantity),
    tone: execution.side === "buy" ? "up" : execution.side === "sell" ? "down" : toneFromNumber(execution.change),
  }));
}

function formatOrderbookRate(price: number, currentPrice: number) {
  if (!Number.isFinite(price) || !Number.isFinite(currentPrice) || price <= 0 || currentPrice <= 0) {
    return "0%";
  }
  return formatSignedPercent(((price - currentPrice) / currentPrice) * 100);
}

function formatInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value).toLocaleString("ko-KR") : "0";
}

function toDisplayOrderBookRow(row: OrderBookRow, currentPrice: string): OrderBookRow {
  const displayPrice = currentPrice === "0" ? "0" : currentPrice;
  return {
    ...row,
    askQuantity: row.askQuantity ? "0" : undefined,
    price: displayPrice,
    changeRate: "0%",
    bidQuantity: row.bidQuantity ? "0" : undefined,
    tone: "neutral",
  };
}

function toPendingExecutionRow(row: ExecutionRow): ExecutionRow {
  return {
    ...row,
    time: "0",
    price: "0",
    change: "0",
    quantity: "0",
    tone: "neutral",
  };
}

function toPendingBrokerTradeRow(row: BrokerTradeRow): BrokerTradeRow {
  return {
    ...row,
    buy: "0",
    sell: "0",
    net: "0",
    tone: "neutral",
  };
}

function toPendingCashRow(row: { label: string; value: string }) {
  return {
    ...row,
    value: "0",
  };
}

function toPendingOrderHistoryRow(row: OrderHistoryRow): OrderHistoryRow {
  return {
    ...row,
    time: "0",
    price: "0",
    quantity: "0",
    status: "0",
  };
}

function toPendingProfitLossRow(row: ProfitLossSummary): ProfitLossSummary {
  return {
    ...row,
    value: "0",
    tone: "neutral",
  };
}

function toPendingBalanceRow(row: BalanceEvaluationRow): BalanceEvaluationRow {
  return {
    ...row,
    quantity: "0",
    avgPrice: "0",
    evalAmount: "0",
    profitRate: "0%",
    tone: "neutral",
  };
}

function buildDisplayCandles(candles: ChartCandle[], period: string, price: number) {
  const basePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const count = Math.max(candles.length, 8);
  const flatCandles = Array.from({ length: count }, (_, index) => ({
    label: candles[index]?.label ?? String(index + 1),
    open: basePrice,
    high: basePrice,
    low: basePrice,
    close: basePrice,
    volume: 0,
  }));

  return expandCandles(
    flatCandles.map((candle, index) => ({
      ...candle,
      label: period === "?" || period === "?" || period === "?" ? candle.label : String(index + 1),
    })),
    4
  );
}

function expandCandles(candles: ChartCandle[], steps = 4): ChartCandle[] {
  if (candles.length < 2) return candles;

  const expanded: ChartCandle[] = [];

  candles.forEach((candle, index) => {
    const next = candles[index + 1];
    if (!next) {
      expanded.push(candle);
      return;
    }

    expanded.push(candle);

    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      const eased = ratio * ratio * (3 - 2 * ratio);
      const open = lerp(candle.close, next.open, eased);
      const close = lerp(candle.close, next.close, eased);
      const highBase = lerp(candle.high, next.high, eased);
      const lowBase = lerp(candle.low, next.low, eased);
      const wick = Math.abs(next.close - candle.close) * 0.08 + 18;
      const arc = Math.sin(ratio * Math.PI);

      expanded.push({
        label: "",
        open: Math.round(open),
        high: Math.round(Math.max(open, close, highBase) + wick * arc),
        low: Math.round(Math.min(open, close, lowBase) - wick * arc * 0.55),
        close: Math.round(close),
        volume: Math.round(lerp(candle.volume, next.volume, eased)),
      });
    }
  });

  return expanded;
}

function lerp(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}

function CashPanel({ rows }: { rows: { label: string; value: string }[] }) {
  const displayRows = rows.map(toPendingCashRow);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {displayRows.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-200 bg-[#f8fafc] p-4">
          <p className="text-xs font-bold text-slate-500">{row.label}</p>
          <p className="mt-2 text-lg font-black tabular-nums text-[#071832]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function OrderHistoryPanel({
  rows,
  stock,
}: {
  rows: OrderHistoryRow[];
  stock: TradingWorkspaceData["stock"];
}) {
  const displayRows = rows.map(toPendingOrderHistoryRow);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ListPanelHeader
        columns="grid-cols-[minmax(180px,1.35fr)_78px_78px_86px_78px_86px]"
        labels={["종목", "시간", "구분", "주문가격", "수량", "상태"]}
      />
      {displayRows.map((row, index) => (
        <div
          key={`${stock.id}-${index}-${row.side}`}
          className="grid grid-cols-[minmax(180px,1.35fr)_78px_78px_86px_78px_86px] items-center border-t border-slate-100 px-3 py-3 text-sm"
        >
          <StockListIdentity name={stock.name} code={stock.code} iconUrl={stock.iconUrl} />
          <span className="font-mono text-xs font-bold text-slate-500">{row.time}</span>
          <span className={`font-extrabold ${orderSideClass(row.side)}`}>{row.side}</span>
          <span className="text-right font-black tabular-nums text-[#071832]">{row.price}</span>
          <span className="text-right font-bold tabular-nums text-slate-600">{row.quantity}</span>
          <span className="justify-self-end">
            <StatusBadge status={row.status} />
          </span>
        </div>
      ))}
    </div>
  );
}

function ProfitLossPanel({
  rows,
  stock,
}: {
  rows: ProfitLossSummary[];
  stock: TradingWorkspaceData["stock"];
}) {
  const displayRows = rows.map(toPendingProfitLossRow);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ListPanelHeader
        columns="grid-cols-[minmax(180px,1.35fr)_minmax(120px,0.9fr)_120px_minmax(160px,1fr)]"
        labels={["종목", "손익 항목", "금액/수익률", "해석"]}
      />
      {displayRows.map((row) => (
        <div
          key={`${stock.id}-${row.label}`}
          className="grid grid-cols-[minmax(180px,1.35fr)_minmax(120px,0.9fr)_120px_minmax(160px,1fr)] items-center border-t border-slate-100 px-3 py-3 text-sm"
        >
          <StockListIdentity name={stock.name} code={stock.code} iconUrl={stock.iconUrl} />
          <span className="font-extrabold text-[#071832]">{row.label}</span>
          <span className={`text-right font-black tabular-nums ${toneTextClass(row.tone)}`}>{row.value}</span>
          <span className="text-right text-xs font-bold text-slate-500">{profitLossMemo(row)}</span>
        </div>
      ))}
    </div>
  );
}

function BalancePanel({
  rows,
  onSellStock,
}: {
  rows: BalanceEvaluationRow[];
  onSellStock: (row: BalanceEvaluationRow) => void;
}) {
  const displayRows = rows.map(toPendingBalanceRow);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <ListPanelHeader
        columns="grid-cols-[minmax(180px,1.35fr)_84px_96px_112px_84px_100px_92px]"
        labels={["종목", "보유수량", "평균단가", "평가금액", "수익률", "평가상태", "주문"]}
      />
      {displayRows.map((row) => {
        const stock = getTradingStockByName(row.name);
        const canSell = toNumber(row.quantity) > 0;
        return (
          <button
            type="button"
            key={`${row.name}-${row.quantity}`}
            onClick={() => {
              if (canSell) onSellStock(row);
            }}
            disabled={!canSell}
            className="grid w-full grid-cols-[minmax(180px,1.35fr)_84px_96px_112px_84px_100px_92px] items-center border-t border-slate-100 px-3 py-3 text-left text-sm transition hover:bg-blue-50/60 disabled:cursor-not-allowed disabled:hover:bg-white focus-ring"
            aria-label={`${row.name} 매도 주문 화면으로 설정`}
            title={`${row.name} 매도 주문 화면으로 설정`}
          >
            <StockListIdentity name={row.name} code={stock?.code ?? "-"} iconUrl={stock?.iconUrl} />
            <span className="text-right font-bold tabular-nums text-slate-600">{row.quantity}</span>
            <span className="text-right font-bold tabular-nums text-slate-600">{row.avgPrice}</span>
            <span className="text-right font-black tabular-nums text-[#071832]">{row.evalAmount}</span>
            <span className={`text-right font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.profitRate}</span>
            <span className="justify-self-end">
              <StatusBadge status={row.tone === "up" ? "수익" : row.tone === "down" ? "손실" : "보합"} />
            </span>
            <span className="justify-self-end rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-extrabold text-slate-500">
              0
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NewsPanel({ stock }: { stock: TradingWorkspaceData["stock"] }) {
  const newsItems = getStockNewsItems(stock);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-[#f8fafc] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Newspaper className="h-4 w-4 flex-none text-[#1d4ed8]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-black text-[#071832]">{stock.name} 뉴스</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">뉴스 제목을 선택하면 원문/검색 결과로 이동합니다.</p>
          </div>
        </div>
        <a
          href={getStockNewsHomeUrl(stock)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 transition hover:bg-[#fff8e1] hover:text-[#071832] focus-ring"
        >
          전체 뉴스
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="divide-y divide-slate-100">
        {newsItems.map((item) => (
          <a
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="grid gap-3 px-4 py-3 transition hover:bg-[#fffdf7] focus-ring md:grid-cols-[minmax(0,1fr)_120px]"
            aria-label={`${item.title} 뉴스로 이동`}
            title={`${item.title} 뉴스로 이동`}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#071832]">{item.title}</span>
              <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{item.summary}</span>
            </span>
            <span className="flex items-center justify-start gap-2 text-xs font-bold text-slate-500 md:justify-end">
              <span>{item.source}</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden="true" />
              <span>{item.time}</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ListPanelHeader({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <div className={`grid ${columns} bg-[#f8fafc] px-3 py-2 text-xs font-extrabold text-slate-500`}>
      {labels.map((label, index) => (
        <span key={label} className={index === 0 ? "text-left" : "text-right"}>
          {label}
        </span>
      ))}
    </div>
  );
}

function StockListIdentity({ name, code, iconUrl }: { name: string; code: string; iconUrl?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] text-[10px] font-black text-[#071832]">
        <span aria-hidden={Boolean(iconUrl)}>{name.slice(0, 1)}</span>
        {iconUrl ? (
          <span
            className="absolute h-6 w-6 rounded bg-[#f8fafc] bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${iconUrl})` }}
            aria-label={name}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-black text-[#071832]">{name}</span>
        <span className="block font-mono text-[11px] font-bold text-slate-500">{code}</span>
      </span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-extrabold ${statusBadgeClass(status)}`}>
      {status}
    </span>
  );
}

function getTradingStockByName(name: string) {
  return Object.values(tradingWorkspaceByStockId).find((workspace) => workspace.stock.name === name)?.stock;
}

function orderSideClass(side: string) {
  if (side === "매수") return "text-red-500";
  if (side === "매도") return "text-blue-600";
  if (side === "정정") return "text-emerald-600";
  if (side === "취소") return "text-violet-600";
  return "text-slate-600";
}

function statusBadgeClass(status: string) {
  if (status === "완료" || status === "수익") return "bg-red-50 text-red-600";
  if (status === "대기" || status === "보합") return "bg-amber-50 text-[#8a6400]";
  if (status === "손실") return "bg-blue-50 text-blue-600";
  if (status === "preview") return "bg-slate-100 text-slate-600";
  return "bg-[#f8fafc] text-slate-600";
}

function profitLossMemo(row: ProfitLossSummary) {
  if (row.tone === "up") return `${row.label}은 우호적입니다.`;
  if (row.tone === "down") return `${row.label}은 점검이 필요합니다.`;
  return `${row.label}은 중립입니다.`;
}

function isKisRealtimeSupported(stock: TradingWorkspaceData["stock"]) {
  return stock.exchange === "KRX" && /^\d{6}$/.test(stock.code);
}

function isKbMarketDataSupported(stock: TradingWorkspaceData["stock"]) {
  return isKisRealtimeSupported(stock) || /^[A-Z][A-Z0-9.-]{0,11}$/.test(stock.code);
}

function applyQuoteToWatchItem(item: WatchItem, quotes: Record<string, Parameters<typeof formatSharedQuoteDisplay>[0]>): WatchItem {
  const quote = formatSharedQuoteDisplay(getQuoteFromMap(quotes, item.symbol));
  return {
    ...item,
    price: quote.price,
    changeRate: quote.changeRate,
    volumeAmount: quote.tradingValue,
  };
}

function mergePriceData(current: PriceData | null, next: Partial<PriceData>): PriceData {
  return {
    stock_code: next.stock_code ?? current?.stock_code,
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
    source: next.source ?? current?.source,
    exchange: next.exchange ?? current?.exchange,
    currency: next.currency ?? current?.currency,
  };
}

function mergeLiveStock(stock: TradingWorkspaceData["stock"], livePrice: PriceData | null): TradingWorkspaceData["stock"] {
  if (!livePrice || !Number.isFinite(livePrice.price) || livePrice.price <= 0) return createPendingQuoteStock(stock);
  const tone = toneFromNumber(livePrice.change_rate || livePrice.change);
  return {
    ...stock,
    price: formatLivePrice(livePrice.price, livePrice.currency),
    change: formatSignedPrice(livePrice.change, livePrice.currency),
    changeRate: formatSignedPercent(livePrice.change_rate),
    tone,
    volume: livePrice.volume > 0 ? livePrice.volume.toLocaleString("ko-KR") : stock.volume,
    tradingValue: livePrice.trading_value && livePrice.trading_value > 0 ? formatTradingValue(livePrice.trading_value, livePrice.currency) : stock.tradingValue,
    source: livePrice.source?.startsWith("kb") ? "kb" : "kis",
  };
}

function hasResolvedQuoteSource(source: TradingWorkspaceData["stock"]["source"]) {
  return source === "kb" || source === "kis";
}

function createPendingQuoteStock(stock: TradingWorkspaceData["stock"]): TradingWorkspaceData["stock"] {
  return {
    ...stock,
    price: "0",
    change: "0",
    changeRate: "0%",
    tone: "neutral",
    volume: "0",
    tradingValue: "0",
    source: "pending",
  };
}

function numberOr(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatLivePrice(value: number, currency?: string | null) {
  if (isForeignCurrency(currency)) {
    return `${currencySymbol(currency)}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return Math.round(value).toLocaleString("ko-KR");
}

function formatOptionalPrice(value: number | null | undefined, fallback: string) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? formatLivePrice(value) : fallback;
}

function formatSignedPrice(value: number, currency?: string | null) {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (isForeignCurrency(currency)) {
    return `${value > 0 ? "+" : "-"}${currencySymbol(currency)}${Math.abs(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `${value > 0 ? "+" : "-"}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTradingValue(value: number, currency?: string | null) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (isForeignCurrency(currency)) {
    if (value >= 1_000_000_000) return `${currencySymbol(currency)}${trimFixed(value / 1_000_000_000, 1)}B`;
    if (value >= 1_000_000) return `${currencySymbol(currency)}${trimFixed(value / 1_000_000, 1)}M`;
    return `${currencySymbol(currency)}${Math.round(value).toLocaleString("en-US")}`;
  }
  if (value >= 1_000_000_000_000) return `${trimFixed(value / 1_000_000_000_000, 1)}T`;
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000).toLocaleString("ko-KR")}B`;
  return Math.round(value).toLocaleString("ko-KR");
}

function formatOrderAmount(value: number, currency?: string | null) {
  if (!Number.isFinite(value) || value <= 0) return isForeignCurrency(currency) ? `${currencySymbol(currency)}0.00` : "0 원";
  if (isForeignCurrency(currency)) {
    return `${currencySymbol(currency)}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `${Math.round(value).toLocaleString("ko-KR")} 원`;
}

function trimFixed(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.0$/, "");
}

function isForeignCurrency(currency?: string | null) {
  const normalized = String(currency || "").trim().toUpperCase();
  return Boolean(normalized && normalized !== "KRW");
}

function currencyLabel(currency?: string | null) {
  const normalized = String(currency || "").trim().toUpperCase();
  return normalized && normalized !== "KRW" ? normalized : "원";
}

function currencySymbol(currency?: string | null) {
  const normalized = String(currency || "").trim().toUpperCase();
  if (normalized === "USD") return "$";
  if (normalized === "JPY") return "JPY ";
  if (normalized === "EUR") return "EUR ";
  return normalized ? `${normalized} ` : "";
}

function toneFromNumber(value: number): PriceTone {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}

function getLiveQuoteState(status: LiveQuoteStatus, error: string | null) {
  if (status === "connected") {
    return {
      connected: true,
      label: "실시간",
      title: "KIS 실시간 체결가 연결됨",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "polling") {
    return {
      connected: false,
      label: "시세 갱신",
      title: "KB 현재가 조회 갱신 중",
      className: "border-blue-100 bg-blue-50 text-blue-700",
    };
  }
  if (status === "loading") {
    return {
      connected: false,
      label: "조회 중",
      title: "KB 현재가 조회 중",
      className: "border-slate-200 bg-white text-slate-500",
    };
  }
  return {
    connected: false,
    label: "연결 오류",
    title: error || "KB 조회 또는 KIS 실시간 연결 오류",
    className: "border-red-100 bg-red-50 text-red-600",
  };
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferStockCurrency(stock: TradingWorkspaceData["stock"]) {
  const exchange = String(stock.exchange || "").trim().toUpperCase();
  return exchange.includes("KRX") || exchange.includes("KOS") || exchange.includes("NXT") ? "KRW" : "USD";
}

function normalizeOrderQuantity(quantity?: string | null) {
  if (!quantity) return "0";
  return getOrderQuantityFromBalance(quantity);
}

function getOrderQuantityFromBalance(quantity: string) {
  const parsed = Number(quantity.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toLocaleString("ko-KR") : "0";
}

function getWatchItemMarket(item: WatchItem): { price: string; change: string; changeRate: string; tone: PriceTone } {
  const changeRate = item.changeRate || "0%";
  return {
    price: item.price || "0",
    change: changeRate === "0%" ? "0" : changeRate,
    changeRate,
    tone: toneFromChangeRate(changeRate),
  };
}

function getWatchItemIconUrl(item: WatchItem) {
  return tradingWorkspaceByStockId[item.symbol]?.stock.iconUrl;
}

function getExchangeDisplayLabel(stock: TradingWorkspaceData["stock"]) {
  if (stock.exchange === "KRX" && dualExchangeStockIds.has(stock.id)) {
    return "KRX/NXT";
  }

  return stock.exchange;
}

function getNaverCommunityUrl(code: string) {
  return `https://finance.naver.com/item/board.naver?code=${encodeURIComponent(code)}`;
}

function getTossCommunityUrl(code: string) {
  return `https://tossinvest.com/stocks/${encodeURIComponent(code)}/community`;
}

function getStockNewsItems(stock: TradingWorkspaceData["stock"]) {
  const source = stock.exchange === "NASDAQ" ? "Yahoo Finance" : "네이버뉴스";
  const templates = [
    {
      title: `${stock.name}, 거래대금 확대 속 주가 흐름 주목`,
      summary: `${stock.name}의 최근 가격 변동과 거래량 흐름을 함께 점검한 기사입니다.`,
      time: "09:42",
    },
    {
      title: `${stock.name} 실적 전망과 업종 모멘텀 점검`,
      summary: `실적 추정치, 업종 수급, 주요 이벤트가 현재 주가에 미치는 영향을 정리합니다.`,
      time: "10:18",
    },
    {
      title: `${stock.name}, 기관·외국인 수급 변화 체크`,
      summary: `단기 매매 관점에서 확인할 만한 수급 변화와 리스크 요인을 살펴봅니다.`,
      time: "11:05",
    },
  ];

  return templates.map((item) => ({
    ...item,
    source,
    url: getStockNewsSearchUrl(stock, item.title),
  }));
}

function getStockNewsHomeUrl(stock: TradingWorkspaceData["stock"]) {
  if (stock.exchange === "NASDAQ") {
    return `https://finance.yahoo.com/quote/${encodeURIComponent(stock.code)}/news`;
  }

  return `https://finance.naver.com/item/news.naver?code=${encodeURIComponent(stock.code)}`;
}

function getStockNewsSearchUrl(stock: TradingWorkspaceData["stock"], title: string) {
  if (stock.exchange === "NASDAQ") {
    return `https://finance.yahoo.com/quote/${encodeURIComponent(stock.code)}/news`;
  }

  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}`;
}

function toneFromChangeRate(value: string): PriceTone {
  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("+")) return "up";
  if (trimmedValue.startsWith("-")) return "down";
  return "neutral";
}

function toneTextClass(tone: PriceTone) {
  if (tone === "up") return "text-red-500";
  if (tone === "down") return "text-blue-600";
  return "text-slate-500";
}
