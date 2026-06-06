import type { RecentViewedStockItem } from "@/types/symbols";
import type { TradingWorkspaceData, TradingStockSummary } from "@/types/trading";

export type ScreenKey =
  | "home"
  | "my-strategy"
  | "strategy"
  | "watchlist"
  | "portfolio"
  | "notifications"
  | "settings"
  | "my-settings";

export type NavScreenKey = Exclude<ScreenKey, "strategy" | "my-settings">;

export type RiskLevel = "낮음" | "보통" | "높음";

export interface ScreenMeta {
  key: ScreenKey;
  href: string;
  label: string;
  title: string;
  subtitle: string;
  placeholder: string;
}

export const screenMeta: Record<ScreenKey, ScreenMeta> = {
  home: {
    key: "home",
    href: "/home",
    label: "홈",
    title: "홈",
    subtitle: "오늘의 투자 현황과 AI 브리핑",
    placeholder: "무엇을 도와드릴까요? 예: 오늘 시장 브리핑 들려줘",
  },
  "my-strategy": {
    key: "my-strategy",
    href: "/my-strategy",
    label: "내전략",
    title: "내전략",
    subtitle: "저장한 전략과 실행 상태 관리",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 오늘 내 전략 상태 알려줘",
  },
  strategy: {
    key: "strategy",
    href: "/strategy",
    label: "전략제안",
    title: "전략제안",
    subtitle: "투자성향과 시장 흐름에 맞춘 AI 전략 후보",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 오늘 추천 전략 알려줘",
  },
  watchlist: {
    key: "watchlist",
    href: "/watchlist",
    label: "관심종목",
    title: "관심종목",
    subtitle: "관심 종목의 시그널, 뉴스, 알림 관리",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 오늘 관심 종목 알려줘",
  },
  portfolio: {
    key: "portfolio",
    href: "/portfolio",
    label: "포트폴리오",
    title: "포트폴리오",
    subtitle: "성과, 위험, 리밸런싱 제안을 한눈에",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 오늘 포트폴리오 성과 알려줘",
  },
  notifications: {
    key: "notifications",
    href: "/notifications",
    label: "알림",
    title: "알림",
    subtitle: "체결, 시세, 전략, 리스크 변화를 빠르게 확인",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 오늘 알림 알려줘",
  },
  settings: {
    key: "settings",
    href: "/settings",
    label: "설정",
    title: "설정",
    subtitle: "LLM API Key 관리와 OpenAPI 연동 상태",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 오늘 설정 알려줘",
  },
  "my-settings": {
    key: "my-settings",
    href: "/my-settings",
    label: "내 설정",
    title: "내 설정",
    subtitle: "개인 환경과 앱 기본 설정 관리",
    placeholder: "음성으로 말하거나 직접 입력하세요. 예: 내 설정 열어줘",
  },
};

export const navScreens: NavScreenKey[] = [
  "home",
  "my-strategy",
  "watchlist",
  "portfolio",
  "notifications",
  "settings",
];

export const assetSummary = {
  totalAsset: "128,450,000원",
  todayProfit: "+1,250,000원",
  todayProfitRate: "+0.98%",
  cumulativeReturn: "+8.24%",
  availableCash: "12,300,000원",
};

export type MarketTone = "up" | "down" | "neutral";

export const marketOverview: {
  id: string;
  label: string;
  primary: string;
  change: string;
  secondary: string;
  tone: MarketTone;
}[] = [
  {
    id: "domestic-stock",
    label: "국내 증시",
    primary: "KOSPI 2,742.31",
    change: "+0.84%",
    secondary: "KOSDAQ +0.42%",
    tone: "up",
  },
  {
    id: "global-stock",
    label: "해외 증시",
    primary: "S&P 500 5,312.20",
    change: "-0.18%",
    secondary: "NASDAQ -0.05%",
    tone: "down",
  },
  {
    id: "fx",
    label: "환율",
    primary: "USD/KRW 1,372.40",
    change: "+3.20원",
    secondary: "JPY/KRW 9.42",
    tone: "up",
  },
  {
    id: "interest-rate",
    label: "금리",
    primary: "미 10년 4.32%",
    change: "-2bp",
    secondary: "국고 3년 3.21%",
    tone: "down",
  },
  {
    id: "oil",
    label: "유가",
    primary: "WTI $78.24",
    change: "+1.12%",
    secondary: "Brent $82.05",
    tone: "up",
  },
  {
    id: "gold",
    label: "금시세",
    primary: "Gold $2,356.80",
    change: "+0.36%",
    secondary: "국내 금 104,200원/g",
    tone: "up",
  },
  {
    id: "commodities",
    label: "원자재",
    primary: "구리 $9,840",
    change: "-0.44%",
    secondary: "곡물 혼조",
    tone: "down",
  },
];

export const recentViewedStocks: RecentViewedStockItem[] = [
  {
    id: "005930",
    code: "005930",
    name: "삼성전자",
    price: "66,200",
    changeRate: "-1.53%",
    changeDirection: "down",
    iconUrl: "https://www.google.com/s2/favicons?domain=samsung.com&sz=64",
  },
  {
    id: "000660",
    code: "000660",
    name: "SK하이닉스",
    price: "193,500",
    changeRate: "+2.61%",
    changeDirection: "up",
    iconUrl: "https://www.google.com/s2/favicons?domain=skhynix.com&sz=64",
  },
  {
    id: "035420",
    code: "035420",
    name: "NAVER",
    price: "204,000",
    changeRate: "-0.48%",
    changeDirection: "down",
    iconUrl: "https://www.google.com/s2/favicons?domain=naver.com&sz=64",
  },
  {
    id: "373220",
    code: "373220",
    name: "LG에너지솔루션",
    price: "362,500",
    changeRate: "+0.33%",
    changeDirection: "up",
    iconUrl: "https://www.google.com/s2/favicons?domain=lgensol.com&sz=64",
  },
  {
    id: "005380",
    code: "005380",
    name: "현대차",
    price: "229,000",
    changeRate: "+1.11%",
    changeDirection: "up",
    iconUrl: "https://www.google.com/s2/favicons?domain=hyundai.com&sz=64",
  },
];

const demoOrderBook = [
  { askQuantity: "52,303", price: "66,250", changeRate: "-1.80%", tone: "down" as const },
  { askQuantity: "31,336", price: "66,240", changeRate: "-1.65%", tone: "down" as const },
  { askQuantity: "78,012", price: "66,230", changeRate: "-1.55%", tone: "down" as const },
  { askQuantity: "36,981", price: "66,220", changeRate: "-1.25%", tone: "down" as const },
  { askQuantity: "21,108", price: "66,210", changeRate: "-1.20%", tone: "down" as const },
  { price: "66,200", changeRate: "-1.53%", bidQuantity: "552", tone: "down" as const },
  { price: "66,190", changeRate: "+1.38%", bidQuantity: "552", tone: "up" as const },
  { price: "66,180", changeRate: "+1.22%", bidQuantity: "231", tone: "up" as const },
  { price: "66,170", changeRate: "+1.07%", bidQuantity: "417", tone: "up" as const },
  { price: "66,160", changeRate: "+0.91%", bidQuantity: "125", tone: "up" as const },
  { price: "66,150", changeRate: "+0.76%", bidQuantity: "269", tone: "up" as const },
];

const demoExecutions = [
  { time: "09:30:12", price: "66,200", change: "-1,030", quantity: "1,240", tone: "down" as const },
  { time: "09:30:09", price: "66,210", change: "-1,020", quantity: "820", tone: "down" as const },
  { time: "09:30:05", price: "66,190", change: "-1,040", quantity: "1,580", tone: "down" as const },
  { time: "09:29:58", price: "66,230", change: "-1,000", quantity: "640", tone: "down" as const },
  { time: "09:29:51", price: "66,250", change: "-980", quantity: "2,010", tone: "down" as const },
  { time: "09:29:44", price: "66,220", change: "-1,010", quantity: "430", tone: "down" as const },
];

const demoBrokerTrades = [
  { rank: 1, broker: "KB증권", buy: "142,300", sell: "98,210", net: "+44,090", tone: "up" as const },
  { rank: 2, broker: "한국투자", buy: "121,804", sell: "130,004", net: "-8,200", tone: "down" as const },
  { rank: 3, broker: "NH투자", buy: "92,420", sell: "74,118", net: "+18,302", tone: "up" as const },
  { rank: 4, broker: "키움증권", buy: "88,010", sell: "91,440", net: "-3,430", tone: "down" as const },
  { rank: 5, broker: "LS증권", buy: "61,204", sell: "58,992", net: "+2,212", tone: "up" as const },
];

const demoChartCandles = [
  { label: "2025", open: 62600, high: 63300, low: 62100, close: 62900, volume: 1120 },
  { label: "1월", open: 62900, high: 63700, low: 62500, close: 63400, volume: 980 },
  { label: "", open: 63400, high: 64100, low: 63200, close: 63800, volume: 1210 },
  { label: "2월", open: 63800, high: 64600, low: 63300, close: 63200, volume: 1040 },
  { label: "", open: 63200, high: 65100, low: 63000, close: 64700, volume: 1400 },
  { label: "3월", open: 64700, high: 66200, low: 64200, close: 65900, volume: 1680 },
  { label: "", open: 65900, high: 67100, low: 65500, close: 66700, volume: 1510 },
  { label: "4월", open: 66700, high: 68200, low: 66400, close: 67900, volume: 1810 },
  { label: "", open: 67900, high: 69500, low: 67600, close: 69000, volume: 2140 },
  { label: "5월", open: 69000, high: 70100, low: 67200, close: 67600, volume: 2260 },
  { label: "", open: 67600, high: 68100, low: 64500, close: 65200, volume: 2900 },
  { label: "", open: 65200, high: 66800, low: 63200, close: 66100, volume: 3100 },
  { label: "6월", open: 66100, high: 67200, low: 65800, close: 66200, volume: 1860 },
];

const baseTradingSummaries: TradingStockSummary[] = [
  {
    id: "005930",
    code: "005930",
    name: "삼성전자",
    exchange: "KRX",
    price: "66,200",
    change: "▼ 1,030",
    changeRate: "-1.53%",
    tone: "down",
    volume: "11,683,393",
    tradingValue: "772,104백만",
    iconUrl: "https://www.google.com/s2/favicons?domain=samsung.com&sz=64",
    source: "mock",
  },
  {
    id: "000660",
    code: "000660",
    name: "SK하이닉스",
    exchange: "KRX",
    price: "193,500",
    change: "▲ 4,900",
    changeRate: "+2.61%",
    tone: "up",
    volume: "4,824,001",
    tradingValue: "932,188백만",
    iconUrl: "https://www.google.com/s2/favicons?domain=skhynix.com&sz=64",
    source: "mock",
  },
  {
    id: "035420",
    code: "035420",
    name: "NAVER",
    exchange: "KRX",
    price: "204,000",
    change: "▼ 1,000",
    changeRate: "-0.48%",
    tone: "down",
    volume: "703,882",
    tradingValue: "143,614백만",
    iconUrl: "https://www.google.com/s2/favicons?domain=naver.com&sz=64",
    source: "mock",
  },
  {
    id: "373220",
    code: "373220",
    name: "LG에너지솔루션",
    exchange: "KRX",
    price: "362,500",
    change: "▲ 1,200",
    changeRate: "+0.33%",
    tone: "up",
    volume: "218,905",
    tradingValue: "79,352백만",
    iconUrl: "https://www.google.com/s2/favicons?domain=lgensol.com&sz=64",
    source: "mock",
  },
  {
    id: "005380",
    code: "005380",
    name: "현대차",
    exchange: "KRX",
    price: "229,000",
    change: "▲ 2,500",
    changeRate: "+1.11%",
    tone: "up",
    volume: "1,104,020",
    tradingValue: "252,821백만",
    iconUrl: "https://www.google.com/s2/favicons?domain=hyundai.com&sz=64",
    source: "mock",
  },
];

function createTradingWorkspaceData(stock: TradingStockSummary): TradingWorkspaceData {
  return {
    stock,
    orderBook: demoOrderBook,
    executions: demoExecutions,
    brokerTrades: demoBrokerTrades,
    chartCandles: demoChartCandles,
    cashSummary: [
      { label: "예수금", value: "123,000,000원" },
      { label: "주문가능", value: "112,480,000원" },
      { label: "D+2 추정", value: "118,920,000원" },
      { label: "미수/증거금", value: "0원 / 40%" },
    ],
    orderHistory: [
      { time: "09:31:20", side: "매수", price: stock.price, quantity: "10주", status: "preview" },
      { time: "09:12:04", side: "정정", price: stock.price, quantity: "5주", status: "대기" },
      { time: "08:58:11", side: "취소", price: "66,500", quantity: "3주", status: "완료" },
    ],
    profitLoss: [
      { label: "금일 실현손익", value: "+238,000원", tone: "up" },
      { label: "금일 평가손익", value: "-412,000원", tone: "down" },
      { label: "누적 수익률", value: "+8.24%", tone: "up" },
      { label: "수수료/세금", value: "18,240원", tone: "neutral" },
    ],
    balanceEvaluation: [
      { name: "삼성전자", quantity: "120주", avgPrice: "64,800", evalAmount: "7,944,000", profitRate: "+2.16%", tone: "up" },
      { name: "SK하이닉스", quantity: "28주", avgPrice: "181,200", evalAmount: "5,418,000", profitRate: "+6.78%", tone: "up" },
      { name: "NAVER", quantity: "15주", avgPrice: "211,500", evalAmount: "3,060,000", profitRate: "-3.55%", tone: "down" },
    ],
  };
}

export const tradingWorkspaceByStockId: Record<string, TradingWorkspaceData> = Object.fromEntries(
  baseTradingSummaries.map((stock) => [stock.id, createTradingWorkspaceData(stock)])
);

export const quickActions = [
  { label: "내전략", href: "/my-strategy", description: "전략 상태 확인" },
  { label: "전략제안", href: "/strategy", description: "AI 추천 전략" },
  { label: "관심종목", href: "/watchlist", description: "종목 시그널" },
  { label: "포트폴리오", href: "/portfolio", description: "성과와 리스크" },
  { label: "알림", href: "/notifications", description: "중요 변화" },
  { label: "설정", href: "/settings", description: "연동과 보안" },
];

export const watchItems = [
  {
    symbol: "005930",
    name: "삼성전자",
    market: "domestic",
    marketLabel: "국내",
    exchange: "KRX",
    price: "82,500",
    changeRate: "+1.23%",
    volumeAmount: "1,234억",
    aiComment: "실적 모멘텀 지속, AI 수요 증가 기대",
    signal: "매수",
    targetPrice: "90,000",
    stopLossPrice: "74,000",
    favorite: true,
  },
  {
    symbol: "035720",
    name: "카카오",
    market: "domestic",
    marketLabel: "국내",
    exchange: "KRX",
    price: "62,100",
    changeRate: "-0.82%",
    volumeAmount: "856억",
    aiComment: "플랫폼 개선 기대, 광고 회복 관찰",
    signal: "중립",
    targetPrice: "68,000",
    stopLossPrice: "56,000",
    favorite: false,
  },
  {
    symbol: "035420",
    name: "네이버",
    market: "domestic",
    marketLabel: "국내",
    exchange: "KRX",
    price: "198,700",
    changeRate: "+0.65%",
    volumeAmount: "1,987억",
    aiComment: "검색/커머스 회복세, AI 서비스 확대",
    signal: "매수",
    targetPrice: "220,000",
    stopLossPrice: "170,000",
    favorite: true,
  },
  {
    symbol: "373220",
    name: "LG에너지솔루션",
    market: "domestic",
    marketLabel: "국내",
    exchange: "KRX",
    price: "395,000",
    changeRate: "-1.15%",
    volumeAmount: "1,234억",
    aiComment: "전기차 수요 둔화 우려, 단기 변동성",
    signal: "관망",
    targetPrice: "430,000",
    stopLossPrice: "350,000",
    favorite: false,
  },
  {
    symbol: "005380",
    name: "현대차",
    market: "domestic",
    marketLabel: "국내",
    exchange: "KRX",
    price: "225,000",
    changeRate: "+1.80%",
    volumeAmount: "1,567억",
    aiComment: "하이브리드 판매 호조, 수익성 개선 기대",
    signal: "매수",
    targetPrice: "245,000",
    stopLossPrice: "195,000",
    favorite: true,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    market: "overseas",
    marketLabel: "해외",
    exchange: "NASDAQ",
    price: "$1,145.20",
    changeRate: "+2.14%",
    volumeAmount: "$38.2B",
    aiComment: "AI 가속기 수요 강세, 데이터센터 매출 지속 확인",
    signal: "매수",
    targetPrice: "$1,260.00",
    stopLossPrice: "$1,020.00",
    favorite: true,
  },
  {
    symbol: "AAPL",
    name: "Apple",
    market: "overseas",
    marketLabel: "해외",
    exchange: "NASDAQ",
    price: "$214.70",
    changeRate: "-0.34%",
    volumeAmount: "$11.5B",
    aiComment: "서비스 매출은 견조하나 단기 제품 사이클 확인 필요",
    signal: "중립",
    targetPrice: "$232.00",
    stopLossPrice: "$198.00",
    favorite: false,
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    market: "overseas",
    marketLabel: "해외",
    exchange: "NASDAQ",
    price: "$184.60",
    changeRate: "+0.91%",
    volumeAmount: "$17.8B",
    aiComment: "자율주행 모멘텀은 유효, 마진 변동성 관리 필요",
    signal: "관망",
    targetPrice: "$205.00",
    stopLossPrice: "$165.00",
    favorite: false,
  },
];

export const strategyRecommendations = [
  {
    id: "global-ai-growth",
    name: "글로벌 AI 성장주 전략",
    type: "AI · 성장주 · 글로벌",
    expectedReturn: "+18.6%",
    risk: "높음" as RiskLevel,
    suitability: "92%",
    period: "3년 이상",
    summary: "AI 산업의 장기 성장성과 실적 개선 가능성을 함께 보는 성장형 전략입니다.",
  },
  {
    id: "us-dividend-growth",
    name: "미국 배당 성장 전략",
    type: "배당 · 성장 · 미국",
    expectedReturn: "+12.4%",
    risk: "보통" as RiskLevel,
    suitability: "88%",
    period: "2년 이상",
    summary: "현금흐름이 견조한 배당 성장주로 변동성을 낮추는 전략입니다.",
  },
  {
    id: "green-theme",
    name: "친환경 테마 전략",
    type: "ESG · 친환경 · 글로벌",
    expectedReturn: "+14.2%",
    risk: "보통" as RiskLevel,
    suitability: "83%",
    period: "3년 이상",
    summary: "정책 모멘텀과 산업 전환 수혜를 함께 추적합니다.",
  },
  {
    id: "bond-risk-balance",
    name: "채권 리스크 분산 전략",
    type: "채권 · 리츠 · 분산",
    expectedReturn: "+6.2%",
    risk: "낮음" as RiskLevel,
    suitability: "78%",
    period: "1년 이상",
    summary: "채권과 현금성 자산 비중을 높여 방어력을 확보합니다.",
  },
];

export const myStrategies = [
  {
    id: "dividend-growth",
    name: "배당 성장 포트폴리오",
    target: "국내 배당주",
    status: "실행 중",
    recentRun: "2026.06.03",
    returnRate: "+9.8%",
    risk: "보통" as RiskLevel,
    enabled: true,
  },
  {
    id: "ai-semiconductor",
    name: "AI 반도체 선도주 전략",
    target: "삼성전자, SK하이닉스",
    status: "실행 중",
    recentRun: "2026.06.02",
    returnRate: "+14.2%",
    risk: "높음" as RiskLevel,
    enabled: true,
  },
  {
    id: "mean-reversion",
    name: "단기 과매도 반등 전략",
    target: "KOSPI200",
    status: "중지",
    recentRun: "2026.05.29",
    returnRate: "+3.1%",
    risk: "보통" as RiskLevel,
    enabled: false,
  },
];

export const portfolioList = [
  { name: "성장 포트폴리오", value: "128,450,000원", returnRate: "+0.98%", weight: "42%" },
  { name: "배당 포트폴리오", value: "86,230,000원", returnRate: "+6.71%", weight: "28%" },
  { name: "글로벌 테크 포트폴리오", value: "72,100,000원", returnRate: "+12.36%", weight: "22%" },
  { name: "은퇴 준비 포트폴리오", value: "54,300,000원", returnRate: "+5.12%", weight: "8%" },
];

export const assetAllocation = [
  { category: "주식", weight: 65.2, color: "#2563eb" },
  { category: "채권", weight: 18.7, color: "#f59e0b" },
  { category: "대체", weight: 9.8, color: "#22c55e" },
  { category: "현금성", weight: 6.3, color: "#94a3b8" },
];

export const notifications = [
  {
    id: "n1",
    type: "체결",
    title: "체결 알림",
    message: "삼성전자 100주 매수 주문이 체결되었습니다.",
    time: "09:30",
    importance: 3,
    read: false,
    action: "상세보기",
  },
  {
    id: "n2",
    type: "시세",
    title: "시세 알림",
    message: "삼성전자 현재가가 66,200원으로 하락했습니다.",
    time: "09:28",
    importance: 2,
    read: false,
    action: "상세보기",
  },
  {
    id: "n3",
    type: "전략",
    title: "전략 업데이트",
    message: "성장주 집중 전략의 리밸런싱이 완료되었습니다.",
    time: "09:15",
    importance: 2,
    read: true,
    action: "상세보기",
  },
  {
    id: "n4",
    type: "리스크",
    title: "리스크 경고",
    message: "포트폴리오 변동성이 설정 기준을 초과했습니다.",
    time: "09:10",
    importance: 3,
    read: false,
    action: "실행",
  },
  {
    id: "n5",
    type: "이슈",
    title: "관심종목 이슈",
    message: "카카오, 2분기 실적 발표 예정입니다.",
    time: "08:50",
    importance: 1,
    read: true,
    action: "상세보기",
  },
];

export const settingsRows = [
  { title: "투자성향 설정", value: "중립형", description: "나의 투자성향과 목표를 설정하세요." },
  { title: "알림 설정", value: "푸시 ON", description: "푸시, 이메일, 라인 연동을 관리합니다." },
  { title: "보안/인증 설정", value: "2단계 인증 ON", description: "PIN, 생체인증, 비밀번호를 관리합니다." },
  { title: "음성 인터페이스 설정", value: "기본 목소리 · 보통", description: "음성 종류, 속도, 언어를 설정합니다." },
  { title: "테마 선택", value: "기본", description: "서비스 화면 테마를 선택합니다." },
  { title: "권한 및 개인정보 설정", value: "정상", description: "개인정보와 권한 사용 범위를 관리합니다." },
];
