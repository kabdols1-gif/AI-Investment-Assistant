"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, Pause, Play, ShieldCheck, Speaker, X } from "lucide-react";
import { AppShell } from "@/components/layout";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import { TradingWorkspace } from "@/components/trading";
import { useToast } from "@/components/ui";
import { HoldingsAndWatchlistCard } from "@/components/watchlist/HoldingsAndWatchlistCard";
import { useConfigStatus } from "@/hooks";
import { getBrokerProviderOption } from "@/lib/brokerProviders";
import { isBrokerConnected } from "@/lib/configStatus";
import { assetSummary, notifications, tradingWorkspaceByStockId } from "@/lib/mockData";

type WorkspaceOrderSide = "buy" | "sell";

export default function AssetsPage() {
  const toast = useToast();
  const { status: configStatus } = useConfigStatus();
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
              <p className="text-xs font-bold text-slate-500">최근 본 종목 선택 화면</p>
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
        ) : (
          <DashboardHome
            brokerConnected={brokerConnected}
            brokerOption={brokerOption}
            onBriefingVoice={() => toast.info("시장 브리핑 음성을 재생합니다.")}
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

function DashboardHome({
  brokerConnected,
  brokerOption,
  onBriefingVoice,
}: {
  brokerConnected: boolean;
  brokerOption: ReturnType<typeof getBrokerProviderOption>;
  onBriefingVoice: () => void;
}) {
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<(typeof notifications)[number] | null>(null);
  const marketBriefing = {
    title: "미국 금리 인하 기대감에 국내 증시 상승, 반도체·2차전지 강세",
    summary: [
      "금리 인하 기대감 확대로 위험자산 선호가 개선되고 있습니다.",
      "반도체와 2차전지 중심으로 수급 유입이 관찰됩니다.",
      "환율과 외국인 순매수 지속 여부는 장중 확인이 필요합니다.",
    ],
    interpretation:
      "오늘 시장은 성장주 중심의 단기 반등 흐름이 우세합니다. 다만 지수 상승폭이 커진 구간에서는 추격 매수보다 보유 종목의 비중과 손절 기준을 먼저 점검하는 접근이 좋습니다.",
  };
  const briefingText = `${marketBriefing.title}. ${marketBriefing.summary.join(" ")} ${marketBriefing.interpretation}`;

  const speakBriefing = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsBriefingOpen(true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(briefingText);
    utterance.lang = "ko-KR";
    utterance.rate = 0.98;
    window.speechSynthesis.speak(utterance);
  };

  const openBriefingDetail = () => {
    setIsBriefingOpen(true);
    speakBriefing();
  };

  const stopBriefing = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <div
          role="button"
          tabIndex={0}
          onClick={speakBriefing}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              speakBriefing();
            }
          }}
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-[#f3f7fb] px-4 py-3 transition hover:bg-[#eef6ff] focus-ring"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-[#0f4c81]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="truncate text-sm font-bold text-[#071832]">
              {marketBriefing.title}
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openBriefingDetail();
              }}
              className="hidden text-xs font-bold text-[#0f4c81] sm:inline focus-ring"
            >
              자세히 보면서 듣기
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onBriefingVoice();
                speakBriefing();
              }}
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
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedNotification(item)}
              className="rounded-lg border border-slate-100 bg-[#f8fafc] p-3 text-left transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#071832]">{item.title}</p>
                <span className="text-xs text-slate-500">{item.time}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{item.message}</p>
            </button>
          ))}
        </div>
      </section>
      {isBriefingOpen && (
        <MarketBriefingModal
          briefing={marketBriefing}
          onClose={() => {
            stopBriefing();
            setIsBriefingOpen(false);
          }}
          onReplay={speakBriefing}
          onStop={stopBriefing}
        />
      )}
      {selectedNotification && (
        <NotificationDetailModal
          item={selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      )}
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

function MarketBriefingModal({
  briefing,
  onClose,
  onReplay,
  onStop,
}: {
  briefing: {
    title: string;
    summary: string[];
    interpretation: string;
  };
  onClose: () => void;
  onReplay: () => void;
  onStop: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold text-[#8a6400]">시장 브리핑 상세</p>
            <h2 className="mt-2 text-xl font-black tracking-normal text-[#071832]">{briefing.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-ring"
            aria-label="브리핑 상세 닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 rounded-lg bg-[#f8fafc] p-4">
          <h3 className="text-sm font-extrabold text-[#071832]">핵심 요약</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {briefing.summary.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#f6b100]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-extrabold text-[#071832]">AI 해석</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{briefing.interpretation}</p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#071832] transition hover:bg-slate-50 focus-ring"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
            음성 정지
          </button>
          <button
            type="button"
            onClick={onReplay}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#f3d58a] bg-[#fff8e1] px-4 text-sm font-extrabold text-[#8a6400] transition hover:bg-[#ffefb9] focus-ring"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            다시 듣기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#071832] px-4 text-sm font-extrabold text-white transition hover:bg-[#102642] focus-ring"
          >
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function NotificationDetailModal({
  item,
  onClose,
}: {
  item: (typeof notifications)[number];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold text-[#8a6400]">{item.type} 알림</p>
            <h2 className="mt-2 text-xl font-black tracking-normal text-[#071832]">{item.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 focus-ring"
            aria-label="알림 상세 닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-4 rounded-lg bg-[#f8fafc] p-4 text-sm leading-6 text-slate-700">{item.message}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 p-3">
            <dt className="text-xs font-bold text-slate-500">시간</dt>
            <dd className="mt-1 font-extrabold text-[#071832]">{item.time}</dd>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <dt className="text-xs font-bold text-slate-500">중요도</dt>
            <dd className="mt-1 font-extrabold text-[#071832]">{item.importance}/3</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link
            href="/notifications"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#071832] transition hover:bg-slate-50 focus-ring"
          >
            알림 내역 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#071832] px-4 text-sm font-extrabold text-white transition hover:bg-[#102642] focus-ring"
          >
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}
