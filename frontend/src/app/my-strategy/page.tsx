"use client";

import { Activity, BarChart3, Bell, PauseCircle, Pencil, PlayCircle, Plus, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import {
  StrategyExecutionConfigurator,
  cloneBuilderState,
  createDefaultExecutionConfig,
  getExecutionSummary,
  type StrategyExecutionConfig,
} from "@/components/strategy/StrategyExecutionConfigurator";
import { useMarketQuotes } from "@/hooks";
import type { PriceData } from "@/lib/api/market";
import { formatQuoteDisplay, getQuoteFromMap } from "@/lib/marketQuoteDisplay";
import { useToast } from "@/components/ui";
import { myStrategies } from "@/lib/mockData";

type StrategyStatusFilter = "전체 전략" | "실행중" | "중지" | "알림 필요";
type StrategyType = "성장형" | "배당형" | "방어형" | "단기매매";
type InvestmentProfile = "안정형" | "중립형" | "공격형";
type OperationMode = "알림만 받기" | "수동 실행" | "자동 실행 검토";

type StrategyHolding = {
  name: string;
  ticker: string;
  price: string;
  weight: number;
};

type StrategyItem = (typeof myStrategies)[number] & {
  strategyType: StrategyType;
  profile: InvestmentProfile;
  operationMode: OperationMode;
  description: string;
  composition: StrategyHolding[];
  alerts: number;
  execution: StrategyExecutionConfig;
};

type StrategyDraft = {
  id?: string;
  name: string;
  description: string;
  strategyType: StrategyType;
  profile: InvestmentProfile;
  operationMode: OperationMode;
  holdings: StrategyHolding[];
  rebalanceGap: number;
  profitAlert: number;
  lossAlert: number;
  volatilityAlert: number;
  checkCycle: string;
  alertMethod: string;
  execution: StrategyExecutionConfig;
};
type StrategyWizardMode = "create" | "edit";

const recommendedHoldings: StrategyHolding[] = [
  { name: "삼성전자", ticker: "005930", price: "0", weight: 40 },
  { name: "SK하이닉스", ticker: "000660", price: "0", weight: 35 },
  { name: "현금성", ticker: "CASH", price: "0", weight: 25 },
];

const initialStrategies: StrategyItem[] = myStrategies.map((strategy, index) => ({
  ...strategy,
  status: strategy.enabled ? "실행중" : "중지",
  strategyType: index === 0 ? "배당형" : index === 1 ? "성장형" : "단기매매",
  profile: index === 1 ? "공격형" : "중립형",
  operationMode: index === 2 ? "알림만 받기" : "수동 실행",
  description:
    index === 0
      ? "배당과 이익 성장률이 함께 개선되는 종목 중심의 중기 전략입니다."
      : index === 1
        ? "반도체와 AI 인프라 수혜 종목을 비중 중심으로 관리합니다."
        : "낙폭과 거래대금 조건을 함께 확인하는 단기 반등 전략입니다.",
  composition:
    index === 0
      ? [
          { name: "고배당 종목", ticker: "DIV", price: "0", weight: 40 },
          { name: "실적 안정주", ticker: "CORE", price: "0", weight: 35 },
          { name: "현금성", ticker: "CASH", price: "0", weight: 25 },
        ]
      : index === 1
        ? recommendedHoldings
        : [
            { name: "KOSPI200 과매도", ticker: "K200", price: "0", weight: 55 },
            { name: "현금성", ticker: "CASH", price: "0", weight: 45 },
          ],
  alerts: index === 1 ? 1 : 0,
  execution: createDefaultExecutionConfig(
    "basic",
    index === 0 ? "mean_reversion" : index === 1 ? "golden_cross" : "disparity"
  ),
}));

const filterLabels: StrategyStatusFilter[] = ["전체 전략", "실행중", "중지", "알림 필요"];
const wizardSteps = ["기본 정보", "전략 구성", "실행 조건", "검토 및 저장"];

export default function MyStrategyPage() {
  const toast = useToast();
  const [strategies, setStrategies] = useState<StrategyItem[]>(initialStrategies);
  const [activeFilter, setActiveFilter] = useState<StrategyStatusFilter>("전체 전략");
  const [selectedStrategyId, setSelectedStrategyId] = useState(initialStrategies[0]?.id ?? "");
  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState<StrategyDraft>(() => createDraftFromStrategy(initialStrategies[0]));
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<StrategyWizardMode>("create");
  const quoteCodes = useMemo(
    () =>
      Array.from(
        new Set([
          ...strategies.flatMap((strategy) => strategy.composition.map((holding) => holding.ticker)),
          ...draft.holdings.map((holding) => holding.ticker),
          ...recommendedHoldings.map((holding) => holding.ticker),
        ])
      ),
    [draft.holdings, strategies]
  );
  const { quotes } = useMarketQuotes(quoteCodes);
  const displayStrategies = useMemo(
    () => strategies.map((strategy) => applyQuotesToStrategy(strategy, quotes)),
    [quotes, strategies]
  );

  const filteredStrategies = useMemo(
    () =>
      displayStrategies.filter((strategy) => {
        if (activeFilter === "전체 전략") return true;
        if (activeFilter === "실행중") return strategy.enabled;
        if (activeFilter === "중지") return !strategy.enabled;
        return strategy.alerts > 0;
      }),
    [activeFilter, displayStrategies]
  );
  const runningCount = strategies.filter((strategy) => strategy.enabled).length;
  const pausedCount = strategies.length - runningCount;
  const alertCount = strategies.reduce((sum, strategy) => sum + strategy.alerts, 0);
  const selectedStrategy = displayStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? displayStrategies[0];

  const selectStrategy = (strategy: StrategyItem) => {
    setSelectedStrategyId(strategy.id);
    setDraft(createDraftFromStrategy(strategy));
    setActiveStep(0);
  };

  const startNewStrategy = () => {
    setSelectedStrategyId("");
    setDraft(createEmptyDraft());
    setActiveStep(0);
    setWizardMode("create");
    setIsWizardOpen(true);
  };

  const openEditStrategy = (strategy = selectedStrategy) => {
    if (!strategy) {
      toast.warning("수정할 전략을 먼저 선택해 주세요.");
      return;
    }
    setSelectedStrategyId(strategy.id);
    setDraft(createDraftFromStrategy(strategy));
    setActiveStep(0);
    setWizardMode("edit");
    setIsWizardOpen(true);
  };

  const toggleStrategy = (id: string) => {
    setStrategies((current) =>
      current.map((strategy) =>
        strategy.id === id
          ? { ...strategy, enabled: !strategy.enabled, status: strategy.enabled ? "중지" : "실행중" }
          : strategy
      )
    );
    toast.success("전략 실행 상태를 변경했습니다.");
  };

  const deleteStrategy = (id: string) => {
    const strategy = strategies.find((item) => item.id === id);
    if (!strategy) return;
    if (!window.confirm(`${strategy.name} 전략을 삭제할까요?`)) return;
    const nextStrategies = strategies.filter((item) => item.id !== id);
    setStrategies(nextStrategies);
    if (selectedStrategyId === id) {
      const fallback = nextStrategies[0];
      setSelectedStrategyId(fallback?.id ?? "");
      setDraft(fallback ? createDraftFromStrategy(fallback) : createEmptyDraft());
    }
    toast.success("전략을 삭제했습니다.");
  };

  const saveDraft = () => {
    const nextName = draft.name.trim();
    if (!nextName) {
      toast.warning("전략명을 입력해 주세요.");
      setActiveStep(0);
      return;
    }
    const executionSummary = getExecutionSummary(draft.execution);
    if (
      draft.execution.mode === "expert" &&
      (executionSummary.indicatorCount === 0 || executionSummary.entryCount === 0 || executionSummary.exitCount === 0)
    ) {
      toast.warning("전문가모드는 지표, 진입 조건, 청산 조건을 모두 설정해 주세요.");
      setActiveStep(2);
      return;
    }
    const normalizedDraft = {
      ...draft,
      name: nextName,
      description: draft.description.trim() || "사용자 조건 기반 투자전략입니다.",
      holdings: normalizeWeights(draft.holdings),
    };
    const existingStrategy = strategies.find((strategy) => strategy.id === normalizedDraft.id);
    const nextStrategy = createStrategyFromDraft(normalizedDraft, existingStrategy);

    setStrategies((current) => {
      const exists = current.some((strategy) => strategy.id === nextStrategy.id);
      return exists
        ? current.map((strategy) => (strategy.id === nextStrategy.id ? nextStrategy : strategy))
        : [nextStrategy, ...current];
    });
    setSelectedStrategyId(nextStrategy.id);
    setDraft(createDraftFromStrategy(nextStrategy));
    setActiveStep(0);
    setIsWizardOpen(false);
    toast.success(existingStrategy ? "전략 수정 내용을 저장했습니다." : "신규 전략을 저장했습니다.");
  };

  return (
    <AppShell screen="my-strategy">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="전체 전략" value={`${strategies.length}개`} icon={BarChart3} active={activeFilter === "전체 전략"} onClick={() => setActiveFilter("전체 전략")} />
        <SummaryCard label="실행중" value={`${runningCount}개`} icon={PlayCircle} accent="text-emerald-600" active={activeFilter === "실행중"} onClick={() => setActiveFilter("실행중")} />
        <SummaryCard label="중지" value={`${pausedCount}개`} icon={PauseCircle} accent="text-slate-500" active={activeFilter === "중지"} onClick={() => setActiveFilter("중지")} />
        <SummaryCard label="알림 필요" value={`${alertCount}건`} icon={Activity} accent="text-amber-600" active={activeFilter === "알림 필요"} onClick={() => setActiveFilter("알림 필요")} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#071832]">내 전략</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">선택 필터: {activeFilter}</p>
            </div>
            <button
              type="button"
              onClick={startNewStrategy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f6b100] px-4 text-sm font-extrabold text-[#071832] transition hover:bg-[#e0a000] focus-ring"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              신규전략
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {filterLabels.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                aria-pressed={activeFilter === filter}
                className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition focus-ring ${
                  activeFilter === filter ? "border-[#071832] bg-[#071832] text-white" : "border-slate-200 bg-[#f8fafc] text-slate-600 hover:bg-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredStrategies.map((strategy) => (
              <article
                key={strategy.id}
                className={`rounded-lg border bg-white p-4 shadow-sm transition ${
                  selectedStrategyId === strategy.id ? "border-[#f6b100] ring-2 ring-[#f6b100]/20" : "border-slate-200 hover:border-[#f3d58a]"
                }`}
              >
                <button type="button" onClick={() => selectStrategy(strategy)} className="block w-full text-left focus-ring">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold text-[#071832]">{strategy.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{strategy.target}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${strategy.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {strategy.enabled ? "실행중" : "중지"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {strategy.composition.map((item) => (
                      <span key={`${strategy.id}-${item.ticker}`} className="rounded-full bg-[#f8fafc] px-3 py-1 text-xs font-bold text-slate-600">
                        {item.name} {item.weight}%
                      </span>
                    ))}
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500">수익률</p>
                    <p className={`mt-1 text-lg font-extrabold ${strategy.returnRate.startsWith("-") ? "text-loss" : "text-profit"}`}>{strategy.returnRate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input type="checkbox" checked={strategy.enabled} onChange={() => toggleStrategy(strategy.id)} className="toggle-switch" />
                      ON/OFF
                    </label>
                    <button
                      type="button"
                      onClick={() => openEditStrategy(strategy)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-[#f8fafc] hover:text-[#071832] focus-ring"
                      aria-label={`${strategy.name} 수정`}
                      title="수정"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => deleteStrategy(strategy.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50 focus-ring" aria-label={`${strategy.name} 삭제`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <StrategyInsightPanel strategy={selectedStrategy} total={strategies.length} running={runningCount} paused={pausedCount} alerts={alertCount} onEdit={openEditStrategy} />
      </section>

      {isWizardOpen && (
        <StrategyWizard
          mode={wizardMode}
          draft={draft}
          quotes={quotes}
          activeStep={activeStep}
          onClose={() => setIsWizardOpen(false)}
          onDraftChange={setDraft}
          onStepChange={setActiveStep}
          onSave={saveDraft}
        />
      )}
    </AppShell>
  );
}

function StrategyWizard({
  mode,
  draft,
  quotes,
  activeStep,
  onClose,
  onDraftChange,
  onStepChange,
  onSave,
}: {
  mode: StrategyWizardMode;
  draft: StrategyDraft;
  quotes: Record<string, PriceData | null | undefined>;
  activeStep: number;
  onClose: () => void;
  onDraftChange: (draft: StrategyDraft) => void;
  onStepChange: (step: number) => void;
  onSave: () => void;
}) {
  const totalWeight = draft.holdings.reduce((sum, item) => sum + item.weight, 0);
  const isEditMode = mode === "edit";
  const executionSummary = getExecutionSummary(draft.execution);
  const displayRecommendedHoldings = useMemo(
    () => recommendedHoldings.map((holding) => applyQuoteToStrategyHolding(holding, quotes)),
    [quotes]
  );
  const displayDraftHoldings = useMemo(
    () => draft.holdings.map((holding) => applyQuoteToStrategyHolding(holding, quotes)),
    [draft.holdings, quotes]
  );

  const updateHolding = (index: number, patch: Partial<StrategyHolding>) => {
    onDraftChange({
      ...draft,
      holdings: draft.holdings.map((holding, currentIndex) => (currentIndex === index ? { ...holding, ...patch } : holding)),
    });
  };

  const removeHolding = (index: number) => {
    onDraftChange({ ...draft, holdings: draft.holdings.filter((_, currentIndex) => currentIndex !== index) });
  };

  const addRecommendedHolding = (holding: StrategyHolding) => {
    if (draft.holdings.some((item) => item.ticker === holding.ticker)) return;
    onDraftChange({ ...draft, holdings: [...draft.holdings, holding] });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-4 py-6">
      <div className="w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold text-[#8a6400]">{isEditMode ? "선택 전략 수정" : "신규전략 구성"}</p>
          <h2 className="mt-1 text-2xl font-black tracking-normal text-[#071832]">
            {isEditMode ? "선택한 전략 1~4단계 수정" : "1~4단계 전략 만들기"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-[#f8fafc] hover:text-[#071832] focus-ring"
          aria-label="전략 설정 창 닫기"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {wizardSteps.map((step, index) => (
          <button
            key={step}
            type="button"
            onClick={() => onStepChange(index)}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-left transition hover:bg-white focus-ring"
            aria-pressed={activeStep === index}
          >
            <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-black ${activeStep === index ? "bg-[#f6b100] text-[#071832]" : "bg-white text-slate-500"}`}>
              {index + 1}
            </span>
            <span className={`truncate text-xs font-extrabold ${activeStep === index ? "text-[#071832]" : "text-slate-500"}`}>{step}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_280px]">
        <div className="min-h-[560px]">
          {activeStep === 0 && (
            <div className="space-y-4">
              <SectionTitle step="1단계" title="기본 정보" />
              <Field label="전략명" value={draft.name} onChange={(value) => onDraftChange({ ...draft, name: value })} />
              <TextArea label="전략 설명" value={draft.description} onChange={(value) => onDraftChange({ ...draft, description: value })} />
              <SelectField label="전략 유형" value={draft.strategyType} options={["성장형", "배당형", "방어형", "단기매매"]} onChange={(value) => onDraftChange({ ...draft, strategyType: value as StrategyType })} />
              <SelectField label="투자 성향" value={draft.profile} options={["안정형", "중립형", "공격형"]} onChange={(value) => onDraftChange({ ...draft, profile: value as InvestmentProfile })} />
              <SelectField label="운용 방식" value={draft.operationMode} options={["알림만 받기", "수동 실행", "자동 실행 검토"]} onChange={(value) => onDraftChange({ ...draft, operationMode: value as OperationMode })} />
              <AIComment>선택된 전략은 수익 기회가 크지만 변동성이 높을 수 있습니다.</AIComment>
            </div>
          )}

          {activeStep === 1 && (
            <div className="space-y-4">
              <SectionTitle step="2단계" title="전략 구성" />
              <label className="block">
                <span className="text-sm font-extrabold text-[#071832]">종목 또는 티커 입력</span>
                <div className="mt-2 flex rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-[#f6b100] focus-within:ring-2 focus-within:ring-[#f6b100]/20">
                  <input className="min-w-0 flex-1 text-sm outline-none" placeholder="예: 삼성전자, 005930, AAPL, QQQ" />
                  <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
                </div>
              </label>
              <div>
                <p className="text-sm font-extrabold text-[#071832]">추천 종목</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {displayRecommendedHoldings.map((holding) => (
                    <button
                      key={holding.ticker}
                      type="button"
                      onClick={() => addRecommendedHolding(holding)}
                      className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring"
                    >
                      <p className="text-sm font-extrabold text-[#071832]">{holding.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{holding.ticker}</p>
                      <Plus className="mt-3 h-4 w-4 text-[#8a6400]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#071832]">선택한 구성 종목</p>
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f8fafc] text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">종목명</th>
                        <th className="px-3 py-2 text-left">티커</th>
                        <th className="px-3 py-2 text-left">현재가</th>
                        <th className="px-3 py-2 text-left">목표 비중</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayDraftHoldings.map((holding, index) => (
                        <tr key={`${holding.ticker}-${index}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-extrabold text-[#071832]">{holding.name}</td>
                          <td className="px-3 py-2 font-bold text-slate-600">{holding.ticker}</td>
                          <td className="px-3 py-2 font-bold text-slate-600">{holding.price}</td>
                          <td className="px-3 py-2">
                            <input
                              value={holding.weight}
                              onChange={(event) => updateHolding(index, { weight: Number(event.target.value) || 0 })}
                              className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right font-bold outline-none focus:border-[#f6b100]"
                              type="number"
                              min={0}
                              max={100}
                            />
                            <span className="ml-1 text-xs font-bold text-slate-500">%</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => removeHolding(index)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 focus-ring" aria-label={`${holding.name} 제거`}>
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-[#f8fafc]">
                      <tr>
                        <td className="px-3 py-2 font-extrabold text-[#071832]" colSpan={3}>총 비중 합계</td>
                        <td className={`px-3 py-2 font-black ${totalWeight === 100 ? "text-[#071832]" : "text-amber-600"}`}>{totalWeight}%</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4">
              <SectionTitle step="3단계" title="실행 조건" />
              <StrategyExecutionConfigurator
                value={draft.execution}
                onChange={(execution) => onDraftChange({ ...draft, execution })}
              />
              <CheckOption label={`목표 비중 대비 ±${draft.rebalanceGap}% 이상 차이 발생 시 알림`} checked onChange={(checked) => checked && onDraftChange({ ...draft })} />
              <NumberField label="수익률 알림 조건" prefix="+" suffix="% 도달 시 알림" value={draft.profitAlert} onChange={(value) => onDraftChange({ ...draft, profitAlert: value })} />
              <NumberField label="손실률 알림 조건" prefix="-" suffix="% 도달 시 알림" value={draft.lossAlert} onChange={(value) => onDraftChange({ ...draft, lossAlert: value })} />
              <NumberField label="종목 변동 알림 조건" prefix="±" suffix="% 이상 변동 시 알림" value={draft.volatilityAlert} onChange={(value) => onDraftChange({ ...draft, volatilityAlert: value })} />
              <SelectField label="점검 주기" value={draft.checkCycle} options={["매일 (장 마감 후)", "매주 금요일", "월 1회"]} onChange={(value) => onDraftChange({ ...draft, checkCycle: value })} />
              <SelectField label="알림 방식" value={draft.alertMethod} options={["앱 알림 + AI 코멘트", "앱 알림", "AI 코멘트"]} onChange={(value) => onDraftChange({ ...draft, alertMethod: value })} />
              <AIComment>
                리밸런싱, 수익률, 손실률, 종목 변동 조건이 동시에 관리됩니다.
              </AIComment>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-4">
              <SectionTitle step="4단계" title="검토 및 저장" />
              <div className="overflow-hidden rounded-lg border border-slate-200">
                {[
                  ["전략명", draft.name || "-"],
                  ["전략 유형", draft.strategyType],
                  ["투자 성향", draft.profile],
                  ["구성 종목 및 비중", draft.holdings.map((item) => `${item.name} ${item.weight}%`).join(" · ") || "-"],
                  ["실행 모드", executionSummary.modeLabel],
                  ["기본 전략", executionSummary.presetName],
                  ["전문가 설정", `지표 ${executionSummary.indicatorCount}개 · 진입 ${executionSummary.entryCount}개 · 청산 ${executionSummary.exitCount}개`],
                  ["리스크", executionSummary.riskSummary],
                  ["리밸런싱 기준", `목표 비중 대비 ±${draft.rebalanceGap}% 이상 차이 발생 시 알림`],
                  ["수익률 알림 조건", `+${draft.profitAlert}% 도달 시 알림`],
                  ["손실률 알림 조건", `-${draft.lossAlert}% 도달 시 알림`],
                  ["점검 주기", draft.checkCycle],
                  ["알림 방식", draft.alertMethod],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[160px_1fr] border-b border-slate-100 last:border-b-0">
                    <div className="bg-[#f8fafc] px-3 py-3 text-sm font-extrabold text-slate-600">{label}</div>
                    <div className="px-3 py-3 text-sm font-bold text-[#071832]">{value}</div>
                  </div>
                ))}
              </div>
              <AIComment>반도체 대형주 중심 전략으로 성장성에서는 성과가 기대되며 알림 설정에 유의해야 합니다.</AIComment>
              <button
                type="button"
                onClick={onSave}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#f6b100] px-5 text-base font-black text-[#071832] transition hover:bg-[#e0a000] focus-ring"
              >
                <Save className="h-5 w-5" aria-hidden="true" />
                {isEditMode ? "수정 저장" : "전략 저장"}
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-[#f3d58a] bg-[#fffdf7] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
              <h3 className="text-sm font-extrabold text-[#071832]">AI 최종 코멘트</h3>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {draft.name || "신규 전략"}은 {draft.profile} 투자자에게 맞춰 구성됩니다. 목표 비중 합계가 100%인지 저장 전에 확인하세요.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-extrabold text-[#071832]">조건 요약</h3>
            <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
              <li>모드: {executionSummary.modeLabel}</li>
              <li>기본 전략: {executionSummary.presetName}</li>
              <li>전문가 조건: 지표 {executionSummary.indicatorCount}개 · 진입 {executionSummary.entryCount}개 · 청산 {executionSummary.exitCount}개</li>
              <li>리스크: {executionSummary.riskSummary}</li>
              <li>리밸런싱: ±{draft.rebalanceGap}%</li>
              <li>수익 알림: +{draft.profitAlert}%</li>
              <li>손실 알림: -{draft.lossAlert}%</li>
              <li>종목 변동: ±{draft.volatilityAlert}%</li>
              <li>점검 주기: {draft.checkCycle}</li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-5 flex justify-between">
        <button
          type="button"
          onClick={() => onStepChange(Math.max(activeStep - 1, 0))}
          disabled={activeStep === 0}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
        >
          이전
        </button>
        <button
          type="button"
          onClick={() => onStepChange(Math.min(activeStep + 1, wizardSteps.length - 1))}
          disabled={activeStep === wizardSteps.length - 1}
          className="rounded-lg bg-[#071832] px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
        >
          다음
        </button>
      </div>
      </div>
    </div>
  );
}

function StrategyInsightPanel({
  strategy,
  total,
  running,
  paused,
  alerts,
  onEdit,
}: {
  strategy?: StrategyItem;
  total: number;
  running: number;
  paused: number;
  alerts: number;
  onEdit: (strategy?: StrategyItem) => void;
}) {
  const allocation = strategy?.composition ?? [];
  const executionSummary = strategy ? getExecutionSummary(strategy.execution) : null;

  return (
    <aside className="space-y-5">
      <div className="rounded-lg border border-[#f3d58a] bg-[#fffdf7] p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-[#071832]">AI 전략 코멘트</h2>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          실행중 전략은 {running}개입니다. 알림이 필요한 전략은 {alerts}건으로, 신규전략은 단계 설정 창에서 조건을 먼저 검토한 뒤 저장하도록 구성했습니다.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-[#071832]">선택 전략</h2>
          {strategy && (
            <button
              type="button"
              onClick={() => onEdit(strategy)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-700 transition hover:bg-[#f8fafc] focus-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              수정
            </button>
          )}
        </div>
        {strategy ? (
          <>
            <div className="mt-4">
              <p className="text-xl font-black tracking-normal text-[#071832]">{strategy.name}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{strategy.description}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="수익률" value={strategy.returnRate} tone={strategy.returnRate.startsWith("-") ? "down" : "up"} />
              <Metric label="위험도" value={strategy.risk} />
              <Metric label="유형" value={strategy.strategyType} />
              <Metric label="운용" value={strategy.operationMode} />
              <Metric label="실행모드" value={executionSummary?.modeLabel ?? "-"} />
              <Metric label="기본전략" value={executionSummary?.presetName ?? "-"} />
            </div>
            <div className="mt-5">
              <p className="text-sm font-extrabold text-[#071832]">구성 비중</p>
              <div className="mt-3 space-y-3">
                {allocation.map((item) => (
                  <div key={`${strategy.id}-${item.ticker}`}>
                    <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                      <span>{item.name}</span>
                      <span>{item.weight}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#f6b100]" style={{ width: `${item.weight}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm font-semibold text-slate-500">선택된 전략이 없습니다.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-extrabold text-[#071832]">전략 현황</h2>
        <div className="mt-4 space-y-3">
          <ScoreRow label="전체 전략" value={`${total}개`} />
          <ScoreRow label="실행중" value={`${running}개`} />
          <ScoreRow label="중지" value={`${paused}개`} />
          <ScoreRow label="알림 필요" value={`${alerts}건`} />
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-black ${metricToneClass(tone)}`}>{value}</p>
    </div>
  );
}

function metricToneClass(tone: "up" | "down" | "neutral") {
  if (tone === "up") return "text-profit";
  if (tone === "down") return "text-loss";
  return "text-[#071832]";
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-sm font-black text-[#071832]">{value}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent = "text-[#8a6400]",
  active,
  onClick,
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
  accent?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-lg border bg-white p-4 text-left shadow-sm transition focus-ring ${active ? "border-[#f6b100] ring-2 ring-[#f6b100]/20" : "border-slate-200 hover:border-[#f3d58a]"}`}>
      <Icon className={`h-5 w-5 ${accent}`} aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#071832]">{value}</p>
    </button>
  );
}

function SectionTitle({ step, title }: { step: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold text-[#8a6400]">{step}</p>
      <h2 className="mt-1 text-xl font-black tracking-normal text-[#071832]">{title}</h2>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-[#071832]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold outline-none focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20" />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-[#071832]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold leading-6 outline-none focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-[#071832]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, prefix, suffix, value, onChange }: { label: string; prefix: string; suffix: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-[#071832]">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:border-[#f6b100] focus-within:ring-2 focus-within:ring-[#f6b100]/20">
        <span className="text-sm font-black text-slate-500">{prefix}</span>
        <input value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} type="number" className="min-w-0 flex-1 text-sm font-black outline-none" />
        <span className="text-sm font-bold text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-3 text-sm font-bold text-[#071832]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#f6b100]" />
      {label}
    </label>
  );
}

function AIComment({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#f3d58a] bg-[#fffdf7] p-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-[#8a6400]" aria-hidden="true" />
        <p className="text-sm font-extrabold text-[#071832]">AI 코멘트</p>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{children}</p>
    </div>
  );
}

function applyQuotesToStrategy(strategy: StrategyItem, quotes: Record<string, PriceData | null | undefined>): StrategyItem {
  return {
    ...strategy,
    composition: strategy.composition.map((holding) => applyQuoteToStrategyHolding(holding, quotes)),
  };
}

function applyQuoteToStrategyHolding(
  holding: StrategyHolding,
  quotes: Record<string, PriceData | null | undefined>
): StrategyHolding {
  if (holding.ticker === "CASH") {
    return { ...holding, price: "0" };
  }
  const quote = formatQuoteDisplay(getQuoteFromMap(quotes, holding.ticker));
  return {
    ...holding,
    price: quote.price,
  };
}

function createEmptyDraft(): StrategyDraft {
  return {
    name: "AI 반도체 선도주 전략",
    description: "반도체·AI 관련 대형주 중심의 성장형 전략입니다.",
    strategyType: "성장형",
    profile: "공격형",
    operationMode: "알림만 받기",
    holdings: recommendedHoldings,
    rebalanceGap: 5,
    profitAlert: 10,
    lossAlert: 5,
    volatilityAlert: 3,
    checkCycle: "매일 (장 마감 후)",
    alertMethod: "앱 알림 + AI 코멘트",
    execution: createDefaultExecutionConfig("basic", "golden_cross"),
  };
}

function createDraftFromStrategy(strategy?: StrategyItem): StrategyDraft {
  if (!strategy) return createEmptyDraft();
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    strategyType: strategy.strategyType,
    profile: strategy.profile,
    operationMode: strategy.operationMode,
    holdings: strategy.composition,
    rebalanceGap: 5,
    profitAlert: strategy.alerts > 0 ? 10 : 8,
    lossAlert: 5,
    volatilityAlert: 3,
    checkCycle: "매일 (장 마감 후)",
    alertMethod: "앱 알림 + AI 코멘트",
    execution: strategy.execution
      ? { ...strategy.execution, builderState: cloneBuilderState(strategy.execution.builderState) }
      : createDefaultExecutionConfig("basic", "golden_cross"),
  };
}

function createStrategyFromDraft(draft: StrategyDraft, previous?: StrategyItem): StrategyItem {
  const targetSummary =
    draft.holdings
      .filter((item) => item.ticker !== "CASH")
      .map((item) => item.name)
      .slice(0, 3)
      .join(", ") || previous?.target || "사용자 구성 종목";

  return {
    id: draft.id || `strategy-${Date.now()}`,
    name: draft.name,
    target: targetSummary,
    status: previous?.status ?? "중지",
    recentRun: previous?.recentRun ?? "-",
    returnRate: previous?.returnRate ?? "0.00%",
    risk: draft.profile === "공격형" ? "높음" : draft.profile === "안정형" ? "낮음" : "보통",
    enabled: previous?.enabled ?? false,
    strategyType: draft.strategyType,
    profile: draft.profile,
    operationMode: draft.operationMode,
    description: draft.description,
    composition: draft.holdings,
    alerts: draft.alertMethod.includes("알림") ? 1 : 0,
    execution: { ...draft.execution, builderState: cloneBuilderState(draft.execution.builderState) },
  };
}

function normalizeWeights(holdings: StrategyHolding[]) {
  const total = holdings.reduce((sum, item) => sum + item.weight, 0);
  if (total === 100 || total <= 0) return holdings;
  return holdings.map((holding, index) => ({
    ...holding,
    weight: index === holdings.length - 1 ? Math.max(0, 100 - holdings.slice(0, -1).reduce((sum, item) => sum + item.weight, 0)) : holding.weight,
  }));
}
