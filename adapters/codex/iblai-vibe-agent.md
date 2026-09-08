# iblai-vibe-agent

> Family index for configuring one ibl.ai agent from your app — the AgentSettingsProvider layout every tab needs, the suggested route layout, and the map of all 24 agent settings tabs (settings, prompts, LLM, datasets, memory, tools, access, API, billing, embed, evals, grader, history, LTI, MCP, privacy, safety, sandbox, skills, support, tasks, voice, audit, disclaimers) with the skill that mounts each. Use when the user wants to edit, configure, or manage an agent, or asks which agent tab does what. For creating an agent see /iblai-vibe-agent-create; for chatting see /iblai-vibe-agent-chat; for browsing agents see /iblai-vibe-agent-search.

# /iblai-vibe-agent

Everything about **configuring an agent** lives behind one provider and one
route layout. Set the provider up once (§1), then mount only the tabs your app
needs (§2). Most apps need five or six; the rest are there when asked for.

![Settings tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-agent-setting/iblai-vibe-agent-setting.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth in place (`/iblai-vibe-auth`, or vibe-starter).
- A real agent UUID — the last path segment of `https://os.ibl.ai/platform/<org-key>/<agent-uuid>`, or one created with `/iblai-vibe-agent-create`. **Never invent one.**
- The signed-in user must be the agent's owner, an org admin, or hold an editor role on it (`/iblai-vibe-agent-access`); otherwise tabs render "no access".

## 1. The provider (once)

```tsx
// app/(app)/agents/[mentorId]/layout.tsx
"use client";

import { AgentSettingsProvider } from "@iblai/iblai-js/web-containers/next";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { mentorId } = useParams<{ mentorId: string }>();
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) setUsername(JSON.parse(raw).user_nicename ?? "");
    } catch {}
    setTenantKey(resolveAppTenant());
  }, []);

  if (!tenantKey || !username) return null;

  return (
    <AgentSettingsProvider tenantKey={tenantKey} mentorId={mentorId} username={username} enableRBAC={false}>
      {children}
    </AgentSettingsProvider>
  );
}
```

Suggested routes: `app/(app)/agents/[mentorId]/<tab>/page.tsx`, one per tab,
with a small tab strip (shadcn `Tabs` or plain links) in the layout. Each tab
component reads the agent from context — no props needed for the basics.

## 2. The tabs

Start with the **core six** (bold). Add the others only when the user asks.

| Tab | What it does | Skill | REST (`iblai/api`) |
|---|---|---|---|
| **Settings** | name, description, avatar, category, visibility; copy to another org; delete | `/iblai-vibe-agent-setting` | [agent-setting](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-setting/SKILL.md) |
| **Prompts** | system prompt, proactive/study/guided prompts, suggested prompts | `/iblai-vibe-agent-prompt` | [agent-prompt](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-prompt/SKILL.md) |
| **LLM** | provider + model selection (incl. the org's own keys) | `/iblai-vibe-agent-llm` | [agent-llm](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-llm/SKILL.md) |
| **Datasets** | RAG: files, URLs, YouTube, crawl, GitHub; train/retrain | `/iblai-vibe-agent-dataset` | [agent-dataset](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-dataset/SKILL.md) |
| **Memory** | enable memory; manage memories and categories | `/iblai-vibe-agent-memory` (guide: `/iblai-vibe-memory-guide`) | [agent-memory](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-memory/SKILL.md) |
| **Tools** | enable/disable the agent's tools | `/iblai-vibe-agent-tool` | [agent-tool](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-tool/SKILL.md) |
| Access | RBAC sharing: editor / chat / analytics roles for users and groups | `/iblai-vibe-agent-access` | [agent-access](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-access/SKILL.md) |
| API | API keys for this agent | `/iblai-vibe-agent-api` | [agent-embed](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-embed/SKILL.md) |
| Billing | spend cap for the agent and per user | `/iblai-vibe-agent-billing` | [spend-caps](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-spend-caps/SKILL.md) |
| Embed | embed code, styling, shareable links | `/iblai-vibe-agent-embed` | [agent-embed](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-embed/SKILL.md) |
| Evals | benchmarks, LLM-as-Judge reviews, manual scores, CSV export | `/iblai-vibe-agent-evals` | [agent-eval](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-eval/SKILL.md) |
| Grader | rubric-based grading with overrides | `/iblai-vibe-agent-grader` | — |
| History | conversation history with filters and export | `/iblai-vibe-agent-history` | [agent-history](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-history/SKILL.md) |
| LTI | LTI 1.3 launch, keys, tools, endpoints | `/iblai-vibe-agent-lti` | — |
| MCP | connectors (featured + custom), OAuth | `/iblai-vibe-agent-mcp` | [agent-mcp](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-mcp/SKILL.md) |
| Privacy | PII detection: redact / mask / block | `/iblai-vibe-agent-privacy` | [agent-privacy](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-privacy/SKILL.md) |
| Safety | moderation prompts, flagged content | `/iblai-vibe-agent-safety` | [agent-safety](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-safety/SKILL.md) |
| Sandbox | computing runtime / VM shell / Claw instances | `/iblai-vibe-agent-sandbox` | [agent-sandbox](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-sandbox/SKILL.md) |
| Skills | reusable Agent Skills, per-agent assignment, chat `/` picker | `/iblai-vibe-agent-skills` | [agent-skill](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-skill/SKILL.md) |
| Support | human support ticket inbox | `/iblai-vibe-agent-support` | [agent-support](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-support/SKILL.md) |
| Tasks | scheduled periodic agent tasks with run logs | `/iblai-vibe-agent-task` | — |
| Voice | voice selection and voice-call configuration | `/iblai-vibe-agent-voice` | — |
| Audit | who changed what and when | `/iblai-vibe-agent-audit` | [agent-audit](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-audit/SKILL.md) |
| Disclaimers | user agreement and advisory text | `/iblai-vibe-agent-disclaimer` | [agent-disclaimer](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-disclaimer/SKILL.md) |

Every tab skill has screenshots of the surface it mounts — open the skill before promising the user what they will see.

## 3. Not tabs, but agent-related

| Need | Skill |
|---|---|
| Create an agent from the app | `/iblai-vibe-agent-create` |
| Chat with an agent | `/iblai-vibe-agent-chat` (+ `/iblai-vibe-agent-chat-sidebar`) |
| Browse / star agents | `/iblai-vibe-agent-search` |
| Agent-scoped analytics | `/iblai-vibe-analytics` with `mentor_unique_id` |

## Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:
`pnpm build`, `pnpm test`, then `npx playwright screenshot http://localhost:3000/agents/<uuid>/settings /tmp/agent-settings.png`.