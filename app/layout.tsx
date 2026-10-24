import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { KeysProvider } from "@/components/KeysProvider";
import { LiveNotifier } from "@/components/LiveNotifier";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSessionUser } from "@/lib/server/session";
import type { ThemeId } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ספורט פאלס – חדשות ספורט, משחקים חיים ואנליסט AI", template: "%s | ספורט פאלס" },
  description: "SportPulse Israel – אגרגטור חדשות ספורט ישראלי, מרכז משחקים חי, טבלאות ואנליסט בינה מלאכותית בעברית.",
  applicationName: "ספורט פאלס",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a"
};

const THEMES: ThemeId[] = ["dark", "light", "pitch", "night"];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const cookieTheme = (await cookies()).get("sp_theme")?.value as ThemeId | undefined;
  const theme: ThemeId = cookieTheme && THEMES.includes(cookieTheme) ? cookieTheme : (user?.themePreference ?? "dark");
  return (
    <html lang="he" dir="rtl" data-theme={theme} suppressHydrationWarning>
      <body dir="rtl" className="min-h-dvh">
        <ThemeProvider initial={theme}>
          <KeysProvider>
            <Header user={user} />
            <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-4">{children}</main>
            <BottomNav />
            <LiveNotifier prefs={user?.notificationPrefs ?? null} favoriteTeamId={user?.favoriteTeamId ?? null} />
          </KeysProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
