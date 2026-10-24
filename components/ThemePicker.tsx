"use client";

import { THEME_LABEL } from "@/lib/he";
import type { ThemeId } from "@/lib/types";
import { useTheme } from "./ThemeProvider";

const SWATCH: Record<ThemeId, { bg: string; surface: string; accent: string; fg: string }> = {
  dark: { bg: "#0f172a", surface: "#1e293b", accent: "#22c55e", fg: "#ffffff" },
  light: { bg: "#ffffff", surface: "#f1f5f9", accent: "#1d4ed8", fg: "#1e293b" },
  pitch: { bg: "#051c14", surface: "#092c20", accent: "#22d3ee", fg: "#ecfdf5" },
  night: { bg: "#000000", surface: "#111111", accent: "#f97316", fg: "#ffffff" }
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="ערכת נושא" className="grid grid-cols-2 gap-3">
      {(Object.keys(SWATCH) as ThemeId[]).map((id) => {
        const s = SWATCH[id];
        const on = theme === id;
        return (
          <button key={id} role="radio" aria-checked={on} onClick={() => setTheme(id)} className={`rounded-2xl border-2 p-2 text-start transition ${on ? "border-accent" : "border-line/60 hover:border-accent/60"}`}>
            <span className="block overflow-hidden rounded-xl p-2" style={{ background: s.bg }} aria-hidden>
              <span className="block rounded-lg p-2" style={{ background: s.surface }}>
                <span className="block h-2 w-2/3 rounded-full" style={{ background: s.fg, opacity: 0.9 }} />
                <span className="mt-1.5 block h-2 w-1/2 rounded-full" style={{ background: s.fg, opacity: 0.45 }} />
                <span className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ background: s.accent, color: id === "light" ? "#fff" : "#000" }}>LIVE</span>
              </span>
            </span>
            <span className="mt-2 flex items-center justify-between px-1">
              <span className="text-sm font-bold">{THEME_LABEL[id].name}</span>
              {on && <span className="text-xs font-bold text-accent">פעיל ✓</span>}
            </span>
            <span className="block px-1 pb-1 text-[11px] leading-4 text-muted">{THEME_LABEL[id].hint}</span>
          </button>
        );
      })}
    </div>
  );
}
