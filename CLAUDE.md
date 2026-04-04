# CLAUDE.md

This file provides guidance for vibe coding with the ibl.ai platform.

## MCP Server (Use First)

`.mcp.json` is configured with `@iblai/mcp`. **Always use MCP tools first** before searching the codebase:

```
get_component_info("ChatWidget")              # Props, usage, examples for any component
get_hook_info("useAdvancedChat")              # Hook parameters and return types
get_api_query_info("useGetUserMetadataQuery") # RTK Query endpoint details
get_provider_setup("auth")                    # Provider hierarchy and setup code
create_page_template("Dashboard", "mentor")   # Generate a page following ibl.ai patterns
get_playwright_helper_info("createConfig")    # E2E test utilities
```

## What is This

**Vibe** is a developer toolkit for shipping AI-powered apps fast on the ibl.ai platform. It provides:

- The `iblai` CLI for scaffolding apps and adding pre-built components
- Claude Code skills for guided, AI-assisted development
- The `@iblai/iblai-js` SDK with auth, chat, UI components, and data layer
- Connection to iblai.app -- a production backend with SSO auth, AI agents, analytics, and multi-tenancy

## Installing the CLI

```bash
iblai --version    # Check if already available
```

If not available, see the Prerequisites section in `/iblai-auth` for
installation options (npx or build from source).

## Getting Started

The CLI reads `PLATFORM` from `iblai.env` automatically. Pass `--platform`
only to override or when `iblai.env` is not set up.

### Vanilla Next.js + ibl.ai Features

```bash
npx create-next-app@latest . --yes
iblai add auth
iblai add chat
pnpm dev
```

### Full ibl.ai Agent App

Scaffold a complete app with auth, chat, and everything pre-configured.
Always create in a temp directory and copy back to the current directory:

```bash
iblai startapp agent -o .iblai-init
cp -a .iblai-init/<app-name>/. . && rm -rf .iblai-init
cp .env.example .env.local
pnpm install && pnpm dev
```

### Add Features to Any Next.js App

```bash
iblai add auth           # SSO authentication
iblai add chat           # AI chat widget
```

Other features (profile, account, analytics, notifications, invitations,
workflows) are built using skills -- see `/iblai-profile`, `/iblai-account`,
`/iblai-analytics`, `/iblai-notification`, `/iblai-invite`, `/iblai-workflow`.

## Architecture

### Provider Chain

```
AuthProvider > TenantProvider > {children}
```

`initializeDataLayer` must be called with 5 arguments (data-layer v1.2+):

```typescript
initializeDataLayer(dmUrl, lmsUrl, legacyLmsUrl, storageService, httpErrorHandler)
```

### SDK Imports

```typescript
import { initializeDataLayer, mentorReducer } from "@iblai/iblai-js/data-layer";
import { AuthProvider, TenantProvider, useChatV2 } from "@iblai/iblai-js/web-utils";
import { Loader, TenantSwitch } from "@iblai/iblai-js/web-containers";
import { SsoLogin, UserProfileDropdown } from "@iblai/iblai-js/web-containers/next";
```

### Redux Store

`@reduxjs/toolkit` is deduplicated via webpack `resolve.alias` in `next.config.ts`. Without deduplication, SDK components use a different `ReactReduxContext` and RTK Query hooks silently return `undefined`.

## Environment

### `iblai.env` — Platform configuration

```bash
DOMAIN=iblai.app
PLATFORM=your-platform
TOKEN=your-api-token
```

The CLI reads `DOMAIN`, `PLATFORM`, and `TOKEN` from `iblai.env` and derives
the `NEXT_PUBLIC_*` env vars into `.env.local` automatically.

> **Important:** `iblai.env` is NOT a replacement for `.env.local`. It only
> holds the 3 shorthand variables. Next.js reads its runtime env vars from
> `.env.local` / `.env` / `.env.development` as usual. The CLI bridges the
> two: it reads `iblai.env` and writes the derived `NEXT_PUBLIC_*` values
> into `.env.local`.

### `.env.local` — Next.js env vars (auto-derived)

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=iblai.app
NEXT_PUBLIC_MAIN_TENANT_KEY=your-platform
NEXT_PUBLIC_DEFAULT_AGENT_ID=your-agent-id
```

Register at https://mentorai.iblai.app for your own tenant key and agent ID.

> **AI Assistant:** Before adding a component or creating a new app, check
> for an `iblai.env` file in the project root. Look for `PLATFORM`, `DOMAIN`,
> and `TOKEN` variables. If the file does not exist or is missing these
> variables, tell the user:
> "You need an `iblai.env` with your platform configuration. Download the
> template and fill in your values:
> `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"
>
> Do NOT ask the user for their tenant key directly. Guide them to populate
> `iblai.env` instead. The CLI reads these and derives all `NEXT_PUBLIC_*`
> env vars into `.env.local` automatically.
>
> `iblai.env` is NOT a `.env.local` replacement — it only holds the 3
> shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
> its runtime env vars from `.env.local`.
>
> Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
> is not installed. The generated app should live in the current directory,
> not in a subdirectory.
>
> When adding chat (`/iblai-chat`), you MUST ask the user for their
> agent/mentor ID (a UUID). Do not use placeholder values for agent IDs.

## Commands

```bash
pnpm dev                # Start dev server (localhost:3000)
pnpm build              # Production build
pnpm lint               # ESLint
pnpm typecheck          # TypeScript type checking
pnpm test:e2e           # Playwright E2E tests

iblai config show       # View current configuration
iblai config set KEY VAL  # Update .env.local
iblai open              # Open localhost:3000 in browser
```

## Adding Features

```bash
iblai add mcp            # MCP servers + skills (run first)
iblai add auth           # SSO authentication + Redux store + providers
iblai add chat           # AI chat widget (<mentor-ai> web component)
iblai add profile        # User profile dropdown
iblai add account        # Account/organization settings page
iblai add analytics      # Analytics dashboard page
iblai add notifications  # Notification bell
iblai add builds         # Tauri v2 desktop/mobile shell
iblai init               # Alias for iblai add mcp
```

All features require auth to be set up first (`iblai add auth`).

## Component Hierarchy

| Component | Source | Description |
|-----------|--------|-------------|
| ibl.ai components | `@iblai/iblai-js` | Auth, chat, profile, account, analytics, notifications |
| shadcn/ui | `npx shadcn@latest add` | Everything else -- forms, tables, modals, date pickers |
| shadcnspace blocks | `npx shadcn@latest add @shadcn-space/<block>` | Pre-built page sections |

ibl.ai and shadcn components share the same Tailwind theme via OKLCH CSS variables
mapped in `globals.css`. A shadcn `bg-primary` button renders in ibl.ai blue (#0058cc),
not the default shadcn black. No manual theme work needed.

## Brand

- **Primary**: `#0058cc` (brand blue)
- **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack
- **Style**: shadcn/ui new-york variant, neutral base, Lucide icons

See [BRAND.md](BRAND.md) for the complete brand guidelines.

## Skills

Skills are in `skills/` (symlinked to `.claude/skills/` for Claude Code discovery).
Edit the files in `skills/` — changes are reflected automatically.

Invoke with `/` in Claude Code:

| Skill | Description |
|-------|-------------|
| `/iblai-auth` | Add SSO authentication (includes CLI installation guide) |
| `/iblai-chat` | Add AI chat widget |
| `/iblai-profile` | Add profile dropdown + settings page |
| `/iblai-account` | Add account/org settings page |
| `/iblai-analytics` | Add analytics dashboard |
| `/iblai-notification` | Add notification bell + center page |
| `/iblai-invite` | Add user invitation dialogs |
| `/iblai-workflow` | Add workflow builder components |
| `/iblai-component` | Overview of all available components |
| `/iblai-ios` | Build and run on iOS (Simulator and real device) |
| `/iblai-test` | Test your app before showing work to the user |

## Deployment

### Vercel
```bash
vercel --prod
```

### Docker
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

### Desktop/Mobile (Tauri v2)
```bash
iblai add builds           # Add Tauri support
iblai builds dev           # Dev mode
iblai builds build         # Production build
iblai builds ios init      # iOS project setup
```

THIS PROJECT ALREADY HAS GIT INITIALIZED. DO NOT INITIALIZE GIT.
