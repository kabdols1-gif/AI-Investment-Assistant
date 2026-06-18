"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import { TradingWorkspace } from "@/components/trading";
import { HoldingsAndWatchlistCard } from "@/components/watchlist/HoldingsAndWatchlistCard";
import { useAccount, useConfigStatus, useMarketQuotes } from "@/hooks";
import { applyQuotesToHoldings, buildQuoteAdjustedBalance } from "@/lib/accountQuoteDisplay";
import { filterStockHoldings } from "@/lib/accountHoldings";
import { getBrokerProviderOption } from "@/lib/brokerProviders";
import { isBrokerConnected } from "@/lib/configStatus";
import { tradingWorkspaceByStockId } from "@/lib/mockData";
import type { Balance, Holding } from "@/types/account";

type WorkspaceOrderSide = "buy" | "sell";

export default function AssetsPage() {
  const { status: configStatus } = useConfigStatus();
  const {
    holdings,
    balance,
    refresh,
    isLoading: accountLoading,
    isRefreshing: accountRefreshing,
    hasLoadedOnce: accountLoadedOnce,
    error: accountError,
  } = useAccount();
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [workspaceOrderSide, setWorkspaceOrderSide] = useState<WorkspaceOrderSide | null>(null);
  const [workspaceOrderQuantity, setWorkspaceOrderQuantity] = useState<string | null>(null);
  const brokerOption = getBrokerProviderOption(configStatus.broker_provider);
  const brokerConnected = isBrokerConnected(configStatus);

  const selectedData = useMemo(() => {
    if (!selectedStockId) return null;
    return tradingWorkspaceByStockId[selectedStockId] ?? null;
  }, [selectedStockId]);

  useEffect(() => {
    const syncSelectedStock = (next?: { id?: string | null; orderSide?: WorkspaceOrderSide | null; quantity?: string | null }) => {
      const searchParams = new URLSearchParams(window.location.search);
      const stockId = next?.id ?? searchParams.get("stock");
      const nextOrderSide = next?.orderSide ?? coerceWorkspaceOrderSide(searchParams.get("order"));
      const nextQuantity = next?.quantity ?? searchParams.get("quantity");

      if (stockId && tradingWorkspaceByStockId[stockId]) {
        setSelectedStockId(stockId);
        setWorkspaceOrderSide(nextOrderSide);
        setWorkspaceOrderQuantity(nextQuantity);
        return;
      }

      setSelectedStockId(null);
      setWorkspaceOrderSide(null);
      setWorkspaceOrderQuantity(null);
    };

    const handleRecentStockEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string | null; orderSide?: WorkspaceOrderSide | null; quantity?: string | null }>).detail;
      syncSelectedStock(detail ?? { id: null });
    };

    const handlePopState = () => syncSelectedStock();

    syncSelectedStock();
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("recent-stock-selected", handleRecentStockEvent);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("recent-stock-selected", handleRecentStockEvent);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <AppShell
      screen="assets"
      selectedStock={
        selectedData
          ? {
              name: selectedData.stock.name,
              code: selectedData.stock.code,
            }
          : undefined
      }
    >
      <div className="space-y-4">
        {selectedData ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedStockId(null);
                  setWorkspaceOrderSide(null);
                  setWorkspaceOrderQuantity(null);
                  window.history.replaceState(null, "", "/assets");
                  window.dispatchEvent(new CustomEvent("recent-stock-selected", { detail: { id: null } }));
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-[#071832] shadow-sm transition hover:bg-[#fff8e1] focus-ring"
              >
                자산현황
              </button>
              <p className="text-xs font-bold text-slate-500">{workspaceOrderSide === "sell" ? "매도 주문 화면" : "매수 주문 화면"}</p>
            </div>
            <TradingWorkspace
              key={`${selectedData.stock.id}-${workspaceOrderSide ?? "buy"}-${workspaceOrderQuantity ?? "0"}`}
              data={selectedData}
              brokerConnected={brokerConnected}
              brokerOption={brokerOption}
              initialOrderQuantity={workspaceOrderQuantity}
              initialOrderSide={workspaceOrderSide}
            />
          </div>
        ) : !accountLoadedOnce && !accountError ? (
          <AssetsDashboardSkeleton />
        ) : (
          <DashboardHome
            brokerConnected={brokerConnected}
            brokerOption={brokerOption}
            holdings={holdings}
            balance={balance}
            accountLoading={accountLoading}
            accountRefreshing={accountRefreshing}
            accountError={accountError}
            onRefreshAccount={refresh}
          />
        )}
      </div>
    </AppShell>
  );
}

function coerceWorkspaceOrderSide(value: string | null): WorkspaceOrderSide | null {
  if (value === "buy" || value === "sell") return value;
  return null;
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatSignedWon(value: number) {
  if (Math.round(value) === 0) return "0원";
  return `${value >= 0 ? "+" : "-"}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}원`;
}

function formatPercent(value: number) {
  if (value === 0) return "0.00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeAssets(balance: Balance | null, holdings: Holding[]) {
  const displayHoldings = filterStockHoldings(balance?.holdings ?? holdings);
  const purchaseAmount =
    balance?.purchase_amount ??
    displayHoldings.reduce((sum, item) => sum + (item.purchase_amount ?? item.avg_price * item.quantity), 0);
  const evalAmount = balance?.eval_amount ?? displayHoldings.reduce((sum, item) => sum + item.eval_amount, 0);
  const profitLoss = balance?.profit_loss ?? displayHoldings.reduce((sum, item) => sum + item.profit_loss, 0);
  const profitRate = balance?.profit_rate ?? (purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0);
  const deposit = balance?.deposit ?? 0;

  return {
    totalAsset: balance?.total_eval ?? evalAmount + deposit,
    todayProfit: profitLoss,
    todayProfitRate: profitRate,
    cumulativeReturn: profitRate,
    availableCash: balance?.withdrawable_amount ?? deposit,
    evalAmount,
    purchaseAmount,
  };
}

function DashboardHome({
  brokerConnected,
  brokerOption,
  holdings,
  balance,
  accountLoading,
  accountRefreshing,
  accountError,
  onRefreshAccount,
}: {
  brokerConnected: boolean;
  brokerOption: ReturnType<typeof getBrokerProviderOption>;
  holdings: Holding[];
  balance: Balance | null;
  accountLoading: boolean;
  accountRefreshing: boolean;
  accountError: string | null;
  onRefreshAccount: () => Promise<void>;
}) {
  const displayHoldings = filterStockHoldings(balance?.holdings ?? holdings);
  const { quotes } = useMarketQuotes(displayHoldings.map((holding) => holding.stock_code));
  const quotedHoldings = useMemo(() => applyQuotesToHoldings(displayHoldings, quotes), [displayHoldings, quotes]);
  const quoteAdjustedBalance = useMemo(() => buildQuoteAdjustedBalance(balance, quotedHoldings), [balance, quotedHoldings]);
  const summary = summarizeAssets(quoteAdjustedBalance, quotedHoldings);
  const liveAssetSummary = {
    totalAsset: formatWon(summary.totalAsset),
    todayProfit: formatSignedWon(summary.todayProfit),
    todayProfitRate: formatPercent(summary.todayProfitRate),
    cumulativeReturn: formatPercent(summary.cumulativeReturn),
    availableCash: formatWon(summary.availableCash),
    evalAmount: formatWon(summary.evalAmount),
    purchaseAmount: formatWon(summary.purchaseAmount),
  };
  const profitTone = summary.todayProfit === 0 ? "neutral" : summary.todayProfit > 0 ? "profit" : "loss";
  const returnTone = summary.cumulativeReturn === 0 ? "neutral" : summary.cumulativeReturn > 0 ? "profit" : "loss";
  const holdingCount = quotedHoldings.length;
  const fetchedAtText = quoteAdjustedBalance?.fetched_at ? `${formatDateTime(quoteAdjustedBalance.fetched_at)} 기준` : `${holdingCount}종목 기준`;

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-[#0f4c81]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[#071832]">KB 잔고평가</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {accountRefreshing ? "데이터 갱신 중" : fetchedAtText}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshAccount}
            disabled={accountLoading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 focus-ring"
          >
            <RefreshCw className={`h-4 w-4 ${accountLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            새로고침
          </button>
        </div>
      </section>

      <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption} className="mt-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="총자산"
            value={liveAssetSummary.totalAsset}
            sub={`평가 ${liveAssetSummary.evalAmount}`}
            trendTone={profitTone}
          />
          <MetricCard
            label="오늘 손익"
            value={liveAssetSummary.todayProfit}
            accent={profitTone === "neutral" ? undefined : profitTone}
            sub={liveAssetSummary.todayProfitRate}
            subTone={profitTone}
            trendTone={profitTone}
          />
          <MetricCard
            label="누적 수익률"
            value={liveAssetSummary.cumulativeReturn}
            accent={returnTone === "neutral" ? undefined : returnTone}
            subTone={returnTone}
            sub={`매입 ${liveAssetSummary.purchaseAmount}`}
            trendTone={returnTone}
          />
          <MetricCard
            label="예수금/주문가능금액"
            value={liveAssetSummary.availableCash}
            sub={balance?.account_no ? `${balance.account_no} · ${balance.product_name ?? "종합계좌"}` : "SAQM9006 계좌 기준"}
            subTone="neutral"
          />
        </section>
      </BrokerConnectionGate>

      {accountError && (
        <section className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {accountError}
        </section>
      )}

      <HoldingsAndWatchlistCard
        brokerConnected={brokerConnected}
        brokerOption={brokerOption}
        holdings={quotedHoldings}
        balance={quoteAdjustedBalance}
      />
    </>
  );
}

function AssetsDashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="자산현황 로딩 중">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-3 w-36" />
            </div>
          </div>
          <SkeletonBlock className="h-9 w-24 rounded-lg" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["총자산", "오늘 손익", "누적 수익률", "예수금/주문가능금액"].map((label) => (
          <div key={label} className="min-h-[132px] rounded-lg border border-[#dbe7f3] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <SkeletonBlock className="mt-3 h-6 w-32" />
            <SkeletonBlock className="mt-3 h-3 w-24" />
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-3 w-44" />
          </div>
          <SkeletonBlock className="h-9 w-24 rounded-lg" />
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="rounded-lg border border-slate-100 bg-[#f8fafc] p-3">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-2 h-5 w-28" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          {[0, 1, 2].map((item) => (
            <div key={item} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 border-b border-slate-100 p-4 last:border-b-0">
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <SkeletonBlock className="h-3 w-24" />
                  <SkeletonBlock className="h-3 w-16" />
                </div>
              </div>
              <SkeletonBlock className="h-4 w-16 justify-self-end" />
              <SkeletonBlock className="h-4 w-20 justify-self-end" />
              <SkeletonBlock className="h-4 w-20 justify-self-end" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  subTone,
  trendTone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "profit" | "loss" | "neutral";
  accent?: "profit" | "loss";
  trendTone?: "profit" | "loss" | "neutral";
}) {
  const DirectionIcon = trendTone === "profit" ? TrendingUp : trendTone === "loss" ? TrendingDown : null;

  return (
    <div className="relative min-h-[132px] overflow-hidden rounded-lg border border-[#dbe7f3] bg-white p-4 shadow-sm transition hover:border-[#f3d58a] hover:shadow-md">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <div className="mt-3 flex min-w-0 items-center gap-2">
        {DirectionIcon && (
          <span
            className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${metricIconToneClass(trendTone)}`}
            role="img"
            aria-label={trendTone === "profit" ? "상승" : "하락"}
            title={trendTone === "profit" ? "상승" : "하락"}
          >
            <DirectionIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <p className={`min-w-0 truncate text-xl font-black tracking-normal ${accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-[#071832]"}`}>
          {value}
        </p>
      </div>
      {sub && <p className={`mt-2 text-xs font-bold ${metricToneClass(subTone ?? "neutral")}`}>{sub}</p>}
    </div>
  );
}

function metricIconToneClass(tone: "profit" | "loss" | "neutral") {
  if (tone === "profit") return "bg-red-50 text-profit";
  if (tone === "loss") return "bg-blue-50 text-loss";
  return "bg-slate-100 text-slate-500";
}

function metricToneClass(tone: "profit" | "loss" | "neutral") {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-[#3b82f6]";
}
