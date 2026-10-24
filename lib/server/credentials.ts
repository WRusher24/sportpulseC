import { KEY_HEADERS, sanitizeUserKeys, type AiProviderId, type SportsProviderId, type UserKeys } from "@/lib/keys";
import { decryptJson } from "./secrets";
import type { UserRecord } from "@/lib/data/repo";

export type CredentialSource = "user" | "account" | "env" | "none";

export type Credentials = {
  ai: { provider: AiProviderId | null; apiKey: string | null; model: string; source: CredentialSource };
  sports: {
    provider: SportsProviderId;
    apiFootballKey: string | null;
    apiBasketballKey: string | null;
    sportmonksToken: string | null;
    source: CredentialSource;
  };
};

const DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5"
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

  const openai = pick("openaiKey");
  const anthropic = pick("anthropicKey");
  const envOpenai = process.env.OPENAI_API_KEY;
  const envAnthropic = process.env.ANTHROPIC_API_KEY;

  const keys: Record<AiProviderId, { key: string | null; from: CredentialSource }> = {
    openai: { key: openai.value ?? envOpenai ?? null, from: openai.value ? openai.from : envOpenai ? "env" : "none" },
    anthropic: { key: anthropic.value ?? envAnthropic ?? null, from: anthropic.value ? anthropic.from : envAnthropic ? "env" : "none" }
  };

  const userProvider = pick("aiProvider").value;
  const envProvider = process.env.AI_PROVIDER === "anthropic" || process.env.AI_PROVIDER === "openai" ? process.env.AI_PROVIDER : undefined;
  const order: AiProviderId[] = [userProvider, envProvider, "openai", "anthropic"].filter((p, i, a): p is AiProviderId => Boolean(p) && a.indexOf(p) === i);
  const provider = order.find((p) => keys[p].key) ?? null;
  const model = pick("aiModel").value ?? (provider ? DEFAULT_MODELS[provider] : DEFAULT_MODELS.openai);

  const football = pick("apiFootballKey");
  const basketball = pick("apiBasketballKey");
  const monks = pick("sportmonksToken");
  const envFootball = process.env.API_FOOTBALL_KEY;
  const envBasketball = process.env.API_BASKETBALL_KEY || envFootball;
  const envMonks = process.env.SPORTMONKS_TOKEN;
  const apiFootballKey = football.value ?? envFootball ?? null;
  const apiBasketballKey = basketball.value ?? football.value ?? envBasketball ?? null;
  const sportmonksToken = monks.value ?? envMonks ?? null;

  const userSports = pick("sportsProvider").value;
  const envSports = process.env.SPORTS_PROVIDER as SportsProviderId | undefined;
  const wanted = userSports ?? envSports;
  let sportsProvider: SportsProviderId = "mock";
  if (wanted === "mock") sportsProvider = "mock";
  else if (wanted === "sportmonks" && sportmonksToken) sportsProvider = "sportmonks";
  else if (wanted === "api-football" && apiFootballKey) sportsProvider = "api-football";
  else if (!wanted) sportsProvider = apiFootballKey ? "api-football" : sportmonksToken ? "sportmonks" : "mock";

  const sportsSource: CredentialSource =
    sportsProvider === "mock"
      ? "none"
      : sportsProvider === "sportmonks"
        ? monks.value
          ? monks.from
          : "env"
        : football.value || basketball.value
          ? (football.value ? football.from : basketball.from)
          : "env";

  return {
    ai: { provider, apiKey: provider ? keys[provider].key : null, model, source: provider ? keys[provider].from : "none" },
    sports: { provider: sportsProvider, apiFootballKey, apiBasketballKey, sportmonksToken, source: sportsSource }
  };
}

