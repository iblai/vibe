---
name: iblai-ops-init
description: Start a new ibl.ai project by default, clone vibe-starter, and write the project CLAUDE.md with ibl.ai platform guidance. Use this when the user says "start a new project", "new app", "scaffold an app", "new ibl.ai project", or asks to bootstrap an ibl.ai codebase from scratch. Also use to refresh CLAUDE.md in an existing ibl.ai project.
globs:
alwaysApply: false
---

# /iblai-ops-init

Bootstrap a new ibl.ai project (defaults to cloning vibe-starter) and write
or update the project's `CLAUDE.md` with ibl.ai platform guidance. The
CLAUDE.md tells Claude Code how to work with the project -- which components
to use, how to add features, and what patterns to follow.

## What This Skill Does

1. **If the working directory is empty / a brand-new project:** clone
   vibe-starter (Step 0) before doing anything else
2. Check if `CLAUDE.md` already exists in the project root
3. If it exists, **merge** the ibl.ai section into it (do not overwrite
   existing content)
4. If it does not exist, **create** it with the full ibl.ai guidance below

## Step 0: Offer vibe-starter (new projects)

If the user is starting a new project from scratch (empty directory, no
`package.json`, or they said "new project" / "scaffold" / "new app"),
**ask whether they want to use vibe-starter** -- a pre-wired Next.js 16 +
Tailwind v4 + shadcn/ui template with ibl.ai SSO auth, a responsive navbar,
and profile/account/notifications pages already in place.

### Check the opt-out flag first

Before asking, check `iblai.env` for `USE_VIBE_STARTER`:

```bash
[ -f iblai.env ] && grep -E '^USE_VIBE_STARTER=' iblai.env
```

- If `iblai.env` exists **and** `USE_VIBE_STARTER` is set to a falsy value
  (`false`, `0`, `no`, `off`, empty), **skip vibe-starter and skip the
  question entirely** -- go straight to Step 1 to write CLAUDE.md, then
  resume whatever the user originally asked for. Do NOT scaffold a vanilla
  Next.js app.
- Otherwise, ask the user.

### Ask the user

Ask a clear yes/no question:

> Want to scaffold from **vibe-starter**? It's a pre-wired Next.js 16 +
> Tailwind v4 + shadcn/ui template with ibl.ai SSO auth, a responsive
> navbar, and profile/account/notifications pages already wired up.

- **If they say yes / use it / vibe-starter:** clone vibe-starter (below).
- **If they say no / skip:** go straight to Step 1 to write CLAUDE.md,
  then resume whatever the user originally asked for. Do NOT scaffold a
  vanilla Next.js app or run `iblai startapp` -- the user said skip.

### Clone vibe-starter (only if the user said yes)

```bash
git clone -b spa https://github.com/iblai/vibe-starter.git vibe-starter-init
cp -a vibe-starter-init/. . && rm -rf vibe-starter-init
pnpm install
```

(Clone into a temp directory and copy into the current directory before
installing -- running `pnpm install` inside the cloned subdirectory causes
hardlink issues.)

### Ask for platform credentials and write env files

After the clone completes, ask the user for their ibl.ai platform credentials
**unless `iblai.env` already exists with real values for both `PLATFORM` and
`TOKEN`** (in which case skip these prompts and reuse them).

> What is your ibl.ai **PLATFORM** (tenant key)?

> What is your ibl.ai **TOKEN** (platform API key)?

Then write the values to both files:

1. **`iblai.env`** -- create if missing, or update the `PLATFORM` and `TOKEN`
   lines in place. Keep `DOMAIN=iblai.app` (or whatever the user already
   set). Example contents:

   ```
   DOMAIN=iblai.app
   PLATFORM=<the value the user gave>
   TOKEN=<the value the user gave>
   ```

2. **`.env.local`** -- write directly. Do NOT run `iblai add auth`,
   `iblai config set`, or any other `iblai` CLI command -- the starter
   already has everything wired and re-running the CLI can clobber the
   starter's files. If `.env.local` does not exist yet and the starter
   ships an `.env.example`, copy it first (`cp .env.example .env.local`),
   then update or append both lines (write `TOKEN` as `IBLAI_API_KEY`):

   ```
   NEXT_PUBLIC_MAIN_TENANT_KEY=<PLATFORM>
   IBLAI_API_KEY=<TOKEN>
   ```

Do NOT print or echo the `TOKEN` / `IBLAI_API_KEY` value back to the user
once captured.

After the starter is in place, the user's project already has auth, navbar,
profile, account, and notifications wired. They can skip the matching
`/iblai-auth`, `/iblai-navbar`, `/iblai-profile`, `/iblai-account`, and
`/iblai-notification` skills.

**Skip the offer entirely if:**
- `iblai.env` has `USE_VIBE_STARTER` set to a falsy value (see above)
- The directory already has a `package.json` (existing project) -- in
  that case go straight to Step 1

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

## Starter Template

When the user says "start a new project", "new app",
"scaffold an app", or anything that creates a fresh codebase, **default
to vibe-starter** below. Only fall back to vanilla Next.js + `iblai add`
or `iblai startapp agent` if the user explicitly declines the starter or
asks for a minimal/custom setup.

For brand-new projects, prefer cloning vibe-starter
(https://github.com/iblai/vibe-starter/tree/spa) -- a pre-wired Next.js 16 +
Tailwind v4 + shadcn/ui template with ibl.ai SSO auth, a responsive navbar,
and profile/account/notifications pages already in place. This skips the
manual `/iblai-auth`, `/iblai-navbar`, `/iblai-profile`, `/iblai-account`,
and `/iblai-notification` skills.

Clone into a temp directory and copy into the current directory before
installing (running `pnpm install` inside the cloned subdirectory causes
hardlink issues):

```bash
git clone -b spa https://github.com/iblai/vibe-starter.git vibe-starter-init
cp -a vibe-starter-init/. . && rm -rf vibe-starter-init
pnpm install
```

For existing projects, ignore this and use the individual skills below.

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
| Course content | `/iblai-course-access` skill + `CourseContentLayout`, `CourseContentTabPage` from SDK | Custom course player |
| Create / publish courses | `/iblai-course-create` skill (Course Creation API) | Manually authoring OLX in edX Studio |
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
/iblai-course-access # Course content pages (edX learner UI)
/iblai-course-create # Generate and publish courses via Course Creation API
/iblai-notification  # Notification bell
/iblai-invite        # User invitation dialogs
/iblai-workflow      # Workflow builder
/iblai-onboard       # Onboarding questionnaire flow
/iblai-ops-build     # Desktop/mobile builds (Tauri v2)
/iblai-ops-test      # Test before showing work
/iblai-ops-upgrade   # Upgrade CLI, SDK, and skills to latest
/iblai-component     # Browse all available components
```

All features require auth first (`/iblai-auth` or `iblai add auth`).

## Environment

Platform configuration lives in `iblai.env` (`DOMAIN`, `PLATFORM`, `TOKEN`,
and optionally `VERCEL_TOKEN` for mobile dev builds). The CLI derives all
`NEXT_PUBLIC_*` env vars into `.env.local` automatically. Do NOT edit
`.env.local` directly for platform config -- update `iblai.env` and re-run
a CLI command.

`VERCEL_TOKEN` in `iblai.env` enables `iblai deploy vercel` — builds,
deploys to Vercel, disables auth protection, and updates `devUrl` in
`tauri.conf.json` automatically. If missing when the user wants to deploy,
ask once for their token (https://vercel.com/account/tokens).

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
- **Project names**: Lowercase only — npm rejects capital letters in package names. Convert any name the user gives (e.g. `MyApp` → `my-app`) before passing to `create-next-app`, `iblai startapp`, or `--app-name`.

## Commands

```bash
pnpm dev             # Dev server
pnpm build           # Production build
iblai config show    # View configuration
iblai add <feature>  # Add a feature
```

---

## Step 3: Add Frontend Design Skill

After writing the CLAUDE.md, use the AskUserQuestion tool to ask:

**Question:** "Add the Anthropic frontend design skill? It helps produce higher-quality UI with consistent design patterns, responsive layouts, and accessibility."

**Options:**
- Yes
- No

If the user selects Yes, run the following command (do not print it):

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design --yes
```

## Step 4: Confirm

After writing the file, tell the user:

> Updated `CLAUDE.md` with ibl.ai platform guidance. Claude Code will now
> prioritize ibl.ai SDK components over custom implementations and use the
> correct skills when adding features.
