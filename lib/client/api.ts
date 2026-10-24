"use client";

import { keysToHeaders, type UserKeys } from "@/lib/keys";
import { isKeystoreSupported, loadKeys } from "./keystore";

let cache: Promise<UserKeys> | null = null;
const listeners = new Set<(k: UserKeys) => void>();

/** Decrypted keys, loaded once per page lifetime and refreshed whenever Settings saves new ones. */
export function currentKeys(): Promise<UserKeys> {
  if (!cache) cache = isKeystoreSupported() ? loadKeys() : Promise.resolve({});
  return cache;
}

export function publishKeys(keys: UserKeys) {
  cache = Promise.resolve(keys);
  listeners.forEach((l) => l(keys));
}

export function subscribeKeys(fn: (k: UserKeys) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** fetch() that attaches the user's own API keys (if any) so our route handlers prefer them over system env keys. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const keys = await currentKeys();
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(keysToHeaders(keys))) headers.set(k, v);
  return fetch(input, { ...init, headers, cache: "no-store" });
}
