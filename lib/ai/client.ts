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

type ReadyAi = AiConfig & { provider: NonNullable<AiConfig["provider"]> };

/** A custom OpenAI-compatible gateway may be keyless; every other provider needs a key. */
export const hasAi = (ai: AiConfig): ai is ReadyAi => Boolean(ai.provider && (ai.apiKey || (ai.provider === "custom" && ai.baseUrl)));

type CompleteOptions = { system: string; messages: ChatMessage[]; json?: boolean; maxTokens?: number; signal?: AbortSignal };

function request(ai: ReadyAi, o: CompleteOptions, stream: boolean): { url: string; init: RequestInit } {
  const maxTokens = o.maxTokens ?? 1200;
  const signal = o.signal ?? AbortSignal.timeout(50_000);
  if (ai.provider === "gemini") {
    const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model)}:${method}`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": ai.apiKey as string },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: o.system }] },
          contents: o.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          // Gemini 2.5 spends part of the output budget on hidden "thinking": give headroom and turn it off on Flash models.
          generationConfig: {
            maxOutputTokens: maxTokens * 3 + 512,
            ...(/flash/i.test(ai.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            ...(o.json ? { responseMimeType: "application/json" } : {})
          }
        }),
        signal
      }
    };
  }
  if (ai.provider === "openai" || ai.provider === "custom") {
    const custom = ai.provider === "custom";
    return {
      url: custom ? `${(ai.baseUrl as string).replace(/\/+$/, "")}/chat/completions` : "https://api.openai.com/v1/chat/completions",
      init: {
        method: "POST",
        headers: { "content-type": "application/json", ...(ai.apiKey ? { authorization: `Bearer ${ai.apiKey}` } : {}) },
        body: JSON.stringify({
          model: ai.model,
          messages: [{ role: "system", content: o.system }, ...o.messages],
          // OpenAI renamed max_tokens; third-party OpenAI-compatible servers still expect the classic name.
          ...(custom ? { max_tokens: maxTokens } : { max_completion_tokens: maxTokens }),
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
      headers: { "content-type": "application/json", "x-api-key": ai.apiKey as string, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: ai.model, system: o.system, messages: o.messages, max_tokens: maxTokens, stream }),
      signal
    }
  };
}

/** Custom endpoints may be user-supplied: never follow redirects (they could point at internal hosts). */
const safeInit = (ai: ReadyAi, init: RequestInit): RequestInit => (ai.provider === "custom" ? { ...init, redirect: "error" } : init);

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
  const res = await fetch(url, safeInit(ai, init));
  if (!res.ok) await fail(res);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    content?: Array<{ type: string; text?: string }>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (ai.provider === "gemini") return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (ai.provider === "anthropic") return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return data.choices?.[0]?.message?.content ?? "";
}

/** Streams text deltas (SSE) from either provider. */
export async function* streamCompletion(ai: AiConfig, o: CompleteOptions): AsyncGenerator<string> {
  if (!hasAi(ai)) throw new AiError("לא הוגדר מפתח AI", 400);
  const { url, init } = request(ai, o, true);
  const res = await fetch(url, safeInit(ai, init));
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
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text =
          ai.provider === "gemini"
            ? (evt.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("")
            : ai.provider === "anthropic"
              ? evt.type === "content_block_delta" && evt.delta?.type === "text_delta" ? evt.delta.text : undefined
              : evt.choices?.[0]?.delta?.content;
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
