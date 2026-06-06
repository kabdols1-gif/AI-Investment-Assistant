"use client";

import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import type { VoiceLogEntry } from "@/types/voice";

interface VoiceAssistantLogProps {
  logs: VoiceLogEntry[];
}

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
};

const colorMap = {
  info: "text-blue-500",
  success: "text-green-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

export function VoiceAssistantLog({ logs }: VoiceAssistantLogProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        AI 투자비서의 처리 로그가 여기에 표시됩니다.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] space-y-3 overflow-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {logs.map((log) => {
        const Icon = iconMap[log.type];
        return (
          <div key={log.id} className="flex gap-3 text-sm">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colorMap[log.type]}`} aria-hidden="true" />
            <div>
              <p className="text-slate-700 dark:text-slate-200">{log.message}</p>
              <p className="text-xs text-slate-400">{log.timestamp}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default VoiceAssistantLog;
