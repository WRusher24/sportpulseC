import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/**
 * Master secret. AUTH_SECRET is recommended; when it is missing we derive one from DATABASE_URL (which already contains
 * a credential) so a zero-config Vercel deploy still gets non-guessable cookies and key encryption.
 */
export function appSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.DATABASE_URL;
  if (s) return s;
  if (process.env.NODE_ENV === "production") console.warn("[security] AUTH_SECRET is not set - using an insecure development secret");
  return "sportpulse-development-secret";
}

const derive = (purpose: string) => createHash("sha256").update(`${purpose}:${appSecret()}`).digest();

export function hmac(data: string, purpose = "session"): string {
  return createHash("sha256").update(derive(purpose)).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** AES-256-GCM envelope: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derive("api-keys"), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptJson<T>(envelope: string | null | undefined): T | null {
  if (!envelope) return null;
  try {
    const [v, iv, tag, data] = envelope.split(".");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", derive("api-keys"), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = await scrypt(password, Buffer.from(salt, "base64url"), 64);
  const expected = Buffer.from(hash, "base64url");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
