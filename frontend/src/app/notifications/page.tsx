"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, Eye, Settings, X, Zap } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { notifications } from "@/lib/mockData";

type NotificationFilter = "전체" | "체결" | "시세" | "전략" | "AI" | "시스템";
type NotificationItem = (typeof notifications)[number] & {
  related?: string;
  detail?: string[];
};

const tabs: NotificationFilter[] = ["전체", "체결", "시세", "전략", "AI", "시스템"];
const sampleNotifications: NotificationItem[] = [
  ...notifications.slice(0, 3).map((item) => ({
    ...item,
    related: item.type === "전략" ? "성장주 집중 전략" : "삼성전자",
    detail: item.type === "전략" ? ["삼성전자 비중 35% → 32%", "SK하이닉스 비중 30% → 33%"] : ["주문수량 100주", "체결가격 66,200원"],
  })),
  {
    id: "n-ai",
    type: "AI",
    title: "AI 코멘트",
    message: "관심종목 중 SK하이닉스의 단기 변동성이 확대되었습니다.",
    time: "08:50",
    importance: 2,
    read: false,
    action: "상세보기",
    related: "SK하이닉스",
    detail: ["거래대금 증가", "단기 이동평균선 이탈 여부 확인"],
  },
  {
    id: "n-system",
    type: "시스템",
    title: "시스템 알림",
    message: "증권사 연동 상태가 정상입니다.",
    time: "08:30",
    importance: 1,
    read: true,
    action: "상세보기",
    related: "설정",
    detail: ["계좌 정보 확인 완료", "실전 모드는 비활성 상태"],
  },
];

export default function NotificationsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<NotificationFilter>("전체");
  const [readIds, setReadIds] = useState<string[]>(sampleNotifications.filter((item) => item.read).map((item) => item.id));
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const displayNotifications = useMemo(
    () => sampleNotifications.filter((item) => activeTab === "전체" || item.type === activeTab),
    [activeTab]
  );
  const unreadCount = sampleNotifications.filter((item) => !readIds.includes(item.id)).length;

  const openDetail = (item: NotificationItem) => {
    setReadIds((ids) => Array.from(new Set([...ids, item.id])));
    setSelectedNotification(item);
  };

  return (
    <AppShell screen="notifications">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="미확인" value={`${unreadCount}건`} />
        <Summary label="전체" value={`${sampleNotifications.length}건`} />
        <Summary label="AI 알림" value={`${sampleNotifications.filter((item) => item.type === "AI").length}건`} />
        <Summary label="시스템" value={`${sampleNotifications.filter((item) => item.type === "시스템").length}건`} />
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
                setReadIds(sampleNotifications.map((item) => item.id));
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
                onClick={() => openDetail(item)}
                className={`cursor-pointer rounded-lg border p-4 shadow-sm transition hover:border-[#f3d58a] ${isRead ? "border-slate-100 bg-white" : "border-[#f3d58a] bg-[#fffdfa]"}`}
              >
                <div className="grid gap-3 lg:grid-cols-[48px_1fr_auto] lg:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef6ff] text-[#0f4c81]">
                    <NotificationIcon type={item.type} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-[#071832]">{item.title}</p>
                      {!isRead && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">안읽음</span>}
                      <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[11px] font-bold text-slate-600">{item.type}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {item.time}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDetail(item);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-ring"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    상세보기
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {selectedNotification && <NotificationDetailModal item={selectedNotification} onClose={() => setSelectedNotification(null)} />}
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

function NotificationDetailModal({ item, onClose }: { item: NotificationItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold text-[#8a6400]">{item.type}</p>
            <h2 className="mt-2 text-xl font-black tracking-normal text-[#071832]">{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-ring" aria-label="알림 상세 닫기">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-4 rounded-lg bg-[#f8fafc] p-4 text-sm leading-6 text-slate-700">{item.message}</p>
        {item.detail && (
          <div className="mt-4 rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-extrabold text-[#071832]">상세 내용</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {item.detail.map((detail) => (
                <li key={detail}>- {detail}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link href={item.type === "전략" ? "/my-strategy" : item.type === "시스템" ? "/settings" : "/home"} className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#071832] hover:bg-slate-50 focus-ring">
            관련 화면 보기
          </Link>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-lg bg-[#071832] px-4 text-sm font-extrabold text-white hover:bg-[#102642] focus-ring">
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "체결") return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />;
  if (type === "시세") return <Zap className="h-5 w-5" aria-hidden="true" />;
  if (type === "AI") return <Eye className="h-5 w-5" aria-hidden="true" />;
  return <Bell className="h-5 w-5" aria-hidden="true" />;
}
