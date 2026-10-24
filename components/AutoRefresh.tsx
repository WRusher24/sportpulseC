"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-runs the server component (fresh scores/events) every `seconds` while the tab is visible. */
export function AutoRefresh({ seconds = 30, enabled }: { seconds?: number; enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [enabled, seconds, router]);
  return null;
}
