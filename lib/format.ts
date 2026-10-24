/**
 * Number & date formatting. Every number is rendered with Western digits (0-9) -
 * the `-u-nu-latn` Unicode extension guarantees that regardless of the user's OS locale.
 */
const TZ = "Asia/Jerusalem";

const dateFmt = new Intl.DateTimeFormat("he-IL-u-nu-latn", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const shortDateFmt = new Intl.DateTimeFormat("he-IL-u-nu-latn", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("he-IL-u-nu-latn", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat("he-IL-u-nu-latn", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false });

export const fmtDate = (d: Date | string) => dateFmt.format(new Date(d));
export const fmtShortDate = (d: Date | string) => shortDateFmt.format(new Date(d));
export const fmtTime = (d: Date | string) => timeFmt.format(new Date(d));
export const fmtDateTime = (d: Date | string) => dateTimeFmt.format(new Date(d));

/** Israel-local calendar day key, e.g. "2026-10-24". */
export const israelDayKey = (d: Date | string = new Date()) => dayKeyFmt.format(new Date(d));
/** Israel-local hour of day (0-23). */
export const israelHour = (d: Date = new Date()) => Number(hourFmt.format(d)) % 24;

/** Western-digit number formatting with optional fixed decimals. */
export function fmtNum(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }).format(n);
}

export const fmtPct = (n: number, digits = 0) => `${fmtNum(n, digits)}%`;

export function fmtRelative(d: Date | string, now = new Date()): string {
  const diff = Math.round((now.getTime() - new Date(d).getTime()) / 60000);
  if (diff < 1) return "הרגע";
  if (diff < 60) return `לפני ${fmtNum(diff)} דקות`;
  const h = Math.round(diff / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${fmtNum(h)} שעות`;
  const days = Math.round(h / 24);
  return days === 1 ? "אתמול" : `לפני ${fmtNum(days)} ימים`;
}

/** Converts any Arabic-Indic / Eastern Arabic-Indic digits found in free text to Western digits. */
export function toWesternDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}
