"use client";

import Link from "next/link";
import { Bell, Heart, Home, PieChart, Settings, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useConfigStatus } from "@/hooks";
import { getBrokerProviderOption } from "@/lib/brokerProviders";
import { isBrokerConnected } from "@/lib/configStatus";
import { assetSummary, myStrategies, notifications, portfolioList, watchlistSummaryItems } from "@/lib/mockData";

const dashboardItems = [
  {
    title: "관심종목",
    href: "/watchlist",
    icon: Heart,
    metric: `${watchlistSummaryItems.length}개`,
    detail: "상승 후보 3개 · 알림 2건",
    tone: "neutral",
  },
  {
    title: "투자전략",
    href: "/my-strategy",
    icon: ShieldCheck,
    metric: `${myStrategies.filter((strategy) => strategy.enabled).length}개 실행중`,
    detail: "신규 전략 작성과 내 전략 관리",
    tone: "profit",
  },
  {
    title: "포트관리",
    href: "/portfolio",
    icon: PieChart,
    metric: `${portfolioList.length}개 포트`,
    detail: "비중 점검 · 구성 종목 확인",
    tone: "neutral",
  },
  {
    title: "자산현황",
    href: "/assets",
    icon: Home,
    metric: assetSummary.totalAsset,
    detail: `오늘 손익 ${assetSummary.todayProfitRate}`,
    tone: "profit",
  },
] as const;

export default function DashboardPage() {
  const { status } = useConfigStatus();
  const brokerOption = getBrokerProviderOption(status.broker_provider);
  const brokerConnected = isBrokerConnected(status);
  const aiConnected = Boolean(status.llm_key_registered);
  const unreadNotifications = notifications.filter((item) => item.importance >= 2).length;

  return (
    <AppShell screen="dashboard">
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-normal text-[#071832]">오늘의 업무</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">관심종목, 전략, 포트폴리오, 자산을 한 번에 확인합니다.</p>
            </div>
            <span className="rounded-full bg-[#fff8e1] px-3 py-1 text-xs font-extrabold text-[#8a6400]">2026.06.08 기준</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {dashboardItems.map((item) => (
              <DashboardCard key={item.title} {...item} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black tracking-normal text-[#071832]">핵심 상태</h2>
          <div className="mt-4 space-y-3">
            <StatusRow label="AI 연동" value={aiConnected ? status.llm_provider.toUpperCase() : "미연동"} ok={aiConnected} />
            <StatusRow label="증권사 연동" value={brokerConnected ? brokerOption.name : "미연동"} ok={brokerConnected} />
            <StatusRow label="중요 알림" value={`${unreadNotifications}건`} ok={unreadNotifications <= 2} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-[#071832]">최근 흐름</h2>
            <Link href="/market" className="text-xs font-extrabold text-[#0f4c81] focus-ring">시장현황</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FlowTile label="누적 수익률" value={assetSummary.cumulativeReturn} icon={TrendingUp} tone="profit" />
            <FlowTile label="주문가능금액" value={assetSummary.availableCash} icon={Home} tone="neutral" />
            <FlowTile label="주의 종목" value="2개" icon={TrendingDown} tone="loss" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-[#071832]">최근 알림</h2>
            <Link href="/notifications" className="text-xs font-extrabold text-[#0f4c81] focus-ring">전체보기</Link>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((item) => (
              <Link key={item.id} href="/notifications" className="block rounded-lg border border-slate-100 bg-[#f8fafc] p-3 transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-extrabold text-[#071832]">{item.title}</span>
                  <span className="flex-none text-[11px] font-bold text-slate-500">{item.time}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.message}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <BottomStatusCard
          href="/notifications"
          icon={Bell}
          title="알림설정"
          status={`${unreadNotifications}건 확인 필요`}
          description="체결, 시세, 전략 알림 조건을 점검합니다."
        />
        <BottomStatusCard
          href="/settings"
          icon={Settings}
          title="환경설정"
          status={brokerConnected && aiConnected ? "연동 정상" : "연동 확인 필요"}
          description="AI와 증권사 연결 상태를 관리합니다."
        />
      </section>
    </AppShell>
  );
}

function DashboardCard({
  title,
  href,
  icon: Icon,
  metric,
  detail,
  tone,
}: {
  title: string;
  href: string;
  icon: typeof Heart;
  metric: string;
  detail: string;
  tone: "profit" | "loss" | "neutral";
}) {
  return (
    <Link href={href} className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
        <span className="text-xs font-extrabold text-slate-400 transition group-hover:text-[#8a6400]">이동</span>
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500">{title}</p>
      <p className={`mt-2 break-keep text-lg font-black tracking-normal ${toneClass(tone)}`}>{metric}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </Link>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 py-3">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span className="inline-flex items-center gap-2 text-sm font-extrabold text-[#071832]">
        <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}

function FlowTile({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Home; tone: "profit" | "loss" | "neutral" }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] p-4">
      <Icon className={`h-5 w-5 ${toneClass(tone)}`} aria-hidden="true" />
      <p className="mt-3 text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black tracking-normal ${toneClass(tone)}`}>{value}</p>
    </div>
  );
}

function BottomStatusCard({
  href,
  icon: Icon,
  title,
  status,
  description,
}: {
  href: string;
  icon: typeof Bell;
  title: string;
  status: string;
  description: string;
}) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-[#071832]">{title}</h2>
        </div>
        <span className="text-xs font-extrabold text-[#0f4c81]">{status}</span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </Link>
  );
}

function toneClass(tone: "profit" | "loss" | "neutral") {
  if (tone === "profit") return "text-profit";
  if (tone === "loss") return "text-loss";
  return "text-[#071832]";
}
