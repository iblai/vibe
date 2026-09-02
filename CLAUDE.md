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

- Project scaffolding templates (vibe-starter) and pre-built components
- Claude Code skills for guided, AI-assisted development
- The `@iblai/iblai-js` SDK with auth, chat, UI components, and data layer
- Connection to iblai.app -- a production backend with SSO auth, AI agents, analytics, and multi-tenancy

## Getting Started

> **AI Assistant:** When the user says "start a new project", "new app",
> "scaffold an app", or anything that creates a fresh codebase, **default
> to vibe-starter** (the option below). Only fall back to a vanilla Next.js
> app wired up with the `/iblai-vibe-*` skills if the user explicitly declines
> the starter or asks for a minimal/custom setup.

### vibe-starter (recommended for new projects)

Pre-wired Next.js 16 + Tailwind v4 + shadcn/ui template with ibl.ai SSO
auth, a responsive navbar, and profile/account/notifications pages
already in place. Skips the manual `/iblai-vibe-auth`, `/iblai-vibe-navbar`,
`/iblai-vibe-profile`, `/iblai-vibe-account`, and `/iblai-vibe-notification` skills.

The template is bundled with the `/iblai-vibe-ops-init` skill at
`skills/iblai-vibe-ops-init/assets/vibe-starter/`. Copy it into the project
root (or fetch it from the vibe repo when the skill's assets are not
installed locally — say which path you took):

```bash
cp -a <skills-dir>/iblai-vibe-ops-init/assets/vibe-starter/. .
# or, without local assets:
git clone --depth 1 https://github.com/iblai/vibe.git vibe-tmp && cp -a vibe-tmp/skills/iblai-vibe-ops-init/assets/vibe-starter/. . && rm -rf vibe-tmp

pnpm install --ignore-scripts
```

> **Install policy:** always run `pnpm install` / `pnpm i` with `--ignore-scripts` to skip package lifecycle (postinstall) scripts — a sandbox-hardening default.

Then copy `iblai.env.example` → `iblai.env` and fill in `PLATFORM` and
`TOKEN`, and copy `.env.example` → `.env.local` setting
`NEXT_PUBLIC_MAIN_TENANT_KEY` (= `PLATFORM`) and `IBLAI_API_KEY` (= `TOKEN`).
The API/auth/websocket URLs default to hosted iblai.app in
`lib/iblai/config.ts`, so those two values are all `.env.local` needs.

### Vanilla Next.js + ibl.ai Features

```bash
npx create-next-app@latest iblai-init --yes
cp -a iblai-init/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install --ignore-scripts
```

> Run with `--ignore-scripts` to skip package lifecycle (postinstall) scripts.

Then run the [`/iblai-vibe-auth`](skills/iblai-vibe-auth/SKILL.md) skill to wire up SSO
auth (it creates the providers, store, and `lib/iblai/*` files), then `pnpm dev`.

### Full ibl.ai Agent App

Use **vibe-starter** (above) for a complete app with auth, chat, and pages
pre-wired. To assemble one by hand, render the `base`+`agent` templates from
[`/iblai-vibe-scaffold`](skills/iblai-vibe-scaffold/SKILL.md), then `pnpm install` and
`pnpm dev`.

### Add Features to Any Next.js App

Features are added with the `/iblai-vibe-*` skills (each creates the files and
wires them in). Start with [`/iblai-vibe-auth`](skills/iblai-vibe-auth/SKILL.md) (SSO
authentication). Other features (chat, profile, account, analytics,
notifications, invitations, projects, workflows) -- see `/iblai-vibe-agent-chat`,
`/iblai-vibe-project`, `/iblai-vibe-profile`, `/iblai-vibe-account`, `/iblai-vibe-analytics`,
`/iblai-vibe-notification`, `/iblai-vibe-invite`, `/iblai-vibe-workflow`.

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
IBLAI_USERNAME=your-username     # Optional — env var wins; /iblai-vibe-ops-deploy asks once and persists it
```

Map `DOMAIN`, `PLATFORM`, and `TOKEN` from `iblai.env` into the
`NEXT_PUBLIC_*` env vars in `.env.local` (`NEXT_PUBLIC_MAIN_TENANT_KEY` ←
`PLATFORM`; the API URLs default to `iblai.app`). vibe-starter apps carry
the URL defaults in code (`lib/iblai/config.ts`) — there `.env.local` only
needs the tenant key and `IBLAI_API_KEY`.

> **Important:** `iblai.env` is NOT a replacement for `.env.local`. It only
> holds the platform shorthand variables. Next.js reads its runtime env vars
> from `.env.local` as usual — copy the shorthand values into the
> `NEXT_PUBLIC_*` vars there.

### `.env.local` — Next.js env vars

For apps rendered from the scaffold templates. vibe-starter apps need only
`NEXT_PUBLIC_MAIN_TENANT_KEY` and `IBLAI_API_KEY` — the URL vars default in
`lib/iblai/config.ts`.

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=iblai.app
NEXT_PUBLIC_MAIN_TENANT_KEY=your-main-platform
NEXT_PUBLIC_DEFAULT_AGENT_ID=your-agent-id
```

> **AI Assistant:** Before adding a component or creating a new app, check
> for an `iblai.env` file in the project root. Look for `PLATFORM`, `DOMAIN`,
> and `TOKEN` variables. If the file does not exist or is missing these
> variables, tell the user:
> "You need an `iblai.env` with your platform configuration. If the project
> ships `iblai.env.example` (vibe-starter does), copy it:
> `cp iblai.env.example iblai.env`. Otherwise download the template:
> `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`.
> Then fill in your values."
>
> Where the values come from: an account and an organization at
> https://ibl.ai/join; the org key (`PLATFORM`) is listed on
> https://login.iblai.app/me; the Platform API Token (`TOKEN`) is minted
> from that signed-in session by `/iblai-api-login` (`npx skills add
> iblai/api`), or use an org secret directly. Keep `iblai.env` gitignored.
>
> Do NOT ask the user for their platform key directly. Guide them to populate
> `iblai.env` instead, then map the values into `.env.local`
> (`NEXT_PUBLIC_MAIN_TENANT_KEY` ← `PLATFORM`).
>
> `iblai.env` is NOT a `.env.local` replacement — it only holds the
> platform shorthand variables. Next.js still reads its runtime env vars
> from `.env.local`.
>
> Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
> is not installed. The generated app should live in the current directory,
> not in a subdirectory.
>
> **Project names MUST be all lowercase.** npm rejects package names with
> capital letters. When running `npx create-next-app` or scaffolding
> vibe-starter, lowercase every name. If the user supplies a
> name like `MyApp` or `AgentBot`, convert it to `my-app` / `agent-bot`
> before using it. Allowed characters: lowercase letters, digits, `-`, `_`.
>
> When adding chat (`/iblai-vibe-agent-chat`) you MUST have a real
> agent/mentor ID (a UUID): take it from an os.ibl.ai URL the user already
> gave (see **Learn from a live tenant** below), otherwise ask. Never use a
> placeholder.

### Learn from a live tenant

> **AI Assistant:** When the user says something like “You’re also logged
> into `https://os.ibl.ai/platform/<tenant>/<agent-uuid>` as `<email>`”,
> that sentence is configuration plus a reference app. Act on it; do not
> ask again for anything it already contains.
>
> 1. **Decode the URL.** In `iblai/os` the route is
>    `app/platform/[tenantKey]/[mentorId]` — “chat with this agent in this
>    tenant”; the agent-scoped pages (analytics, notifications, …) nest under
>    it. So `<tenant>` → `PLATFORM` / `NEXT_PUBLIC_MAIN_TENANT_KEY`,
>    `<agent-uuid>` → `NEXT_PUBLIC_DEFAULT_AGENT_ID`, and `os.ibl.ai` runs on
>    the hosted platform → `DOMAIN=iblai.app` (`api.iblai.app`,
>    `login.iblai.app`). A self-hosted OS host implies another domain — ask.
> 2. **Get a token from the session, never a password.** With a browser tool
>    (`claude --chrome`, or the Playwright server in `.mcp.json`): open the
>    URL, confirm the user is signed in, read `dm_token` and
>    `userData.user_nicename` (the username) from localStorage, then mint a
>    Platform API Token exactly as `/iblai-api-login` step 2 documents —
>    `POST https://api.iblai.app/dm/api/core/platform/api-tokens/` with
>    `Authorization: Token <dm_token>` and body
>    `{ username, name, key: "", platform_key: <tenant>, created, expires: "" }`;
>    the secret is shown once. Write it to the gitignored `iblai.env` as
>    `TOKEN` (plus `IBLAI_USERNAME`), map it into `.env.local` as
>    `IBLAI_API_KEY`, and verify with
>    `GET …/dm/api/core/platform/users/?platform_key=<tenant>` under
>    `Authorization: Api-Token …` → 200. No browser tool? Ask the user to
>    paste a Platform API Token instead.
> 3. **Learn shapes from live data.** Call the families in *Platform data
>    most apps lean on* (below) against that tenant and copy field names from
>    real responses instead of guessing. For the surface you are building,
>    watch the OS page’s network calls to see which endpoints and params the
>    production app actually uses.
> 4. **Learn wiring from source.** The same `iblai/os` route mounts the SDK
>    components the `/iblai-vibe-agent-*` skills install —
>    `components/modals/edit-mentor-modal/settings-tab.tsx` wraps
>    `AgentSettingsTab` in `AgentSettingsProvider`;
>    `…/[mentorId]/analytics/page.tsx` renders `AnalyticsOverview`. Read it
>    before inventing props.
> 5. **Keep it out of git.** The token (and `dm_token`) live only in
>    gitignored env files; keep the tenant key and email out of docs,
>    screenshots, and commit messages. No new env key is needed for the
>    reference URL — rebuild it from `PLATFORM` and
>    `NEXT_PUBLIC_DEFAULT_AGENT_ID`.

## Commands

```bash
pnpm dev                # Start dev server (localhost:3000)
pnpm build              # Production build
pnpm lint               # ESLint
pnpm typecheck          # TypeScript type checking
pnpm test:e2e           # Playwright E2E tests
```

Platform config lives in `iblai.env`; map it into `.env.local` (see
**Environment** above).

## Adding Features

Each feature is a `/iblai-vibe-*` skill that creates the files and wires them in:

| Feature | Skill |
|---|---|
| MCP servers + skills (set up first) | `@iblai/mcp` in `.mcp.json` |
| SSO authentication + Redux store + providers | `/iblai-vibe-auth` |
| User profile dropdown | `/iblai-vibe-profile` |
| Account/organization settings page | `/iblai-vibe-account` |
| Analytics dashboard page | `/iblai-vibe-analytics` |
| Notification bell | `/iblai-vibe-notification` |
| Tauri v2 desktop/mobile shell | `/iblai-vibe-ops-build` |

All features require auth to be set up first (`/iblai-vibe-auth`).

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

Skills live in `skills/` — one directory per skill, `SKILL.md` canonical.

**Cursor / Codex adapters** are generated from the canonical SKILL.md
files. To regenerate after editing skills:

```bash
node scripts/build-adapters.mjs
```

This reads every `skills/<name>/SKILL.md` and writes:

- `adapters/cursor/<name>.mdc` — Cursor rule format (description + globs + alwaysApply + body)
- `adapters/codex/<name>.md`   — Codex instruction format (heading + description blockquote + body)

The canonical SKILL.md files ARE the Claude Code format — no separate
adapter needed for Claude. Use `templates/skill-template.md` as the
starting point when authoring a new skill.

**Skill validation & testing** (details in [TESTING.md](TESTING.md); CI runs the first three on PRs labeled `run-tests` — not merge-required):

```bash
bash scripts/validate-skills.sh           # spec conformance: name/description/frontmatter, ≤500 lines, off-spec dirs
node scripts/check-sdk-pins.mjs           # no @iblai/* version mention may drift from vibe-starter's package.json (--fix rewrites drifted mentions)
node scripts/check-links.mjs              # every github.com/iblai cross-repo link must still resolve (404/410 fail, transient warns)
node scripts/test-skills-render.mjs       # skill assets + SKILL.md ts/tsx fences typecheck against the pinned SDK
scripts/test-skills-agent.sh --changed    # headless-agent execution of changed skills (needs claude CLI)
bash scripts/validate-skills-official.sh  # deeper audit via the upstream skills-ref Python library (manual)
```

Asset-bearing skills map their templates to app paths in `skills/<name>/test.json`; justified typecheck skips live in `scripts/skill-render-skips.json`.

Invoke with `/` in Claude Code:

| Skill | Description |
|-------|-------------|
| `/iblai-vibe` | Ecosystem index — which ibl.ai repo/skill family covers a task (this repo, `iblai/api`, `iblai/os`, `iblai/vibe-marketing`) |
| `/iblai-vibe-auth` | Add SSO authentication (providers, store, `lib/iblai` files) |
| `/iblai-vibe-agent-chat` | Add the full in-process agent chat surface (message stream, canvas, voice, prompts) |
| `/iblai-vibe-project` | Add the in-process Projects surface (project landing page — chat input + files + instructions + assigned agents) |
| `/iblai-vibe-navbar` | Add responsive navbar with logo, links, notifications, and profile dropdown |
| `/iblai-vibe-profile` | Add profile dropdown + settings page |
| `/iblai-vibe-history` | Add the user profile History surface (own conversations with filters, transcript preview, and exports) |
| `/iblai-vibe-account` | Add account/org settings page |
| `/iblai-vibe-billing` | Add the tenant Billing settings surface (plan & credits with Stripe flows, workspace spend limit, agent limits table) |
| `/iblai-vibe-memory` | Add the tenant Memory settings surface (manage user global memories and agent memories from one place) |
| `/iblai-vibe-analytics` | Add analytics dashboard |
| `/iblai-vibe-notification` | Add notification bell + center page |
| `/iblai-vibe-credential` | Grant an API token RBAC access to list and unmask platform integration credentials |
| `/iblai-vibe-credit` | Add the credit balance widget (plan badge, credits, auto-recharge, upgrade) |
| `/iblai-vibe-invite` | Add user invitation dialogs |
| `/iblai-vibe-workflow` | Add workflow builder components |
| `/iblai-vibe-local-llm` | Contract for on-device LLM (Ollama / Foundry) in a Tauri desktop build — command names, event names, hook shape the SDK reads via `localLLMProps` |
| `/iblai-vibe-course-access` | Add course-content pages (edX user UI) |
| `/iblai-vibe-course-create` | Generate, edit, and publish edX courses via the ibl.ai Course Creation API |
| `/iblai-vibe-component` | Overview of all available components |
| `/iblai-vibe-design` | Design, audit, polish, and iterate frontend UI (23 sub-commands); falls back to BRAND.md when the project has no design system |
| `/iblai-vibe-onboard` | Design and build a high-converting onboarding questionnaire flow |
| `/iblai-vibe-ops-build` | Build and run on desktop and mobile (iOS, Android, macOS, Surface) |
| `/iblai-vibe-ops-init` | Update project CLAUDE.md with ibl.ai platform guidance |
| `/iblai-vibe-ops-deploy` | Deploy the frontend via the ibl.ai platform's hosting API (Vercel-backed) |
| `/iblai-vibe-ops-release` | Generate a Makefile + Fastlane config to build & submit to the App Store and Google Play |
| `/iblai-vibe-ops-test` | Test your app before showing work to the user |
| `/iblai-vibe-ops-upgrade` | Upgrade the ibl.ai SDK and vibe skills to the latest versions |
| `/iblai-vibe-readme` | Write or refresh the project README.md |
| `/iblai-vibe-scaffold` | Scaffold a new app or add features — the base/agent project templates + the assembly steps |
| `/iblai-vibe-iconography` | Generate every app-icon size (Tauri desktop, iOS, Windows MSIX, macOS) from one source image |
| `/iblai-vibe-windows-msix` | Build and distribute a Tauri app as a Windows MSIX (sideload / Microsoft Store) |
| `/iblai-vibe-deslop` | Audit and harden an existing codebase for production readiness (two-phase audit → safety-tiered fixes) |
| `/iblai-vibe-rbac` | Reference: default RBAC roles, action-definitions endpoint, and the SDK Roles + Policies components |
| `/iblai-vibe-agent-search` | Add the agent search/browse page (starred, featured, custom, default) |
| `/iblai-vibe-agent-setting` | Add the agent Settings tab (name, visibility, copy, delete) |
| `/iblai-vibe-agent-access` | Add the agent Access tab (RBAC for editor and chat roles) |
| `/iblai-vibe-agent-api` | Add the agent API tab (API key management) |
| `/iblai-vibe-agent-billing` | Add the agent Billing tab (LLM spend limits for the agent and per user, with usage bars, block/alert enforcement, and near-limit alert thresholds) |
| `/iblai-vibe-agent-dataset` | Add the agent Datasets tab (searchable dataset table with upload) |
| `/iblai-vibe-agent-disclaimer` | Add the agent Disclaimers tab (user agreement and advisory) |
| `/iblai-vibe-agent-embed` | Add the agent Embed tab (embed code, custom styling, shareable links) |
| `/iblai-vibe-agent-evals` | Add the agent Evals tab (benchmark evaluation runs with LLM-as-Judge reviews, manual scores, and CSV export) |
| `/iblai-vibe-agent-grader` | Add the agent Grader tab (rubric-based grading with a grading toggle, grading setup form, criteria table, and grade results with LMS-synced overrides) |
| `/iblai-vibe-agent-history` | Add the agent History tab (conversation history with filters and export) |
| `/iblai-vibe-agent-llm` | Add the agent LLM tab (model provider selection) |
| `/iblai-vibe-agent-lti` | Add the agent LTI tab (LTI 1.3 launch toggle with agent links, signing keys, tools, and platform endpoints) |
| `/iblai-vibe-agent-memory` | Add the agent Memory tab (enable/disable memory and manage memories) |
| `/iblai-vibe-agent-privacy` | Add the agent Privacy tab (PII detection and filtering with redact/mask/block actions) |
| `/iblai-vibe-agent-prompt` | Add the agent Prompts tab (system prompts and suggested prompts) |
| `/iblai-vibe-agent-safety` | Add the agent Safety tab (moderation prompts and flagged content) |
| `/iblai-vibe-agent-skills` | Add the agent Skills tab (reusable Agent Skills with per-agent assignment, private skills, file resources, and the chat `/` skill picker) |
| `/iblai-vibe-agent-task` | Add the agent Tasks tab (schedule automated periodic agent tasks with run logs) |
| `/iblai-vibe-agent-tool` | Add the agent Tools tab (enable/disable agent tools) |
| `/iblai-vibe-agent-support` | Add the agent Support tab (human support ticket inbox with availability toggle, filters, ticket detail, status updates, and replies) |
| `/iblai-vibe-agent-audit` | Add the agent Audit tab (audit log of who changed what and when, with user/date/action filters) |
| `/iblai-vibe-agent-chat-sidebar` | Wrap the Chat surface with the SDK's AppSidebar (projects dropdown, pinned/recent messages, host-supplied menu items) |
| `/iblai-vibe-agent-mcp` | Add the agent MCP tab (connector management — featured and custom connectors, OAuth, add/edit dialogs) |
| `/iblai-vibe-agent-sandbox` | Add the agent Sandbox tab (Computing Runtime / Virtual Machine Shell / Claw sandbox types, OpenClaw instances, agent prompt config) |
| `/iblai-vibe-agent-voice` | Add the agent Voice tab (pick the agent's voice and configure voice calls) |
| `/iblai-vibe-crm-overview` | Reference + family index for the CRM API (auth, seeded defaults, RBAC roles, sub-skill map) |
| `/iblai-vibe-monetization` | Family index for item-level monetization — Stripe Connect Express, paywalls, pricing tiers, checkout, subscriptions, revenue analytics |
| `/iblai-vibe-monetization-onboard` | Stripe Connect Express onboarding surface (status card, complete-setup / dashboard actions, the `is_ready_for_payments` gate) |
| `/iblai-vibe-monetization-configure` | Admin MonetizationTab + seller wizard (turn an agent/course/program/custom item into a paid product; paywall settings, pricing tiers) |
| `/iblai-vibe-monetization-checkout` | Buyer-facing PaywallModal, access check, Stripe checkout, and public/guest buy |
| `/iblai-vibe-monetization-subscription` | User PurchasesTab in the Profile (list, detail, cancel subscriptions) |
| `/iblai-vibe-monetization-analytics` | Revenue dashboards, subscriber lists, and paywalls-overview hooks for custom admin surfaces |
| `/iblai-vibe-monetization-app-paywall` | Pay-to-enter gate for the whole app on the tenant's own Stripe key (no Connect, no commission) |

### Companion repos

Two sibling repos complete the toolkit — the `/iblai-vibe` index skill
routes between all of them:

- [`iblai/api`](https://github.com/iblai/api) — `iblai-api-*` skills for
  operating the platform's REST API directly (agents, catalog, CRM,
  billing, analytics, infrastructure, …), plus a chat MCP server and
  tutorials. Installs stay in sync with the backend:

  ```bash
  npx skills add iblai/api
  ```

  The five families below are the ones most apps read or write.

- [`iblai/os`](https://github.com/iblai/os) — source of the Agentic OS
  ([os.ibl.ai](https://os.ibl.ai)), the flagship production app built on
  this same SDK. Read it as the reference implementation, or self-host it —
  or learn from the live app: see **Learn from a live tenant** above.

### Platform data most apps lean on

Most apps on the platform read or write the same five REST families. Each
entry: what it gives your app → the SDK entry points that call it from the
browser → the `/iblai-vibe-*` skill that mounts the UI → the `iblai/api`
skill (raw SKILL.md: endpoints, bodies, errors). Ask `@iblai/mcp`
(`get_api_query_info`, `get_component_info`) for the full hook/prop surface.

- **Per-user metadata** — one schemaless JSON object per user × org
  (`…/dm/api/core/users/platform-metadata/?platform_key=`). Preferences,
  feature flags, onboarding progress, app state — without localStorage or a
  database of your own. Auto-created on first GET (`{}`); PATCH merges
  (`metadata` + `delete_keys`), PUT replaces, DELETE resets; org admins add
  `&username=` to target another user. SDK: `useGetUserPlatformMetadataQuery`,
  `useUpdateUserPlatformMetadataMutation` (PATCH only — PUT, DELETE and
  `delete_keys` need a direct call). `OnboardingWizard` (`/web-containers`)
  saves its answers here under `onboarding`; os.ibl.ai keeps its per-user
  coding-mode preference here. No `/iblai-vibe-*` skill wraps this family —
  call the hooks.
  REST: [profile-metadata](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile-metadata/SKILL.md)
- **Agent settings** — one agent’s identity (name, description, categories,
  image), visibility, and capability flags (anonymous, featured, LTI,
  attachments, voice, memory, multi-query RAG, forkable). Everything saves
  through one `PUT …/mentors/{mentor}/settings/` (multipart, only the changed
  fields); fork copies the agent into any org you admin; delete is
  destructive. SDK: `useGetMentorSettingsQuery`, `useEditMentorMutation`
  (that PUT), `useForkMentorMutation`, `useDeleteMentorMutation`,
  `useGetMentorCategoriesQuery`. UI: `AgentSettingsProvider` +
  `AgentSettingsTab` (`/web-containers/next`) — the provider is the context
  every `/iblai-vibe-agent-*` tab skill mounts.
  Skill: `/iblai-vibe-agent-setting`. REST: [agent-setting](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-setting/SKILL.md)
- **Agent memory** — three stores: global memories (per user, every agent),
  agent memories (per user × agent, filed under categories with extraction
  prompts), and agent knowledge (per agent, no user, curated, injected into
  every chat as `## Agent Knowledge`). Show users what an agent remembers,
  let them add or delete facts, toggle capture/recall
  (`auto_capture_enabled`, `use_memory_in_responses`); the org flag
  `enable_memsearch` gates it all. SDK (`features/memory`):
  `useGetUserMemorySettingsQuery` / `useUpdateUserMemorySettingsMutation`,
  `useGetGlobalMemoriesQuery`, `useGetMentorMemoriesListQuery`,
  `useCreateMentorMemoryMutation`, `useGetMemsearchStatusQuery`; agent
  knowledge is REST-only today. UI: `AgentMemoryTab` (`/next`), the
  `Profile` Memory tab, `Account targetTab="memory"`.
  Skills: `/iblai-vibe-agent-memory` (one agent), `/iblai-vibe-memory`
  (whole org). REST: [agent-memory](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-memory/SKILL.md)
- **Analytics** — one `/dm/api/analytics/` family; `mentor_unique_id`
  present = one agent, absent = the whole org. Usage and engagement KPIs,
  transcripts, catalog engagement, costs (already marked-up USD), per-user
  learning snapshots (self-access needs no grant), audit logs of agent
  changes, async Data Reports (POST → poll → CSV/JSON). SDK
  (`features/analytics`): `useGetTopicsStatsQuery`, `useGetUsersStatsQuery`,
  `useGetSessionStatsQuery`, `useGetFinancialStatsQuery`,
  `useGetTranscriptsMessagesQuery`, `useGetLearnerDetailsQuery`,
  `useTimeTrackingMutation`; reports `useGetReportsQuery` /
  `useCreateReportMutation`; audit `useGetAuditLogsQuery`; `llm-usage/`
  (per-model/-user cost, tokens, latency) is REST-only. UI:
  `AnalyticsLayout`, `AnalyticsOverview`, `AnalyticsUsersStats`,
  `AnalyticsFinancialStats`, `AnalyticsTranscriptsStats`,
  `AnalyticsReports`, `AnalyticsAuditLogStats`, `AgentAnalyticsTab`.
  Skills: `/iblai-vibe-analytics`, `/iblai-vibe-agent-audit`. The live
  schema is the contract: `https://api.iblai.app/dm/api/docs/schema/`.
  REST: [analytics](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-analytics/SKILL.md)
- **Profile** — the signed-in user’s own record: account fields (name, bio,
  language, social links, image) on the LMS host via `merge-patch+json`,
  career records (education, experience, résumé) under
  `…/dm/api/career/…`, and their own memory toggles. Any “me” page,
  avatar/dropdown, or résumé feature. vibe-starter’s `/profile` page only
  reads the SSO cache (`localStorage.userData`) — for live or editable data
  use the hooks or mount `Profile`. SDK: `useGetUserMetadataQuery`,
  `useUpdateUserMetadataEdxMutation`, `useUploadProfileImageMutation`
  (`features/user`); `useGetUserEducationQuery`,
  `useGetUserExperienceQuery`, `useGetUserResumeQuery` (`features/career`).
  UI: `Profile` (+ `EducationTab` / `ExperienceTab` / `ResumeTab`),
  `UserProfileDropdown`, `UserProfileModal`, `Account` (`/next`).
  Skills: `/iblai-vibe-profile`, `/iblai-vibe-account`, `/iblai-vibe-history`.
  REST: [profile](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile/SKILL.md)

**Auth on the wire.** In the browser the SDK sends `Authorization: Token
<dm_token>` (session tokens in localStorage `dm_token` / `axd_token`), so
every hook above works with the signed-in user’s session and permissions —
no API key. The REST skills send `Authorization: Api-Token $IBLAI_API_KEY`,
a Platform API Token (`TOKEN` in `iblai.env`, `IBLAI_API_KEY` in
`.env.local`): server-side only, never in client code. REST base is
`https://api.iblai.app/dm` (profile account fields: `…/lms`).

### Marketing Skills

The marketing skill catalogue (43 skills covering CRO, copywriting, SEO,
paid ads, lifecycle email, growth, etc.) lives in the companion
[`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing) repo
alongside `tools/` (62 platform CLIs + 80 integration guides). Install
side-by-side with vibe:

```bash
npx skills add iblai/vibe-marketing
```

### Security Skills

Authorized-use defensive security and CTF-style skills — reconnaissance,
source-code audits, OSINT correlation, forensics, incident triage, cloud
configuration auditing, dependency vulnerabilities, and prompt-injection
testing.

| Skill | Description |
|-------|-------------|
| `/iblai-vibe-security-recon` | Attack-surface enumeration for authorized pentests, bug bounty, CTF |
| `/iblai-vibe-security-owasp-audit` | Source-code security audit against OWASP Top 10 (2021) |
| `/iblai-vibe-security-osint-recon` | Open-source intelligence gathering and correlation |
| `/iblai-vibe-security-disk-forensics` | Disk image analysis, evidence recovery, timeline reconstruction |
| `/iblai-vibe-security-incident-triage` | Security-incident triage following NIST SP 800-61 |
| `/iblai-vibe-security-cloud-audit` | AWS / GCP / Azure misconfiguration and IAM auditing |
| `/iblai-vibe-security-dependency-audit` | Third-party dependency vulnerability and supply-chain audit |
| `/iblai-vibe-security-prompt-injection` | Test LLM applications for prompt-injection vulnerabilities |


## Deployment

### ibl.ai hosting (Vercel)

Deploy through the platform's hosting API — see
[`/iblai-vibe-ops-deploy`](skills/iblai-vibe-ops-deploy/SKILL.md). It zips
the app (project source; for static `output: 'export'` builds, `out/`),
uploads it with the platform API key, polls until READY, and updates
`devUrl`. No Vercel token or CLI.

### Docker
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app
```

### Desktop/Mobile (Tauri v2)

Add the Tauri shell (see [`/iblai-vibe-ops-build`](skills/iblai-vibe-ops-build/SKILL.md)),
then run Tauri directly:
```bash
pnpm exec tauri dev          # Dev mode
pnpm exec tauri build        # Production build
pnpm exec tauri ios init     # iOS project setup
```

### App Store / Google Play submission

Generate a `Makefile` + Fastlane config that builds and submits to the Apple
App Store and Google Play — see
[`/iblai-vibe-ops-release`](skills/iblai-vibe-ops-release/SKILL.md)
(`make ios-release`, `make android-release`; handles App Store Connect API key
and Play service-account credentials).

THIS PROJECT ALREADY HAS GIT INITIALIZED. DO NOT INITIALIZE GIT.
