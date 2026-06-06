"use client";

import { CheckCircle2, ClipboardList } from "lucide-react";
import type { OrderProposal } from "@/types/voice";
import { RiskWarningPanel } from "./RiskWarningPanel";

interface OrderProposalCardProps {
  proposal: OrderProposal | null;
  onConfirm: () => void;
}

export function OrderProposalCard({ proposal, onConfirm }: OrderProposalCardProps) {
  if (!proposal) return null;

  const sideClass =
    proposal.side === "buy"
      ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
      : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary-bg p-2 text-primary">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">주문 후보</p>
          <h3 className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
            {proposal.symbol_name} <span className="font-mono text-sm text-slate-500">{proposal.symbol_code}</span>
          </h3>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${sideClass}`}>{proposal.side}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Metric label="주문유형" value={translateOrderType(proposal.order_type)} />
        <Metric label="수량" value={proposal.quantity?.toLocaleString() || "-"} />
        <Metric label="금액" value={proposal.amount_krw ? `${proposal.amount_krw.toLocaleString()}원` : "-"} />
        <Metric label="모드" value={translateMode(proposal.mode)} />
      </div>

      {proposal.condition && (
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">조건</p>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200">
            {JSON.stringify(proposal.condition, null, 2)}
          </pre>
        </div>
      )}

      <RiskWarningPanel warnings={proposal.risk_warnings} />

      <button
        onClick={onConfirm}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-dark"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        최종 확인하기
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default OrderProposalCard;

function translateOrderType(type: string) {
  const map: Record<string, string> = {
    market: "시장가",
    limit: "지정가",
    conditional: "조건부",
  };
  return map[type] || type;
}

function translateMode(mode: string) {
  const map: Record<string, string> = {
    simulation: "시뮬레이션",
    paper: "모의투자",
    live: "실전투자",
  };
  return map[mode] || mode;
}
