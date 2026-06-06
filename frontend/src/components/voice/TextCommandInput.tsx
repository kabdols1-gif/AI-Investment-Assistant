"use client";

import { Send } from "lucide-react";

interface TextCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function TextCommandInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: TextCommandInputProps) {
  return (
    <div className="space-y-3">
      <label htmlFor="voice-command" className="text-sm font-medium text-slate-700 dark:text-slate-300">
        투자 명령
      </label>
      <textarea
        id="voice-command"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            onSubmit();
          }
        }}
        rows={5}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        placeholder="예: 삼성전자 60일 이동평균선을 돌파하면 매수 전략으로 분석해줘"
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || value.trim().length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        AI로 해석하기
      </button>
    </div>
  );
}

export default TextCommandInput;
