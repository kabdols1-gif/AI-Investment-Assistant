import { ShieldCheck } from "lucide-react";

interface RiskNoticeProps {
  compact?: boolean;
}

export function RiskNotice({ compact = false }: RiskNoticeProps) {
  return (
    <section className="rounded-lg border border-[#f3d58a] bg-[#fff8e1] px-4 py-3">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-[#8a6400]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#071832]">투자 유의사항</p>
          <p className={`${compact ? "text-xs" : "text-sm"} mt-1 leading-5 text-slate-600`}>
            투자 판단의 최종 책임은 고객 본인에게 있습니다. 과거 수익률은 미래 수익을 보장하지 않으며,
            AI 제안은 참고용입니다.
          </p>
        </div>
      </div>
    </section>
  );
}

export default RiskNotice;
