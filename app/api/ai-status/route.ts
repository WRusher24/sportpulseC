import { NextResponse } from "next/server";
import { credentialsForRequest } from "@/lib/server/request-credentials";

export const dynamic = "force-dynamic";

/** Which credential source each integration currently resolves to. Never returns key material. */
export async function GET(req: Request) {
  const c = await credentialsForRequest(req);
  return NextResponse.json({ ai: { provider: c.ai.provider, model: c.ai.model, source: c.ai.source }, sports: { provider: c.sports.provider, source: c.sports.source } }, { headers: { "cache-control": "no-store" } });
}
