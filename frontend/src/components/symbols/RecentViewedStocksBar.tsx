"use client";

import { X } from "lucide-react";
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
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-2 px-1 whitespace-nowrap">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex h-12 items-center gap-2 rounded-lg border bg-white px-3 text-left shadow-sm transition focus-ring ${
              item.id === activeId
                ? "border-[#f6b100] bg-[#fff8e1]"
                : "border-slate-200 hover:border-[#f3d58a] hover:bg-[#fffdf7]"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="flex min-w-0 items-center gap-2 focus:outline-none"
              aria-pressed={item.id === activeId}
            >
              <StockLogo item={item} />
              <span className="max-w-24 truncate text-sm font-extrabold text-[#071832]">{item.name}</span>
              <span className="text-sm font-bold tabular-nums text-[#071832]">{item.price}</span>
              <span className={`text-xs font-extrabold tabular-nums ${toneClass(item.changeDirection)}`}>
                {item.changeRate}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="ml-1 flex h-6 w-6 flex-none items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-[#071832] focus-ring"
              aria-label={`${item.name} 최근 본 종목에서 닫기`}
              title="닫기"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockLogo({ item }: { item: RecentViewedStockItem }) {
  return (
    <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] text-[10px] font-black text-[#071832]">
      {item.iconUrl ? (
        <span
          className="h-6 w-6 rounded bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${item.iconUrl})` }}
          aria-label={item.name}
        />
      ) : (
        item.name.slice(0, 1)
      )}
    </span>
  );
}

function toneClass(tone: RecentViewedStockItem["changeDirection"]) {
  if (tone === "up") return "text-red-500";
  if (tone === "down") return "text-blue-600";
  return "text-slate-500";
}
