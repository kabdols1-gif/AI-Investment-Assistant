"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, ShieldCheck, Speaker } from "lucide-react";
import { AppShell } from "@/components/layout";
import { TradingWorkspace } from "@/components/trading";
import { useToast } from "@/components/ui";
import { HomeWatchlistSummary } from "@/components/watchlist/HomeWatchlistSummary";
import { assetSummary, notifications, tradingWorkspaceByStockId } from "@/lib/mockData";

export default function HomePage() {
  const toast = useToast();
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);

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
            <TradingWorkspace data={selectedData} />
          </div>
        ) : (
          <DashboardHome onBriefingVoice={() => toast.info("시장 브리핑 음성 재생을 준비하고 있습니다.")} />
        )}
      </div>
    </AppShell>
  );
}

function DashboardHome({ onBriefingVoice }: { onBriefingVoice: () => void }) {
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

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="총자산" value={assetSummary.totalAsset} />
        <MetricCard label="오늘 손익" value={assetSummary.todayProfit} accent="profit" sub={assetSummary.todayProfitRate} />
        <MetricCard label="누적 수익률" value={assetSummary.cumulativeReturn} accent="profit" sub="연환산 +12.45%" />
        <MetricCard label="예수금/주문가능금액" value={assetSummary.availableCash} />
      </section>

      <HomeWatchlistSummary />

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
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "profit" | "loss";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 truncate text-lg font-extrabold ${accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-[#071832]"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>}
    </div>
  );
}
