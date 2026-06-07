"use client";

import { useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import type { BrokerProviderOption } from "@/lib/brokerProviders";
import { holdingsSummaryItems } from "@/lib/mockData";
import type { HoldingSummaryItem } from "@/types/symbols";

interface HoldingsAndWatchlistCardProps {
  brokerConnected: boolean;
  brokerOption: BrokerProviderOption;
}

export function HoldingsAndWatchlistCard({
  brokerConnected,
  brokerOption,
}: HoldingsAndWatchlistCardProps) {
  const holdings = holdingsSummaryItems.slice(0, 3);
  const [selectedComment, setSelectedComment] = useState<{
    item: HoldingSummaryItem;
    comment: string;
  } | null>(null);

  const handleHoldingSelect = (id: string) => {
    window.dispatchEvent(new CustomEvent("holding-stock-selected", { detail: { id } }));
  };

  return (
    <>
      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-base font-extrabold text-[#071832]">보유잔고</h2>
        </div>

        <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption} showNotice={false}>
          <HoldingsSummaryTable
            items={holdings}
            onOpenComment={setSelectedComment}
            onSelectHolding={handleHoldingSelect}
          />
        </BrokerConnectionGate>

        <p className="mt-3 text-xs font-medium text-slate-500">
          * 실시간 데이터는 지연될 수 있습니다. 현재 화면은 샘플 데이터입니다.
        </p>
      </section>
      {selectedComment && (
        <AiCommentModal
          item={selectedComment.item}
          comment={selectedComment.comment}
          onClose={() => setSelectedComment(null)}
        />
      )}
    </>
  );
}

function HoldingsSummaryTable({
  items,
  onOpenComment,
  onSelectHolding,
}: {
  items: HoldingSummaryItem[];
  onOpenComment: (payload: { item: HoldingSummaryItem; comment: string }) => void;
  onSelectHolding: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-[#071832]">보유잔고 ({items.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[minmax(104px,0.9fr)_54px_84px_82px_58px_70px_minmax(240px,1.8fr)_54px] gap-2 border-b border-slate-100 pb-2 text-xs font-bold text-slate-500">
            <span>종목명</span>
            <span className="text-right">보유수량</span>
            <span className="text-right">평가금액</span>
            <span className="text-right">평가손익</span>
            <span className="text-right">수익률</span>
            <span className="text-right">오늘 등락률</span>
            <span>뉴스정보</span>
            <span>AI 코멘트</span>
          </div>
          {items.map((item) => {
            const comment = holdingAiComment(item);
            const news = holdingNewsInfo(item);
            return (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(104px,0.9fr)_54px_84px_82px_58px_70px_minmax(240px,1.8fr)_54px] items-center gap-2 border-b border-slate-100 py-3 last:border-b-0"
              >
                <StockIdentity item={item} onSelect={() => onSelectHolding(item.id)} />
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
                <a
                  href={news.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-xs font-bold text-[#0f4c81] underline-offset-2 hover:underline focus-ring"
                  title={news.title}
                >
                  {news.title}
                </a>
                <div>
                  <button
                    type="button"
                    onClick={() => onOpenComment({ item, comment })}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0f4c81] transition hover:bg-[#fff8e1] focus-ring"
                    aria-label={`${item.name} AI 코멘트 자세히 보기`}
                    title="AI 코멘트 자세히 보기"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StockIdentity({
  item,
  onSelect,
}: {
  item: Pick<HoldingSummaryItem, "name" | "code" | "iconUrl">;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="-m-1 flex min-w-0 items-center gap-2 rounded-lg p-1 text-left transition hover:bg-[#fff8e1] focus-ring"
      aria-label={`${item.name} 주문 화면 열기`}
      title={`${item.name} 주문 화면 열기`}
    >
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
    </button>
  );
}

function changeValueClass(value: string) {
  if (value.startsWith("+")) return "text-profit";
  if (value.startsWith("-")) return "text-loss";
  return "text-slate-500";
}

function holdingAiComment(item: HoldingSummaryItem) {
  if (item.profitLossRate.startsWith("-")) {
    return "손실 구간입니다. 비중 확대보다 손절 기준과 반등 신호를 먼저 확인하세요.";
  }
  if (item.todayChangeRate.startsWith("-")) {
    return "누적 수익은 유지 중이나 단기 약세입니다. 분할 대응과 지지선 확인이 필요합니다.";
  }
  return "수익 구간이 양호합니다. 목표 비중을 넘으면 일부 차익 실현을 검토하세요.";
}

function holdingNewsInfo(item: HoldingSummaryItem) {
  const newsByCode: Record<string, { title: string; url: string }> = {
    "005930": {
      title: "삼성전자, 반도체 수요 회복 기대 속 실적 개선 전망",
      url: "https://finance.naver.com/item/news.naver?code=005930",
    },
    "035420": {
      title: "NAVER, AI 검색과 커머스 성장성이 하반기 관전 포인트",
      url: "https://finance.naver.com/item/news.naver?code=035420",
    },
    "373220": {
      title: "LG에너지솔루션, 배터리 업황 반등 기대와 수주 흐름 주목",
      url: "https://finance.naver.com/item/news.naver?code=373220",
    },
  };

  return newsByCode[item.code] ?? {
    title: `${item.name} 관련 주요 뉴스 보기`,
    url: `https://finance.naver.com/item/news.naver?code=${item.code}`,
  };
}

function AiCommentModal({
  item,
  comment,
  onClose,
}: {
  item: HoldingSummaryItem;
  comment: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="holding-ai-comment-title">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">AI 코멘트</p>
            <h2 id="holding-ai-comment-title" className="mt-1 truncate text-lg font-black text-[#071832]">
              {item.name}
            </h2>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-500">{item.code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#071832] focus-ring"
            aria-label="AI 코멘트 닫기"
            title="닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <MetricPill label="평가손익" value={item.profitLossAmount} tone={changeValueClass(item.profitLossAmount)} />
          <MetricPill label="수익률" value={item.profitLossRate} tone={changeValueClass(item.profitLossRate)} />
          <MetricPill label="오늘 등락률" value={item.todayChangeRate} tone={changeValueClass(item.todayChangeRate)} />
        </div>
        <div className="mt-4 rounded-lg border border-slate-100 bg-[#f8fafc] p-4">
          <p className="text-sm font-semibold leading-7 text-slate-700">{comment}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#071832] px-4 text-sm font-extrabold text-white transition hover:bg-[#102a56] focus-ring"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-extrabold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
