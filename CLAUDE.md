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

If not available, see `/iblai-install` for installation options (npx or build from source).

## Getting Started

### Vanilla Next.js + ibl.ai Features

```bash
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir
cd my-app
iblai add auth
iblai add chat
pnpm install && pnpm dev
```

### Full ibl.ai Agent App

```bash
iblai startapp agent
cd <app-name> && pnpm install
cp .env.example .env.local
pnpm dev
```

### Add Features to Any Next.js App

```bash
iblai add auth           # SSO authentication
iblai add chat           # AI chat widget
iblai add profile        # User profile page
iblai add account        # Account settings
iblai add analytics      # Analytics dashboard
iblai add notifications  # Notification bell
```

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

`@reduxjs/toolkit` is deduplicated via webpack `resolve.alias` in `next.config.mjs`. Without deduplication, SDK components use a different `ReactReduxContext` and RTK Query hooks silently return `undefined`.

## Environment (.env.local)

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=iblai.app
NEXT_PUBLIC_MAIN_TENANT_KEY=iblai
NEXT_PUBLIC_DEFAULT_AGENT_ID=00000000-0000-0000-0000-000000000000
```

Register at https://iblai.app for your own tenant. Replace `iblai` with your tenant key.

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
iblai init               # Add MCP server + AI skills to current project
iblai add auth           # SSO authentication + Redux store + providers
iblai add chat           # AI chat widget (<mentor-ai> web component)
iblai add profile        # User profile dropdown + settings page
iblai add account        # Organization/account settings page
iblai add analytics      # Analytics dashboard page
iblai add notifications  # Notification bell + center page
iblai add builds         # Tauri v2 desktop/mobile shell
iblai add mcp            # MCP server config + Claude/OpenCode/Cursor skills
```

All `add` commands (except `init` and `mcp`) require auth to be set up first.

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

See [BRAND.md](https://github.com/iblai/iblai-app-cli/blob/main/BRAND.md) in iblai-app-cli for the complete brand guidelines.

## Skills

Skills are in `skills/` (symlinked to `.claude/skills/` for Claude Code discovery).
Edit the files in `skills/` — changes are reflected automatically.

Invoke with `/` in Claude Code:

| Skill | Description |
|-------|-------------|
| `/iblai-install` | Install the iblai CLI (npx or build from source) |
| `/iblai-new-app` | Scaffold and configure a new iblai app |
| `/iblai-auth` | Add SSO authentication to a Next.js app |
| `/iblai-chat` | Add AI chat widget |
| `/iblai-profile` | Add profile dropdown + settings page |
| `/iblai-account` | Add account/org settings page |
| `/iblai-analytics` | Add analytics dashboard |
| `/iblai-notifications` | Add notification bell + center page |
| `/iblai-env` | Set up environment variables from .env.example |
| `/iblai-components` | Overview of all available components |

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
