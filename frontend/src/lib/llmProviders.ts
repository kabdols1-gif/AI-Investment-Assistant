import type { LLMProvider } from "@/types/config";

export interface LLMModelOption {
  id: string;
  label: string;
  note: string;
}

export interface LLMProviderOption {
  id: LLMProvider;
  name: string;
  mark: string;
  logoUrl?: string;
  description: string;
  accentClass: string;
  defaultBaseUrl: string;
  baseUrlPlaceholder: string;
  models: LLMModelOption[];
}

export const DEFAULT_LLM_PROVIDER: LLMProvider = "openai";

export const LLM_PROVIDER_OPTIONS: LLMProviderOption[] = [
  {
    id: "openai",
    name: "OpenAI",
    mark: "AI",
    logoUrl: "https://www.google.com/s2/favicons?domain=openai.com&sz=64",
    description: "OpenAI API 키로 음성 의도 분석",
    accentClass: "bg-[#e8f7f2] text-[#0f6b56] border-[#bde8dc]",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlPlaceholder: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", note: "기본값" },
      { id: "gpt-4.1", label: "GPT-4.1", note: "고성능" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", note: "경량" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    mark: "C",
    logoUrl: "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64",
    description: "Claude 계열 모델 사용",
    accentClass: "bg-[#f8efe7] text-[#8a4f2b] border-[#ead1bd]",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "Anthropic 기본 엔드포인트 사용 시 비워둠",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", note: "균형형" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", note: "경량" },
      { id: "claude-3-opus-latest", label: "Claude 3 Opus", note: "고성능" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    mark: "G",
    logoUrl: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64",
    description: "Gemini API 모델 사용",
    accentClass: "bg-[#eaf1ff] text-[#2453a6] border-[#c9d9ff]",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "Gemini 기본 엔드포인트 사용 시 비워둠",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "경량" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "고성능" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", note: "호환" },
    ],
  },
  {
    id: "openai_compatible",
    name: "OpenAI Compatible",
    mark: "OC",
    description: "OpenAI 호환 API 서버 사용",
    accentClass: "bg-[#fff8e1] text-[#8a6400] border-[#f3d58a]",
    defaultBaseUrl: "",
    baseUrlPlaceholder: "예: https://api.example.com/v1",
    models: [
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini", note: "호환 기본" },
      { id: "llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct", note: "예시" },
      { id: "qwen2.5-7b-instruct", label: "Qwen2.5 7B Instruct", note: "예시" },
    ],
  },
  {
    id: "local",
    name: "Local",
    mark: "L",
    description: "로컬 AI 서버에 연결",
    accentClass: "bg-[#eef2ff] text-[#3730a3] border-[#c7d2fe]",
    defaultBaseUrl: "http://localhost:11434/v1",
    baseUrlPlaceholder: "예: http://localhost:11434/v1",
    models: [
      { id: "llama3.1", label: "llama3.1", note: "로컬 예시" },
      { id: "qwen2.5", label: "qwen2.5", note: "로컬 예시" },
      { id: "mistral", label: "mistral", note: "로컬 예시" },
    ],
  },
];

export function coerceLLMProvider(provider: LLMProvider | string | null | undefined): LLMProvider {
  return LLM_PROVIDER_OPTIONS.find((option) => option.id === provider)?.id || DEFAULT_LLM_PROVIDER;
}

export function getLLMProviderOption(provider: LLMProvider | string | null | undefined) {
  return LLM_PROVIDER_OPTIONS.find((option) => option.id === provider) || LLM_PROVIDER_OPTIONS[0];
}

export function getDefaultLLMModel(provider: LLMProvider | string | null | undefined) {
  return getLLMProviderOption(provider).models[0]?.id || "";
}
