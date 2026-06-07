"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw, Database, Shield, Clock, Brain, KeyRound, Save } from "lucide-react";
import { useAuth } from "@/hooks";
import { setSharedConfigStatus } from "@/hooks/useConfigStatus";
import { getMasterStatus, collectMasterFiles } from "@/lib/api/symbols";
import { getConfigStatus, saveKBConfig, saveLLMConfig } from "@/lib/api/config";
import { coerceLLMProvider, DEFAULT_LLM_PROVIDER, getDefaultLLMModel, LLM_PROVIDER_OPTIONS } from "@/lib/llmProviders";
import type { MasterStatus } from "@/types/symbols";
import type { AuthMode } from "@/types/auth";
import type { ConfigStatus, LLMProvider } from "@/types/config";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function modeLabel(mode: AuthMode) {
  return mode === "vps" ? "개발 모드" : "실전 모드";
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { status, isLoading, error, login, switchMode } = useAuth();
  const [masterStatus, setMasterStatus] = useState<MasterStatus | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(DEFAULT_LLM_PROVIDER);
  const [llmModel, setLlmModel] = useState(getDefaultLLMModel(DEFAULT_LLM_PROVIDER));
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [kbApiKey, setKbApiKey] = useState("");
  const [kbApiSecret, setKbApiSecret] = useState("");
  const [kbAccount, setKbAccount] = useState("");
  const [kbProductCode, setKbProductCode] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchMasterStatus();
      fetchConfigStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (status.cooldown_remaining && status.cooldown_remaining > 0) {
      setCooldownTimer(status.cooldown_remaining);
    }
  }, [status.cooldown_remaining]);

  useEffect(() => {
    if (cooldownTimer <= 0) return;

    const interval = setInterval(() => {
      setCooldownTimer((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownTimer]);

  const fetchMasterStatus = async () => {
    try {
      const result = await getMasterStatus();
      setMasterStatus(result);
    } catch (error) {
      console.error("Failed to fetch master status:", error);
    }
  };

  const fetchConfigStatus = async () => {
    try {
      const result = await getConfigStatus();
      setConfigStatus(result);
      const nextProvider = coerceLLMProvider(result.llm_provider);
      setLlmProvider(nextProvider);
      setLlmModel(result.llm_model && result.llm_model !== "mock-voice-intent" ? result.llm_model : getDefaultLLMModel(nextProvider));
      setLlmBaseUrl(result.llm_base_url || "");
    } catch (error) {
      console.error("Failed to fetch config status:", error);
    }
  };

  const handleSaveLLM = async () => {
    setIsSavingConfig(true);
    try {
      const response = await saveLLMConfig({
        provider: llmProvider,
        api_key: llmApiKey || null,
        base_url: llmBaseUrl || null,
        model: llmModel || null,
      });
      setConfigStatus(response.config);
      setSharedConfigStatus(response.config);
      setLlmApiKey("");
    } catch (error) {
      console.error("Failed to save LLM config:", error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveKB = async () => {
    setIsSavingConfig(true);
    try {
      const response = await saveKBConfig({
        api_key: kbApiKey || null,
        api_secret: kbApiSecret || null,
        account: kbAccount || null,
        product_code: kbProductCode || null,
      });
      setConfigStatus(response.config);
      setSharedConfigStatus(response.config);
      setKbApiKey("");
      setKbApiSecret("");
      setKbAccount("");
      setKbProductCode("");
    } catch (error) {
      console.error("Failed to save trading API config:", error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCollectMaster = async () => {
    setIsCollecting(true);
    try {
      const result = await collectMasterFiles();
      await fetchMasterStatus();
      if (!result.success && result.errors?.length) {
        console.error("Collection errors:", result.errors);
      }
    } catch (error) {
      console.error("Failed to collect master files:", error);
    } finally {
      setIsCollecting(false);
    }
  };

  const canSwitch = status.can_switch_mode !== false && cooldownTimer === 0;

  const handleSelectMode = async (mode: AuthMode) => {
    if (!status.authenticated) {
      await login(mode);
      return;
    }

    if (status.mode !== mode && canSwitch) {
      const success = await switchMode(mode);
      if (success) {
        setCooldownTimer(60);
      }
    }
  };

  if (!isOpen) return null;

  const isDev = status.mode === "vps";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md mx-4 max-h-[calc(100vh-2rem)] overflow-hidden bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">설정</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="설정 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Shield className="w-4 h-4 text-primary" />
              거래 인증 및 모드
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">인증 상태</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    status.authenticated
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {status.authenticated ? "인증됨" : "미인증"}
                </span>
              </div>

              {status.authenticated && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">현재 모드</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      isDev
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "bg-neutral-900 text-yellow-300 dark:bg-yellow-300 dark:text-neutral-950"
                    }`}
                  >
                    {status.mode_display || modeLabel(status.mode)}
                  </span>
                </div>
              )}

              {cooldownTimer > 0 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    모드 전환 대기 {cooldownTimer}초
                  </span>
                  <div className="flex-1 h-1 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-1000"
                      style={{ width: `${(cooldownTimer / 60) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectMode("vps")}
                  disabled={
                    isLoading ||
                    (status.authenticated && isDev) ||
                    (status.authenticated && !isDev && !canSwitch)
                  }
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    isDev && status.authenticated
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 ring-2 ring-yellow-500 cursor-default"
                      : isLoading
                        ? "bg-slate-100 dark:bg-slate-700 opacity-50"
                        : "bg-slate-100 dark:bg-slate-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                  }`}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      개발 모드
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleSelectMode("prod")}
                  disabled={
                    isLoading ||
                    (status.authenticated && !isDev) ||
                    (status.authenticated && isDev && !canSwitch)
                  }
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    !isDev && status.authenticated
                      ? "bg-neutral-900 text-yellow-300 dark:bg-yellow-300 dark:text-neutral-950 ring-2 ring-yellow-500 cursor-default"
                      : isLoading
                        ? "bg-slate-100 dark:bg-slate-700 opacity-50"
                        : "bg-slate-100 dark:bg-slate-700 hover:bg-neutral-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-yellow-300" />
                      실전 모드
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="px-2 py-1.5 rounded bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                모드는 1분에 한 번 전환할 수 있습니다.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Brain className="w-4 h-4 text-primary" />
              AI Provider
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
              <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
                <span className="text-slate-600 dark:text-slate-400">LLM 키</span>
                <span className="min-w-0 max-w-[12rem] truncate text-right font-mono text-xs text-slate-500" title={configStatus?.llm_key_masked || undefined}>
                  {configStatus?.llm_key_registered ? configStatus.llm_key_masked : "키 없음"}
                </span>
              </div>
              <select
                value={llmProvider}
                onChange={(event) => setLlmProvider(event.target.value as LLMProvider)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {LLM_PROVIDER_OPTIONS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={llmModel}
                onChange={(event) => setLlmModel(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="모델"
              />
              <input
                type="text"
                value={llmBaseUrl}
                onChange={(event) => setLlmBaseUrl(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Base URL"
              />
              <input
                type="password"
                value={llmApiKey}
                onChange={(event) => setLlmApiKey(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="새 API 키"
              />
              <button
                onClick={handleSaveLLM}
                disabled={isSavingConfig}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                AI 설정 저장
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <KeyRound className="w-4 h-4 text-primary" />
              OpenAPI 키
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400">API 키</span>
                  <span className="min-w-0 max-w-[7rem] truncate text-right font-mono text-xs text-slate-500" title={configStatus?.kb_key_masked || undefined}>
                    {configStatus?.kb_key_registered ? configStatus.kb_key_masked : "미설정"}
                  </span>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400">Secret</span>
                  <span className="min-w-0 max-w-[7rem] truncate text-right font-mono text-xs text-slate-500">
                    {configStatus?.kb_secret_registered ? "저장됨" : "미설정"}
                  </span>
                </div>
              </div>
              <input
                type="password"
                value={kbApiKey}
                onChange={(event) => setKbApiKey(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="새 API 키"
              />
              <input
                type="password"
                value={kbApiSecret}
                onChange={(event) => setKbApiSecret(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="새 API Secret"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={kbAccount}
                  onChange={(event) => setKbAccount(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="계좌"
                />
                <input
                  type="text"
                  value={kbProductCode}
                  onChange={(event) => setKbProductCode(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  placeholder="상품코드"
                />
              </div>
              <button
                onClick={handleSaveKB}
                disabled={isSavingConfig}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                OpenAPI 키 저장
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Database className="w-4 h-4 text-primary" />
              종목 마스터
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-3">
              {masterStatus ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">KOSPI</span>
                      <span className="font-mono">{masterStatus.kospi_count.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">KOSDAQ</span>
                      <span className="font-mono">{masterStatus.kosdaq_count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Total</span>
                    <span className="font-mono font-bold">{masterStatus.total_count.toLocaleString()}</span>
                  </div>
                  {masterStatus.kospi_updated && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      마지막 업데이트: {new Date(masterStatus.kospi_updated).toLocaleString()}
                    </div>
                  )}
                  {masterStatus.needs_update && (
                    <div className="text-xs text-amber-600 dark:text-amber-400">
                      업데이트가 필요합니다.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  불러오는 중...
                </div>
              )}
              <button
                onClick={handleCollectMaster}
                disabled={isCollecting}
                className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {isCollecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    수집 중...
                  </span>
                ) : (
                  "마스터 수집"
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
