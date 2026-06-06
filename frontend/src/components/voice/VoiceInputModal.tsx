"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, RefreshCw, SendHorizontal, X } from "lucide-react";
import type { LLMIntent } from "@/types/voice";
import type { ScreenKey } from "@/lib/mockData";

type RecognitionStatus = "idle" | "listening" | "ready" | "unsupported" | "error";

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface BrowserWindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface VoiceInputModalProps {
  open: boolean;
  screen: ScreenKey;
  placeholder: string;
  isLoading?: boolean;
  onClose: () => void;
  onExecute: (
    text: string,
    screen: ScreenKey,
    source?: "voice" | "text"
  ) => Promise<LLMIntent | void> | LLMIntent | void;
}

export function VoiceInputModal({
  open,
  screen,
  placeholder,
  isLoading = false,
  onClose,
  onExecute,
}: VoiceInputModalProps) {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("마이크를 준비하고 있습니다.");
  const [recognizedBySpeech, setRecognizedBySpeech] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const isListening = status === "listening";

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const browserWindow = window as BrowserWindowWithSpeech;
    const SpeechRecognition =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setInterimTranscript("");

    if (!SpeechRecognition) {
      setStatus("unsupported");
      setStatusMessage("이 브라우저는 음성 인식을 지원하지 않습니다. 아래 입력창에 직접 입력해 주세요.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ko-KR";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        setStatus("listening");
        setStatusMessage("듣는 중입니다. 말한 뒤 인식 문장을 확인해 주세요.");
      };
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const phrase = result[0]?.transcript || "";
          if (result.isFinal) {
            finalText += phrase;
          } else {
            interimText += phrase;
          }
        }
        if (finalText.trim()) {
          setTranscript((current) => `${current} ${finalText}`.trim());
          setRecognizedBySpeech(true);
          setStatus("ready");
          setStatusMessage("음성 인식이 완료되었습니다. 문장을 확인한 뒤 실행하세요.");
        }
        setInterimTranscript(interimText.trim());
      };
      recognition.onerror = (event) => {
        setStatus("error");
        setStatusMessage(translateSpeechError(event.error));
      };
      recognition.onend = () => {
        setInterimTranscript("");
        setStatus((current) => (current === "listening" ? "ready" : current));
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setStatus("error");
      setStatusMessage("마이크를 시작하지 못했습니다. 권한을 확인하거나 직접 입력해 주세요.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setTranscript("");
      setRecognizedBySpeech(false);
      startListening();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [open, startListening]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = transcript.trim();
    if (!text || isLoading) return;
    await onExecute(text, screen, recognizedBySpeech ? "voice" : "text");
    setTranscript("");
    setRecognizedBySpeech(false);
    onClose();
  };

  const retryListening = () => {
    setTranscript("");
    setRecognizedBySpeech(false);
    startListening();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg border border-[#f0c652] bg-white p-5 shadow-2xl"
        aria-label="음성 입력 모달"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f6b100] text-[#071832]">
              <Mic className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#071832]">음성 명령</h2>
              <p className="text-xs text-slate-500">인식된 문장을 확인한 뒤 실행합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-ring"
            aria-label="닫기"
            title="닫기"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="my-6 rounded-lg border border-slate-200 bg-[#f8fafc] p-5">
          <div className="mx-auto flex h-16 max-w-64 items-center justify-center gap-1">
            {Array.from({ length: 18 }).map((_, index) => (
              <span
                key={index}
                className={`w-1 rounded-full bg-[#f6b100] ${isListening ? "animate-pulse" : ""}`}
                style={{ height: `${12 + ((index * 7) % 32)}px` }}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-sm font-semibold text-[#071832]">
            {isListening ? "듣는 중" : status === "ready" ? "확인 대기" : "텍스트 입력 가능"}
          </p>
          <p className="mt-1 text-center text-xs text-slate-500">{statusMessage}</p>
          {interimTranscript && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-center text-sm text-slate-600">
              {interimTranscript}
            </p>
          )}
        </div>

        <textarea
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder={placeholder}
          className="min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-[#071832] outline-none transition placeholder:text-slate-400 focus:border-[#f0c652] focus:ring-2 focus:ring-[#f0c652]/25"
          aria-label="인식된 문장"
        />

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={retryListening}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-ring"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            다시 말하기
          </button>
          <button
            type="button"
            onClick={stopListening}
            disabled={!isListening}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
          >
            <MicOff className="h-4 w-4" aria-hidden="true" />
            중지
          </button>
          <button
            type="submit"
            disabled={!transcript.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#071832] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#102a56] disabled:cursor-not-allowed disabled:opacity-45 focus-ring"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-4 w-4" aria-hidden="true" />}
            실행
          </button>
        </div>
      </form>
    </div>
  );
}

function translateSpeechError(error: string) {
  const messages: Record<string, string> = {
    "not-allowed": "마이크 권한이 거부되었습니다. 브라우저 권한을 허용하거나 직접 입력해 주세요.",
    "service-not-allowed": "브라우저 음성 인식 서비스가 허용되지 않았습니다. 직접 입력으로 진행할 수 있습니다.",
    "no-speech": "음성이 감지되지 않았습니다. 다시 말하기를 누르거나 직접 입력해 주세요.",
    "audio-capture": "마이크 장치를 찾지 못했습니다. 장치 연결과 권한을 확인해 주세요.",
    network: "음성 인식 서비스 연결에 실패했습니다. 직접 입력으로 진행할 수 있습니다.",
  };
  return messages[error] || "음성 인식 중 오류가 발생했습니다. 직접 입력으로 진행할 수 있습니다.";
}

export default VoiceInputModal;
