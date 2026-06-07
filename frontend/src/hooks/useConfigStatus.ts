"use client";

import { useCallback, useEffect, useState } from "react";
import { getConfigStatus } from "@/lib/api/config";
import { DEFAULT_CONFIG_STATUS } from "@/lib/configStatus";
import type { ConfigStatus } from "@/types/config";

export const CONFIG_STATUS_UPDATED_EVENT = "ai-investment-assistant:config-status-updated";

let cachedConfigStatus: ConfigStatus | null = null;
let pendingConfigStatus: Promise<ConfigStatus> | null = null;

export function setSharedConfigStatus(status: ConfigStatus) {
  cachedConfigStatus = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ConfigStatus>(CONFIG_STATUS_UPDATED_EVENT, { detail: status }));
  }
}

async function loadSharedConfigStatus() {
  if (pendingConfigStatus) {
    return pendingConfigStatus;
  }

  pendingConfigStatus = getConfigStatus()
    .then((status) => {
      setSharedConfigStatus(status);
      return status;
    })
    .finally(() => {
      pendingConfigStatus = null;
    });

  return pendingConfigStatus;
}

export function useConfigStatus() {
  const [status, setStatus] = useState<ConfigStatus>(cachedConfigStatus ?? DEFAULT_CONFIG_STATUS);
  const [isLoading, setIsLoading] = useState(!cachedConfigStatus);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextStatus = await loadSharedConfigStatus();
      setStatus(nextStatus);
      setError(null);
      return nextStatus;
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "설정 상태를 불러오지 못했습니다.";
      setStatus(cachedConfigStatus ?? DEFAULT_CONFIG_STATUS);
      setError(message);
      return cachedConfigStatus ?? DEFAULT_CONFIG_STATUS;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(!cachedConfigStatus);

    const handleConfigStatusUpdated = (event: Event) => {
      const nextStatus = (event as CustomEvent<ConfigStatus>).detail;
      if (!nextStatus) return;
      setStatus(nextStatus);
      setError(null);
      setIsLoading(false);
    };

    window.addEventListener(CONFIG_STATUS_UPDATED_EVENT, handleConfigStatusUpdated);

    loadSharedConfigStatus()
      .then((nextStatus) => {
        if (!mounted) return;
        setStatus(nextStatus);
        setError(null);
      })
      .catch((caughtError) => {
        if (!mounted) return;
        const message = caughtError instanceof Error ? caughtError.message : "설정 상태를 불러오지 못했습니다.";
        setStatus(cachedConfigStatus ?? DEFAULT_CONFIG_STATUS);
        setError(message);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
      window.removeEventListener(CONFIG_STATUS_UPDATED_EVENT, handleConfigStatusUpdated);
    };
  }, []);

  return { status, isLoading, error, refresh };
}
