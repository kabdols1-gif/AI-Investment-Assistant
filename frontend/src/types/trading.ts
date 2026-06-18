export type PriceTone = "up" | "down" | "neutral";

export interface TradingStockSummary {
  id: string;
  code: string;
  name: string;
  exchange: string;
  price: string;
  change: string;
  changeRate: string;
  tone: PriceTone;
  volume: string;
  tradingValue: string;
  iconUrl?: string;
  source: "mock" | "kb" | "kis" | "pending";
}

export interface OrderBookRow {
  askQuantity?: string;
  price: string;
  changeRate: string;
  bidQuantity?: string;
  tone: PriceTone;
}

export interface ExecutionRow {
  time: string;
  price: string;
  change: string;
  quantity: string;
  tone: PriceTone;
}

export interface BrokerTradeRow {
  rank: number;
  broker: string;
  buy: string;
  sell: string;
  net: string;
  tone: PriceTone;
}

export interface ChartCandle {
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CashSummary {
  label: string;
  value: string;
}

export interface OrderHistoryRow {
  time: string;
  side: string;
  price: string;
  quantity: string;
  status: string;
}

export interface ProfitLossSummary {
  label: string;
  value: string;
  tone: PriceTone;
}

export interface BalanceEvaluationRow {
  name: string;
  quantity: string;
  avgPrice: string;
  evalAmount: string;
  profitRate: string;
  tone: PriceTone;
}

export interface TradingWorkspaceData {
  stock: TradingStockSummary;
  orderBook: OrderBookRow[];
  executions: ExecutionRow[];
  brokerTrades: BrokerTradeRow[];
  chartCandles: ChartCandle[];
  cashSummary: CashSummary[];
  orderHistory: OrderHistoryRow[];
  profitLoss: ProfitLossSummary[];
  balanceEvaluation: BalanceEvaluationRow[];
}
