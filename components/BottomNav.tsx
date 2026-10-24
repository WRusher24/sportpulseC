"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; label: string; match: (p: string) => boolean; icon: ReactNode };

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const ITEMS: Item[] = [
  { href: "/", label: "חדשות", match: (p) => p === "/" || p.startsWith("/story"), icon: svg(<><path d="M4 5h13a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V5Z" /><path d="M19 9h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1" /><path d="M8 9h7M8 13h7M8 16h4" /></>) },
  { href: "/match-center", label: "משחקים וטבלאות", match: (p) => p.startsWith("/match-center"), icon: svg(<><circle cx="12" cy="12" r="9" /><path d="m12 8 3.5 2.5-1.3 4h-4.4l-1.3-4L12 8Z" /><path d="M12 3v5M20 9.5l-4.5 1M17.5 19l-3.3-4.5M6.5 19l3.3-4.5M4 9.5l4.5 1" /></>) },
  { href: "/analyst", label: "האנליסט", match: (p) => p.startsWith("/analyst"), icon: svg(<><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 4-5 3 3 5-7" /><circle cx="19" cy="6" r="1" /></>) },
  { href: "/my-club", label: "הקבוצה שלי", match: (p) => p.startsWith("/my-club"), icon: svg(<><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m12 8 1.6 3.2 3.4.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4L7 11.700l3.400-.5L12 8Z" /></>) },
  { href: "/settings", label: "הגדרות", match: (p) => p.startsWith("/settings") || p.startsWith("/account"), icon: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.100a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1Z" /></>) }
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const active = Math.max(0, ITEMS.findIndex((i) => i.match(pathname)));
  return (
    <nav aria-label="ניווט ראשי" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="relative mx-auto grid max-w-3xl grid-cols-5">
        <span aria-hidden className="pointer-events-none absolute top-0 h-0.5 w-1/5 bg-accent transition-all duration-300 ease-out" style={{ insetInlineStart: `${active * 20}%` }} />
        {ITEMS.map((item, i) => {
          const on = i === active;
          return (
            <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 pt-1 text-center text-[11px] leading-tight transition-colors duration-200 ${on ? "text-accent" : "text-muted hover:text-fg"}`}>
              <span className={`transition-transform duration-200 ${on ? "-translate-y-0.5 scale-110" : ""}`}>{item.icon}</span>
              <span className={on ? "font-bold" : ""}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
