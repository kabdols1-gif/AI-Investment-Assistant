"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  Briefcase,
  Clock,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMarketQuotes } from "@/hooks";
import { applyQuotesToHoldings, buildQuoteAdjustedBalance } from "@/lib/accountQuoteDisplay";
import { filterStockHoldings, getOrderHref, getStockIconUrl, normalizeStockCode } from "@/lib/accountHoldings";
import { cn } from "@/lib/utils";
import type { Holding, Balance } from "@/types/account";
import type { PendingOrder, CancelOrderRequest } from "@/lib/api/orders";

interface HoldingsListProps {
  holdings: Holding[];
  pendingOrders?: PendingOrder[];
  balance?: Balance | null;
  onRefresh?: () => void;
  onCancelOrder?: (request: CancelOrderRequest) => Promise<void>;
  isLoading?: boolean;
}

type TabType = "holdings" | "pending";

export function HoldingsList({
  holdings,
  pendingOrders = [],
  balance,
  onRefresh,
  onCancelOrder,
  isLoading,
}: HoldingsListProps) {
  const [activeTab, setActiveTab] = useState<TabType>("holdings");
  const [cancellingOrderNo, setCancellingOrderNo] = useState<string | null>(null);
  const displayHoldings = filterStockHoldings(balance?.holdings ?? holdings);
  const { quotes } = useMarketQuotes(displayHoldings.map((holding) => normalizeStockCode(holding.stock_code)));
  const quotedHoldings = useMemo(() => applyQuotesToHoldings(displayHoldings, quotes), [displayHoldings, quotes]);
  const quoteAdjustedBalance = useMemo(() => buildQuoteAdjustedBalance(balance, quotedHoldings), [balance, quotedHoldings]);

  const derivedSummary = useMemo(() => {
    const evalAmount = quotedHoldings.reduce((sum, item) => sum + item.eval_amount, 0);
    const purchaseAmount = quotedHoldings.reduce(
      (sum, item) => sum + (item.purchase_amount ?? item.avg_price * item.quantity),
      0
    );
    const profitLoss = quotedHoldings.reduce((sum, item) => sum + item.profit_loss, 0);
    const profitRate = purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0;
    return { evalAmount, purchaseAmount, profitLoss, profitRate };
  }, [quotedHoldings]);

  const summary = {
    deposit: quoteAdjustedBalance?.deposit ?? 0,
    totalEval: quoteAdjustedBalance?.total_eval ?? derivedSummary.evalAmount,
    purchaseAmount: quoteAdjustedBalance?.purchase_amount ?? derivedSummary.purchaseAmount,
    evalAmount: quoteAdjustedBalance?.eval_amount ?? derivedSummary.evalAmount,
    profitLoss: quoteAdjustedBalance?.profit_loss ?? derivedSummary.profitLoss,
    profitRate: quoteAdjustedBalance?.profit_rate ?? derivedSummary.profitRate,
    withdrawableAmount: quoteAdjustedBalance?.withdrawable_amount ?? quoteAdjustedBalance?.deposit ?? 0,
  };

  const handleCancelOrder = useCallback(
    async (order: PendingOrder) => {
      if (!onCancelOrder) return;

      setCancellingOrderNo(order.order_no);
      try {
        await onCancelOrder({
          order_no: order.order_no,
          org_no: order.org_no ?? "",
          stock_code: order.stock_code,
          qty: order.unfilled_qty,
        });
      } finally {
        setCancellingOrderNo(null);
      }
    },
    [onCancelOrder]
  );

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-extrabold text-[#071832] dark:text-white">보유잔고</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {quoteAdjustedBalance?.source ?? "KB"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {quoteAdjustedBalance?.account_no && <span>계좌 {quoteAdjustedBalance.account_no}</span>}
              {quoteAdjustedBalance?.product_code && <span>상품 {quoteAdjustedBalance.product_code}</span>}
              {isLoading ? <span>데이터 갱신 중</span> : quoteAdjustedBalance?.fetched_at && <span>{formatDateTime(quoteAdjustedBalance.fetched_at)}</span>}
            </div>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 focus-ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              새로고침
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
          <BalanceMetric label="총자산평가" value={formatWon(summary.totalEval)} strong />
          <BalanceMetric label="예수금" value={formatWon(summary.deposit)} />
          <BalanceMetric label="평가금액" value={formatWon(summary.evalAmount)} />
          <BalanceMetric label="매입금액" value={formatWon(summary.purchaseAmount)} />
          <BalanceMetric
            label="평가손익"
            value={`${formatSignedWon(summary.profitLoss)} (${formatPercent(summary.profitRate)})`}
            tone={getNumberTone(summary.profitLoss)}
          />
          <BalanceMetric label="출금가능" value={formatWon(summary.withdrawableAmount)} />
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <TabButton
            active={activeTab === "holdings"}
            icon={Briefcase}
            label="보유종목"
            count={quotedHoldings.length}
            onClick={() => setActiveTab("holdings")}
          />
          <TabButton
            active={activeTab === "pending"}
            icon={Clock}
            label="미체결"
            count={pendingOrders.length}
            tone="warning"
            onClick={() => setActiveTab("pending")}
          />
        </div>
      </div>

      {isLoading && quotedHoldings.length > 0 && (
        <div className="border-b border-slate-100 px-4 py-2 text-xs font-bold text-slate-500 dark:border-slate-800">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            보유잔고 갱신 중
          </span>
        </div>
      )}

      {activeTab === "holdings" ? (
        <HoldingsTable holdings={quotedHoldings} />
      ) : (
        <PendingOrdersList
          orders={pendingOrders}
          onCancel={handleCancelOrder}
          cancellingOrderNo={cancellingOrderNo}
        />
      )}
    </div>
  );
}

function BalanceMetric({
  label,
  value,
  tone = "neutral",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "profit" | "loss";
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-black tabular-nums tracking-normal",
          strong ? "text-lg" : "text-sm",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "neutral" && "text-[#071832] dark:text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  count,
  tone = "primary",
  onClick,
}: {
  active: boolean;
  icon: typeof Briefcase;
  label: string;
  count: number;
  tone?: "primary" | "warning";
  onClick: () => void;
}) {
  const activeClass =
    tone === "warning" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors focus-ring",
        active ? activeClass : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      )}
      aria-pressed={active}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
      <span className={cn("rounded-full px-1.5 py-0.5 text-xs", active ? "bg-white/60 dark:bg-slate-900/40" : "bg-slate-100 dark:bg-slate-800")}>
        {count}
      </span>
    </button>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Briefcase className="mb-3 h-12 w-12 opacity-30" aria-hidden="true" />
        <p className="text-sm font-bold">보유 종목이 없습니다.</p>
        <p className="mt-2 text-xs font-semibold">총 평가 0원 · 손익 0원 (0.00%)</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">종목</th>
            <th className="px-3 py-3 text-right">보유/주문가능</th>
            <th className="px-3 py-3 text-right">평균/현재가</th>
            <th className="px-3 py-3 text-right">매입금액</th>
            <th className="px-3 py-3 text-right">평가금액</th>
            <th className="px-4 py-3 text-right">평가손익</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <HoldingRow key={`${holding.stock_code}-${holding.stock_name}`} holding={holding} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoldingRow({ holding }: { holding: Holding }) {
  const profitTone = getNumberTone(holding.profit_loss);
  const purchaseAmount = holding.purchase_amount ?? holding.avg_price * holding.quantity;
  const normalizedCode = normalizeStockCode(holding.stock_code);

  return (
    <tr className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
      <td className="px-4 py-3">
        <Link
          href={getOrderHref(holding.stock_code)}
          className="-m-1 flex min-w-0 items-center gap-3 rounded-lg p-1 text-left transition hover:bg-white focus-ring dark:hover:bg-slate-900"
          aria-label={`${holding.stock_name} 매수 화면으로 이동`}
        >
          <StockLogo holding={holding} />
          <span className="min-w-0">
            <span className="block truncate font-extrabold text-[#071832] dark:text-white">{holding.stock_name}</span>
            <span className="mt-1 block font-mono text-xs font-semibold text-slate-500">{normalizedCode}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <p className="font-bold text-[#071832] dark:text-white">{holding.quantity.toLocaleString("ko-KR")}주</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          {Number(holding.orderable_quantity ?? holding.quantity).toLocaleString("ko-KR")}주 가능
        </p>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        <p className="font-bold text-[#071832] dark:text-white">{formatWon(holding.avg_price)}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{formatWon(holding.current_price)}</p>
      </td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832] dark:text-white">
        {formatWon(purchaseAmount)}
      </td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832] dark:text-white">
        {formatWon(holding.eval_amount)}
      </td>
      <td className={cn("px-4 py-3 text-right font-black tabular-nums", toneClass(profitTone))}>
        <div className="flex items-center justify-end gap-1">
          {holding.profit_loss > 0 && <TrendingUp className="h-4 w-4" aria-hidden="true" />}
          {holding.profit_loss < 0 && <TrendingDown className="h-4 w-4" aria-hidden="true" />}
          <span>{formatSignedWon(holding.profit_loss)}</span>
        </div>
        <p className="mt-1 text-xs">{formatPercent(holding.profit_rate)}</p>
      </td>
    </tr>
  );
}

function StockLogo({ holding }: { holding: Holding }) {
  const iconUrl = getStockIconUrl(holding.stock_code);
  return (
    <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] text-xs font-black text-[#071832] dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <span aria-hidden={Boolean(iconUrl)}>{holding.stock_name.slice(0, 1)}</span>
      {iconUrl ? (
        <span
          className="absolute h-6 w-6 rounded bg-white bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${iconUrl})` }}
          aria-label={holding.stock_name}
        />
      ) : null}
    </span>
  );
}

function PendingOrdersList({
  orders,
  onCancel,
  cancellingOrderNo,
}: {
  orders: PendingOrder[];
  onCancel: (order: PendingOrder) => void;
  cancellingOrderNo: string | null;
}) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Clock className="mb-3 h-12 w-12 opacity-30" aria-hidden="true" />
        <p className="text-sm font-bold">미체결 주문이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-700">
      {orders.map((order, index) => (
        <PendingOrderItem
          key={order.order_no || `pending-${index}`}
          order={order}
          onCancel={onCancel}
          isCancelling={cancellingOrderNo === order.order_no}
        />
      ))}
    </div>
  );
}

function PendingOrderItem({
  order,
  onCancel,
  isCancelling,
}: {
  order: PendingOrder;
  onCancel: (order: PendingOrder) => void;
  isCancelling: boolean;
}) {
  const isBuy = order.order_type.includes("매수") || order.order_type === "BUY";

  return (
    <div className="flex items-center gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-bold",
              isBuy
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            {isBuy ? "매수" : "매도"}
          </span>
          <span className="truncate font-bold">{order.stock_name}</span>
          <span className="font-mono text-xs text-slate-400">{order.stock_code}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="font-mono">{formatWon(order.order_price)}</span>
          <span>
            {order.unfilled_qty}/{order.order_qty}주
          </span>
          <span className="text-xs">{order.order_time}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onCancel(order)}
        disabled={isCancelling}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-bold transition-colors focus-ring",
          isCancelling
            ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
            : "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
        )}
      >
        {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "주문 취소"}
      </button>
    </div>
  );
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatSignedWon(value: number) {
  if (Math.round(value) === 0) return "0원";
  return `${value >= 0 ? "+" : "-"}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}원`;
}

function formatPercent(value: number) {
  if (value === 0) return "0.00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getNumberTone(value: number): "neutral" | "profit" | "loss" {
  if (value > 0) return "profit";
  if (value < 0) return "loss";
  return "neutral";
}

function toneClass(tone: "neutral" | "profit" | "loss") {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-[#071832] dark:text-white";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default HoldingsList;
