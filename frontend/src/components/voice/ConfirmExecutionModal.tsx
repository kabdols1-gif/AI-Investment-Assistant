"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import type { OrderProposal } from "@/types/voice";

interface ConfirmExecutionModalProps {
  proposal: OrderProposal;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (options: { userConfirmed: boolean; authCompleted: boolean; executionEnabled: boolean }) => void;
}

export function ConfirmExecutionModal({
  proposal,
  isLoading,
  onClose,
  onConfirm,
}: ConfirmExecutionModalProps) {
  const [userConfirmed, setUserConfirmed] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(proposal.mode === "simulation");
  const [executionEnabled, setExecutionEnabled] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">최종 확인</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">이 단계 이후 서버 안전 게이트가 다시 점검합니다.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="최종 확인 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="종목" value={`${proposal.symbol_name} ${proposal.symbol_code}`} />
              <Field label="방향" value={proposal.side === "buy" ? "매수" : "매도"} />
              <Field label="수량" value={proposal.quantity?.toLocaleString() || "-"} />
              <Field label="모드" value={translateMode(proposal.mode)} />
            </div>
          </div>

          {proposal.mode === "live" && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>실전 주문은 기본적으로 비활성화되어 있으며 로컬 설정에서 명시적으로 켜야 합니다.</span>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={userConfirmed}
              onChange={(event) => setUserConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>종목, 방향, 수량, 모드, 위험 경고를 확인했습니다.</span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={authCompleted}
              onChange={(event) => setAuthCompleted(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>로컬 인증 또는 시뮬레이션 확인이 완료되었습니다.</span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={executionEnabled}
              onChange={(event) => setExecutionEnabled(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span>모의/실전 모드에서 실제 제출을 시도합니다. 시뮬레이션은 주문을 제출하지 않습니다.</span>
          </label>
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm({ userConfirmed, authCompleted, executionEnabled })}
            disabled={isLoading || !userConfirmed || !authCompleted}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default ConfirmExecutionModal;

function translateMode(mode: string) {
  const map: Record<string, string> = {
    simulation: "시뮬레이션",
    paper: "모의투자",
    live: "실전투자",
  };
  return map[mode] || mode;
}
