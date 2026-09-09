import { NextRequest, NextResponse } from "next/server";
// Relative import (not @/): __tests__ invoke this handler under vitest, which
// resolves no path alias.
import { PAYWALL_APP_SLUG, dmPaywallFetch, userFromRequest } from "../../../../lib/paywall";

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "Not a platform member" }, { status: 401 });
  if (!PAYWALL_APP_SLUG)
    return NextResponse.json({ error: "PAYWALL_APP_SLUG not set" }, { status: 500 });

  const qs = new URLSearchParams({ app: PAYWALL_APP_SLUG });
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (sessionId) qs.set("session_id", sessionId);

  const res = await dmPaywallFetch(user.username, `/paywall/access/?${qs}`);
  return NextResponse.json(await res.json(), { status: res.status }); // DM JSON verbatim
}
