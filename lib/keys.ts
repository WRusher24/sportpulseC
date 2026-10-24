/** Shape of the API keys a user can supply from /settings. Shared by the browser key-store and the server resolver. */
export type AiProviderId = "openai" | "anthropic" | "gemini" | "custom";
/**
 * auto   = free chain (ESPN public JSON, then Israeli portal scraping), preceded by a paid provider when a key exists
 * espn / portals = a single free source; api-football / sportmonks = paid APIs (optional); mock = no live data
 */
export type SportsProviderId = "auto" | "espn" | "portals" | "api-football" | "sportmonks" | "mock";

export type UserKeys = {
  aiProvider?: AiProviderId;
  aiModel?: string;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  /** Base URL of an OpenAI-compatible server, e.g. https://my-host.example/v1 (chat/completions is appended). */
  customBaseUrl?: string;
  customKey?: string;
  customModel?: string;
  sportsProvider?: SportsProviderId;
  apiFootballKey?: string;
  apiBasketballKey?: string;
  sportmonksToken?: string;
};

export const KEY_PATTERN = /^[A-Za-z0-9_\-.:~+/=]{8,512}$/;
export const MODEL_PATTERN = /^[A-Za-z0-9_\-.:/]{2,80}$/;

export const AI_PROVIDERS: AiProviderId[] = ["openai", "anthropic", "gemini", "custom"];
export const SPORTS_PROVIDERS: SportsProviderId[] = ["auto", "espn", "portals", "api-football", "sportmonks", "mock"];

/** HTTP headers that carry user-supplied keys from the browser to our own API routes (HTTPS only, never logged, never cached). */
export const KEY_HEADERS = {
  aiProvider: "x-sp-ai-provider",
  aiModel: "x-sp-ai-model",
  openaiKey: "x-sp-openai-key",
  anthropicKey: "x-sp-anthropic-key",
  geminiKey: "x-sp-gemini-key",
  customBaseUrl: "x-sp-custom-url",
  customKey: "x-sp-custom-key",
  customModel: "x-sp-custom-model",
  sportsProvider: "x-sp-sports-provider",
  apiFootballKey: "x-sp-api-football-key",
  apiBasketballKey: "x-sp-api-basketball-key",
  sportmonksToken: "x-sp-sportmonks-token"
} as const satisfies Record<keyof UserKeys, string>;

export function keysToHeaders(keys: UserKeys): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, header] of Object.entries(KEY_HEADERS) as Array<[keyof UserKeys, string]>) {
    const v = keys[field];
    if (typeof v === "string" && v.length > 0) out[header] = v;
  }
  return out;
}

const PRIVATE_V4 = /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/**
 * Validates a USER-supplied endpoint before the server ever fetches it (SSRF guard): https only, no credentials in the
 * URL, no localhost / internal names / private or link-local IPs. Returns the normalised base URL or null.
 * Trusted operator endpoints (CUSTOM_AI_BASE_URL env var) are not subject to this check.
 */
export function safePublicHttpsUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 300) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || u.hash) return null;
  if (!host.includes(".") || host.startsWith("[") || /\.(?:local|localhost|internal|lan|home|corp)$/.test(host) || host === "localhost") return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.test(host)) return null;
  return u.toString().replace(/\/+$/, "");
}

export function sanitizeUserKeys(input: unknown): UserKeys {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: UserKeys = {};
  const key = (v: unknown) => (typeof v === "string" && KEY_PATTERN.test(v.trim()) ? v.trim() : undefined);
  const model = (v: unknown) => (typeof v === "string" && MODEL_PATTERN.test(v.trim()) ? v.trim() : undefined);
  const secrets = {
    openaiKey: key(raw.openaiKey),
    anthropicKey: key(raw.anthropicKey),
    geminiKey: key(raw.geminiKey),
    customKey: key(raw.customKey),
    apiFootballKey: key(raw.apiFootballKey),
    apiBasketballKey: key(raw.apiBasketballKey),
    sportmonksToken: key(raw.sportmonksToken)
  };
  for (const [k, v] of Object.entries(secrets)) if (v) (out as Record<string, string>)[k] = v;
  const url = safePublicHttpsUrl(raw.customBaseUrl);
  if (url) out.customBaseUrl = url;
  const aiModel = model(raw.aiModel);
  const customModel = model(raw.customModel);
  if (aiModel) out.aiModel = aiModel;
  if (customModel) out.customModel = customModel;
  if (AI_PROVIDERS.includes(raw.aiProvider as AiProviderId)) out.aiProvider = raw.aiProvider as AiProviderId;
  if (SPORTS_PROVIDERS.includes(raw.sportsProvider as SportsProviderId)) out.sportsProvider = raw.sportsProvider as SportsProviderId;
  return out;
}
