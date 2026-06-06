"use client";

import {
  Bell,
  ChevronRight,
  LockKeyhole,
  Mic,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { settingsRows } from "@/lib/mockData";

const settingIcons = [SlidersHorizontal, Bell, ShieldCheck, Mic, Palette, LockKeyhole];

export default function MySettingsPage() {
  const toast = useToast();

  return (
    <AppShell screen="my-settings">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[#fff8e1] text-[#8a6400]">
              <UserRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-[#071832]">내 설정</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">개인 환경, 알림, 보안, 음성 설정</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <SummaryBadge label="투자성향" value="중립형" />
            <SummaryBadge label="알림" value="푸시 ON" />
            <SummaryBadge label="보안" value="2단계 인증 ON" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3">
        {settingsRows.map((row, index) => {
          const Icon = settingIcons[index] ?? SlidersHorizontal;
          return (
            <button
              key={row.title}
              type="button"
              onClick={() => toast.info(`${row.title} 설정을 선택했습니다.`)}
              className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#f3d58a] hover:bg-[#fffdf7] focus-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[#f8fafc] text-[#071832]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-[#071832]">{row.title}</span>
                  <span className="mt-1 block truncate text-xs font-medium text-slate-500">{row.description}</span>
                </span>
              </span>
              <span className="flex flex-none items-center gap-3">
                <span className="hidden rounded-full bg-[#fff8e1] px-3 py-1 text-xs font-extrabold text-[#8a6400] sm:inline">
                  {row.value}
                </span>
                <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </section>
    </AppShell>
  );
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f8fafc] px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-[#071832]">{value}</p>
    </div>
  );
}
