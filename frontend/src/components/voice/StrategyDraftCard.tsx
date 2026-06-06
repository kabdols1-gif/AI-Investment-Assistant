"use client";

import Link from "next/link";
import { ArrowRight, FileCheck2 } from "lucide-react";
import type { StrategyCard } from "@/types/voice";

interface StrategyDraftCardProps {
  card: StrategyCard | null;
}

export function StrategyDraftCard({ card }: StrategyDraftCardProps) {
  if (!card) return null;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary-bg p-2 text-primary">
          <FileCheck2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">전략 초안</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CodeBlock label="진입 조건" value={card.entry_condition} />
        <CodeBlock label="청산 조건" value={card.exit_condition || { type: "manual_review" }} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {translateStatus(card.status)}
        </span>
        {card.budget_krw && (
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {card.budget_krw.toLocaleString()}원
          </span>
        )}
        <Link
          href="/builder"
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Builder에서 열기
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function CodeBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default StrategyDraftCard;

function translateStatus(status: string) {
  const map: Record<string, string> = {
    draft: "초안",
    validated: "검증됨",
    waiting_confirm: "확인 대기",
    active: "활성",
    rejected: "거절됨",
  };
  return map[status] || status;
}
