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

type AgentSummary = { unique_id: string; name: string; description?: string };

/**
 * Agents for the setup screen — listed and created with the org's authority
 * after the caller proves they are an org admin. There is no SDK component
 * for creation (see /iblai-vibe-agent-create), so this is the pattern.
 */
export async function GET(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (isResponse(caller)) return caller;
  try {
    const org = config.mainTenantKey();
    const data = await platformFetch<{ results?: AgentSummary[] } | AgentSummary[]>(
      `/dm/api/search/orgs/${encodeURIComponent(org)}/users/${encodeURIComponent(caller.username)}/mentors/`,
    );
    const list = Array.isArray(data) ? data : (data?.results ?? []);
    return NextResponse.json({
      agents: list.map((a) => ({ unique_id: a.unique_id, name: a.name, description: a.description ?? "" })),
    });
  } catch (e) {
    return platformFailure(e);
  }
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (isResponse(caller)) return caller;
  const { name, description, system_prompt } = await jsonBody(req);
  if (typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  try {
    const org = config.mainTenantKey();
    const agent = await platformFetch<AgentSummary>(
      `/dm/api/ai-mentor/orgs/${encodeURIComponent(org)}/users/${encodeURIComponent(caller.username)}/mentor-with-settings/`,
      {
        method: "POST",
        body: {
          template_name: "ai-mentor",
          new_mentor_name: name.trim(),
          display_name: name.trim(),
          description: typeof description === "string" ? description : "",
          system_prompt: typeof system_prompt === "string" ? system_prompt : "",
        },
      },
    );
    return NextResponse.json({ unique_id: agent.unique_id, name: agent.name ?? name });
  } catch (e) {
    return platformFailure(e);
  }
}
