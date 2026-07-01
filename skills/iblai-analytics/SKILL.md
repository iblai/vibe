---
name: iblai-analytics
description: Add the ibl.ai analytics dashboard to your Next.js app — tabbed layout with Overview, Courses, Programs, Users, Topics, Financial, Transcripts, and Reports pages using the @iblai/iblai-js SDK components. For the REST API behind the components (endpoints, params, RBAC, Data Reports lifecycle), install `iblai/api` and use its companion `/iblai-analytics` skill.
globs:
alwaysApply: false
---

# /iblai-analytics

Add an analytics dashboard with a tabbed layout (`AnalyticsLayout`):
Overview, Courses, Programs, Users, Topics, Financial, Transcripts,
Reports. Each tab is a Next.js route under `/analytics/`.

![Analytics Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-analytics/analytics-page.png)

> **Template:** the page this skill creates is bundled as
> [`assets/analytics-page.tsx.j2`](assets/analytics-page.tsx.j2). See
> [`/iblai-scaffold`](../iblai-scaffold/SKILL.md) for the `{{ }}` contract.

Do NOT add custom styles to ibl.ai SDK components. Do NOT implement dark
mode unless asked. Follow the component hierarchy: ibl.ai SDK
(`@iblai/iblai-js`) first, then shadcn/ui (`npx shadcn@latest add`).

## Prerequisites

- Auth set up (`/iblai-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- **API companion (recommended):** `npx skills add iblai/api`. Installs
  the `/iblai-analytics` REST reference and a filtered snapshot of the
  live OpenAPI schema. This skill (frontend wiring) and that one (API
  contract) stay in lockstep.

## Create the Page

Render [`assets/analytics-page.tsx.j2`](assets/analytics-page.tsx.j2) into
`app/(app)/analytics/page.tsx` (overview only). You create the layout and
sub-pages manually (below).

## Layout

Wrap pages with `AnalyticsLayout` + `AnalyticsSettingsProvider`. The
SDK layout uses `bg-[#f5f7fb]` internally — wrap it in a white card so
it pops against the page background.

```tsx
// app/(app)/analytics/layout.tsx
"use client";

import { AnalyticsLayout, AnalyticsSettingsProvider } from "@iblai/iblai-js/web-containers";
import { usePathname, useRouter } from "next/navigation";

export default function AnalyticsLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = "/analytics";

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
        <AnalyticsSettingsProvider value={{}}>
          <AnalyticsLayout
            currentPath={pathname}
            basePath={basePath}
            onTabChange={(tab) => router.push(tab ? `${basePath}/${tab}` : basePath)}
          >
            {children}
          </AnalyticsLayout>
        </AnalyticsSettingsProvider>
      </div>
    </div>
  );
}
```

## Sub-pages

All components import from `@iblai/iblai-js/web-containers`. Pattern:

```tsx
"use client";
import { useEffect, useState } from "react";
import { AnalyticsCourses } from "@iblai/iblai-js/web-containers";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function CoursesPage() {
  const [tenantKey, setTenantKey] = useState("");
  useEffect(() => { setTenantKey(resolveAppTenant()); }, []);
  if (!tenantKey) return null;
  return <AnalyticsCourses tenantKey={tenantKey} mentorId="" basePath="/analytics" />;
}
```

| Route | Component | `basePath`? |
|-------|-----------|-------------|
| `/analytics` | `AnalyticsOverview` | — |
| `/analytics/courses` | `AnalyticsCourses` | ✓ |
| `/analytics/programs` | `AnalyticsPrograms` | ✓ |
| `/analytics/users` | `AnalyticsUsersStats` | — |
| `/analytics/topics` | `AnalyticsTopicsStats` | — |
| `/analytics/financial` | `AnalyticsFinancialStats` | — (does NOT accept `basePath`) |
| `/analytics/transcripts` | `AnalyticsTranscriptsStats` | — |
| `/analytics/reports` | `AnalyticsReports` | — |

All accept `tenantKey` (required) and `mentorId=""` (`""` = org-wide,
not `undefined`). Use MCP for full props:
`get_component_info("AnalyticsOverview")`, etc.

## Verify

```bash
pnpm build && pnpm test
pnpm dev &
npx playwright screenshot http://localhost:3000/analytics /tmp/analytics.png
```

## Notes

- Redux store must include `mentorReducer` and `mentorMiddleware`.
- `initializeDataLayer()` takes 5 args (data-layer v1.2+).
- `@reduxjs/toolkit` deduped via webpack aliases in `next.config.ts`.
- To override the SDK gray background to white, in `globals.css`:
  `.bg-\[\#f5f7fb\] { background-color: #fff !important; }`

---

# Analytics REST API — see `/iblai-analytics` in `iblai/api`

Every analytics endpoint and Data Report — URLs, required params, RBAC
role names, response shapes — lives in the companion skill
[`/iblai-analytics`](https://github.com/iblai/api/tree/main/skills/iblai-analytics)
in the [`iblai/api`](https://github.com/iblai/api) repo. Install once
and it stays in sync with the backend:

```bash
npx skills add iblai/api
```

Then `/iblai-analytics` covers auth, the schema-first workflow, the
analyst-shaped endpoint groupings (Overview / Costs / Users & engagement
/ Topics & conversations / Transcripts / Sessions & ratings / Course /
Program / Pathway & skill / Per-learner / Time-on-platform), the async
Data Reports lifecycle, and a local snapshot of the live OpenAPI schema
at `references/analytics-schema.json`.

> **The OpenAPI schema is the contract.** Live at
> <https://api.iblai.app/dm/api/docs/schema/?format=json> (browsable at
> <https://api.iblai.app/dm/api/docs/>). Consult it before writing any
> analytics request. The `iblai/api` skill's `references/schema.md`
> gives the fetch + drift-check routine.

## In this app (frontend wiring)

- **Auth header:** `Authorization: Token <token>`. The SDK attaches
  this automatically via `SERVICES.DM`.
- **Anchor:** `{dm_url}` = `https://api.iblai.app/dm` throughout the
  companion `/iblai-analytics` skill. Endpoints there are written
  `{dm_url}/api/analytics/…` and `{dm_url}/api/reports/…`. In
  TypeScript, `dmUrl` is the first arg passed to
  `initializeDataLayer()` (sourced from `NEXT_PUBLIC_API_BASE_URL`),
  so `` `${dmUrl}/api/analytics/…` `` composes the request URL.
- **Prefer SDK RTK Query hooks** over hand-rolled `fetch`. Use
  `get_api_query_info("<hookName>")` in MCP to find the relevant hook
  before writing custom UI.
