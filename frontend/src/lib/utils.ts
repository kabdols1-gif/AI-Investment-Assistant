import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getChangeClassName(value: number | string): string {
  const numericValue =
    typeof value === "string"
      ? Number(value.replace(/[,%+원주$]/g, "").trim())
      : value;

  if (Number.isNaN(numericValue)) {
    if (typeof value === "string" && value.trim().startsWith("+")) return "text-profit";
    if (typeof value === "string" && value.trim().startsWith("-")) return "text-loss";
    return "text-neutral";
  }

  if (numericValue > 0) return "text-profit";
  if (numericValue < 0) return "text-loss";
  return "text-neutral";
}

/**
 * 금액 포맷 (한국 원화)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    notation: value >= 100_000_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * 퍼센트 포맷
 */
export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * 날짜 포맷
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
