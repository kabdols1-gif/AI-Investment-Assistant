"use client";

import { FormEvent, useState } from "react";
import { ArrowUp, AudioWaveform, Loader2, Mic } from "lucide-react";
import type { LLMIntent } from "@/types/voice";
import type { ScreenKey } from "@/lib/mockData";

interface VoiceCommandBarProps {
  placeholder: string;
  screen: ScreenKey;
  isLoading?: boolean;
  onSubmitText: (text: string, screen: ScreenKey) => Promise<LLMIntent | void> | LLMIntent | void;
  onStartVoice: () => void;
}

export function VoiceCommandBar({
  placeholder,
  screen,
  isLoading = false,
  onSubmitText,
  onStartVoice,
}: VoiceCommandBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || isLoading) return;
    await onSubmitText(text, screen);
    setValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-14 w-full items-center gap-2 rounded-full border-2 border-[#f6b100] bg-white px-3 py-2 shadow-[0_3px_10px_rgba(7,24,50,0.08)]"
      aria-label="음성 또는 텍스트 명령 입력"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-[#071832] outline-none placeholder:text-slate-400"
        aria-label="명령 입력"
      />
      <AudioWaveform className="hidden h-5 w-5 flex-none text-[#071832] sm:block" aria-hidden="true" />
      <button
        type="button"
        onClick={onStartVoice}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#f6b100] text-[#071832] shadow-sm transition hover:bg-[#ffc533] focus-ring"
        aria-label="음성 입력 시작"
        title="음성 입력"
      >
        <Mic className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="submit"
        disabled={!value.trim() || isLoading}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#071832] text-white transition hover:bg-[#102a56] disabled:cursor-not-allowed disabled:opacity-45 focus-ring"
        aria-label="명령 전송"
        title="전송"
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" aria-hidden="true" />}
      </button>
    </form>
  );
}

export default VoiceCommandBar;
