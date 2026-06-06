"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Bookmark, Gauge, Pencil, Play, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { strategyRecommendations } from "@/lib/mockData";

export default function StrategyPage() {
  const toast = useToast();
  const [selectedFilter, setSelectedFilter] = useState("공격형");
  const [selectedId, setSelectedId] = useState(strategyRecommendations[0]?.id ?? "");
  const selected = strategyRecommendations.find((strategy) => strategy.id === selectedId) ?? strategyRecommendations[0];

  return (
    <AppShell screen="strategy">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[#071832]">투자성향 필터</h2>
            <p className="mt-1 text-sm text-slate-500">추천 전략은 저장 전 고객 확인 단계로 넘어갑니다.</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-[#f8fafc] p-1">
            {["안정형", "중립형", "공격형"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`rounded-md px-4 py-2 text-sm font-bold transition focus-ring ${
                  filter === selectedFilter ? "bg-[#071832] text-white" : "text-slate-600 hover:bg-white"
                }`}
                aria-pressed={filter === selectedFilter}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {strategyRecommendations.map((strategy) => (
            <article
              key={strategy.id}
              className={`rounded-lg border p-4 shadow-sm ${
                strategy.id === selected.id ? "border-[#8057ff] bg-white ring-2 ring-[#8057ff]/15" : "border-slate-200 bg-[#f8fafc]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#eef6ff] px-2 py-1 text-xs font-bold text-[#0f4c81]">{strategy.type}</span>
                <button
                  type="button"
                  onClick={() => toast.info(`${strategy.name} 음성 설명을 준비하고 있습니다.`)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff8e1] text-[#8a6400] focus-ring"
                  aria-label={`${strategy.name} 음성으로 듣기`}
                  title="음성 듣기"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <h3 className="mt-3 text-base font-extrabold text-[#071832]">{strategy.name}</h3>
              <p className="mt-2 text-sm leading-5 text-slate-600">{strategy.summary}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Metric label="예상 수익률" value={strategy.expectedReturn} profit />
                <Metric label="위험도" value={strategy.risk} />
                <Metric label="적합도" value={strategy.suitability} />
                <Metric label="기간" value={strategy.period} />
              </dl>
              <Link
                href="#detail"
                onClick={() => setSelectedId(strategy.id)}
                className="mt-4 inline-flex items-center text-sm font-bold text-[#0f4c81] focus-ring"
              >
                자세히 보기
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="detail" className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">전략 요약</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{selected.summary}</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>핵심 요약: AI 산업 성장성과 실적 개선을 함께 추적</li>
            <li>추천 이유: 고성장 테마에 대한 장기 수요 확인</li>
            <li>적용 조건: 변동성 확대 시 분할 진입 우선</li>
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">전략 상세 지표</h2>
          </div>
          <div className="mt-4 space-y-3">
            <Progress label="적합도" value={92} />
            <Progress label="수익 기대" value={86} />
            <Progress label="리스크" value={74} warning />
            <Progress label="실행 편의" value={82} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">백테스트 요약</h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="누적 수익률" value="+56.3%" profit />
            <Metric label="연평균 수익률" value="+16.8%" profit />
            <Metric label="최대 낙폭" value="-15.2%" />
            <Metric label="승률" value="65%" />
          </dl>
          <button
            type="button"
            onClick={() => toast.info(`${selected.name} 백테스트 상세 화면을 준비하고 있습니다.`)}
            className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-ring"
          >
            백테스트 상세 보기
          </button>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <ActionButton icon={Bookmark} label="저장하기" onClick={() => toast.success(`${selected.name} 전략을 저장했습니다.`)} />
        <ActionButton icon={Pencil} label="수정하기" onClick={() => toast.info("전략 수정 화면으로 이동할 준비가 되었습니다.")} />
        <ActionButton icon={Play} label="실행하기" primary onClick={() => toast.warning("실행 전 주문 가능금액과 리스크 확인이 필요합니다.")} />
      </section>
    </AppShell>
  );
}

function Metric({ label, value, profit = false }: { label: string; value: string; profit?: boolean }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 font-extrabold ${profit ? "text-profit" : "text-[#071832]"}`}>{value}</p>
    </div>
  );
}

function Progress({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-extrabold text-[#071832]">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${warning ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  primary = false,
  onClick,
}: {
  icon: typeof Bookmark;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-extrabold transition focus-ring ${
        primary ? "bg-[#f6b100] text-[#071832] hover:bg-[#ffc533]" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
