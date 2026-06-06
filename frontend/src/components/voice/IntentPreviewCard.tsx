"use client";

import { AlertCircle, CheckCircle2, Gauge } from "lucide-react";
import type { LLMIntent } from "@/types/voice";

interface IntentPreviewCardProps {
  intent: LLMIntent | null;
}

export function IntentPreviewCard({ intent }: IntentPreviewCardProps) {
  if (!intent) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        AI 의도 해석 결과가 여기에 표시됩니다.
      </div>
    );
  }

  const confident = intent.confidence >= 0.75 && !intent.need_user_clarification;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AI 의도 해석</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{translateIntent(intent.intent)}</h3>
        </div>
        <div className={`rounded-full p-2 ${confident ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {confident ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="종목" value={intent.symbol_name || intent.symbol_code || "-"} />
        <Field label="방향" value={translateSide(intent.side)} />
        <Field label="수량" value={intent.quantity?.toLocaleString() || "-"} />
        <Field label="금액" value={intent.amount_krw ? `${intent.amount_krw.toLocaleString()}원` : "-"} />
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
        <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-slate-600 dark:text-slate-300">해석 신뢰도</span>
        <span className="ml-auto font-mono font-semibold">{Math.round(intent.confidence * 100)}%</span>
      </div>

      {intent.need_user_clarification && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {intent.clarification_question}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default IntentPreviewCard;

function translateIntent(intent: string) {
  const map: Record<string, string> = {
    create_strategy: "전략 생성/분석",
    create_order_draft: "주문 후보 생성",
    query_account_summary: "계좌 요약 조회",
    explain_strategy: "전략 설명",
    unknown: "알 수 없음",
  };
  return map[intent] || intent;
}

function translateSide(side: string) {
  const map: Record<string, string> = {
    buy: "매수",
    sell: "매도",
    hold: "보류",
    none: "-",
  };
  return map[side] || side;
}
