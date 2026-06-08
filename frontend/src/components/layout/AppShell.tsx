"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, FormEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  Flame,
  GripVertical,
  Heart,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Mic,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PieChart,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { RiskNotice } from "@/components/safety/RiskNotice";
import { BrokerConnectionNotice } from "@/components/settings/BrokerConnectionGate";
import { RecentViewedStocksBar } from "@/components/symbols";
import { FloatingMicButton, VoiceInputModal } from "@/components/voice";
import { useToast } from "@/components/ui";
import { CONFIG_STATUS_UPDATED_EVENT, setSharedConfigStatus } from "@/hooks/useConfigStatus";
import { interpretVoice } from "@/lib/api/voice";
import { getConfigStatus, saveKBConfig, saveLLMConfig } from "@/lib/api/config";
import { BROKER_PROVIDER_OPTIONS, getBrokerProviderOption } from "@/lib/brokerProviders";
import { isBrokerConnected } from "@/lib/configStatus";
import { coerceLLMProvider, DEFAULT_LLM_PROVIDER, getDefaultLLMModel, getLLMProviderOption, LLM_PROVIDER_OPTIONS } from "@/lib/llmProviders";
import { marketOverview, navScreens, recentViewedStocks, screenMeta, tradingWorkspaceByStockId, type MarketTone, type ScreenKey } from "@/lib/mockData";
import type { BrokerProvider, ConfigStatus, LLMProvider } from "@/types/config";
import type { RecentViewedStockItem } from "@/types/symbols";
import type { LLMIntent } from "@/types/voice";

const iconMap = {
  dashboard: LayoutDashboard,
  assets: Home,
  "my-strategy": ShieldCheck,
  market: Flame,
  watchlist: Heart,
  portfolio: PieChart,
  notifications: Bell,
  settings: Settings,
};

const NAV_COLLAPSED_WIDTH = 72;
const NAV_MIN_WIDTH = 208;
const NAV_MAX_WIDTH = 360;
const CHAT_MIN_WIDTH = 280;
const CHAT_MAX_WIDTH = 560;
const THEME_STORAGE_KEY = "ai-investment-assistant.theme";
const RECENT_STOCKS_STORAGE_KEY = "ai-investment-assistant.recent-stocks.v1";

interface AppShellProps {
  screen: ScreenKey;
  children: ReactNode;
  selectedStock?: {
    name: string;
    code: string;
  };
}

type LLMChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type StockWorkspaceOrderSide = "buy" | "sell";

type ThemeMode = "light" | "dark";

const persistentScreenByPathname: Partial<Record<string, ScreenKey>> = {
  "/dashboard": "dashboard",
  "/assets": "assets",
  "/my-settings": "my-settings",
  "/my-strategy": "my-strategy",
  "/market": "market",
  "/portfolio": "portfolio",
  "/settings": "settings",
  "/strategy": "strategy",
  "/notifications": "notifications",
  "/watchlist": "watchlist",
};

const AppShellPersistenceContext = createContext(false);

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialRecentItems(): RecentViewedStockItem[] {
  if (typeof window === "undefined") return recentViewedStocks;

  try {
    const storedValue = window.localStorage.getItem(RECENT_STOCKS_STORAGE_KEY);
    if (!storedValue) return recentViewedStocks;
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return recentViewedStocks;
    const storedItems = parsedValue.filter(isRecentViewedStockItem);
    if (storedItems.length === 0) return recentViewedStocks;
    return mergeRecentItems(storedItems, recentViewedStocks);
  } catch {
    return recentViewedStocks;
  }
}

function persistRecentItems(items: RecentViewedStockItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RECENT_STOCKS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Keep the in-memory recent list usable if localStorage is unavailable.
  }
}

function mergeRecentItems(primaryItems: RecentViewedStockItem[], fallbackItems: RecentViewedStockItem[]) {
  const seenIds = new Set<string>();
  return [...primaryItems, ...fallbackItems].filter((item) => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
}

function isRecentViewedStockItem(value: unknown): value is RecentViewedStockItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentViewedStockItem>;
  return (
    typeof item.id === "string" &&
    typeof item.code === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "string" &&
    typeof item.changeRate === "string" &&
    (item.changeDirection === "up" || item.changeDirection === "down" || item.changeDirection === "neutral") &&
    typeof item.volume === "string" &&
    typeof item.tradingValue === "string" &&
    (typeof item.iconUrl === "undefined" || typeof item.iconUrl === "string")
  );
}

function getSelectedStockMeta(id?: string | null) {
  if (!id) return undefined;
  const tradingData = tradingWorkspaceByStockId[id];
  if (!tradingData) return undefined;

  return {
    name: tradingData.stock.name,
    code: tradingData.stock.code,
  };
}

export function AppShell({ screen, children, selectedStock }: AppShellProps) {
  const isPersistentShellMounted = useContext(AppShellPersistenceContext);
  if (isPersistentShellMounted) {
    return <>{children}</>;
  }

  return <AppShellFrame screen={screen} selectedStock={selectedStock}>{children}</AppShellFrame>;
}

export function PersistentAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const screen = persistentScreenByPathname[pathname];

  if (!screen) {
    return <>{children}</>;
  }

  const stockId = screen === "assets" ? searchParams.get("stock") : null;
  const selectedStock = getSelectedStockMeta(stockId);

  return (
    <AppShellPersistenceContext.Provider value>
      <AppShellFrame screen={screen} selectedStock={selectedStock}>
        {children}
      </AppShellFrame>
    </AppShellPersistenceContext.Provider>
  );
}

function AppShellFrame({ screen, children, selectedStock }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const meta = screenMeta[screen];
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isLlmPanelOpen, setIsLlmPanelOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<LLMChatMessage[]>([]);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [navWidth, setNavWidth] = useState(256);
  const [chatWidth, setChatWidth] = useState(320);
  const [selectedBroker, setSelectedBroker] = useState<BrokerProvider>("kb");
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<LLMProvider>(DEFAULT_LLM_PROVIDER);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isBrokerMenuOpen, setIsBrokerMenuOpen] = useState(false);
  const [isLlmMenuOpen, setIsLlmMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [recentItems, setRecentItems] = useState<RecentViewedStockItem[]>(getInitialRecentItems);
  const [activeRecentStockId, setActiveRecentStockId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const isLlmUnlocked = Boolean(configStatus?.llm_key_registered);
  const activeWorkspaceStock = selectedStock ?? (pathname === "/assets" ? getSelectedStockMeta(activeRecentStockId) : undefined);
  const selectedStockCode = activeWorkspaceStock?.code ?? null;

  useEffect(() => {
    if (screen === "market") {
      setIsNavCollapsed(true);
      setIsLlmPanelOpen(false);
      return;
    }

    if (selectedStockCode) {
      setIsNavCollapsed(true);
      setIsLlmPanelOpen(false);
      return;
    }

    setIsNavCollapsed(false);
    setIsLlmPanelOpen(true);
  }, [screen, selectedStockCode]);

  const runAssistant = useCallback(
    async (
      text: string,
      activeScreen: ScreenKey,
      source: "voice" | "text" = "text"
    ): Promise<LLMIntent | void> => {
      if (!isLlmUnlocked) {
        toast.info("AI API Key를 먼저 연결해 주세요.");
        router.push("/settings");
        return;
      }
      setChatMessages((messages) => [
        ...messages,
        { id: createChatMessageId("user"), role: "user", text },
      ]);
      setIsLoading(true);
      try {
        const intent = await interpretVoice({
          text,
          source,
          mode: "simulation",
          screen: activeScreen,
        });
        setChatMessages((messages) => [
          ...messages,
          { id: createChatMessageId("assistant"), role: "assistant", text: intent.assistant_message || intent.raw_summary },
        ]);
        return intent;
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 투자비서 요청에 실패했습니다.";
        toast.error(message);
        setChatMessages((messages) => [
          ...messages,
          { id: createChatMessageId("assistant"), role: "assistant", text: message },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLlmUnlocked, router, toast]
  );

  const handleChatSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextText = chatInput.trim();
      if (!nextText || isLoading) return;
      setChatInput("");
      await runAssistant(nextText, screen, "text");
    },
    [chatInput, isLoading, runAssistant, screen]
  );

  const handleSuggestedQuestion = useCallback(
    async (question: string) => {
      if (isLoading) return;
      await runAssistant(question, screen, "text");
    },
    [isLoading, runAssistant, screen]
  );

  const handleBrokerChange = useCallback(
    async (provider: BrokerProvider) => {
      setSelectedBroker(provider);
      setIsBrokerMenuOpen(false);
      try {
        const response = await saveKBConfig({ broker: provider });
        setConfigStatus(response.config);
        setSharedConfigStatus(response.config);
        toast.success(`${getBrokerProviderOption(provider).name} 선택을 저장했습니다.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "증권사 선택 저장에 실패했습니다.";
        toast.error(message);
      }
    },
    [toast]
  );

  const handleLlmProviderChange = useCallback(
    async (provider: LLMProvider) => {
      const nextProvider = getLLMProviderOption(provider);
      setSelectedLlmProvider(provider);
      setIsLlmMenuOpen(false);
      try {
        const response = await saveLLMConfig({
          provider,
          model: getDefaultLLMModel(provider),
          base_url: nextProvider.defaultBaseUrl || null,
        });
        setConfigStatus(response.config);
        setSharedConfigStatus(response.config);
        toast.success(`${nextProvider.name} 선택을 저장했습니다.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI 선택 저장에 실패했습니다.";
        toast.error(message);
      }
    },
    [toast]
  );

  const createRecentItemFromStock = useCallback((id: string): RecentViewedStockItem | null => {
    const tradingData = tradingWorkspaceByStockId[id];
    if (!tradingData) {
      return recentViewedStocks.find((item) => item.id === id) ?? null;
    }

    const { stock } = tradingData;
    return {
      id: stock.id,
      code: stock.code,
      name: stock.name,
      price: stock.price,
      changeRate: stock.changeRate,
      changeDirection: stock.tone,
      volume: stock.volume,
      tradingValue: stock.tradingValue,
      iconUrl: stock.iconUrl,
    };
  }, []);

  const openStockWorkspace = useCallback(
    (id: string, options?: { addToRecent?: boolean; orderSide?: StockWorkspaceOrderSide; quantity?: string }) => {
      const params = new URLSearchParams({ stock: id });
      if (options?.orderSide) params.set("order", options.orderSide);
      if (options?.quantity) params.set("quantity", options.quantity);
      const nextUrl = `/assets?${params.toString()}`;
      if (options?.addToRecent) {
        const recentItem = createRecentItemFromStock(id);
        if (recentItem) {
          setRecentItems((currentItems) => {
            const nextItems = [recentItem, ...currentItems.filter((item) => item.id !== id)];
            persistRecentItems(nextItems);
            return nextItems;
          });
        }
      }
      setActiveRecentStockId(id);
      if (pathname === "/assets") {
        window.history.pushState(null, "", nextUrl);
        window.dispatchEvent(new CustomEvent("recent-stock-selected", { detail: { id, orderSide: options?.orderSide, quantity: options?.quantity } }));
        return;
      }
      router.push(nextUrl);
    },
    [createRecentItemFromStock, pathname, router]
  );

  const handleRecentStockSelect = useCallback(
    (id: string) => {
      openStockWorkspace(id);
    },
    [openStockWorkspace]
  );

  const handleRecentStockRemove = useCallback(
    (id: string) => {
      setRecentItems((currentItems) => {
        const nextItems = currentItems.filter((item) => item.id !== id);
        persistRecentItems(nextItems);
        return nextItems;
      });
      if (activeRecentStockId === id) {
        setActiveRecentStockId(null);
        if (pathname === "/assets") {
          window.history.replaceState(null, "", "/assets");
          window.dispatchEvent(new CustomEvent("recent-stock-selected", { detail: { id: null } }));
        }
      }
    },
    [activeRecentStockId, pathname]
  );

  const startNavResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = isNavCollapsed ? NAV_MIN_WIDTH : navWidth;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setIsNavCollapsed(false);
        setNavWidth(clamp(startWidth + moveEvent.clientX - startX, NAV_MIN_WIDTH, NAV_MAX_WIDTH));
      };
      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [isNavCollapsed, navWidth]
  );

  const startChatResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = chatWidth;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        setChatWidth(clamp(startWidth - (moveEvent.clientX - startX), CHAT_MIN_WIDTH, CHAT_MAX_WIDTH));
      };
      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [chatWidth]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setIsBootstrapping(false), 360);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    getConfigStatus()
      .then((config) => {
        if (!mounted) return;
        setConfigStatus(config);
        setSharedConfigStatus(config);
        setSelectedLlmProvider(coerceLLMProvider(config.llm_provider));
        setSelectedBroker(getBrokerProviderOption(config.broker_provider).id);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleConfigStatusUpdated = (event: Event) => {
      const config = (event as CustomEvent<ConfigStatus>).detail;
      if (!config) return;
      setConfigStatus(config);
      setSelectedLlmProvider(coerceLLMProvider(config.llm_provider));
      setSelectedBroker(getBrokerProviderOption(config.broker_provider).id);
    };

    window.addEventListener(CONFIG_STATUS_UPDATED_EVENT, handleConfigStatusUpdated);
    return () => window.removeEventListener(CONFIG_STATUS_UPDATED_EVENT, handleConfigStatusUpdated);
  }, []);

  useEffect(() => {
    const handleStockWorkspaceRequested = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string | null; orderSide?: StockWorkspaceOrderSide; quantity?: string }>).detail;
      if (!detail?.id) return;
      openStockWorkspace(detail.id, { addToRecent: true, orderSide: detail.orderSide, quantity: detail.quantity });
    };

    window.addEventListener("holding-stock-selected", handleStockWorkspaceRequested);
    window.addEventListener("watchlist-stock-selected", handleStockWorkspaceRequested);
    window.addEventListener("portfolio-stock-selected", handleStockWorkspaceRequested);
    return () => {
      window.removeEventListener("holding-stock-selected", handleStockWorkspaceRequested);
      window.removeEventListener("watchlist-stock-selected", handleStockWorkspaceRequested);
      window.removeEventListener("portfolio-stock-selected", handleStockWorkspaceRequested);
    };
  }, [openStockWorkspace]);

  useEffect(() => {
    const syncActiveRecentStock = () => {
      if (pathname !== "/assets") {
        setActiveRecentStockId(null);
        return;
      }
      const stockId = new URLSearchParams(window.location.search).get("stock");
      const exists = stockId ? recentItems.some((item) => item.id === stockId) : false;
      setActiveRecentStockId(exists ? stockId : null);
    };

    const handleRecentStockEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string | null }>).detail;
      setActiveRecentStockId(detail?.id ?? null);
    };

    syncActiveRecentStock();
    window.addEventListener("popstate", syncActiveRecentStock);
    window.addEventListener("recent-stock-selected", handleRecentStockEvent);

    return () => {
      window.removeEventListener("popstate", syncActiveRecentStock);
      window.removeEventListener("recent-stock-selected", handleRecentStockEvent);
    };
  }, [pathname, recentItems]);

  const renderedNavWidth = isNavCollapsed ? NAV_COLLAPSED_WIDTH : navWidth;
  const selectedBrokerOption = getBrokerProviderOption(selectedBroker);
  const selectedLlmOption = getLLMProviderOption(selectedLlmProvider);
  const isDarkTheme = theme === "dark";
  const hasRecentBar = recentItems.length > 0;
  const brokerConnected = configStatus ? isBrokerConnected(configStatus) : true;

  if (isBootstrapping) {
    return <AppBootSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white text-[#071832]">
      <header className="sticky top-0 z-50 border-b border-[#efd488] bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Link href="/dashboard" className="flex flex-none items-center gap-3 rounded-lg focus-ring" aria-label="AI 투자비서 대시보드">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#f6b100] text-[#071832]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-base font-extrabold tracking-normal text-[#071832]">AI 투자비서</p>
              <p className="truncate text-xs text-slate-500">Voice First Investment Assistant</p>
            </div>
          </Link>

          <RealtimePopularPill onSelectStock={(id) => openStockWorkspace(id, { addToRecent: true })} />

          <MarketTicker />

          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => toast.info("토론/커뮤니티 화면을 준비하고 있습니다.")}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#071832] transition hover:bg-[#fff8e1] focus-ring"
              aria-label="토론 커뮤니티"
              title="토론 커뮤니티"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#071832] transition hover:bg-[#fff8e1] focus-ring"
              aria-label={isDarkTheme ? "밝기모드로 전환" : "다크모드로 전환"}
              title={isDarkTheme ? "밝기모드" : "다크모드"}
              aria-pressed={isDarkTheme}
            >
              {isDarkTheme ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
            </button>
            <Link
              href="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:bg-[#fff8e1] focus-ring"
              aria-label="알림"
              title="알림"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                3
              </span>
            </Link>
            <Link
              href="/my-settings"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition hover:bg-[#fff8e1] focus-ring"
              aria-label="내 설정"
              title="내 설정"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex w-full gap-0">
        <aside
          className={`sticky top-16 hidden h-[calc(100vh-4rem)] flex-none self-start overflow-visible border-r border-[#efd488] bg-white text-[#071832] shadow-xl transition-[width] duration-200 lg:block ${
            isNavCollapsed ? "p-2" : "p-4"
          }`}
          style={{ width: renderedNavWidth }}
        >
          <button
            type="button"
            onClick={() => setIsNavCollapsed((currentValue) => !currentValue)}
            className="absolute -right-4 top-5 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-[#efd488] bg-white text-[#071832] shadow-md transition hover:bg-[#fff8e1] focus-ring"
            aria-label={isNavCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
            aria-expanded={!isNavCollapsed}
            title={isNavCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            {isNavCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <div className="mb-5 flex items-center gap-2">
            <div className={`relative ${isNavCollapsed ? "w-full" : "min-w-0 flex-1"}`}>
              <button
                type="button"
                onClick={() => setIsBrokerMenuOpen((currentValue) => !currentValue)}
                data-testid="app-broker-selector"
                data-broker-id={selectedBrokerOption.id}
                className={`flex h-10 w-full items-center rounded-lg border border-slate-200 bg-[#fffdf7] font-bold text-[#071832] outline-none transition hover:bg-[#fff8e1] focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/30 ${
                  isNavCollapsed ? "justify-center px-1" : "justify-between gap-2 px-2"
                }`}
                aria-haspopup="listbox"
                aria-expanded={isBrokerMenuOpen}
                aria-label={`증권사 선택: ${selectedBrokerOption.name}`}
                title={`증권사: ${selectedBrokerOption.name}`}
              >
                <span className={`flex min-w-0 items-center ${isNavCollapsed ? "justify-center" : "gap-2"}`}>
                  <ProviderLogo logoUrl={selectedBrokerOption.logoUrl} mark={selectedBrokerOption.mark} name={selectedBrokerOption.name} size="sm" />
                  {!isNavCollapsed && <span className="truncate text-sm">{selectedBrokerOption.name}</span>}
                </span>
                {!isNavCollapsed && <ChevronDown className="h-4 w-4 flex-none text-slate-500" aria-hidden="true" />}
              </button>

              {isBrokerMenuOpen && (
                <div
                  className={`absolute top-full z-[80] mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-[#071832] shadow-xl ${
                    isNavCollapsed ? "left-0 w-64" : "left-0 right-0"
                  }`}
                  role="listbox"
                >
                  {BROKER_PROVIDER_OPTIONS.map((broker) => (
                    <button
                      key={broker.id}
                      type="button"
                      role="option"
                      data-testid="app-broker-option"
                      data-broker-id={broker.id}
                      aria-selected={broker.id === selectedBrokerOption.id}
                      onClick={() => handleBrokerChange(broker.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-[#fff8e1] focus-ring"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <ProviderLogo logoUrl={broker.logoUrl} mark={broker.mark} name={broker.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{broker.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{broker.description}</span>
                        </span>
                      </span>
                      {broker.id === selectedBrokerOption.id && <Check className="h-4 w-4 flex-none text-[#8a6400]" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <nav className="space-y-1" aria-label="주요 메뉴">
            {navScreens.map((key) => {
              const item = screenMeta[key];
              const Icon = iconMap[key];
              const isActive = pathname === item.href || (pathname === "/" && key === "dashboard");
              return (
                <Link
                  key={key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={isNavCollapsed ? item.label : undefined}
                  className={`relative flex items-center rounded-lg text-sm font-semibold transition focus-ring ${
                    isNavCollapsed ? "h-11 justify-center px-0" : "justify-between px-3 py-3"
                  } ${
                    isActive ? "bg-[#f6b100] text-[#071832]" : "text-slate-700 hover:bg-[#fff8e1]"
                  }`}
                >
                  <span className={`flex items-center ${isNavCollapsed ? "justify-center" : "gap-3"}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {!isNavCollapsed && item.label}
                  </span>
                  {key === "notifications" && !isNavCollapsed && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">3</span>
                  )}
                  {key === "notifications" && isNavCollapsed && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => toast.info("로그아웃 기능을 준비하고 있습니다.")}
            className={`absolute bottom-4 flex items-center rounded-lg py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#fff8e1] focus-ring ${
              isNavCollapsed ? "left-2 right-2 justify-center px-0" : "left-4 right-4 gap-3 px-3"
            }`}
            aria-label="로그아웃"
            title={isNavCollapsed ? "로그아웃" : undefined}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {!isNavCollapsed && "로그아웃"}
          </button>
          <div
            role="separator"
            aria-label="좌측 메뉴 크기 조절"
            aria-orientation="vertical"
            onPointerDown={startNavResize}
            className="absolute right-0 top-0 flex h-full w-2 cursor-col-resize touch-none items-center justify-center text-slate-300 transition hover:bg-[#fff8e1] hover:text-[#8a6400]"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </div>
        </aside>

        <main
          className={`min-w-0 flex-1 ${
            screen === "assets"
              ? `px-3 pb-24 lg:px-4 lg:pb-10 ${hasRecentBar ? "pt-0" : "pt-2 lg:pt-3"}`
              : `px-4 pb-28 lg:px-6 lg:pb-12 ${hasRecentBar ? "pt-0" : "pt-5 lg:pt-6"}`
          }`}
        >
          {hasRecentBar && (
            <div className="mb-4 pt-[5px]">
              <RecentViewedStocksBar
                items={recentItems}
                activeId={activeRecentStockId}
                onSelect={handleRecentStockSelect}
                onRemove={handleRecentStockRemove}
              />
            </div>
          )}

          {!brokerConnected && (
            <BrokerConnectionNotice broker={selectedBrokerOption} className={hasRecentBar ? "mb-4" : "mb-5 mt-2"} />
          )}

          {screen !== "assets" && (
            <section className="mb-5">
              <p className="text-xs font-extrabold text-[#8a6400]">AI 투자비서</p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-normal text-[#071832] lg:text-4xl">{meta.title}</h1>
              <p className="mt-2 text-sm font-medium text-slate-600 lg:text-base">{meta.subtitle}</p>
            </section>
          )}

          {children}

          <div className="mt-6">
            <RiskNotice compact />
          </div>
        </main>

        {isLlmPanelOpen ? (
          <LLMChatPanel
            messages={chatMessages}
            inputValue={chatInput}
            isLoading={isLoading}
            width={chatWidth}
            selectedProvider={selectedLlmProvider}
            selectedProviderOption={selectedLlmOption}
            selectedStock={activeWorkspaceStock}
            isProviderMenuOpen={isLlmMenuOpen}
            onAskSuggestion={handleSuggestedQuestion}
            onClose={() => setIsLlmPanelOpen(false)}
            onResizeStart={startChatResize}
            onProviderMenuToggle={() => setIsLlmMenuOpen((currentValue) => !currentValue)}
            onProviderChange={handleLlmProviderChange}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenSettings={() => router.push("/settings")}
            onInputChange={setChatInput}
            isUnlocked={isLlmUnlocked}
            onSubmit={handleChatSubmit}
          />
        ) : (
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-0 flex-none self-start xl:block">
            <button
              type="button"
              onClick={() => setIsLlmPanelOpen(true)}
              className="absolute right-3 top-5 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#071832] shadow-md transition hover:bg-[#fff8e1] focus-ring"
              aria-label="AI 문의 패널 펼치기"
              aria-expanded={false}
              title="AI 문의 패널 펼치기"
            >
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          </aside>
        )}
      </div>

      <div className="xl:hidden">
        <FloatingMicButton onClick={() => setIsVoiceOpen(true)} />
      </div>
      <MobileBottomNav onOpenVoice={() => setIsVoiceOpen(true)} />
      <VoiceInputModal
        open={isVoiceOpen}
        screen={screen}
        placeholder={meta.placeholder}
        isLoading={isLoading}
        onClose={() => setIsVoiceOpen(false)}
        onExecute={runAssistant}
      />
    </div>
  );
}

function createChatMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AppBootSkeleton() {
  return (
    <div className="min-h-screen bg-white text-[#071832]">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="hidden space-y-2 sm:block">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="ml-3 h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-9 flex-1 animate-pulse rounded-lg bg-slate-100" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="hidden h-[calc(100vh-4rem)] w-64 border-r border-slate-200 bg-white p-4 lg:block">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-11 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4">
          <div className="mb-4 flex gap-2 overflow-hidden">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-14 min-w-56 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
          <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
          <div className="mt-5 h-72 animate-pulse rounded-lg bg-slate-100" />
        </main>
        <aside className="hidden h-[calc(100vh-4rem)] w-80 border-l border-slate-200 bg-white p-4 xl:block">
          <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ProviderLogo({
  logoUrl,
  mark,
  name,
  accentClass = "bg-[#f8fafc] text-[#071832] border-slate-200",
  size = "md",
}: {
  logoUrl?: string;
  mark: string;
  name: string;
  accentClass?: string;
  size?: "sm" | "md";
}) {
  const frameSize = size === "sm" ? "h-7 w-7 rounded-md" : "h-10 w-10 rounded-lg";
  const logoSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <span className={`relative flex flex-none items-center justify-center border text-[10px] font-black ${frameSize} ${accentClass}`}>
      <span className="px-1 text-center leading-none" aria-hidden={Boolean(logoUrl)}>
        {mark}
      </span>
      {logoUrl ? (
        <span
          className={`absolute ${logoSize} rounded-sm bg-white bg-contain bg-center bg-no-repeat`}
          style={{ backgroundImage: `url(${logoUrl})` }}
          aria-label={name}
        />
      ) : null}
    </span>
  );
}

type PopularRankingItem = {
  id: string;
  rank: number;
  name: string;
  code: string;
  price: string;
  changeRate: string;
  tone: MarketTone;
};

const domesticPopularRankings: PopularRankingItem[] = [
  { id: "009150", rank: 1, name: "삼성전기", code: "009150", price: "151,800", changeRate: "+5.84%", tone: "up" },
  { id: "000660", rank: 2, name: "SK하이닉스", code: "000660", price: "193,500", changeRate: "+2.61%", tone: "up" },
  { id: "005930", rank: 3, name: "삼성전자", code: "005930", price: "66,200", changeRate: "-1.53%", tone: "down" },
  { id: "373220", rank: 4, name: "LG에너지솔루션", code: "373220", price: "362,500", changeRate: "+0.33%", tone: "up" },
  { id: "035420", rank: 5, name: "NAVER", code: "035420", price: "204,000", changeRate: "-0.48%", tone: "down" },
  { id: "005380", rank: 6, name: "현대차", code: "005380", price: "229,000", changeRate: "+1.11%", tone: "up" },
  { id: "035720", rank: 7, name: "카카오", code: "035720", price: "49,500", changeRate: "-0.92%", tone: "down" },
  { id: "066570", rank: 8, name: "LG전자", code: "066570", price: "98,400", changeRate: "+1.13%", tone: "up" },
  { id: "068270", rank: 9, name: "셀트리온", code: "068270", price: "183,900", changeRate: "+0.74%", tone: "up" },
  { id: "005490", rank: 10, name: "POSCO홀딩스", code: "005490", price: "402,000", changeRate: "-0.62%", tone: "down" },
];

const overseasPopularRankings: PopularRankingItem[] = [
  { id: "NVDA", rank: 1, name: "NVIDIA", code: "NVDA", price: "$125.20", changeRate: "+3.42%", tone: "up" },
  { id: "AAPL", rank: 2, name: "Apple", code: "AAPL", price: "$212.34", changeRate: "+0.88%", tone: "up" },
  { id: "MSFT", rank: 3, name: "Microsoft", code: "MSFT", price: "$468.90", changeRate: "-0.24%", tone: "down" },
  { id: "TSLA", rank: 4, name: "Tesla", code: "TSLA", price: "$178.50", changeRate: "-1.12%", tone: "down" },
  { id: "AMZN", rank: 5, name: "Amazon", code: "AMZN", price: "$184.44", changeRate: "+1.05%", tone: "up" },
  { id: "GOOGL", rank: 6, name: "Alphabet", code: "GOOGL", price: "$176.10", changeRate: "+0.41%", tone: "up" },
  { id: "META", rank: 7, name: "Meta", code: "META", price: "$501.20", changeRate: "-0.36%", tone: "down" },
  { id: "AVGO", rank: 8, name: "Broadcom", code: "AVGO", price: "$1,412.00", changeRate: "+2.16%", tone: "up" },
  { id: "AMD", rank: 9, name: "AMD", code: "AMD", price: "$164.72", changeRate: "+1.64%", tone: "up" },
  { id: "NFLX", rank: 10, name: "Netflix", code: "NFLX", price: "$662.10", changeRate: "-0.77%", tone: "down" },
];

function RealtimePopularPill({ onSelectStock }: { onSelectStock: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="group relative hidden h-10 flex-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm outline-none xl:flex"
      tabIndex={0}
      role="button"
      aria-expanded={isOpen}
      aria-label="실시간 인기 국내 해외 순위"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(true)}
      onFocus={() => setIsOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsOpen(false);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <Flame className="h-4 w-4 text-red-500" aria-hidden="true" />
      <span className="text-xs font-black text-[#071832]">실시간인기</span>
      <PopularTickerSection label="국내" item={domesticPopularRankings[0]} />
      <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
      <PopularTickerSection label="해외" item={overseasPopularRankings[0]} />

      <div className={`absolute left-0 top-full z-[90] pt-2 group-hover:block group-focus-within:block ${isOpen ? "block" : "hidden"}`}>
        <div className="w-[560px] rounded-lg border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-[#071832]">실시간 인기 종목 TOP 10</p>
            <span className="text-[11px] font-bold text-slate-500">샘플 지연 데이터</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PopularRankingPanel title="국내" items={domesticPopularRankings} onSelectStock={onSelectStock} />
            <PopularRankingPanel title="해외" items={overseasPopularRankings} onSelectStock={onSelectStock} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PopularTickerSection({ label, item }: { label: string; item: PopularRankingItem }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-md border border-slate-200 bg-[#f8fafc] px-2 py-1 text-[11px] font-extrabold text-slate-600">{label}</span>
      <PopularStockLogo item={item} />
      <span className="max-w-[104px] truncate text-xs font-black text-[#071832]">
        {item.rank}. {item.name}
      </span>
      <span className={`text-[11px] font-black tabular-nums ${marketToneClass(item.tone)}`}>{item.changeRate}</span>
    </span>
  );
}

function PopularRankingPanel({
  title,
  items,
  onSelectStock,
}: {
  title: string;
  items: PopularRankingItem[];
  onSelectStock: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-100 bg-[#f8fafc] p-2">
      <h3 className="px-1 pb-2 text-xs font-black text-[#071832]">{title}</h3>
      <ol className="space-y-1">
        {items.map((item) => (
          <li key={`${title}-${item.code}`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectStock(item.id);
              }}
              className="grid w-full grid-cols-[24px_28px_minmax(0,1fr)_72px] items-center gap-2 rounded-md bg-white px-2 py-1.5 text-left text-xs transition hover:bg-[#fff8e1] focus-ring"
              aria-label={`${item.name} 주문 화면 열기`}
              title={`${item.name} 주문 화면 열기`}
            >
              <span className="text-center font-black tabular-nums text-slate-500">{item.rank}</span>
              <PopularStockLogo item={item} />
              <span className="min-w-0">
                <span className="block truncate font-extrabold text-[#071832]">{item.name}</span>
                <span className="block truncate font-mono text-[10px] font-bold text-slate-500">{item.code} · {item.price}</span>
              </span>
              <span className={`text-right font-black tabular-nums ${marketToneClass(item.tone)}`}>{item.changeRate}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PopularStockLogo({ item }: { item: PopularRankingItem }) {
  const iconUrl = tradingWorkspaceByStockId[item.id]?.stock.iconUrl;

  return (
    <span className="relative flex h-6 w-6 flex-none items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white text-[10px] font-black text-[#071832]">
      <span aria-hidden={Boolean(iconUrl)}>{item.name.slice(0, 1)}</span>
      {iconUrl ? (
        <span
          className="absolute h-5 w-5 rounded-sm bg-white bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${iconUrl})` }}
          aria-label={item.name}
        />
      ) : null}
    </span>
  );
}

function LLMChatPanel({
  messages,
  inputValue,
  isLoading,
  width,
  selectedProvider,
  selectedProviderOption,
  selectedStock,
  isProviderMenuOpen,
  onAskSuggestion,
  onClose,
  onResizeStart,
  onProviderMenuToggle,
  onProviderChange,
  onOpenVoice,
  onOpenSettings,
  onInputChange,
  isUnlocked,
  onSubmit,
}: {
  messages: LLMChatMessage[];
  inputValue: string;
  isLoading: boolean;
  width: number;
  selectedProvider: LLMProvider;
  selectedProviderOption: ReturnType<typeof getLLMProviderOption>;
  selectedStock?: {
    name: string;
    code: string;
  };
  isProviderMenuOpen: boolean;
  onAskSuggestion: (question: string) => void;
  onClose: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onProviderMenuToggle: () => void;
  onProviderChange: (provider: LLMProvider) => void;
  onOpenVoice: () => void;
  onOpenSettings: () => void;
  onInputChange: (value: string) => void;
  isUnlocked: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const assistantTarget = selectedStock ? `${selectedStock.name}(${selectedStock.code})` : "투자 전략";
  const suggestionSubject = selectedStock?.name ?? "관심 종목";
  const suggestions = selectedStock
    ? [
        `${selectedStock.name}의 최근 실적은 어때?`,
        `${selectedStock.name}의 목표주가 전망은?`,
        `${selectedStock.name}의 주요 리스크는?`,
        `${selectedStock.name}의 차트 분석해줘`,
      ]
    : ["오늘 시장 브리핑 알려줘", "내 포트폴리오 리스크는?", "관심종목 중 볼 만한 종목은?", "단기 전략 후보를 추천해줘"];

  return (
    <aside
      className="sticky top-16 hidden h-[calc(100vh-4rem)] flex-none flex-col border-l border-slate-200 bg-white shadow-xl xl:flex"
      style={{ width }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute -left-4 top-5 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#071832] shadow-md transition hover:bg-[#fff8e1] focus-ring"
        aria-label="AI 문의 패널 접기"
        aria-expanded
        title="AI 문의 패널 접기"
      >
        <PanelRightClose className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        role="separator"
        aria-label="AI 문의 영역 크기 조절"
        aria-orientation="vertical"
        onPointerDown={onResizeStart}
        className="absolute left-0 top-0 flex h-full w-2 cursor-col-resize touch-none items-center justify-center text-slate-300 transition hover:bg-[#fff8e1] hover:text-[#8a6400]"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex h-14 flex-none items-center gap-2 border-b border-slate-200 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#071832] text-[#f6b100]">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-none">
          <h2 className="text-sm font-extrabold text-[#071832]">AI 문의</h2>
        </div>
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={onProviderMenuToggle}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-[#f8fafc] px-2 text-left outline-none transition hover:border-[#f3d58a] focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20"
            aria-haspopup="listbox"
            aria-expanded={isProviderMenuOpen}
            aria-label={`AI 선택: ${selectedProviderOption.name}`}
            title={`AI 선택: ${selectedProviderOption.name}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ProviderLogo
                logoUrl={selectedProviderOption.logoUrl}
                mark={selectedProviderOption.mark}
                name={selectedProviderOption.name}
                accentClass={selectedProviderOption.accentClass}
                size="sm"
              />
              <span className="truncate text-xs font-extrabold text-[#071832]">{selectedProviderOption.name}</span>
            </span>
            <ChevronDown className="h-4 w-4 flex-none text-slate-500" aria-hidden="true" />
          </button>

          {isProviderMenuOpen && (
            <div className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl" role="listbox">
              {LLM_PROVIDER_OPTIONS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  role="option"
                  aria-selected={provider.id === selectedProvider}
                  onClick={() => onProviderChange(provider.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition hover:bg-[#fff8e1] focus-ring"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <ProviderLogo logoUrl={provider.logoUrl} mark={provider.mark} name={provider.name} accentClass={provider.accentClass} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#071832]">{provider.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{provider.description}</span>
                    </span>
                  </span>
                  {provider.id === selectedProvider && <Check className="h-4 w-4 flex-none text-[#8a6400]" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {!isUnlocked ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white/95 p-5 text-center shadow-xl backdrop-blur-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#071832] text-[#f6b100] shadow-sm">
                <Settings className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-extrabold text-[#071832]">AI API Key를 연결하면 대화가 활성화됩니다.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                환경설정 화면에서 API Key를 입력하면 종목 질문, 추천 질문, 음성 입력을 바로 사용할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f6b100] px-4 text-sm font-extrabold text-[#071832] transition hover:bg-[#e0a000] focus-ring"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                환경설정으로 이동
              </button>
            </div>
          </div>
        ) : null}
        <div className={`flex min-h-0 flex-1 flex-col transition ${!isUnlocked ? "pointer-events-none select-none blur-[6px] opacity-40" : ""}`}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="rounded-lg border border-slate-200 bg-[#fffdf7] p-4 shadow-sm">
          <p className="text-sm font-extrabold text-[#071832]">안녕하세요! AI 투자비서입니다.</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">{assistantTarget}에 대해 무엇을 도와드릴까요?</p>
        </div>

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-5 ${
                message.role === "user"
                  ? "bg-[#071832] text-white"
                  : "border border-slate-200 bg-[#f8fafc] text-slate-700"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isLoading ? (
          <div className="flex justify-start">
            <div className="rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-slate-500">
              답변 작성 중...
            </div>
          </div>
        ) : null}

            <div className="space-y-2 pt-2">
          <p className="text-xs font-extrabold text-slate-500">{suggestionSubject} 추천 질문</p>
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onAskSuggestion(question)}
              disabled={isLoading || !isUnlocked}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left text-sm font-bold leading-5 text-[#071832] transition hover:border-[#f3d58a] hover:bg-[#fff8e1] disabled:cursor-not-allowed disabled:text-slate-400 focus-ring"
            >
              {question}
            </button>
          ))}
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-none flex-col gap-2 border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenVoice}
            disabled={!isUnlocked}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-[#071832] transition hover:border-[#f3d58a] hover:bg-[#fff8e1] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 focus-ring"
            aria-label="말하기"
            title="말하기"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#f6b100] focus:ring-2 focus:ring-[#f6b100]/20 disabled:cursor-not-allowed disabled:bg-slate-100"
            placeholder="AI에게 문의하기"
            disabled={isLoading || !isUnlocked}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading || !isUnlocked}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#f6b100] text-[#071832] transition hover:bg-[#e0a000] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 focus-ring"
            aria-label="문의 보내기"
            title="문의 보내기"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="px-1 text-xs leading-5 text-slate-500">
          AI는 참고 정보 제공 목적이며, 투자 결정에 대한 책임은 사용자에게 있습니다.
        </p>
          </form>
        </div>
      </div>
    </aside>
  );
}

function MarketTicker() {
  const disabledMarketBoard = null;
  void MarketBoard;

  return (
    <div className="market-ticker-shell relative min-w-0 flex-1" aria-label="시장 현황">
      <div className="market-ticker min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc] px-3 py-2">
        <div className="market-ticker-track flex w-max items-center">
          <MarketTickerGroup />
          <MarketTickerGroup ariaHidden />
          <MarketTickerGroup ariaHidden />
        </div>
      </div>
      {disabledMarketBoard}
    </div>
  );
}

function MarketTickerGroup({
  ariaHidden = false,
}: {
  ariaHidden?: boolean;
}) {
  return (
    <div className="market-ticker-group flex flex-none items-center gap-5 pr-5" aria-hidden={ariaHidden}>
      {marketOverview.map((item) => (
        <MarketTickerItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function MarketTickerItem({
  item,
}: {
  item: MarketOverviewItem;
}) {
  return (
    <div className="flex flex-none cursor-default items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <span className="text-slate-500">{item.label}</span>
      <span className="font-extrabold tabular-nums text-[#071832]">{item.primary}</span>
      <span className={`font-extrabold tabular-nums ${marketToneClass(item.tone)}`}>{item.change}</span>
      <span className="hidden tabular-nums text-slate-500 md:inline">{item.secondary}</span>
    </div>
  );
}

type MarketOverviewItem = (typeof marketOverview)[number];

type MarketBoardItem = MarketOverviewItem & {
  groupId?: string;
  category: MarketBoardCategory;
  region: MarketRegion;
};

type MarketSeriesPoint = {
  date: string;
  price: number;
};

type MarketBoardMeta = {
  subtitle: string;
  session: string;
  range: string;
  valuePrefix?: string;
  valueSuffix?: string;
  decimals: number;
  series: MarketSeriesPoint[];
  metrics?: { label: string; value: string }[];
};

type MarketBoardFilter = "all" | "stocks" | "bonds" | "fx" | "oil" | "futures" | "commodities";
type MarketBoardCategory = Exclude<MarketBoardFilter, "all">;
type MarketRegion = "domestic" | "overseas";
type MarketRegionFilter = "all" | MarketRegion;

type MarketBoardSeed = {
  id: string;
  category: MarketBoardCategory;
  region: MarketRegion;
  name: string;
  base: number;
  change: string;
  tone: MarketTone;
  decimals?: number;
  groupId?: string;
  label?: string;
  secondary?: string;
  subtitle?: string;
  valuePrefix?: string;
  valueSuffix?: string;
};

const marketBoardFilters: { id: MarketBoardFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "stocks", label: "증시 현황" },
  { id: "bonds", label: "채권 현황" },
  { id: "fx", label: "환율 현황" },
  { id: "oil", label: "유가 현황" },
  { id: "futures", label: "선물 현황" },
  { id: "commodities", label: "상품 현황" },
];

const marketBoardCategoryLabels: Record<MarketBoardCategory, string> = {
  stocks: "증시 현황",
  bonds: "채권 현황",
  fx: "환율 현황",
  oil: "유가 현황",
  futures: "선물 현황",
  commodities: "상품 현황",
};

const marketRegionLabels: Record<MarketRegion, string> = {
  domestic: "국내",
  overseas: "해외",
};

const MARKET_BOARD_FAVORITES_STORAGE_KEY = "ai-investment-assistant.marketBoardFavorites";
const DEFAULT_MARKET_BOARD_FAVORITE_IDS = ["kospi", "kosdaq", "sp500", "nasdaq", "usd-krw", "us-10y", "wti", "gold-spot"];

const marketBoardDates = ["2026-03-05", "2026-03-19", "2026-04-02", "2026-04-16", "2026-04-30", "2026-05-14", "2026-05-28", "2026-06-05"];

function makeMarketSeries(prices: number[]): MarketSeriesPoint[] {
  return marketBoardDates.map((date, index) => ({
    date,
    price: prices[index] ?? prices[prices.length - 1] ?? 0,
  }));
}

function formatMarketBoardValue(value: number, decimals = 0, valuePrefix = "", valueSuffix = "") {
  return `${valuePrefix}${value.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${valueSuffix}`;
}

function makeGeneratedSeries(base: number, tone: MarketTone, decimals = 0): MarketSeriesPoint[] {
  const shape =
    tone === "down"
      ? [1.035, 1.028, 1.018, 1.022, 1.012, 1.006, 1.002, 1]
      : tone === "neutral"
        ? [0.996, 1.002, 0.998, 1.001, 0.997, 1.003, 1.001, 1]
        : [0.958, 0.972, 0.986, 0.981, 0.996, 1.008, 1.012, 1];

  return marketBoardDates.map((date, index) => ({
    date,
    price: Number((base * shape[index]).toFixed(decimals)),
  }));
}

function createMarketBoardItem(seed: MarketBoardSeed): MarketBoardItem {
  const decimals = seed.decimals ?? 0;
  return {
    id: seed.id,
    groupId: seed.groupId,
    category: seed.category,
    region: seed.region,
    label: seed.label ?? `${marketRegionLabels[seed.region]} · ${marketBoardCategoryLabels[seed.category]}`,
    primary: `${seed.name} ${formatMarketBoardValue(seed.base, decimals, seed.valuePrefix, seed.valueSuffix)}`,
    change: seed.change,
    secondary: seed.secondary ?? "3개월",
    tone: seed.tone,
  };
}

const marketBoardSeeds: MarketBoardSeed[] = [
  { id: "kospi", category: "stocks", region: "domestic", name: "KOSPI", base: 2742.31, change: "+0.84%", tone: "up", groupId: "domestic-stock" },
  { id: "kosdaq", category: "stocks", region: "domestic", name: "KOSDAQ", base: 868.42, change: "+0.42%", tone: "up", groupId: "domestic-stock" },
  { id: "kospi200", category: "stocks", region: "domestic", name: "KOSPI200", base: 374.62, change: "+0.71%", tone: "up", groupId: "domestic-stock", decimals: 2 },
  { id: "kosdaq150", category: "stocks", region: "domestic", name: "KOSDAQ150", base: 1398.52, change: "+0.38%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-semiconductor", category: "stocks", region: "domestic", name: "반도체", base: 4120, change: "+1.46%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-battery", category: "stocks", region: "domestic", name: "2차전지", base: 2875, change: "-0.62%", tone: "down", groupId: "domestic-stock" },
  { id: "kr-bio", category: "stocks", region: "domestic", name: "바이오", base: 3264, change: "+0.22%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-finance", category: "stocks", region: "domestic", name: "금융", base: 1842, change: "+0.58%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-auto", category: "stocks", region: "domestic", name: "자동차", base: 2496, change: "-0.18%", tone: "down", groupId: "domestic-stock" },
  { id: "kr-shipbuilding", category: "stocks", region: "domestic", name: "조선", base: 3118, change: "+1.02%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-defense", category: "stocks", region: "domestic", name: "방산", base: 2210, change: "+0.86%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-internet", category: "stocks", region: "domestic", name: "인터넷", base: 1568, change: "-0.34%", tone: "down", groupId: "domestic-stock" },
  { id: "kr-game", category: "stocks", region: "domestic", name: "게임", base: 1206, change: "+0.19%", tone: "up", groupId: "domestic-stock" },
  { id: "kr-market-cap-leaders", category: "stocks", region: "domestic", name: "시총 상위", base: 101.4, change: "+0.64%", tone: "up", groupId: "domestic-stock", decimals: 1 },
  { id: "kr-trading-value", category: "stocks", region: "domestic", name: "거래대금", base: 12.8, change: "+0.9조", tone: "up", groupId: "domestic-stock", decimals: 1, valueSuffix: "조" },
  { id: "kr-volume", category: "stocks", region: "domestic", name: "거래량", base: 8.6, change: "+4.2%", tone: "up", groupId: "domestic-stock", decimals: 1, valueSuffix: "억주" },
  { id: "kr-advance-decline", category: "stocks", region: "domestic", name: "상승/하락", base: 1.18, change: "상승 우위", tone: "up", groupId: "domestic-stock", decimals: 2 },
  { id: "kr-individual-flow", category: "stocks", region: "domestic", name: "개인 수급", base: 4280, change: "+4,280억", tone: "up", groupId: "domestic-stock", valueSuffix: "억" },
  { id: "kr-foreign-flow", category: "stocks", region: "domestic", name: "외국인 수급", base: 3150, change: "+3,150억", tone: "up", groupId: "domestic-stock", valueSuffix: "억" },
  { id: "kr-institution-flow", category: "stocks", region: "domestic", name: "기관 수급", base: 1860, change: "-1,860억", tone: "down", groupId: "domestic-stock", valueSuffix: "억" },
  { id: "kr-pension-flow", category: "stocks", region: "domestic", name: "연기금 수급", base: 920, change: "+920억", tone: "up", groupId: "domestic-stock", valueSuffix: "억" },
  { id: "kr-program-trading", category: "stocks", region: "domestic", name: "프로그램 매매", base: 1460, change: "+1,460억", tone: "up", groupId: "domestic-stock", valueSuffix: "억" },
  { id: "kr-short-selling", category: "stocks", region: "domestic", name: "공매도", base: 6200, change: "-3.1%", tone: "down", groupId: "domestic-stock", valueSuffix: "억" },
  { id: "kr-margin-debt", category: "stocks", region: "domestic", name: "신용잔고", base: 19.2, change: "+0.3조", tone: "up", groupId: "domestic-stock", decimals: 1, valueSuffix: "조" },
  { id: "sp500", category: "stocks", region: "overseas", name: "S&P 500", base: 5312.2, change: "-0.18%", tone: "down", groupId: "global-stock" },
  { id: "nasdaq", category: "stocks", region: "overseas", name: "NASDAQ", base: 16742.39, change: "-0.05%", tone: "down", groupId: "global-stock" },
  { id: "dow", category: "stocks", region: "overseas", name: "DOW", base: 38940.65, change: "+0.11%", tone: "up", groupId: "global-stock" },
  { id: "russell2000", category: "stocks", region: "overseas", name: "Russell2000", base: 2084.74, change: "-0.32%", tone: "down", groupId: "global-stock" },
  { id: "us-semiconductor", category: "stocks", region: "overseas", name: "미국 반도체", base: 4920, change: "+0.74%", tone: "up", groupId: "global-stock" },
  { id: "us-ai", category: "stocks", region: "overseas", name: "AI", base: 138.6, change: "+1.26%", tone: "up", groupId: "global-stock", decimals: 1 },
  { id: "us-big-tech", category: "stocks", region: "overseas", name: "빅테크", base: 182.4, change: "+0.42%", tone: "up", groupId: "global-stock", decimals: 1 },
  { id: "us-financials", category: "stocks", region: "overseas", name: "미국 금융", base: 96.3, change: "-0.14%", tone: "down", groupId: "global-stock", decimals: 1 },
  { id: "us-healthcare", category: "stocks", region: "overseas", name: "헬스케어", base: 104.8, change: "+0.09%", tone: "up", groupId: "global-stock", decimals: 1 },
  { id: "us-energy", category: "stocks", region: "overseas", name: "에너지", base: 112.5, change: "+0.55%", tone: "up", groupId: "global-stock", decimals: 1 },
  { id: "vix", category: "stocks", region: "overseas", name: "VIX", base: 14.8, change: "-0.6p", tone: "down", groupId: "global-stock", decimals: 1 },
  { id: "euro-stoxx-50", category: "stocks", region: "overseas", name: "Euro Stoxx 50", base: 5032.8, change: "+0.21%", tone: "up", groupId: "global-stock" },
  { id: "dax", category: "stocks", region: "overseas", name: "DAX", base: 18634.2, change: "+0.28%", tone: "up", groupId: "global-stock" },
  { id: "cac40", category: "stocks", region: "overseas", name: "CAC40", base: 8012.4, change: "-0.12%", tone: "down", groupId: "global-stock" },
  { id: "ftse100", category: "stocks", region: "overseas", name: "FTSE100", base: 8271.5, change: "+0.16%", tone: "up", groupId: "global-stock" },
  { id: "nikkei225", category: "stocks", region: "overseas", name: "Nikkei225", base: 38684.3, change: "+0.37%", tone: "up", groupId: "global-stock" },
  { id: "topix", category: "stocks", region: "overseas", name: "TOPIX", base: 2738.9, change: "+0.24%", tone: "up", groupId: "global-stock" },
  { id: "shanghai-composite", category: "stocks", region: "overseas", name: "상해종합", base: 3108.6, change: "-0.20%", tone: "down", groupId: "global-stock" },
  { id: "csi300", category: "stocks", region: "overseas", name: "CSI300", base: 3618.2, change: "-0.31%", tone: "down", groupId: "global-stock" },
  { id: "hang-seng", category: "stocks", region: "overseas", name: "항셍", base: 18420.5, change: "+0.44%", tone: "up", groupId: "global-stock" },
  { id: "hang-seng-tech", category: "stocks", region: "overseas", name: "항셍테크", base: 3928.7, change: "+0.68%", tone: "up", groupId: "global-stock" },
  { id: "taiwan-weighted", category: "stocks", region: "overseas", name: "대만 가권", base: 21240.8, change: "+0.52%", tone: "up", groupId: "global-stock" },
  { id: "tsmc", category: "stocks", region: "overseas", name: "TSMC", base: 928, change: "+1.08%", tone: "up", groupId: "global-stock" },
  { id: "nifty50", category: "stocks", region: "overseas", name: "Nifty50", base: 23490.6, change: "+0.18%", tone: "up", groupId: "global-stock" },
  { id: "sensex", category: "stocks", region: "overseas", name: "Sensex", base: 77240.3, change: "+0.12%", tone: "up", groupId: "global-stock" },
  { id: "brazil-bovespa", category: "stocks", region: "overseas", name: "브라질", base: 126480, change: "-0.48%", tone: "down", groupId: "global-stock" },
  { id: "vietnam-vnindex", category: "stocks", region: "overseas", name: "베트남", base: 1284.2, change: "+0.31%", tone: "up", groupId: "global-stock" },
  { id: "indonesia-jci", category: "stocks", region: "overseas", name: "인도네시아", base: 7268.1, change: "+0.14%", tone: "up", groupId: "global-stock" },
  { id: "kr-bond-1y", category: "bonds", region: "domestic", name: "국고채 1년", base: 3.08, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-bond-2y", category: "bonds", region: "domestic", name: "국고채 2년", base: 3.15, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-3y", category: "bonds", region: "domestic", name: "국고채 3년", base: 3.21, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-bond-5y", category: "bonds", region: "domestic", name: "국고채 5년", base: 3.28, change: "-2bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-bond-10y", category: "bonds", region: "domestic", name: "국고채 10년", base: 3.42, change: "-2bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-bond-20y", category: "bonds", region: "domestic", name: "국고채 20년", base: 3.36, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-bond-30y", category: "bonds", region: "domestic", name: "국고채 30년", base: 3.31, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-msb", category: "bonds", region: "domestic", name: "통안채", base: 3.18, change: "보합", tone: "neutral", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-cd91", category: "bonds", region: "domestic", name: "CD 91일", base: 3.52, change: "보합", tone: "neutral", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-cp91", category: "bonds", region: "domestic", name: "CP 91일", base: 4.04, change: "+1bp", tone: "up", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-corp-aa", category: "bonds", region: "domestic", name: "회사채 AA-", base: 4.02, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-corp-bbb", category: "bonds", region: "domestic", name: "회사채 BBB-", base: 9.12, change: "+2bp", tone: "up", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-card-bond", category: "bonds", region: "domestic", name: "여전채", base: 4.38, change: "+1bp", tone: "up", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-bank-bond", category: "bonds", region: "domestic", name: "은행채", base: 3.92, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "kr-10y-3y-spread", category: "bonds", region: "domestic", name: "10년-3년", base: 21, change: "-1bp", tone: "down", groupId: "interest-rate", valueSuffix: "bp" },
  { id: "kr-credit-spread", category: "bonds", region: "domestic", name: "신용스프레드", base: 60, change: "+2bp", tone: "up", groupId: "interest-rate", valueSuffix: "bp" },
  { id: "us-treasury-2y", category: "bonds", region: "overseas", name: "미국채 2년", base: 4.74, change: "-3bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "us-treasury-5y", category: "bonds", region: "overseas", name: "미국채 5년", base: 4.44, change: "-2bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "us-10y", category: "bonds", region: "overseas", name: "미국채 10년", base: 4.32, change: "-2bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "us-treasury-30y", category: "bonds", region: "overseas", name: "미국채 30년", base: 4.47, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "us-10y-2y-spread", category: "bonds", region: "overseas", name: "미 10년-2년", base: -42, change: "+1bp", tone: "up", groupId: "interest-rate", valueSuffix: "bp" },
  { id: "us-tips", category: "bonds", region: "overseas", name: "TIPS", base: 2.02, change: "-2bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "us-bei", category: "bonds", region: "overseas", name: "기대인플레 BEI", base: 2.31, change: "+1bp", tone: "up", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "bund-10y", category: "bonds", region: "overseas", name: "독일 Bund 10년", base: 2.61, change: "-1bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "jgb-10y", category: "bonds", region: "overseas", name: "일본 JGB 10년", base: 0.98, change: "+1bp", tone: "up", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "gilt-10y", category: "bonds", region: "overseas", name: "영국 Gilt 10년", base: 4.13, change: "-2bp", tone: "down", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "china-10y", category: "bonds", region: "overseas", name: "중국 국채 10년", base: 2.29, change: "보합", tone: "neutral", groupId: "interest-rate", decimals: 2, valueSuffix: "%" },
  { id: "us-ig-credit", category: "bonds", region: "overseas", name: "미 투자등급", base: 92, change: "+1bp", tone: "up", groupId: "interest-rate", valueSuffix: "bp" },
  { id: "us-high-yield", category: "bonds", region: "overseas", name: "미 하이일드", base: 318, change: "+4bp", tone: "up", groupId: "interest-rate", valueSuffix: "bp" },
  { id: "em-bond-spread", category: "bonds", region: "overseas", name: "신흥국 스프레드", base: 362, change: "+3bp", tone: "up", groupId: "interest-rate", valueSuffix: "bp" },
  { id: "usd-krw", category: "fx", region: "domestic", name: "USD/KRW", base: 1372.4, change: "+3.20원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "jpy-krw", category: "fx", region: "domestic", name: "JPY/KRW", base: 9.42, change: "-0.03원", tone: "down", groupId: "fx", decimals: 2 },
  { id: "eur-krw", category: "fx", region: "domestic", name: "EUR/KRW", base: 1486.1, change: "+1.80원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "cny-krw", category: "fx", region: "domestic", name: "CNY/KRW", base: 189.4, change: "+0.2원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "gbp-krw", category: "fx", region: "domestic", name: "GBP/KRW", base: 1748.6, change: "-1.1원", tone: "down", groupId: "fx", decimals: 1 },
  { id: "aud-krw", category: "fx", region: "domestic", name: "AUD/KRW", base: 906.2, change: "+0.7원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "ndf-usd-krw", category: "fx", region: "domestic", name: "NDF USD/KRW", base: 1375.2, change: "+2.8원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "fx-reserve", category: "fx", region: "domestic", name: "외환보유액", base: 421.8, change: "+1.2억달러", tone: "up", groupId: "fx", decimals: 1, valueSuffix: "B$" },
  { id: "dxy", category: "fx", region: "overseas", name: "DXY", base: 104.2, change: "+0.18%", tone: "up", groupId: "fx", decimals: 1 },
  { id: "eur-usd", category: "fx", region: "overseas", name: "EUR/USD", base: 1.084, change: "-0.12%", tone: "down", groupId: "fx", decimals: 3 },
  { id: "usd-jpy", category: "fx", region: "overseas", name: "USD/JPY", base: 145.7, change: "+0.24%", tone: "up", groupId: "fx", decimals: 1 },
  { id: "usd-cnh", category: "fx", region: "overseas", name: "USD/CNH", base: 7.23, change: "+0.08%", tone: "up", groupId: "fx", decimals: 2 },
  { id: "usd-cny", category: "fx", region: "overseas", name: "USD/CNY", base: 7.19, change: "+0.05%", tone: "up", groupId: "fx", decimals: 2 },
  { id: "gbp-usd", category: "fx", region: "overseas", name: "GBP/USD", base: 1.276, change: "-0.10%", tone: "down", groupId: "fx", decimals: 3 },
  { id: "aud-usd", category: "fx", region: "overseas", name: "AUD/USD", base: 0.661, change: "+0.09%", tone: "up", groupId: "fx", decimals: 3 },
  { id: "usd-chf", category: "fx", region: "overseas", name: "USD/CHF", base: 0.892, change: "+0.04%", tone: "up", groupId: "fx", decimals: 3 },
  { id: "mxn", category: "fx", region: "overseas", name: "멕시코 페소", base: 17.2, change: "-0.22%", tone: "down", groupId: "fx", decimals: 1 },
  { id: "brl", category: "fx", region: "overseas", name: "브라질 헤알", base: 5.18, change: "+0.16%", tone: "up", groupId: "fx", decimals: 2 },
  { id: "inr", category: "fx", region: "overseas", name: "인도 루피", base: 83.4, change: "보합", tone: "neutral", groupId: "fx", decimals: 1 },
  { id: "idr", category: "fx", region: "overseas", name: "인도네시아 루피아", base: 16240, change: "+0.11%", tone: "up", groupId: "fx" },
  { id: "kr-gasoline", category: "oil", region: "domestic", name: "국내 휘발유", base: 1688, change: "+6원", tone: "up", groupId: "oil", valueSuffix: "원" },
  { id: "kr-diesel", category: "oil", region: "domestic", name: "국내 경유", base: 1518, change: "+4원", tone: "up", groupId: "oil", valueSuffix: "원" },
  { id: "kr-lpg", category: "oil", region: "domestic", name: "LPG", base: 1018, change: "보합", tone: "neutral", groupId: "oil", valueSuffix: "원" },
  { id: "kr-dubai-import", category: "oil", region: "domestic", name: "두바이유 수입", base: 81.2, change: "+0.7%", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "kr-refining-margin", category: "oil", region: "domestic", name: "정제마진", base: 6.8, change: "+0.4달러", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "kr-sk-innovation", category: "oil", region: "domestic", name: "SK이노베이션", base: 122400, change: "+0.65%", tone: "up", groupId: "oil", valueSuffix: "원" },
  { id: "kr-s-oil", category: "oil", region: "domestic", name: "S-Oil", base: 72400, change: "+0.44%", tone: "up", groupId: "oil", valueSuffix: "원" },
  { id: "kr-gs", category: "oil", region: "domestic", name: "GS", base: 46800, change: "-0.21%", tone: "down", groupId: "oil", valueSuffix: "원" },
  { id: "wti", category: "oil", region: "overseas", name: "WTI", base: 78.24, change: "+1.12%", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "brent", category: "oil", region: "overseas", name: "Brent", base: 82.05, change: "+0.88%", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "dubai", category: "oil", region: "overseas", name: "Dubai", base: 81.4, change: "+0.64%", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "henry-hub", category: "oil", region: "overseas", name: "천연가스 Henry Hub", base: 2.71, change: "-0.08달러", tone: "down", groupId: "oil", decimals: 2, valuePrefix: "$" },
  { id: "rbob", category: "oil", region: "overseas", name: "RBOB", base: 2.47, change: "+0.7%", tone: "up", groupId: "oil", decimals: 2, valuePrefix: "$" },
  { id: "heating-oil", category: "oil", region: "overseas", name: "Heating Oil", base: 2.51, change: "+0.4%", tone: "up", groupId: "oil", decimals: 2, valuePrefix: "$" },
  { id: "us-crude-inventory", category: "oil", region: "overseas", name: "미 원유 재고", base: 432.6, change: "-180만배럴", tone: "down", groupId: "oil", decimals: 1, valueSuffix: "M" },
  { id: "opec-policy", category: "oil", region: "overseas", name: "OPEC+ 정책", base: 64, change: "감산 유지", tone: "neutral", groupId: "oil" },
  { id: "us-shale-output", category: "oil", region: "overseas", name: "미 셰일 생산", base: 13.2, change: "+0.1mb/d", tone: "up", groupId: "oil", decimals: 1, valueSuffix: "mb/d" },
  { id: "geo-risk", category: "oil", region: "overseas", name: "지정학 리스크", base: 58, change: "주의", tone: "up", groupId: "oil" },
  { id: "kospi200-futures", category: "futures", region: "domestic", name: "KOSPI200 선물", base: 376.8, change: "+0.66%", tone: "up", groupId: "domestic-stock", decimals: 2 },
  { id: "kosdaq150-futures", category: "futures", region: "domestic", name: "KOSDAQ150 선물", base: 1402.5, change: "+0.34%", tone: "up", groupId: "domestic-stock", decimals: 1 },
  { id: "mini-kospi200-futures", category: "futures", region: "domestic", name: "미니 KOSPI200", base: 376.7, change: "+0.63%", tone: "up", groupId: "domestic-stock", decimals: 2 },
  { id: "single-stock-futures", category: "futures", region: "domestic", name: "개별주식 선물", base: 101.6, change: "+0.41%", tone: "up", groupId: "domestic-stock", decimals: 1 },
  { id: "kr-3y-bond-futures", category: "futures", region: "domestic", name: "3년 국채선물", base: 104.62, change: "+4틱", tone: "up", groupId: "interest-rate", decimals: 2 },
  { id: "kr-10y-bond-futures", category: "futures", region: "domestic", name: "10년 국채선물", base: 112.84, change: "+7틱", tone: "up", groupId: "interest-rate", decimals: 2 },
  { id: "kr-usd-futures", category: "futures", region: "domestic", name: "미국달러선물", base: 1373.2, change: "+2.9원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "kr-yen-futures", category: "futures", region: "domestic", name: "엔선물", base: 9.43, change: "-0.02원", tone: "down", groupId: "fx", decimals: 2 },
  { id: "kr-euro-futures", category: "futures", region: "domestic", name: "유로선물", base: 1487.4, change: "+1.4원", tone: "up", groupId: "fx", decimals: 1 },
  { id: "kr-gold-futures", category: "futures", region: "domestic", name: "금선물", base: 104800, change: "+0.32%", tone: "up", groupId: "gold", valueSuffix: "원" },
  { id: "sp500-futures", category: "futures", region: "overseas", name: "S&P500 선물", base: 5320.5, change: "-0.12%", tone: "down", groupId: "global-stock", decimals: 1 },
  { id: "nasdaq100-futures", category: "futures", region: "overseas", name: "Nasdaq100 선물", base: 18640.2, change: "-0.08%", tone: "down", groupId: "global-stock", decimals: 1 },
  { id: "dow-futures", category: "futures", region: "overseas", name: "Dow 선물", base: 38984, change: "+0.05%", tone: "up", groupId: "global-stock" },
  { id: "russell-futures", category: "futures", region: "overseas", name: "Russell2000 선물", base: 2088.6, change: "-0.18%", tone: "down", groupId: "global-stock", decimals: 1 },
  { id: "nikkei-futures", category: "futures", region: "overseas", name: "Nikkei225 선물", base: 38720, change: "+0.22%", tone: "up", groupId: "global-stock" },
  { id: "hang-seng-futures", category: "futures", region: "overseas", name: "Hang Seng 선물", base: 18488, change: "+0.39%", tone: "up", groupId: "global-stock" },
  { id: "euro-stoxx-futures", category: "futures", region: "overseas", name: "Euro Stoxx 50 선물", base: 5040, change: "+0.18%", tone: "up", groupId: "global-stock" },
  { id: "us-10y-futures", category: "futures", region: "overseas", name: "미국채 10년 선물", base: 109.22, change: "+5틱", tone: "up", groupId: "interest-rate", decimals: 2 },
  { id: "wti-futures", category: "futures", region: "overseas", name: "WTI 선물", base: 78.3, change: "+1.05%", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "brent-futures", category: "futures", region: "overseas", name: "Brent 선물", base: 82.1, change: "+0.82%", tone: "up", groupId: "oil", decimals: 1, valuePrefix: "$" },
  { id: "gold-futures", category: "futures", region: "overseas", name: "금 선물", base: 2362.4, change: "+0.34%", tone: "up", groupId: "gold", decimals: 1, valuePrefix: "$" },
  { id: "silver-futures", category: "futures", region: "overseas", name: "은 선물", base: 30.18, change: "+0.22%", tone: "up", groupId: "gold", decimals: 2, valuePrefix: "$" },
  { id: "copper-futures", category: "futures", region: "overseas", name: "구리 선물", base: 4.52, change: "-0.31%", tone: "down", groupId: "commodities", decimals: 2, valuePrefix: "$" },
  { id: "corn-futures", category: "futures", region: "overseas", name: "옥수수 선물", base: 468, change: "+0.12%", tone: "up", groupId: "commodities" },
  { id: "wheat-futures", category: "futures", region: "overseas", name: "밀 선물", base: 612, change: "-0.28%", tone: "down", groupId: "commodities" },
  { id: "soybean-futures", category: "futures", region: "overseas", name: "대두 선물", base: 1184, change: "+0.16%", tone: "up", groupId: "commodities" },
  { id: "dxy-futures", category: "futures", region: "overseas", name: "달러인덱스 선물", base: 104.3, change: "+0.15%", tone: "up", groupId: "fx", decimals: 1 },
  { id: "bitcoin-futures", category: "futures", region: "overseas", name: "비트코인 선물", base: 67280, change: "+1.34%", tone: "up", valuePrefix: "$" },
  { id: "ethereum-futures", category: "futures", region: "overseas", name: "이더리움 선물", base: 3520, change: "+0.92%", tone: "up", valuePrefix: "$" },
  { id: "krx-gold-spot", category: "commodities", region: "domestic", name: "KRX 금 현물", base: 104200, change: "+0.36%", tone: "up", groupId: "gold", valueSuffix: "원/g" },
  { id: "kr-gold-price", category: "commodities", region: "domestic", name: "국내 금", base: 104200, change: "+0.34%", tone: "up", groupId: "gold", valueSuffix: "원/g" },
  { id: "kr-silver-price", category: "commodities", region: "domestic", name: "국내 은", base: 1340, change: "+0.18%", tone: "up", groupId: "gold", valueSuffix: "원/g" },
  { id: "kau", category: "commodities", region: "domestic", name: "탄소배출권 KAU", base: 9100, change: "-0.44%", tone: "down", groupId: "commodities", valueSuffix: "원" },
  { id: "smp", category: "commodities", region: "domestic", name: "전력도매가격 SMP", base: 142.6, change: "+1.8%", tone: "up", groupId: "commodities", decimals: 1, valueSuffix: "원/kWh" },
  { id: "steel-price", category: "commodities", region: "domestic", name: "철강 가격", base: 96.4, change: "-0.3%", tone: "down", groupId: "commodities", decimals: 1 },
  { id: "ship-plate", category: "commodities", region: "domestic", name: "조선 후판", base: 112.8, change: "+0.2%", tone: "up", groupId: "commodities", decimals: 1 },
  { id: "dram", category: "commodities", region: "domestic", name: "DRAM", base: 2.48, change: "+0.04달러", tone: "up", groupId: "commodities", decimals: 2, valuePrefix: "$" },
  { id: "nand", category: "commodities", region: "domestic", name: "NAND", base: 4.12, change: "+0.03달러", tone: "up", groupId: "commodities", decimals: 2, valuePrefix: "$" },
  { id: "gold-spot", category: "commodities", region: "overseas", name: "금", base: 2356.8, change: "+0.36%", tone: "up", groupId: "gold", decimals: 1, valuePrefix: "$" },
  { id: "silver", category: "commodities", region: "overseas", name: "은", base: 30.12, change: "+0.24%", tone: "up", groupId: "gold", decimals: 2, valuePrefix: "$" },
  { id: "platinum", category: "commodities", region: "overseas", name: "백금", base: 1018, change: "+0.12%", tone: "up", groupId: "gold", valuePrefix: "$" },
  { id: "palladium", category: "commodities", region: "overseas", name: "팔라듐", base: 968, change: "-0.42%", tone: "down", groupId: "gold", valuePrefix: "$" },
  { id: "copper", category: "commodities", region: "overseas", name: "구리", base: 9840, change: "-0.44%", tone: "down", groupId: "commodities", valuePrefix: "$" },
  { id: "aluminum", category: "commodities", region: "overseas", name: "알루미늄", base: 2645, change: "-0.18%", tone: "down", groupId: "commodities", valuePrefix: "$" },
  { id: "nickel", category: "commodities", region: "overseas", name: "니켈", base: 18340, change: "+0.31%", tone: "up", groupId: "commodities", valuePrefix: "$" },
  { id: "zinc", category: "commodities", region: "overseas", name: "아연", base: 2984, change: "+0.14%", tone: "up", groupId: "commodities", valuePrefix: "$" },
  { id: "iron-ore", category: "commodities", region: "overseas", name: "철광석", base: 116.8, change: "-0.22%", tone: "down", groupId: "commodities", decimals: 1, valuePrefix: "$" },
  { id: "uranium", category: "commodities", region: "overseas", name: "우라늄", base: 91.4, change: "+0.58%", tone: "up", groupId: "commodities", decimals: 1, valuePrefix: "$" },
  { id: "corn", category: "commodities", region: "overseas", name: "옥수수", base: 468, change: "+0.12%", tone: "up", groupId: "commodities" },
  { id: "wheat", category: "commodities", region: "overseas", name: "밀", base: 612, change: "-0.28%", tone: "down", groupId: "commodities" },
  { id: "soybean", category: "commodities", region: "overseas", name: "대두", base: 1184, change: "+0.16%", tone: "up", groupId: "commodities" },
  { id: "coffee", category: "commodities", region: "overseas", name: "커피", base: 224, change: "+0.72%", tone: "up", groupId: "commodities" },
  { id: "sugar", category: "commodities", region: "overseas", name: "설탕", base: 19.8, change: "-0.31%", tone: "down", groupId: "commodities", decimals: 1 },
  { id: "cocoa", category: "commodities", region: "overseas", name: "코코아", base: 8240, change: "+1.84%", tone: "up", groupId: "commodities", valuePrefix: "$" },
  { id: "cotton", category: "commodities", region: "overseas", name: "면화", base: 82.6, change: "+0.18%", tone: "up", groupId: "commodities", decimals: 1 },
  { id: "live-cattle", category: "commodities", region: "overseas", name: "생우", base: 184.2, change: "+0.09%", tone: "up", groupId: "commodities", decimals: 1 },
  { id: "lean-hogs", category: "commodities", region: "overseas", name: "돈육", base: 92.1, change: "-0.16%", tone: "down", groupId: "commodities", decimals: 1 },
  { id: "lithium", category: "commodities", region: "overseas", name: "리튬", base: 104800, change: "-0.52%", tone: "down", groupId: "commodities", valuePrefix: "$" },
  { id: "rare-earth", category: "commodities", region: "overseas", name: "희토류", base: 126.4, change: "+0.21%", tone: "up", groupId: "commodities", decimals: 1 },
  { id: "bitcoin", category: "commodities", region: "overseas", name: "비트코인", base: 67280, change: "+1.34%", tone: "up", valuePrefix: "$" },
  { id: "ethereum", category: "commodities", region: "overseas", name: "이더리움", base: 3520, change: "+0.92%", tone: "up", valuePrefix: "$" },
  { id: "stablecoin-cap", category: "commodities", region: "overseas", name: "스테이블코인 시총", base: 162.8, change: "+0.4B", tone: "up", decimals: 1, valueSuffix: "B$" },
];

const generatedMarketBoardMeta: Record<string, MarketBoardMeta> = Object.fromEntries(
  marketBoardSeeds.map((seed) => [
    seed.id,
    {
      subtitle: seed.subtitle ?? `${seed.name} 3개월 흐름`,
      session: seed.secondary ?? marketBoardCategoryLabels[seed.category],
      range: "3개월",
      valuePrefix: seed.valuePrefix,
      valueSuffix: seed.valueSuffix,
      decimals: seed.decimals ?? 0,
      series: makeGeneratedSeries(seed.base, seed.tone, seed.decimals ?? 0),
    },
  ])
);

const marketBoardItems: MarketBoardItem[] = marketBoardSeeds.map(createMarketBoardItem);

const marketBoardMeta: Record<string, MarketBoardMeta> = {
  kospi: {
    subtitle: "KOSPI 3개월 흐름",
    session: "국내 증시",
    range: "3개월",
    decimals: 0,
    series: makeMarketSeries([2624, 2658, 2682, 2671, 2706, 2714, 2732, 2742.31]),
  },
  kosdaq: {
    subtitle: "KOSDAQ 3개월 흐름",
    session: "국내 증시",
    range: "3개월",
    decimals: 0,
    series: makeMarketSeries([834, 842, 850, 846, 858, 862, 865, 868.42]),
  },
  sp500: {
    subtitle: "S&P 500 3개월 흐름",
    session: "전일 종가",
    range: "3개월",
    decimals: 0,
    series: makeMarketSeries([5168, 5224, 5286, 5242, 5361, 5338, 5321, 5312.2]),
  },
  nasdaq: {
    subtitle: "NASDAQ 3개월 흐름",
    session: "전일 종가",
    range: "3개월",
    decimals: 0,
    series: makeMarketSeries([16110, 16284, 16460, 16380, 16810, 16766, 16750, 16742.39]),
  },
  dow: {
    subtitle: "DOW 3개월 흐름",
    session: "전일 종가",
    range: "3개월",
    decimals: 0,
    series: makeMarketSeries([38680, 38942, 39126, 38874, 39220, 39042, 38898, 38940.65]),
  },
  "usd-krw": {
    subtitle: "달러/원 3개월 흐름",
    session: "서울 외환",
    range: "3개월",
    decimals: 1,
    series: makeMarketSeries([1348.2, 1356.7, 1361.3, 1352.4, 1368.8, 1376.1, 1369.5, 1372.4]),
  },
  "jpy-krw": {
    subtitle: "엔/원 3개월 흐름",
    session: "서울 외환",
    range: "3개월",
    decimals: 2,
    series: makeMarketSeries([9.12, 9.18, 9.24, 9.21, 9.35, 9.44, 9.45, 9.42]),
  },
  "eur-krw": {
    subtitle: "유로/원 3개월 흐름",
    session: "서울 외환",
    range: "3개월",
    decimals: 1,
    series: makeMarketSeries([1458.4, 1466.2, 1474.6, 1468.1, 1482.8, 1491.4, 1484.3, 1486.1]),
  },
  "us-10y": {
    subtitle: "미국 10년물 금리",
    session: "채권 시장",
    range: "3개월",
    valueSuffix: "%",
    decimals: 2,
    series: makeMarketSeries([4.61, 4.55, 4.49, 4.43, 4.4, 4.35, 4.33, 4.32]),
  },
  "kr-3y": {
    subtitle: "국고채 3년물 금리",
    session: "채권 시장",
    range: "3개월",
    valueSuffix: "%",
    decimals: 2,
    series: makeMarketSeries([3.38, 3.34, 3.31, 3.28, 3.26, 3.24, 3.22, 3.21]),
  },
  wti: {
    subtitle: "WTI 3개월 흐름",
    session: "NYMEX",
    range: "3개월",
    valuePrefix: "$",
    decimals: 1,
    series: makeMarketSeries([71.8, 73.6, 75.2, 72.9, 76.4, 79.2, 77.6, 78.24]),
  },
  brent: {
    subtitle: "Brent 3개월 흐름",
    session: "ICE",
    range: "3개월",
    valuePrefix: "$",
    decimals: 1,
    series: makeMarketSeries([75.1, 76.8, 78.4, 76.2, 79.6, 83.1, 81.4, 82.05]),
  },
  "gold-spot": {
    subtitle: "Gold 3개월 흐름",
    session: "COMEX",
    range: "3개월",
    valuePrefix: "$",
    decimals: 0,
    series: makeMarketSeries([2218, 2246, 2298, 2281, 2320, 2342, 2359, 2356.8]),
  },
  silver: {
    subtitle: "Silver 3개월 흐름",
    session: "COMEX",
    range: "3개월",
    valuePrefix: "$",
    decimals: 2,
    series: makeMarketSeries([27.8, 28.2, 28.9, 28.6, 29.4, 30.1, 30.04, 30.12]),
  },
  copper: {
    subtitle: "구리 3개월 흐름",
    session: "원자재",
    range: "3개월",
    valuePrefix: "$",
    decimals: 0,
    series: makeMarketSeries([9560, 9730, 9898, 10040, 9952, 9864, 9906, 9840]),
  },
  aluminum: {
    subtitle: "알루미늄 3개월 흐름",
    session: "원자재",
    range: "3개월",
    valuePrefix: "$",
    decimals: 0,
    series: makeMarketSeries([2540, 2586, 2624, 2662, 2648, 2636, 2650, 2645]),
  },
  "domestic-stock": {
    subtitle: "KOSPI 중심 국내 증시 흐름",
    session: "국내 증시",
    range: "3개월",
    decimals: 0,
    series: [
      { date: "2026-03-05", price: 2624 },
      { date: "2026-03-19", price: 2658 },
      { date: "2026-04-02", price: 2682 },
      { date: "2026-04-16", price: 2671 },
      { date: "2026-04-30", price: 2706 },
      { date: "2026-05-14", price: 2714 },
      { date: "2026-05-28", price: 2732 },
      { date: "2026-06-05", price: 2742.31 },
    ],
    metrics: [
      { label: "KOSPI", value: "2,742.31" },
      { label: "KOSDAQ", value: "+0.42%" },
      { label: "거래대금", value: "12.8조" },
    ],
  },
  "global-stock": {
    subtitle: "미국 주요 지수와 기술주 흐름",
    session: "전일 종가",
    range: "3개월",
    decimals: 0,
    series: [
      { date: "2026-03-05", price: 5168 },
      { date: "2026-03-19", price: 5224 },
      { date: "2026-04-02", price: 5286 },
      { date: "2026-04-16", price: 5242 },
      { date: "2026-04-30", price: 5361 },
      { date: "2026-05-14", price: 5338 },
      { date: "2026-05-28", price: 5321 },
      { date: "2026-06-05", price: 5312.2 },
    ],
    metrics: [
      { label: "S&P 500", value: "5,312.20" },
      { label: "NASDAQ", value: "-0.05%" },
      { label: "DOW", value: "+0.11%" },
    ],
  },
  fx: {
    subtitle: "원화 환율과 주요 통화 움직임",
    session: "서울 외환",
    range: "3개월",
    decimals: 1,
    series: [
      { date: "2026-03-05", price: 1348.2 },
      { date: "2026-03-19", price: 1356.7 },
      { date: "2026-04-02", price: 1361.3 },
      { date: "2026-04-16", price: 1352.4 },
      { date: "2026-04-30", price: 1368.8 },
      { date: "2026-05-14", price: 1376.1 },
      { date: "2026-05-28", price: 1369.5 },
      { date: "2026-06-05", price: 1372.4 },
    ],
    metrics: [
      { label: "USD/KRW", value: "1,372.40" },
      { label: "JPY/KRW", value: "9.42" },
      { label: "EUR/KRW", value: "1,486.10" },
    ],
  },
  "interest-rate": {
    subtitle: "국채 금리와 채권 시장 온도",
    session: "채권 시장",
    range: "3개월",
    valueSuffix: "%",
    decimals: 2,
    series: [
      { date: "2026-03-05", price: 4.61 },
      { date: "2026-03-19", price: 4.55 },
      { date: "2026-04-02", price: 4.49 },
      { date: "2026-04-16", price: 4.43 },
      { date: "2026-04-30", price: 4.4 },
      { date: "2026-05-14", price: 4.35 },
      { date: "2026-05-28", price: 4.33 },
      { date: "2026-06-05", price: 4.32 },
    ],
    metrics: [
      { label: "미 10년", value: "4.32%" },
      { label: "국고 3년", value: "3.21%" },
      { label: "스프레드", value: "111bp" },
    ],
  },
  oil: {
    subtitle: "에너지 가격과 인플레이션 압력",
    session: "NYMEX",
    range: "3개월",
    valuePrefix: "$",
    decimals: 1,
    series: [
      { date: "2026-03-05", price: 71.8 },
      { date: "2026-03-19", price: 73.6 },
      { date: "2026-04-02", price: 75.2 },
      { date: "2026-04-16", price: 72.9 },
      { date: "2026-04-30", price: 76.4 },
      { date: "2026-05-14", price: 79.2 },
      { date: "2026-05-28", price: 77.6 },
      { date: "2026-06-05", price: 78.24 },
    ],
    metrics: [
      { label: "WTI", value: "$78.24" },
      { label: "Brent", value: "$82.05" },
      { label: "천연가스", value: "$2.71" },
    ],
  },
  gold: {
    subtitle: "안전자산과 귀금속 수요",
    session: "COMEX",
    range: "3개월",
    valuePrefix: "$",
    decimals: 0,
    series: [
      { date: "2026-03-05", price: 2218 },
      { date: "2026-03-19", price: 2246 },
      { date: "2026-04-02", price: 2298 },
      { date: "2026-04-16", price: 2281 },
      { date: "2026-04-30", price: 2320 },
      { date: "2026-05-14", price: 2342 },
      { date: "2026-05-28", price: 2359 },
      { date: "2026-06-05", price: 2356.8 },
    ],
    metrics: [
      { label: "Gold", value: "$2,356.80" },
      { label: "Silver", value: "$30.12" },
      { label: "국내 금", value: "104,200원/g" },
    ],
  },
  commodities: {
    subtitle: "산업금속과 농산물 흐름",
    session: "원자재",
    range: "3개월",
    valuePrefix: "$",
    decimals: 0,
    series: [
      { date: "2026-03-05", price: 9560 },
      { date: "2026-03-19", price: 9730 },
      { date: "2026-04-02", price: 9898 },
      { date: "2026-04-16", price: 10040 },
      { date: "2026-04-30", price: 9952 },
      { date: "2026-05-14", price: 9864 },
      { date: "2026-05-28", price: 9906 },
      { date: "2026-06-05", price: 9840 },
    ],
    metrics: [
      { label: "구리", value: "$9,840" },
      { label: "알루미늄", value: "$2,645" },
      { label: "곡물", value: "혼조" },
    ],
  },
};

function MarketBoard({
  activeId,
  onActiveChange,
  onPanelEnter,
  onPanelLeave,
  onClose,
}: {
  activeId: string;
  onActiveChange: (id: string) => void;
  onPanelEnter: () => void;
  onPanelLeave: () => void;
  onClose: () => void;
}) {
  const [selectedFilter, setSelectedFilter] = useState<MarketBoardFilter>("all");
  const [selectedRegion, setSelectedRegion] = useState<MarketRegionFilter>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(DEFAULT_MARKET_BOARD_FAVORITE_IDS);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const categoryFilteredItems =
    selectedFilter === "all" ? marketBoardItems : marketBoardItems.filter((item) => item.category === selectedFilter);
  const regionFilteredItems =
    selectedRegion === "all" ? categoryFilteredItems : categoryFilteredItems.filter((item) => item.region === selectedRegion);
  const favoriteItems = marketBoardItems.filter((item) => favoriteIds.includes(item.id));
  const filteredItems = showFavoritesOnly
    ? favoriteItems
    : regionFilteredItems;
  const regionCounts = (["domestic", "overseas"] as const).map((region) => ({
    region,
    count: categoryFilteredItems.filter((item) => item.region === region).length,
  }));
  const regionSections = (["domestic", "overseas"] as const)
    .map((region) => ({
      region,
      items: filteredItems.filter((item) => item.region === region),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(MARKET_BOARD_FAVORITES_STORAGE_KEY);
      const itemIds = new Set(marketBoardItems.map((item) => item.id));
      if (!rawValue) {
        setFavoriteIds(DEFAULT_MARKET_BOARD_FAVORITE_IDS);
        return;
      }
      const parsedValue = JSON.parse(rawValue);
      if (Array.isArray(parsedValue)) {
        setFavoriteIds(parsedValue.filter((id): id is string => typeof id === "string" && itemIds.has(id)));
      } else {
        setFavoriteIds(DEFAULT_MARKET_BOARD_FAVORITE_IDS);
      }
    } catch {
      setFavoriteIds(DEFAULT_MARKET_BOARD_FAVORITE_IDS);
    } finally {
      setFavoritesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesReady) return;
    window.localStorage.setItem(MARKET_BOARD_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds, favoritesReady]);

  const handleFavoriteToggle = useCallback((id: string) => {
    setFavoriteIds((currentIds) =>
      currentIds.includes(id) ? currentIds.filter((currentId) => currentId !== id) : [id, ...currentIds]
    );
  }, []);

  return (
    <div
      className="market-board-panel fixed left-0 right-0 top-16 z-[60] h-[calc(100vh-4rem)] overflow-y-auto border-b border-[#efd488] bg-white shadow-2xl"
      onMouseEnter={onPanelEnter}
      onMouseLeave={onPanelLeave}
      onFocus={onPanelEnter}
      onBlur={onPanelLeave}
    >
      <div className="mx-auto w-full max-w-[1520px] px-4 py-5 lg:px-6">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold tracking-normal text-[#071832]">시장현황</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-[#f3d58a] hover:bg-[#fffdf7] hover:text-[#071832] focus-ring"
              aria-label="시장현황 닫기"
              title="시장현황 닫기"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="시장현황 필터">
            {marketBoardFilters.map((filter) => {
              const isSelected = filter.id === selectedFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition focus-ring ${
                    isSelected
                      ? "border-[#f6b100] bg-[#f6b100] text-[#071832]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-[#f3d58a] hover:bg-[#fffdf7]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {filter.label}
                </button>
              );
            })}
            {regionCounts.map((section) => {
              const isSelected = section.region === selectedRegion;
              return (
                <button
                  key={section.region}
                  type="button"
                  onClick={() => setSelectedRegion(isSelected ? "all" : section.region)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition focus-ring ${
                    isSelected
                      ? "border-[#071832] bg-[#071832] text-white"
                      : "border-slate-200 bg-[#f8fafc] text-slate-600 hover:border-[#f3d58a] hover:bg-[#fffdf7]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {marketRegionLabels[section.region]} {section.count}개
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowFavoritesOnly((currentValue) => !currentValue)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition focus-ring ${
                showFavoritesOnly
                  ? "border-[#f6b100] bg-[#fff8e1] text-[#8a6400]"
                  : "border-slate-200 bg-[#f8fafc] text-slate-600 hover:border-[#f3d58a] hover:bg-[#fffdf7]"
              }`}
              aria-pressed={showFavoritesOnly}
            >
              <Star className="h-3.5 w-3.5" fill={showFavoritesOnly ? "currentColor" : "none"} aria-hidden="true" />
              관심 지수 {favoriteItems.length}개
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {regionSections.map((section) => (
            <MarketBoardSection
              key={section.region}
              title={marketRegionLabels[section.region]}
              items={section.items}
              activeId={activeId}
              favoriteIds={favoriteIds}
              onActiveChange={onActiveChange}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketBoardSection({
  title,
  items,
  activeId,
  favoriteIds,
  onActiveChange,
  onFavoriteToggle,
}: {
  title: string;
  items: MarketBoardItem[];
  activeId: string;
  favoriteIds: string[];
  onActiveChange: (id: string) => void;
  onFavoriteToggle: (id: string) => void;
}) {
  return (
    <section aria-label={`${title} 시장현황`}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-extrabold text-[#071832]">{title}</h3>
        <span className="rounded-full bg-[#f8fafc] px-2 py-0.5 text-[11px] font-bold text-slate-500">{items.length}개</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <MarketBoardCard
            key={item.id}
            item={item}
            activeId={activeId}
            isFavorite={favoriteIds.includes(item.id)}
            onActiveChange={onActiveChange}
            onFavoriteToggle={onFavoriteToggle}
          />
        ))}
      </div>
    </section>
  );
}

function MarketBoardCard({
  item,
  activeId,
  isFavorite,
  onActiveChange,
  onFavoriteToggle,
}: {
  item: MarketBoardItem;
  activeId: string;
  isFavorite: boolean;
  onActiveChange: (id: string) => void;
  onFavoriteToggle: (id: string) => void;
}) {
  const isActive = item.id === activeId || item.groupId === activeId;
  const meta = getMarketBoardMeta(item.id);

  return (
    <article
      onMouseEnter={() => onActiveChange(item.id)}
      className={`rounded-lg border bg-white p-3 text-left shadow-sm transition ${
        isActive ? "border-[#f3d58a] bg-[#fffdf7]" : "border-slate-200 hover:border-[#f3d58a]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{item.label}</p>
          <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-base font-extrabold text-[#071832]">{item.primary}</p>
            <span className={`flex-none text-sm font-extrabold tabular-nums ${marketToneClass(item.tone)}`}>
              {item.change}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{meta.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => onFavoriteToggle(item.id)}
          onFocus={() => onActiveChange(item.id)}
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border transition focus-ring ${
            isFavorite
              ? "border-[#f6b100] bg-[#fff8e1] text-[#8a6400]"
              : "border-slate-200 bg-white text-slate-400 hover:border-[#f3d58a] hover:text-[#8a6400]"
          }`}
          aria-label={`${item.primary} 관심 지수 ${isFavorite ? "해제" : "추가"}`}
          aria-pressed={isFavorite}
          title={isFavorite ? "관심 지수 해제" : "관심 지수 추가"}
        >
          <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>
      <MarketAxisChart item={item} meta={meta} />
    </article>
  );
}

function MarketAxisChart({ item, meta }: { item: MarketBoardItem; meta: MarketBoardMeta }) {
  const chart = buildAxisChart(meta.series);
  const stroke = chartColor(item.tone);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredPoint = hoveredIndex === null ? null : chart.coords[hoveredIndex];
  const hoveredSeriesPoint = hoveredIndex === null ? null : meta.series[hoveredIndex];

  return (
    <svg className="mt-3 h-32 w-full overflow-visible" viewBox="0 0 360 176" role="img" aria-label={`${item.label} 3개월 가격 차트`}>
      <defs>
        <linearGradient id={`market-gradient-${item.id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1={chart.plot.right} x2={chart.plot.right} y1={chart.plot.top} y2={chart.plot.bottom} stroke="#cbd5e1" />
      <line x1={chart.plot.left} x2={chart.plot.right} y1={chart.plot.bottom} y2={chart.plot.bottom} stroke="#cbd5e1" />
      {chart.yTicks.map((tick) => (
        <g key={`${tick.value}-${tick.y}`}>
          <line x1={chart.plot.left} x2={chart.plot.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeDasharray="4 6" />
          <line x1={chart.plot.right} x2={chart.plot.right + 5} y1={tick.y} y2={tick.y} stroke="#94a3b8" />
          <text x={chart.plot.labelX} y={tick.y + 4} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="end">
            {formatAxisValue(tick.value, meta)}
          </text>
        </g>
      ))}
      {chart.xTicks.map((tick) => (
        <text key={tick.x} x={tick.x} y={chart.plot.bottom + 22} fill="#64748b" fontSize="10" fontWeight="700" textAnchor="middle">
          {formatDateLabel(tick.date)}
        </text>
      ))}
      <path d={chart.areaPath} fill={`url(#market-gradient-${item.id})`} />
      <path d={chart.linePath} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {chart.coords.map((point, index) => {
        const seriesPoint = meta.series[index];
        const isHovered = hoveredIndex === index;

        return (
          <g key={`${point.x}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r={isHovered ? 5 : index === chart.coords.length - 1 ? 4 : 2.5}
              fill="white"
              stroke={stroke}
              strokeWidth={isHovered ? 2.6 : 2}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="11"
              fill="transparent"
              pointerEvents="all"
              data-market-point={`${item.id}-${index}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <title>{`${formatDateLabel(seriesPoint.date)} ${formatAxisValue(seriesPoint.price, meta)}`}</title>
            </circle>
          </g>
        );
      })}
      {hoveredPoint && hoveredSeriesPoint ? (
        <MarketChartTooltip itemId={item.id} point={hoveredPoint} data={hoveredSeriesPoint} meta={meta} />
      ) : null}
    </svg>
  );
}

function MarketChartTooltip({
  itemId,
  point,
  data,
  meta,
}: {
  itemId: string;
  point: { x: number; y: number };
  data: MarketSeriesPoint;
  meta: MarketBoardMeta;
}) {
  const width = 118;
  const height = 42;
  const x = Math.min(Math.max(point.x - width / 2, 4), 360 - width - 4);
  const shouldPlaceBelow = point.y < height + 40;
  const y = shouldPlaceBelow ? Math.min(point.y + 12, 176 - height - 4) : Math.max(point.y - height - 10, 4);

  return (
    <g data-market-tooltip={itemId} pointerEvents="none">
      <rect x={x} y={y} width={width} height={height} rx="7" fill="#071832" opacity="0.95" />
      <text x={x + 10} y={y + 17} fill="#cbd5e1" fontSize="10" fontWeight="800">
        {formatDateLabel(data.date)}
      </text>
      <text x={x + 10} y={y + 33} fill="#ffffff" fontSize="12" fontWeight="900">
        {formatAxisValue(data.price, meta)}
      </text>
    </g>
  );
}

function getMarketBoardMeta(id: string) {
  return marketBoardMeta[id] ?? generatedMarketBoardMeta[id] ?? marketBoardMeta.kospi;
}

function buildAxisChart(series: MarketSeriesPoint[]) {
  const plot = { left: 18, right: 292, labelX: 356, top: 18, bottom: 132 };
  const prices = series.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = max - min || 1;
  const step = series.length > 1 ? (plot.right - plot.left) / (series.length - 1) : 0;
  const coords = series.map((point, index) => {
    const x = plot.left + index * step;
    const y = plot.bottom - ((point.price - min) / spread) * (plot.bottom - plot.top);
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });
  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const first = coords[0] ?? { x: plot.left, y: plot.bottom };
  const last = coords[coords.length - 1] ?? first;
  const areaPath = `${linePath} L ${last.x} ${plot.bottom} L ${first.x} ${plot.bottom} Z`;
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, index) => max - (spread * index) / (yTickCount - 1)).map((value) => ({
    value,
    y: Number((plot.bottom - ((value - min) / spread) * (plot.bottom - plot.top)).toFixed(2)),
  }));
  const xTickIndexes = [0, Math.floor((series.length - 1) / 2), series.length - 1];
  const xTicks = xTickIndexes.map((index) => ({
    date: series[index]?.date ?? "",
    x: coords[index]?.x ?? plot.left,
  }));

  return { coords, linePath, areaPath, plot, yTicks, xTicks };
}

function formatAxisValue(value: number, meta: MarketBoardMeta) {
  const formatted = value.toLocaleString("ko-KR", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });

  return `${meta.valuePrefix ?? ""}${formatted}${meta.valueSuffix ?? ""}`;
}

function formatDateLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function chartColor(tone: MarketTone) {
  if (tone === "up") return "#ef4444";
  if (tone === "down") return "#3b82f6";
  return "#64748b";
}

function marketToneClass(tone: MarketTone) {
  if (tone === "up") {
    return "text-profit";
  }
  if (tone === "down") {
    return "text-loss";
  }
  return "text-neutral";
}

function MobileBottomNav({ onOpenVoice }: { onOpenVoice: () => void }) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "대시", icon: LayoutDashboard },
    { href: "/watchlist", label: "관심", icon: Heart },
    { href: "/my-strategy", label: "전략", icon: ShieldCheck },
    { href: "/assets", label: "자산", icon: Home },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 pb-3 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden" aria-label="모바일 하단 메뉴">
      <div className="grid grid-cols-5 items-end gap-1">
        {items.slice(0, 2).map((item) => (
          <MobileNavLink key={item.href} {...item} active={pathname === item.href} />
        ))}
        <button
          type="button"
          onClick={onOpenVoice}
          className="mx-auto flex h-16 w-16 -translate-y-4 items-center justify-center rounded-full border-4 border-white bg-[#f6b100] text-[#071832] shadow-lg focus-ring"
          aria-label="음성 입력"
          title="음성 입력"
        >
          <Mic className="h-7 w-7" aria-hidden="true" />
        </button>
        {items.slice(2).map((item) => (
          <MobileNavLink key={item.href} {...item} active={pathname === item.href} />
        ))}
      </div>
    </nav>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1 text-[11px] font-bold focus-ring ${
        active ? "text-[#071832]" : "text-slate-500"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </Link>
  );
}

export default AppShell;
