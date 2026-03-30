---
name: iblai-analytics
description: Add analytics dashboard page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-analytics

Add an analytics dashboard page with usage metrics, conversation stats,
and user activity. Supports a simple overview or a full tabbed layout with
Users, Topics, Financial, Transcripts, and Reports.

![Analytics Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-analytics/analytics-page.png)

> **AI Assistant:** Build this component directly using the code and MCP tools
> below. Do NOT use the CLI for this -- you are building this feature yourself
> using the SDK components documented here.
>
> Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
> They ship with their own styling. Keep the components as-is.
>
> When building custom UI around SDK components, use the ibl.ai brand:
> - **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
> - **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
> - **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
> - Use shadcn components for custom UI -- they share the same Tailwind
>   theme and render in ibl.ai brand colors automatically.
>
> You MUST run `/iblai-test` before telling the user the work is ready.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- The following packages are already installed by `iblai add auth`:
  `@iblai/iblai-js`, `@reduxjs/toolkit`, `react-redux`

## Step 1: Use MCP Tools

```
get_component_info("AnalyticsOverview")
```

## Step 2: Create Analytics Page

Create `app/analytics/page.tsx` (or `src/app/analytics/page.tsx` if using `src/` layout):

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AnalyticsOverview,
  ChartFiltersProvider,
} from "@iblai/iblai-js/web-containers";
import type { ChartFilters } from "@iblai/iblai-js/web-containers";
import config from "@/lib/iblai/config";

function resolveTenantKey(raw: string | null): string {
  if (!raw || raw === "[object Object]") return "";
  try {
    const p = JSON.parse(raw);
    if (typeof p === "string") return p;
    if (p?.key) return p.key;
  } catch {}
  return raw;
}

export default function AnalyticsPage() {
  const [tenantKey, setTenantKey] = useState("");
  const [username, setUsername] = useState("");
  const [ready, setReady] = useState(false);

  const handleOutsideFilters = useCallback(
    (_filters: Partial<ChartFilters>) => {},
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("userData");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUsername(parsed.user_nicename ?? parsed.username ?? "");
      }
    } catch {}

    const stored =
      localStorage.getItem("current_tenant") ??
      localStorage.getItem("tenant");
    setTenantKey(resolveTenantKey(stored) || config.mainTenantKey());
    setReady(true);
  }, []);

  if (!ready || !tenantKey) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-auto">
      <ChartFiltersProvider setOutsideFilters={handleOutsideFilters}>
        <AnalyticsOverview tenantKey={tenantKey} mentorId="" />
      </ChartFiltersProvider>
    </div>
  );
}
```

## `<AnalyticsOverview>` Props

| Prop | Type | Description |
|------|------|-------------|
| `tenantKey` | `string` | Tenant/org key |
| `mentorId` | `string` | Mentor UUID. Pass `""` for org-wide analytics. |
| `selectedMentorId` | `string?` | Filter analytics to a specific mentor |
| `usergroupIds` | `string[]?` | Filter analytics to specific user groups |

## `<ChartFiltersProvider>` (Required Wrapper)

All analytics components must be wrapped in `ChartFiltersProvider` -- it provides
time-range filter state to all charts via context.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Analytics components to wrap |
| `setOutsideFilters` | `(next: Partial<ChartFilters>) => void` | Required callback. Use a no-op `useCallback(() => {}, [])` if you don't need external filter sync. |

## Advanced: Full Tabbed Layout

For the full multi-tab experience (Overview, Users, Topics, Financial,
Transcripts, Reports), create a layout with sub-routes using `AnalyticsLayout`:

```tsx
import { AnalyticsLayout } from "@iblai/iblai-js/web-containers";

<AnalyticsLayout
  currentPath={pathname}
  basePath="/analytics"
  onTabChange={(tabValue) =>
    router.push(tabValue ? `/analytics/${tabValue}` : "/analytics")
  }
  excludeTabs={["courses", "programs"]}
>
  {children}
</AnalyticsLayout>
```

Then create sub-pages (`analytics/users/page.tsx`, `analytics/topics/page.tsx`,
etc.) using `AnalyticsUsersStats`, `AnalyticsTopicsStats`,
`AnalyticsFinancialStats`, `AnalyticsTranscriptsStats`, `AnalyticsReports` --
each wrapped in `ChartFiltersProvider`.

## Step 3: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. Start dev server and touch test:
   ```bash
   npm run dev &
   npx playwright screenshot http://localhost:3000/analytics /tmp/analytics.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- analytics components are framework-agnostic
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **`mentorId` empty string**: For org-wide analytics pass `""` not `undefined`
- **Config import**: Use `@/lib/iblai/config` (generated by `iblai add auth`)
