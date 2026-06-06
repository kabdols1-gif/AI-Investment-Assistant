"use client";

import { useMemo, useRef, useState } from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import type { TradingMode } from "@/types/voice";

interface SpeechRecognitionResultEventLike {
  results: {
    length: number;
    [index: number]: {
      length: number;
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

interface VoiceInputPanelProps {
  mode: TradingMode;
  onModeChange: (mode: TradingMode) => void;
  onTranscript: (text: string) => void;
}

const modeOptions: Array<{ value: TradingMode; label: string; description: string }> = [
  { value: "simulation", label: "시뮬레이션", description: "주문 API 호출 없음" },
  { value: "paper", label: "모의투자", description: "거래 인증 필요" },
  { value: "live", label: "실전투자", description: "기본 비활성" },
];

export function VoiceInputPanel({ mode, onModeChange, onTranscript }: VoiceInputPanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("대기 중");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const supported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as WindowWithSpeech;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

  const toggleListening = () => {
    if (!supported) {
      setStatus("이 브라우저에서는 음성 인식을 사용할 수 없습니다.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setStatus("중지됨");
      return;
    }

    const speechWindow = window as WindowWithSpeech;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      onTranscript(transcript.trim());
      setStatus("음성 인식 완료");
    };
    recognition.onerror = () => {
      setStatus("마이크 권한 또는 음성 인식에 실패했습니다.");
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatus("듣는 중...");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
          실행 모드
        </div>
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="실행 모드">
          {modeOptions.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onModeChange(option.value)}
                className={`min-h-16 rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-primary bg-primary-bg text-slate-950 dark:text-slate-100"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                }`}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">음성 입력</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>
          </div>
          <button
            onClick={toggleListening}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
              isListening
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-primary text-white hover:bg-primary-dark"
            }`}
            aria-label={isListening ? "음성 입력 중지" : "음성 입력 시작"}
            title={isListening ? "음성 입력 중지" : "음성 입력 시작"}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        </div>
        {!supported && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            현재 브라우저에서 음성 인식을 사용할 수 없습니다. 아래 텍스트 입력을 사용하세요.
          </p>
        )}
      </div>
    </div>
  );
}

export default VoiceInputPanel;
