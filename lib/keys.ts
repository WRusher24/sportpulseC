/** Shape of the API keys a user can supply from /settings. Shared by the browser key-store and the server resolver. */
export type AiProviderId = "openai" | "anthropic";
export type SportsProviderId = "api-football" | "sportmonks" | "mock";

export type UserKeys = {
  aiProvider?: AiProviderId;
  aiModel?: string;
  openaiKey?: string;
  anthropicKey?: string;
  sportsProvider?: SportsProviderId;
  apiFootballKey?: string;
  apiBasketballKey?: string;
  sportmonksToken?: string;
};

export const KEY_PATTERN = /^[A-Za-z0-9_\-.:~+/=]{8,512}$/;
export const MODEL_PATTERN = /^[A-Za-z0-9_\-.:/]{2,80}$/;

/** HTTP headers that carry user-supplied keys from the browser to our own API routes (HTTPS only, never logged, never cached). */
export const KEY_HEADERS = {
  aiProvider: "x-sp-ai-provider",
  aiModel: "x-sp-ai-model",
  openaiKey: "x-sp-openai-key",
  anthropicKey: "x-sp-anthropic-key",
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

export function sanitizeUserKeys(input: unknown): UserKeys {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: UserKeys = {};
  const key = (v: unknown) => (typeof v === "string" && KEY_PATTERN.test(v.trim()) ? v.trim() : undefined);
  const openai = key(raw.openaiKey);
  const anthropic = key(raw.anthropicKey);
  const football = key(raw.apiFootballKey);
  const basketball = key(raw.apiBasketballKey);
  const monks = key(raw.sportmonksToken);
  if (openai) out.openaiKey = openai;
  if (anthropic) out.anthropicKey = anthropic;
  if (football) out.apiFootballKey = football;
  if (basketball) out.apiBasketballKey = basketball;
  if (monks) out.sportmonksToken = monks;
  if (raw.aiProvider === "openai" || raw.aiProvider === "anthropic") out.aiProvider = raw.aiProvider;
  if (raw.sportsProvider === "api-football" || raw.sportsProvider === "sportmonks" || raw.sportsProvider === "mock") out.sportsProvider = raw.sportsProvider;
  if (typeof raw.aiModel === "string" && MODEL_PATTERN.test(raw.aiModel.trim())) out.aiModel = raw.aiModel.trim();
  return out;
}
