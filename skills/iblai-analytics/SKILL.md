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

You MUST run `/iblai-ops-test` before telling the user the work is ready.

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

Run `/iblai-ops-test` before telling the user the work is ready:

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

## Analytics REST API Reference

> **Base URL:** `${dmUrl}/api/ai-analytics/` and `${dmUrl}/api/analytics/`
> **Authentication:** `Authorization: Token YOUR_ACCESS_TOKEN`
> **Live OpenAPI:** <https://api.iblai.app/dm/api/docs/schema/swagger-ui/>

`dmUrl` is the Data Manager base URL — read it from
`NEXT_PUBLIC_API_BASE_URL` in `.env.local` (e.g. `https://api.iblai.app/dm`).
The SDK passes it into `initializeDataLayer()` as the first argument and
reuses it for every analytics call. Prefer the SDK components and RTK Query
hooks over hand-rolled `fetch` — they handle auth, retry, dedupe, and the
two parallel namespaces transparently.

### Two namespaces

The platform exposes analytics under two distinct prefixes:

| Prefix | Tag | Purpose |
|--------|-----|---------|
| `/api/ai-analytics/` | `ai-analytics` | AI/agent analytics — chat history, mentor costs, sentiment, topics, traces, transcripts, plus learner/audience/engagement/performance dashboards |
| `/api/analytics/` | `analytics` | LMS analytics — catalog content, financial, ratings, sessions, time tracking, conversations, messages, topics, users |

Both require `PlatformApiKeyAuthentication` (Bearer token) and most are
scoped to an org via the `{org}` path parameter (the platform/tenant key
from `NEXT_PUBLIC_MAIN_TENANT_KEY`).

### Common query parameters

Most `GET` endpoints accept these query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | `string` (ISO 8601) | Range start. Default: 7 days ago |
| `end_date` | `string` (ISO 8601) | Range end. Default: today |
| `date_filter` | `today` \| `7d` \| `30d` \| `90d` \| `all_time` \| `custom` | Preset range (overrides `start_date`/`end_date` unless `custom`) |
| `granularity` | `hour` \| `day` \| `week` \| `month` | Bucket size for time-series |
| `department_id` | `integer` | Scope to a department (with `department_mode=1`) |
| `include_main_platform` | `boolean` | Include data from the main platform. Default: `true` |
| `mentor_unique_id` | `uuid` | Filter to a specific mentor/agent |
| `usergroup_ids` | `int[]` | Filter to specific user groups |
| `platform_key` | `string` | Filter results by platform/tenant |
| `page`, `page_size` (or `limit`) | `integer` | Pagination — `limit` capped at 100 |
| `format` | `json` | Response format. Default: `json` |

`{user_id}` in `/api/ai-analytics/orgs/{org}/users/{user_id}/...` is the
requesting admin's user id (used for RBAC + audit), not the user being
queried. Pass the user being queried via `filter_user_id`.

### Audience — `/api/ai-analytics/audience/orgs/{org}/`

Active user counts, enrollments, and registered users.

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `active-users/over-time` | Daily active user counts with change vs. previous period |
| `GET` | `active-users/per-course` | Active user counts per course |
| `GET` | `active-users/users` | List of active users |
| `GET` | `enrollments/over-time` | Daily enrollment counts |
| `GET` | `enrollments/per-course` | Enrollment counts per course |
| `GET` | `enrollments/courses/{course_id}/over-time` | Enrollment trend for one course |
| `GET` | `enrollments/courses/{course_id}/users` | Enrolled learners for one course |
| `GET` | `registered-users/` | Registered user count |
| `GET` | `registered-users/over-time` | Registration trend |
| `GET` | `registered-users/per-course` | Registrations per course |

### Engagement — `/api/ai-analytics/engagement/orgs/{org}/`

Activity, course completion, time-on-platform, and video watch metrics.

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `activity` | Activity heatmap |
| `GET` | `course_completion/over-time` | Completion trend |
| `GET` | `course_completion/per-course` | Completion rate per course |
| `GET` | `courses/{course_id}/time/average` | Avg. time-on-course |
| `GET` | `courses/{course_id}/time/detail` | Detailed time breakdown |
| `GET` | `courses/{course_id}/time/over-time` | Time-on-course over time |
| `GET` | `courses/{course_id}/time/users` | Time per learner |
| `GET` | `courses/{course_id}/time/users/{user_id}/detail` | Time detail for one learner |
| `GET` | `courses/{course_id}/time/users/{user_id}/over-time` | Time over time for one learner |
| `GET` | `courses/{course_id}/videos/` | Video stats for course |
| `GET` | `courses/{course_id}/videos/over-time` | Video watch over time |
| `GET` | `courses/{course_id}/videos/summary` | Video summary |
| `GET` | `courses/{course_id}/videos/users` | Video stats per learner |
| `GET` | `time/average-perlearner-percourse` | Avg time per learner per course |
| `GET` | `time/average-with-over-time` | Avg time with trend |
| `GET` | `time/over-time` | Total time over time |
| `GET` | `time/per-course` | Total time per course |
| `GET` | `videos/` | Org-wide video stats |
| `GET` | `videos/over-time` | Video watch trend |

### Overview — `/api/ai-analytics/overview/orgs/{org}/`

Top-level dashboard cards.

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `active-users` | Total active users |
| `GET` | `average-grade` | Average grade across courses |
| `GET` | `courses/completions` | Total completions |
| `GET` | `learners` | Learner count |
| `GET` | `most-active-courses` | Top courses by activity |
| `GET` | `registered-users` | Total registered users |

### Performance — `/api/ai-analytics/performance/orgs/{org}/`

Grading metrics at platform and course level.

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `grading/average` | Avg grade across all courses |
| `GET` | `grading/per-course` | Avg grade per course |
| `GET` | `courses/{course_id}/grading/average` | Avg grade for one course |
| `GET` | `courses/{course_id}/grading/average-with-cutoff` | Avg with passing cutoff |
| `GET` | `courses/{course_id}/grading/detail` | Per-assignment grade detail |
| `GET` | `courses/{course_id}/grading/per-learner` | Grade per learner |
| `GET` | `courses/{course_id}/grading/summary` | Grade summary stats |

### Per-Learner — `/api/ai-analytics/perlearner/orgs/{org}/`

Drill-down analytics for individual learners.

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `learners` | Learner roster with summary stats |
| `GET` | `users` | Same, alternate route |
| `GET` | `users/{user_id}/activity/` | Per-learner activity |
| `GET` | `users/{user_id}/info` | Profile + enrollment info |
| `GET` | `users/{user_id}/last-access` | Last access timestamp |
| `GET` | `users/{user_id}/grades/per-course` | Grades per course |
| `GET` | `users/{user_id}/overview/engagement-index` | Engagement score |
| `GET` | `users/{user_id}/overview/grades/average` | Avg grade |
| `GET` | `users/{user_id}/overview/performance-index` | Performance score |
| `GET` | `users/{user_id}/overview/time/over-time` | Time over time |
| `GET` | `users/{user_id}/videos/over-time` | Video watch trend |
| `GET` | `users/{user_id}/videos/per-course` | Video stats per course |
| `GET` | `users/{user_id}/courses/{course_id}/overview/engagement-index` | Course engagement |
| `GET` | `users/{user_id}/courses/{course_id}/overview/grade` | Course grade |
| `GET` | `users/{user_id}/courses/{course_id}/overview/performance-index` | Course performance |
| `GET` | `users/{user_id}/courses/{course_id}/overview/time/over-time` | Course time trend |
| `GET` | `users/{user_id}/courses/{course_id}/grading/cutoffs` | Grading cutoffs |
| `GET` | `users/{user_id}/courses/{course_id}/grading/detail` | Grade detail |
| `GET` | `users/{user_id}/courses/{course_id}/grading/summary` | Grade summary |
| `GET` | `users/{user_id}/courses/{course_id}/videos` | Course videos |
| `GET` | `users/{user_id}/courses/{course_id}/videos/over-time` | Course video trend |

### AI Mentor / User Insights — `/api/ai-analytics/orgs/{org}/users/{user_id}/`

Chat, mentor, cost, sentiment, topic, and trace analytics. The `{user_id}`
is the requesting admin; queries operate org-wide unless `filter_user_id`
or `mentor` is supplied.

#### Chat history & conversations

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `chat-history/` | Paginated chat messages (filter by date, mentor, sentiment, topics, filter_user_id) |
| `POST` | `chat-history/` | Create a chat history record |
| `GET` | `chat-history-filter/` | Available filter values |
| `GET` | `chat-history/{id}/` | Single message |
| `PUT` `PATCH` `DELETE` | `chat-history/{id}/` | Update / delete a message |
| `GET` | `conversation/` | Conversation list |
| `GET` | `conversation-summary/` | Summary stats |
| `GET` | `my-chat-history/` | Caller's own chat history |
| `GET` | `my-chat-history/{id}/` | Single record |
| `GET` | `my-chat-history-filter/` | Filter values |
| `GET` `POST` | `my-chat-history-report/` | List / create export task |
| `GET` | `my-chat-history-report/{task_id}/` | Task status |
| `GET` | `my-chat-history-report/{task_id}/download/` | Download exported file |

#### Mentors

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `mentor-detail/` | Detailed mentor stats |
| `GET` | `mentor-summary/` | Mentor summary |
| `GET` | `total-users-by-mentor/` | User count per mentor |
| `GET` | `mentors/{mentor_unique_id}/cost/` | Cost for one mentor |

#### Costs

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `costs/model/` | Cost grouped by model |
| `GET` | `costs/permentor/` | Cost grouped by mentor |
| `GET` | `costs/peruser/` | Cost grouped by user |
| `GET` | `tenant-cost/` | Tenant-level total |
| `GET` | `user-cost/` | Per-user cost |

#### Topics, sentiment, ratings, feedback

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `most-discussed-topics/` | Top topics by message count |
| `GET` | `topic-overview/` | Topic distribution |
| `GET` | `topic-statistics/` | Per-topic stats |
| `GET` | `topics/summary/` | Topic summary list |
| `GET` | `sentiment-count/` | Sentiment distribution |
| `GET` | `user-sentiment/` | Per-user sentiment |
| `GET` | `rating-summary/` | Rating breakdown |
| `GET` | `user-feedback/` | Feedback messages |

#### Usage, observations, traces, transcripts

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `average-messages-per-session/` | Avg messages per session |
| `GET` | `usage-summary/` | Usage stats |
| `GET` | `overview-summary/` | Top-level summary |
| `GET` | `top-students-by-chat-messages/` | Top users by message count |
| `GET` | `user-cohorts-over-time/` | Cohort retention |
| `GET` | `user-metrics/` | User metrics |
| `GET` | `user-metrics-pie-chart/` | User metrics for pie chart |
| `GET` | `registered-users-trend/` | Registration trend |
| `GET` | `observations/` | Observations list |
| `GET` | `observations/{id}/` | Single observation |
| `GET` | `traces/` | LLM traces (debugging) |
| `GET` | `traces/{id}/` | Single trace |
| `GET` | `transcripts/` | Conversation transcripts |

### Costs / Departments / User Groups

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/ai-analytics/costs/pertenant/` | Cost grouped by tenant |
| `GET` | `/api/ai-analytics/departments/orgs/{org}/` | Departments for an org |
| `GET` | `/api/ai-analytics/user-groups/orgs/{org}/` | User groups for an org |

### LMS Analytics — `/api/analytics/`

Catalog, financial, and session analytics. These accept
`date_filter`, `granularity`, `metric`, `mentor_unique_id`, `platform_key`,
`usergroup_ids`, and pagination (`page`, `limit` ≤ 100).

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `content/` | Aggregate analytics for catalog content (`metric=course\|program\|pathway\|skill`) |
| `GET` | `content/details/{content_id}/` | Per-item content detail |
| `GET` | `conversations/` | Conversation analytics |
| `GET` | `financial/` | Financial summary |
| `GET` | `financial/details/` | Financial line items |
| `GET` | `financial/invoice/` | Invoice data |
| `GET` | `learners/` | Learner stats |
| `GET` | `learners/list/` | Paginated learner list |
| `GET` | `learner/details` | Per-learner detail |
| `GET` | `messages/` | Message volume |
| `GET` | `messages/details/` | Message detail |
| `POST` | `orgs/{org}/time/update/` | Push time-on-platform updates |
| `GET` | `ratings/` | Rating analytics |
| `GET` | `sessions/` | Session analytics |
| `GET` | `time/` | Time-on-platform |
| `GET` | `time-spent/user/` | Caller's total time spent |
| `GET` | `topics/` | Topic analytics |
| `GET` | `topics/details/` | Topic detail |
| `GET` | `users/` | User analytics |
| `GET` | `users/details/` | User detail |

### Quick example

```bash
# Active users over the last 30 days for org "main"
curl "${dmUrl}/api/ai-analytics/audience/orgs/main/active-users/over-time?date_filter=30d" \
  -H "Authorization: Token ${TOKEN}"

# Catalog content analytics for courses
curl "${dmUrl}/api/analytics/content/?metric=courses&date_filter=7d&include_overtime=true" \
  -H "Authorization: Token ${TOKEN}"
```

### RBAC

Most endpoints require one of:
- `Ibl.Analytics/Core/read` — analytics viewer
- `Ibl.*` — tenant admin

Per-learner and chat-history endpoints also require platform admin role.

### SDK usage

Don't call these endpoints directly when an SDK component or RTK Query hook
exists. The dashboard components in `@iblai/iblai-js/web-containers`
(`AnalyticsOverview`, `AnalyticsCourses`, `AnalyticsPrograms`,
`AnalyticsUsersStats`, `AnalyticsTopicsStats`, `AnalyticsFinancialStats`,
`AnalyticsTranscriptsStats`, `AnalyticsReports`) wire these endpoints to
charts and tables for you. Use `get_component_info("<Name>")` and
`get_api_query_info("<hookName>")` via MCP to discover the relevant hook
before writing custom UI.
