"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Loader2, MessageSquareText, Plus, Search, Star, Trash2, X, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import {
  createWatchItemFromSymbol,
  readStoredWatchItems,
  writeStoredWatchItems,
  type WatchItem,
} from "@/lib/watchlistStorage";
import { tradingWorkspaceByStockId } from "@/lib/mockData";
import type { Symbol as StockSymbol } from "@/types/symbols";

const marketFilters = [
  { id: "all", label: "전체" },
  { id: "domestic", label: "국내" },
  { id: "overseas", label: "해외" },
] as const;

type MarketFilter = (typeof marketFilters)[number]["id"];

const trendFilters = [
  { id: "all", label: "전체", icon: null },
  { id: "up", label: "상승종목", icon: ArrowUp },
  { id: "down", label: "하락종목", icon: ArrowDown },
] as const;

type TrendFilter = (typeof trendFilters)[number]["id"];

const symbolIndex: StockSymbol[] = [
  { code: "005930", name: "삼성전자", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "000660", name: "SK하이닉스", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "066570", name: "LG전자", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "373220", name: "LG에너지솔루션", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "035420", name: "NAVER", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "035720", name: "카카오", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "005380", name: "현대차", exchange: "kospi", exchange_name: "KOSPI" },
  { code: "AAPL", name: "Apple", exchange: "kosdaq", exchange_name: "NASDAQ" },
  { code: "NVDA", name: "NVIDIA", exchange: "kosdaq", exchange_name: "NASDAQ" },
  { code: "TSLA", name: "Tesla", exchange: "kosdaq", exchange_name: "NASDAQ" },
  { code: "MSFT", name: "Microsoft", exchange: "kosdaq", exchange_name: "NASDAQ" },
];

export default function WatchlistPage() {
  const toast = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [trendFilter, setTrendFilter] = useState<TrendFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [symbolResults, setSymbolResults] = useState<StockSymbol[]>([]);
  const [isSymbolSearchLoading, setIsSymbolSearchLoading] = useState(false);
  const [symbolSearchError, setSymbolSearchError] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [commentTarget, setCommentTarget] = useState<WatchItem | null>(null);
  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      items
        .filter((item) => {
          const matchesMarket = marketFilter === "all" || item.market === marketFilter;
          const matchesTrend = matchesWatchTrend(item, trendFilter);
          const matchesSearch =
            !normalizedSearchText ||
            item.name.toLowerCase().includes(normalizedSearchText) ||
            item.symbol.toLowerCase().includes(normalizedSearchText) ||
            item.exchange.toLowerCase().includes(normalizedSearchText);
          return matchesMarket && matchesTrend && matchesSearch;
        })
        .sort((a, b) => Number(b.favorite) - Number(a.favorite)),
    [items, marketFilter, normalizedSearchText, trendFilter]
  );
  const marketCounts = {
    all: items.length,
    domestic: items.filter((item) => item.market === "domestic").length,
    overseas: items.filter((item) => item.market === "overseas").length,
  };
  const canSearchMaster = Boolean(normalizedSearchText);
  const visibleSymbolResults = canSearchMaster ? symbolResults : [];
  const visibleSymbolSearchError = canSearchMaster ? symbolSearchError : "";
  const isVisibleSymbolSearchLoading = canSearchMaster && isSymbolSearchLoading;
  const selectedVisibleIndex = filteredItems.findIndex((item) => item.symbol === selectedSymbol);
  const hasSelectedVisibleItem = selectedVisibleIndex >= 0;

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
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!canSearchMaster) {
        setSymbolResults([]);
        setSymbolSearchError("");
        setIsSymbolSearchLoading(false);
        return;
      }

      setIsSymbolSearchLoading(true);
      setSymbolSearchError("");
      const query = normalizedSearchText;
      const results = symbolIndex
        .filter((symbol) => {
          const isOverseas = symbol.exchange_name === "NASDAQ";
          if (marketFilter === "domestic" && isOverseas) return false;
          if (marketFilter === "overseas" && !isOverseas) return false;
          return (
            symbol.code.toLowerCase().includes(query) ||
            symbol.name.toLowerCase().includes(query)
          );
        })
        .slice(0, 8);
      if (!cancelled) {
        setSymbolResults(results);
        setSymbolSearchError(results.length === 0 ? "검색 결과가 없습니다." : "");
        setIsSymbolSearchLoading(false);
      }
    }, canSearchMaster ? 120 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSearchMaster, marketFilter, normalizedSearchText]);

  const handleAddSymbol = (symbol: StockSymbol) => {
    let added = false;
    setItems((current) => {
      if (current.some((item) => item.symbol === symbol.code)) {
        return current;
      }
      added = true;
      return [createWatchItemFromSymbol(symbol), ...current];
    });
    setSelectedSymbol(symbol.code);
    setMarketFilter(symbol.exchange_name === "NASDAQ" ? "overseas" : "domestic");
    setSearchText(symbol.name);
    toast.success(added ? `${symbol.name}이 관심종목에 추가되었습니다.` : "이미 추가된 종목입니다.");
  };

  const handleToggleFavorite = (symbol: string) => {
    setItems((current) =>
      current.map((item) => (item.symbol === symbol ? { ...item, favorite: !item.favorite } : item))
    );
  };

  const handleDeleteItem = (symbol: string) => {
    const item = items.find((candidate) => candidate.symbol === symbol);
    setItems((current) => current.filter((candidate) => candidate.symbol !== symbol));
    if (selectedSymbol === symbol) setSelectedSymbol(null);
    if (item) toast.success(`${item.name}을 관심종목에서 삭제했습니다.`);
  };

  const handleWatchItemSelect = (item: WatchItem) => {
    setSelectedSymbol(item.symbol);
    window.dispatchEvent(new CustomEvent("watchlist-stock-selected", { detail: { id: item.symbol } }));
  };

  const handleMoveSelectedItem = (direction: "top" | "up" | "down" | "bottom") => {
    if (!selectedSymbol) {
      toast.info("순서를 변경할 관심종목을 먼저 선택해 주세요.");
      return;
    }

    setItems((current) => {
      const selectedIndex = current.findIndex((item) => item.symbol === selectedSymbol);
      if (selectedIndex < 0) return current;

      const nextItems = [...current];
      const [selectedItem] = nextItems.splice(selectedIndex, 1);
      const targetIndex = getMoveTargetIndex(direction, selectedIndex, current.length);
      nextItems.splice(targetIndex, 0, selectedItem);
      return nextItems;
    });
  };

  return (
    <AppShell screen="watchlist">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
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
            <div className="inline-flex w-full rounded-lg border border-slate-200 bg-[#f8fafc] p-1 sm:w-auto" aria-label="등락 필터">
              {trendFilters.map((filter) => {
                const isActive = trendFilter === filter.id;
                const Icon = filter.icon;
                const count = getTrendFilterCount(items, marketFilter, filter.id);
                const isArrowOnlyFilter = filter.id !== "all";
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={isActive}
                    aria-label={isArrowOnlyFilter ? `${filter.label} ${count}개` : undefined}
                    title={isArrowOnlyFilter ? `${filter.label} ${count}개` : undefined}
                    onClick={() => setTrendFilter(filter.id)}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-bold transition focus-ring sm:flex-none ${
                      isActive ? "bg-white text-[#071832] shadow-sm" : "text-slate-500 hover:text-[#071832]"
                    } ${isArrowOnlyFilter ? "px-3 sm:w-10" : "px-3"}`}
                  >
                    {Icon ? <Icon className={`h-4 w-4 ${filter.id === "up" ? "text-profit" : "text-loss"}`} aria-hidden="true" /> : null}
                    {!isArrowOnlyFilter && (
                      <>
                        <span>{filter.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-[#fff8e1] text-[#8a6400]" : "bg-white text-slate-500"}`}>
                          {count}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
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
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" aria-label="관심종목 순서 변경">
              <OrderMoveButton icon={ChevronsUp} label="최상위" onClick={() => handleMoveSelectedItem("top")} disabled={!hasSelectedVisibleItem || selectedVisibleIndex === 0} />
              <OrderMoveButton icon={ArrowUp} label="위로" onClick={() => handleMoveSelectedItem("up")} disabled={!hasSelectedVisibleItem || selectedVisibleIndex === 0} />
              <OrderMoveButton icon={ArrowDown} label="아래로" onClick={() => handleMoveSelectedItem("down")} disabled={!hasSelectedVisibleItem || selectedVisibleIndex === filteredItems.length - 1} />
              <OrderMoveButton icon={ChevronsDown} label="최하위" onClick={() => handleMoveSelectedItem("bottom")} disabled={!hasSelectedVisibleItem || selectedVisibleIndex === filteredItems.length - 1} />
            </div>
          </div>
        </div>

        {searchText.trim() && (
          <div className="mb-4 rounded-lg bg-[#f8fafc] px-3 py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-[#071832]">종목 검색 결과</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">국내 종목명/코드와 해외 티커/종목명을 빠르게 검색합니다.</p>
              </div>
              <span className="text-xs font-bold text-slate-500">마스터 검색 {visibleSymbolResults.length}건</span>
            </div>

            {isVisibleSymbolSearchLoading ? (
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
                      <span className="flex min-w-0 items-center gap-2">
                        <StockIcon code={symbol.code} name={symbol.name} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-extrabold text-[#071832]">{symbol.name}</span>
                          <span className="mt-1 block font-mono text-xs font-semibold text-slate-500">{symbol.code}</span>
                        </span>
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
                  <th className="py-3 pr-3">뉴스정보</th>
                  <th className="py-3 pr-3">시그널</th>
                  <th className="py-3 pr-3">목표가/손절가</th>
                  <th className="py-3 pr-3 text-center">AI 코멘트</th>
                  <th className="py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const news = getWatchItemNews(item);
                  const isSelected = selectedSymbol === item.symbol;

                  return (
                  <tr
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    aria-selected={isSelected}
                    className={`border-b border-slate-100 transition last:border-b-0 ${isSelected ? "bg-[#fff8e1]/70" : "hover:bg-slate-50/70"}`}
                  >
                    <td className="py-4 pr-3">
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(item.symbol)}
                        className="rounded-full p-1 focus-ring"
                        aria-label={`${item.name} 즐겨찾기 ${item.favorite ? "해제" : "추가"}`}
                      >
                        <Star className={`h-5 w-5 ${item.favorite ? "fill-[#f6b100] text-[#f6b100]" : "text-slate-300"}`} aria-hidden="true" />
                      </button>
                    </td>
                    <td className="py-4 pr-3">
                      <button
                        type="button"
                        onClick={() => handleWatchItemSelect(item)}
                        className="-m-1 flex max-w-full items-center gap-2 rounded-lg p-1 text-left transition hover:bg-[#fff8e1] focus-ring"
                        aria-label={`${item.name} 주문 화면 열기`}
                        title={`${item.name} 주문 화면 열기`}
                      >
                        <StockIcon code={item.symbol} name={item.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-[#071832]">{item.name}</span>
                          <span className="block font-mono text-xs text-slate-500">{item.symbol}</span>
                        </span>
                      </button>
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
                    <td className="max-w-xs py-4 pr-3">
                      <a
                        href={news.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm font-bold text-[#0f4c81] underline-offset-2 hover:underline focus-ring"
                        title={news.title}
                      >
                        {news.title}
                      </a>
                    </td>
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
                    <td className="py-4 pr-3 text-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSymbol(item.symbol);
                          setCommentTarget(item);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0f4c81] transition hover:bg-[#fff8e1] focus-ring"
                        aria-label={`${item.name} AI 코멘트 자세히 보기`}
                        title="AI 코멘트 자세히 보기"
                      >
                        <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteItem(item.symbol);
                        }}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-100 px-2 text-xs font-bold text-red-500 transition hover:bg-red-50 focus-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        삭제
                      </button>
                    </td>
                  </tr>
                  );
                })}
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

      {commentTarget ? <AiCommentModal item={commentTarget} onClose={() => setCommentTarget(null)} /> : null}
    </AppShell>
  );
}

function StockIcon({ code, name }: { code: string; name: string }) {
  const iconUrl = tradingWorkspaceByStockId[code]?.stock.iconUrl;

  return (
    <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] text-[10px] font-black text-[#071832]">
      <span aria-hidden={Boolean(iconUrl)}>{name.slice(0, 1)}</span>
      {iconUrl ? (
        <span
          className="absolute h-6 w-6 rounded bg-[#f8fafc] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${iconUrl})` }}
          aria-label={`${name} 로고`}
        />
      ) : null}
    </span>
  );
}

function OrderMoveButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-[#fff8e1] hover:text-[#071832] disabled:cursor-not-allowed disabled:text-slate-300 focus-ring"
      aria-label={`선택 관심종목 ${label} 이동`}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function getMoveTargetIndex(direction: "top" | "up" | "down" | "bottom", selectedIndex: number, itemCount: number) {
  if (direction === "top") return 0;
  if (direction === "bottom") return Math.max(0, itemCount - 1);
  if (direction === "up") return Math.max(0, selectedIndex - 1);
  return Math.min(Math.max(0, itemCount - 1), selectedIndex + 1);
}

function getTrendFilterCount(items: WatchItem[], marketFilter: MarketFilter, trendFilter: TrendFilter) {
  return items.filter((item) => {
    const matchesMarket = marketFilter === "all" || item.market === marketFilter;
    return matchesMarket && matchesWatchTrend(item, trendFilter);
  }).length;
}

function matchesWatchTrend(item: WatchItem, trendFilter: TrendFilter) {
  if (trendFilter === "up") return item.changeRate.startsWith("+");
  if (trendFilter === "down") return item.changeRate.startsWith("-");
  return true;
}

function getWatchItemNews(item: WatchItem) {
  const domesticNewsUrl = `https://finance.naver.com/item/news.naver?code=${item.symbol}`;
  const overseasNewsUrl = `https://finance.yahoo.com/quote/${item.symbol}/news`;
  const newsBySymbol: Record<string, string> = {
    "005930": "삼성전자, 반도체 수요 회복 기대 속 실적 개선 전망",
    "000660": "SK하이닉스, HBM 공급 확대 기대감에 투자심리 개선",
    "066570": "LG전자, 전장 사업 성장세와 가전 수익성 개선 주목",
    "373220": "LG에너지솔루션, 배터리 업황 회복 기대와 수주 흐름 점검",
    "035420": "NAVER, AI 검색과 커머스 성장성이 하반기 관전 포인트",
    "035720": "카카오, 플랫폼 개선과 비용 효율화 흐름에 시장 관심",
    "005380": "현대차, 하이브리드 판매 호조와 주주환원 기대감 부각",
    AAPL: "Apple, AI 기능 확장과 서비스 매출 성장세 주목",
    NVDA: "NVIDIA, AI 반도체 수요 강세 속 데이터센터 매출 기대",
    TSLA: "Tesla, 전기차 수요와 자율주행 모멘텀을 함께 점검",
    MSFT: "Microsoft, 클라우드와 AI 서비스 성장 흐름 지속",
  };

  return {
    title: newsBySymbol[item.symbol] ?? `${item.name} 관련 주요 뉴스 보기`,
    url: item.market === "overseas" ? overseasNewsUrl : domesticNewsUrl,
  };
}

function getWatchItemAiComment(item: WatchItem) {
  if (item.changeRate.startsWith("+")) {
    return `${item.name}은 현재 상승 흐름이 우세합니다. 단기 추격 매수보다는 목표가와 손절가 기준을 확인하면서 분할 접근하는 편이 좋습니다.`;
  }
  if (item.changeRate.startsWith("-")) {
    return `${item.name}은 단기 약세 구간입니다. 뉴스 이벤트와 거래대금 회복 여부를 확인하고, 반등 신호가 나오기 전까지는 비중 확대를 서두르지 않는 전략이 유리합니다.`;
  }
  return `${item.name}은 아직 뚜렷한 방향성이 약합니다. 관심종목으로 추적하면서 거래량 변화와 주요 뉴스 흐름을 함께 확인하세요.`;
}

function AiCommentModal({ item, onClose }: { item: WatchItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="watchlist-ai-comment-title">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <StockIcon code={item.symbol} name={item.name} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">AI 코멘트</p>
              <h2 id="watchlist-ai-comment-title" className="mt-1 truncate text-lg font-black text-[#071832]">
                {item.name}
              </h2>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-500">{item.symbol}</p>
            </div>
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
          <MetricPill label="현재가" value={item.price} tone="text-[#071832]" />
          <MetricPill label="등락률" value={item.changeRate} tone={changeRateClass(item.changeRate)} />
          <MetricPill label="시그널" value={item.signal} tone="text-[#8a6400]" />
        </div>
        <div className="mt-4 rounded-lg border border-slate-100 bg-[#f8fafc] p-4">
          <p className="text-sm font-semibold leading-7 text-slate-700">{getWatchItemAiComment(item)}</p>
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
      <p className={`mt-1 truncate text-sm font-black ${tone}`}>{value}</p>
    </div>
  );
}

function changeRateClass(changeRate: string) {
  if (changeRate.startsWith("+")) return "text-profit";
  if (changeRate.startsWith("-")) return "text-loss";
  return "text-slate-500";
}
