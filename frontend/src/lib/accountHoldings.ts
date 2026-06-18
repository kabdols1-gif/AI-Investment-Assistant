import type { Holding } from "@/types/account";

const STOCK_ICON_URLS: Record<string, string> = {
  "000660": "https://www.google.com/s2/favicons?domain=skhynix.com&sz=64",
  "005380": "https://www.google.com/s2/favicons?domain=hyundai.com&sz=64",
  "005930": "https://www.google.com/s2/favicons?domain=samsung.com&sz=64",
  "035420": "https://www.google.com/s2/favicons?domain=naver.com&sz=64",
  "035720": "https://www.google.com/s2/favicons?domain=kakaocorp.com&sz=64",
  "051910": "https://www.google.com/s2/favicons?domain=lgchem.com&sz=64",
  "066570": "https://www.google.com/s2/favicons?domain=lge.co.kr&sz=64",
  "373220": "https://www.google.com/s2/favicons?domain=lgensol.com&sz=64",
};

export function normalizeStockCode(value: string) {
  return value.replace(/^A/i, "").trim();
}

export function isStockHolding(holding: Holding) {
  const rawCode = holding.stock_code.trim();
  const code = normalizeStockCode(rawCode);
  return (/^A\d{6}$/i.test(rawCode) || /^\d{6}$/.test(rawCode)) && /^\d{6}$/.test(code);
}

export function filterStockHoldings(holdings: Holding[] | undefined | null) {
  return (holdings ?? []).filter(isStockHolding);
}

export function getStockIconUrl(stockCode: string) {
  return STOCK_ICON_URLS[normalizeStockCode(stockCode)];
}

export function getOrderHref(stockCode: string) {
  return `/assets?stock=${encodeURIComponent(normalizeStockCode(stockCode))}&order=buy`;
}
