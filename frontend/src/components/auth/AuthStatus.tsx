"use client";

import { useState } from "react";
import { User, LogIn, LogOut, RefreshCw } from "lucide-react";
import { useAuth, useAccount } from "@/hooks";
import type { AuthMode } from "@/types/auth";

interface AuthStatusProps {
  compact?: boolean;
}

function modeBadge(mode: AuthMode) {
  const isDev = mode === "vps";

  return {
    label: isDev ? "개발 모드" : "실전 모드",
    switchLabel: isDev ? "실전 모드로 전환" : "개발 모드로 전환",
    className: isDev
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      : "bg-neutral-900 text-yellow-300 dark:bg-yellow-300 dark:text-neutral-950",
  };
}

export function AuthStatus({ compact = false }: AuthStatusProps) {
  const { status, isLoading, error, login, logout, switchMode } = useAuth();
  const { info, fetchInfo } = useAccount();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogin = async (mode: AuthMode) => {
    const success = await login(mode);
    if (success) {
      await fetchInfo();
    }
    setShowDropdown(false);
  };

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  const handleSwitchMode = async () => {
    const newMode: AuthMode = status.mode === "vps" ? "prod" : "vps";
    const success = await switchMode(newMode);
    if (success) {
      await fetchInfo();
    }
    setShowDropdown(false);
  };

  if (!status.authenticated) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 text-neutral-900 border border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-800 transition-colors"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {!compact && <span className="text-sm font-semibold">로그인</span>}
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
            <div className="p-2">
              <button
                onClick={() => handleLogin("vps")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              >
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                개발 모드 로그인
              </button>
              <button
                onClick={() => handleLogin("prod")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-neutral-100 dark:hover:bg-slate-800"
              >
                <span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-yellow-300" />
                실전 모드 로그인
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="absolute right-0 top-full mt-1 w-64 text-right text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    );
  }

  const badge = modeBadge(status.mode);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-yellow-200 hover:bg-yellow-50 dark:bg-slate-900 dark:border-yellow-900/60 dark:hover:bg-yellow-900/20 transition-colors"
      >
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.className}`}>
          {badge.label}
        </span>
        {!compact && (
          <>
            <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {info?.account_no || status.account || "Account"}
            </span>
          </>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Account</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm font-medium">
              {info?.account_no_full || status.account || "Not loaded"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {info?.account_type || "Trading Account"}
            </p>
          </div>

          <div className="p-2">
            <button
              onClick={handleSwitchMode}
              disabled={isLoading}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-900/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              {badge.switchLabel}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthStatus;
