"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Bell, Download, Loader2, Plus, Search, Star, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { searchSymbols } from "@/lib/api/symbols";
import {
  createWatchItemFromSymbol,
  readStoredWatchItems,
  writeStoredWatchItems,
  type WatchItem,
} from "@/lib/watchlistStorage";
import type { Symbol as StockSymbol } from "@/types/symbols";

const marketFilters = [
  { id: "all", label: "전체" },
  { id: "domestic", label: "국내" },
  { id: "overseas", label: "해외" },
] as const;

type MarketFilter = (typeof marketFilters)[number]["id"];

export default function WatchlistPage() {
  const toast = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [symbolResults, setSymbolResults] = useState<StockSymbol[]>([]);
  const [isSymbolSearchLoading, setIsSymbolSearchLoading] = useState(false);
  const [symbolSearchError, setSymbolSearchError] = useState("");
  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesMarket = marketFilter === "all" || item.market === marketFilter;
    const matchesSearch =
      !normalizedSearchText ||
      item.name.toLowerCase().includes(normalizedSearchText) ||
      item.symbol.toLowerCase().includes(normalizedSearchText) ||
      item.exchange.toLowerCase().includes(normalizedSearchText);
    return matchesMarket && matchesSearch;
  });
  const marketCounts = {
    all: items.length,
    domestic: items.filter((item) => item.market === "domestic").length,
    overseas: items.filter((item) => item.market === "overseas").length,
  };
  const hasItems = items.length > 0;
  const risingCount = filteredItems.filter((item) => item.changeRate.startsWith("+")).length;
  const fallingCount = filteredItems.filter((item) => item.changeRate.startsWith("-")).length;
  const canSearchMaster = Boolean(normalizedSearchText) && marketFilter !== "overseas";
  const visibleSymbolResults = canSearchMaster ? symbolResults : [];
  const visibleSymbolSearchError = canSearchMaster ? symbolSearchError : "";
  const isVisibleSymbolSearchLoading = canSearchMaster && isSymbolSearchLoading;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readStoredWatchItems());
      setHasLoadedStorage(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) return;
    writeStoredWatchItems(items);
  }, [hasLoadedStorage, items]);

  useEffect(() => {
    if (!canSearchMaster) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      setIsSymbolSearchLoading(true);
      setSymbolSearchError("");
      searchSymbols(searchText.trim(), 8)
        .then((response) => {
          if (cancelled) return;
          setSymbolResults(response.items);
        })
        .catch(() => {
          if (cancelled) return;
          setSymbolResults([]);
          setSymbolSearchError("종목 검색에 실패했습니다.");
        })
        .finally(() => {
          if (!cancelled) setIsSymbolSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSearchMaster, searchText]);

  const handleAddSymbol = (symbol: StockSymbol) => {
    setItems((current) => {
      if (current.some((item) => item.symbol === symbol.code)) {
        return current;
      }
      return [createWatchItemFromSymbol(symbol), ...current];
    });
    setMarketFilter("domestic");
    setSearchText(symbol.name);
  };

  const handleClearWatchlist = () => {
    setItems([]);
    setSearchText("");
    setMarketFilter("all");
    toast.success("관심종목을 모두 삭제했습니다.");
  };

  const handleExportWatchlist = () => {
    if (items.length === 0) {
      toast.warning("내보낼 관심종목이 없습니다.");
      return;
    }
    const payload = JSON.stringify(items, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "watchlist.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("관심종목 목록을 내보냈습니다.");
  };

  return (
    <AppShell screen="watchlist">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="관심종목 수" value={`${items.length}종목`} />
        <Summary label="오늘 수익률" value={hasItems ? "+1.25%" : "0.00%"} profit={hasItems} />
        <Summary label="상승 종목" value={`${risingCount}개`} icon={ArrowUp} profit />
        <Summary label="하락 종목" value={`${fallingCount}개`} icon={ArrowDown} loss />
        <Summary label="알림 설정" value={hasItems ? "5건" : "0건"} icon={Bell} />
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full rounded-lg border border-slate-200 bg-[#f8fafc] p-1 sm:w-auto" aria-label="시장 구분 필터">
            {marketFilters.map((filter) => {
              const isActive = marketFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setMarketFilter(filter.id)}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition focus-ring sm:flex-none ${
                    isActive ? "bg-white text-[#071832] shadow-sm" : "text-slate-500 hover:text-[#071832]"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-[#fff8e1] text-[#8a6400]" : "bg-white text-slate-500"}`}>
                    {marketCounts[filter.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-ring"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              종목 추가
            </button>
            <label className="flex min-w-64 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="min-w-0 flex-1 text-sm outline-none"
                placeholder="종목명, 코드, 거래소 검색"
                aria-label="종목명, 코드, 거래소 검색"
              />
            </label>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full bg-[#f8fafc] px-3 py-1">선택: {marketFilters.find((filter) => filter.id === marketFilter)?.label}</span>
          <span className="rounded-full bg-[#f8fafc] px-3 py-1">표시 종목: {filteredItems.length}개</span>
          {searchText.trim() && <span className="rounded-full bg-[#fff8e1] px-3 py-1 text-[#8a6400]">검색어: {searchText.trim()}</span>}
        </div>

        {searchText.trim() && (
          <div className="mb-4 rounded-lg bg-[#f8fafc] px-3 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-[#071832]">종목 검색 결과</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">입력한 종목명이나 코드와 일치하는 국내 종목 후보입니다.</p>
              </div>
              <span className="text-xs font-bold text-slate-500">마스터 검색 {visibleSymbolResults.length}건</span>
            </div>

            {marketFilter === "overseas" ? (
              <p className="mt-3 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-500">
                해외 필터에서는 현재 등록된 관심종목 안에서만 검색합니다.
              </p>
            ) : isVisibleSymbolSearchLoading ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                종목을 검색하는 중입니다.
              </div>
            ) : visibleSymbolSearchError ? (
              <p className="mt-3 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-red-600">{visibleSymbolSearchError}</p>
            ) : visibleSymbolResults.length > 0 ? (
              <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg bg-white">
                {visibleSymbolResults.map((symbol) => {
                  const isRegistered = items.some((item) => item.symbol === symbol.code);
                  return (
                    <button
                      key={symbol.code}
                      type="button"
                      onClick={() => handleAddSymbol(symbol)}
                      disabled={isRegistered}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-[#fffdf7] disabled:cursor-default disabled:opacity-60 focus-ring"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-[#071832]">{symbol.name}</span>
                        <span className="mt-1 block font-mono text-xs font-semibold text-slate-500">{symbol.code}</span>
                      </span>
                      <span className="flex flex-none items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${symbol.exchange === "kospi" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                          {symbol.exchange_name}
                        </span>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${isRegistered ? "bg-slate-100 text-slate-500" : "bg-[#fff8e1] text-[#8a6400]"}`}>
                          {isRegistered ? "등록됨" : "관심등록"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-500">마스터 검색 결과가 없습니다.</p>
            )}
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-3">즐겨찾기</th>
                  <th className="py-3 pr-3">종목명</th>
                  <th className="py-3 pr-3">시장</th>
                  <th className="py-3 pr-3">현재가</th>
                  <th className="py-3 pr-3">등락률</th>
                  <th className="py-3 pr-3">거래대금</th>
                  <th className="py-3 pr-3">AI 코멘트</th>
                  <th className="py-3 pr-3">시그널</th>
                  <th className="py-3 pr-3">목표가/손절가</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.symbol} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-4 pr-3">
                      <Star className={`h-5 w-5 ${item.favorite ? "fill-[#f6b100] text-[#f6b100]" : "text-slate-300"}`} aria-hidden="true" />
                    </td>
                    <td className="py-4 pr-3">
                      <p className="font-bold text-[#071832]">{item.name}</p>
                      <p className="font-mono text-xs text-slate-500">{item.symbol}</p>
                    </td>
                    <td className="py-4 pr-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.market === "domestic" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {item.marketLabel}
                      </span>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{item.exchange}</p>
                    </td>
                    <td className="py-4 pr-3 font-bold text-[#071832]">{item.price}</td>
                    <td className={`py-4 pr-3 font-bold ${changeRateClass(item.changeRate)}`}>
                      {item.changeRate}
                    </td>
                    <td className="py-4 pr-3 text-slate-600">{item.volumeAmount}</td>
                    <td className="max-w-xs py-4 pr-3 text-slate-600">{item.aiComment}</td>
                    <td className="py-4 pr-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                        {item.signal}
                      </span>
                    </td>
                    <td className="py-4 pr-3 text-xs text-slate-600">
                      목표 {item.targetPrice}
                      <br />
                      손절 {item.stopLossPrice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-[#f8fafc] px-4 py-10 text-center">
            <p className="text-sm font-extrabold text-[#071832]">조건에 맞는 관심종목이 없습니다.</p>
            <p className="mt-2 text-xs font-medium text-slate-500">필터나 검색어를 변경해 다시 확인하세요.</p>
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-extrabold text-[#071832]">관심종목 관련 주요 뉴스 TOP 3</h2>
          {hasItems ? (
            <div className="mt-4 space-y-3">
              {items.slice(0, 3).map((item) => (
                <p key={item.symbol} className="rounded-lg bg-[#f8fafc] px-3 py-3 text-sm font-semibold text-slate-700">
                  {item.name}, 관심종목 등록 후 관련 뉴스와 시그널을 추적합니다.
                </p>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-[#f8fafc] px-4 py-8 text-center">
              <p className="text-sm font-extrabold text-[#071832]">관심종목을 추가하면 관련 뉴스가 표시됩니다.</p>
              <p className="mt-2 text-xs font-medium text-slate-500">상단 검색창에서 종목명이나 코드를 입력하세요.</p>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-extrabold text-[#071832]">빠른 기능</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ToolButton icon={Trash2} label="전체 삭제" onClick={handleClearWatchlist} disabled={items.length === 0} />
            <ToolButton icon={ArrowUp} label="순서 변경" onClick={() => toast.info("관심종목을 드래그해서 순서를 변경할 수 있도록 준비 중입니다.")} />
            <ToolButton icon={Bell} label="알림 관리" onClick={() => toast.info("알림 관리 화면을 준비하고 있습니다.")} />
            <ToolButton icon={Download} label="내보내기" onClick={handleExportWatchlist} disabled={items.length === 0} />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Summary({
  label,
  value,
  icon: Icon = Star,
  profit = false,
  loss = false,
}: {
  label: string;
  value: string;
  icon?: typeof Star;
  profit?: boolean;
  loss?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${profit ? "text-profit" : loss ? "text-loss" : "text-[#071832]"}`}>{value}</p>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof Trash2;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function changeRateClass(changeRate: string) {
  if (changeRate.startsWith("+")) return "text-profit";
  if (changeRate.startsWith("-")) return "text-loss";
  return "text-slate-500";
}
