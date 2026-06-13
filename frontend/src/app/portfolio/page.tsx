"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Calculator, Lightbulb, LineChart, Pencil, PieChart, PlayCircle, Plus, Search, Target, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout";
import { LightweightAreaChart } from "@/components/charts/LightweightCharts";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import { useToast } from "@/components/ui";
import { useConfigStatus } from "@/hooks";
import { getBrokerProviderOption } from "@/lib/brokerProviders";
import { isBrokerConnected } from "@/lib/configStatus";
import { assetAllocation, assetSummary, holdingsSummaryItems, portfolioList, tradingWorkspaceByStockId } from "@/lib/mockData";
import type { HoldingSummaryItem } from "@/types/symbols";

const periodOptions = ["1개월", "3개월", "6개월", "1년", "전체"];
const periodChartHeights: Record<string, number[]> = {
  "1개월": [48, 52, 50, 57, 60, 64, 62, 69, 72, 75, 77, 80],
  "3개월": [42, 47, 45, 53, 56, 61, 59, 66, 70, 73, 76, 79],
  "6개월": [36, 43, 40, 49, 55, 52, 63, 66, 72, 78, 81, 86],
  "1년": [32, 40, 37, 54, 61, 58, 72, 78, 84, 91, 88, 96],
  전체: [24, 33, 39, 44, 51, 56, 61, 67, 72, 80, 88, 94],
};

const portfolioStockSeeds = [
  [
    { id: "005930", weight: 34 },
    { id: "000660", weight: 28 },
    { id: "035420", weight: 20 },
    { id: "373220", weight: 18 },
  ],
  [
    { id: "005930", weight: 32 },
    { id: "005380", weight: 24 },
    { id: "066570", weight: 22 },
    { id: "035720", weight: 22 },
  ],
  [
    { id: "NVDA", weight: 36 },
    { id: "AAPL", weight: 27 },
    { id: "MSFT", weight: 22 },
    { id: "TSLA", weight: 15 },
  ],
  [
    { id: "005930", weight: 28 },
    { id: "005380", weight: 25 },
    { id: "AAPL", weight: 25 },
    { id: "MSFT", weight: 22 },
  ],
];

type PortfolioStockItem = HoldingSummaryItem & {
  weight: number;
  aiMemo: string;
};

type PortfolioDisplayStockItem = PortfolioStockItem & {
  canSell: boolean;
  displayWeight: number;
  orderQuantity: string;
};

type ManagedPortfolio = {
  id: string;
  title: string;
  value: string;
  returnRate: string;
  portfolioWeight: string;
  backtestReturn: string;
  backtestPeriod: string;
  holdings: PortfolioStockItem[];
};

type PortfolioStockCandidate = {
  id: string;
  code: string;
  name: string;
  iconUrl?: string;
  price: string;
  changeRate: string;
};

type DraftStockItem = PortfolioStockCandidate & {
  weight: number;
};

type BacktestResult = {
  returnRate: string;
  volatility: string;
  maxDrawdown: string;
  finalAmount: string;
};

type PortfolioDraftPayload = {
  title: string;
  stocks: DraftStockItem[];
  backtestPeriod: string;
  initialAmount: string;
  backtestResult: BacktestResult | null;
};

const stockCandidates: PortfolioStockCandidate[] = Object.values(tradingWorkspaceByStockId).map(({ stock }) => ({
  id: stock.id,
  code: stock.code,
  name: stock.name,
  iconUrl: stock.iconUrl,
  price: stock.price,
  changeRate: stock.changeRate,
}));

export default function PortfolioPage() {
  const { status: configStatus } = useConfigStatus();
  const toast = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("1년");
  const [portfolios, setPortfolios] = useState<ManagedPortfolio[]>(buildInitialPortfolios);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(() => buildInitialPortfolios()[0]?.id ?? "");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<ManagedPortfolio | null>(null);
  const [isAllocationTooltipOpen, setIsAllocationTooltipOpen] = useState(false);
  const holdingsSectionRef = useRef<HTMLElement | null>(null);
  const chartHeights = useMemo(() => periodChartHeights[selectedPeriod] ?? periodChartHeights["1년"], [selectedPeriod]);
  const brokerOption = getBrokerProviderOption(configStatus.broker_provider);
  const brokerConnected = isBrokerConnected(configStatus);
  const pieGradient = buildConicGradient();
  const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? portfolios[0] ?? null;
  const selectedPortfolioHoldings = useMemo(() => buildPortfolioDisplayHoldings(selectedPortfolio?.holdings ?? []), [selectedPortfolio]);

  const handlePortfolioStockSelect = (id: string) => {
    window.dispatchEvent(new CustomEvent("portfolio-stock-selected", { detail: { id } }));
  };

  const handlePortfolioStockOrder = (item: PortfolioDisplayStockItem, orderSide: "buy" | "sell") => {
    window.dispatchEvent(
      new CustomEvent("portfolio-stock-selected", {
        detail: {
          id: item.id,
          orderSide,
          quantity: orderSide === "sell" ? item.orderQuantity : undefined,
        },
      })
    );
  };

  const handleAssetAllocationClick = () => {
    setIsAllocationTooltipOpen(false);
    holdingsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCreatePortfolio = (draft: PortfolioDraftPayload) => {
    const nextPortfolio = createPortfolioFromDraft(draft);
    setPortfolios((current) => [nextPortfolio, ...current]);
    setSelectedPortfolioId(nextPortfolio.id);
    setIsAddModalOpen(false);
    toast.success("포트폴리오 구성을 추가했습니다.");
  };

  const handleUpdatePortfolio = (id: string, draft: PortfolioDraftPayload) => {
    const nextPortfolio = createPortfolioFromDraft(draft, id);
    setPortfolios((current) => current.map((portfolio) => (portfolio.id === id ? nextPortfolio : portfolio)));
    setSelectedPortfolioId(id);
    setEditingPortfolio(null);
    toast.success("포트폴리오 구성을 수정했습니다.");
  };

  const handleDeletePortfolio = (id: string) => {
    const target = portfolios.find((portfolio) => portfolio.id === id);
    const nextPortfolios = portfolios.filter((portfolio) => portfolio.id !== id);
    setPortfolios(nextPortfolios);
    if (selectedPortfolioId === id) {
      setSelectedPortfolioId(nextPortfolios[0]?.id ?? "");
    }
    if (target) toast.success(`${target.title} 구성을 삭제했습니다.`);
  };

  return (
    <AppShell screen="portfolio">
      <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption}>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-normal text-[#071832]">보유 포트폴리오</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">구성 리스트를 선택하고, 구성 종목과 비중을 직접 관리합니다.</p>
              </div>
              <div className="rounded-lg bg-[#f8fafc] px-4 py-3 text-right">
                <p className="text-xs font-bold text-slate-500">총평가금액</p>
                <p className="mt-1 text-xl font-black text-[#071832]">{assetSummary.totalAsset}</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <InfoPanel icon={Lightbulb} title="AI 제안" value="성장 자산 과열 구간 점검" description="반도체 비중은 유지하되 현금성 자산을 6% 이상 확보하는 리밸런싱을 권장합니다." />
              <InfoPanel icon={Target} title="목표 달성률" value="64%" description="목표 3억원 기준, 현재 추세 유지 시 2039년 8월 달성이 예상됩니다." />
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-[#071832]">보유 포트폴리오 구성</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">구성 리스트에서 포트폴리오를 선택하면 하단 구성 종목 내역이 변경됩니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#071832] px-4 text-sm font-extrabold text-white transition hover:bg-[#12305a] focus-ring"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  구성 추가
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[minmax(180px,1.4fr)_76px_100px_80px_98px_82px] bg-[#f8fafc] px-3 py-2 text-xs font-extrabold text-slate-500">
                  <span>포트폴리오 제목</span>
                  <span className="text-right">비중</span>
                  <span className="text-right">평가금액</span>
                  <span className="text-right">수익률</span>
                  <span className="text-right">백테스트</span>
                  <span className="text-center">관리</span>
                </div>
                {portfolios.length > 0 ? (
                  portfolios.map((portfolio) => (
                    <PortfolioConfigRow
                      key={portfolio.id}
                      portfolio={portfolio}
                      selected={portfolio.id === selectedPortfolio?.id}
                      onDelete={() => handleDeletePortfolio(portfolio.id)}
                      onEdit={() => setEditingPortfolio(portfolio)}
                      onSelect={() => setSelectedPortfolioId(portfolio.id)}
                    />
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm font-bold text-slate-500">등록된 포트폴리오 구성이 없습니다.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
                <h2 className="text-base font-extrabold text-[#071832]">자산 비중</h2>
              </div>
              <button
                type="button"
                onClick={handleAssetAllocationClick}
                onPointerEnter={() => setIsAllocationTooltipOpen(true)}
                onPointerLeave={() => setIsAllocationTooltipOpen(false)}
                onFocus={() => setIsAllocationTooltipOpen(true)}
                onBlur={() => setIsAllocationTooltipOpen(false)}
                className="group relative mx-auto flex h-56 w-56 items-center justify-center rounded-full text-center outline-none transition hover:scale-[1.01] focus-ring"
                style={{ background: pieGradient }}
                aria-label="자산비중 구성종목 내역으로 이동"
                aria-controls="portfolio-holdings-section"
                title="구성종목 내역으로 이동"
              >
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                  <span className="text-xs text-slate-500">총평가금액</span>
                  <span className="mt-1 text-sm font-extrabold text-[#071832]">{assetSummary.totalAsset}</span>
                </div>
                <div
                  className={`pointer-events-none absolute left-1/2 top-full z-30 mt-3 w-80 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-2xl ${isAllocationTooltipOpen ? "block" : "hidden"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <span className="text-xs font-black text-[#071832]">구성종목</span>
                    <span className="truncate text-[11px] font-bold text-slate-500">{selectedPortfolio?.title ?? "선택된 포트폴리오 없음"}</span>
                  </div>
                  <div className="grid gap-2">
                    {selectedPortfolioHoldings.length > 0 ? (
                      selectedPortfolioHoldings.slice(0, 6).map((item) => (
                        <div key={`allocation-tooltip-${item.id}`} className="grid grid-cols-[minmax(0,1fr)_56px_72px] items-center gap-2 text-xs">
                          <span className="truncate font-extrabold text-[#071832]">{item.name}</span>
                          <span className="text-right font-black text-[#8a6400]">{formatPortfolioWeight(item.displayWeight)}</span>
                          <span className="text-right font-bold text-slate-500">{item.valuationAmount}</span>
                        </div>
                      ))
                    ) : (
                      <p className="py-2 text-center text-xs font-bold text-slate-500">표시할 구성종목이 없습니다.</p>
                    )}
                  </div>
                </div>
              </button>
              <div className="mt-5 grid gap-3">
                {assetAllocation.map((item) => (
                  <div key={item.category} className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 py-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.category}
                    </span>
                    <span className="text-sm font-extrabold text-[#071832]">{item.weight}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LineChart className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
                  <h2 className="text-base font-extrabold text-[#071832]">수익률 추이</h2>
                </div>
                <div className="inline-flex rounded-lg bg-[#f8fafc] p-1">
                  {periodOptions.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`rounded-md px-3 py-2 text-xs font-bold focus-ring ${period === selectedPeriod ? "bg-white text-[#071832] shadow-sm" : "text-slate-500 hover:text-[#071832]"}`}
                      aria-pressed={period === selectedPeriod}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <LightweightAreaChart
                className="rounded-lg bg-[#f8fafc] p-2"
                data={expandChartValues(chartHeights, 4).map((value, index) => ({ time: indexedChartDate(index), value }))}
                height={192}
                compact={false}
                interactive={false}
                lineColor="#2563eb"
                topColor="rgba(37, 99, 235, 0.24)"
                bottomColor="rgba(37, 99, 235, 0.02)"
                valueSuffix="%"
                ariaLabel="Portfolio return trend chart"
              />
            </div>
          </div>
        </section>

        <section id="portfolio-holdings-section" ref={holdingsSectionRef} className="mt-5 scroll-mt-24 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#071832]">구성 종목 내역</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">{selectedPortfolio ? selectedPortfolio.title : "선택된 포트폴리오 없음"}</p>
            </div>
            {selectedPortfolio ? (
              <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-right">
                <p className="text-[11px] font-bold text-slate-500">구성 비중 합계</p>
                <p className="mt-0.5 text-sm font-black text-[#071832]">{formatPortfolioWeight(getDisplayWeightTotal(selectedPortfolioHoldings))}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-3">종목명</th>
                  <th className="py-3 pr-3">종목코드</th>
                  <th className="py-3 pr-3">보유수량</th>
                  <th className="py-3 pr-3">평가금액</th>
                  <th className="py-3 pr-3">평가손익</th>
                  <th className="py-3 pr-3">수익률</th>
                  <th className="py-3 pr-3">비중</th>
                  <th className="py-3 pr-3">AI 메모</th>
                  <th className="py-3 text-right">주문</th>
                </tr>
              </thead>
              <tbody>
                {selectedPortfolioHoldings.map((item) => (
                  <tr key={`${selectedPortfolio?.id ?? "portfolio"}-${item.id}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-4 pr-3">
                      <PortfolioStockIdentity item={item} onSelect={() => handlePortfolioStockSelect(item.id)} />
                    </td>
                    <td className="py-4 pr-3 font-mono text-xs text-slate-500">{item.code}</td>
                    <td className="py-4 pr-3 text-slate-600">{item.quantity}</td>
                    <td className="py-4 pr-3 font-bold text-[#071832]">{item.valuationAmount}</td>
                    <td className={`py-4 pr-3 font-extrabold ${item.profitLossAmount.startsWith("-") ? "text-loss" : "text-profit"}`}>{item.profitLossAmount}</td>
                    <td className={`py-4 pr-3 font-extrabold ${item.profitLossRate.startsWith("-") ? "text-loss" : "text-profit"}`}>{item.profitLossRate}</td>
                    <td className="py-4 pr-3 font-bold text-slate-600">{formatPortfolioWeight(item.displayWeight)}</td>
                    <td className="py-4 pr-3 text-slate-600">{item.aiMemo}</td>
                    <td className="py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handlePortfolioStockOrder(item, "buy")}
                          className="h-8 rounded-lg bg-red-50 px-3 text-xs font-extrabold text-red-600 transition hover:bg-red-100 focus-ring"
                          aria-label={`${item.name} 매수 주문`}
                          title={`${item.name} 매수 주문`}
                        >
                          매수
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePortfolioStockOrder(item, "sell")}
                          disabled={!item.canSell}
                          className="h-8 rounded-lg bg-blue-50 px-3 text-xs font-extrabold text-blue-600 transition hover:bg-blue-100 focus-ring disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          aria-label={`${item.name} 매도 주문`}
                          title={item.canSell ? `${item.name} ${item.orderQuantity}주 매도 주문` : "보유수량이 없어 매도할 수 없습니다"}
                        >
                          매도
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </BrokerConnectionGate>

      {isAddModalOpen ? (
        <PortfolioConfigModal
          candidates={stockCandidates}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleCreatePortfolio}
        />
      ) : null}
      {editingPortfolio ? (
        <PortfolioConfigModal
          candidates={stockCandidates}
          initialPortfolio={editingPortfolio}
          onClose={() => setEditingPortfolio(null)}
          onSubmit={(draft) => handleUpdatePortfolio(editingPortfolio.id, draft)}
        />
      ) : null}
    </AppShell>
  );
}

function PortfolioConfigRow({
  portfolio,
  selected,
  onDelete,
  onEdit,
  onSelect,
}: {
  portfolio: ManagedPortfolio;
  selected: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`grid cursor-pointer grid-cols-[minmax(180px,1.4fr)_76px_100px_80px_98px_82px] items-center border-t border-slate-100 px-3 py-3 text-sm transition hover:bg-[#fff8e1] focus-ring ${
        selected ? "bg-blue-50/70" : "bg-white"
      }`}
    >
      <div className="min-w-0">
        <span className="block truncate font-black text-[#071832]">{portfolio.title}</span>
        <span className="mt-1 block text-[11px] font-semibold text-slate-500">구성 {portfolio.holdings.length}개 · {portfolio.backtestPeriod}</span>
      </div>
      <span className="text-right font-extrabold text-slate-600">{portfolio.portfolioWeight}</span>
      <span className="text-right font-extrabold text-[#071832]">{portfolio.value}</span>
      <span className={`text-right font-extrabold ${portfolio.returnRate.startsWith("-") ? "text-loss" : "text-profit"}`}>{portfolio.returnRate}</span>
      <span className={`text-right font-extrabold ${portfolio.backtestReturn.startsWith("-") ? "text-loss" : "text-profit"}`}>{portfolio.backtestReturn}</span>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 focus-ring"
          aria-label={`${portfolio.title} 수정`}
          title={`${portfolio.title} 수정`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus-ring"
          aria-label={`${portfolio.title} 삭제`}
          title={`${portfolio.title} 삭제`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PortfolioConfigModal({
  candidates,
  initialPortfolio,
  onClose,
  onSubmit,
}: {
  candidates: PortfolioStockCandidate[];
  initialPortfolio?: ManagedPortfolio | null;
  onClose: () => void;
  onSubmit: (payload: PortfolioDraftPayload) => void;
}) {
  const initialStocks = initialPortfolio ? createDraftStocksFromPortfolio(initialPortfolio) : [];
  const [title, setTitle] = useState(initialPortfolio?.title ?? "");
  const [query, setQuery] = useState("");
  const [selectedWeight, setSelectedWeight] = useState(initialStocks.length > 0 ? String(getNextDraftWeight(initialStocks)) : "100");
  const [stocks, setStocks] = useState<DraftStockItem[]>(initialStocks);
  const [backtestPeriod, setBacktestPeriod] = useState(initialPortfolio?.backtestPeriod ?? "1년");
  const [initialAmount, setInitialAmount] = useState(initialPortfolio ? initialPortfolio.value.replace(/[^\d,]/g, "") : "50,000,000");
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(
    initialPortfolio
      ? {
          returnRate: initialPortfolio.backtestReturn,
          volatility: "-",
          maxDrawdown: "-",
          finalAmount: initialPortfolio.value,
        }
      : null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const filteredCandidates = useMemo(
    () => candidates.filter((candidate) => `${candidate.name} ${candidate.code}`.toLowerCase().includes(query.trim().toLowerCase())),
    [candidates, query]
  );
  const totalWeight = stocks.reduce((sum, stock) => sum + stock.weight, 0);
  const modalTitle = initialPortfolio ? "포트폴리오 구성 수정" : "포트폴리오 구성 추가";
  const submitLabel = initialPortfolio ? "수정 저장" : "구성 저장";

  const addStock = () => {
    const selectedStock = findStockCandidate(query, candidates, filteredCandidates);
    const weight = Number(selectedWeight);
    if (!query.trim() || !selectedStock || !Number.isFinite(weight) || weight <= 0) {
      setErrorMessage("추가할 종목과 비중을 확인해 주세요.");
      return;
    }

    const exists = stocks.some((stock) => stock.id === selectedStock.id);
    const nextStocks = exists
      ? stocks.map((stock) => (stock.id === selectedStock.id ? { ...stock, weight } : stock))
      : [...stocks, { ...selectedStock, weight }];
    setStocks(nextStocks);
    setSelectedWeight(String(getNextDraftWeight(nextStocks)));
    setQuery("");
    setBacktestResult(null);
    setErrorMessage("");
  };

  const handleAddStockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addStock();
  };

  const updateStockWeight = (id: string, value: string) => {
    const weight = Number(value);
    setStocks((current) => current.map((stock) => (stock.id === id ? { ...stock, weight: Number.isFinite(weight) ? weight : 0 } : stock)));
    setBacktestResult(null);
  };

  const removeStock = (id: string) => {
    setStocks((current) => current.filter((stock) => stock.id !== id));
    setBacktestResult(null);
  };

  const autoCalculateWeights = () => {
    if (stocks.length === 0) {
      setErrorMessage("비중을 계산할 종목을 먼저 추가해 주세요.");
      return;
    }
    const nextStocks = distributeDraftWeights(stocks);
    setStocks(nextStocks);
    setSelectedWeight(String(getNextDraftWeight(nextStocks)));
    setBacktestResult(null);
    setErrorMessage("");
  };

  const runBacktest = () => {
    if (stocks.length === 0) {
      setErrorMessage("백테스트할 종목을 먼저 추가해 주세요.");
      return;
    }
    setBacktestResult(calculateBacktest(stocks, initialAmount));
    setErrorMessage("");
  };

  const submit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage("포트폴리오 제목을 입력해 주세요.");
      return;
    }
    if (stocks.length === 0) {
      setErrorMessage("종목을 1개 이상 추가해 주세요.");
      return;
    }
    if (totalWeight <= 0) {
      setErrorMessage("종목 비중 합계가 0보다 커야 합니다.");
      return;
    }

    onSubmit({
      title: trimmedTitle,
      stocks,
      backtestPeriod,
      initialAmount,
      backtestResult,
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="portfolio-config-modal-title">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="portfolio-config-modal-title" className="text-lg font-black text-[#071832]">{modalTitle}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">제목, 구성 종목, 비중을 입력하고 저장 전 백테스트를 실행할 수 있습니다.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-ring" aria-label="팝업 닫기">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-76px)] overflow-y-auto p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-extrabold text-slate-600">포트폴리오 제목</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-[#071832] outline-none transition focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
                  placeholder="예: 2차전지 성장 포트폴리오"
                />
              </label>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#8a6400]" aria-hidden="true" />
                  <h3 className="text-sm font-extrabold text-[#071832]">종목 추가</h3>
                </div>
                <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_96px_92px]" onSubmit={handleAddStockSubmit}>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none transition focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
                    placeholder="종목명 또는 코드 검색"
                    list="portfolio-stock-candidates"
                  />
                  <datalist id="portfolio-stock-candidates">
                    {filteredCandidates.slice(0, 12).map((candidate) => (
                      <option key={candidate.id} value={`${candidate.name} (${candidate.code})`} />
                    ))}
                  </datalist>
                  <input
                    value={selectedWeight}
                    onChange={(event) => setSelectedWeight(event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 px-3 text-right text-sm font-bold outline-none transition focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
                    inputMode="numeric"
                    aria-label="추가 종목 비중"
                  />
                  <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f6b100] px-3 text-sm font-extrabold text-[#071832] transition hover:bg-[#e0a000] focus-ring">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    추가
                  </button>
                </form>

                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <div className="grid grid-cols-[1fr_100px_44px] bg-[#f8fafc] px-3 py-2 text-xs font-extrabold text-slate-500">
                    <span>종목</span>
                    <span className="text-right">비중</span>
                    <span className="text-center">삭제</span>
                  </div>
                  {stocks.length > 0 ? (
                    stocks.map((stock) => (
                      <div key={stock.id} className="grid grid-cols-[1fr_100px_44px] items-center border-t border-slate-100 px-3 py-2">
                        <StockLabel item={stock} />
                        <div className="flex items-center justify-end gap-1">
                          <input
                            value={stock.weight}
                            onChange={(event) => updateStockWeight(stock.id, event.target.value)}
                            className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-right text-xs font-bold outline-none focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
                            inputMode="numeric"
                            aria-label={`${stock.name} 비중`}
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                        <button type="button" onClick={() => removeStock(stock.id)} className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 focus-ring" aria-label={`${stock.name} 삭제`}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center text-sm font-bold text-slate-500">추가된 종목이 없습니다.</div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-500">비중 합계</span>
                  <span className={totalWeight === 100 ? "text-profit" : "text-[#8a6400]"}>{totalWeight}%</span>
                </div>
                <button
                  type="button"
                  onClick={autoCalculateWeights}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-600 transition hover:bg-[#fff8e1] hover:text-[#071832] focus-ring"
                >
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  비중 자동계산
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-[#8a6400]" aria-hidden="true" />
                <h3 className="text-sm font-extrabold text-[#071832]">백테스트</h3>
              </div>
              <label className="block">
                <span className="text-xs font-extrabold text-slate-600">기간</span>
                <select
                  value={backtestPeriod}
                  onChange={(event) => setBacktestPeriod(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
                >
                  {periodOptions.slice(1).map((period) => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-extrabold text-slate-600">초기 투자금</span>
                <input
                  value={initialAmount}
                  onChange={(event) => setInitialAmount(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
                  inputMode="numeric"
                />
              </label>
              <button type="button" onClick={runBacktest} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#071832] text-sm font-extrabold text-white transition hover:bg-[#12305a] focus-ring">
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                백테스트 실행
              </button>
              {backtestResult ? (
                <div className="mt-4 grid gap-2">
                  <BacktestMetric label="예상 수익률" value={backtestResult.returnRate} tone={backtestResult.returnRate.startsWith("-") ? "down" : "up"} />
                  <BacktestMetric label="변동성" value={backtestResult.volatility} />
                  <BacktestMetric label="최대낙폭" value={backtestResult.maxDrawdown} tone="down" />
                  <BacktestMetric label="예상 평가금" value={backtestResult.finalAmount} />
                </div>
              ) : (
                <p className="mt-4 rounded-lg bg-white px-3 py-4 text-center text-xs font-bold leading-5 text-slate-500">
                  종목과 비중을 입력한 뒤 백테스트를 실행하세요.
                </p>
              )}
            </div>
          </div>

          {errorMessage ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{errorMessage}</p> : null}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 focus-ring">
              취소
            </button>
            <button type="button" onClick={submit} className="h-10 rounded-lg bg-[#f6b100] px-5 text-sm font-extrabold text-[#071832] transition hover:bg-[#e0a000] focus-ring">
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockLabel({ item }: { item: Pick<PortfolioStockCandidate, "name" | "code" | "iconUrl"> }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StockLogo item={item} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#071832]">{item.name}</span>
        <span className="block font-mono text-[11px] font-semibold text-slate-500">{item.code}</span>
      </span>
    </span>
  );
}

function BacktestMetric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={`text-sm font-black ${tone === "up" ? "text-profit" : tone === "down" ? "text-loss" : "text-[#071832]"}`}>{value}</span>
    </div>
  );
}

function PortfolioStockIdentity({
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
      className="-m-1 flex max-w-full items-center gap-2 rounded-lg p-1 text-left transition hover:bg-[#fff8e1] focus-ring"
      aria-label={`${item.name} 주문 화면 열기`}
      title={`${item.name} 주문 화면 열기`}
    >
      <StockLogo item={item} />
      <span className="min-w-0">
        <span className="block truncate font-bold text-[#071832]">{item.name}</span>
        <span className="block font-mono text-[11px] font-semibold text-slate-500">{item.code}</span>
      </span>
    </button>
  );
}

function StockLogo({ item }: { item: Pick<HoldingSummaryItem, "name" | "iconUrl"> }) {
  return (
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
  );
}

function InfoPanel({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof Lightbulb;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-[#fffdf7] p-4">
      <Icon className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-black text-[#071832]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
    </div>
  );
}

function buildInitialPortfolios(): ManagedPortfolio[] {
  return portfolioList.map((portfolio, index) => {
    const holdings = portfolioStockSeeds[index].map((seed) => createPortfolioStockItem(seed.id, seed.weight));
    return {
      id: `portfolio-${index + 1}`,
      title: portfolio.name,
      value: portfolio.value,
      returnRate: portfolio.returnRate,
      portfolioWeight: portfolio.weight,
      backtestReturn: index === 0 ? "+11.8%" : index === 1 ? "+7.4%" : index === 2 ? "+18.2%" : "+6.3%",
      backtestPeriod: "1년",
      holdings,
    };
  });
}

function createPortfolioFromDraft(draft: PortfolioDraftPayload, id = `portfolio-${Date.now()}`): ManagedPortfolio {
  const holdings = draft.stocks.map((stock) => createPortfolioStockItem(stock.id, stock.weight));
  const totalWeight = getHoldingWeightTotal(holdings);
  const returnRate = draft.backtestResult?.returnRate ?? formatRate(calculateWeightedRate(draft.stocks));
  const amount = parseCurrencyNumber(draft.initialAmount);
  const value = `${Math.round(amount).toLocaleString("ko-KR")}원`;

  return {
    id,
    title: draft.title,
    value,
    returnRate,
    portfolioWeight: `${totalWeight}%`,
    backtestReturn: draft.backtestResult?.returnRate ?? returnRate,
    backtestPeriod: draft.backtestPeriod,
    holdings,
  };
}

function createDraftStocksFromPortfolio(portfolio: ManagedPortfolio): DraftStockItem[] {
  return portfolio.holdings.map((holding) => {
    const stock = tradingWorkspaceByStockId[holding.id]?.stock;
    return {
      id: holding.id,
      code: holding.code,
      name: holding.name,
      iconUrl: holding.iconUrl,
      price: stock?.price ?? holding.valuationAmount,
      changeRate: stock?.changeRate ?? holding.profitLossRate,
      weight: holding.weight,
    };
  });
}

function findStockCandidate(query: string, candidates: PortfolioStockCandidate[], filteredCandidates: PortfolioStockCandidate[]) {
  const normalizedQuery = normalizeStockSearch(query);
  if (!normalizedQuery) return null;
  return (
    candidates.find((candidate) => {
      const exactLabel = normalizeStockSearch(`${candidate.name} (${candidate.code})`);
      const exactName = normalizeStockSearch(candidate.name);
      const exactCode = normalizeStockSearch(candidate.code);
      return exactLabel === normalizedQuery || exactName === normalizedQuery || exactCode === normalizedQuery;
    }) ??
    filteredCandidates[0] ??
    null
  );
}

function normalizeStockSearch(value: string) {
  return value.replace(/[()\s]/g, "").toLowerCase();
}

function getNextDraftWeight(stocks: DraftStockItem[]) {
  const remainingWeight = Math.max(0, 100 - stocks.reduce((sum, stock) => sum + stock.weight, 0));
  if (remainingWeight > 0) return remainingWeight;
  return Math.max(1, Math.round(100 / Math.max(stocks.length + 1, 1)));
}

function distributeDraftWeights(stocks: DraftStockItem[]) {
  if (stocks.length === 0) return stocks;
  const baseWeight = Math.floor(100 / stocks.length);
  const remainder = 100 - baseWeight * stocks.length;
  return stocks.map((stock, index) => ({ ...stock, weight: baseWeight + (index < remainder ? 1 : 0) }));
}

function buildPortfolioDisplayHoldings(holdings: PortfolioStockItem[]): PortfolioDisplayStockItem[] {
  const marketValues = holdings.map((holding) => getHoldingMarketValue(holding));
  const totalMarketValue = marketValues.reduce((sum, value) => sum + value, 0);
  const fallbackWeightTotal = getHoldingWeightTotal(holdings);

  return holdings.map((holding, index) => {
    const quantity = parseHoldingQuantity(holding.quantity);
    const displayWeight =
      totalMarketValue > 0
        ? (marketValues[index] / totalMarketValue) * 100
        : fallbackWeightTotal > 0
          ? (holding.weight / fallbackWeightTotal) * 100
          : 0;

    return {
      ...holding,
      canSell: quantity > 0,
      displayWeight,
      orderQuantity: quantity > 0 ? String(quantity) : "0",
    };
  });
}

function getHoldingMarketValue(holding: PortfolioStockItem) {
  const valuationAmount = parseCurrencyNumber(holding.valuationAmount, 0);
  if (valuationAmount > 0) return valuationAmount;

  const quantity = parseHoldingQuantity(holding.quantity);
  const price = parseCurrencyNumber(tradingWorkspaceByStockId[holding.id]?.stock.price ?? "", 0);
  if (quantity > 0 && price > 0) return quantity * price;

  return holding.weight;
}

function createPortfolioStockItem(id: string, weight: number): PortfolioStockItem {
  const stock = tradingWorkspaceByStockId[id]?.stock;
  const holding = holdingsSummaryItems.find((item) => item.id === id);
  const changeRate = stock?.changeRate ?? holding?.profitLossRate ?? "0.00%";
  const rateValue = parseRate(changeRate);
  const absoluteProfit = Math.max(42_000, Math.round(Math.abs(rateValue) * weight * 23_000));

  return {
    id,
    code: stock?.code ?? holding?.code ?? id,
    name: stock?.name ?? holding?.name ?? id,
    iconUrl: stock?.iconUrl ?? holding?.iconUrl,
    quantity: holding?.quantity ?? "-",
    valuationAmount: holding?.valuationAmount ?? `${Math.round(weight * 1_180_000).toLocaleString("ko-KR")}원`,
    profitLossAmount: holding?.profitLossAmount ?? `${rateValue < 0 ? "-" : "+"}${absoluteProfit.toLocaleString("ko-KR")}원`,
    profitLossRate: holding?.profitLossRate ?? changeRate,
    todayChangeRate: holding?.todayChangeRate ?? changeRate,
    weight,
    aiMemo: buildAiMemo(rateValue),
  };
}

function calculateBacktest(stocks: DraftStockItem[], initialAmount: string): BacktestResult {
  const weightedRate = calculateWeightedRate(stocks);
  const volatility = Math.max(4.2, Math.min(22.4, 7.5 + stocks.length * 1.8 + Math.abs(weightedRate) * 0.45));
  const maxDrawdown = -(Math.max(3.6, volatility * 0.72));
  const amount = parseCurrencyNumber(initialAmount);
  const finalAmount = amount * (1 + weightedRate / 100);

  return {
    returnRate: formatRate(weightedRate),
    volatility: `${volatility.toFixed(1)}%`,
    maxDrawdown: `${maxDrawdown.toFixed(1)}%`,
    finalAmount: `${Math.round(finalAmount).toLocaleString("ko-KR")}원`,
  };
}

function calculateWeightedRate(stocks: DraftStockItem[]) {
  const totalWeight = stocks.reduce((sum, stock) => sum + stock.weight, 0);
  if (totalWeight <= 0) return 0;
  return stocks.reduce((sum, stock) => sum + parseRate(stock.changeRate) * stock.weight, 0) / totalWeight;
}

function parseRate(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRate(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function parseCurrencyNumber(value: string, fallback = 50_000_000) {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getHoldingWeightTotal(holdings: Array<{ weight: number }>) {
  return holdings.reduce((sum, holding) => sum + holding.weight, 0);
}

function parseHoldingQuantity(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getDisplayWeightTotal(holdings: Array<{ displayWeight: number }>) {
  return holdings.reduce((sum, holding) => sum + holding.displayWeight, 0);
}

function formatPortfolioWeight(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function buildAiMemo(rateValue: number) {
  if (rateValue > 1) return "추세가 양호합니다. 목표 비중 유지와 분할 매수 구간을 함께 점검하세요.";
  if (rateValue < -1) return "단기 변동성이 있습니다. 손절 기준과 추가 편입 조건을 명확히 두세요.";
  return "중립 구간입니다. 포트폴리오 전체 변동성 기준으로 비중을 조절하세요.";
}

function buildConicGradient() {
  let cursor = 0;
  const stops = assetAllocation.map((item) => {
    const start = cursor;
    cursor += item.weight;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function indexedChartDate(index: number) {
  return new Date(Date.UTC(2026, 5, index + 1)).toISOString().slice(0, 10);
}

function expandChartValues(values: number[], steps = 4) {
  if (values.length < 2) return values;

  const spread = Math.max(...values) - Math.min(...values) || 1;
  const expanded: number[] = [];

  values.forEach((value, index) => {
    const next = values[index + 1];
    if (next === undefined) {
      expanded.push(value);
      return;
    }

    for (let step = 0; step < steps; step += 1) {
      const ratio = step / steps;
      const eased = ratio * ratio * (3 - 2 * ratio);
      const curvature = Math.sin((index + ratio) * Math.PI) * spread * 0.008;
      expanded.push(Number((value + (next - value) * eased + curvature).toFixed(2)));
    }
  });

  return expanded;
}
