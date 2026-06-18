"use client";

import Link from "next/link";
import { DragEvent as ReactDragEvent, useCallback, useMemo, useState } from "react";
import { ArrowRight, GripVertical, Heart, Home, PieChart, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useMarketQuotes } from "@/hooks";
import { formatQuoteDisplay, getQuoteFromMap } from "@/lib/marketQuoteDisplay";
import { assetAllocation, holdingsSummaryItems, myStrategies, portfolioList, watchlistSummaryItems } from "@/lib/mockData";

const DASHBOARD_WIDGET_ORDER_STORAGE_KEY = "ai-investment-assistant.dashboard-widget-order.v1";

const defaultDashboardWidgetOrder = ["watchlist", "assets", "my-strategy", "portfolio"] as const;

type DashboardWidgetKey = (typeof defaultDashboardWidgetOrder)[number];

type DashboardWidgetMeta = {
  key: DashboardWidgetKey;
  title: string;
  href: string;
  icon: LucideIcon;
  summary: string;
  accentClass: string;
};

const dashboardWidgetSet = new Set<DashboardWidgetKey>(defaultDashboardWidgetOrder);

const dashboardWidgetMeta: Record<DashboardWidgetKey, DashboardWidgetMeta> = {
  watchlist: {
    key: "watchlist",
    title: "관심종목",
    href: "/watchlist",
    icon: Heart,
    summary: `${watchlistSummaryItems.length}개 종목`,
    accentClass: "border-rose-100 bg-rose-50 text-rose-600",
  },
  assets: {
    key: "assets",
    title: "자산현황",
    href: "/assets",
    icon: Home,
    summary: "0원",
    accentClass: "border-emerald-100 bg-emerald-50 text-emerald-600",
  },
  "my-strategy": {
    key: "my-strategy",
    title: "투자전략",
    href: "/my-strategy",
    icon: ShieldCheck,
    summary: `${myStrategies.filter((strategy) => strategy.enabled).length}개 실행중`,
    accentClass: "border-violet-100 bg-violet-50 text-violet-600",
  },
  portfolio: {
    key: "portfolio",
    title: "포트관리",
    href: "/portfolio",
    icon: PieChart,
    summary: `${portfolioList.length}개 포트`,
    accentClass: "border-sky-100 bg-sky-50 text-sky-600",
  },
};

function normalizeDashboardWidgetOrder(value: unknown): DashboardWidgetKey[] {
  const storedKeys = Array.isArray(value)
    ? value.filter((item): item is DashboardWidgetKey => typeof item === "string" && dashboardWidgetSet.has(item as DashboardWidgetKey))
    : [];
  const uniqueStoredKeys = storedKeys.filter((item, index) => storedKeys.indexOf(item) === index);
  const missingKeys = defaultDashboardWidgetOrder.filter((item) => !uniqueStoredKeys.includes(item));

  return [...uniqueStoredKeys, ...missingKeys];
}

function getStoredDashboardWidgetOrder(): DashboardWidgetKey[] {
  if (typeof window === "undefined") return [...defaultDashboardWidgetOrder];

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_WIDGET_ORDER_STORAGE_KEY);
    return normalizeDashboardWidgetOrder(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return [...defaultDashboardWidgetOrder];
  }
}

function saveDashboardWidgetOrder(order: DashboardWidgetKey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DASHBOARD_WIDGET_ORDER_STORAGE_KEY, JSON.stringify(normalizeDashboardWidgetOrder(order)));
}

export default function DashboardPage() {
  const [widgetOrder, setWidgetOrder] = useState<DashboardWidgetKey[]>(getStoredDashboardWidgetOrder);
  const [draggedWidgetKey, setDraggedWidgetKey] = useState<DashboardWidgetKey | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<DashboardWidgetKey | null>(null);
  const orderedWidgets = useMemo(() => widgetOrder.map((key) => dashboardWidgetMeta[key]), [widgetOrder]);

  const moveWidget = useCallback((sourceKey: DashboardWidgetKey, targetKey: DashboardWidgetKey) => {
    if (sourceKey === targetKey) return;

    setWidgetOrder((currentOrder) => {
      const nextOrder = normalizeDashboardWidgetOrder(currentOrder);
      const sourceIndex = nextOrder.indexOf(sourceKey);
      const targetIndex = nextOrder.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return nextOrder;

      const [movedItem] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, movedItem);
      saveDashboardWidgetOrder(nextOrder);
      return nextOrder;
    });
  }, []);

  const handleDragStart = useCallback((event: ReactDragEvent<HTMLElement>, key: DashboardWidgetKey) => {
    setDraggedWidgetKey(key);
    setDropTargetKey(key);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  }, []);

  const handleDragOver = useCallback((event: ReactDragEvent<HTMLElement>, key: DashboardWidgetKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetKey(key);
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>, key: DashboardWidgetKey) => {
      event.preventDefault();
      const sourceKey = (event.dataTransfer.getData("text/plain") || draggedWidgetKey) as DashboardWidgetKey | null;
      if (sourceKey && dashboardWidgetSet.has(sourceKey)) {
        moveWidget(sourceKey, key);
      }
      setDraggedWidgetKey(null);
      setDropTargetKey(null);
    },
    [draggedWidgetKey, moveWidget]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedWidgetKey(null);
    setDropTargetKey(null);
  }, []);

  return (
    <AppShell screen="dashboard">
      <section className="grid gap-4 lg:grid-cols-2">
        {orderedWidgets.map((widget) => (
          <DashboardWidget
            key={widget.key}
            widget={widget}
            isDragging={draggedWidgetKey === widget.key}
            isDropTarget={dropTargetKey === widget.key && draggedWidgetKey !== widget.key}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </section>
    </AppShell>
  );
}

function DashboardWidget({
  widget,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  widget: DashboardWidgetMeta;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: (event: ReactDragEvent<HTMLElement>, key: DashboardWidgetKey) => void;
  onDragOver: (event: ReactDragEvent<HTMLElement>, key: DashboardWidgetKey) => void;
  onDrop: (event: ReactDragEvent<HTMLElement>, key: DashboardWidgetKey) => void;
  onDragEnd: () => void;
}) {
  const Icon = widget.icon;

  return (
    <article
      draggable
      data-dashboard-widget={widget.key}
      onDragStart={(event) => onDragStart(event, widget.key)}
      onDragOver={(event) => onDragOver(event, widget.key)}
      onDrop={(event) => onDrop(event, widget.key)}
      onDragEnd={onDragEnd}
      className={`flex min-h-[360px] flex-col rounded-lg border bg-white p-5 shadow-sm transition ${
        isDropTarget ? "border-[#f6b100] ring-2 ring-[#f6b100]/30" : "border-slate-200"
      } ${isDragging ? "opacity-55" : "hover:border-[#f3d58a]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg border ${widget.accentClass}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black tracking-normal text-[#071832]">{widget.title}</h2>
            <p className="mt-1 truncate text-sm font-extrabold text-slate-500">{widget.summary}</p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <GripVertical className="h-4 w-4 cursor-grab text-slate-400" aria-hidden="true" />
          <Link
            href={widget.href}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-[#f3d58a] hover:bg-[#fffdf7] hover:text-[#071832] focus-ring"
            aria-label={`${widget.title} 이동`}
            title={`${widget.title} 이동`}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-5 flex-1">
        {widget.key === "watchlist" && <WatchlistWidgetBody />}
        {widget.key === "assets" && <AssetsWidgetBody />}
        {widget.key === "my-strategy" && <StrategyWidgetBody />}
        {widget.key === "portfolio" && <PortfolioWidgetBody />}
      </div>
    </article>
  );
}

function WatchlistWidgetBody() {
  const { quotes } = useMarketQuotes(watchlistSummaryItems.map((item) => item.code));
  const displayItems = watchlistSummaryItems.map((item) => {
    const quote = formatQuoteDisplay(getQuoteFromMap(quotes, item.code));
    return {
      ...item,
      currentPrice: `${quote.price}원`,
      changeRate: quote.changeRate,
    };
  });
  const risingCount = displayItems.filter((item) => item.changeRate.startsWith("+")).length;
  const fallingCount = displayItems.filter((item) => item.changeRate.startsWith("-")).length;

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-2">
        <SummaryMetric label="전체" value={`${watchlistSummaryItems.length}`} />
        <SummaryMetric label="상승" value={`${risingCount}`} tone="profit" />
        <SummaryMetric label="하락" value={`${fallingCount}`} tone="loss" />
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {displayItems.slice(0, 4).map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#071832]">{item.name}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.watchReason}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-[#071832]">{item.currentPrice}</p>
              <p className={`mt-1 text-xs font-black ${changeToneClass(item.changeRate)}`}>{item.changeRate}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetsWidgetBody() {
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-2">
        <SummaryMetric label="오늘 손익" value="0%" />
        <SummaryMetric label="누적 수익률" value="0%" />
      </div>
      <div className="mt-5 rounded-lg bg-[#f8fafc] p-4">
        <p className="text-xs font-extrabold text-slate-500">총 자산</p>
        <p className="mt-2 text-2xl font-black tracking-normal text-[#071832]">0원</p>
        <p className="mt-1 text-sm font-extrabold text-[#071832]">0원</p>
      </div>
      <div className="mt-4 space-y-3">
        {assetAllocation.map((item) => (
          <div key={item.category}>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{item.category}</span>
              <span>{item.weight}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${item.weight}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyWidgetBody() {
  const runningCount = myStrategies.filter((strategy) => strategy.enabled).length;
  const pausedCount = myStrategies.length - runningCount;

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-2">
        <SummaryMetric label="전체" value={`${myStrategies.length}`} />
        <SummaryMetric label="실행중" value={`${runningCount}`} tone="profit" />
        <SummaryMetric label="중지" value={`${pausedCount}`} />
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {myStrategies.slice(0, 4).map((strategy) => (
          <div key={strategy.id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-black text-[#071832]">{strategy.name}</p>
              <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-black ${strategy.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {strategy.enabled ? "실행중" : "중지"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold text-slate-500">
              <span className="truncate">{strategy.target}</span>
              <span>{strategy.risk}</span>
              <span className="text-right font-black text-[#071832]">0%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioWidgetBody() {
  const positiveCount = 0;

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-2">
        <SummaryMetric label="포트" value={`${portfolioList.length}`} />
        <SummaryMetric label="수익" value={`${positiveCount}`} tone="profit" />
        <SummaryMetric label="보유종목" value={`${holdingsSummaryItems.length}`} />
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {portfolioList.slice(0, 4).map((portfolio) => (
          <div key={portfolio.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#071832]">{portfolio.name}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">비중 {portfolio.weight}</p>
            </div>
            <p className="text-right text-sm font-extrabold text-slate-600">0원</p>
            <p className="text-right text-sm font-black text-[#071832]">0%</p>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4 text-sm font-extrabold text-[#071832]">
        <TrendingUp className="h-4 w-4 text-profit" aria-hidden="true" />
        <span>대표 포트 0%</span>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "profit" | "loss" | "neutral" }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-black tracking-normal ${toneClass(tone)}`}>{value}</p>
    </div>
  );
}

function changeToneClass(value: string) {
  if (value.startsWith("-")) return "text-loss";
  if (value.startsWith("+")) return "text-profit";
  return "text-[#071832]";
}

function toneClass(tone: "profit" | "loss" | "neutral") {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-[#071832]";
}
