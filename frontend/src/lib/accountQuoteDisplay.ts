import type { PriceData } from "@/lib/api/market";
import { normalizeStockCode } from "@/lib/accountHoldings";
import { hasUsableQuote } from "@/lib/marketQuoteDisplay";
import type { Balance, Holding } from "@/types/account";

export function applyQuotesToHoldings(holdings: Holding[], quotes: Record<string, PriceData | null | undefined>) {
  return holdings.map((holding) => applyQuoteToHolding(holding, quotes[normalizeStockCode(holding.stock_code)]));
}

export function applyQuoteToHolding(holding: Holding, quote: PriceData | null | undefined): Holding {
  const purchaseAmount = holding.purchase_amount ?? holding.avg_price * holding.quantity;

  if (!hasUsableQuote(quote)) {
    return {
      ...holding,
      current_price: 0,
      eval_amount: 0,
      profit_loss: 0,
      profit_rate: 0,
    };
  }

  const currentPrice = Math.round(quote.price);
  const evalAmount = currentPrice * holding.quantity;
  const profitLoss = evalAmount - purchaseAmount;
  const profitRate = purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0;

  return {
    ...holding,
    current_price: currentPrice,
    eval_amount: evalAmount,
    profit_loss: profitLoss,
    profit_rate: profitRate,
  };
}

export function buildQuoteAdjustedBalance(balance: Balance | null | undefined, holdings: Holding[]): Balance | null {
  if (!balance) return null;

  const purchaseAmount = holdings.reduce((sum, item) => sum + (item.purchase_amount ?? item.avg_price * item.quantity), 0);
  const evalAmount = holdings.reduce((sum, item) => sum + item.eval_amount, 0);
  const profitLoss = holdings.reduce((sum, item) => sum + item.profit_loss, 0);
  const profitRate = purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0;
  const deposit = balance.deposit ?? 0;

  return {
    ...balance,
    holdings,
    purchase_amount: purchaseAmount,
    eval_amount: evalAmount,
    profit_loss: profitLoss,
    profit_rate: profitRate,
    total_eval: evalAmount + deposit,
  };
}
