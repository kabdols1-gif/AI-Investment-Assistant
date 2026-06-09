"use client";

import { Activity, BarChart3, Bell, Gauge, LineChart, PauseCircle, Pencil, PlayCircle, Plus, Save, Search, ShieldCheck, SlidersHorizontal, Target, Trash2, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { getIndicatorById } from "@/lib/builder/constants";
import { PRESET_STRATEGIES } from "@/lib/builder/presets";
import { myStrategies } from "@/lib/mockData";
import type { BuilderCondition, BuilderConditionGroup, BuilderIndicator, BuilderState, ConditionOperand, ConditionOperator, RiskManagement } from "@/types/builder";

type StrategyStatusFilter = "전체 전략" | "실행중" | "중지" | "알림 필요";
type StrategyType = "성장형" | "배당형" | "방어형" | "단기매매";
type InvestmentProfile = "안정형" | "중립형" | "공격형";
type OperationMode = "알림만 받기" | "수동 실행" | "자동 실행 검토";
type ConditionMode = "basic" | "expert";

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
  conditionMode: ConditionMode;
  expertBuilder: BuilderState;
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
  conditionMode: ConditionMode;
  expertBuilder: BuilderState;
};
type StrategyWizardMode = "create" | "edit";

const recommendedHoldings: StrategyHolding[] = [
  { name: "삼성전자", ticker: "005930", price: "66,200", weight: 40 },
  { name: "SK하이닉스", ticker: "000660", price: "193,500", weight: 35 },
  { name: "현금성", ticker: "CASH", price: "-", weight: 25 },
];

const DEFAULT_PRESET_ID = "golden_cross";
const expertIndicatorIds = ["sma", "ema", "rsi", "macd", "bollinger", "stochastic", "atr", "roc"];
const priceOperandOptions = [
  { value: "price:close", label: "종가" },
  { value: "price:open", label: "시가" },
  { value: "price:high", label: "고가" },
  { value: "price:low", label: "저가" },
];
const conditionOperatorOptions: { value: ConditionOperator; label: string }[] = [
  { value: "cross_above", label: "상향돌파 할 때" },
  { value: "cross_below", label: "하향돌파 할 때" },
  { value: "greater_than", label: "보다 클 때" },
  { value: "less_than", label: "보다 작을 때" },
  { value: "greater_equal", label: "이상일 때" },
  { value: "less_equal", label: "이하일 때" },
  { value: "equals", label: "같을 때" },
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
          { name: "고배당 종목", ticker: "DIV", price: "-", weight: 40 },
          { name: "실적 안정주", ticker: "CORE", price: "-", weight: 35 },
          { name: "현금성", ticker: "CASH", price: "-", weight: 25 },
        ]
      : index === 1
        ? recommendedHoldings
        : [
            { name: "KOSPI200 과매도", ticker: "K200", price: "-", weight: 55 },
            { name: "현금성", ticker: "CASH", price: "-", weight: 45 },
          ],
  alerts: index === 1 ? 1 : 0,
  conditionMode: "basic",
  expertBuilder: createExpertBuilder(DEFAULT_PRESET_ID),
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

  const filteredStrategies = useMemo(
    () =>
      strategies.filter((strategy) => {
        if (activeFilter === "전체 전략") return true;
        if (activeFilter === "실행중") return strategy.enabled;
        if (activeFilter === "중지") return !strategy.enabled;
        return strategy.alerts > 0;
      }),
    [activeFilter, strategies]
  );
  const runningCount = strategies.filter((strategy) => strategy.enabled).length;
  const pausedCount = strategies.length - runningCount;
  const alertCount = strategies.reduce((sum, strategy) => sum + strategy.alerts, 0);
  const selectedStrategy = strategies.find((strategy) => strategy.id === selectedStrategyId) ?? strategies[0];

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
    const normalizedDraft = {
      ...draft,
      name: nextName,
      description: draft.description.trim() || "사용자 조건 기반 투자전략입니다.",
      holdings: normalizeWeights(draft.holdings),
      expertBuilder: syncExpertBuilderMetadata(draft.expertBuilder, nextName, draft.description.trim() || "사용자 조건 기반 투자전략입니다."),
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
  activeStep,
  onClose,
  onDraftChange,
  onStepChange,
  onSave,
}: {
  mode: StrategyWizardMode;
  draft: StrategyDraft;
  activeStep: number;
  onClose: () => void;
  onDraftChange: (draft: StrategyDraft) => void;
  onStepChange: (step: number) => void;
  onSave: () => void;
}) {
  const totalWeight = draft.holdings.reduce((sum, item) => sum + item.weight, 0);
  const isEditMode = mode === "edit";

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
                  {recommendedHoldings.map((holding) => (
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
                      {draft.holdings.map((holding, index) => (
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
            <ExecutionConditionStep draft={draft} onDraftChange={onDraftChange} />
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
                  ["조건 모드", draft.conditionMode === "expert" ? "전문가 모드" : "기본 모드"],
                  ...(draft.conditionMode === "expert"
                    ? [
                        ["기본 전략", draft.expertBuilder.metadata.name || "-"],
                        ["전문가 조건", getExpertBuilderSummary(draft.expertBuilder)],
                      ]
                    : []),
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
              {draft.conditionMode === "expert" ? (
                <>
                  <li>모드: 전문가</li>
                  <li>기본 전략: {draft.expertBuilder.metadata.name}</li>
                  <li>지표: {draft.expertBuilder.indicators.length}개</li>
                  <li>진입/청산: {draft.expertBuilder.entry.conditions.length}/{draft.expertBuilder.exit.conditions.length}개</li>
                  <li>리스크: {getRiskSummary(draft.expertBuilder.risk)}</li>
                </>
              ) : (
                <>
                  <li>모드: 기본</li>
                  <li>리밸런싱: ±{draft.rebalanceGap}%</li>
                  <li>수익 알림: +{draft.profitAlert}%</li>
                  <li>손실 알림: -{draft.lossAlert}%</li>
                  <li>종목 변동: ±{draft.volatilityAlert}%</li>
                  <li>점검 주기: {draft.checkCycle}</li>
                </>
              )}
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

function ExecutionConditionStep({ draft, onDraftChange }: { draft: StrategyDraft; onDraftChange: (draft: StrategyDraft) => void }) {
  const setConditionMode = (conditionMode: ConditionMode) => {
    onDraftChange({
      ...draft,
      conditionMode,
      expertBuilder: draft.expertBuilder || createExpertBuilder(DEFAULT_PRESET_ID),
    });
  };

  const updateExpertBuilder = (expertBuilder: BuilderState) => {
    onDraftChange({ ...draft, conditionMode: "expert", expertBuilder });
  };

  return (
    <div className="space-y-4">
      <SectionTitle step="3단계" title="실행 조건" />
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] p-1">
        <button
          type="button"
          onClick={() => setConditionMode("basic")}
          aria-pressed={draft.conditionMode === "basic"}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-extrabold transition focus-ring ${
            draft.conditionMode === "basic" ? "bg-white text-[#071832] shadow-sm" : "text-slate-500 hover:bg-white/70"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          기본 모드
        </button>
        <button
          type="button"
          onClick={() => setConditionMode("expert")}
          aria-pressed={draft.conditionMode === "expert"}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-extrabold transition focus-ring ${
            draft.conditionMode === "expert" ? "bg-[#071832] text-white shadow-sm" : "text-slate-500 hover:bg-white/70"
          }`}
        >
          <Gauge className="h-4 w-4" aria-hidden="true" />
          전문가 모드
        </button>
      </div>

      {draft.conditionMode === "expert" ? (
        <ExpertConditionEditor builder={draft.expertBuilder} onChange={updateExpertBuilder} />
      ) : (
        <BasicConditionEditor draft={draft} onDraftChange={onDraftChange} />
      )}
    </div>
  );
}

function BasicConditionEditor({ draft, onDraftChange }: { draft: StrategyDraft; onDraftChange: (draft: StrategyDraft) => void }) {
  return (
    <div className="space-y-4">
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
  );
}

function ExpertConditionEditor({ builder, onChange }: { builder: BuilderState; onChange: (builder: BuilderState) => void }) {
  const selectedPreset = PRESET_STRATEGIES.find((preset) => preset.state.metadata.id === builder.metadata.id) ?? PRESET_STRATEGIES[0];

  const selectPreset = (presetId: string) => {
    onChange(createExpertBuilder(presetId));
  };

  const addIndicator = (indicatorId: string) => {
    const indicator = createExpertIndicator(indicatorId, builder.indicators);
    if (!indicator) return;
    onChange({ ...builder, indicators: [...builder.indicators, indicator] });
  };

  const updateIndicator = (id: string, updates: Partial<BuilderIndicator>) => {
    onChange({
      ...builder,
      indicators: builder.indicators.map((indicator) => (indicator.id === id ? { ...indicator, ...updates } : indicator)),
    });
  };

  const removeIndicator = (id: string) => {
    const removed = builder.indicators.find((indicator) => indicator.id === id);
    if (!removed) return;
    onChange({
      ...builder,
      indicators: builder.indicators.filter((indicator) => indicator.id !== id),
      entry: removeConditionsUsingAlias(builder.entry, removed.alias),
      exit: removeConditionsUsingAlias(builder.exit, removed.alias),
    });
  };

  const updateConditionGroup = (side: "entry" | "exit", conditionGroup: BuilderConditionGroup) => {
    onChange({ ...builder, [side]: conditionGroup });
  };

  const updateRisk = (risk: RiskManagement) => {
    onChange({ ...builder, risk });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-extrabold text-[#071832]">기본 전략 선택</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {PRESET_STRATEGIES.map((preset) => {
            const active = selectedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                aria-pressed={active}
                className={`rounded-lg border p-3 text-left transition focus-ring ${
                  active ? "border-[#f6b100] bg-[#fffdf7] ring-2 ring-[#f6b100]/20" : "border-slate-200 bg-white hover:border-[#f3d58a]"
                }`}
              >
                <p className="text-sm font-extrabold text-[#071832]">{preset.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{preset.category}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <ExpertIndicatorsPanel builder={builder} onAdd={addIndicator} onUpdate={updateIndicator} onRemove={removeIndicator} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ConditionGroupEditor
          title="진입 조건"
          icon={<Target className="h-4 w-4" aria-hidden="true" />}
          side="entry"
          builder={builder}
          conditionGroup={builder.entry}
          onChange={(conditionGroup) => updateConditionGroup("entry", conditionGroup)}
          onBuilderChange={onChange}
        />
        <ConditionGroupEditor
          title="청산 조건"
          icon={<LineChart className="h-4 w-4" aria-hidden="true" />}
          side="exit"
          builder={builder}
          conditionGroup={builder.exit}
          onChange={(conditionGroup) => updateConditionGroup("exit", conditionGroup)}
          onBuilderChange={onChange}
        />
      </div>

      <ExpertRiskPanel risk={builder.risk} onChange={updateRisk} />

      <AIComment>
        전문가 모드는 기술적 지표와 매매 조건을 직접 다루는 구조입니다. 확신이 없으면 기본 전략을 선택한 뒤 리스크 값만 조정해도 충분합니다.
      </AIComment>
    </div>
  );
}

function ExpertIndicatorsPanel({
  builder,
  onAdd,
  onUpdate,
  onRemove,
}: {
  builder: BuilderState;
  onAdd: (indicatorId: string) => void;
  onUpdate: (id: string, updates: Partial<BuilderIndicator>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#071832]">지표</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">자주 쓰는 지표를 추가하고 기간 값을 조정합니다.</p>
        </div>
        <span className="rounded-full bg-[#eff6ff] px-2 py-1 text-xs font-black text-blue-700">{builder.indicators.length}개</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {expertIndicatorIds.map((indicatorId) => {
          const definition = getIndicatorById(indicatorId);
          if (!definition) return null;
          return (
            <button
              key={indicatorId}
              type="button"
              onClick={() => onAdd(indicatorId)}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 text-xs font-extrabold text-[#071832] transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {definition.nameKo}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {builder.indicators.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-[#f8fafc] px-4 py-6 text-center text-sm font-bold text-slate-500">
            선택된 지표가 없습니다. 위 버튼으로 지표를 추가하세요.
          </div>
        ) : (
          builder.indicators.map((indicator) => {
            const definition = getIndicatorById(indicator.indicatorId);
            const primaryParam = definition?.params[0];
            return (
              <div key={indicator.id} className="grid gap-3 rounded-lg border border-slate-200 bg-[#f8fafc] p-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_36px] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#071832]">{definition?.nameKo ?? indicator.indicatorId}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{indicator.alias}</p>
                </div>
                {primaryParam ? (
                  <label className="min-w-0">
                    <span className="sr-only">{primaryParam.name}</span>
                    <input
                      type={primaryParam.type === "number" ? "number" : "text"}
                      value={indicator.params[primaryParam.name] ?? primaryParam.default}
                      min={primaryParam.min}
                      max={primaryParam.max}
                      step={primaryParam.step}
                      onChange={(event) =>
                        onUpdate(indicator.id, {
                          params: {
                            ...indicator.params,
                            [primaryParam.name]: primaryParam.type === "number" ? Number(event.target.value) || 0 : event.target.value,
                          },
                        })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#f6b100]"
                    />
                  </label>
                ) : (
                  <span className="text-xs font-bold text-slate-400">기본값</span>
                )}
                <select
                  value={indicator.output}
                  onChange={(event) => onUpdate(indicator.id, { output: event.target.value })}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#f6b100]"
                  aria-label={`${definition?.nameKo ?? indicator.indicatorId} 출력값`}
                >
                  {(definition?.outputs.length ? definition.outputs : [{ id: "value", name: "값" }]).map((output) => (
                    <option key={output.id} value={output.id}>
                      {output.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemove(indicator.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 focus-ring"
                  aria-label={`${definition?.nameKo ?? indicator.indicatorId} 지표 제거`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function ConditionGroupEditor({
  title,
  icon,
  side,
  builder,
  conditionGroup,
  onChange,
  onBuilderChange,
}: {
  title: string;
  icon: ReactNode;
  side: "entry" | "exit";
  builder: BuilderState;
  conditionGroup: BuilderConditionGroup;
  onChange: (conditionGroup: BuilderConditionGroup) => void;
  onBuilderChange: (builder: BuilderState) => void;
}) {
  const addCondition = (mode: "quick" | "manual") => {
    if (mode === "quick") {
      const next = addQuickExpertCondition(builder, side);
      onBuilderChange(next);
      return;
    }
    onChange({ ...conditionGroup, conditions: [...conditionGroup.conditions, createDefaultCondition(builder.indicators)] });
  };

  const updateCondition = (id: string, updates: Partial<BuilderCondition>) => {
    onChange({
      ...conditionGroup,
      conditions: conditionGroup.conditions.map((condition) => (condition.id === id ? { ...condition, ...updates } : condition)),
    });
  };

  const removeCondition = (id: string) => {
    onChange({ ...conditionGroup, conditions: conditionGroup.conditions.filter((condition) => condition.id !== id) });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#8a6400]">{icon}</span>
          <h3 className="text-sm font-extrabold text-[#071832]">{title}</h3>
          <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-black text-blue-700">{conditionGroup.conditions.length}</span>
        </div>
        <select
          value={conditionGroup.logic}
          onChange={(event) => onChange({ ...conditionGroup, logic: event.target.value as "AND" | "OR" })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#071832] outline-none focus:border-[#f6b100]"
          aria-label={`${title} 논리 연산자`}
        >
          <option value="AND">AND 모두 충족</option>
          <option value="OR">OR 하나 이상</option>
        </select>
      </div>

      <div className="mt-3 space-y-3">
        {conditionGroup.conditions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-[#f8fafc] px-4 py-6 text-center text-sm font-bold text-slate-500">
            조건이 없습니다.
          </div>
        ) : (
          conditionGroup.conditions.map((condition, index) => (
            <ConditionRow key={condition.id} index={index} condition={condition} indicators={builder.indicators} onChange={(updates) => updateCondition(condition.id, updates)} onRemove={() => removeCondition(condition.id)} />
          ))
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => addCondition("quick")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-3 text-sm font-extrabold text-slate-700 transition hover:bg-white focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          빠른 추가
        </button>
        <button
          type="button"
          onClick={() => addCondition("manual")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 transition hover:bg-[#f8fafc] focus-ring"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          직접 추가
        </button>
      </div>
    </section>
  );
}

function ConditionRow({
  index,
  condition,
  indicators,
  onChange,
  onRemove,
}: {
  index: number;
  condition: BuilderCondition;
  indicators: BuilderIndicator[];
  onChange: (updates: Partial<BuilderCondition>) => void;
  onRemove: () => void;
}) {
  const operandOptions = getOperandOptions(indicators);
  const rightIsValue = condition.right.type === "value";

  return (
    <div className="rounded-lg border border-slate-200 bg-[#f8fafc] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-slate-500">조건 {index + 1}</span>
        <button type="button" onClick={onRemove} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 focus-ring" aria-label={`조건 ${index + 1} 삭제`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid gap-2 lg:grid-cols-[1fr_1.1fr_1fr]">
        <select
          value={operandToSelectValue(condition.left)}
          onChange={(event) => onChange({ left: selectValueToOperand(event.target.value) })}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#f6b100]"
          aria-label={`조건 ${index + 1} 왼쪽 값`}
        >
          {operandOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={condition.operator}
          onChange={(event) => onChange({ operator: event.target.value as ConditionOperator })}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-blue-700 outline-none focus:border-[#f6b100]"
          aria-label={`조건 ${index + 1} 연산자`}
        >
          {conditionOperatorOptions.map((operator) => (
            <option key={operator.value} value={operator.value}>{operator.label}</option>
          ))}
        </select>
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <select
            value={rightIsValue ? "value" : operandToSelectValue(condition.right)}
            onChange={(event) => onChange({ right: event.target.value === "value" ? { type: "value", value: 30 } : selectValueToOperand(event.target.value) })}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-[#f6b100]"
            aria-label={`조건 ${index + 1} 오른쪽 값 종류`}
          >
            {operandOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
            <option value="value">직접 숫자</option>
          </select>
          <input
            type="number"
            value={condition.right.type === "value" ? condition.right.value ?? 0 : ""}
            onChange={(event) => onChange({ right: { type: "value", value: Number(event.target.value) || 0 } })}
            disabled={!rightIsValue}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-right text-sm font-black outline-none focus:border-[#f6b100] disabled:bg-slate-100 disabled:text-slate-300"
            aria-label={`조건 ${index + 1} 숫자 값`}
          />
        </div>
      </div>
    </div>
  );
}

function ExpertRiskPanel({ risk, onChange }: { risk: RiskManagement; onChange: (risk: RiskManagement) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#8a6400]" aria-hidden="true" />
        <h3 className="text-sm font-extrabold text-[#071832]">리스크</h3>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <RiskRuleCard
          title="손절"
          description="손실이 설정값에 도달하면 자동 청산"
          enabled={risk.stopLoss.enabled}
          percent={risk.stopLoss.percent}
          tone="red"
          onChange={(stopLoss) => onChange({ ...risk, stopLoss })}
        />
        <RiskRuleCard
          title="익절"
          description="수익이 설정값에 도달하면 자동 청산"
          enabled={risk.takeProfit.enabled}
          percent={risk.takeProfit.percent}
          tone="emerald"
          onChange={(takeProfit) => onChange({ ...risk, takeProfit })}
        />
        <RiskRuleCard
          title="트레일링 스탑"
          description="고점 대비 하락률 기준으로 청산"
          enabled={risk.trailingStop.enabled}
          percent={risk.trailingStop.percent}
          tone="blue"
          onChange={(trailingStop) => onChange({ ...risk, trailingStop })}
        />
      </div>
    </section>
  );
}

function RiskRuleCard({
  title,
  description,
  enabled,
  percent,
  tone,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  percent: number;
  tone: "red" | "emerald" | "blue";
  onChange: (value: { enabled: boolean; percent: number }) => void;
}) {
  const toneClass = {
    red: enabled ? "border-red-200 bg-red-50" : "border-slate-200 bg-[#f8fafc]",
    emerald: enabled ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-[#f8fafc]",
    blue: enabled ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-[#f8fafc]",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#071832]">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</p>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange({ enabled: event.target.checked, percent })}
          className="toggle-switch"
          role="switch"
          aria-label={`${title} 사용`}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={50}
          step={0.5}
          value={percent}
          onChange={(event) => onChange({ enabled, percent: Number(event.target.value) || 0 })}
          disabled={!enabled}
          className="min-w-0 flex-1"
          aria-label={`${title} 퍼센트`}
        />
        <input
          type="number"
          value={percent}
          onChange={(event) => onChange({ enabled, percent: Number(event.target.value) || 0 })}
          disabled={!enabled}
          className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-black outline-none focus:border-[#f6b100] disabled:bg-slate-100 disabled:text-slate-300"
          aria-label={`${title} 퍼센트 입력`}
        />
        <span className="text-sm font-bold text-slate-500">%</span>
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

function createExpertBuilder(presetId = DEFAULT_PRESET_ID): BuilderState {
  const preset = PRESET_STRATEGIES.find((item) => item.id === presetId) ?? PRESET_STRATEGIES[0];
  return cloneBuilderState(preset.state);
}

function cloneBuilderState(state: BuilderState): BuilderState {
  return JSON.parse(JSON.stringify(state)) as BuilderState;
}

function syncExpertBuilderMetadata(builder: BuilderState, name: string, description: string): BuilderState {
  return {
    ...cloneBuilderState(builder),
    metadata: {
      ...builder.metadata,
      name,
      description,
    },
  };
}

function createExpertIndicator(indicatorId: string, existingIndicators: BuilderIndicator[]): BuilderIndicator | null {
  const definition = getIndicatorById(indicatorId);
  if (!definition) return null;
  const existingCount = existingIndicators.filter((indicator) => indicator.indicatorId === indicatorId).length;
  const alias = getUniqueAlias(`${indicatorId}_${existingCount + 1}`, existingIndicators);

  return {
    id: `${indicatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    indicatorId,
    alias,
    params: Object.fromEntries(definition.params.map((param) => [param.name, param.default])),
    output: definition.defaultOutput,
  };
}

function getUniqueAlias(baseAlias: string, indicators: BuilderIndicator[]) {
  const aliases = new Set(indicators.map((indicator) => indicator.alias));
  if (!aliases.has(baseAlias)) return baseAlias;
  let index = 2;
  while (aliases.has(`${baseAlias}_${index}`)) {
    index += 1;
  }
  return `${baseAlias}_${index}`;
}

function removeConditionsUsingAlias(conditionGroup: BuilderConditionGroup, alias: string): BuilderConditionGroup {
  return {
    ...conditionGroup,
    conditions: conditionGroup.conditions.filter((condition) => condition.left.indicatorAlias !== alias && condition.right.indicatorAlias !== alias),
  };
}

function createDefaultCondition(indicators: BuilderIndicator[]): BuilderCondition {
  const first = indicators[0];
  const second = indicators[1];
  return {
    id: `condition_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    left: first ? { type: "indicator", indicatorAlias: first.alias, indicatorOutput: first.output || "value" } : { type: "price", priceField: "close" },
    operator: second ? "cross_above" : "greater_than",
    right: second ? { type: "indicator", indicatorAlias: second.alias, indicatorOutput: second.output || "value" } : { type: "value", value: 30 },
  };
}

function addQuickExpertCondition(builder: BuilderState, side: "entry" | "exit"): BuilderState {
  const hasRsi = builder.indicators.some((indicator) => indicator.indicatorId === "rsi");
  const rsiIndicator = builder.indicators.find((indicator) => indicator.indicatorId === "rsi") ?? createExpertIndicator("rsi", builder.indicators);
  if (!rsiIndicator) return builder;

  const indicators = hasRsi ? builder.indicators : [...builder.indicators, rsiIndicator];
  const condition: BuilderCondition = {
    id: `quick_${side}_${Date.now()}`,
    left: { type: "indicator", indicatorAlias: rsiIndicator.alias, indicatorOutput: rsiIndicator.output || "value" },
    operator: side === "entry" ? "less_than" : "greater_than",
    right: { type: "value", value: side === "entry" ? 30 : 70 },
  };
  const conditionGroup = builder[side];

  return {
    ...builder,
    indicators,
    [side]: {
      ...conditionGroup,
      conditions: [...conditionGroup.conditions, condition],
    },
  };
}

function getOperandOptions(indicators: BuilderIndicator[]) {
  return [
    ...priceOperandOptions,
    ...indicators.map((indicator) => {
      const definition = getIndicatorById(indicator.indicatorId);
      return {
        value: `indicator:${indicator.alias}`,
        label: `${definition?.nameKo ?? indicator.indicatorId} (${indicator.alias})`,
      };
    }),
  ];
}

function operandToSelectValue(operand: ConditionOperand): string {
  if (operand.type === "price") return `price:${operand.priceField ?? "close"}`;
  if (operand.type === "indicator") return `indicator:${operand.indicatorAlias ?? ""}`;
  return "value";
}

function selectValueToOperand(value: string): ConditionOperand {
  if (value.startsWith("price:")) {
    return { type: "price", priceField: value.replace("price:", "") as "close" | "open" | "high" | "low" };
  }
  if (value.startsWith("indicator:")) {
    return { type: "indicator", indicatorAlias: value.replace("indicator:", ""), indicatorOutput: "value" };
  }
  return { type: "value", value: 0 };
}

function getExpertBuilderSummary(builder: BuilderState) {
  return `지표 ${builder.indicators.length}개 · 진입 ${builder.entry.conditions.length}개 · 청산 ${builder.exit.conditions.length}개 · ${getRiskSummary(builder.risk)}`;
}

function getRiskSummary(risk: RiskManagement) {
  const enabledRules = [
    risk.stopLoss.enabled ? `손절 ${risk.stopLoss.percent}%` : null,
    risk.takeProfit.enabled ? `익절 ${risk.takeProfit.percent}%` : null,
    risk.trailingStop.enabled ? `트레일링 ${risk.trailingStop.percent}%` : null,
  ].filter(Boolean);
  return enabledRules.length ? enabledRules.join(", ") : "리스크 조건 없음";
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
    conditionMode: "basic",
    expertBuilder: createExpertBuilder(DEFAULT_PRESET_ID),
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
    conditionMode: strategy.conditionMode ?? "basic",
    expertBuilder: strategy.expertBuilder ? cloneBuilderState(strategy.expertBuilder) : createExpertBuilder(DEFAULT_PRESET_ID),
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
    conditionMode: draft.conditionMode,
    expertBuilder: cloneBuilderState(draft.expertBuilder),
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
