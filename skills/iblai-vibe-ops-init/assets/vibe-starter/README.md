<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# Vibe Starter

The starting point for any ibl.ai single-page app.

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CC785C?logoColor=white)](https://claude.ai)
[![Desktop & Mobile](https://img.shields.io/badge/Desktop_%26_Mobile-supported-blue)](https://github.com/iblai/vibe/blob/main/skills/iblai-vibe-ops-build/SKILL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

</div>

> **Note:** This starter runs against the hosted [iblai.app](https://iblai.app) environment. If you'd like a license to the full platform codebase to run locally or self-host, reach out to our team at [ibl.ai/contact](https://ibl.ai/contact).

---

## Quick Start

This project was scaffolded from the vibe-starter template bundled with
[iblai/vibe](https://github.com/iblai/vibe) (the `/iblai-vibe-ops-init` skill).

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAIN_TENANT_KEY` —
the API/auth/websocket URLs default to hosted iblai.app in
`lib/iblai/config.ts`, so the tenant key (and optionally `IBLAI_API_KEY`) is
all `.env.local` needs. Then install and start the dev server:

```bash
cp .env.example .env.local
pnpm install --ignore-scripts
pnpm dev
```

> Always run `pnpm install` with `--ignore-scripts` to skip package
> lifecycle (postinstall) scripts.

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `https://login.iblai.app` and returned with a session.

## What is Vibe Starter

A pre-wired Next.js 16 + Tailwind v4 + shadcn/ui project with the [`@iblai/iblai-js`](https://www.npmjs.com/package/@iblai/iblai-js) SDK already integrated. Use it as the base for new ibl.ai single-page apps — auth, navbar, profile/account/notifications pages, and Redux/data-layer providers are already in place. Skip the manual `/iblai-vibe-auth`, `/iblai-vibe-navbar`, `/iblai-vibe-profile`, `/iblai-vibe-account`, and `/iblai-vibe-notification` skills.

**Why use it:**

- **Start building in minutes, not days** — auth, navbar, and the standard ibl.ai pages are already wired
- **Backend included** — connects to [iblai.app](https://iblai.app) for SSO auth, AI agent infrastructure, analytics, and tenant management
- **Client-side auth via SSO** — no API tokens to store, rotate, or leak
- **Claude Code skills guide every step** — adding features is a conversation, not a scavenger hunt through docs
- **shadcn/ui fills in UI gaps** — consistent design language without the overhead of a custom design system
- **Ship everywhere** — web (Vercel), desktop (macOS/Windows/Linux), and mobile (iOS/Android) via Tauri v2

## What's Included

| Feature | Description |
|---------|-------------|
| **Next.js 16** | App Router, TypeScript, Tailwind v4 |
| **shadcn/ui** | new-york variant, initialized and theme-mapped to ibl.ai brand colors |
| **SSO Authentication** | `AuthProvider`, SSO callback page, storage service, Redux store, tenant resolution |
| **Responsive Navbar** | Logo, page links, credit balance, notification bell, profile dropdown — collapses to a hamburger drawer on mobile |
| **Profile Page** | `/profile` — SDK `<Profile>` with editable basic info, social links, education, experience |
| **Account Page** | `/account` — SDK `<Account>` with Organization, Management, Integrations, Advanced, Billing tabs |
| **Notifications** | `/notifications/[[...id]]` — SDK `<NotificationDisplay>` with Inbox/Alerts and admin send |
| **Mobile Safe Areas** | `globals.css` insets and viewport metadata wired for iOS/Android (Tauri v2 ready) |
| **Providers** | `IblaiProviders` with Redux + Auth + Tenant + data-layer initialization |

## Adding Features

This starter is auth-ready, so any ibl.ai feature skill works out of the box. Use them directly in Claude Code with `/` commands:

```text
/iblai-vibe-agent-chat      # In-process agent chat surface
/iblai-vibe-analytics       # Analytics dashboard
/iblai-vibe-credit          # Credit balance widget (already wired in the navbar)
/iblai-vibe-invite          # User invitation dialogs
/iblai-vibe-workflow        # Workflow builder
/iblai-vibe-course-access   # edX course-content pages
/iblai-vibe-course-create   # Generate, edit, and publish edX courses
/iblai-vibe-onboard         # Onboarding questionnaire flow
/iblai-vibe-component       # Browse all available components
/iblai-vibe-ops-build       # Build and run on desktop and mobile
/iblai-vibe-ops-deploy      # Deploy via ibl.ai hosting (Vercel)
/iblai-vibe-ops-test        # Test before showing work
/iblai-vibe-ops-upgrade     # Upgrade SDK and skills to latest
/iblai-vibe-agent-search    # Agent search/browse page
/iblai-vibe-agent-setting   # Agent Settings tab
/iblai-vibe-agent-access    # Agent Access tab (RBAC)
/iblai-vibe-agent-api       # Agent API tab
/iblai-vibe-agent-dataset   # Agent Datasets tab
/iblai-vibe-agent-disclaimer # Agent Disclaimers tab
/iblai-vibe-agent-embed     # Agent Embed tab
/iblai-vibe-agent-history   # Agent History tab
/iblai-vibe-agent-llm       # Agent LLM tab
/iblai-vibe-agent-memory    # Agent Memory tab
/iblai-vibe-agent-prompt    # Agent Prompts tab
/iblai-vibe-agent-safety    # Agent Safety tab
/iblai-vibe-agent-tool      # Agent Tools tab
```

Marketing skills (landing pages, screenshots, CRO, SEO, and more) live in
the companion [iblai/vibe-marketing](https://github.com/iblai/vibe-marketing)
repo: `npx skills add iblai/vibe-marketing`.

See `CLAUDE.md` for the full component priority guide and the complete skill list.

## Project Layout

```
app/
  (app)/                          # Authenticated pages (wrapped with navbar)
    layout.tsx                    # Renders <NavBar> + <NavigationDrawer>
    page.tsx                      # Home
    profile/page.tsx              # SDK <Profile>
    account/page.tsx              # SDK <Account>
    notifications/[[...id]]/      # SDK <NotificationDisplay>
  sso-login-complete/             # SSO callback (outside route group)
  layout.tsx                      # Root layout — wraps with <IblaiProviders>
components/
  navbar/                         # nav-bar, navigation-drawer, logo, credit-balance-widget, user-profile-button
  ui/                             # shadcn/ui components
lib/iblai/                        # config, storage-service, auth-utils, tenant
providers/iblai-providers.tsx     # Redux + Auth + Tenant providers
store/iblai-store.ts              # RTK store
.env.example                      # Copy to .env.local — tenant key + IBLAI_API_KEY (URLs default in code)
iblai.env.example                 # Copy to iblai.env — platform shorthand (DOMAIN, PLATFORM, TOKEN)
```

## AI-Assisted Development

The starter ships with a curated `CLAUDE.md`/`AGENTS.md` so Claude Code (and any other agent that reads them) gets deep knowledge of the ibl.ai platform from the first prompt. Add the [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) server to your agent's MCP config (e.g. `.mcp.json`) for component-level lookups.

The [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) server gives your AI assistant access to:

```
get_component_info("ChatWidget")              # Props, usage, examples for any component
get_hook_info("useAdvancedChat")              # Hook parameters and return types
get_api_query_info("useGetUserMetadataQuery") # RTK Query endpoint details
get_provider_setup("auth")                    # Provider hierarchy and setup code
create_page_template("Dashboard", "mentor")   # Generate a page following ibl.ai patterns
```

## Platform Capabilities

| Feature | Web | macOS | Windows/Surface | iOS | Android |
|---------|-----|-------|-----------------|-----|---------|
| SSO Authentication | Yes | Yes | Yes | No | No |
| AI Chat | Yes | Yes | Yes | Yes | Yes |
| User Profile | Yes | Yes | Yes | Yes | Yes |
| Account Settings | Yes | Yes | Yes | Yes | Yes |
| Analytics Dashboard | Yes | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes |
| Credit Balance | Yes | Yes | Yes | Yes | Yes |

> **iOS & Android SSO limitation:** Mobile WebViews use a non-standard user-agent that SSO providers reject. Completing the OAuth flow requires a system browser popup (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android). This is not yet implemented — mobile users must authenticate via another method for now.

## Brand

- **Primary**: `#0058cc`
- **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Style**: shadcn/ui new-york, system sans-serif, Lucide icons

SDK and shadcn components share the same Tailwind theme and render in ibl.ai brand colors automatically — do not override them.

## Commands

```bash
pnpm dev             # Dev server (localhost:3000)
pnpm build           # Production build
pnpm test            # Vitest
pnpm test:e2e        # Playwright E2E
```

> `pnpm test:e2e` needs Playwright credentials: `cp e2e/.env.development.example e2e/.env.development` and set `PLAYWRIGHT_USERNAME` / `PLAYWRIGHT_PASSWORD` (the auth setup refuses to run without them; the file is gitignored).

## Deploy Anywhere

### ibl.ai hosting (Vercel) — recommended

Run `/iblai-vibe-ops-deploy` — zips the app, uploads it to the ibl.ai
platform's hosting API using your platform API key (no Vercel account or
token), polls until the build is READY, and updates `devUrl` in
`tauri.conf.json`. The app lands on the `*.vercel.app` URL the API reports.

### Tauri (Desktop & Mobile)

Add the Tauri shell with `/iblai-vibe-ops-build`, then:

```bash
pnpm exec tauri dev           # Dev mode
pnpm exec tauri build         # Desktop build for current platform
pnpm exec tauri ios init      # iOS project setup
```

## Resources

- [Vibe](https://github.com/iblai/vibe) — the full developer toolkit and skill source
- [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) — unified SDK for data, UI components, and auth utilities
- [@iblai/iblai-api](https://www.npmjs.com/package/@iblai/iblai-api) — auto-generated API types
- [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) — MCP server for AI-assisted development
- [skills.sh/iblai/vibe](https://skills.sh/iblai/vibe) — install skills with `npx skills add iblai/vibe --all`

## License

MIT — [ibl.ai](https://ibl.ai)
