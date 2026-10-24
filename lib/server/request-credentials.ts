import { getUserRecord } from "./session";
import { keysFromAccount, keysFromHeaders, resolveCredentials, type Credentials } from "./credentials";
import { sanitizeUserKeys, type UserKeys } from "@/lib/keys";

/** For API route handlers: browser-supplied headers -> signed-in account keys -> environment. */
export async function credentialsForRequest(req: Request): Promise<Credentials> {
  const user = await getUserRecord();
  return resolveCredentials({ requestKeys: keysFromHeaders(req.headers), accountKeys: keysFromAccount(user) });
}

/** For Server Actions, which cannot carry custom headers: the browser passes its decrypted keys as an argument. */
export async function credentialsForAction(requestKeys?: UserKeys): Promise<Credentials> {
  const user = await getUserRecord();
  return resolveCredentials({ requestKeys: sanitizeUserKeys(requestKeys), accountKeys: keysFromAccount(user) });
}

/** System-only credentials (cron jobs): environment variables only. */
export const systemCredentials = (): Credentials => resolveCredentials();
