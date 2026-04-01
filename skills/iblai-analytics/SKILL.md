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

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`

## Step 0: Check for CLI Updates

> **AI Assistant:** Before running any `iblai` command, check for updates.
> Run `iblai --version` to get the current version, then check the latest:
> - **PyPI:** `curl -sf https://pypi.org/pypi/iblai-app-cli/json | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['version'])"`
> - **npm:** `npm view @iblai/cli version 2>/dev/null`
> - **GitHub (binary installs):** `curl -sf https://api.github.com/repos/iblai/iblai-app-cli/releases/latest | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'].lstrip('v'))"`
>
> If a newer version exists, update:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
> - Binary: download the latest release from `https://github.com/iblai/iblai-app-cli/releases/latest` for the current platform and replace the binary

## Step 1: Run the Generator

```bash
iblai add analytics
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/analytics/page.tsx` | Analytics dashboard page with `AnalyticsOverview` |

The page reads `tenant`/`current_tenant` from localStorage and renders
the analytics overview for the current tenant.

## Step 2: Use MCP Tools for Customization

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

## Step 3: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. `npm run test` -- vitest must pass
3. Start dev server and touch test:
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
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
