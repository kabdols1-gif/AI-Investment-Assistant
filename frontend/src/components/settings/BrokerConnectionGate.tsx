"use client";

import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";
import type { ReactNode } from "react";
import type { BrokerProviderOption } from "@/lib/brokerProviders";
import { cn } from "@/lib/utils";

export function BrokerConnectionGate({
  children,
  isConnected,
  broker,
  className,
  showNotice = false,
}: {
  children: ReactNode;
  isConnected: boolean;
  broker: BrokerProviderOption;
  className?: string;
  showNotice?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {!isConnected && showNotice ? <BrokerConnectionNotice broker={broker} className="mb-3" /> : null}
      {children}
    </div>
  );
}

export function BrokerConnectionNotice({
  broker,
  className,
}: {
  broker: BrokerProviderOption;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border border-amber-200 bg-[#fff8e1] p-4 shadow-sm", className)}
      data-testid="broker-connection-gate"
      data-broker-id={broker.id}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-amber-200 bg-white text-sm font-black text-[#071832] shadow-sm">
            <span className="text-xs font-black" aria-hidden={Boolean(broker.logoUrl)}>
              {broker.mark}
            </span>
            {broker.logoUrl ? (
              <span
                className="absolute h-7 w-7 rounded-sm bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${broker.logoUrl})` }}
                aria-label={broker.name}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[#071832]" data-testid="broker-connection-gate-copy">
              증권사 연동이 필요합니다.
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {broker.name} 계좌 정보를 설정하면 잔고와 보유 자산을 확인할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="flex flex-none flex-wrap gap-2">
          <Link
            href="/settings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f6b100] px-4 text-sm font-extrabold text-[#071832] transition hover:bg-[#e0a000] focus-ring"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            설정으로 이동
          </Link>
          {broker.accountOpeningUrl ? (
            <a
              href={broker.accountOpeningUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="broker-account-opening-link"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-4 text-sm font-extrabold text-[#071832] transition hover:bg-[#fffdf7] focus-ring"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              계좌개설로 이동
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
