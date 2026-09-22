<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# Vibe Starter

The app you actually need on ibl.ai — sign-in, an agent to talk to, users and admins, custom user and org data, memory, analytics, billing — ready to make yours.

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CC785C?logoColor=white)](https://claude.ai)
[![Desktop & Mobile](https://img.shields.io/badge/Desktop_%26_Mobile-supported-blue)](https://github.com/iblai/vibe/blob/main/skills/ship/iblai-vibe-ops-build/SKILL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

</div>

> **Note:** This starter runs against the hosted [iblai.app](https://iblai.app) environment. If you'd like a license to the full platform codebase to run locally or self-host, reach out to our team at [ibl.ai/contact](https://ibl.ai/contact).

---

## Quick Start

This project was scaffolded from the vibe-starter template bundled with
[iblai/vibe](https://github.com/iblai/vibe) (the `/iblai-vibe-ops-init` skill).

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_MAIN_TENANT_KEY` —
the API/auth/websocket URLs default to hosted iblai.app in
`lib/iblai/config.ts`, so the organization key (and optionally `IBLAI_API_KEY`) is
all `.env.local` needs. Then install and start the dev server:

```bash
cp .env.example .env.local
pnpm install --ignore-scripts
pnpm dev
```

> Always run `pnpm install` with `--ignore-scripts` to skip package
> lifecycle (postinstall) scripts.

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to `https://login.iblai.app` and returned with a session. The first admin to sign in lands on `/setup` to name the app and pick or create its agent. Every origin the app runs on (localhost, the deployed URL) must be in the org's allowed redirect origins, or sign-in never comes back — see [platform-lifecycle.md](https://github.com/iblai/vibe/blob/main/docs/platform-lifecycle.md).

## What is Vibe Starter

A pre-wired Next.js 16 + Tailwind v4 + shadcn/ui project with the [`@iblai/iblai-js`](https://www.npmjs.com/package/@iblai/iblai-js) SDK already integrated. Use it as the base for new ibl.ai single-page apps — auth, navbar, profile/account/notifications pages, and Redux/data-layer providers are already in place. Skip the manual `/iblai-vibe-auth`, `/iblai-vibe-navbar`, `/iblai-vibe-profile`, `/iblai-vibe-account`, and `/iblai-vibe-notification` skills.

**Why use it:**

- **Start building in minutes, not days** — auth, navbar, and the standard ibl.ai pages are already wired
- **Backend included** — connects to [iblai.app](https://iblai.app) for SSO auth, AI agent infrastructure, analytics, and organization management
- **Client-side auth via SSO** — end users never handle tokens; the one Platform API Token you hold stays server-side in `iblai.env`
- **Claude Code skills guide every step** — adding features is a conversation, not a scavenger hunt through docs
- **shadcn/ui fills in UI gaps** — consistent design language without the overhead of a custom design system
- **Ship everywhere** — web (Vercel), desktop (macOS/Windows/Linux), and mobile (iOS/Android) via Tauri v2

## What's Included

| Feature | Description |
|---------|-------------|
| **Next.js 16** | App Router, TypeScript, Tailwind v4, shadcn/ui (new-york, theme-mapped to ibl.ai brand colors) |
| **SSO sign-in** | `AuthProvider`, SSO callback, storage service, Redux store, org resolution; a placeholder or `main` org renders an alert instead of a login loop |
| **Home = chat** | `/` — the SDK `<Chat>` with the app's agent (`?agent=` → `NEXT_PUBLIC_DEFAULT_AGENT_ID` → the org setting saved on `/setup`); honest "No agent yet" state otherwise |
| **Agents** | `/agents` — SDK `AgentSearch` (favorites, featured, custom, all); a card opens the chat |
| **First-run setup** | `/setup` — admins name the app and pick or create its agent (server route with the org's authority); saved to org metadata |
| **User / Admin mode** | Org admins get a navbar switch to view the app exactly as a member; admin links and `/admin/*` exist only in Admin mode |
| **Admin area** | `/admin/users` (Users · Groups · Roles · Policies · Teams · Alerts + invitations), `/admin/analytics/*` (SDK tabs), `/admin/billing`, `/admin/memory`, `/admin/organization` (+ app settings form) |
| **Custom data on the platform** | `useUserSettings` (per user × org) and `useOrgSettings` (per org, GET-merge-PUT) in `lib/iblai/metadata.ts`; example cards on `/profile` and `/admin/organization`; an admin route for other users' data |
| **Profile · Account · Notifications** | `/profile` (SDK `Profile` + app preferences), `/account` (SDK `Account`), `/notifications/[[...id]]` (SDK `NotificationDisplay`) |
| **Server helper** | `lib/iblai/platform.ts` — `platformFetch` (Api-Token), `verifyCaller`, `requireAdmin` for any REST call without a component |
| **Tests** | Vitest (config, organization, metadata, platform helper) and Playwright journeys (auth, member, admin) with `e2e/COVERAGE.md` |
| **Mobile safe areas** | `globals.css` insets and viewport metadata wired for iOS/Android (Tauri v2 ready) |

## Adding Features

Any ibl.ai skill works out of the box. The ones this starter already uses are marked ✓:

```text
/iblai-vibe-agent-chat      ✓ customize the chat on /
/iblai-vibe-agent-search    ✓ /agents
/iblai-vibe-agent-create    ✓ /setup + /api/admin/agents
/iblai-vibe-agent           # configure an agent (24 tabs, one provider)
/iblai-vibe-user-metadata   ✓ per-user settings
/iblai-vibe-org-metadata    ✓ per-org settings
/iblai-vibe-admin           ✓ User/Admin mode + admin area
/iblai-vibe-invite          ✓ on /admin/users
/iblai-vibe-analytics       ✓ /admin/analytics
/iblai-vibe-billing         ✓ /admin/billing
/iblai-vibe-memory          ✓ /admin/memory
/iblai-vibe-memory-guide    # what memory means for your app
/iblai-vibe-pricing         # how money works; charge your users
/iblai-vibe-credit          ✓ credit widget in the navbar (paywall-enabled orgs)
/iblai-vibe-api             ✓ lib/iblai/platform.ts — REST without a component
/iblai-vibe-onboard         # onboarding questionnaire flow
/iblai-vibe-ops-deploy      # ship to a URL
/iblai-vibe-ops-build       # macOS, Windows, iOS, Android
/iblai-vibe-ops-release     # App Store / Google Play
/iblai-vibe-ops-test        # test before showing work
/iblai-vibe-ops-upgrade     # upgrade SDK and skills
```

See `AGENTS.md` (also `CLAUDE.md`) for the "what the user says → which skill" table.

## Project Layout

```
app/
  (app)/                          # Signed-in pages (navbar + drawer + User/Admin mode)
    layout.tsx                    # Session, AdminModeProvider, member vs admin links, /admin gate
    page.tsx                      # Home: SDK <Chat> with the app's agent (+ empty state)
    agents/page.tsx               # SDK <AgentSearch>
    profile/page.tsx              # SDK <Profile> + AppPreferences
    account/page.tsx              # SDK <Account>
    notifications/[[...id]]/      # SDK <NotificationDisplay>
    admin/                        # Admin mode only
      users/  analytics/  billing/  memory/  organization/
  setup/page.tsx                  # First-run (admins): app name, pick/create agent
  api/admin/                      # agents (list/create), user-metadata (other users)
  sso-login-complete/             # SSO callback (outside the route group)
  layout.tsx                      # Root layout — <IblaiProviders>
components/
  navbar/                         # nav-bar, navigation-drawer, logo, user-profile-button, admin-mode-switch
  admin/                          # account-panel (SDK Account by tab), analytics-page
  settings/                       # app-preferences (user), org-settings (org)
  setup/                          # setup-screen
  ui/                             # shadcn/ui
lib/iblai/                        # config, storage-service, auth-utils, tenant, admin-mode, metadata(-core), platform, admin-client
providers/iblai-providers.tsx     # Redux + Auth + Tenant + service worker + toaster
store/iblai-store.ts              # RTK store (slice keys fixed by the SDK)
public/sw.js                      # Offline service worker the SDK <Chat> registers
e2e/                              # Playwright journeys + COVERAGE.md
.env.example                      # → .env.local: org key, IBLAI_API_KEY, optional agent/app name
iblai.env.example                 # → iblai.env: DOMAIN, PLATFORM, TOKEN
.mcp.json                         # @iblai/mcp for your AI assistant (pnpm dlx)
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
| SSO Authentication | Yes | Yes | Yes | Yes | Yes |
| AI Chat | Yes | Yes | Yes | Yes | Yes |
| User Profile | Yes | Yes | Yes | Yes | Yes |
| Account Settings | Yes | Yes | Yes | Yes | Yes |
| Analytics Dashboard | Yes | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes |
| Credit Balance | Yes | Yes | Yes | Yes | Yes |
| Admin area | Yes | Yes | Yes | Yes | Yes |

> **iOS & Android SSO:** mobile WebViews are rejected by SSO providers, so the Tauri shell opens sign-in in the system browser (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android) and returns through a deep link. Set `TAURI_CUSTOM_SCHEME` in `iblai.env` — see [`/iblai-vibe-ops-build`](https://github.com/iblai/vibe/blob/main/skills/ship/iblai-vibe-ops-build/SKILL.md) “Mobile SSO”.

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
