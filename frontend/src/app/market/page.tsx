"use client";

import { Activity, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout";
import { marketOverview } from "@/lib/mockData";

export default function MarketPage() {
  const upCount = marketOverview.filter((item) => item.tone === "up").length;
  const downCount = marketOverview.filter((item) => item.tone === "down").length;

  return (
    <AppShell screen="market">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black tracking-normal text-[#071832]">시장현황</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">국내외 증시, 환율, 금리, 원자재 흐름을 한 화면에서 확인합니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <StatusTile icon={BarChart3} label="관찰 지표" value={`${marketOverview.length}개`} tone="neutral" />
            <StatusTile icon={TrendingUp} label="상승" value={`${upCount}개`} tone="up" />
            <StatusTile icon={TrendingDown} label="하락" value={`${downCount}개`} tone="down" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {marketOverview.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-100 bg-[#f8fafc] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500">{item.label}</p>
                  <h3 className="mt-2 text-xl font-black tracking-normal text-[#071832]">{item.primary}</h3>
                </div>
                <Activity className={`h-5 w-5 ${marketToneClass(item.tone)}`} aria-hidden="true" />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className={`text-sm font-extrabold tabular-nums ${marketToneClass(item.tone)}`}>{item.change}</p>
                <p className="text-right text-xs font-semibold leading-5 text-slate-500">{item.secondary}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-[#f8fafc] px-3 py-2">
      <Icon className={`mx-auto h-4 w-4 ${marketToneClass(tone)}`} aria-hidden="true" />
      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-[#071832]">{value}</p>
    </div>
  );
}

function marketToneClass(tone: "up" | "down" | "neutral") {
  if (tone === "up") return "text-profit";
  if (tone === "down") return "text-loss";
  return "text-neutral";
}
