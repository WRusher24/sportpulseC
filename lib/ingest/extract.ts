import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { fetchText } from "./http";
import type { SourceConfig } from "./sources";
import { toWesternDigits } from "@/lib/format";

export type ExtractedArticle = {
  title: string | null;
  text: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
};

/** Containers that never hold editorial content: ads, widgets, popups, tracking and site chrome. */
const NOISE_SELECTORS = [
  "script", "style", "noscript", "template", "iframe", "object", "embed", "ins", "form", "button", "dialog", "svg", "canvas",
  "nav", "footer", "header", "aside",
  "video", "audio", "[role=dialog]", "[role=banner]", "[role=complementary]", "[aria-hidden=true]",
  "[class*='advert']", "[id*='advert']", "[class*='adsbygoogle']", "[id*='google_ads']", "[id^='div-gpt']", "[class*='dfp']",
  "[class~='ad']", "[class~='ads']", "[class^='ad-']", "[class*=' ad-']", "[class^='ad_']", "[class*=' ad_']", "[class*='-ad-']", "[class$='-ad']", "[class*='-ads']", "[class*='_ad_']", "[id^='ad-']", "[id^='ad_']", "[data-ad]", "[data-ad-slot]",
  "[class*='banner']", "[id*='banner']", "[class*='promo']", "[id*='promo']", "[class*='sponsor']", "[id*='sponsor']",
  "[class*='affiliate']", "[class*='taboola']", "[id*='taboola']", "[class*='outbrain']", "[id*='outbrain']", "[class*='mgid']", "[class*='teads']",
  "[class*='popup']", "[class*='modal']", "[class*='overlay']", "[class*='newsletter']", "[class*='subscribe']",
  "[class*='share']", "[class*='social']", "[class*='related']", "[class*='recommend']", "[class*='comments']", "[id*='comments']",
  "[class*='widget']", "[class*='sidebar']", "[class*='breadcrumb']", "[class*='cookie']", "[class*='betting']", "[class*='odds']",
  "[class*='video-player']", "[class*='player-wrap']", "[class*='outstream']", "[class*='sticky']",
  "a[rel~='sponsored']", "a[href*='affiliate']", "a[href*='aff_id']", "a[href*='clickid']", "a[href*='doubleclick']", "a[href*='googleadservices']"
].join(",");

/** Lines that are marketing / affiliate copy even when they sit inside the article container. */
const PROMO_LINE =
  /(?:תוכן שיווקי|תוכן מקודם|בשיתוף עם|בחסות|פרסומת|מודעה|לחצו כאן להרשמה|הרשמו עכשיו|קבלו בונוס|בונוס הרשמה|קוד קופון|קופון|הימורים בבית|הימור|הימורי ספורט|הרוויחו|הצטרפו (?:עכשיו|ל)|הורידו את האפליקציה|הירשמו לניוזלטר|עקבו אחרינו|לכל הכתבות|קראו גם|ראו גם|גם בוואלה|כתבות נוספות|צפו בוידאו|לצפייה בסרטון|תנאי השימוש|כל הזכויות שמורות|תגובות|שתפו|affiliate|sponsored|advertisement|promo code|bet now|sign up)/i;

const BODY_TAGS = "p, h2, h3, blockquote, li";

const squash = (s: string) => toWesternDigits(s.replace(/[‎‏‪-‮]/g, "").replace(/\s+/g, " ").trim());

function jsonLd($: cheerio.CheerioAPI): Record<string, any> | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes: any[] = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      const hit = nodes.find((n) => n && /NewsArticle|Article|SportsArticle|ReportageNewsArticle/.test(String(n["@type"])));
      if (hit) return hit;
    } catch {
      /* malformed JSON-LD is common */
    }
  }
  return null;
}

const asString = (v: unknown): string | null => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return asString(o.name ?? o.url ?? o["@id"]);
  }
  return null;
};

function textScore($: cheerio.CheerioAPI, el: AnyNode): number {
  let score = 0;
  $(el)
    .find("p")
    .each((_, p) => {
      const t = squash($(p).text());
      if (t.length > 40) score += t.length;
    });
  return score;
}

function pickContainer($: cheerio.CheerioAPI, hints: string[]): cheerio.Cheerio<AnyNode> | null {
  for (const sel of hints) {
    const nodes = $(sel).toArray();
    const best = nodes.map((n) => ({ n, s: textScore($, n) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s > 200) return $(best.n);
  }
  // Generic fallback: the block with the highest paragraph text density.
  let best: { n: AnyNode; s: number } | null = null;
  $("article, main, section, div").each((_, el) => {
    const s = textScore($, el);
    if (s > (best?.s ?? 0)) best = { n: el, s };
  });
  return best && (best as { s: number }).s > 200 ? $((best as { n: AnyNode }).n) : null;
}

function isLikelyAdImage(url: string): boolean {
  return /(?:banner|\/ads?\/|adserver|doubleclick|pixel|spacer|1x1|tracking|logo|favicon|sprite|placeholder)/i.test(url);
}

function resolve(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Extracts clean editorial text from an article page.
 * Pipeline: JSON-LD / OpenGraph metadata -> noise removal (ads, widgets, popups, affiliate links) -> main container
 * selection -> paragraph filtering -> plain text (no HTML survives, so nothing can be injected at render time).
 */
export function extractArticle(html: string, url: string, source?: Pick<SourceConfig, "bodySelectors" | "authorSelectors">): ExtractedArticle {
  const $ = cheerio.load(html);
  const ld = jsonLd($);

  const meta = (name: string) => $(`meta[property="${name}"], meta[name="${name}"]`).attr("content")?.trim() || null;
  const title = squash(asString(ld?.headline) || meta("og:title") || $("h1").first().text() || $("title").text() || "") || null;

  const imageCandidates = [asString(Array.isArray(ld?.image) ? ld?.image[0] : ld?.image), meta("og:image"), meta("twitter:image")];
  const imageUrl = imageCandidates.map((c) => resolve(c, url)).find((c): c is string => Boolean(c) && !isLikelyAdImage(c as string)) ?? null;

  const publishedRaw = asString(ld?.datePublished) || meta("article:published_time") || meta("og:updated_time") || $("time[datetime]").first().attr("datetime") || null;
  const publishedAt = publishedRaw && !Number.isNaN(Date.parse(publishedRaw)) ? new Date(publishedRaw).toISOString() : null;

  const authorRaw =
    asString(Array.isArray(ld?.author) ? ld?.author.map(asString).filter(Boolean).join(", ") : ld?.author) ||
    meta("author") ||
    meta("article:author") ||
    (source?.authorSelectors ?? []).map((s) => squash($(s).first().text())).find(Boolean) ||
    null;
  const author = authorRaw ? squash(authorRaw.replace(/^(?:מאת|כתב|צילום)[:\s]+/u, "")).slice(0, 120) || null : null;

  const canonicalUrl = resolve($('link[rel="canonical"]').attr("href") || meta("og:url"), url);

  $(NOISE_SELECTORS).remove();
  $("[style*='display:none'], [style*='display: none'], [hidden]").remove();

  const hints = [...(source?.bodySelectors ?? []), "[itemprop=articleBody]", "article", "main"];
  const container = pickContainer($, hints);

  const paragraphs: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string, heading: boolean) => {
    const t = squash(raw);
    if (t.length < (heading ? 4 : 25)) return;
    if (PROMO_LINE.test(t) && t.length < 220) return;
    if (/^(?:https?:\/\/|www\.)\S+$/i.test(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    paragraphs.push(heading ? `## ${t}` : t);
  };

  if (container) {
    container.find(BODY_TAGS).each((_, el) => {
      const node = el as Element;
      // Skip nested duplicates (e.g. <li><p>..</p></li>) by only taking leaf-most text blocks.
      if ($(node).find(BODY_TAGS).length > 0 && node.tagName !== "blockquote") return;
      push($(node).text(), node.tagName === "h2" || node.tagName === "h3");
    });
  }

  if (paragraphs.length === 0 && typeof ld?.articleBody === "string") {
    for (const part of ld.articleBody.split(/\n+/)) push(part, false);
  }

  return { title, text: paragraphs.join("\n\n"), imageUrl, author, publishedAt, canonicalUrl };
}

export async function fetchAndExtract(url: string, source?: SourceConfig): Promise<ExtractedArticle> {
  const html = await fetchText(url);
  return extractArticle(html, url, source);
}

/** Collects candidate article links from a section page (fallback when RSS is unavailable). */
export function linksFromListing(html: string, base: string, pattern: RegExp, limit = 25): Array<{ url: string; title: string }> {
  const $ = cheerio.load(html);
  const out = new Map<string, string>();
  $("a[href]").each((_, a) => {
    const href = resolve($(a).attr("href"), base);
    const title = squash($(a).text());
    if (href && pattern.test(href) && title.length > 15 && !out.has(href)) out.set(href, title);
  });
  return [...out.entries()].slice(0, limit).map(([url, title]) => ({ url, title }));
}
