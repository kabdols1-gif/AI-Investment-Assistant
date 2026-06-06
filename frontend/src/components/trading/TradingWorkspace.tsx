"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  ChevronDown,
  Maximize2,
  MoreHorizontal,
  Minus,
  Plus,
  RotateCcw,
  Settings,
  Star,
} from "lucide-react";
import { useToast } from "@/components/ui";
import type {
  BalanceEvaluationRow,
  BrokerTradeRow,
  ChartCandle,
  ExecutionRow,
  OrderBookRow,
  OrderHistoryRow,
  PriceTone,
  ProfitLossSummary,
  TradingWorkspaceData,
} from "@/types/trading";

type InfoTab = "호가" | "체결" | "거래원";
type OrderTab = "매수" | "매도" | "정정" | "취소";
type BottomTab = "차트" | "예수금" | "주문내역" | "매매손익" | "잔고평가";

const infoTabs: InfoTab[] = ["호가", "체결", "거래원"];
const orderTabs: OrderTab[] = ["매수", "매도", "정정", "취소"];
const bottomTabs: BottomTab[] = ["차트", "예수금", "주문내역", "매매손익", "잔고평가"];
const orderTypes = ["보통", "시장가", "조건부", "최유리"];
const ratios = ["10%", "25%", "50%", "100%", "직접"];
const chartPeriods = ["1분", "5분", "15분", "30분", "일", "주", "월"];

interface TradingWorkspaceProps {
  data: TradingWorkspaceData;
}

export function TradingWorkspace({ data }: TradingWorkspaceProps) {
  const toast = useToast();
  const [infoTab, setInfoTab] = useState<InfoTab>("호가");
  const [orderTab, setOrderTab] = useState<OrderTab>("매수");
  const [bottomTab, setBottomTab] = useState<BottomTab>("차트");
  const [orderType, setOrderType] = useState("보통");
  const [ratio, setRatio] = useState("직접");
  const [period, setPeriod] = useState("일");
  const [favorite, setFavorite] = useState(true);
  const [autoPriority, setAutoPriority] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [price, setPrice] = useState(data.stock.price);
  const [quantity, setQuantity] = useState("0");

  const orderAmount = useMemo(() => {
    const priceNumber = toNumber(price);
    const quantityNumber = toNumber(quantity);
    return priceNumber * quantityNumber;
  }, [price, quantity]);

  const previewOrder = () => {
    toast.info(`${data.stock.name} ${orderTab} 주문 preview가 생성되었습니다. 실전 주문은 제출되지 않았습니다.`);
  };

  const resetOrder = () => {
    setOrderType("보통");
    setRatio("직접");
    setPrice(data.stock.price);
    setQuantity("0");
    setAutoPriority(true);
    setAutoConfirm(false);
  };

  return (
    <div className="space-y-2">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <StockHeader data={data} favorite={favorite} onFavoriteToggle={() => setFavorite((current) => !current)} />

        <div className="mt-2 grid gap-2 2xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
          <MarketInfoPanel activeTab={infoTab} data={data} onTabChange={setInfoTab} />
          <OrderFormPanel
            activeTab={orderTab}
            amount={orderAmount}
            autoConfirm={autoConfirm}
            autoPriority={autoPriority}
            orderType={orderType}
            price={price}
            quantity={quantity}
            ratio={ratio}
            onAutoConfirmChange={setAutoConfirm}
            onAutoPriorityChange={setAutoPriority}
            onOrderTypeChange={setOrderType}
            onPreview={previewOrder}
            onPriceChange={setPrice}
            onQuantityChange={setQuantity}
            onRatioChange={setRatio}
            onReset={resetOrder}
            onTabChange={setOrderTab}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 pt-2">
          {bottomTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBottomTab(tab)}
            className={`h-8 rounded-t-md px-3 text-xs font-extrabold transition focus-ring ${
                tab === bottomTab
                  ? "border-b-2 border-[#1d4ed8] text-[#071832]"
                  : "text-slate-500 hover:bg-[#fff8e1] hover:text-[#071832]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-2">
          {bottomTab === "차트" && (
            <ChartPanel candles={data.chartCandles} period={period} onPeriodChange={setPeriod} stockName={data.stock.name} />
          )}
          {bottomTab === "예수금" && <CashPanel rows={data.cashSummary} />}
          {bottomTab === "주문내역" && <OrderHistoryPanel rows={data.orderHistory} />}
          {bottomTab === "매매손익" && <ProfitLossPanel rows={data.profitLoss} />}
          {bottomTab === "잔고평가" && <BalancePanel rows={data.balanceEvaluation} />}
        </div>
      </section>
    </div>
  );
}

function StockHeader({
  data,
  favorite,
  onFavoriteToggle,
}: {
  data: TradingWorkspaceData;
  favorite: boolean;
  onFavoriteToggle: () => void;
}) {
  const { stock } = data;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-normal text-[#071832]">{stock.name}</h1>
          <span className="text-sm font-extrabold text-slate-500">{stock.code}</span>
          <button
            type="button"
            onClick={onFavoriteToggle}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-[#fff8e1] focus-ring ${
              favorite ? "text-[#f6b100]" : "text-slate-400"
            }`}
            aria-label={favorite ? "관심 종목 해제" : "관심 종목 지정"}
            title={favorite ? "관심 종목 해제" : "관심 종목 지정"}
          >
            <Star className="h-4 w-4" fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className={`text-3xl font-black tabular-nums ${toneTextClass(stock.tone)}`}>{stock.price}</span>
          <span className={`text-base font-extrabold tabular-nums ${toneTextClass(stock.tone)}`}>{stock.change}</span>
          <span className={`text-base font-extrabold tabular-nums ${toneTextClass(stock.tone)}`}>{stock.changeRate}</span>
          <span className="rounded-full bg-[#f8fafc] px-2 py-1 text-[11px] font-bold text-slate-500">source=mock</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
        <div>
          <dt className="font-bold text-slate-500">거래량</dt>
          <dd className="mt-1 font-extrabold tabular-nums text-[#071832]">{stock.volume}</dd>
        </div>
        <div>
          <dt className="font-bold text-slate-500">거래대금</dt>
          <dd className="mt-1 font-extrabold tabular-nums text-[#071832]">{stock.tradingValue}</dd>
        </div>
      </dl>
    </div>
  );
}

function MarketInfoPanel({
  activeTab,
  data,
  onTabChange,
}: {
  activeTab: InfoTab;
  data: TradingWorkspaceData;
  onTabChange: (tab: InfoTab) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[96px_1fr] border-b border-slate-200">
        <div className="flex items-center justify-center text-xs font-extrabold text-[#1d4ed8]">현재가</div>
        <div className="grid grid-cols-3">
          {infoTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`h-9 border-l border-slate-100 text-xs font-extrabold transition focus-ring ${
                tab === activeTab ? "border-b-2 border-[#1d4ed8] text-[#1d4ed8]" : "text-slate-500 hover:bg-[#f8fafc]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "호가" && <OrderBookPanel rows={data.orderBook} currentPrice={data.stock.price} />}
      {activeTab === "체결" && <ExecutionPanel rows={data.executions} />}
      {activeTab === "거래원" && <BrokerPanel rows={data.brokerTrades} />}
    </div>
  );
}

function OrderBookPanel({ rows, currentPrice }: { rows: OrderBookRow[]; currentPrice: string }) {
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[0.7fr_1fr_0.8fr_0.9fr_1fr_0.7fr] border-b border-slate-100 bg-[#f8fafc] px-2 py-1.5 text-center text-[11px] font-extrabold text-slate-500">
        <span>수량</span>
        <span>매도잔량</span>
        <span>호가</span>
        <span>등락률</span>
        <span>매수잔량</span>
        <span>수량</span>
      </div>
      <div>
        {rows.map((row, index) => {
          const isCurrent = row.price === currentPrice;
          return (
            <div
              key={`${row.price}-${index}`}
              className={`grid grid-cols-[0.7fr_1fr_0.8fr_0.9fr_1fr_0.7fr] items-center px-2 py-1 text-center text-xs ${
                isCurrent ? "border-y border-[#1d4ed8] bg-blue-50" : index < 5 ? "bg-blue-50/35" : "bg-red-50/35"
              }`}
            >
              <span className="text-slate-500">{index < 5 ? "" : "552"}</span>
              <span className="font-bold tabular-nums text-slate-600">{row.askQuantity ?? ""}</span>
              <span className={`font-black tabular-nums ${toneTextClass(row.tone)}`}>{row.price}</span>
              <span className={`font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.changeRate}</span>
              <span className="font-bold tabular-nums text-slate-600">{row.bidQuantity ?? ""}</span>
              <span className="text-slate-500">{index >= 5 ? "" : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 border-t border-slate-200 px-3 py-2 text-xs font-extrabold">
        <span className="text-blue-600">총매도 2,568,934</span>
        <span className="text-center text-blue-600">-1,030</span>
        <span className="text-right text-red-500">총매수 2,093,416</span>
      </div>
    </div>
  );
}

function ExecutionPanel({ rows }: { rows: ExecutionRow[] }) {
  return (
    <div className="p-2">
      <div className="grid grid-cols-4 rounded-t-md bg-[#f8fafc] px-3 py-1.5 text-center text-xs font-extrabold text-slate-500">
        <span>시간</span>
        <span>체결가</span>
        <span>대비</span>
        <span>체결량</span>
      </div>
      {rows.map((row) => (
        <div key={`${row.time}-${row.quantity}`} className="grid grid-cols-4 border-b border-slate-100 px-3 py-1.5 text-center text-xs">
          <span className="tabular-nums text-slate-500">{row.time}</span>
          <span className={`font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.price}</span>
          <span className={`font-bold tabular-nums ${toneTextClass(row.tone)}`}>{row.change}</span>
          <span className="font-bold tabular-nums text-[#071832]">{row.quantity}</span>
        </div>
      ))}
    </div>
  );
}

function BrokerPanel({ rows }: { rows: BrokerTradeRow[] }) {
  return (
    <div className="p-2">
      <div className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_1fr] rounded-t-md bg-[#f8fafc] px-3 py-1.5 text-center text-xs font-extrabold text-slate-500">
        <span>순위</span>
        <span>거래원</span>
        <span>매수</span>
        <span>매도</span>
        <span>순매수</span>
      </div>
      {rows.map((row) => (
        <div key={row.rank} className="grid grid-cols-[0.5fr_1.2fr_1fr_1fr_1fr] border-b border-slate-100 px-3 py-1.5 text-center text-xs">
          <span className="font-bold text-slate-500">{row.rank}</span>
          <span className="font-extrabold text-[#071832]">{row.broker}</span>
          <span className="tabular-nums text-red-500">{row.buy}</span>
          <span className="tabular-nums text-blue-600">{row.sell}</span>
          <span className={`font-extrabold tabular-nums ${toneTextClass(row.tone)}`}>{row.net}</span>
        </div>
      ))}
    </div>
  );
}

function OrderFormPanel({
  activeTab,
  amount,
  autoConfirm,
  autoPriority,
  orderType,
  price,
  quantity,
  ratio,
  onAutoConfirmChange,
  onAutoPriorityChange,
  onOrderTypeChange,
  onPreview,
  onPriceChange,
  onQuantityChange,
  onRatioChange,
  onReset,
  onTabChange,
}: {
  activeTab: OrderTab;
  amount: number;
  autoConfirm: boolean;
  autoPriority: boolean;
  orderType: string;
  price: string;
  quantity: string;
  ratio: string;
  onAutoConfirmChange: (checked: boolean) => void;
  onAutoPriorityChange: (checked: boolean) => void;
  onOrderTypeChange: (value: string) => void;
  onPreview: () => void;
  onPriceChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onRatioChange: (value: string) => void;
  onReset: () => void;
  onTabChange: (tab: OrderTab) => void;
}) {
  const actionClass = activeTab === "매도" ? "bg-[#1d4ed8] hover:bg-[#1e40af]" : "bg-[#ef233c] hover:bg-[#d90429]";
  const actionText = activeTab === "정정" ? "정정 요청" : activeTab === "취소" ? "취소 요청" : `${activeTab} 주문`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-4 border-b border-slate-200">
        {orderTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`h-9 border-l border-slate-100 text-xs font-extrabold first:border-l-0 transition focus-ring ${
              tab === activeTab ? "border-b-2 border-[#ef233c] text-[#ef233c]" : "text-slate-500 hover:bg-[#f8fafc]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-3">
        <div className="grid grid-cols-[86px_1fr_36px] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">계좌</span>
          <button type="button" className="flex h-8 items-center justify-between rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-[#071832] focus-ring">
            종합위탁 257-232-648
            <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </button>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-[#fff8e1] focus-ring" aria-label="주문 옵션" title="주문 옵션">
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-[86px_1fr] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">주문유형</span>
          <div className="grid grid-cols-4 gap-2">
            {orderTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onOrderTypeChange(type)}
                className={`h-8 rounded-lg border text-xs font-extrabold transition focus-ring ${
                  type === orderType ? "border-[#ef233c] bg-[#ef233c] text-white" : "border-slate-200 bg-white text-[#071832] hover:bg-[#fff8e1]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[86px_1fr_64px] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">주문가능금액</span>
          <span className="text-right text-xs font-black tabular-nums text-[#071832]">123,000,000 원</span>
          <button type="button" className="flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 text-xs font-extrabold hover:bg-[#fff8e1] focus-ring">
            <Calculator className="h-4 w-4" aria-hidden="true" />
            계산기
          </button>
        </div>

        <StepperField label="가격" unit="원" value={price} onChange={onPriceChange} step={100} />
        <StepperField label="수량" unit="주" value={quantity} onChange={onQuantityChange} step={1} />

        <div className="grid grid-cols-[86px_1fr] items-center gap-2">
          <span className="text-xs font-extrabold text-[#071832]">주문금액</span>
          <span className="text-right text-sm font-black tabular-nums text-[#071832]">{amount.toLocaleString("ko-KR")} 원</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {ratios.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRatioChange(item)}
              className={`h-7 rounded-md border text-[11px] font-extrabold transition focus-ring ${
                item === ratio ? "border-[#1d4ed8] bg-blue-50 text-[#1d4ed8]" : "border-slate-200 text-slate-600 hover:bg-[#fff8e1]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={autoPriority}
              onChange={(event) => onAutoPriorityChange(event.target.checked)}
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            자동(최우선)
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={autoConfirm}
              onChange={(event) => onAutoConfirmChange(event.target.checked)}
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            자동주문 확인
          </label>
          <button type="button" onClick={onReset} className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-extrabold hover:bg-[#fff8e1] focus-ring">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            초기화
          </button>
        </div>

        <button
          type="button"
          onClick={onPreview}
          className={`h-10 w-full rounded-lg text-sm font-black text-white transition focus-ring ${actionClass}`}
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}

function StepperField({
  label,
  unit,
  value,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  step: number;
  onChange: (value: string) => void;
}) {
  const update = (next: number) => {
    onChange(Math.max(0, next).toLocaleString("ko-KR"));
  };
  const current = toNumber(value);

  return (
    <div className="grid grid-cols-[86px_1fr_38px] items-center gap-2">
      <span className="text-xs font-extrabold text-[#071832]">{label}</span>
      <div className="grid grid-cols-[36px_1fr_36px] rounded-lg border border-slate-200">
        <button type="button" onClick={() => update(current - step)} className="flex h-8 items-center justify-center border-r border-slate-200 hover:bg-[#f8fafc] focus-ring" aria-label={`${label} 낮추기`}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 px-2 text-center text-xs font-bold tabular-nums outline-none"
          inputMode="numeric"
        />
        <button type="button" onClick={() => update(current + step)} className="flex h-8 items-center justify-center border-l border-slate-200 hover:bg-[#f8fafc] focus-ring" aria-label={`${label} 높이기`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <span className="flex h-8 items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600">{unit}</span>
    </div>
  );
}

function ChartPanel({
  candles,
  period,
  stockName,
  onPeriodChange,
}: {
  candles: ChartCandle[];
  period: string;
  stockName: string;
  onPeriodChange: (period: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {chartPeriods.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onPeriodChange(item)}
              className={`h-7 rounded-md px-2.5 text-xs font-extrabold transition focus-ring ${
                item === period ? "bg-blue-50 text-[#1d4ed8]" : "text-slate-600 hover:bg-[#fff8e1]"
              }`}
            >
              {item}
            </button>
          ))}
          <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-extrabold text-slate-600 hover:bg-[#fff8e1] focus-ring">
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            지표
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="h-7 rounded-md border border-[#bfdbfe] px-2.5 text-xs font-extrabold text-[#1d4ed8] hover:bg-blue-50 focus-ring">기본차트</button>
          <button type="button" className="h-7 rounded-md px-2.5 text-xs font-extrabold text-slate-600 hover:bg-[#fff8e1] focus-ring">트레이딩뷰</button>
          <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-[#fff8e1] focus-ring" aria-label="차트 확장" title="차트 확장">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5 text-xs font-bold text-[#071832]">
        {stockName} · {period} · KRX
        <span className="ml-3 text-xs text-blue-600">시 67,200</span>
        <span className="ml-2 text-xs text-blue-600">고 67,300</span>
        <span className="ml-2 text-xs text-blue-600">저 65,900</span>
        <span className="ml-2 text-xs text-blue-600">종 66,200</span>
        <span className="ml-2 text-xs text-blue-600">▼ 1,030 (-1.53%)</span>
      </div>

      <CandleChart candles={candles} />
    </div>
  );
}

function CandleChart({ candles }: { candles: ChartCandle[] }) {
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const volumeMax = Math.max(...candles.map((candle) => candle.volume));
  const width = 920;
  const height = 300;
  const chartTop = 18;
  const chartBottom = 224;
  const volumeTop = 238;
  const volumeHeight = 42;
  const leftPadding = 16;
  const rightPadding = 72;
  const step = (width - leftPadding - rightPadding) / Math.max(candles.length - 1, 1);

  const y = (price: number) => chartBottom - ((price - min) / (max - min)) * (chartBottom - chartTop);
  const x = (index: number) => leftPadding + index * step;
  const ma5 = movingAverage(candles.map((candle) => candle.close), 5);
  const ma10 = movingAverage(candles.map((candle) => candle.close), 10);

  return (
    <div className="overflow-x-auto px-2 pb-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[235px] min-w-[760px] w-full" role="img" aria-label="모의 캔들 차트">
        {[0, 1, 2, 3].map((line) => {
          const yPos = chartTop + ((chartBottom - chartTop) / 3) * line;
          return <line key={line} x1={leftPadding} x2={width - rightPadding} y1={yPos} y2={yPos} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        {[60000, 63000, 66000, 69000, 72000].map((price) => (
          <text key={price} x={width - 60} y={y(price) + 4} fontSize="12" fontWeight="700" fill="#475569">
            {price.toLocaleString("ko-KR")}
          </text>
        ))}
        <path d={linePath(ma5, x, y)} fill="none" stroke="#f59e0b" strokeWidth="2" />
        <path d={linePath(ma10, x, y)} fill="none" stroke="#d946ef" strokeWidth="2" />
        {candles.map((candle, index) => {
          const candleX = x(index);
          const openY = y(candle.open);
          const closeY = y(candle.close);
          const highY = y(candle.high);
          const lowY = y(candle.low);
          const isUp = candle.close >= candle.open;
          const color = isUp ? "#ef233c" : "#1d4ed8";
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
          const volumeHeightValue = (candle.volume / volumeMax) * volumeHeight;

          return (
            <g key={`${candle.label}-${index}`}>
              <line x1={candleX} x2={candleX} y1={highY} y2={lowY} stroke={color} strokeWidth="2" />
              <rect x={candleX - 7} y={bodyTop} width="14" height={bodyHeight} rx="1" fill={color} />
              <rect x={candleX - 8} y={volumeTop + volumeHeight - volumeHeightValue} width="16" height={volumeHeightValue} fill={isUp ? "#fca5a5" : "#93c5fd"} opacity="0.85" />
              {candle.label && (
                <text x={candleX} y={height - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#475569">
                  {candle.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={leftPadding} x2={width - rightPadding} y1={chartBottom} y2={chartBottom} stroke="#cbd5e1" />
        <text x={leftPadding} y={volumeTop - 7} fontSize="12" fontWeight="700" fill="#1d4ed8">
          거래량 (20) 11.68M 16.25M
        </text>
        <rect x={width - 74} y={y(66200) - 13} width="56" height="24" rx="4" fill="#1d4ed8" />
        <text x={width - 46} y={y(66200) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffffff">
          66,200
        </text>
      </svg>
    </div>
  );
}

function CashPanel({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-200 bg-[#f8fafc] p-4">
          <p className="text-xs font-bold text-slate-500">{row.label}</p>
          <p className="mt-2 text-lg font-black tabular-nums text-[#071832]">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function OrderHistoryPanel({ rows }: { rows: OrderHistoryRow[] }) {
  return <SimpleTable columns={["시간", "구분", "가격", "수량", "상태"]} rows={rows.map((row) => [row.time, row.side, row.price, row.quantity, row.status])} />;
}

function ProfitLossPanel({ rows }: { rows: ProfitLossSummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-slate-200 bg-[#f8fafc] p-4">
          <p className="text-xs font-bold text-slate-500">{row.label}</p>
          <p className={`mt-2 text-lg font-black tabular-nums ${toneTextClass(row.tone)}`}>{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function BalancePanel({ rows }: { rows: BalanceEvaluationRow[] }) {
  return (
    <SimpleTable
      columns={["종목", "수량", "평균단가", "평가금액", "수익률"]}
      rows={rows.map((row) => [row.name, row.quantity, row.avgPrice, row.evalAmount, row.profitRate])}
      toneByLastCell={rows.map((row) => row.tone)}
    />
  );
}

function SimpleTable({
  columns,
  rows,
  toneByLastCell,
}: {
  columns: string[];
  rows: string[][];
  toneByLastCell?: PriceTone[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="grid bg-[#f8fafc] px-3 py-2 text-center text-xs font-extrabold text-slate-500" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      {rows.map((row, rowIndex) => (
        <div
          key={row.join("-")}
          className="grid border-t border-slate-100 px-3 py-3 text-center text-sm font-bold text-[#071832]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {row.map((cell, cellIndex) => (
            <span
              key={`${cell}-${cellIndex}`}
              className={cellIndex === row.length - 1 && toneByLastCell ? toneTextClass(toneByLastCell[rowIndex]) : "tabular-nums"}
            >
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function linePath(values: Array<number | null>, x: (index: number) => number, y: (price: number) => number) {
  return values
    .map((value, index) => {
      if (value === null) return "";
      return `${index === values.findIndex((candidate) => candidate !== null) ? "M" : "L"} ${x(index)} ${y(value)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function movingAverage(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index < period - 1) return null;
    const slice = values.slice(index - period + 1, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toneTextClass(tone: PriceTone) {
  if (tone === "up") return "text-red-500";
  if (tone === "down") return "text-blue-600";
  return "text-slate-500";
}
