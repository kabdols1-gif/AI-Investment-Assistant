"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, TrendingUp, Play, Settings } from "lucide-react";
import { useAuth } from "@/hooks";
import { SettingsModal } from "@/components/settings";

const navItems = [
  { href: "/voice", label: "AI 투자비서", icon: Bot },
  { href: "/execute", label: "주문 실행", icon: Play },
];

export function Navigation() {
  const pathname = usePathname();
  const { status } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isDev = status.mode === "vps";
  const modeLabel = isDev ? "개발 모드" : "실전 모드";
  const modeColor = isDev
    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
    : "bg-neutral-900 text-yellow-300 dark:bg-yellow-300 dark:text-neutral-950";

  return (
    <>
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-yellow-200/80 dark:border-yellow-900/40">
        <div className="w-full px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 focus-ring rounded-lg" aria-label="Strategy Builder Home">
              <div className="w-10 h-10 rounded-xl bg-yellow-400 text-neutral-950 flex items-center justify-center shadow-sm">
                <TrendingUp className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  AI 투자비서
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  음성 기반 투자 전략 실행
                </p>
              </div>
            </Link>

            <nav className="flex items-center gap-1" aria-label="Main navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={item.label}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-ring ${
                      isActive
                        ? "bg-yellow-100 text-neutral-950 dark:bg-yellow-900/30 dark:text-yellow-200"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              {status.authenticated && (
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${modeColor}`}
                  role="status"
                  aria-label={`Current mode: ${modeLabel}`}
                >
                  {modeLabel}
                </span>
              )}

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors focus-ring"
                aria-label="설정 열기"
              >
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}

export default Navigation;
