"use client";

import { useMemo, useState } from "react";
import { BarChart3, Gauge, LineChart, PieChart, Target } from "lucide-react";
import { AppShell } from "@/components/layout";
import { assetAllocation, assetSummary, portfolioList } from "@/lib/mockData";

const periodOptions = ["1개월", "3개월", "6개월", "1년", "전체"];
const periodChartHeights: Record<string, number[]> = {
  "1개월": [58, 61, 59, 64, 67, 70, 68, 72, 75, 78, 80, 82],
  "3개월": [45, 49, 47, 54, 58, 62, 60, 68, 71, 74, 76, 79],
  "6개월": [38, 44, 41, 50, 55, 52, 63, 66, 72, 78, 81, 86],
  "1년": [34, 42, 38, 55, 62, 58, 73, 79, 84, 91, 88, 96],
  전체: [26, 34, 40, 45, 52, 57, 61, 68, 72, 79, 88, 94],
};

export default function PortfolioPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("1년");
  const pieGradient = buildConicGradient();
  const chartHeights = useMemo(() => periodChartHeights[selectedPeriod] ?? periodChartHeights["1년"], [selectedPeriod]);

  return (
    <AppShell screen="portfolio">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="총 평가금액" value={assetSummary.totalAsset} />
        <Metric label="총 수익률" value={assetSummary.cumulativeReturn} profit />
        <Metric label="초과수익률" value="+2.46%" profit />
        <Metric label="위험등급" value="보통 (3/5)" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">보유 포트폴리오</h2>
          </div>
          <div className="space-y-3">
            {portfolioList.map((portfolio) => (
              <div key={portfolio.name} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#071832]">{portfolio.name}</p>
                    <p className="mt-1 text-xs text-slate-500">비중 {portfolio.weight}</p>
                  </div>
                  <p className="text-sm font-extrabold text-profit">{portfolio.returnRate}</p>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">{portfolio.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">자산 비중</h2>
          </div>
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative h-48 w-48 flex-none rounded-full" style={{ background: pieGradient }}>
              <div className="absolute inset-12 flex flex-col items-center justify-center rounded-full bg-white text-center">
                <span className="text-xs text-slate-500">총평가금액</span>
                <span className="mt-1 text-sm font-extrabold text-[#071832]">{assetSummary.totalAsset}</span>
              </div>
            </div>
            <div className="grid flex-1 gap-3">
              {assetAllocation.map((item) => (
                <div key={item.category} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.category}
                  </span>
                  <span className="text-sm font-extrabold text-[#071832]">{item.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <LineChart className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">수익률 추이</h2>
          </div>
          <div className="mb-4 inline-flex rounded-lg bg-[#f8fafc] p-1">
            {periodOptions.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={`rounded-md px-3 py-2 text-xs font-bold focus-ring ${period === selectedPeriod ? "bg-white text-[#071832] shadow-sm" : "text-slate-500"}`}
                aria-pressed={period === selectedPeriod}
              >
                {period}
              </button>
            ))}
          </div>
          <div className="flex h-48 items-end gap-2 rounded-lg bg-[#f8fafc] p-4">
            {chartHeights.map((height, index) => (
              <div key={index} className="flex flex-1 items-end">
                <div className="w-full rounded-t bg-[#2563eb]" style={{ height: `${height}%` }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-4">
        <InsightCard icon={BarChart3} title="벤치마크 비교" value="+12.45%" description="KOSPI+채권 혼합 대비 우위" />
        <InsightCard icon={Gauge} title="리밸런싱 제안" value="AI 제안" description="성장 자산과 방어 자산 균형 조정" />
        <InsightCard icon={Target} title="목표 달성률" value="64%" description="목표 3억원, 예상 달성 2039.08" />
        <InsightCard icon={PieChart} title="위험 분산 진단" value="보통" description="포트폴리오 집중도 0.23" />
      </section>
    </AppShell>
  );
}

function Metric({ label, value, profit = false }: { label: string; value: string; profit?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-extrabold ${profit ? "text-profit" : "text-[#071832]"}`}>{value}</p>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof BarChart3;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-[#071832]">{title}</p>
      <p className="mt-2 text-xl font-extrabold text-profit">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{description}</p>
    </div>
  );
}

function buildConicGradient() {
  let cursor = 0;
  const stops = assetAllocation.map((item) => {
    const start = cursor;
    cursor += item.weight;
    return `${item.color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}
