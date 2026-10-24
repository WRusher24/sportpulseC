import { ProviderError } from "./types";

export async function getJson<T>(url: string, headers: Record<string, string>, revalidate = 20): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(15_000), next: { revalidate } });
  if (!res.ok) throw new ProviderError(res.status === 401 || res.status === 403 ? "מפתח נתוני הספורט נדחה" : `שגיאת ספק נתונים (${res.status})`, res.status);
  return (await res.json()) as T;
}

export const seasonStartYear = (season: string) => Number(season.split("/")[0]);
