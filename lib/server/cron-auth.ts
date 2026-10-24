import { safeEqual } from "./secrets";

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is defined.
 * Without a secret the endpoints stay open (zero-config) - set CRON_SECRET in production to lock them down.
 */
export function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), secret);
}
