"use client";

import { useMemo, useState } from "react";
import { Check, CircleGauge, Layers3, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { ConditionBuilder, IndicatorSelector, RiskManager } from "@/components/builder";
import { getIndicatorById } from "@/lib/builder/constants";
import { PRESET_STRATEGIES } from "@/lib/builder/presets";
import type {
  BuilderCondition,
  BuilderConditionGroup,
  BuilderIndicator,
  BuilderState,
  RiskManagement,
} from "@/types/builder";

export type StrategyExecutionMode = "basic" | "expert";

export type StrategyExecutionConfig = {
  mode: StrategyExecutionMode;
  baseStrategyId: string;
  builderState: BuilderState;
};

type ExpertTab = "indicators" | "entry" | "exit" | "risk";

const fallbackPreset = PRESET_STRATEGIES[0]!;
const expertTabs: { id: ExpertTab; label: string }[] = [
  { id: "indicators", label: "지표" },
  { id: "entry", label: "진입" },
  { id: "exit", label: "청산" },
  { id: "risk", label: "리스크" },
];

export function cloneBuilderState(state: BuilderState): BuilderState {
  return JSON.parse(JSON.stringify(state)) as BuilderState;
}

export function getPresetStrategy(id?: string) {
  return PRESET_STRATEGIES.find((preset) => preset.id === id) ?? fallbackPreset;
}

export function createDefaultExecutionConfig(mode: StrategyExecutionMode = "basic", presetId = fallbackPreset.id): StrategyExecutionConfig {
  const preset = getPresetStrategy(presetId);
  return {
    mode,
    baseStrategyId: preset.id,
    builderState: cloneBuilderState(preset.state),
  };
}

export function getExecutionSummary(config: StrategyExecutionConfig) {
  const preset = getPresetStrategy(config.baseStrategyId);
  const { builderState } = config;
  const enabledRisks = [
    builderState.risk.stopLoss.enabled ? `손절 ${builderState.risk.stopLoss.percent}%` : null,
    builderState.risk.takeProfit.enabled ? `익절 ${builderState.risk.takeProfit.percent}%` : null,
    builderState.risk.trailingStop.enabled ? `트레일링 ${builderState.risk.trailingStop.percent}%` : null,
  ].filter(Boolean);

  return {
    modeLabel: config.mode === "basic" ? "기본모드" : "전문가모드",
    presetName: preset.name,
    presetDescription: preset.description,
    indicatorCount: builderState.indicators.length,
    entryCount: builderState.entry.conditions.length,
    exitCount: builderState.exit.conditions.length,
    riskSummary: enabledRisks.length > 0 ? enabledRisks.join(" · ") : "리스크 조건 없음",
  };
}

export function StrategyExecutionConfigurator({
  value,
  onChange,
}: {
  value: StrategyExecutionConfig;
  onChange: (value: StrategyExecutionConfig) => void;
}) {
  const [activeExpertTab, setActiveExpertTab] = useState<ExpertTab>("indicators");
  const selectedPreset = getPresetStrategy(value.baseStrategyId);
  const summary = useMemo(() => getExecutionSummary(value), [value]);

  const setMode = (mode: StrategyExecutionMode) => {
    onChange({ ...value, mode });
  };

  const applyPreset = (presetId: string) => {
    const preset = getPresetStrategy(presetId);
    onChange({
      ...value,
      baseStrategyId: preset.id,
      builderState: cloneBuilderState(preset.state),
    });
  };

  const updateBuilderState = (nextState: BuilderState) => {
    onChange({ ...value, builderState: nextState });
  };

  const updateIndicators = (indicators: BuilderIndicator[]) => {
    updateBuilderState({ ...value.builderState, indicators });
  };

  const createIndicator = (indicatorId: string, customAlias?: string): BuilderIndicator | null => {
    const definition = getIndicatorById(indicatorId);
    if (!definition) return null;

    const params: Record<string, number | string> = {};
    definition.params.forEach((param) => {
      params[param.name] = param.default;
    });

    const existingAliases = new Set(value.builderState.indicators.map((indicator) => indicator.alias));
    const sameTypeCount = value.builderState.indicators.filter((indicator) => indicator.indicatorId === indicatorId).length;
    const baseAlias = sanitizeAlias(customAlias || `${indicatorId}_${sameTypeCount + 1}`);
    const alias = resolveUniqueAlias(baseAlias, existingAliases);

    return {
      id: `${indicatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      indicatorId,
      alias,
      params,
      output: definition.defaultOutput,
    };
  };

  const addIndicator = (indicator: BuilderIndicator) => {
    updateIndicators([...value.builderState.indicators, indicator]);
  };

  const updateIndicator = (id: string, updates: Partial<BuilderIndicator>) => {
    updateIndicators(
      value.builderState.indicators.map((indicator) =>
        indicator.id === id ? { ...indicator, ...updates } : indicator
      )
    );
  };

  const removeIndicator = (id: string) => {
    const removed = value.builderState.indicators.find((indicator) => indicator.id === id);
    const nextIndicators = value.builderState.indicators.filter((indicator) => indicator.id !== id);
    const nextState = { ...value.builderState, indicators: nextIndicators };

    if (!removed) {
      updateBuilderState(nextState);
      return;
    }

    updateBuilderState({
      ...nextState,
      entry: removeConditionsUsingAlias(nextState.entry, removed.alias),
      exit: removeConditionsUsingAlias(nextState.exit, removed.alias),
    });
  };

  const addEntryCondition = (condition: BuilderCondition) => {
    updateBuilderState({
      ...value.builderState,
      entry: {
        ...value.builderState.entry,
        conditions: [...value.builderState.entry.conditions, condition],
      },
    });
  };

  const addExitCondition = (condition: BuilderCondition) => {
    updateBuilderState({
      ...value.builderState,
      exit: {
        ...value.builderState.exit,
        conditions: [...value.builderState.exit.conditions, condition],
      },
    });
  };

  const updateEntryCondition = (id: string, updates: Partial<BuilderCondition>) => {
    updateBuilderState({
      ...value.builderState,
      entry: {
        ...value.builderState.entry,
        conditions: value.builderState.entry.conditions.map((condition) =>
          condition.id === id ? { ...condition, ...updates } : condition
        ),
      },
    });
  };

  const updateExitCondition = (id: string, updates: Partial<BuilderCondition>) => {
    updateBuilderState({
      ...value.builderState,
      exit: {
        ...value.builderState.exit,
        conditions: value.builderState.exit.conditions.map((condition) =>
          condition.id === id ? { ...condition, ...updates } : condition
        ),
      },
    });
  };

  const removeEntryCondition = (id: string) => {
    updateBuilderState({
      ...value.builderState,
      entry: {
        ...value.builderState.entry,
        conditions: value.builderState.entry.conditions.filter((condition) => condition.id !== id),
      },
    });
  };

  const removeExitCondition = (id: string) => {
    updateBuilderState({
      ...value.builderState,
      exit: {
        ...value.builderState.exit,
        conditions: value.builderState.exit.conditions.filter((condition) => condition.id !== id),
      },
    });
  };

  const setEntryLogic = (logic: "AND" | "OR") => {
    updateBuilderState({
      ...value.builderState,
      entry: { ...value.builderState.entry, logic },
    });
  };

  const setExitLogic = (logic: "AND" | "OR") => {
    updateBuilderState({
      ...value.builderState,
      exit: { ...value.builderState.exit, logic },
    });
  };

  const setRisk = (updates: Partial<RiskManagement>) => {
    updateBuilderState({
      ...value.builderState,
      risk: mergeRisk(value.builderState.risk, updates),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={value.mode === "basic"}
          icon={CircleGauge}
          title="기본모드"
          description="기본 전략과 알림 조건만 빠르게 설정"
          onClick={() => setMode("basic")}
        />
        <ModeButton
          active={value.mode === "expert"}
          icon={SlidersHorizontal}
          title="전문가모드"
          description="지표, 진입, 청산, 리스크까지 상세 설정"
          onClick={() => setMode("expert")}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[#071832]">기본 전략</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{selectedPreset.description}</p>
          </div>
          <span className="rounded-full bg-[#fff7d7] px-3 py-1 text-xs font-extrabold text-[#8a6400]">
            {selectedPreset.category}
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {PRESET_STRATEGIES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              aria-pressed={value.baseStrategyId === preset.id}
              className={`rounded-lg border p-3 text-left transition focus-ring ${
                value.baseStrategyId === preset.id
                  ? "border-[#f6b100] bg-[#fffdf7] ring-2 ring-[#f6b100]/20"
                  : "border-slate-200 bg-[#f8fafc] hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-[#071832]">{preset.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{preset.description}</p>
                </div>
                {value.baseStrategyId === preset.id && <Check className="h-4 w-4 flex-none text-[#8a6400]" aria-hidden="true" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {value.mode === "basic" ? (
        <div className="grid gap-3 md:grid-cols-4">
          <ExecutionStat label="선택 전략" value={summary.presetName} />
          <ExecutionStat label="지표" value={`${summary.indicatorCount}개`} />
          <ExecutionStat label="진입/청산" value={`${summary.entryCount}/${summary.exitCount}개`} />
          <ExecutionStat label="리스크" value={summary.riskSummary} />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {expertTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveExpertTab(tab.id)}
                aria-pressed={activeExpertTab === tab.id}
                className={`rounded-lg px-3 py-2 text-xs font-extrabold transition focus-ring ${
                  activeExpertTab === tab.id ? "bg-[#071832] text-white" : "bg-[#f8fafc] text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeExpertTab === "indicators" && (
            <IndicatorSelector
              selectedIndicators={value.builderState.indicators}
              onAddIndicator={addIndicator}
              onUpdateIndicator={updateIndicator}
              onRemoveIndicator={removeIndicator}
              createIndicator={createIndicator}
            />
          )}
          {activeExpertTab === "entry" && (
            <ConditionBuilder
              title="진입 조건"
              conditionGroup={value.builderState.entry}
              indicators={value.builderState.indicators}
              onAddCondition={addEntryCondition}
              onAddIndicator={addIndicator}
              createIndicator={createIndicator}
              onUpdateCondition={updateEntryCondition}
              onRemoveCondition={removeEntryCondition}
              onReorderConditions={(conditions) => updateBuilderState({ ...value.builderState, entry: { ...value.builderState.entry, conditions } })}
              onSetLogic={setEntryLogic}
            />
          )}
          {activeExpertTab === "exit" && (
            <ConditionBuilder
              title="청산 조건"
              conditionGroup={value.builderState.exit}
              indicators={value.builderState.indicators}
              onAddCondition={addExitCondition}
              onAddIndicator={addIndicator}
              createIndicator={createIndicator}
              onUpdateCondition={updateExitCondition}
              onRemoveCondition={removeExitCondition}
              onReorderConditions={(conditions) => updateBuilderState({ ...value.builderState, exit: { ...value.builderState.exit, conditions } })}
              onSetLogic={setExitLogic}
            />
          )}
          {activeExpertTab === "risk" && <RiskManager risk={value.builderState.risk} onChange={setRisk} />}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof Layers3;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border p-4 text-left transition focus-ring ${
        active ? "border-[#f6b100] bg-[#fffdf7] ring-2 ring-[#f6b100]/20" : "border-slate-200 bg-white hover:bg-[#f8fafc]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${active ? "bg-[#f6b100] text-[#071832]" : "bg-slate-100 text-slate-500"}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-extrabold text-[#071832]">{title}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{description}</span>
        </span>
      </div>
    </button>
  );
}

function ExecutionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#8a6400]" aria-hidden="true" />
        <p className="text-xs font-bold text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-sm font-black text-[#071832]">{value}</p>
    </div>
  );
}

function sanitizeAlias(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^([^a-z_])/, "_$1")
    .replace(/_+/g, "_");
  return sanitized || "indicator_1";
}

function resolveUniqueAlias(baseAlias: string, existingAliases: Set<string>) {
  if (!existingAliases.has(baseAlias)) return baseAlias;

  let index = 2;
  while (existingAliases.has(`${baseAlias}_${index}`)) {
    index += 1;
  }
  return `${baseAlias}_${index}`;
}

function removeConditionsUsingAlias(group: BuilderConditionGroup, alias: string): BuilderConditionGroup {
  return {
    ...group,
    conditions: group.conditions.filter((condition) => {
      const usesLeft = condition.left.indicatorAlias === alias;
      const usesRight = condition.right.indicatorAlias === alias;
      const usesCandlestick = condition.candlestickAlias === alias;
      return !usesLeft && !usesRight && !usesCandlestick;
    }),
  };
}

function mergeRisk(current: RiskManagement, updates: Partial<RiskManagement>): RiskManagement {
  return {
    stopLoss: updates.stopLoss ? { ...current.stopLoss, ...updates.stopLoss } : current.stopLoss,
    takeProfit: updates.takeProfit ? { ...current.takeProfit, ...updates.takeProfit } : current.takeProfit,
    trailingStop: updates.trailingStop ? { ...current.trailingStop, ...updates.trailingStop } : current.trailingStop,
  };
}
