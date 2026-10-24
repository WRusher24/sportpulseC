/**
 * Context hygiene before anything reaches an LLM. Match data comes from scraped pages and third-party APIs, so strings are
 * treated as untrusted: control characters and code fences are removed, length is capped, and instruction-like phrases
 * ("ignore previous instructions", "system:", ...) are neutralised so they cannot steer the model.
 */
const INJECTION = /(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)[^.\n]{0,60}|\b(system|assistant|developer)\s*:|<\/?(system|assistant|instructions?)>|התעלם\s+מ(כל\s+)?ה?הוראות[^.\n]{0,60}/gi;

export function cleanText(input: string, max = 220): string {
  return input
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/`{3,}/g, " ")
    .replace(INJECTION, "[הוסר]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Deep-cleans every string inside a JSON-like value (arrays capped to 60 items). */
export function cleanDeep<T>(value: T, max = 220): T {
  if (typeof value === "string") return cleanText(value, max) as unknown as T;
  if (Array.isArray(value)) return value.slice(0, 60).map((v) => cleanDeep(v, max)) as unknown as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, cleanDeep(v, max)])) as T;
  return value;
}
