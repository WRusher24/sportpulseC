// Browser audit (manual): node scripts/audit-ui.mjs [baseUrl]
// Checks, for every page x theme on a 390px phone viewport: dir="rtl", no horizontal overflow, Western digits only,
// and WCAG AA contrast for the theme's text/accent token pairs.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // not a project dependency: install playwright globally to run this audit

const base = process.argv[2] ?? "http://localhost:3000";
const pages = ["/", "/match-center", "/match-center?tab=tables", "/analyst", "/my-club", "/settings", "/account"];
const themes = ["dark", "light", "pitch", "night"];
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [["fg", "bg", 4.5], ["fg", "surface", 4.5], ["muted", "bg", 4.5], ["muted", "surface", 4.5], ["accent-fg", "accent", 4.5], ["accent", "bg", 3], ["live", "bg", 3]];

const browser = await chromium.launch();
let failures = 0;
const fail = (m) => { failures++; console.log("FAIL", m); };
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL" });
  await ctx.addCookies([{ name: "sp_theme", value: theme, url: base }]);
  const page = await ctx.newPage();
  for (const path of pages) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => ({
      dir: document.documentElement.dir, theme: document.documentElement.dataset.theme, bodyDir: getComputedStyle(document.body).direction,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      badDigits: /[٠-٩۰-۹]/.test(document.body.innerText),
      vars: Object.fromEntries(["bg", "surface", "fg", "muted", "accent", "accent-fg", "live"].map((k) => [k, getComputedStyle(document.documentElement).getPropertyValue(`--c-${k}`).trim().split(/\s+/).map(Number)]))
    }));
    if (r.dir !== "rtl" || r.bodyDir !== "rtl") fail(`${theme} ${path}: not RTL`);
    if (r.theme !== theme) fail(`${theme} ${path}: theme not applied (${r.theme})`);
    if (r.overflow > 1) fail(`${theme} ${path}: horizontal overflow ${r.overflow}px`);
    if (r.badDigits) fail(`${theme} ${path}: non-Western digits`);
    if (path === "/") for (const [a, b, min] of pairs) { const c = ratio(r.vars[a], r.vars[b]); if (c < min) fail(`${theme}: contrast ${a}/${b} = ${c.toFixed(2)} < ${min}`); }
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `${failures} failure(s)` : "UI audit passed: RTL, Western digits, no overflow, AA contrast on all 4 themes x 7 pages");
process.exit(failures ? 1 : 0);
