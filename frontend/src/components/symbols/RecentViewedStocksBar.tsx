"use client";

import { Info, X } from "lucide-react";
import { useMarketQuotes } from "@/hooks";
import { formatQuoteDisplay, getQuoteFromMap } from "@/lib/marketQuoteDisplay";
import type { RecentViewedStockItem } from "@/types/symbols";

interface RecentViewedStocksBarProps {
  items: RecentViewedStockItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function RecentViewedStocksBar({
  items,
  activeId,
  onSelect,
  onRemove,
}: RecentViewedStocksBarProps) {
  const { quotes } = useMarketQuotes(items.map((item) => item.code));
  const displayItems = items.map((item) => {
    const quote = formatQuoteDisplay(getQuoteFromMap(quotes, item.code));
    return {
      ...item,
      price: quote.price,
      changeRate: quote.changeRate,
      changeDirection: quote.direction,
      volume: quote.volume,
      tradingValue: quote.tradingValue,
    };
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg bg-transparent" aria-label="최근 본 종목">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-extrabold text-[#071832]">최근 본 종목</h2>
        <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>
      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-2 px-1 whitespace-nowrap">
        {displayItems.map((item) => (
          <div
            key={item.id}
            className={`group flex h-14 min-w-[230px] items-center gap-2 rounded-lg border bg-white px-3 text-left shadow-sm transition focus-ring ${
              item.id === activeId
                ? "border-[#f6b100] bg-[#fff8e1] shadow-[0_8px_20px_rgba(246,177,0,0.16)]"
                : "border-[#dbe7f3] hover:border-[#f3d58a] hover:bg-[#fffdf7] hover:shadow-md"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="flex min-w-0 flex-1 items-center gap-3 focus:outline-none"
              aria-pressed={item.id === activeId}
            >
              <StockLogo item={item} />
              <span className="grid min-w-0 flex-1 grid-cols-[minmax(72px,1fr)_auto_auto] items-baseline gap-3">
                <span className="truncate text-sm font-extrabold text-[#071832]">{item.name}</span>
                <span className="text-sm font-black tabular-nums text-[#071832]">{item.price}</span>
                <span className={`text-xs font-black tabular-nums ${toneClass(item.changeDirection)}`}>
                  {item.changeRate}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#071832] focus-ring"
              aria-label={`${item.name} 최근 본 종목에서 닫기`}
              title="닫기"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

function StockLogo({ item }: { item: RecentViewedStockItem }) {
  return (
    <span className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-lg border border-[#dbe7f3] bg-[#f8fafc] text-[11px] font-black text-[#071832] shadow-sm">
      <span aria-hidden={Boolean(item.iconUrl)}>{item.name.slice(0, 1)}</span>
      {item.iconUrl ? (
        <span
          className="absolute h-7 w-7 rounded bg-[#f8fafc] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${item.iconUrl})` }}
          aria-label={item.name}
        />
      ) : null}
    </span>
  );
}

function toneClass(tone: RecentViewedStockItem["changeDirection"]) {
  if (tone === "up") return "text-red-500";
  if (tone === "down") return "text-blue-600";
  return "text-slate-500";
}
