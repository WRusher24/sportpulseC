import { KEY_HEADERS, safePublicHttpsUrl, sanitizeUserKeys, type AiProviderId, type SportsProviderId, type UserKeys } from "@/lib/keys";
import { decryptJson } from "./secrets";
import type { UserRecord } from "@/lib/data/repo";

export type CredentialSource = "user" | "account" | "env" | "none";

export type Credentials = {
  ai: {
    provider: AiProviderId | null;
    apiKey: string | null;
    model: string;
    /** Only for provider "custom": OpenAI-compatible base URL. */
    baseUrl: string | null;
    source: CredentialSource;
  };
  sports: {
    provider: SportsProviderId;
    apiFootballKey: string | null;
    apiBasketballKey: string | null;
    sportmonksToken: string | null;
    source: CredentialSource;
  };
};

const defaultModel = (p: AiProviderId): string => {
  switch (p) {
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
    case "anthropic":
      return process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
    case "gemini":
      return process.env.GEMINI_MODEL || "gemini-2.5-flash";
    default:
      return process.env.CUSTOM_AI_MODEL || "default";
  }
};

type HeaderReader = { get(name: string): string | null };

/** Reads and validates user-supplied keys from request headers. Invalid values are silently dropped. */
export function keysFromHeaders(headers: HeaderReader): UserKeys {
  const raw: Record<string, string> = {};
  for (const [field, header] of Object.entries(KEY_HEADERS)) {
    const v = headers.get(header);
    if (v) raw[field] = v;
  }
  return sanitizeUserKeys(raw);
}

export function keysFromAccount(user: Pick<UserRecord, "customApiKeysJson"> | null | undefined): UserKeys {
  return sanitizeUserKeys(decryptJson(user?.customApiKeysJson));
}

/**
 * Precedence for every credential: 1) key typed in the browser (request headers / server action argument),
 * 2) key synced to the signed-in account (encrypted at rest), 3) system environment variable.
 */
export function resolveCredentials(opts: { requestKeys?: UserKeys; accountKeys?: UserKeys } = {}): Credentials {
  const req = opts.requestKeys ?? {};
  const acc = opts.accountKeys ?? {};
  const pick = <K extends keyof UserKeys>(k: K): { value: UserKeys[K] | undefined; from: CredentialSource } =>
    req[k] ? { value: req[k], from: "user" } : acc[k] ? { value: acc[k], from: "account" } : { value: undefined, from: "none" };

  const env = (name: string) => process.env[name]?.trim() || undefined;
  const from = (picked: { value: unknown; from: CredentialSource }, envValue: string | undefined): CredentialSource => (picked.value ? picked.from : envValue ? "env" : "none");

  const openai = pick("openaiKey");
  const anthropic = pick("anthropicKey");
  const gemini = pick("geminiKey");
  const customUrl = pick("customBaseUrl");
  const customKey = pick("customKey");
  const envCustomUrl = safePublicHttpsUrl(env("CUSTOM_AI_BASE_URL")) ?? env("CUSTOM_AI_BASE_URL")?.replace(/\/+$/, "");

  // A provider is usable when it has a key (custom: a base URL; its key is optional for local/keyless gateways).
  const usable: Record<AiProviderId, { ready: boolean; key: string | null; from: CredentialSource }> = {
    openai: { ready: Boolean(openai.value ?? env("OPENAI_API_KEY")), key: openai.value ?? env("OPENAI_API_KEY") ?? null, from: from(openai, env("OPENAI_API_KEY")) },
    anthropic: { ready: Boolean(anthropic.value ?? env("ANTHROPIC_API_KEY")), key: anthropic.value ?? env("ANTHROPIC_API_KEY") ?? null, from: from(anthropic, env("ANTHROPIC_API_KEY")) },
    gemini: { ready: Boolean(gemini.value ?? env("GEMINI_API_KEY")), key: gemini.value ?? env("GEMINI_API_KEY") ?? null, from: from(gemini, env("GEMINI_API_KEY")) },
    custom: { ready: Boolean(customUrl.value ?? envCustomUrl), key: customKey.value ?? env("CUSTOM_AI_API_KEY") ?? null, from: customUrl.value ? customUrl.from : envCustomUrl ? "env" : "none" }
  };

  const userProvider = pick("aiProvider").value;
  const envProvider = (["openai", "anthropic", "gemini", "custom"] as const).find((p) => p === env("AI_PROVIDER"));
  const order = [userProvider, envProvider, "gemini", "openai", "anthropic", "custom"].filter((p, i, a): p is AiProviderId => Boolean(p) && a.indexOf(p) === i);
  const provider = order.find((p) => usable[p].ready) ?? null;
  const model = provider === "custom" ? (pick("customModel").value ?? pick("aiModel").value ?? defaultModel("custom")) : (pick("aiModel").value ?? (provider ? defaultModel(provider) : defaultModel("openai")));

  const football = pick("apiFootballKey");
  const basketball = pick("apiBasketballKey");
  const monks = pick("sportmonksToken");
  const apiFootballKey = football.value ?? env("API_FOOTBALL_KEY") ?? null;
  const apiBasketballKey = basketball.value ?? football.value ?? env("API_BASKETBALL_KEY") ?? env("API_FOOTBALL_KEY") ?? null;
  const sportmonksToken = monks.value ?? env("SPORTMONKS_TOKEN") ?? null;

  /**
   * Live data needs NO subscription: the default "auto" chain uses free public JSON (ESPN) and falls back to scraping the
   * Israeli portals. A paid key, when present, is simply tried first. Choosing "mock" disables live data entirely.
   */
  const wantedRaw = pick("sportsProvider").value ?? (env("SPORTS_PROVIDER") as SportsProviderId | undefined);
  const wanted: SportsProviderId = wantedRaw ?? "auto";
  let sportsProvider: SportsProviderId = wanted;
  if (wanted === "api-football" && !apiFootballKey) sportsProvider = "auto";
  if (wanted === "sportmonks" && !sportmonksToken) sportsProvider = "auto";
  const paidSource: CredentialSource = apiFootballKey || sportmonksToken ? (football.value || basketball.value ? football.from : monks.value ? monks.from : "env") : "none";

  return {
    ai: { provider, apiKey: provider ? usable[provider].key : null, model, baseUrl: provider === "custom" ? ((customUrl.value ?? envCustomUrl) as string).replace(/\/+$/, "") : null, source: provider ? usable[provider].from : "none" },
    sports: { provider: sportsProvider, apiFootballKey, apiBasketballKey, sportmonksToken, source: paidSource }
  };
}
