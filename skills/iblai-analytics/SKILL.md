---
name: iblai-analytics
description: Add analytics dashboard page to your Next.js app
globs:
alwaysApply: false
---

# /iblai-analytics

Add an analytics dashboard page with tabs for Users, Topics, Financial,
Transcripts, and Reports.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- `iblai` CLI available (`iblai --version`). If not, run `/iblai-install`

## Add Analytics

```bash
iblai add analytics
# or: npx @iblai/cli add analytics
```

```bash
pnpm install
```

## What Was Generated

| File | Purpose |
|------|---------|
| `app/(app)/analytics/page.tsx` | Analytics dashboard using SDK `AnalyticsOverview` component |

## Usage

Accessible at `/analytics`. Shows overview dashboard with usage metrics,
conversation stats, and user activity.

## Quick Embed

To embed the analytics overview in an existing page:

```tsx
import { AnalyticsOverview } from "@iblai/iblai-js/web-containers";

<AnalyticsOverview org={tenantKey} />
```

## Verify

```bash
pnpm dev
```

Log in, then navigate to `/analytics`.

## Detailed Guide

For the complete implementation reference:
https://github.com/iblai/iblai-app-cli/blob/main/skills/components/iblai-add-analytics.md
