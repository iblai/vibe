import { NextRequest, NextResponse } from "next/server";
// Relative imports (not @/): __tests__ invoke route handlers under vitest.
import config from "../../../../lib/iblai/config";
import {
  isResponse,
  jsonBody,
  platformFailure,
  platformFetch,
  requireAdmin,
} from "../../../../lib/iblai/platform";

/**
 * Pattern for any admin-only server call to the platform:
 *   1. who is calling, and are they an org admin (the browser forwards its
 *      session token as `Authorization: Token …`);
 *   2. validate the body;
 *   3. call the platform with the org's Api-Token;
 *   4. return the platform's answer; map its errors.
 *
 * This example reads another user's metadata (the SDK hook cannot — only the
 * signed-in user's own). Replace the path and body for your case; the shape
 * stays.
 */
export async function GET(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (isResponse(caller)) return caller;

  const target = req.nextUrl.searchParams.get("username") ?? "";
  if (!target) return NextResponse.json({ error: "username is required" }, { status: 400 });

  try {
    const q = new URLSearchParams({ platform_key: config.mainTenantKey(), username: target });
    const data = await platformFetch(`/dm/api/core/users/platform-metadata/?${q}`);
    return NextResponse.json(data);
  } catch (e) {
    return platformFailure(e);
  }
}

export async function PATCH(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (isResponse(caller)) return caller;

  const { username, metadata, delete_keys } = await jsonBody(req);
  if (typeof username !== "string" || !username)
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  if ((metadata && typeof metadata !== "object") || (delete_keys && !Array.isArray(delete_keys)))
    return NextResponse.json({ error: "metadata must be an object; delete_keys an array" }, { status: 400 });

  try {
    const q = new URLSearchParams({ platform_key: config.mainTenantKey(), username });
    const data = await platformFetch(`/dm/api/core/users/platform-metadata/?${q}`, {
      method: "PATCH",
      body: { metadata: metadata ?? {}, delete_keys: delete_keys ?? [] },
    });
    return NextResponse.json(data);
  } catch (e) {
    return platformFailure(e);
  }
}
