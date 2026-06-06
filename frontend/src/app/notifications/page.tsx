"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, Eye, Settings, Star, Zap } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { notifications } from "@/lib/mockData";

const tabs = ["전체", "미확인", "시세", "체결", "전략", "리스크", "이슈", "일정"];

export default function NotificationsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("미확인");
  const [readIds, setReadIds] = useState<string[]>(notifications.filter((item) => item.read).map((item) => item.id));
  const displayNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        const isRead = readIds.includes(item.id);
        if (activeTab === "전체") return true;
        if (activeTab === "미확인") return !isRead;
        return item.type === activeTab || item.action === activeTab;
      }),
    [activeTab, readIds]
  );
  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length;

  return (
    <AppShell screen="notifications">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="미확인" value={`${unreadCount}건`} />
        <Summary label="전체" value={`${notifications.length}건`} />
        <Summary label="높은 중요도" value="2건" />
        <Summary label="실행 필요" value="1건" />
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-3 py-2 text-sm font-bold transition focus-ring ${
                  tab === activeTab ? "bg-[#071832] text-white" : "bg-[#f8fafc] text-slate-600 hover:bg-[#fff8e1]"
                }`}
                aria-pressed={tab === activeTab}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setReadIds(notifications.map((item) => item.id));
                toast.success("모든 알림을 읽음 처리했습니다.");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-ring"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              모두 읽음 처리
            </button>
            <Link href="/my-settings" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-ring">
              <Settings className="h-4 w-4" aria-hidden="true" />
              알림 설정
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {displayNotifications.map((item) => {
            const isRead = readIds.includes(item.id);
            return (
            <article
              key={item.id}
              className={`rounded-lg border p-4 shadow-sm ${isRead ? "border-slate-100 bg-white" : "border-[#f3d58a] bg-[#fffdfa]"}`}
            >
              <div className="grid gap-3 lg:grid-cols-[48px_1fr_auto] lg:items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef6ff] text-[#0f4c81]">
                  <NotificationIcon type={item.type} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-[#071832]">{item.title}</p>
                    <Importance value={item.importance} />
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {item.time}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
                </div>
                <div className="flex gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setReadIds((ids) => Array.from(new Set([...ids, item.id])));
                      toast.info(`${item.title} 상세 내용을 확인했습니다.`);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-ring"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    상세보기
                  </button>
                  {item.action === "실행" && (
                    <button
                      type="button"
                      onClick={() => toast.warning("실행 전 주문/전략 확인 화면으로 이동해야 합니다.")}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 focus-ring"
                    >
                      <Zap className="h-4 w-4" aria-hidden="true" />
                      실행
                    </button>
                  )}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Bell className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#071832]">{value}</p>
    </div>
  );
}

function Importance({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`중요도 ${value}`}>
      {Array.from({ length: 3 }).map((_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${index < value ? "fill-[#f6b100] text-[#f6b100]" : "text-slate-200"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "체결") return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />;
  if (type === "시세") return <Zap className="h-5 w-5" aria-hidden="true" />;
  if (type === "리스크") return <Bell className="h-5 w-5" aria-hidden="true" />;
  return <Bell className="h-5 w-5" aria-hidden="true" />;
}
