const USER_AGENT = "SportPulseBot/1.0 (+https://github.com/WRusher24/sportpulseC; news aggregation with source attribution)";
const MAX_BYTES = 3 * 1024 * 1024;

function charsetFrom(contentType: string | null, head: string): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<\?xml[^>]+encoding=["']([\w-]+)/i)?.[1];
  return (fromHeader || fromMeta || "utf-8").toLowerCase();
}

/** Fetches a text document with a timeout and size cap, honouring windows-1255 / ISO-8859-8 encoded Hebrew pages. */
export async function fetchText(url: string, opts: { timeoutMs?: number; accept?: string } = {}): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`unsupported protocol ${u.protocol}`);
  const res = await fetch(u, {
    headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "he-IL,he;q=0.9,en;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u.host}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("response too large");
  const head = new TextDecoder("latin1").decode(buf.subarray(0, 2048));
  const charset = charsetFrom(res.headers.get("content-type"), head);
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}
