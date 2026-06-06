"use client";

import { Mic } from "lucide-react";

interface FloatingMicButtonProps {
  onClick: () => void;
}

export function FloatingMicButton({ onClick }: FloatingMicButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-8 right-8 z-40 hidden h-20 w-20 flex-col items-center justify-center rounded-full border-2 border-[#f6b100] bg-white text-[#071832] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#fff8e1] lg:flex focus-ring"
      aria-label="말하기"
      title="말하기"
    >
      <Mic className="h-7 w-7" aria-hidden="true" />
      <span className="mt-1 text-xs font-bold">말하기</span>
    </button>
  );
}

export default FloatingMicButton;
