import { hmac, safeEqual } from "./secrets";

export const MAX_AGE_S = 60 * 60 * 24 * 30;

export function signSession(userId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + MAX_AGE_S;
  const body = `${userId}.${exp}`;
  return `${body}.${hmac(body)}`;
}

export function verifySession(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!safeEqual(sig, hmac(`${userId}.${exp}`))) return null;
  if (Number(exp) * 1000 < now) return null;
  return userId;
}

