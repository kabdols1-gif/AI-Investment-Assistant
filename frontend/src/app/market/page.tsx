"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronRight, Globe2, Star } from "lucide-react";
import { AppShell } from "@/components/layout";
import type { MarketTone } from "@/lib/mockData";

type MarketTab = "domestic" | "us" | "global" | "indicators";
type MarketRow = {
  name: string;
  code?: string;
  price: string;
  change: string;
  sector?: string;
  volume: string;
  tradingValue: string;
  marketCap: string;
  tone: MarketTone;
};

const tabs: { id: MarketTab; label: string }[] = [
  { id: "domestic", label: "국내" },
  { id: "us", label: "미국" },
  { id: "global", label: "글로벌" },
  { id: "indicators", label: "시장지표" },
];

const intradayLabels = [
  "09:00",
  "09:20",
  "09:40",
  "10:00",
  "10:20",
  "10:40",
  "11:00",
  "11:20",
  "11:40",
  "12:00",
  "12:20",
  "12:40",
  "13:00",
  "13:20",
  "13:40",
  "14:00",
  "14:20",
  "14:40",
  "15:00",
  "15:20",
  "15:30",
];

const trendSeries = {
  kospi: [88, 84, 80, 82, 77, 72, 70, 66, 68, 63, 60, 58, 55, 57, 52, 49, 47, 44, 42, 39, 38],
  kosdaq: [78, 76, 81, 79, 72, 68, 64, 66, 59, 56, 52, 54, 48, 45, 42, 39, 41, 37, 35, 33, 34],
  largeCap: [84, 81, 79, 76, 74, 70, 68, 64, 62, 59, 58, 55, 52, 51, 48, 46, 44, 43, 41, 39, 37],
  currency: [61, 62, 60, 59, 57, 56, 55, 53, 54, 52, 51, 50, 49, 50, 48, 47, 46, 45, 44, 43, 44],
  dow: [84, 80, 78, 76, 72, 70, 68, 65, 62, 61, 58, 56, 55, 53, 52, 54, 55, 57, 56, 58, 57],
  nasdaq: [92, 88, 84, 82, 78, 74, 70, 68, 64, 60, 58, 55, 52, 50, 48, 51, 49, 53, 52, 54, 55],
  sp500: [79, 78, 75, 73, 71, 69, 67, 65, 64, 62, 60, 58, 56, 55, 57, 58, 59, 61, 60, 62, 61],
  vix: [35, 36, 38, 40, 43, 46, 50, 54, 58, 62, 67, 72, 76, 81, 84, 80, 78, 82, 79, 77, 78],
  shanghai: [70, 72, 69, 66, 64, 65, 63, 60, 58, 59, 56, 54, 53, 55, 52, 50, 49, 48, 47, 46, 45],
  hangSeng: [88, 82, 76, 70, 66, 60, 57, 54, 50, 52, 55, 53, 50, 49, 51, 48, 46, 47, 49, 48, 49],
  nikkei: [82, 80, 77, 74, 72, 69, 66, 63, 61, 59, 56, 54, 52, 50, 48, 47, 46, 45, 44, 46, 45],
  europe: [48, 50, 52, 54, 56, 58, 61, 63, 62, 60, 58, 55, 52, 50, 48, 47, 45, 44, 43, 44, 45],
  dax: [58, 59, 61, 62, 64, 65, 63, 61, 59, 57, 56, 54, 52, 50, 48, 47, 46, 45, 47, 48, 47],
  bovespa: [74, 73, 72, 70, 68, 67, 65, 63, 61, 60, 58, 57, 56, 55, 54, 52, 51, 50, 51, 52, 52],
  commodityUp: [30, 31, 33, 35, 38, 42, 47, 52, 58, 63, 68, 72, 76, 80, 82, 79, 77, 78, 76, 75, 76],
  fundFlow: [20, 23, 25, 28, 31, 33, 35, 38, 42, 45, 48, 52, 55, 57, 56, 58, 61, 63, 66, 68, 70],
  investorFlow: [10, 18, 24, 31, 38, 44, 42, 48, 55, 60, 66, 72, 76, 70, 64, 58, 52, 48, 42, 35, 28],
};

const domesticCards = [
  { name: "코스피", value: "7,547.21", change: "▼ 613.38 (-7.52%)", tone: "down" as const, meta: "실시간", series: trendSeries.kospi },
  { name: "코스닥", value: "926.26", change: "▼ 76.18 (-7.60%)", tone: "down" as const, meta: "실시간", series: trendSeries.kosdaq },
  { name: "코스피 100", value: "9,375.61", change: "▼ 769.03 (-7.58%)", tone: "down" as const, meta: "52주 최고 11,211.16", series: trendSeries.largeCap },
  { name: "미국 USD", value: "1,549.20", change: "▼ 10.30 (-0.66%)", tone: "down" as const, meta: "실시간", series: trendSeries.currency },
];

const usCards = [
  { name: "다우존스", value: "50,866.78", change: "▼ 695.15 (-1.35%)", tone: "down" as const, meta: "장마감", series: trendSeries.dow },
  { name: "나스닥 종합", value: "25,709.43", change: "▼ 1,121.53 (-4.18%)", tone: "down" as const, meta: "장마감", series: trendSeries.nasdaq },
  { name: "S&P 500", value: "7,383.74", change: "▼ 200.57 (-2.64%)", tone: "down" as const, meta: "장마감", series: trendSeries.sp500 },
  { name: "VIX", value: "21.51", change: "▲ 6.11 (+39.68%)", tone: "up" as const, meta: "변동성", series: trendSeries.vix },
];

const globalCards = [
  { name: "상해종합", value: "3,988.45", change: "▼ 39.29 (-0.98%)", tone: "down" as const, meta: "15분 지연", series: trendSeries.shanghai },
  { name: "항셍", value: "24,594.35", change: "▼ 367.60 (-1.47%)", tone: "down" as const, meta: "15분 지연", series: trendSeries.hangSeng },
  { name: "니케이 225", value: "63,823.32", change: "▼ 2,764.80 (-4.15%)", tone: "down" as const, meta: "15분 지연", series: trendSeries.nikkei },
  { name: "유로스톡스 50", value: "6,062.07", change: "▼ 41.26 (-0.68%)", tone: "down" as const, meta: "장마감", series: trendSeries.europe },
  { name: "독일 DAX", value: "24,759.05", change: "▼ 185.90 (-0.75%)", tone: "down" as const, meta: "장마감", series: trendSeries.dax },
  { name: "브라질 BOVESPA", value: "169,019.12", change: "▼ 1,311.51 (-0.77%)", tone: "down" as const, meta: "장마감", series: trendSeries.bovespa },
];

const indicatorCards = [
  { name: "미국 USD", value: "1,549.20", change: "▼ 10.30 (-0.66%)", tone: "down" as const, meta: "실시간", series: trendSeries.currency },
  { name: "유럽 EUR", value: "1,784.60", change: "▼ 10.93 (-0.61%)", tone: "down" as const, meta: "실시간", series: trendSeries.europe },
  { name: "WTI", value: "94.14", change: "▲ 3.60 (+3.98%)", tone: "up" as const, meta: "10분 지연", series: trendSeries.commodityUp },
  { name: "국내 금", value: "213,970", change: "▼ 4,580 (-2.10%)", tone: "down" as const, meta: "실시간", series: trendSeries.largeCap },
];

const domesticRows: MarketRow[] = [
  { name: "SK하이닉스", code: "000660", price: "1,956,000", change: "▼ 114,000 (-5.51%)", volume: "2,500,179주", tradingValue: "4,883,183백만", marketCap: "1,401조 1,728억", tone: "down" },
  { name: "삼성전자", code: "005930", price: "300,250", change: "▼ 28,750 (-8.74%)", volume: "14,592,532주", tradingValue: "4,407,884백만", marketCap: "1,758조 2,683억", tone: "down" },
  { name: "삼성전기", code: "009150", price: "1,675,000", change: "▼ 82,000 (-4.67%)", volume: "536,570주", tradingValue: "897,950백만", marketCap: "125조 7,842억", tone: "down" },
  { name: "LG전자", code: "066570", price: "267,500", change: "▼ 35,500 (-11.72%)", volume: "1,490,160주", tradingValue: "402,930백만", marketCap: "43조 7,345억", tone: "down" },
  { name: "NAVER", code: "035420", price: "243,500", change: "▼ 12,000 (-4.70%)", volume: "1,566,189주", tradingValue: "394,141백만", marketCap: "38조 1,988억", tone: "down" },
  { name: "현대차", code: "005380", price: "630,000", change: "▼ 70,000 (-10.00%)", volume: "512,518주", tradingValue: "326,469백만", marketCap: "129조 2,022억", tone: "down" },
];

const usRows: MarketRow[] = [
  { name: "마이크론 테크놀로지", code: "MU", price: "$864.01", change: "▼ 131.99 (-13.25%)", sector: "반도체", volume: "77,250,536주", tradingValue: "$698.84억", marketCap: "$9,743.73억", tone: "down" },
  { name: "엔비디아", code: "NVDA", price: "$205.10", change: "▼ 13.56 (-6.20%)", sector: "반도체", volume: "219,655,531주", tradingValue: "$457.45억", marketCap: "$49,634.2억", tone: "down" },
  { name: "테슬라", code: "TSLA", price: "$391.00", change: "▼ 27.45 (-6.56%)", sector: "자동차", volume: "63,420,177주", tradingValue: "$253.54억", marketCap: "$14,684.88억", tone: "down" },
  { name: "애플", code: "AAPL", price: "$307.34", change: "▼ 3.89 (-1.25%)", sector: "전화 및 소형 장치", volume: "65,310,502주", tradingValue: "$202.75억", marketCap: "$45,140.12억", tone: "down" },
  { name: "브로드컴", code: "AVGO", price: "$385.30", change: "▼ 33.18 (-7.92%)", sector: "반도체", volume: "51,146,089주", tradingValue: "$201.7억", marketCap: "$18,263.04억", tone: "down" },
];

const indicatorGroups = [
  {
    title: "국채수익률",
    rows: [
      ["미국 국채 10년", "4.5680", "▲ 0.0320 (+0.71%)", "실시간", "up"],
      ["한국 국채 10년", "4.3270", "▲ 0.0840 (+1.98%)", "실시간", "up"],
      ["일본 국채 10년", "2.6580", "▼ 0.0100 (-0.37%)", "2시간 지연", "down"],
      ["독일 국채 10년", "3.0270", "▼ 0.0120 (-0.39%)", "실시간", "down"],
    ],
  },
  {
    title: "기준금리",
    rows: [
      ["미국연방준비은행", "3.75%", "0.00", "04.30", "neutral"],
      ["한국은행", "2.50%", "0.00", "05.28", "neutral"],
      ["유럽중앙은행", "2.15%", "0.00", "04.30", "neutral"],
      ["일본은행", "0.75%", "0.00", "04.28", "neutral"],
    ],
  },
  {
    title: "에너지",
    rows: [
      ["WTI", "94.14", "▲ 3.60 (+3.98%)", "10분 지연", "up"],
      ["브렌트유", "96.56", "▲ 3.47 (+3.73%)", "10분 지연", "up"],
      ["RBOB 가솔린", "3.0719", "▲ 0.0851 (+2.85%)", "10분 지연", "up"],
      ["두바이유", "90.46", "▼ 2.68 (-2.88%)", "10분 지연", "down"],
    ],
  },
  {
    title: "금속",
    rows: [
      ["국제 금", "4,342.90", "▼ 22.40 (-0.51%)", "10분 지연", "down"],
      ["국내 금", "213,970", "▼ 4,580 (-2.10%)", "실시간", "down"],
      ["은", "67.57", "▼ 1.53 (-2.22%)", "10분 지연", "down"],
      ["구리(선물)", "6.2665", "▼ 0.0180 (-0.29%)", "10분 지연", "down"],
    ],
  },
];

const themeTop = [
  { name: "무선통신서비스", value: "+0.76%", tone: "up" as const },
  { name: "가정용품", value: "-1.05%", tone: "down" as const },
  { name: "운송인프라", value: "-1.61%", tone: "down" as const },
  { name: "광고", value: "-2.02%", tone: "down" as const },
  { name: "담배", value: "-2.23%", tone: "down" as const },
];

const etfThemes = [
  { title: "주택저당채권", symbols: ["VABS", "JAAA", "GSST"], summary: "고품질 채권 ETF와 단기 소득형 상품을 모아봅니다." },
  { title: "밈 주식", symbols: ["GME", "AMC", "BB"], summary: "변동성이 큰 테마형 종목은 알림 중심으로 점검합니다." },
  { title: "커뮤니케이션", symbols: ["XLC", "META", "GOOGL"], summary: "대형 플랫폼과 광고 경기 민감도를 함께 확인합니다." },
];

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<MarketTab>("domestic");
  const selectedCards = activeTab === "us" ? usCards : activeTab === "global" ? globalCards : activeTab === "indicators" ? indicatorCards : domesticCards;
  const upCount = selectedCards.filter((item) => item.tone === "up").length;
  const downCount = selectedCards.filter((item) => item.tone === "down").length;

  return (
    <AppShell screen="market">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex rounded-lg border border-slate-200 bg-[#f8fafc] p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={`rounded-md px-4 py-2 text-sm font-extrabold transition focus-ring ${
                  activeTab === tab.id ? "bg-[#071832] text-white" : "text-slate-600 hover:bg-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <StatusTile label="관찰" value={`${selectedCards.length}개`} tone="neutral" />
            <StatusTile label="상승" value={`${upCount}개`} tone="up" />
            <StatusTile label="하락" value={`${downCount}개`} tone="down" />
          </div>
        </div>
      </section>

      {activeTab === "domestic" && <DomesticMarket />}
      {activeTab === "us" && <UsMarket />}
      {activeTab === "global" && <GlobalMarket />}
      {activeTab === "indicators" && <IndicatorMarket />}
    </AppShell>
  );
}

function DomesticMarket() {
  return (
    <div className="mt-5 space-y-6">
      <IndexGrid items={domesticCards} />
      <StockRanking title="주식" rows={domesticRows} filters={["전체", "코스피", "코스닥", "시가총액", "거래대금 상위", "인기 종목", "상승", "하락", "52주 최고", "52주 최저"]} />
      <ThemeTopFive />
      <SectorMarketCap />
      <InvestorTrend />
      <FundFlow />
    </div>
  );
}

function UsMarket() {
  return (
    <div className="mt-5 space-y-6">
      <IndexGrid items={usCards} />
      <StockRanking title="주식" rows={usRows} filters={["전체", "뉴욕", "나스닥", "아멕스", "시가총액", "거래대금 상위", "상승", "하락", "거래량 상위"]} />
      <EtfThemeSection />
    </div>
  );
}

function GlobalMarket() {
  const [region, setRegion] = useState("중국");
  const regionRows = useMemo(() => {
    if (region === "일본") return usRows.slice(0, 4).map((row) => ({ ...row, price: row.price.replace("$", "¥") }));
    if (region === "유럽") return usRows.slice(1, 5).map((row) => ({ ...row, price: row.price.replace("$", "€") }));
    return domesticRows.slice(0, 4).map((row) => ({ ...row, price: `¥${row.price}` }));
  }, [region]);

  return (
    <div className="mt-5 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-black text-[#071832]">주요 지표</h2>
        {["중국", "홍콩", "일본", "베트남", "유럽", "아시아", "남미"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRegion(item)}
            className={`text-lg font-extrabold transition focus-ring ${region === item ? "text-[#071832]" : "text-slate-500 hover:text-[#071832]"}`}
          >
            {item}
          </button>
        ))}
      </div>
      <IndexGrid items={globalCards} />
      <StockRanking title={region} rows={regionRows} filters={["전체", "상해(후강퉁)", "심천(선강퉁)", "시가총액", "거래대금 상위", "상승", "하락"]} />
    </div>
  );
}

function IndicatorMarket() {
  return (
    <div className="mt-5 space-y-6">
      <IndexGrid items={indicatorCards} />
      <div className="space-y-6">
        {indicatorGroups.map((group) => (
          <IndicatorTable key={group.title} {...group} />
        ))}
      </div>
    </div>
  );
}

function IndexGrid({ items }: { items: { name: string; value: string; change: string; tone: MarketTone; meta: string; series: number[] }[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-[#0f4c81]" aria-hidden="true" />
            <h3 className="text-sm font-extrabold text-[#071832]">{item.name}</h3>
            <span className="text-xs font-bold text-slate-500">· {item.meta}</span>
          </div>
          <p className="mt-2 text-2xl font-black tracking-normal text-[#071832]">{item.value}</p>
          <p className={`mt-1 text-sm font-extrabold tabular-nums ${toneClass(item.tone)}`}>{item.change}</p>
          <MiniLine values={item.series} tone={item.tone} />
        </article>
      ))}
    </section>
  );
}

function StockRanking({ title, rows, filters }: { title: string; rows: MarketRow[]; filters: string[] }) {
  const [activeFilter, setActiveFilter] = useState(filters[Math.min(4, filters.length - 1)]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-2xl font-black text-[#071832]">{title}</h2>
        <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`rounded-md border px-3 py-2 text-sm font-extrabold transition focus-ring ${
              activeFilter === filter ? "border-[#071832] bg-[#071832] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-[#f8fafc]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="border-b border-slate-200 text-xs font-bold text-slate-500">
            <tr>
              <th className="w-10 px-2 py-3" />
              <th className="px-2 py-3 text-left">종목명</th>
              <th className="px-2 py-3 text-right">현재가</th>
              <th className="px-2 py-3 text-right">전일대비</th>
              <th className="px-2 py-3 text-right">업종</th>
              <th className="px-2 py-3 text-right">거래량</th>
              <th className="px-2 py-3 text-right">거래대금</th>
              <th className="px-2 py-3 text-right">시가총액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.name}-${row.code}`} className="border-b border-slate-100 last:border-b-0">
                <td className="px-2 py-3 text-center">
                  <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-[#fff8e1] hover:text-[#8a6400] focus-ring" aria-label={`${row.name} 즐겨찾기`}>
                    <Star className="h-4 w-4" aria-hidden="true" />
                  </button>
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-right font-bold text-slate-500">{index + 1}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f4c81] text-xs font-black text-white">{row.code?.slice(0, 2) ?? "ETF"}</span>
                    <span>
                      <span className="block font-extrabold text-[#071832]">{row.name}</span>
                      {row.code && <span className="text-xs font-bold text-slate-500">{row.code}</span>}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3 text-right font-extrabold text-[#071832]">{row.price}</td>
                <td className={`px-2 py-3 text-right font-extrabold ${toneClass(row.tone)}`}>{row.change}</td>
                <td className="px-2 py-3 text-right font-bold text-slate-600">{row.sector ?? "-"}</td>
                <td className="px-2 py-3 text-right font-bold text-slate-600">{row.volume}</td>
                <td className="px-2 py-3 text-right font-bold text-slate-600">{row.tradingValue}</td>
                <td className="px-2 py-3 text-right font-bold text-slate-600">{row.marketCap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ThemeTopFive() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black text-[#071832]">업종·테마 TOP 5</h2>
      <div className="mt-4 grid gap-5 2xl:grid-cols-2">
        {["업종", "테마"].map((title) => (
          <div key={title}>
            <h3 className="text-center text-base font-extrabold text-[#071832]">{title}</h3>
            <div className="mt-4 flex h-40 items-end justify-between border-b border-slate-200">
              {themeTop.map((item, index) => (
                <div key={`${title}-${item.name}`} className="flex w-16 flex-col items-center">
                  <div className={`w-8 rounded-t ${item.tone === "up" ? "bg-emerald-500" : "bg-slate-500"}`} style={{ height: `${Math.abs(Number(item.value.replace(/[+%]/g, ""))) * 34 + 18}px` }} />
                  <p className="mt-2 text-xs font-black text-[#071832]">{index + 1}위</p>
                  <p className="mt-1 w-16 truncate text-center text-xs font-bold text-slate-600">{item.name}</p>
                  <p className={`text-xs font-extrabold ${toneClass(item.tone)}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectorMarketCap() {
  const sectors = ["반도체와반도체장비", "복합기업", "자동차", "전자장비와기기", "은행", "조선", "제약", "전기제품", "인터넷과카탈로그소매", "화학"];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black text-[#071832]">업종 시가총액 TOP 10</h2>
      <div className="mt-4 grid gap-4 2xl:grid-cols-[280px_1fr]">
        <div className="rounded-lg bg-[#f8fafc] p-3">
          <div className="flex justify-between rounded-lg bg-white px-3 py-3 text-sm font-black text-[#071832] shadow-sm">
            <span>전체 업종</span>
            <span>총 72,079,470억</span>
          </div>
          <div className="mt-3 space-y-2">
            {sectors.slice(0, 7).map((sector, index) => (
              <div key={sector} className="grid grid-cols-[24px_1fr_60px] items-center gap-2 text-sm">
                <span className="font-bold text-slate-500">{index + 1}</span>
                <span className="truncate font-bold text-[#071832]">{sector}</span>
                <span className="text-right font-extrabold text-loss">-{(7 + index * 0.6).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid min-h-72 grid-cols-4 grid-rows-3 gap-0.5 overflow-hidden rounded-lg bg-white">
          {sectors.map((sector, index) => (
            <div key={sector} className={`${index === 0 ? "col-span-2 row-span-3" : ""} flex items-center justify-center bg-[#1686f8] p-3 text-center text-sm font-black text-white`}>
              {sector}
              <br />
              -{(5.7 + index * 0.5).toFixed(2)}%
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InvestorTrend() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-[#071832]">투자자별 매매 동향</h2>
        <div className="inline-flex rounded-lg bg-[#f8fafc] p-1">
          {["1일", "1주", "1개월"].map((item) => (
            <button key={item} type="button" className="rounded-md px-3 py-1.5 text-xs font-extrabold first:bg-white first:text-[#071832] text-slate-500 focus-ring">{item}</button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          ["개인", "+7,878억", "up"],
          ["외국인", "-11,033억", "down"],
          ["기관", "+2,634억", "up"],
        ].map(([label, value, tone]) => (
          <div key={label}>
            <div className={`mx-auto h-24 w-12 rounded-t ${tone === "up" ? "bg-red-500" : "bg-blue-500"}`} />
            <p className="mt-3 font-extrabold text-[#071832]">{label}</p>
            <p className={`mt-1 font-extrabold ${tone === "up" ? "text-profit" : "text-loss"}`}>{value}</p>
          </div>
        ))}
      </div>
      <MiniLine values={trendSeries.investorFlow} tone="up" tall />
    </section>
  );
}

function FundFlow() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-[#071832]">증시자금동향</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {[
          ["고객예탁금", "1,396,948억", "▲ 28,836억", "up"],
          ["신용잔고", "371,166억", "▲ 74억", "up"],
          ["주식형펀드", "3,802,920억", "▲ 7,501억", "up"],
          ["채권형펀드", "2,168,816억", "▼ 2,483억", "down"],
        ].map(([label, value, change, tone]) => (
          <div key={label} className="rounded-lg bg-[#f8fafc] p-4">
            <p className="text-sm font-extrabold text-[#071832]">{label}</p>
            <p className="mt-1 text-xl font-black">{value}</p>
            <p className={`text-sm font-extrabold ${tone === "up" ? "text-profit" : "text-loss"}`}>{change}</p>
            <MiniLine values={trendSeries.fundFlow} tone={tone as MarketTone} />
          </div>
        ))}
      </div>
    </section>
  );
}

function EtfThemeSection() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-[#071832]">ETF</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {["국가", "업종", "지수/통화", "상품/자원", "레버리지/인버스", "투자전략", "기술트렌드", "바이오", "소비"].map((item, index) => (
          <button key={item} type="button" className={`rounded-full px-3 py-2 text-sm font-extrabold ${index === 0 ? "bg-[#071832] text-white" : "bg-slate-100 text-slate-600"} focus-ring`}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {etfThemes.map((theme) => (
          <article key={theme.title} className="rounded-lg border border-slate-200 bg-[#f8fafc] p-4">
            <h3 className="text-lg font-black text-[#071832]">{theme.title}</h3>
            <div className="mt-4 space-y-3">
              {theme.symbols.map((symbol, index) => (
                <div key={symbol} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f4c81] text-xs font-black text-white">ETF</span>
                    <span className="font-extrabold text-[#071832]">{symbol}</span>
                  </span>
                  <span className={index === 0 ? "text-profit" : "text-loss"}>{index === 0 ? "+0.53%" : "-4.80%"}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{theme.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function IndicatorTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-[#071832]">{title}</h2>
      <table className="mt-4 w-full text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500">
          <tr>
            <th className="py-3 text-left">상품명</th>
            <th className="py-3 text-right">현재가</th>
            <th className="py-3 text-right">전일대비</th>
            <th className="py-3 text-right">기준 시간</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, value, change, time, tone]) => (
            <tr key={name} className="border-b border-slate-100 last:border-b-0">
              <td className="py-3 font-extrabold text-[#071832]">{name}</td>
              <td className="py-3 text-right font-extrabold">{value}</td>
              <td className={`py-3 text-right font-extrabold ${toneClass(tone as MarketTone)}`}>{change}</td>
              <td className="py-3 text-right font-bold text-slate-500">{time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: MarketTone }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-[#f8fafc] px-3 py-2">
      <BarChart3 className={`mx-auto h-4 w-4 ${toneClass(tone)}`} aria-hidden="true" />
      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-[#071832]">{value}</p>
    </div>
  );
}

function MiniLine({ values, tone, tall = false }: { values: number[]; tone: MarketTone; tall?: boolean }) {
  const width = 360;
  const height = tall ? 168 : 126;
  const plot = { left: 10, right: width - 10, top: 14, bottom: height - 28 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const stroke = tone === "up" ? "#ef4444" : tone === "down" ? "#1686f8" : "#64748b";
  const areaFill = tone === "up" ? "#fee2e2" : tone === "down" ? "#dbeafe" : "#e2e8f0";
  const coords = values.map((value, index) => {
    const x = plot.left + (index / Math.max(values.length - 1, 1)) * (plot.right - plot.left);
    const y = plot.bottom - ((value - min) / spread) * (plot.bottom - plot.top);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });
  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const first = coords[0] ?? { x: plot.left, y: plot.bottom };
  const last = coords[coords.length - 1] ?? first;
  const areaPath = `${linePath} L ${last.x} ${plot.bottom} L ${first.x} ${plot.bottom} Z`;
  const xTickIndexes = [0, Math.floor((values.length - 1) / 2), values.length - 1];

  return (
    <svg className={`mt-4 w-full ${tall ? "h-44" : "h-32"}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="시간대별 가격 추세">
      {Array.from({ length: 4 }, (_, index) => {
        const y = plot.top + (index / 3) * (plot.bottom - plot.top);
        return <line key={y} x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />;
      })}
      <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#cbd5e1" />
      <path d={areaPath} fill={areaFill} opacity="0.72" />
      <path d={linePath} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {coords.map((point, index) => {
        const shouldMark = index === 0 || index === coords.length - 1 || index % 4 === 0;
        if (!shouldMark) return null;
        return <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r={index === coords.length - 1 ? 4 : 2.5} fill="white" stroke={stroke} strokeWidth="2" />;
      })}
      {xTickIndexes.map((index) => {
        const point = coords[index];
        const labelIndex = Math.round((index / Math.max(values.length - 1, 1)) * (intradayLabels.length - 1));
        return (
          <text key={index} x={point?.x ?? plot.left} y={height - 8} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="middle">
            {intradayLabels[labelIndex]}
          </text>
        );
      })}
    </svg>
  );
}

function toneClass(tone: MarketTone) {
  if (tone === "up") return "text-profit";
  if (tone === "down") return "text-loss";
  return "text-neutral";
}
