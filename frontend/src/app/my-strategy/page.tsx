"use client";

import { Activity, BarChart3, PauseCircle, PlayCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { myStrategies } from "@/lib/mockData";

type StrategyStatusFilter = "전체 전략" | "실행중" | "중지" | "알림 필요";
type StrategyItem = (typeof myStrategies)[number] & {
  composition: string[];
  alerts: number;
};

const initialStrategies: StrategyItem[] = myStrategies.map((strategy, index) => ({
  ...strategy,
  status: strategy.enabled ? "실행중" : "중지",
  composition:
    index === 0
      ? ["고배당 종목 40%", "실적 안정주 35%", "현금성 25%"]
      : index === 1
        ? ["삼성전자 45%", "SK하이닉스 35%", "반도체 ETF 20%"]
        : ["KOSPI200 과매도 종목", "RSI 30 이하", "3일 반등 확인"],
  alerts: index === 1 ? 1 : 0,
}));

export default function MyStrategyPage() {
  const toast = useToast();
  const [strategies, setStrategies] = useState<StrategyItem[]>(initialStrategies);
  const [activeFilter, setActiveFilter] = useState<StrategyStatusFilter>("전체 전략");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState("");
  const [newStrategyTarget, setNewStrategyTarget] = useState("");

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
    setStrategies((current) => current.filter((item) => item.id !== id));
    toast.success("전략을 삭제했습니다.");
  };

  const addStrategy = () => {
    const name = newStrategyName.trim();
    const target = newStrategyTarget.trim();
    if (!name || !target) {
      toast.warning("전략명과 투자대상을 입력해 주세요.");
      return;
    }
    setStrategies((current) => [
      {
        id: `custom-${Date.now()}`,
        name,
        target,
        status: "중지",
        recentRun: "-",
        returnRate: "0.00%",
        risk: "보통",
        enabled: false,
        composition: ["사용자 조건 기반", "리스크 한도 10%", "알림 후 수동 실행"],
        alerts: 0,
      },
      ...current,
    ]);
    setNewStrategyName("");
    setNewStrategyTarget("");
    setIsAddOpen(false);
    toast.success("신규 전략을 추가했습니다.");
  };

  return (
    <AppShell screen="my-strategy">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="전체 전략" value={`${strategies.length}개`} icon={BarChart3} active={activeFilter === "전체 전략"} onClick={() => setActiveFilter("전체 전략")} />
        <SummaryCard label="실행중" value={`${runningCount}개`} icon={PlayCircle} accent="text-emerald-600" active={activeFilter === "실행중"} onClick={() => setActiveFilter("실행중")} />
        <SummaryCard label="중지" value={`${pausedCount}개`} icon={PauseCircle} accent="text-slate-500" active={activeFilter === "중지"} onClick={() => setActiveFilter("중지")} />
        <SummaryCard label="알림 필요" value={`${alertCount}건`} icon={Activity} accent="text-amber-600" active={activeFilter === "알림 필요"} onClick={() => setActiveFilter("알림 필요")} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#071832]">내 전략 리스트</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">선택 필터: {activeFilter}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen((open) => !open)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f6b100] px-4 text-sm font-extrabold text-[#071832] transition hover:bg-[#e0a000] focus-ring"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              신규 전략 추가
            </button>
          </div>

          {isAddOpen && (
            <div className="mb-4 grid gap-3 rounded-lg border border-[#f3d58a] bg-[#fffdf7] p-4 sm:grid-cols-[1fr_1fr_auto]">
              <input value={newStrategyName} onChange={(event) => setNewStrategyName(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f6b100]" placeholder="전략명" />
              <input value={newStrategyTarget} onChange={(event) => setNewStrategyTarget(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f6b100]" placeholder="투자대상" />
              <button type="button" onClick={addStrategy} className="rounded-lg bg-[#071832] px-4 py-2 text-sm font-extrabold text-white focus-ring">
                추가
              </button>
            </div>
          )}

          <div className="space-y-3">
            {filteredStrategies.map((strategy) => (
              <article key={strategy.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-[#071832]">{strategy.name}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${strategy.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {strategy.enabled ? "실행중" : "중지"}
                      </span>
                      {strategy.alerts > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">알림 {strategy.alerts}</span>}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-600">{strategy.target}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {strategy.composition.map((item) => (
                        <span key={item} className="rounded-full bg-[#f8fafc] px-3 py-1 text-xs font-bold text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-none flex-wrap items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-500">수익률</p>
                      <p className={`mt-1 text-lg font-extrabold ${strategy.returnRate.startsWith("-") ? "text-loss" : "text-profit"}`}>{strategy.returnRate}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input type="checkbox" checked={strategy.enabled} onChange={() => toggleStrategy(strategy.id)} className="toggle-switch" />
                      ON/OFF
                    </label>
                    <button type="button" onClick={() => deleteStrategy(strategy.id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50 focus-ring" aria-label={`${strategy.name} 삭제`}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-[#f3d58a] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[#071832]">AI 코멘트</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">실행중 전략은 {runningCount}개입니다. 알림 필요 전략은 조건을 확인한 뒤 비중 또는 손절 기준을 조정해 보세요.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-extrabold text-[#071832]">전략 성과 요약</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Score label="누적 수익률" value="+12.8%" />
              <Score label="최대 손실" value="-5.4%" tone="loss" />
              <Score label="승률" value="64%" />
              <Score label="평균 보유" value="18일" tone="neutral" />
            </dl>
          </div>
        </aside>
      </section>
    </AppShell>
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

function Score({ label, value, tone }: { label: string; value: string; tone?: "loss" | "neutral" }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tone === "loss" ? "text-loss" : tone === "neutral" ? "text-[#071832]" : "text-profit"}`}>{value}</p>
    </div>
  );
}
