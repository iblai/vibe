# iblai-vibe-history

> Add the user profile History surface (review and export your own conversations with AI agents — Conversations tab with filters and a two-column transcript preview, and an Exports tab listing generated reports) to your Next.js app

# /iblai-vibe-history

Add the user profile **History** surface -- "Review and export your
conversations with AI agents." A user's own chat history across every
agent, in two tabs: **Conversations** (agent / date-range / sentiment /
topic filters, a two-column conversation list + transcript preview,
per-conversation CSV download, and a filtered **Export**) and
**Exports** (previously generated reports with status, the filters
used, expiry, and a re-download action). Everything rides the
user-scoped `my-chat-history*` endpoints — the backend only serves the
authenticated user's own sessions, so no RBAC is involved and the tab
only renders on the user's own profile.

This is the user-facing counterpart of `/iblai-vibe-agent-history`
(the admin History tab in agent settings, which shows *every* user's
conversations for one agent).

![History — Conversations tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-history/iblai-vibe-history.png)

![Conversations — transcript preview with per-conversation Download](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-history/iblai-vibe-history-conversation.png)

![History — Exports tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-history/iblai-vibe-history-exports.png)

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
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-vibe-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Related History surfaces

- **`/iblai-vibe-agent-history`** — the admin History tab in agent
  settings: one agent, every user's conversations, RBAC-gated. This
  skill is the mirror image: one user, every agent, own data only.
- **`/iblai-vibe-profile`** — the `<Profile>` page hosts this surface
  as its **History** tab; that is also how it is mounted (Step 2).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- No RBAC needed — the `my-chat-history*` endpoints serve only the
  authenticated user's own data, enforced through the `{userId}` path
  segment.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount it (via the Profile page's History tab)

The History surface (`ChatHistoryTab`) is **not exported as a
standalone component** — it ships as the **History** tab inside
`<Profile>`. Mount the profile page and deep-link to the tab:

```tsx
// app/(app)/profile/history/page.tsx
"use client";

import { Profile } from "@iblai/iblai-js/web-containers";

export default function ProfileHistoryPage() {
  return (
    <div className="flex h-full flex-col bg-white">
      <Profile targetTab="chatHistory" /* plus your usual Profile props */ />
    </div>
  );
}
```

See `/iblai-vibe-profile` Step 3 for the full `<Profile>` prop wiring
(tenant, username, etc.) — this skill only adds the
`targetTab="chatHistory"` entry point. The tab is hidden automatically
when the profile is rendered read-only for another user (the endpoints
would refuse it anyway). If you need the surface standalone, build it
from the data-layer hooks listed below; the SDK source paths in the
next section are the reference implementation.

## Step 3: Use MCP Tools for Customization

```
get_component_info("Profile")
get_hook_info("useGetUserChatHistoryQuery")
```

## Component map (web-containers source)

Everything lives under
`packages/web-containers/src/components/profile/chat-history/` in the
SDK. These pieces are internal to the tab (not exported individually)
— listed with paths as the reference for custom builds:

| Component / hook | Path | Role |
|---|---|---|
| `ChatHistoryTab` | `profile/chat-history/chat-history-tab.tsx` | The surface: Conversations / Exports sub-tabs, filters row, two-column list + preview (dialog preview on mobile), per-conversation CSV download |
| `ReportHistory` | `profile/chat-history/report-history.tsx` | The Exports table: state badge (Pending / Processing / Completed / Error / Cancelled / Expired), filters summary, expiry, re-download |
| `useUserChatHistory` | `profile/chat-history/use-user-chat-history.ts` | Filter + pagination + data state (10 per page); exports `buildUserChatHistoryReportBody` mapping the UI filters onto the report POST body |
| `useChatHistoryExport` | `profile/chat-history/use-chat-history-export.ts` | Server-side export flow: POST a report task, poll its status every 3s, then stream the finished file down as a browser save |
| `SearchSelect` | `spend-caps/search-select.tsx` | The shared debounced agent autocomplete used by the "Search Agents" filter (min 2 characters) |

## What each tab renders

### Conversations tab

- **Filters row** — agent autocomplete ("Search Agents"), a
  two-month **Pick a Date Range** calendar, **All Sentiments**
  (values come from the filter endpoint; positive/neutral/negative as
  the fallback), **All Topics** (from the filter endpoint), and an
  **Export** button that generates a server-side report of everything
  matching the current filters.
- **Conversation list** (left) — 10 per page: time-ago, sentiment
  badge (green/gray/red), agent name, title, and a one-line plain-text
  preview of the first AI reply. Markdown is stripped for list rows.
- **Transcript preview** (right) — the selected conversation as
  alternating **You** / agent messages rendered as Markdown, with the
  user's real avatar (edX profile image → Gravatar → initial) and the
  agent's avatar. A **Download** button saves just this conversation
  as a client-side CSV. When the list payload carried only session
  metadata, the full transcript is fetched lazily. On mobile the
  preview opens in a dialog instead of the second column.
- Empty state: "Select a conversation to view details."

### Exports tab

Previously generated reports, newest first: **Status** badge,
**Created** (time-ago), **Filters** summary (agent count or "All
agents", date range or "All time", plus topic/sentiment when set),
**Expires**, and a **Download** button while the report is still
available. In-progress states keep a blue badge until the poll
reaches a terminal state.

## Related Exports

From `@iblai/iblai-js/web-containers`:

- `Profile` — the profile page hosting this surface as its History
  tab (`targetTab="chatHistory"`).

From `@iblai/iblai-js/data-layer` — the RTK Query hooks the surface
uses, for custom UI on the same endpoints:

- List + detail: `useGetUserChatHistoryQuery`,
  `useGetUserChatHistorySessionQuery`
- Filter options: `useGetUserChatHistoryFilterQuery` (the authority
  on which sentiment/topic values the backend filters by — never send
  values it didn't offer)
- Reports: `useCreateUserChatHistoryReportMutation`,
  `useGetUserChatHistoryReportStatusQuery` (poll until a terminal
  state), `useGetUserChatHistoryReportsQuery` (the Exports list),
  `useLazyGetDownloadReportFromURLQuery` (stream the finished file)
- Constants + types: `USER_CHAT_HISTORY_REPORT_ACTIVE_STATES`,
  `UserChatHistorySession`, `UserChatHistoryMessage`,
  `UserChatHistoryReportListItem`, `UserChatHistoryReportState`,
  `CreateUserChatHistoryReportBody`

## Step 4: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/profile/history /tmp/user-history.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **Not standalone (yet)**: `ChatHistoryTab` is internal to the SDK's
  `Profile` component. Reach it with `<Profile targetTab="chatHistory">`;
  for a bare custom page, rebuild from the data-layer hooks using the
  component map above as the reference.
- **Own data only**: the tab is hidden on read-only profile previews
  of other users — the `my-chat-history*` endpoints only serve the
  authenticated caller's own sessions. For cross-user admin views use
  `/iblai-vibe-agent-history` instead.
- **Two export paths**: the filters-row **Export** POSTs a
  server-side report (async task, polled every 3s, listed under
  Exports with an expiry); the preview's **Download** builds a CSV of
  that single conversation client-side — no report involved.
- **Message shape tolerance**: the list endpoint may serialize
  `messages` as a JSON string while the detail endpoint returns a
  proper array — custom consumers should accept both (the SDK
  normalizes them).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)

## User Chat History REST API

For custom UI beyond the tab. All endpoints are prefixed with
`${dmUrl}/api/ai-analytics/orgs/{org}/users/{user_id}/` where `dmUrl`
is `NEXT_PUBLIC_API_BASE_URL`. Auth: `Authorization: Token <token>`.
`{user_id}` must be the authenticated user — the backend serves no one
else's data.

| Method | Path | Purpose |
|---|---|---|
| GET | `my-chat-history/` | List the user's sessions — `page`, `page_size`, plus `mentor_id`, `start_date`, `end_date`, `topic`, `sentiment` filters |
| GET | `my-chat-history/{session_id}/` | One session with its full `messages` transcript |
| GET | `my-chat-history-filter/` | The sentiment/topic values available to filter by |
| POST | `my-chat-history-report/` | Start an export — `{ format: "csv" \| "json", start_date?, end_date?, filters?: { mentor_id?: [..], topic?, sentiment? } }` (`mentor_id` is an array even for one agent) |
| GET | `my-chat-history-report/` | List generated reports (the Exports tab) |
| GET | `my-chat-history-report/{task_id}/` | Poll a report task's state (`pending` / `running` / `accumulating` / `processing` / `storing` → `completed` / `error` / `cancelled` / `expired`) |
| GET | `my-chat-history-report/{task_id}/download/` | Download the finished file (`?format=csv\|json`) |

Reports expire — the Exports tab shows the expiry and the Download
action disappears once a report is no longer available.