import { NextRequest, NextResponse } from "next/server";
// Relative imports (not @/): __tests__ invoke this handler under vitest.
import {
  adminCaller,
  dmConnectFetchAs,
  dmJson,
  failure,
  isResponse,
  jsonBody,
  type DmInit,
} from "../../../../../lib/paywall";

/**
 * Connect with Stripe, relayed: the admin's OWN token goes to the platform's
 * connect endpoint on their own path, and the platform decides who may (403
 * otherwise). GET the status, POST `{return_url}` for Stripe's authorize URL,
 * DELETE to disconnect. Statuses and bodies pass through verbatim (a 409
 * "already connected", a 503 "not available" and a 502 "Stripe unreachable"
 * are the admin's to read), a 204 as a 204.
 */
async function relay(req: NextRequest, init?: DmInit) {
  const caller = await adminCaller(req);
  if (isResponse(caller)) return caller;
  try {
    const res = await dmConnectFetchAs(caller.token, caller.username, init);
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await dmJson(res));
  } catch (e) {
    return failure(e);
  }
}

export async function GET(req: NextRequest) {
  return relay(req);
}

export async function POST(req: NextRequest) {
  const { return_url } = await jsonBody(req);
  return relay(req, { method: "POST", body: JSON.stringify({ return_url }) });
}

export async function DELETE(req: NextRequest) {
  return relay(req, { method: "DELETE" });
}
