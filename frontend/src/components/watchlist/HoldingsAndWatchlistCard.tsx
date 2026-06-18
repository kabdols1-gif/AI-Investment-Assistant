"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Briefcase, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { BrokerConnectionGate } from "@/components/settings/BrokerConnectionGate";
import { useMarketQuotes } from "@/hooks";
import { applyQuotesToHoldings, buildQuoteAdjustedBalance } from "@/lib/accountQuoteDisplay";
import { filterStockHoldings, getOrderHref, getStockIconUrl, normalizeStockCode } from "@/lib/accountHoldings";
import type { BrokerProviderOption } from "@/lib/brokerProviders";
import { cn } from "@/lib/utils";
import type { Balance, Holding } from "@/types/account";

interface HoldingsAndWatchlistCardProps {
  brokerConnected: boolean;
  brokerOption: BrokerProviderOption;
  holdings?: Holding[];
  balance?: Balance | null;
}

export function HoldingsAndWatchlistCard({
  brokerConnected,
  brokerOption,
  holdings = [],
  balance,
}: HoldingsAndWatchlistCardProps) {
  const displayHoldings = filterStockHoldings(balance?.holdings ?? holdings);
  const { quotes } = useMarketQuotes(displayHoldings.map((holding) => normalizeStockCode(holding.stock_code)));
  const quotedHoldings = useMemo(() => applyQuotesToHoldings(displayHoldings, quotes), [displayHoldings, quotes]);
  const quoteAdjustedBalance = useMemo(() => buildQuoteAdjustedBalance(balance, quotedHoldings), [balance, quotedHoldings]);
  const summary = summarizeBalance(quoteAdjustedBalance, quotedHoldings);

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#071832]">보유잔고</h2>
            <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[11px] font-black text-slate-500">
              {displayHoldings.length}종목
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {balance?.fetched_at ? `KB 잔고평가 기준 ${formatDateTime(balance.fetched_at)}` : "KB OpenAPI 잔고평가를 조회합니다."}
          </p>
        </div>
      </div>

      <BrokerConnectionGate isConnected={brokerConnected} broker={brokerOption} showNotice={false}>
        <BalanceStrip summary={summary} />
        <HoldingsSummaryTable holdings={quotedHoldings} />
      </BrokerConnectionGate>

      <p className="mt-3 text-xs font-medium text-slate-500">
        * KB OpenAPI SAQM9006 계좌 조회 후 SSQM2952 잔고평가로 구성한 화면입니다.
      </p>
    </section>
  );
}

function summarizeBalance(balance: Balance | null | undefined, holdings: Holding[]) {
  const purchaseAmount =
    balance?.purchase_amount ??
    holdings.reduce((sum, item) => sum + (item.purchase_amount ?? item.avg_price * item.quantity), 0);
  const evalAmount = balance?.eval_amount ?? holdings.reduce((sum, item) => sum + item.eval_amount, 0);
  const profitLoss = balance?.profit_loss ?? holdings.reduce((sum, item) => sum + item.profit_loss, 0);
  const profitRate = balance?.profit_rate ?? (purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0);
  const deposit = balance?.deposit ?? 0;

  return {
    totalEval: balance?.total_eval ?? evalAmount + deposit,
    evalAmount,
    deposit,
    profitLoss,
    profitRate,
  };
}

function BalanceStrip({
  summary,
}: {
  summary: ReturnType<typeof summarizeBalance>;
}) {
  const profitTone = getNumberTone(summary.profitLoss);
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryPill label="총자산평가" value={formatWon(summary.totalEval)} strong />
      <SummaryPill label="평가금액" value={formatWon(summary.evalAmount)} />
      <SummaryPill label="예수금" value={formatWon(summary.deposit)} />
      <SummaryPill
        label="평가손익"
        value={`${formatSignedWon(summary.profitLoss)} (${formatPercent(summary.profitRate)})`}
        tone={profitTone}
      />
    </div>
  );
}

function SummaryPill({
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
    <div className="rounded-lg border border-slate-100 bg-[#f8fafc] p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-black tabular-nums tracking-normal",
          strong ? "text-lg" : "text-sm",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "neutral" && "text-[#071832]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function HoldingsSummaryTable({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 py-12 text-slate-400">
        <Wallet className="mb-3 h-12 w-12 opacity-30" aria-hidden="true" />
        <p className="text-sm font-bold">조회된 보유잔고가 없습니다.</p>
        <p className="mt-2 text-xs font-semibold">총 평가 0원 · 손익 0원 (0.00%)</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="min-w-[920px] w-full border-collapse text-left text-sm">
        <thead className="bg-[#f8fafc] text-xs font-black text-slate-500">
          <tr>
            <th className="px-4 py-3">종목</th>
            <th className="px-3 py-3 text-right">보유수량</th>
            <th className="px-3 py-3 text-right">주문가능</th>
            <th className="px-3 py-3 text-right">평균단가</th>
            <th className="px-3 py-3 text-right">현재가</th>
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
    <tr className="border-t border-slate-100 transition hover:bg-[#fff8e1]">
      <td className="px-4 py-3">
        <Link
          href={getOrderHref(holding.stock_code)}
          onClick={() => {
            window.dispatchEvent(new CustomEvent("recent-stock-selected", { detail: { id: normalizedCode, orderSide: "buy" } }));
          }}
          className="-m-1 flex min-w-0 items-center gap-3 rounded-lg p-1 text-left transition hover:bg-white focus-ring"
          aria-label={`${holding.stock_name} 매수 화면으로 이동`}
        >
          <StockLogo holding={holding} />
          <span className="min-w-0">
            <span className="block truncate font-extrabold text-[#071832]">{holding.stock_name}</span>
            <span className="mt-1 block font-mono text-xs font-semibold text-slate-500">{normalizedCode}</span>
          </span>
        </Link>
      </td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832]">
        {holding.quantity.toLocaleString("ko-KR")}주
      </td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832]">
        {Number(holding.orderable_quantity ?? holding.quantity).toLocaleString("ko-KR")}주
      </td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832]">{formatWon(holding.avg_price)}</td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832]">{formatWon(holding.current_price)}</td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832]">{formatWon(purchaseAmount)}</td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-[#071832]">{formatWon(holding.eval_amount)}</td>
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
    <span className="relative flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] text-xs font-black text-[#071832]">
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
  return "text-[#071832]";
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
