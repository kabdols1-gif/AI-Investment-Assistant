import { navScreens, screenMeta, type NavScreenKey } from "@/lib/mockData";

export const LAST_SCREEN_STORAGE_KEY = "ai-investment-assistant.last-screen.v1";
export const NAV_ORDER_STORAGE_KEY = "ai-investment-assistant.nav-order.v1";
export const DEFAULT_ENTRY_PATH = "/watchlist";
export const PINNED_NAV_SCREEN: NavScreenKey = "dashboard";

const navScreenSet = new Set<NavScreenKey>(navScreens);
const movableNavScreens = navScreens.filter((item) => item !== PINNED_NAV_SCREEN);
const allowedEntryPaths = new Set(Object.values(screenMeta).map((item) => item.href));

export function normalizeNavOrder(value: unknown): NavScreenKey[] {
  const storedKeys = Array.isArray(value)
    ? value.filter((item): item is NavScreenKey => typeof item === "string" && navScreenSet.has(item as NavScreenKey))
    : [];
  const uniqueStoredKeys = storedKeys.filter(
    (item, index) => item !== PINNED_NAV_SCREEN && storedKeys.indexOf(item) === index
  );
  const missingKeys = movableNavScreens.filter((item) => !uniqueStoredKeys.includes(item));

  return [PINNED_NAV_SCREEN, ...uniqueStoredKeys, ...missingKeys];
}

export function getStoredNavOrder(): NavScreenKey[] {
  if (typeof window === "undefined") return normalizeNavOrder(navScreens);

  try {
    const rawValue = window.localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    return normalizeNavOrder(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return normalizeNavOrder(navScreens);
  }
}

export function saveNavOrder(order: NavScreenKey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(normalizeNavOrder(order)));
}

export function sanitizeLastScreenPath(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value, "http://aia.local");
    if (!allowedEntryPaths.has(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
