import type { Credentials } from "@/lib/server/credentials";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type AiConfig = Credentials["ai"];

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const hasAi = (ai: AiConfig): ai is AiConfig & { provider: "openai" | "anthropic"; apiKey: string } => Boolean(ai.provider && ai.apiKey);

type CompleteOptions = { system: string; messages: ChatMessage[]; json?: boolean; maxTokens?: number; signal?: AbortSignal };

function request(ai: AiConfig & { provider: "openai" | "anthropic"; apiKey: string }, o: CompleteOptions, stream: boolean): { url: string; init: RequestInit } {
  const maxTokens = o.maxTokens ?? 1200;
  const signal = o.signal ?? AbortSignal.timeout(50_000);
  if (ai.provider === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      init: {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model: ai.model,
          messages: [{ role: "system", content: o.system }, ...o.messages],
          max_completion_tokens: maxTokens,
          stream,
          ...(o.json ? { response_format: { type: "json_object" } } : {})
        }),
        signal
      }
    };
  }
  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ai.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: ai.model, system: o.system, messages: o.messages, max_tokens: maxTokens, stream }),
      signal
    }
  };
}

async function fail(res: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    detail = typeof body.error === "string" ? body.error : (body.error?.message ?? "");
  } catch {
    /* body was not JSON */
  }
  const hint = res.status === 401 || res.status === 403 ? "מפתח ה-API נדחה" : res.status === 429 ? "חריגה ממכסת הבקשות של ספק ה-AI" : "שגיאת ספק AI";
  // The provider message never contains the key, but cap it anyway.
  throw new AiError(`${hint} (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`, res.status);
}

/** One-shot completion. Throws AiError on provider failure. */
export async function complete(ai: AiConfig, o: CompleteOptions): Promise<string> {
  if (!hasAi(ai)) throw new AiError("לא הוגדר מפתח AI", 400);
  const { url, init } = request(ai, o, false);
  const res = await fetch(url, init);
  if (!res.ok) await fail(res);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    content?: Array<{ type: string; text?: string }>;
  };
  return ai.provider === "openai"
    ? (data.choices?.[0]?.message?.content ?? "")
    : (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

/** Streams text deltas (SSE) from either provider. */
export async function* streamCompletion(ai: AiConfig, o: CompleteOptions): AsyncGenerator<string> {
  if (!hasAi(ai)) throw new AiError("לא הוגדר מפתח AI", 400);
  const { url, init } = request(ai, o, true);
  const res = await fetch(url, init);
  if (!res.ok) await fail(res);
  if (!res.body) throw new AiError("תגובה ריקה מספק ה-AI", 502);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          type?: string;
          delta?: { type?: string; text?: string };
        };
        const text = ai.provider === "openai" ? evt.choices?.[0]?.delta?.content : evt.type === "content_block_delta" && evt.delta?.type === "text_delta" ? evt.delta.text : undefined;
        if (text) yield text;
      } catch {
        /* ignore keep-alives / partial frames */
      }
    }
  }
}

/** Extracts and parses the first JSON object found in a model reply. */
export function parseJsonReply<T>(reply: string): T {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AiError("תשובת ה-AI אינה בפורמט JSON", 502);
  return JSON.parse(reply.slice(start, end + 1)) as T;
}
