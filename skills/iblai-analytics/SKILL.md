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

> **AI Assistant:**
> Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
> They ship with their own styling. Keep the components as-is.
> Do NOT implement dark mode unless the user explicitly asks for it.
>
> When building custom UI around SDK components, use the ibl.ai brand:
> - **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
> - **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
> - **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
> - Use shadcn components for custom UI -- they share the same Tailwind
>   theme and render in ibl.ai brand colors automatically.
>
> You MUST run `/iblai-test` before telling the user the work is ready.
>
> `iblai.env` is NOT a `.env.local` replacement — it only holds the 3
> shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
> its runtime env vars from `.env.local`.
>
> Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
> is not installed. The generated app should live in the current directory,
> not in a subdirectory.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`

## Step 0: Check for CLI Updates

> **AI Assistant:** Before running any `iblai` command, ensure the CLI is
> up to date. Run `iblai --version` to check the current version, then
> upgrade directly:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
>
> This is safe to run even if already at the latest version.

## Step 1: Check Environment

> **AI Assistant:** Before proceeding, check for a `iblai.env`
> in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
> If the file does not exist or is missing these variables, tell the user:
> "You need an `iblai.env` with your platform configuration. Download the
> template and fill in your values:
> `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Run the Generator

```bash
iblai add analytics
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/analytics/page.tsx` | Analytics dashboard page with `AnalyticsOverview` |

The page reads `tenant`/`current_tenant` from localStorage and renders
the analytics overview for the current tenant.

## Step 3: Use MCP Tools for Customization

```
get_component_info("AnalyticsOverview")
```

## `<AnalyticsOverview>` Props

| Prop | Type | Description |
|------|------|-------------|
| `tenantKey` | `string` | Tenant/org key |
| `mentorId` | `string` | Mentor UUID. Pass `""` for org-wide analytics. |
| `selectedMentorId` | `string?` | Filter analytics to a specific mentor |
| `usergroupIds` | `string[]?` | Filter analytics to specific user groups |

## Step 4: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/analytics /tmp/analytics.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- analytics components are framework-agnostic
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **`mentorId` empty string**: For org-wide analytics pass `""` not `undefined`
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
