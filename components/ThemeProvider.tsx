"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { saveThemeAction } from "@/app/actions";
import type { ThemeId } from "@/lib/types";

const META_COLORS: Record<ThemeId, string> = { dark: "#0f172a", light: "#ffffff", pitch: "#051c14", night: "#000000" };

type Ctx = { theme: ThemeId; setTheme: (t: ThemeId) => void };
const ThemeCtx = createContext<Ctx>({ theme: "dark", setTheme: () => {} });

export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ initial, children }: { initial: ThemeId; children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(initial);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    document.cookie = `sp_theme=${t}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META_COLORS[t]);
    void saveThemeAction(t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
