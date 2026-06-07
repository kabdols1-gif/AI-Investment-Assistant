"use client";

import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import type { BrokerProviderOption } from "@/lib/brokerProviders";
import { holdingsSummaryItems, watchlistSummaryItems } from "@/lib/mockData";
import type { HoldingSummaryItem, WatchlistSummaryItem } from "@/types/symbols";

interface HoldingsAndWatchlistCardProps {
  brokerConnected: boolean;
  brokerOption: BrokerProviderOption;
}

export function HoldingsAndWatchlistCard({
  brokerConnected,
  brokerOption,
}: HoldingsAndWatchlistCardProps) {
  const holdings = holdingsSummaryItems.slice(0, 3);
  const watchlist = watchlistSummaryItems.slice(0, 3);

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-[#071832]">보유잔고 · 관심종목</h2>
        <Link href="/portfolio" className="flex-none text-xs font-bold text-[#0f4c81] focus-ring">
          전체보기
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption} showNotice={false}>
          <HoldingsSummaryTable items={holdings} />
        </BrokerConnectionGate>
        <WatchlistSummaryTable items={watchlist} />
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500">
        * 실시간 데이터는 지연될 수 있습니다. 현재 화면은 샘플 데이터입니다.
      </p>
    </section>
  );
}

function HoldingsSummaryTable({ items }: { items: HoldingSummaryItem[] }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[#071832]">보유잔고 ({items.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[minmax(132px,1.4fr)_70px_100px_92px_70px_80px] gap-3 border-b border-slate-100 pb-2 text-xs font-bold text-slate-500">
            <span>종목명</span>
            <span className="text-right">보유수량</span>
            <span className="text-right">평가금액</span>
            <span className="text-right">평가손익</span>
            <span className="text-right">수익률</span>
            <span className="text-right">오늘 등락률</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(132px,1.4fr)_70px_100px_92px_70px_80px] items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
            >
              <StockIdentity item={item} />
              <span className="text-right text-xs font-bold tabular-nums text-[#071832]">{item.quantity}</span>
              <span className="text-right text-xs font-bold tabular-nums text-[#071832]">{item.valuationAmount}</span>
              <span className={`text-right text-xs font-extrabold tabular-nums ${changeValueClass(item.profitLossAmount)}`}>
                {item.profitLossAmount}
              </span>
              <span className={`text-right text-xs font-extrabold tabular-nums ${changeValueClass(item.profitLossRate)}`}>
                {item.profitLossRate}
              </span>
              <span className={`text-right text-xs font-extrabold tabular-nums ${changeValueClass(item.todayChangeRate)}`}>
                {item.todayChangeRate}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WatchlistSummaryTable({ items }: { items: WatchlistSummaryItem[] }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[#071832]">관심종목 ({items.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[590px]">
          <div className="grid grid-cols-[minmax(132px,1.3fr)_86px_70px_minmax(120px,1fr)_126px] gap-3 border-b border-slate-100 pb-2 text-xs font-bold text-slate-500">
            <span>종목명</span>
            <span className="text-right">현재가</span>
            <span className="text-right">등락률</span>
            <span>관심 사유</span>
            <span className="text-right">AI 코멘트</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(132px,1.3fr)_86px_70px_minmax(120px,1fr)_126px] items-center gap-3 border-b border-slate-100 py-3 last:border-b-0"
            >
              <StockIdentity item={item} />
              <span className="text-right text-xs font-bold tabular-nums text-[#071832]">{item.currentPrice}</span>
              <span className={`text-right text-xs font-extrabold tabular-nums ${changeValueClass(item.changeRate)}`}>
                {item.changeRate}
              </span>
              <span className="truncate text-xs font-semibold text-slate-600">{item.watchReason}</span>
              <button
                type="button"
                onClick={() => requestAiComment(item)}
                className="ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#071832] transition hover:bg-[#fff8e1] focus-ring"
              >
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                AI 코멘트 보기
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StockIdentity({
  item,
}: {
  item: Pick<HoldingSummaryItem | WatchlistSummaryItem, "name" | "code" | "iconUrl">;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] text-[10px] font-black text-[#071832]">
        <span aria-hidden={Boolean(item.iconUrl)}>{item.name.slice(0, 1)}</span>
        {item.iconUrl ? (
          <span
            className="absolute h-6 w-6 rounded bg-[#f8fafc] bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${item.iconUrl})` }}
            aria-label={item.name}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-extrabold text-[#071832]">{item.name}</span>
        <span className="block text-[11px] font-semibold text-slate-500">{item.code}</span>
      </span>
    </div>
  );
}

function requestAiComment(item: WatchlistSummaryItem) {
  const detail = {
    code: item.code,
    name: item.name,
    prompt: `${item.name}(${item.code})에 대한 AI 코멘트를 보여줘`,
  };

  window.dispatchEvent(new CustomEvent("ai-comment-requested", { detail }));
}

function changeValueClass(value: string) {
  if (value.startsWith("+")) return "text-profit";
  if (value.startsWith("-")) return "text-loss";
  return "text-slate-500";
}
