import Link from "next/link";
import { APP_NAME_HE } from "@/lib/he";
import type { SessionUser } from "@/lib/types";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/50 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-8 4 16 3-8h6" /></svg>
          </span>
          <span className="text-lg">{APP_NAME_HE}</span>
        </Link>
        <Link href="/account" className="btn-ghost !min-h-[36px] !px-3 text-xs" aria-label={user ? `החשבון של ${user.displayName}` : "התחברות או הרשמה"}>
          {user ? user.displayName : "התחברות"}
        </Link>
      </div>
    </header>
  );
}
