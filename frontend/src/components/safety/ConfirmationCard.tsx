import { KeyRound, ShieldAlert } from "lucide-react";

interface ConfirmationCardProps {
  title?: string;
  items: Array<{ label: string; value: string }>;
  requiresAuth?: boolean;
}

export function ConfirmationCard({
  title = "고객 확인 필요",
  items,
  requiresAuth = true,
}: ConfirmationCardProps) {
  return (
    <section className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[#071832]">{title}</h3>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={`${item.label}_${item.value}`} className="rounded-lg bg-[#f8fafc] px-3 py-2">
            <dt className="text-xs text-slate-500">{item.label}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-[#071832]">{item.value}</dd>
          </div>
        ))}
      </dl>
      {requiresAuth && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#fff8e1] px-3 py-2 text-xs font-semibold text-[#8a6400]">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          최종 실행 전 PIN, 생체인증 또는 계좌 인증이 필요합니다.
        </div>
      )}
    </section>
  );
}

export default ConfirmationCard;
