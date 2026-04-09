---
name: iblai-init
description: Update the project CLAUDE.md with ibl.ai platform guidance
globs:
alwaysApply: false
---

# /iblai-init

Update or create a `CLAUDE.md` in the user's current working directory with
ibl.ai platform guidance. This file tells Claude Code how to work with the
project -- which components to use, how to add features, and what patterns
to follow.

## What This Skill Does

1. Check if `CLAUDE.md` already exists in the project root
2. If it exists, **merge** the ibl.ai section into it (do not overwrite
   existing content)
3. If it does not exist, **create** it with the full ibl.ai guidance below

## Step 1: Check for Existing CLAUDE.md

Read `CLAUDE.md` in the current working directory. If it exists, append the
ibl.ai section below (under a `## ibl.ai Platform` heading) without
duplicating content that's already there. If there's already an ibl.ai
section, replace it with the updated version below.

## Step 2: Write the CLAUDE.md Content

The CLAUDE.md should contain the following content. Adapt the heading level
if merging into an existing file (e.g., use `##` if appending to a file
that already has a top-level `#` heading).

---

### Content to write

```markdown
# CLAUDE.md

This project is built on the ibl.ai platform using the `@iblai/iblai-js` SDK.

## Component Priority

When adding UI features, follow this priority order:

1. **ibl.ai components** (`@iblai/iblai-js`) -- always use these first
2. **shadcn/ui** (`npx shadcn@latest add`) -- for everything else
3. **Custom/third-party** -- only when no ibl.ai or shadcn component exists

### When the user asks to add...

| Feature | Use this | NOT this |
|---------|----------|----------|
| Profile page / dropdown | `/iblai-profile` skill + `Profile`, `UserProfileDropdown` from SDK | Custom profile form |
| Account / org settings | `/iblai-account` skill + `Account` from SDK | Custom settings page |
| Analytics dashboard | `/iblai-analytics` skill + `AnalyticsOverview`, `AnalyticsLayout` from SDK | Chart library from scratch |
| Notifications | `/iblai-notification` skill + `NotificationDropdown` from SDK | Custom notification system |
| Chat / AI assistant | `/iblai-chat` skill + `<mentor-ai>` web component | Custom chat UI |
| Auth / login | `/iblai-auth` skill + `AuthProvider`, `SsoLogin` from SDK | Custom auth flow |
| Invite users | `/iblai-invite` skill + `InviteUserDialog` from SDK | Custom invite form |
| Workflow builder | `/iblai-workflow` skill + workflow components from SDK | Custom node editor |
| Onboarding flow | `/iblai-onboard` skill | Custom onboarding from scratch |
| Buttons, forms, modals, tables | shadcn/ui (`npx shadcn@latest add button dialog table`) | Raw HTML or other UI libraries |
| Page sections / blocks | shadcn/ui blocks (`npx shadcn@latest add @shadcn-space/hero-01`) | Custom layout from scratch |

### Key rule

Do NOT build custom components when an ibl.ai SDK component exists.
Do NOT use raw HTML or third-party UI libraries when shadcn/ui has an equivalent.
ibl.ai and shadcn share the same Tailwind theme -- they render in brand colors automatically.

## SDK Imports

```typescript
// Data layer
import { initializeDataLayer, mentorReducer } from "@iblai/iblai-js/data-layer";

// Auth & utilities
import { AuthProvider, TenantProvider, useChatV2 } from "@iblai/iblai-js/web-utils";

// Framework-agnostic components
import { Profile, AnalyticsLayout, NotificationDropdown } from "@iblai/iblai-js/web-containers";

// Next.js-specific components
import { SsoLogin, UserProfileDropdown, Account } from "@iblai/iblai-js/web-containers/next";
```

## Adding Features

Use skills to add features. Each skill runs the CLI generator and guides
you through the remaining manual steps:

```
/iblai-auth          # SSO authentication (run first)
/iblai-chat          # AI chat widget
/iblai-profile       # Profile dropdown + settings page
/iblai-account       # Account/org settings page
/iblai-analytics     # Analytics dashboard
/iblai-notification  # Notification bell
/iblai-invite        # User invitation dialogs
/iblai-workflow      # Workflow builder
/iblai-onboard       # Onboarding questionnaire flow
/iblai-build         # Desktop/mobile builds (Tauri v2)
/iblai-test          # Test before showing work
/iblai-component     # Browse all available components
```

All features require auth first (`/iblai-auth` or `iblai add auth`).

## Environment

Platform configuration lives in `iblai.env` (3 vars: `DOMAIN`, `PLATFORM`,
`TOKEN`). The CLI derives all `NEXT_PUBLIC_*` env vars into `.env.local`
automatically. Do NOT edit `.env.local` directly for platform config --
update `iblai.env` and re-run a CLI command.

## Brand

- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Style**: shadcn/ui new-york variant, system sans-serif, Lucide icons
- SDK components ship with their own styles -- do NOT override them

## Layout Patterns

- **Page background**: `var(--sidebar-bg, #fafbfc)`
- **SDK wrappers**: Wrap SDK components in `bg-white rounded-lg border border-[var(--border-color)] overflow-hidden`
- **Responsive width**: `w-full px-4` mobile, `md:w-[75vw] md:px-0` desktop
- **Mobile safe area**: `globals.css` must have `padding-top: env(safe-area-inset-top)` (and bottom/left/right) on body, and `app/layout.tsx` metadata must include `viewport: "width=device-width, initial-scale=1, viewport-fit=cover"` -- prevents content from overlapping the iOS notch / Android status bar
- **Package manager**: Use `pnpm` (fall back to `npm`)

## Commands

```bash
pnpm dev             # Dev server
pnpm build           # Production build
iblai config show    # View configuration
iblai add <feature>  # Add a feature
```
```

---

## Step 3: Confirm

After writing the file, tell the user:

> Updated `CLAUDE.md` with ibl.ai platform guidance. Claude Code will now
> prioritize ibl.ai SDK components over custom implementations and use the
> correct skills when adding features.
