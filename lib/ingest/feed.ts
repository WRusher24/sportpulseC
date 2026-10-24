import { XMLParser } from "fast-xml-parser";
import sanitizeHtml from "sanitize-html";
import { fetchText } from "./http";
import type { SourceConfig } from "./sources";

export type FeedItem = {
  sourceKey: SourceConfig["key"];
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  imageUrl: string | null;
  author: string | null;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true, processEntities: true });

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
};

/** Removes every tag/entity from feed-provided HTML. */
export const stripHtml = (html: string): string =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function pickImage(item: Record<string, unknown>): string | null {
  const media = arr(item["media:content"] as Record<string, unknown> | Record<string, unknown>[] | undefined);
  for (const m of media) if (typeof m["@_url"] === "string") return m["@_url"];
  const thumb = arr(item["media:thumbnail"] as Record<string, unknown> | Record<string, unknown>[] | undefined);
  for (const m of thumb) if (typeof m["@_url"] === "string") return m["@_url"];
  const enc = arr(item.enclosure as Record<string, unknown> | Record<string, unknown>[] | undefined);
  for (const e of enc) if (typeof e["@_url"] === "string" && String(e["@_type"] ?? "image").startsWith("image")) return e["@_url"];
  const html = text(item["content:encoded"]) || text(item.description);
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

function safeDate(v: string): string {
  const t = Date.parse(v);
  const now = Date.now();
  return new Date(Number.isNaN(t) ? now : Math.min(t, now)).toISOString();
}

const absolute = (href: string, base: string): string | null => {
  if (!href.trim()) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** Parses RSS 2.0 and Atom documents into normalized items. */
export function parseFeed(xml: string, source: Pick<SourceConfig, "key">, base: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, any>;
  const items: FeedItem[] = [];

  for (const it of arr<Record<string, unknown>>(doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item)) {
    const title = stripHtml(text(it.title));
    const url = absolute(text(it.link) || text(it.guid), base);
    if (!title || !url) continue;
    items.push({
      sourceKey: source.key,
      title,
      url,
      publishedAt: safeDate(text(it.pubDate) || text(it["dc:date"])),
      description: stripHtml(text(it["content:encoded"]) || text(it.description)),
      imageUrl: pickImage(it),
      author: stripHtml(text(it["dc:creator"]) || text(it.author)) || null
    });
  }

  for (const it of arr<Record<string, any>>(doc?.feed?.entry)) {
    const links = arr<Record<string, string> | string>(it.link);
    const alt = links.find((l) => typeof l === "object" && (l["@_rel"] ?? "alternate") === "alternate") ?? links[0];
    const href = typeof alt === "string" ? alt : alt?.["@_href"];
    const title = stripHtml(text(it.title));
    const url = href ? absolute(href, base) : null;
    if (!title || !url) continue;
    items.push({
      sourceKey: source.key,
      title,
      url,
      publishedAt: safeDate(text(it.published) || text(it.updated)),
      description: stripHtml(text(it.summary) || text(it.content)),
      imageUrl: pickImage(it),
      author: stripHtml(text(it.author?.name)) || null
    });
  }
  return items;
}

/** Tries each feed URL until one yields items. */
export async function fetchFeed(source: SourceConfig): Promise<{ items: FeedItem[]; feedUrl: string | null; errors: string[] }> {
  const errors: string[] = [];
  for (const url of source.feeds) {
    try {
      const xml = await fetchText(url, { accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5" });
      const items = parseFeed(xml, source, url);
      if (items.length > 0) return { items, feedUrl: url, errors };
      errors.push(`${url}: feed contained no items`);
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { items: [], feedUrl: null, errors };
}
