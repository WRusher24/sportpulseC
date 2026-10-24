"use client";

import type { UserKeys } from "@/lib/keys";

/**
 * Browser-side encrypted key vault.
 * AES-GCM-256 with a NON-EXTRACTABLE CryptoKey kept in IndexedDB; only ciphertext is written to localStorage, so the
 * raw keys never touch disk in plaintext and cannot be exfiltrated by copying storage. (An XSS attacker running inside
 * the page could still ask the browser to decrypt - this protects data at rest, not a compromised origin.)
 */

const DB_NAME = "sportpulse-keystore";
const STORE = "crypto";
const LS_KEY = "sp_keys_v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function masterKey(create: boolean): Promise<CryptoKey | null> {
  const db = await openDb();
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get("master");
    r.onsuccess = () => resolve(r.result as CryptoKey | undefined);
    r.onerror = () => reject(r.error);
  });
  if (existing || !create) return existing ?? null;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(key, "master");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return key;
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const isKeystoreSupported = () => typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && Boolean(crypto.subtle);

export async function saveKeys(keys: UserKeys): Promise<void> {
  if (Object.keys(keys).length === 0) {
    localStorage.removeItem(LS_KEY);
    return;
  }
  const key = await masterKey(true);
  if (!key) throw new Error("keystore unavailable");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(keys)));
  localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) }));
}

export async function loadKeys(): Promise<UserKeys> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const { iv, ct } = JSON.parse(raw) as { v: number; iv: string; ct: string };
    const key = await masterKey(false);
    if (!key) return {};
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
    return JSON.parse(new TextDecoder().decode(plain)) as UserKeys;
  } catch {
    return {};
  }
}

export function clearKeys(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* storage may be blocked */
  }
}
