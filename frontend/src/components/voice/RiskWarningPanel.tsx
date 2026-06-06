"use client";

import { ShieldAlert } from "lucide-react";

interface RiskWarningPanelProps {
  warnings: string[];
}

export function RiskWarningPanel({ warnings }: RiskWarningPanelProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        위험 점검
      </div>
      <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-200">
        {warnings.map((warning) => (
          <li key={warning} className="flex gap-2">
            <span aria-hidden="true">-</span>
            <span>{warning}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RiskWarningPanel;
