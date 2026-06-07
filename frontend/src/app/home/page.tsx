"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, ShieldCheck, Speaker } from "lucide-react";
import { AppShell } from "@/components/layout";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import { TradingWorkspace } from "@/components/trading";
import { useToast } from "@/components/ui";
import { HoldingsAndWatchlistCard } from "@/components/watchlist/HoldingsAndWatchlistCard";
import { useConfigStatus } from "@/hooks";
import { getBrokerProviderOption } from "@/lib/brokerProviders";
import { isBrokerConnected } from "@/lib/configStatus";
import { assetSummary, notifications, tradingWorkspaceByStockId } from "@/lib/mockData";

export default function HomePage() {
  const toast = useToast();
  const { status: configStatus } = useConfigStatus();
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const brokerOption = getBrokerProviderOption(configStatus.broker_provider);
  const brokerConnected = isBrokerConnected(configStatus);

  const selectedData = useMemo(() => {
    if (!selectedStockId) return null;
    return tradingWorkspaceByStockId[selectedStockId] ?? null;
  }, [selectedStockId]);

  useEffect(() => {
    const syncSelectedStock = (nextId?: string | null) => {
      const stockId = nextId ?? new URLSearchParams(window.location.search).get("stock");
      setSelectedStockId(stockId && tradingWorkspaceByStockId[stockId] ? stockId : null);
    };

    const handleRecentStockEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string | null }>).detail;
      syncSelectedStock(detail?.id ?? null);
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

  return (
    <AppShell
      screen="home"
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
                  window.history.replaceState(null, "", "/home");
                  window.dispatchEvent(new CustomEvent("recent-stock-selected", { detail: { id: null } }));
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-[#071832] shadow-sm transition hover:bg-[#fff8e1] focus-ring"
              >
                홈 대시보드
              </button>
              <p className="text-xs font-bold text-slate-500">최근 본 종목 선택 화면</p>
            </div>
            <TradingWorkspace data={selectedData} brokerConnected={brokerConnected} brokerOption={brokerOption} />
          </div>
        ) : (
          <DashboardHome
            brokerConnected={brokerConnected}
            brokerOption={brokerOption}
            onBriefingVoice={() => toast.info("시장 브리핑 음성 재생을 준비하고 있습니다.")}
          />
        )}
      </div>
    </AppShell>
  );
}

function DashboardHome({
  brokerConnected,
  brokerOption,
  onBriefingVoice,
}: {
  brokerConnected: boolean;
  brokerOption: ReturnType<typeof getBrokerProviderOption>;
  onBriefingVoice: () => void;
}) {
  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f3f7fb] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-[#0f4c81]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="truncate text-sm font-bold text-[#071832]">
              미국 금리 인하 기대감에 국내 증시 상승, 반도체·2차전지 강세
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Link href="/portfolio" className="hidden text-xs font-bold text-[#0f4c81] sm:inline focus-ring">
              자세히 보기
            </Link>
            <button
              type="button"
              onClick={onBriefingVoice}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0f4c81] focus-ring"
              aria-label="브리핑 음성 듣기"
              title="음성 듣기"
            >
              <Speaker className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption} className="mt-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="총자산"
            value={assetSummary.totalAsset}
            sub="전일 대비 +1.02%"
            trend={[38, 42, 40, 47, 44, 52, 48, 59, 54, 64, 60, 67]}
            trendTone="neutral"
          />
          <MetricCard
            label="오늘 손익"
            value={assetSummary.todayProfit}
            accent="profit"
            sub={assetSummary.todayProfitRate}
            trend={[42, 39, 41, 45, 43, 49, 46, 55, 51, 65, 56, 60]}
            trendTone="profit"
          />
          <MetricCard
            label="누적 수익률"
            value={assetSummary.cumulativeReturn}
            accent="profit"
            sub="연환산 +12.45%"
            trend={[34, 37, 36, 41, 39, 44, 43, 49, 47, 55, 52, 58]}
            trendTone="profit"
          />
          <MetricCard
            label="예수금/주문가능금액"
            value={assetSummary.availableCash}
            sub="전일 대비 -1.05%"
            subTone="loss"
            trend={[56, 50, 54, 49, 52, 46, 48, 43, 45, 41, 44, 39]}
            trendTone="loss"
          />
        </section>
      </BrokerConnectionGate>

      <HoldingsAndWatchlistCard brokerConnected={brokerConnected} brokerOption={brokerOption} />

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-[#071832]">최근 알림</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {notifications.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-[#f8fafc] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#071832]">{item.title}</p>
                <span className="text-xs text-slate-500">{item.time}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{item.message}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  subTone,
  trend,
  trendTone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "profit" | "loss" | "neutral";
  accent?: "profit" | "loss";
  trend: number[];
  trendTone?: "profit" | "loss" | "neutral";
}) {
  return (
    <div className="relative min-h-[132px] overflow-hidden rounded-lg border border-[#dbe7f3] bg-white p-4 shadow-sm transition hover:border-[#f3d58a] hover:shadow-md">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-3 truncate text-xl font-black tracking-normal ${accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-[#071832]"}`}>
        {value}
      </p>
      {sub && <p className={`mt-2 text-xs font-bold ${metricToneClass(subTone ?? trendTone)}`}>{sub}</p>}
      <MiniTrendLine values={trend} tone={trendTone} />
    </div>
  );
}

function MiniTrendLine({
  values,
  tone,
}: {
  values: number[];
  tone: "profit" | "loss" | "neutral";
}) {
  const width = 108;
  const height = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / spread) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = tone === "profit" ? "#ef4444" : tone === "loss" ? "#3b82f6" : "#3b82f6";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute bottom-4 right-4 h-9 w-28"
      role="img"
      aria-label="요약 추세"
    >
      <polyline points={points} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  );
}

function metricToneClass(tone: "profit" | "loss" | "neutral") {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-[#3b82f6]";
}
