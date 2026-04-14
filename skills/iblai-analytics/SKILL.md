---
name: iblai-analytics
description: Add analytics dashboard page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-analytics

Add an analytics dashboard with a tabbed layout. The `AnalyticsLayout`
component provides built-in tab navigation for Overview, Courses, Programs,
Users, Topics, Financial, Transcripts, and Reports. Each tab is a separate
Next.js route under `/analytics/`.

![Analytics Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-analytics/analytics-page.png)

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is
up to date. Run `iblai --version` to check the current version, then
upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Check Environment

Before proceeding, check for a `iblai.env`
in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
If the file does not exist or is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Run the Generator

```bash
iblai add analytics
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/analytics/page.tsx` | Analytics overview page with `AnalyticsOverview` |

The generator creates only the overview page. You must create the tabbed
layout and sub-pages manually.

## Step 3: Create the Tabbed Layout

Use `AnalyticsLayout` + `AnalyticsSettingsProvider` in a shared layout to
get built-in tab navigation. The layout routes tab changes to Next.js pages.

### Reference implementation -- layout

```tsx
// app/(app)/analytics/layout.tsx
"use client";

import type React from "react";
import { AnalyticsLayout, AnalyticsSettingsProvider } from "@iblai/iblai-js/web-containers";
import { usePathname, useRouter } from "next/navigation";

export default function AnalyticsLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const basePath = "/analytics";

  const handleTabChange = (tabValue: string) => {
    const newPath = tabValue ? `${basePath}/${tabValue}` : basePath;
    router.push(newPath);
  };

  return (
    <div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
      <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
        <AnalyticsSettingsProvider value={{}}>
          <AnalyticsLayout
            currentPath={pathname}
            basePath={basePath}
            onTabChange={handleTabChange}
          >
            {children}
          </AnalyticsLayout>
        </AnalyticsSettingsProvider>
      </div>
    </div>
  );
}
```

### Key patterns

- **White container wrapper**: The SDK AnalyticsLayout uses `bg-[#f5f7fb]`
  internally. Wrap it in a `bg-white rounded-lg border` container so it
  renders as a card against the gray page background.
- **`AnalyticsSettingsProvider`**: Required context wrapper. Pass `value={{}}`
  for defaults.
- **Tab routing**: `onTabChange` receives the tab value (e.g., `"courses"`).
  Map it to `router.push("/analytics/courses")`.

## Step 4: Create Sub-Pages

Each tab maps to a Next.js page under `app/(app)/analytics/`. All analytics
components are imported from `@iblai/iblai-js/web-containers`.

### Sub-page template

Every sub-page follows the same pattern:

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

### Required sub-pages

| Route | Component | Props |
|-------|-----------|-------|
| `/analytics` | `AnalyticsOverview` | `tenantKey`, `mentorId=""` |
| `/analytics/courses` | `AnalyticsCourses` | `tenantKey`, `mentorId=""`, `basePath="/analytics"` |
| `/analytics/programs` | `AnalyticsPrograms` | `tenantKey`, `mentorId=""`, `basePath="/analytics"` |
| `/analytics/users` | `AnalyticsUsersStats` | `tenantKey`, `mentorId=""` |
| `/analytics/topics` | `AnalyticsTopicsStats` | `tenantKey`, `mentorId=""` |
| `/analytics/financial` | `AnalyticsFinancialStats` | `tenantKey`, `mentorId=""` |
| `/analytics/transcripts` | `AnalyticsTranscriptsStats` | `tenantKey`, `mentorId=""` |
| `/analytics/reports` | `AnalyticsReports` | `tenantKey`, `mentorId=""` |

> **Note**: `AnalyticsFinancialStats` does NOT accept a `basePath` prop.
> All other sub-page components do.

## Step 5: Use MCP Tools for Customization

```
get_component_info("AnalyticsOverview")
get_component_info("AnalyticsLayout")
```

## `<AnalyticsLayout>` Props

| Prop | Type | Description |
|------|------|-------------|
| `currentPath` | `string` | Current pathname (from `usePathname()`) |
| `basePath` | `string` | Base path for analytics routes (e.g., `/analytics`) |
| `onTabChange` | `(tabValue: string) => void` | Called when user clicks a tab |
| `children` | `ReactNode` | The active sub-page content |

## `<AnalyticsOverview>` Props

| Prop | Type | Description |
|------|------|-------------|
| `tenantKey` | `string` | Tenant/org key |
| `mentorId` | `string` | Mentor UUID. Pass `""` for org-wide analytics. |
| `selectedMentorId` | `string?` | Filter analytics to a specific mentor |
| `usergroupIds` | `string[]?` | Filter analytics to specific user groups |

## Step 6: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/analytics /tmp/analytics.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- all analytics components are framework-agnostic
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **`mentorId` empty string**: For org-wide analytics pass `""` not `undefined`
- **SDK hardcoded styles**: The SDK AnalyticsLayout uses `bg-[#f5f7fb]`
  internally for its background and tab list. If you need to override this
  to white, add to `globals.css`:
  ```css
  .bg-\[\#f5f7fb\] {
    background-color: #ffffff !important;
  }
  ```
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
