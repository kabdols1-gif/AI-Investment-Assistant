import { Activity, BarChart3, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout";
import { myStrategies } from "@/lib/mockData";

export default function MyStrategyPage() {
  return (
    <AppShell screen="my-strategy">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="전체 전략" value={`${myStrategies.length}개`} icon={BarChart3} />
        <SummaryCard label="실행 중" value="2개" icon={PlayCircle} accent="text-emerald-600" />
        <SummaryCard label="중지" value="1개" icon={PauseCircle} accent="text-slate-500" />
        <SummaryCard label="알림 필요" value="1건" icon={Activity} accent="text-amber-600" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#071832]">내 전략 리스트</h2>
            <span className="text-xs font-semibold text-slate-500">전략 ON/OFF는 확인 후 반영</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-3">전략명</th>
                  <th className="py-3 pr-3">투자대상</th>
                  <th className="py-3 pr-3">상태</th>
                  <th className="py-3 pr-3">최근 실행일</th>
                  <th className="py-3 pr-3">수익률</th>
                  <th className="py-3 pr-3">위험도</th>
                  <th className="py-3 text-right">ON/OFF</th>
                </tr>
              </thead>
              <tbody>
                {myStrategies.map((strategy) => (
                  <tr key={strategy.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-4 pr-3 font-bold text-[#071832]">{strategy.name}</td>
                    <td className="py-4 pr-3 text-slate-600">{strategy.target}</td>
                    <td className="py-4 pr-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${strategy.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {strategy.status}
                      </span>
                    </td>
                    <td className="py-4 pr-3 text-slate-600">{strategy.recentRun}</td>
                    <td className="py-4 pr-3 font-bold text-profit">{strategy.returnRate}</td>
                    <td className="py-4 pr-3 text-slate-600">{strategy.risk}</td>
                    <td className="py-4 text-right">
                      <input
                        type="checkbox"
                        checked={strategy.enabled}
                        readOnly
                        className="toggle-switch"
                        aria-label={`${strategy.name} 실행 상태`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border border-[#f3d58a] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
              <h2 className="text-base font-extrabold text-[#071832]">AI 코멘트</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              AI 반도체 선도주 전략은 최근 변동성이 커졌어요. 조건을 조금 완화하면 실행 빈도가 늘어날 수 있습니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-extrabold text-[#071832]">전략 성과 요약</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Score label="누적 수익률" value="+12.8%" />
              <Score label="최대 손실" value="-5.4%" tone="loss" />
              <Score label="승률" value="64%" />
              <Score label="평균 보유" value="18일" />
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
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className={`h-5 w-5 ${accent}`} aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#071832]">{value}</p>
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: string; tone?: "loss" }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${tone === "loss" ? "text-loss" : "text-profit"}`}>{value}</p>
    </div>
  );
}
