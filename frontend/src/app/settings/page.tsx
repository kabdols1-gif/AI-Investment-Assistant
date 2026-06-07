"use client";

import { FormEvent, useEffect, useState } from "react";
import { Brain, Check, CheckCircle2, ChevronDown, Link2, Loader2, Save, ShieldCheck, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout";
import { useToast } from "@/components/ui";
import { setSharedConfigStatus } from "@/hooks";
import { getConfigStatus, saveKBConfig, saveLLMConfig, testKBConnection } from "@/lib/api/config";
import { BROKER_PROVIDER_OPTIONS, getBrokerProviderOption } from "@/lib/brokerProviders";
import { DEFAULT_CONFIG_STATUS } from "@/lib/configStatus";
import { coerceLLMProvider, DEFAULT_LLM_PROVIDER, getDefaultLLMModel, getLLMProviderOption, LLM_PROVIDER_OPTIONS } from "@/lib/llmProviders";
import type { BrokerProvider, ConfigStatus, KBConnectionTestResponse, LLMProvider } from "@/types/config";

const SECRET_PLACEHOLDER = "********";

type LocalTestResult = {
  status: "success" | "error";
  message: string;
};

export default function SettingsPage() {
  const toast = useToast();
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);
  const [isAiSaving, setIsAiSaving] = useState(false);
  const [isBrokerSaving, setIsBrokerSaving] = useState(false);
  const [isAiTesting, setIsAiTesting] = useState(false);
  const [isBrokerTesting, setIsBrokerTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<LocalTestResult | null>(null);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(DEFAULT_LLM_PROVIDER);
  const [isLlmProviderOpen, setIsLlmProviderOpen] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmModel, setLlmModel] = useState("gpt-4.1-mini");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [brokerProvider, setBrokerProvider] = useState<BrokerProvider>("kb");
  const [isBrokerOpen, setIsBrokerOpen] = useState(false);
  const [brokerBaseUrl, setBrokerBaseUrl] = useState("");
  const [kbAppKey, setKbAppKey] = useState("");
  const [kbSecret, setKbSecret] = useState("");
  const [kbAccount, setKbAccount] = useState("");
  const [kbTestResult, setKbTestResult] = useState<KBConnectionTestResponse | null>(null);

  const selectedProvider = getLLMProviderOption(llmProvider);
  const selectedModelOption = selectedProvider.models.find((model) => model.id === llmModel);
  const modelSelectValue = selectedModelOption ? llmModel : "__custom";
  const selectedBroker = getBrokerProviderOption(brokerProvider);
  const aiConnected = Boolean(status?.llm_key_registered);
  const brokerConnected = Boolean(status?.kb_key_registered && status?.kb_secret_registered && status?.kb_account_masked && status?.kb_base_url);

  const applyConfig = (config: ConfigStatus) => {
    setStatus(config);
    const nextProvider = coerceLLMProvider(config.llm_provider);
    setLlmProvider(nextProvider);
    setLlmModel(config.llm_model && config.llm_model !== "mock-voice-intent" ? config.llm_model : getDefaultLLMModel(nextProvider));
    setLlmBaseUrl(config.llm_base_url || getLLMProviderOption(nextProvider).defaultBaseUrl);
    setLlmKey(config.llm_key_masked || "");

    const nextBroker = (config.broker_provider as BrokerProvider) || "kb";
    setBrokerProvider(nextBroker);
    setBrokerBaseUrl(config.kb_base_url || getBrokerProviderOption(nextBroker).defaultBaseUrl);
    setKbAppKey(config.kb_key_masked || "");
    setKbSecret(config.kb_secret_registered ? SECRET_PLACEHOLDER : "");
    setKbAccount(config.kb_account_masked || "");
  };

  useEffect(() => {
    let mounted = true;

    getConfigStatus()
      .then((config) => {
        if (!mounted) return;
        setConfigLoadError(null);
        applyConfig(config);
      })
      .catch((error) => {
        if (!mounted) return;
        applyConfig(DEFAULT_CONFIG_STATUS);
        setConfigLoadError(error instanceof Error ? error.message : "설정 상태를 불러오지 못했습니다.");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectLLMProvider = (provider: LLMProvider) => {
    if (provider === llmProvider) return;
    const nextProvider = getLLMProviderOption(provider);
    setLlmProvider(provider);
    setLlmModel(getDefaultLLMModel(provider));
    setLlmBaseUrl(nextProvider.defaultBaseUrl);
    setIsLlmProviderOpen(false);
    setAiTestResult(null);
  };

  const handleSelectBrokerProvider = (provider: BrokerProvider) => {
    const nextBroker = getBrokerProviderOption(provider);
    setBrokerProvider(provider);
    setBrokerBaseUrl(nextBroker.defaultBaseUrl);
    setIsBrokerOpen(false);
    setKbTestResult(null);
  };

  const handleSaveAI = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAiSaving(true);
    setAiTestResult(null);
    try {
      const trimmedKey = llmKey.trim();
      const savedMaskedKey = status?.llm_key_masked || "";
      const response = await saveLLMConfig({
        provider: llmProvider,
        api_key: trimmedKey && trimmedKey !== savedMaskedKey ? trimmedKey : null,
        model: llmModel || null,
        base_url: llmBaseUrl || null,
      });
      applyConfig(response.config);
      setSharedConfigStatus(response.config);
      toast.success(response.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 설정 저장에 실패했습니다.");
    } finally {
      setIsAiSaving(false);
    }
  };

  const handleSaveBroker = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBrokerSaving(true);
    setKbTestResult(null);
    try {
      const trimmedAppKey = kbAppKey.trim();
      const trimmedSecret = kbSecret.trim();
      const trimmedAccount = kbAccount.trim();
      const response = await saveKBConfig({
        broker: brokerProvider,
        api_key: trimmedAppKey && trimmedAppKey !== (status?.kb_key_masked || "") ? trimmedAppKey : null,
        api_secret: trimmedSecret && trimmedSecret !== SECRET_PLACEHOLDER ? trimmedSecret : null,
        account: trimmedAccount && trimmedAccount !== (status?.kb_account_masked || "") ? trimmedAccount : null,
        base_url: brokerBaseUrl || null,
      });
      applyConfig(response.config);
      setSharedConfigStatus(response.config);
      toast.success(response.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "증권사 설정 저장에 실패했습니다.");
    } finally {
      setIsBrokerSaving(false);
    }
  };

  const handleTestAI = () => {
    setIsAiTesting(true);
    window.setTimeout(() => {
      const hasKey = Boolean(llmKey.trim()) || Boolean(status?.llm_key_registered);
      const hasRequiredConfig = hasKey && Boolean(llmProvider) && Boolean(llmModel.trim()) && Boolean(llmBaseUrl.trim());
      if (hasRequiredConfig) {
        const result = { status: "success" as const, message: "AI 연동 설정값이 정상적으로 확인되었습니다." };
        setAiTestResult(result);
        toast.success(result.message);
      } else {
        const result = { status: "error" as const, message: "Provider, API Key, Base URL, Model 값을 확인해 주세요." };
        setAiTestResult(result);
        toast.error(result.message);
      }
      setIsAiTesting(false);
    }, 320);
  };

  const handleTestBroker = async () => {
    if (!selectedBroker.connectionTestSupported) {
      toast.warning("현재 연결 테스트는 KB증권 BaaS 형식만 지원합니다.");
      return;
    }
    setIsBrokerTesting(true);
    setKbTestResult(null);
    try {
      const response = await testKBConnection();
      setKbTestResult(response);
      if (response.status === "success") {
        toast.success(response.message);
      } else if (response.status === "missing") {
        toast.warning(response.message);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "증권사 연결 테스트에 실패했습니다.");
    } finally {
      setIsBrokerTesting(false);
    }
  };

  return (
    <AppShell screen="settings">
      {configLoadError && (
        <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800" role="alert">
          설정 상태를 불러오지 못했습니다. 백엔드 연결을 확인해 주세요.
          <span className="mt-1 block text-xs font-semibold text-amber-700">{configLoadError}</span>
        </section>
      )}

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={handleSaveAI} className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Brain className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
              <h2 className="truncate text-base font-extrabold text-[#071832]">AI 연동 관리</h2>
            </div>
            <ConnectionBadge active={aiConnected} />
          </div>

          <div className="grid gap-3">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">Provider</p>
                <p className="text-xs font-semibold text-slate-500">현재: {selectedProvider.name}</p>
              </div>
              <LLMProviderCombobox
                selectedProvider={selectedProvider}
                isOpen={isLlmProviderOpen}
                onToggle={() => setIsLlmProviderOpen((open) => !open)}
                onSelect={handleSelectLLMProvider}
              />
            </div>

            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              모델 버전
              <select
                value={modelSelectValue}
                onChange={(event) => {
                  if (event.target.value !== "__custom") {
                    setLlmModel(event.target.value);
                  }
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f0c652]"
              >
                {selectedProvider.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {model.note}
                  </option>
                ))}
                <option value="__custom">직접 입력</option>
              </select>
            </label>
            <Field label="Model ID" value={llmModel} onChange={setLlmModel} placeholder={selectedProvider.models[0]?.id || "모델 ID 직접 입력"} />
            <Field label="API Key" value={llmKey} onChange={setLlmKey} type="password" placeholder="AI API Key 입력" />
            <Field label="Base URL" value={llmBaseUrl} onChange={setLlmBaseUrl} placeholder={selectedProvider.baseUrlPlaceholder} />
          </div>

          <SaveButton isLoading={isAiSaving} label="AI 설정 저장" />
          <TestButton isLoading={isAiTesting} onClick={handleTestAI} label="AI 연결 테스트" icon="ai" />
          {aiTestResult && <LocalResultCard result={aiTestResult} />}
        </form>

        <form onSubmit={handleSaveBroker} className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link2 className="h-5 w-5 text-[#8a6400]" aria-hidden="true" />
              <h2 className="truncate text-base font-extrabold text-[#071832]">증권사 연동 관리</h2>
            </div>
            <ConnectionBadge active={brokerConnected} />
          </div>

          <div className="grid gap-3">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">국내 증권사</p>
                <p className="text-xs font-semibold text-slate-500">현재: {selectedBroker.name}</p>
              </div>
              <BrokerProviderCombobox
                selectedBroker={selectedBroker}
                isOpen={isBrokerOpen}
                onToggle={() => setIsBrokerOpen((open) => !open)}
                onSelect={handleSelectBrokerProvider}
              />
            </div>
            <Field label="App Key" value={kbAppKey} onChange={setKbAppKey} type="password" placeholder="증권사 App Key 입력" />
            <Field label="Secret" value={kbSecret} onChange={setKbSecret} type="password" placeholder="증권사 Secret 입력" />
            <Field label="계좌" value={kbAccount} onChange={setKbAccount} placeholder="계좌번호 입력" />
            <Field label="Base URL" value={brokerBaseUrl} onChange={setBrokerBaseUrl} placeholder={selectedBroker.baseUrlPlaceholder} />
          </div>

          <SaveButton isLoading={isBrokerSaving} label="증권사 설정 저장" />
          <TestButton
            isLoading={isBrokerTesting}
            onClick={handleTestBroker}
            label={selectedBroker.connectionTestSupported ? "증권사 연결 테스트" : "선택 증권사 테스트 준비중"}
            disabled={!selectedBroker.connectionTestSupported}
            icon="broker"
          />
          {!selectedBroker.connectionTestSupported && (
            <p className="mt-2 text-xs leading-5 text-slate-500">선택한 증권사 정보는 저장할 수 있습니다. 연결 테스트는 현재 KB증권 BaaS 형식만 지원합니다.</p>
          )}
          {kbTestResult && <BrokerResultCard result={kbTestResult} />}
        </form>
      </section>

      <section className="mt-5 rounded-lg border border-[#f3d58a] bg-[#fff8e1] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#8a6400]" aria-hidden="true" />
          <p className="text-sm leading-6 text-slate-700">
            저장된 인증 정보는 화면에 평문으로 다시 표시하지 않습니다. AI 요청에는 API Secret, Access Token, 계좌비밀번호, 주문비밀번호를 포함하지 않습니다.
          </p>
        </div>
      </section>
    </AppShell>
  );
}

function LLMProviderCombobox({
  selectedProvider,
  isOpen,
  onToggle,
  onSelect,
}: {
  selectedProvider: ReturnType<typeof getLLMProviderOption>;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (provider: LLMProvider) => void;
}) {
  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={onToggle}
        data-testid="settings-llm-provider-selector"
        data-provider-id={selectedProvider.id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-[#f3d58a] focus-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          <ProviderLogo logoUrl={selectedProvider.logoUrl} mark={selectedProvider.mark} name={selectedProvider.name} accentClass={selectedProvider.accentClass} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-[#071832]">{selectedProvider.name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{selectedProvider.description}</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
          {LLM_PROVIDER_OPTIONS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              role="option"
              aria-selected={provider.id === selectedProvider.id}
              onClick={() => onSelect(provider.id)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-[#fff8e1] focus-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <ProviderLogo logoUrl={provider.logoUrl} mark={provider.mark} name={provider.name} accentClass={provider.accentClass} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#071832]">{provider.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{provider.description}</span>
                </span>
              </span>
              {provider.id === selectedProvider.id && <Check className="h-4 w-4 flex-none text-[#8a6400]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BrokerProviderCombobox({
  selectedBroker,
  isOpen,
  onToggle,
  onSelect,
}: {
  selectedBroker: ReturnType<typeof getBrokerProviderOption>;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (provider: BrokerProvider) => void;
}) {
  return (
    <div className="relative mt-2">
      <button
        type="button"
        onClick={onToggle}
        data-testid="settings-broker-selector"
        data-broker-id={selectedBroker.id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-[#f3d58a] focus-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          <ProviderLogo logoUrl={selectedBroker.logoUrl} mark={selectedBroker.mark} name={selectedBroker.name} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-[#071832]">{selectedBroker.name}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">{selectedBroker.description}</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
          {BROKER_PROVIDER_OPTIONS.map((broker) => (
            <button
              key={broker.id}
              type="button"
              role="option"
              data-testid="settings-broker-option"
              data-broker-id={broker.id}
              aria-selected={broker.id === selectedBroker.id}
              onClick={() => onSelect(broker.id)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-[#fff8e1] focus-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <ProviderLogo logoUrl={broker.logoUrl} mark={broker.mark} name={broker.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#071832]">{broker.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{broker.description}</span>
                </span>
              </span>
              {broker.id === selectedBroker.id && <Check className="h-4 w-4 flex-none text-[#8a6400]" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderLogo({
  logoUrl,
  mark,
  name,
  accentClass = "bg-[#f8fafc] text-[#071832] border-slate-200",
}: {
  logoUrl?: string;
  mark: string;
  name: string;
  accentClass?: string;
}) {
  return (
    <span className={`relative flex h-10 w-10 flex-none items-center justify-center rounded-lg border text-xs font-black ${accentClass}`}>
      <span className="px-1 text-center leading-none" aria-hidden={Boolean(logoUrl)}>
        {mark}
      </span>
      {logoUrl ? (
        <span
          className="absolute h-6 w-6 rounded-sm bg-white bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${logoUrl})` }}
          aria-label={name}
        />
      ) : null}
    </span>
  );
}

function ConnectionBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
        active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
      }`}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      {active ? "정상" : "미연결"}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder: string;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f0c652]"
      />
    </label>
  );
}

function SaveButton({ isLoading, label }: { isLoading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#071832] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#102a56] disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );
}

function TestButton({
  isLoading,
  onClick,
  label,
  disabled = false,
  icon,
}: {
  isLoading: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  icon: "ai" | "broker";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || disabled}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#f3d58a] bg-[#fff8e1] px-4 py-3 text-sm font-extrabold text-[#8a6400] transition hover:bg-[#ffefb9] disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : icon === "ai" ? (
        <Brain className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Link2 className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

function LocalResultCard({ result }: { result: LocalTestResult }) {
  return (
    <div className="mt-3 rounded-lg bg-[#f8fafc] px-3 py-3 text-sm">
      <p className={`font-bold ${result.status === "success" ? "text-emerald-700" : "text-red-600"}`}>{result.message}</p>
    </div>
  );
}

function BrokerResultCard({ result }: { result: KBConnectionTestResponse }) {
  return (
    <div className="mt-3 rounded-lg bg-[#f8fafc] px-3 py-3 text-sm">
      <p className={`font-bold ${result.status === "success" ? "text-emerald-700" : result.status === "missing" ? "text-amber-700" : "text-red-600"}`}>
        {result.message}
      </p>
      <p className="mt-1 text-xs text-slate-500">Base URL: {result.base_url}</p>
      <p className="mt-1 text-xs text-slate-500">토큰 수신: {result.token_received ? "확인됨" : "미확인"}</p>
    </div>
  );
}
