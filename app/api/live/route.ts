import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import { credentialsForRequest } from "@/lib/server/request-credentials";
import { getProvider } from "@/lib/sports";
import { liveTicker } from "@/lib/sports/sync";

export const dynamic = "force-dynamic";

/** Live ticker feed polled by the client. Uses the user's / system's live provider, or the offline baseline. */
export async function GET(req: Request) {
  const creds = await credentialsForRequest(req);
  const result = await liveTicker(getRepo(), getProvider(creds.sports));
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
