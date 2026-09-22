# iblai-vibe-analytics

> Add the analytics dashboard (Overview, Users, Courses, Programs, Topics, Transcripts, Memory, Cost, Audit, Data Reports) to your Next.js app — org-wide with an agent picker and groups filter, or scoped to one agent. Use when the user mentions analytics, usage, costs, LLM spend, traces, transcripts, memory insights, or audit logs. For the REST endpoints see /iblai-api-analytics; for the agent Audit tab alone see /iblai-vibe-agent-audit.

# /iblai-vibe-analytics

> **First time here?** If `iblai.env` has no `ARCHITECTURE=`, run `/iblai-vibe-start` first (four questions; two minutes) — it decides single-org / multi-org / headless and who signs in, and every skill reads the answer.

**Scope: per organization**, optionally narrowed to **one agent** and to
**user groups**. One `AnalyticsLayout` renders the tab strip (Overview ·
Users · Courses · Programs · Topics · Transcripts · Memory · Cost · Audit,
with Data Reports on the right), plus a single control bar: agent picker,
groups filter, and a Today / 7D / 30D / 90D / Custom range that every chart
follows. Each tab is a Next.js route under `basePath`.

![Analytics — Overview](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-1-overview.png)

> **Template:** the Overview page is bundled as
> [`assets/analytics-page.tsx.j2`](assets/analytics-page.tsx.j2). See
> [`/iblai-vibe-scaffold`](../../start/iblai-vibe-scaffold/SKILL.md) for the `{{ }}` contract.

Do NOT add custom styles to ibl.ai SDK components. Do NOT implement dark
mode unless asked. Follow the component hierarchy: ibl.ai SDK
(`@iblai/iblai-js`) first, then shadcn/ui (`npx shadcn@latest add`).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `@iblai/iblai-js` **≥ 2.12 resolving `@iblai/web-containers` ≥ 1.21**
  (the analytics revamp). Check with `pnpm why @iblai/web-containers`. Older
  versions have no Memory tab, agent picker, control bar or Cost sub-tabs, and
  the code below will not typecheck.
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- **API companion (recommended):** `npx skills add iblai/vibe --all`. Installs
  the `/iblai-api-analytics` REST reference and a filtered snapshot of the
  live OpenAPI schema. This skill (frontend wiring) and that one (API
  contract) stay in lockstep.

> **On vibe-starter?** The dashboard already lives at `/admin/analytics`
> (one `AnalyticsPage` switch in `components/admin/analytics-page.tsx`;
> `?agent=<uuid>` scopes it). Two things to fix:
>
> 1. Its `pnpm-workspace.yaml` pins `@iblai/web-containers` to `1.16.0`
>    (an old workaround). That pin predates the revamp, so delete the
>    `overrides:` entry (data-layer ≥ 1.14.1 ships the exports it worked
>    around), then run `pnpm install`.
> 2. It only has Overview, Users, Topics, Transcripts, Financial and Reports
>    routes, but the SDK strip also lists Courses, Programs, Audit and
>    Memory, so those tabs 404. Add the `memory` and `audit` routes below,
>    and pass `excludeTabs={["courses", "programs"]}` to its layout.
>
> Read `/analytics` as `/admin/analytics` throughout.

## Layout

`app/(app)/analytics/layout.tsx` owns everything shared: tabs, picker,
groups filter, date range, and the tab guard for watchers. The SDK layout
paints `bg-[#f5f7fb]`, so wrap it in a white card.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AnalyticsLayout,
  AnalyticsSettingsProvider,
  GroupsFilterDropdown,
  type GroupOption,
} from "@iblai/iblai-js/web-containers";
import {
  useGetMemsearchStatusQuery,
  usePlatformUserGroupsQuery,
} from "@iblai/iblai-js/data-layer";
import { getUserName } from "@iblai/iblai-js/web-utils";
import { resolveAppTenant } from "@/lib/iblai/tenant";

const basePath = "/analytics";
// Course/program analytics need the ibl.ai catalog — drop them in agent-only apps.
const CATALOG_TABS = ["courses", "programs"];

export default function AnalyticsLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? basePath;
  const router = useRouter();
  const [tenantKey, setTenantKey] = useState("");
  const [userId, setUserId] = useState("");
  const [groupIds, setGroupIds] = useState<number[]>([]);

  useEffect(() => {
    setTenantKey(resolveAppTenant());
    setUserId(getUserName() ?? "");
  }, []);

  // Groups the viewer may filter by; Data Reports checks a different action.
  const { data: groupsPage, isLoading: groupsLoading } = usePlatformUserGroupsQuery(
    {
      platformKey: tenantKey,
      requiredAction: pathname.startsWith(`${basePath}/reports`)
        ? "Ibl.Analytics/Reports/read"
        : "Ibl.Analytics/Core/read",
    },
    { skip: !tenantKey },
  );
  const groups = useMemo<GroupOption[]>(
    () =>
      (groupsPage?.results ?? []).flatMap((g: { id: number; name?: string | null }) =>
        g.name ? [{ id: g.id, name: g.name }] : [],
      ),
    [groupsPage],
  );

  // Hide Memory when memsearch is off for the org.
  const { data: memsearch } = useGetMemsearchStatusQuery(
    { org: tenantKey, userId },
    { skip: !tenantKey || !userId },
  );
  const excludeTabs =
    memsearch?.enable_memsearch === false ? [...CATALOG_TABS, "memory"] : CATALOG_TABS;

  const settings = useMemo(
    () => ({ usergroupIds: groupIds.length ? groupIds : undefined }),
    [groupIds],
  );

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-white">
        <AnalyticsSettingsProvider value={settings}>
          <AnalyticsLayout
            currentPath={pathname}
            basePath={basePath}
            onTabChange={(tab) => router.push(tab ? `${basePath}/${tab}` : basePath)}
            excludeTabs={excludeTabs}
            showPicker
            tenantKey={tenantKey}
            beforeDataReports={
              <GroupsFilterDropdown
                groups={groups}
                selectedGroupIds={groupIds}
                onSelectionChange={setGroupIds}
                isLoading={groupsLoading}
                placeholder="Filter by Groups"
              />
            }
          >
            {children}
          </AnalyticsLayout>
        </AnalyticsSettingsProvider>
      </div>
    </div>
  );
}
```

What the layout does for you:

- **Date range:** one shared range (default **30D**). Cards follow it; a card
  changed on its own shows an override chip. Don't add per-page date pickers.
- **Agent picker** (`showPicker`): "All Agents" or one agent, kept in layout
  state (it resets on reload). To keep it in the URL, control it with
  `scopedMentor` + `onScopedMentorChange`.
- **Groups filter:** `beforeDataReports` renders into the control bar; the
  selection reaches pages through `AnalyticsSettingsProvider`. Pages must
  pass it on as `usergroupIds` — the tabs don't read the context.
- **Watchers** (non-admins holding `/watchedgroups/#list`) only see Courses,
  Programs, Memory, Transcripts and Data Reports; a deep link to any other
  tab redirects to the first allowed tab that isn't in `excludeTabs`.

## Pages

Render [`assets/analytics-page.tsx.j2`](assets/analytics-page.tsx.j2) into
`app/(app)/analytics/page.tsx` (Overview). Every other tab is a small client
page. Tabs that take the groups filter (Users, Topics, Transcripts) follow
this shape, as in `app/(app)/analytics/users/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AnalyticsUsersStats, useAnalyticsSettings } from "@iblai/iblai-js/web-containers";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function UsersPage() {
  const { usergroupIds } = useAnalyticsSettings();
  const [tenantKey, setTenantKey] = useState("");
  useEffect(() => setTenantKey(resolveAppTenant()), []);
  if (!tenantKey) return null;
  return <AnalyticsUsersStats tenantKey={tenantKey} mentorId="" usergroupIds={usergroupIds} />;
}
```

Memory, Cost and Audit also need the signed-in **username** (`userId`) —
their endpoints are `/orgs/{org}/users/{username}/…` paths. For example,
`app/(app)/analytics/financial/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnalyticsFinancialStats } from "@iblai/iblai-js/web-containers";
import { getUserName } from "@iblai/iblai-js/web-utils";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function CostPage() {
  const router = useRouter();
  const [tenantKey, setTenantKey] = useState("");
  const [userId, setUserId] = useState("");
  useEffect(() => {
    setTenantKey(resolveAppTenant());
    setUserId(getUserName() ?? "");
  }, []);
  if (!tenantKey || !userId) return null;
  return (
    <AnalyticsFinancialStats
      tenantKey={tenantKey}
      mentorId=""
      userId={userId}
      // The trace panel links a session to its transcript; the Transcripts tab reads ?session_id=.
      onOpenTranscript={(sessionId) =>
        router.push(`/analytics/transcripts?session_id=${encodeURIComponent(sessionId)}`)
      }
    />
  );
}
```

`memory/page.tsx` and `audit/page.tsx` have the same shape and render:

```tsx
<AnalyticsMemoryStats tenantKey={tenantKey} mentorId="" userId={userId} />
<AnalyticsAuditLogStats tenantKey={tenantKey} mentorId="" userId={userId} />
```

| Route | Component | Props beyond `tenantKey` + `mentorId=""` |
|-------|-----------|-------------|
| `/analytics` | `AnalyticsOverview` | `usergroupIds`, `onViewAllTopics` (adds "All topics →") |
| `/analytics/users` | `AnalyticsUsersStats` | `usergroupIds` |
| `/analytics/courses` | `AnalyticsCourses` | `basePath="/analytics"` → opens `courses/[courseId]` |
| `/analytics/courses/[courseId]` | `AnalyticsCourseDetail` | `courseId` (from `useParams`), `onBack` |
| `/analytics/programs` | `AnalyticsPrograms` | `basePath="/analytics"` → opens `programs/[programId]` |
| `/analytics/programs/[programId]` | `AnalyticsProgramDetail` | `programId`, `onBack` |
| `/analytics/topics` | `AnalyticsTopicsStats` | `usergroupIds` |
| `/analytics/transcripts` | `AnalyticsTranscriptsStats` | `usergroupIds`; reads `?session_id=` |
| `/analytics/memory` | `AnalyticsMemoryStats` | `userId` (required), `myMemory` (own memories only) |
| `/analytics/financial` (label **Cost**) | `AnalyticsFinancialStats` | `userId`, `onOpenTranscript`. No `basePath`; `usergroupIds` is deprecated and ignored |
| `/analytics/audit` | `AnalyticsAuditLogStats` | `userId` (required), `defaultScope`, `timezone`, `canViewPlatformAudit` |
| `/analytics/reports` | `AnalyticsReports` | **no `mentorId`**: `selectedMentorId=""` (required), `usergroupIds`, `disabledReports` |

Courses/Programs pages only matter if you removed them from `CATALOG_TABS`.
Use MCP for the full props: `get_component_info("AnalyticsMemoryStats")`, etc.

**Agent scope rule.** Every tab resolves its agent as
`selectedMentorId || mentorId || picker`. On org-wide pages pass
`mentorId=""` and **leave `selectedMentorId` unset**, or the picker is
silently ignored. `""` means org-wide; never pass `undefined` for `mentorId`.

## What each tab shows

| Tab | What's in it | Backed by |
|-----|--------------|-----------|
| Overview | Messages, Active Users, Topics, Conversations, **LLM spend** KPIs with sparklines; Sessions chart; top Topics | chat analytics + `llm-usage` (spend card) |
| Users | Logged in now / past 30 days / registered; Active Users; Access Times heatmap; User Details table | `/api/analytics/users/…`, `time/` |
| Topics | Topics / Conversations / Messages KPIs; Conversations over time; Topics Details | `/api/analytics/topics/…`, `conversations/` |
| Transcripts | Avg messages / cost / rating; conversation list + transcript panel | `/api/analytics/messages/…` |
| Memory | Memories per user; scope **Agent / All agents / Global**, agent search, user, content and date filters | `/api/ai-mentor/orgs/{org}/users/{username}/…memories…/` |
| Cost → **Spend** | Weekly / Monthly / Total costs, Cost per Day, Cost by Provider / LLM, Cost per User (→ Traces) | ClickHouse: `/api/ai-analytics/orgs/{org}/users/{username}/{tenant-cost, agents/{id}/cost, costs/model, costs/peruser}/` |
| Cost → **Usage & latency** | LLM spend, Tokens, LLM calls, Latency p95; spend over time by service; spend and p50/p95 latency by model | `/api/analytics/llm-usage/?resource=metrics` |
| Cost → **Traces** | Per-call list (service, user, latency, cost) with a detail panel of observations | `llm-usage` `resource=traces` / `observations` |
| Audit → **Agent** | Agent configuration changes (who, what, when); user, date and action filters | `/api/ai-mentor/orgs/{org}/users/{username}/mentors/audit-logs/` |
| Audit → **Platform** | Org-wide changes and security events (logins, model changes), with IP and a detail sheet | `/api/core/platforms/{org}/audit-logs/` |
| Data Reports | Async CSV/JSON exports (generate → poll → download) | `/api/reports/platforms/{org}/…` |

![Analytics — Users](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-2-users.png)

![Analytics — Topics](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-3-topics.png)

![Analytics — Topics details](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-4-topics-details.png)

![Analytics — Cost → Spend](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-5-cost-spend.png)

![Analytics — Cost → Usage & latency](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-6-cost-usage.png)

![Analytics — Cost → Usage & latency by model](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-vibe-analytics/iblai-vibe-analytics-7-cost-usage-by-model.png)

## Permissions and data caveats

- **Platform audit** shows only to org admins or holders of
  `/auditlogs/#list`. Everyone else gets the Agent trail with no switch.
  Pass `canViewPlatformAudit` if you already resolved it. The API returns
  403 regardless of what the UI shows.
- **Usage & latency / Traces** need org-admin analytics access; other
  users see a permission notice, not an error.
- **Memory** returns 403 → "no permission" card. Watchers only see the
  users they watch.
- **Costs** are platform-marked-up USD — show them as-is. An empty or
  unavailable cost block means the cost store was unreachable, not zero
  spend.
- **Per-agent cost ranking is forward-only:** only calls traced since agent
  tagging shipped carry an agent. The tab shows this notice itself.
- **Date defaults differ server-side:** `llm-usage` defaults to *today*,
  while the other endpoints default to 30 days. The layout pins 30D for
  both; any hand-rolled request must send its own range.

## One agent instead of the org

For analytics on a single agent (e.g.
`app/(app)/agents/[mentorId]/analytics/`), pass the route's `mentorId` to
every tab and **omit `showPicker`**: the page already knows its agent. Also
drop the groups filter, and hide Audit unless the viewer holds
`/mentors/{mentorDbId}/#view_audit_logs` (`/iblai-vibe-rbac`):

```tsx
const basePath = `/agents/${mentorId}/analytics`;

<AnalyticsLayout
  currentPath={pathname}
  basePath={basePath}
  onTabChange={(tab) => router.push(tab ? `${basePath}/${tab}` : basePath)}
  excludeTabs={canViewAuditLogs ? ["courses", "programs"] : ["courses", "programs", "audit"]}
>
  {children}
</AnalyticsLayout>
```

The Audit tab alone is also its own skill: `/iblai-vibe-agent-audit`.

## Verify

```bash
pnpm build && pnpm test
pnpm dev &
npx playwright screenshot http://localhost:3000/analytics /tmp/analytics.png
```

Then click every tab in the strip: none may 404. Switch the agent picker
and the date range, and check that the numbers change.

## Notes

- Redux store must include `mentorReducer` and `mentorMiddleware`.
- `initializeDataLayer()` takes 5 args (data-layer v1.2+).
- `@reduxjs/toolkit` deduped via webpack aliases in `next.config.ts`.
- `AnalyticsControlBar`, `AnalyticsAgentPicker`, `StatCard`,
  `ChartCardWrapper` and the `useLlmUsage` / `useLlmTraces` hooks are
  exported too — use them for a custom analytics page instead of rebuilding
  the pieces.
- To override the SDK gray background to white, in `globals.css`:
  `.bg-\[\#f5f7fb\] { background-color: #fff !important; }`

---

# Analytics REST API — see `/iblai-api-analytics` (headless twin)

Every analytics endpoint and Data Report — URLs, required params, RBAC
role names, response shapes — lives in the companion skill
[`/iblai-api-analytics`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-api-analytics/SKILL.md)
in this repo (kind `api`). It is installed with the rest of the skills
and stays in sync with the backend:

```bash
npx skills add iblai/vibe --all
```

Then `/iblai-api-analytics` covers auth, the schema-first workflow, the
analyst-shaped endpoint groupings (Overview / Costs / Users & engagement
/ Topics & conversations / Transcripts / Sessions & ratings / Course /
Program / Pathway & skill / Per-user / Time-on-platform), the async
Data Reports lifecycle, and a local snapshot of the live OpenAPI schema
at `references/analytics-schema.json`.

> **The OpenAPI schema is the contract.** Live at
> `{dm_url}/api/docs/schema/?format=json` (browsable at `{dm_url}/api/docs/`;
> `{dm_url}` = `https://api.$DOMAIN/dm`, `DOMAIN` from `iblai.env`, default
> `iblai.app`). Consult it before writing any
> analytics request. The `/iblai-api-analytics` skill's `references/schema.md`
> gives the fetch + drift-check routine.

## In this app (frontend wiring)

- **Auth header:** `Authorization: Token <token>`. The SDK attaches
  this automatically via `SERVICES.DM`.
- **Anchor:** `{dm_url}` = `https://api.$DOMAIN/dm` (`DOMAIN` from
  `iblai.env`, default `iblai.app`) throughout the
  companion `/iblai-api-analytics` skill. Endpoints there are written
  `{dm_url}/api/analytics/…` and `{dm_url}/api/reports/…`. In
  TypeScript, `dmUrl` is the first arg passed to
  `initializeDataLayer()` (sourced from `NEXT_PUBLIC_API_BASE_URL`),
  so `` `${dmUrl}/api/analytics/…` `` composes the request URL.
- **Prefer SDK RTK Query hooks** over hand-rolled `fetch`. Use
  `get_api_query_info("<hookName>")` in MCP to find the relevant hook
  before writing custom UI.