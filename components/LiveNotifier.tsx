"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/client/api";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/types";
import type { TickerItem } from "@/lib/sports/types";

export const GUEST_PREFS_KEY = "sp_notif_v1";
export const GUEST_TEAM_COOKIE = "sp_team";

function readGuestPrefs(): NotificationPrefs {
  try {
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(JSON.parse(localStorage.getItem(GUEST_PREFS_KEY) ?? "{}") as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function readTeamCookie(): string | null {
  return document.cookie.split("; ").find((c) => c.startsWith(`${GUEST_TEAM_COOKIE}=`))?.split("=")[1] ?? null;
}

/**
 * Browser notifications for the favourite team (goals, kick-off, final whistle). Opt-in: nothing runs until the user grants
 * permission from Settings. Polls the live feed every 30 seconds while the page is open.
 */
export function LiveNotifier({ prefs, favoriteTeamId }: { prefs: NotificationPrefs | null; favoriteTeamId: string | null }) {
  const last = useRef(new Map<string, { h: number | null; a: number | null; status: string }>());

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const effective = prefs ?? readGuestPrefs();
    const team = favoriteTeamId ?? readTeamCookie();
    if (!team) return;

    const notify = (title: string, body: string) => {
      try {
        new Notification(title, { body, dir: "rtl", lang: "he", icon: "/icon.svg", tag: `${title}-${body}` });
      } catch {
        /* some mobile browsers only allow notifications through a service worker */
      }
    };

    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await apiFetch("/api/live");
        if (!res.ok) return;
        const { items } = (await res.json()) as { items: TickerItem[] };
        for (const m of items) {
          if (m.homeTeamId !== team && m.awayTeamId !== team) continue;
          const key = m.matchId ?? `${m.homeNameHe}-${m.awayNameHe}`;
          const prev = last.current.get(key);
          const score = `${m.homeNameHe} ${m.homeScore ?? 0}:${m.awayScore ?? 0} ${m.awayNameHe}`;
          if (!prev && effective.kickoff) notify("המשחק התחיל", score);
          if (prev && effective.goals && ((m.homeScore ?? 0) > (prev.h ?? 0) || (m.awayScore ?? 0) > (prev.a ?? 0))) notify("שער!", score);
          if (prev && effective.finalWhistle && prev.status !== "finished" && m.status === "finished") notify("שריקת סיום", score);
          last.current.set(key, { h: m.homeScore, a: m.awayScore, status: m.status });
        }
      } catch {
        /* ignore transient network errors */
      }
    };
    const id = setInterval(poll, 30_000);
    void poll();
    return () => clearInterval(id);
  }, [prefs, favoriteTeamId]);

  return null;
}
