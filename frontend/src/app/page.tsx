"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_ENTRY_PATH, LAST_SCREEN_STORAGE_KEY, sanitizeLastScreenPath } from "@/lib/navigationPersistence";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const storedPath = sanitizeLastScreenPath(window.localStorage.getItem(LAST_SCREEN_STORAGE_KEY));
    router.replace(storedPath ?? DEFAULT_ENTRY_PATH);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-sm font-bold text-slate-500">
      화면을 불러오는 중입니다.
    </main>
  );
}
