"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronRight, Coins, DollarSign, Droplet, Flag, Fuel, Globe2, Landmark, Star, type LucideIcon } from "lucide-react";
import { LightweightAreaChart, LightweightHistogramChart, LightweightMultiLineChart } from "@/components/charts/LightweightCharts";
import { AppShell } from "@/components/layout";
import type { MarketTone } from "@/lib/mockData";

type MarketTab = "domestic" | "us" | "global" | "indicators";
type ThemeMetric = "rate" | "volume" | "tradingValue";
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
type IndicatorIconKind = "country" | "centralBank" | "oil" | "fuel" | "gold" | "silver" | "copper";
type IndicatorRow = {
  name: string;
  value: string;
  change: string;
  time: string;
  tone: MarketTone;
  icon: {
    kind: IndicatorIconKind;
    label: string;
  };
};

const tabs: { id: MarketTab; label: string; icon: LucideIcon }[] = [
  { id: "domestic", label: "국내", icon: Landmark },
  { id: "us", label: "미국", icon: DollarSign },
  { id: "global", label: "글로벌", icon: Globe2 },
  { id: "indicators", label: "시장지표", icon: BarChart3 },
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
      { name: "미국 국채 10년", value: "4.5680", change: "▲ 0.0320 (+0.71%)", time: "실시간", tone: "up", icon: { kind: "country", label: "US" } },
      { name: "한국 국채 10년", value: "4.3270", change: "▲ 0.0840 (+1.98%)", time: "실시간", tone: "up", icon: { kind: "country", label: "KR" } },
      { name: "일본 국채 10년", value: "2.6580", change: "▼ 0.0100 (-0.37%)", time: "2시간 지연", tone: "down", icon: { kind: "country", label: "JP" } },
      { name: "독일 국채 10년", value: "3.0270", change: "▼ 0.0120 (-0.39%)", time: "실시간", tone: "down", icon: { kind: "country", label: "DE" } },
    ],
  },
  {
    title: "기준금리",
    rows: [
      { name: "미국연방준비은행", value: "3.75%", change: "0.00", time: "04.30", tone: "neutral", icon: { kind: "centralBank", label: "FED" } },
      { name: "한국은행", value: "2.50%", change: "0.00", time: "05.28", tone: "neutral", icon: { kind: "centralBank", label: "BOK" } },
      { name: "유럽중앙은행", value: "2.15%", change: "0.00", time: "04.30", tone: "neutral", icon: { kind: "centralBank", label: "ECB" } },
      { name: "일본은행", value: "0.75%", change: "0.00", time: "04.28", tone: "neutral", icon: { kind: "centralBank", label: "BOJ" } },
    ],
  },
  {
    title: "에너지",
    rows: [
      { name: "WTI", value: "94.14", change: "▲ 3.60 (+3.98%)", time: "10분 지연", tone: "up", icon: { kind: "oil", label: "Oil" } },
      { name: "브렌트유", value: "96.56", change: "▲ 3.47 (+3.73%)", time: "10분 지연", tone: "up", icon: { kind: "oil", label: "Oil" } },
      { name: "RBOB 가솔린", value: "3.0719", change: "▲ 0.0851 (+2.85%)", time: "10분 지연", tone: "up", icon: { kind: "fuel", label: "Gas" } },
      { name: "두바이유", value: "90.46", change: "▼ 2.68 (-2.88%)", time: "10분 지연", tone: "down", icon: { kind: "oil", label: "Oil" } },
    ],
  },
  {
    title: "금속",
    rows: [
      { name: "국제 금", value: "4,342.90", change: "▼ 22.40 (-0.51%)", time: "10분 지연", tone: "down", icon: { kind: "gold", label: "Au" } },
      { name: "국내 금", value: "213,970", change: "▼ 4,580 (-2.10%)", time: "실시간", tone: "down", icon: { kind: "gold", label: "Au" } },
      { name: "은", value: "67.57", change: "▼ 1.53 (-2.22%)", time: "10분 지연", tone: "down", icon: { kind: "silver", label: "Ag" } },
      { name: "구리(선물)", value: "6.2665", change: "▼ 0.0180 (-0.29%)", time: "10분 지연", tone: "down", icon: { kind: "copper", label: "Cu" } },
    ],
  },
] satisfies { title: string; rows: IndicatorRow[] }[];

const themeMetricLabels: { id: ThemeMetric; label: string }[] = [
  { id: "rate", label: "상승률" },
  { id: "volume", label: "거래량" },
  { id: "tradingValue", label: "거래대금" },
];

const themeTopGroups: Record<
  ThemeMetric,
  {
    industry: { name: string; value: string; tone: MarketTone; magnitude: number; hot?: boolean }[];
    theme: { name: string; value: string; tone: MarketTone; magnitude: number; hot?: boolean }[];
  }
> = {
  rate: {
    industry: [
      { name: "무선통신서비스", value: "+0.76%", tone: "up", magnitude: 0.76, hot: true },
      { name: "가정용품", value: "-1.05%", tone: "down", magnitude: -1.05 },
      { name: "운송인프라", value: "-1.61%", tone: "down", magnitude: -1.61 },
      { name: "광고", value: "-2.02%", tone: "down", magnitude: -2.02 },
      { name: "담배", value: "-2.23%", tone: "down", magnitude: -2.23 },
    ],
    theme: [
      { name: "기업인수목적회사", value: "-0.31%", tone: "down", magnitude: -0.31, hot: true },
      { name: "통신", value: "-1.45%", tone: "down", magnitude: -1.45 },
      { name: "국내 상장 중국기업", value: "-1.61%", tone: "down", magnitude: -1.61 },
      { name: "마켓컬리(Kurly)", value: "-1.72%", tone: "down", magnitude: -1.72 },
      { name: "리츠(REITs)", value: "-2.70%", tone: "down", magnitude: -2.7 },
    ],
  },
  volume: {
    industry: [
      { name: "반도체와반도체장비", value: "8,942만주", tone: "neutral", magnitude: 8942, hot: true },
      { name: "자동차", value: "6,314만주", tone: "neutral", magnitude: 6314 },
      { name: "은행", value: "5,986만주", tone: "neutral", magnitude: 5986 },
      { name: "전자장비와기기", value: "4,732만주", tone: "neutral", magnitude: 4732 },
      { name: "제약", value: "3,948만주", tone: "neutral", magnitude: 3948 },
    ],
    theme: [
      { name: "AI 반도체", value: "1.24억주", tone: "neutral", magnitude: 12400, hot: true },
      { name: "2차전지", value: "9,420만주", tone: "neutral", magnitude: 9420 },
      { name: "로봇", value: "7,885만주", tone: "neutral", magnitude: 7885 },
      { name: "방산", value: "6,012만주", tone: "neutral", magnitude: 6012 },
      { name: "저PBR", value: "5,489만주", tone: "neutral", magnitude: 5489 },
    ],
  },
  tradingValue: {
    industry: [
      { name: "반도체와반도체장비", value: "4조 8,831억", tone: "neutral", magnitude: 48831, hot: true },
      { name: "자동차", value: "2조 9,642억", tone: "neutral", magnitude: 29642 },
      { name: "은행", value: "2조 4,018억", tone: "neutral", magnitude: 24018 },
      { name: "인터넷과카탈로그소매", value: "1조 8,220억", tone: "neutral", magnitude: 18220 },
      { name: "조선", value: "1조 6,904억", tone: "neutral", magnitude: 16904 },
    ],
    theme: [
      { name: "AI 반도체", value: "6조 1,228억", tone: "neutral", magnitude: 61228, hot: true },
      { name: "2차전지", value: "3조 7,650억", tone: "neutral", magnitude: 37650 },
      { name: "전력설비", value: "2조 8,415억", tone: "neutral", magnitude: 28415 },
      { name: "방산", value: "2조 1,392억", tone: "neutral", magnitude: 21392 },
      { name: "로봇", value: "1조 9,887억", tone: "neutral", magnitude: 19887 },
    ],
  },
};

const investorTradingSummary = [
  { label: "개인", value: "+7,878억", amount: 7878, tone: "up" as const },
  { label: "외국인", value: "-11,033억", amount: -11033, tone: "down" as const },
  { label: "기관", value: "+2,634억", amount: 2634, tone: "up" as const },
];

const programTrendSeries = [
  {
    label: "차익거래순매수",
    color: "#f97316",
    values: [0, 1420, 920, 2700, 3650, 2480, 1960, 720],
  },
  {
    label: "비차익거래순매수",
    color: "#f6b100",
    values: [0, 20, -80, -420, -780, -1650, -1980, -2240],
  },
  {
    label: "전체순매수",
    color: "#a855f7",
    values: [0, 1380, 940, 2140, 3300, 1540, -820, -2380],
  },
];

const investorRankings = {
  buy: {
    foreign: [
      { name: "대한전선", price: "37,000", change: "-7.38%", volume: "1,509,759주", tone: "down" as const, mark: "D" },
      { name: "두산로보틱스", price: "132,100", change: "-5.84%", volume: "2,308,660주", tone: "down" as const, mark: "D" },
      { name: "삼성전자우", price: "197,600", change: "-6.35%", volume: "2,321,584주", tone: "down" as const, mark: "S" },
      { name: "SK스퀘어", price: "1,144,000", change: "-9.06%", volume: "282,455주", tone: "down" as const, mark: "SK" },
      { name: "삼성SDI", price: "505,000", change: "-11.09%", volume: "198,444주", tone: "down" as const, mark: "S" },
    ],
    institution: [
      { name: "삼성전기", price: "1,686,000", change: "-4.04%", volume: "577,567주", tone: "down" as const, mark: "S" },
      { name: "KODEX 200선물...", price: "101", change: "+14.77%", volume: "5,060,513,260주", tone: "up" as const, mark: "K" },
      { name: "원익IPS", price: "113,500", change: "-14.47%", volume: "837,923주", tone: "down" as const, mark: "W" },
      { name: "KODEX 인버스", price: "1,066", change: "+7.03%", volume: "345,835,949주", tone: "up" as const, mark: "K" },
      { name: "한미반도체", price: "259,500", change: "-8.30%", volume: "301,995주", tone: "down" as const, mark: "H" },
    ],
  },
  sell: {
    foreign: [
      { name: "삼성전자", price: "300,250", change: "-8.74%", volume: "14,592,532주", tone: "down" as const, mark: "S" },
      { name: "SK하이닉스", price: "1,956,000", change: "-5.51%", volume: "2,500,179주", tone: "down" as const, mark: "SK" },
      { name: "LG전자", price: "267,500", change: "-11.72%", volume: "1,490,160주", tone: "down" as const, mark: "L" },
      { name: "NAVER", price: "243,500", change: "-4.70%", volume: "1,566,189주", tone: "down" as const, mark: "N" },
      { name: "현대차", price: "630,000", change: "-10.00%", volume: "512,518주", tone: "down" as const, mark: "H" },
    ],
    institution: [
      { name: "KODEX 레버리지", price: "13,450", change: "-6.18%", volume: "11,944,210주", tone: "down" as const, mark: "K" },
      { name: "카카오", price: "82,300", change: "-3.47%", volume: "2,942,118주", tone: "down" as const, mark: "K" },
      { name: "셀트리온", price: "234,000", change: "-2.91%", volume: "774,930주", tone: "down" as const, mark: "C" },
      { name: "삼성바이오", price: "1,006,000", change: "+1.21%", volume: "181,402주", tone: "up" as const, mark: "S" },
      { name: "POSCO홀딩스", price: "405,000", change: "-5.22%", volume: "668,119주", tone: "down" as const, mark: "P" },
    ],
  },
};

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
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-extrabold transition focus-ring ${
                    activeTab === tab.id ? "bg-[#071832] text-white" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
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
      <div className="grid gap-6 xl:grid-cols-2">
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
  const [activeMetric, setActiveMetric] = useState<ThemeMetric>("rate");
  const activeData = themeTopGroups[activeMetric];

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <h2 className="text-2xl font-black text-[#071832]">업종·테마 TOP 5</h2>
        <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <span className="text-xs font-bold text-slate-500">KRX 기준</span>
      </div>
      <div className="mt-4 grid gap-4 border-t border-slate-100 bg-white md:grid-cols-[128px_1fr]">
        <div className="flex gap-2 overflow-x-auto bg-[#f8fafc] p-3 md:block md:space-y-2 md:overflow-visible md:p-4">
          {themeMetricLabels.map((metric) => (
            <button
              key={metric.id}
              type="button"
              onClick={() => setActiveMetric(metric.id)}
              aria-pressed={activeMetric === metric.id}
              className={`flex h-11 min-w-24 items-center justify-center rounded-lg px-4 text-sm font-black transition focus-ring md:w-full ${
                activeMetric === metric.id ? "bg-white text-[#071832] shadow-sm" : "text-slate-600 hover:bg-white/70 hover:text-[#071832]"
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
        <div className="grid gap-8 px-4 pb-5 md:grid-cols-2 md:px-6 md:py-5">
          <ThemeTopChart title="업종" metric={activeMetric} items={activeData.industry} />
          <ThemeTopChart title="테마" metric={activeMetric} items={activeData.theme} />
        </div>
      </div>
    </section>
  );
}

function ThemeTopChart({
  title,
  metric,
  items,
}: {
  title: string;
  metric: ThemeMetric;
  items: { name: string; value: string; tone: MarketTone; magnitude: number; hot?: boolean }[];
}) {
  const isRateMetric = metric === "rate";
  const chartData = items.map((item, index) => {
    const isPositive = item.magnitude >= 0;
    const color = isRateMetric ? (isPositive ? "#10b981" : "#5f6368") : index === 0 ? "#10b981" : "#5f6368";

    return {
      time: indexedChartDate(index),
      value: isRateMetric ? item.magnitude : Math.abs(item.magnitude),
      color,
    };
  });

  return (
    <div>
      <h3 className="text-center text-lg font-black text-[#071832]">{title}</h3>
      <LightweightHistogramChart
        className="mt-4 rounded-lg bg-[#f8fafc] p-2"
        data={chartData}
        height={176}
        compact
        interactive={false}
        decimals={isRateMetric ? 2 : 0}
        valueSuffix={isRateMetric ? "%" : ""}
        ariaLabel={title + " ranking histogram chart"}
      />
      <div className="mt-3 grid grid-cols-5 gap-2 text-center">
        {items.map((item, index) => (
          <div key={title + "-" + index} className="min-w-0">
            <p className="text-sm font-black text-[#071832]">{index + 1}</p>
            <p className="mt-1 flex items-center justify-center gap-0.5 truncate text-sm font-extrabold text-[#071832]">
              {item.hot && <span className="rounded bg-[#fff8e1] px-1 text-[10px] font-black text-[#8a6400]">HOT</span>}
              <span className="truncate">{item.name}</span>
            </p>
            <p className={"mt-1 text-sm font-black tabular-nums " + (isRateMetric ? toneClass(item.tone) : index === 0 ? "text-profit" : "text-slate-600")}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
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
  const [activeMarket, setActiveMarket] = useState("전체");
  const [activePeriod, setActivePeriod] = useState("1일");
  const [activeRankSide, setActiveRankSide] = useState<"buy" | "sell">("buy");
  const rankingData = investorRankings[activeRankSide];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#071832]">투자자별 매매 동향</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-[#071832] bg-white px-3 py-2 text-sm font-black text-[#071832] focus-ring">KRX</button>
            {["전체", "코스피", "코스닥"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setActiveMarket(item)}
                aria-pressed={activeMarket === item}
                className={`rounded-md border px-4 py-2 text-sm font-extrabold transition focus-ring ${
                  activeMarket === item ? "border-[#071832] bg-white text-[#071832] shadow-sm" : "border-slate-200 bg-[#f8fafc] text-slate-500 hover:bg-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="inline-flex w-fit rounded-lg bg-[#f8fafc] p-1">
          {["1일", "1주", "1개월", "3개월"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActivePeriod(item)}
              aria-pressed={activePeriod === item}
              className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition focus-ring ${
                activePeriod === item ? "bg-white text-[#071832] shadow-sm" : "text-slate-500 hover:bg-white hover:text-[#071832]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-7 xl:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 space-y-8">
          <div className="min-w-0 rounded-lg border border-slate-100 bg-white p-4">
            <p className="text-sm font-bold text-slate-500">2026. 06. 08. 기준</p>
            <div className="mt-2 flex items-center gap-1">
              <h3 className="text-xl font-black text-[#071832]">투자자 동향</h3>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-7 flex h-52 items-end justify-center gap-12 border-b border-slate-200 px-4 sm:gap-20">
              {investorTradingSummary.map((item) => {
                const baseline = 88;
                const height = 22 + (Math.abs(item.amount) / 11033) * 76;
                return (
                  <div key={item.label} className="flex w-24 flex-col items-center">
                    <div className="relative flex h-44 w-full items-center justify-center">
                      <div className="absolute left-0 right-0 h-px bg-slate-200" style={{ top: `${baseline}px` }} aria-hidden="true" />
                      <div
                        className={`absolute left-1/2 w-14 -translate-x-1/2 rounded transition-all duration-500 ${item.tone === "up" ? "bg-red-500" : "bg-blue-500"}`}
                        style={{
                          height: `${height}px`,
                          top: item.amount >= 0 ? `${baseline - height}px` : `${baseline}px`,
                        }}
                      />
                    </div>
                    <p className="mt-3 text-lg font-black text-[#071832]">{item.label}</p>
                    <p className={`mt-1 text-lg font-extrabold ${toneClass(item.tone)}`}>{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-100 bg-white p-4">
            <p className="text-sm font-bold text-slate-500">2026. 06. 08. 기준</p>
            <div className="mt-2 flex items-center gap-1">
              <h3 className="text-xl font-black text-[#071832]">프로그램 동향</h3>
              <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-600">
              {programTrendSeries.map((series) => (
                <span key={series.label} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} aria-hidden="true" />
                  {series.label}
                </span>
              ))}
            </div>
            <ProgramTrendChart series={programTrendSeries} />
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-slate-100 bg-white p-4">
          <p className="text-sm font-bold text-slate-500">2026. 06. 05. (전일) 기준</p>
          <h3 className="mt-2 text-xl font-black text-[#071832]">외국인 / 기관 종목 상위</h3>
          <div className="mt-4 inline-flex rounded-full bg-[#eef2f7] p-1">
            {[
              { id: "buy" as const, label: "순매수" },
              { id: "sell" as const, label: "순매도" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveRankSide(item.id)}
                aria-pressed={activeRankSide === item.id}
                className={`rounded-full px-4 py-2 text-sm font-black transition focus-ring ${
                  activeRankSide === item.id ? "bg-[#30343b] text-white" : "text-slate-500 hover:text-[#071832]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-6">
            <InvestorRankingTable title="외국인" rows={rankingData.foreign} />
            <InvestorRankingTable title="기관" rows={rankingData.institution} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgramTrendChart({
  series,
}: {
  series: { label: string; color: string; values: number[] }[];
}) {
  const chartSeries = series.map((item) => ({
    label: item.label,
    color: item.color,
    data: expandChartValues(item.values, 5).map((value, index) => ({
      time: indexedChartDate(index),
      value,
    })),
  }));

  return (
    <LightweightMultiLineChart
      className="mt-4 rounded-lg bg-white"
      series={chartSeries}
      height={256}
      decimals={0}
      ariaLabel="Program trading trend chart"
    />
  );
}

function InvestorRankingTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; price: string; change: string; volume: string; tone: MarketTone; mark: string }[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <h4 className="text-base font-black text-[#071832]">{title}</h4>
        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[520px] w-full text-sm">
          <thead className="border-b border-slate-200 text-xs font-bold text-slate-500">
            <tr>
              <th className="w-9 py-2 text-center" />
              <th className="py-2 text-left">종목</th>
              <th className="py-2 text-right">현재가</th>
              <th className="py-2 text-right">등락률</th>
              <th className="py-2 text-right">거래량</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${row.name}`} className="border-b border-slate-100 last:border-b-0">
                <td className="py-2 text-center font-black text-[#071832]">{index + 1}</td>
                <td className="py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#0f4c81] text-[10px] font-black text-white">{row.mark}</span>
                    <span className="truncate font-extrabold text-[#071832]">{row.name}</span>
                  </span>
                </td>
                <td className="py-2 text-right font-extrabold text-[#071832]">{row.price}</td>
                <td className={`py-2 text-right font-extrabold ${toneClass(row.tone)}`}>{row.change}</td>
                <td className="py-2 text-right font-bold text-[#071832]">{row.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function IndicatorTable({ title, rows }: { title: string; rows: IndicatorRow[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-[#071832]">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[540px] w-full text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="py-3 text-left">상품명</th>
              <th className="py-3 text-right">현재가</th>
              <th className="py-3 text-right">전일대비</th>
              <th className="py-3 text-right">기준 시간</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-slate-100 last:border-b-0">
                <td className="py-3 pr-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <IndicatorItemIcon icon={row.icon} />
                    <span className="truncate font-extrabold text-[#071832]">{row.name}</span>
                  </span>
                </td>
                <td className="py-3 text-right font-extrabold">{row.value}</td>
                <td className={`py-3 text-right font-extrabold ${toneClass(row.tone)}`}>{row.change}</td>
                <td className="py-3 text-right font-bold text-slate-500">{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IndicatorItemIcon({ icon }: { icon: IndicatorRow["icon"] }) {
  const iconStyles: Record<IndicatorIconKind, { Icon: LucideIcon; className: string }> = {
    country: { Icon: Flag, className: "bg-[#eef6ff] text-[#0f4c81]" },
    centralBank: { Icon: Landmark, className: "bg-[#f1f5f9] text-slate-600" },
    oil: { Icon: Droplet, className: "bg-[#e8f7f1] text-[#047857]" },
    fuel: { Icon: Fuel, className: "bg-[#fff4e6] text-[#b45309]" },
    gold: { Icon: Coins, className: "bg-[#fff8d6] text-[#8a6400]" },
    silver: { Icon: Coins, className: "bg-[#f1f5f9] text-[#64748b]" },
    copper: { Icon: Coins, className: "bg-[#fff1e8] text-[#b45309]" },
  };
  const { Icon, className } = iconStyles[icon.kind];

  return (
    <span className={`flex h-9 w-9 flex-none flex-col items-center justify-center rounded-lg ${className}`} aria-hidden="true">
      <Icon className="h-4 w-4" />
      <span className="mt-0.5 text-[8px] font-black leading-none tracking-normal">{icon.label}</span>
    </span>
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
  const chartData = expandChartValues(values, tall ? 4 : 3).map((value, index) => ({
    time: indexedChartDate(index),
    value,
  }));

  return (
    <LightweightAreaChart
      className="mt-4 rounded-lg bg-white/70"
      data={chartData}
      height={tall ? 176 : 128}
      compact={!tall}
      interactive={false}
      tone={tone}
      ariaLabel="Market trend sparkline chart"
    />
  );
}

function indexedChartDate(index: number) {
  return new Date(Date.UTC(2026, 5, index + 1)).toISOString().slice(0, 10);
}

function expandChartValues(values: number[], steps = 4) {
  if (values.length < 2) return values;

  const spread = Math.max(...values) - Math.min(...values) || 1;
  const expanded: number[] = [];

  values.forEach((value, index) => {
    const next = values[index + 1];
    if (next === undefined) {
      expanded.push(value);
      return;
    }

    for (let step = 0; step < steps; step += 1) {
      const ratio = step / steps;
      const eased = ratio * ratio * (3 - 2 * ratio);
      const curvature = Math.sin((index + ratio) * Math.PI) * spread * 0.012;
      expanded.push(Number((value + (next - value) * eased + curvature).toFixed(2)));
    }
  });

  return expanded;
}

function toneClass(tone: MarketTone) {
  if (tone === "up") return "text-profit";
  if (tone === "down") return "text-loss";
  return "text-neutral";
}
