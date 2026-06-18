"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMarketQuotes } from "@/hooks";
import { formatQuoteDisplay, getQuoteFromMap } from "@/lib/marketQuoteDisplay";
import {
  readStoredWatchItems,
  WATCHLIST_STORAGE_EVENT,
  type WatchItem,
} from "@/lib/watchlistStorage";

export function HomeWatchlistSummary() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const { quotes } = useMarketQuotes(items.map((item) => item.symbol));
  const displayItems = items.map((item) => {
    const quote = formatQuoteDisplay(getQuoteFromMap(quotes, item.symbol));
    return {
      ...item,
      price: quote.price,
      changeRate: quote.changeRate,
      volumeAmount: quote.tradingValue,
    };
  });

  useEffect(() => {
    const sync = () => setItems(readStoredWatchItems());
    const timer = window.setTimeout(sync, 0);

    window.addEventListener("storage", sync);
    window.addEventListener(WATCHLIST_STORAGE_EVENT, sync);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener(WATCHLIST_STORAGE_EVENT, sync);
    };
  }, []);

  return (
    <section className="mt-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#071832]">관심종목 요약</h2>
          <Link href="/watchlist" className="text-xs font-bold text-[#0f4c81] focus-ring">전체보기</Link>
        </div>
        {items.length > 0 ? (
          <div className="space-y-3">
            {displayItems.slice(0, 3).map((item) => (
              <div key={item.symbol} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#071832]">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.aiComment}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#071832]">{item.price}</p>
                  <p className={`text-xs font-bold ${changeRateClass(item.changeRate)}`}>
                    {item.changeRate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-[#f8fafc] px-4 py-8 text-center">
            <p className="text-sm font-extrabold text-[#071832]">등록된 관심종목이 없습니다.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">관심종목 화면에서 종목을 검색해 추가하세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function changeRateClass(changeRate: string) {
  if (changeRate.startsWith("+")) return "text-profit";
  if (changeRate.startsWith("-")) return "text-loss";
  return "text-slate-500";
}
