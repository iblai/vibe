# CLAUDE.md

Guidance for AI assistants working in **iblai/vibe** — the toolkit for
building apps on the [ibl.ai](https://ibl.ai) platform. A builder brings an
organization (from [ibl.ai/join](https://ibl.ai/join)) and an idea; the
platform brings SSO, agents, RAG, LLMs, memory, analytics, and a
Stripe-backed credit meter; vibe brings the components and the skills that
wire them in. The promise: sign-in, an agent to talk to, users and admins,
custom user and org data, memory, analytics, billing — as one app on web,
macOS, Windows, iOS, and Android — in about twenty minutes.

## Start here — what the user says → what to do

| The user says… | Do this |
|---|---|
| "new app", "start a project", "scaffold" | `/iblai-vibe-ops-init` — copies vibe-starter, asks only for the org key and a Platform API Token (refuses `main`), verifies both, writes the env files |
| "chat", "talk to the agent", "assistant" | The starter's `/` already chats; it needs an agent — `/setup` (pick or create) or `/iblai-vibe-agent-create`; customize with `/iblai-vibe-agent-chat` |
| "create an agent", "another agent" | `/iblai-vibe-agent-create` ★ → `/iblai-vibe-agent-setting` ★; every tab via `/iblai-vibe-agent` |
| "users", "admins", "roles", "invite", "who can" | `/iblai-vibe-admin` (User/Admin mode, `/admin/users`), `/iblai-vibe-invite`, `/iblai-vibe-rbac` |
| "store something per user", "preferences", "onboarding progress", "custom user fields" | `/iblai-vibe-user-metadata` ★ — never localStorage, never your own DB |
| "organization setting", "white-label", "per-org config" | `/iblai-vibe-org-metadata` (GET-merge-PUT) + `/iblai-vibe-account` |
| "profile", "avatar", "résumé" | `/iblai-vibe-profile` ★ |
| "remember", "memory", "personalize" | `/iblai-vibe-memory-guide` ★ → `/iblai-vibe-memory`, `/iblai-vibe-agent-memory` |
| "analytics", "usage", "costs", "transcripts", "who changed what" | `/iblai-vibe-analytics` ★, `/iblai-vibe-agent-audit`, `/iblai-vibe-history` |
| "charge", "pricing", "paywall", "credits", "spend limit" | `/iblai-vibe-pricing` → the rail it picks |
| "deploy", "URL", "share it" | `/iblai-vibe-ops-deploy` |
| "iOS", "Android", "Mac", "Windows", "App Store" | `/iblai-vibe-ops-build`, `/iblai-vibe-ops-release`, `/iblai-vibe-windows-msix` |
| anything with no component | `/iblai-vibe-api` — server route + `Api-Token`, and the matching `iblai/api` skill |
| "is it done?", "show me" | `/iblai-vibe-ops-test` first: `pnpm build`, `pnpm test`, screenshot |

Rules that never change: SDK components → shadcn/ui → custom, in that order;
`pnpm install --ignore-scripts`; lowercase project names; ask for a real agent
UUID, never invent one; never print a token; the generated app lives in the
current directory. Terms: *organization (org)*, *org key*, *agent*, *member*,
*admin* — see [docs/glossary.md](docs/glossary.md); keep wire names
(`platform_key`, `mentor`, `tenant`) verbatim in code.

## The platform lifecycle in ten lines

1. `ibl.ai/join` creates the account **and** the user's organization. Everyone is also in the shared `main` org — never build on it.
2. `os.ibl.ai/platform/<org-key>/…` is the reference app *and* the org's admin console (User/Admin toggle top-right).
3. Org key: on `login.iblai.app/me`, or the path segment after `/platform/`. Check: `GET https://api.iblai.app/dm/api/core/orgs/<key>/metadata/` → 200 (public).
4. Platform API Token: OS → Admin → Integrations → APIs → Add API (shown once), or `/iblai-api-login`, or an org secret. Check: `GET /dm/api/core/token/verify/` with `Authorization: Api-Token …` → 200 + `username`.
5. Credits: prepaid, rechargeable, a hard ceiling; plans Free/Trial/Premium; spend caps at org/agent/user scope.
6. LLM keys: OS → Integrations → LLMs — more models for agents.
7. Agents: created in the OS, on `/setup`, or via the API; the UUID at the end of the OS URL is what every chat skill needs.
8. People: OS → Management → Users (Admin/User + policies), invites; the same surface `/iblai-vibe-admin` mounts.
9. Every origin the app runs on must be in the org's allowed redirect origins, or sign-in never returns.
10. Charging your users is a separate decision: `/iblai-vibe-pricing`.

Full guide with screenshots: [docs/platform-lifecycle.md](docs/platform-lifecycle.md).
Credentials, tokens, and why session tokens live in localStorage:
[docs/security-model.md](docs/security-model.md).

## Credentials — the ladder every skill follows

1. `iblai.env` already has real `PLATFORM` and `TOKEN` → use them.
2. The host exports `IBLAI_PLATFORM_KEY`, `IBLAI_API_KEY`, `IBLAI_USERNAME` (the ibl.ai desktop app does) → use them, never ask.
3. Otherwise ask for what is missing, saying where it comes from (lifecycle steps 3–4). Verify both with the two curls before writing. Refuse `main` and placeholders.
4. Write `iblai.env` (`DOMAIN`, `PLATFORM`, `TOKEN`, `IBLAI_USERNAME`) and `.env.local` (`NEXT_PUBLIC_MAIN_TENANT_KEY` ← `PLATFORM`, `IBLAI_API_KEY` ← `TOKEN`). Both are gitignored. Confirm with a masked value only.

`iblai.env` is **not** a `.env.local` replacement — it holds the platform
shorthand; Next.js reads `.env.local`. The API/auth/websocket URLs default to
hosted `iblai.app` in `lib/iblai/config.ts`; when `DOMAIN` is anything else,
also map `NEXT_PUBLIC_PLATFORM_BASE_DOMAIN` ← `DOMAIN`,
`NEXT_PUBLIC_API_BASE_URL` ← `https://api.<DOMAIN>`, and the sign-in URL from
the session guidance (the auth host is not derivable from the domain).
`IBLAI_API_KEY` is server-side only; it is also a standard OpenAI-style key
on `https://asgi.data.<domain>/api/ai-mentor/orgs/<org>/v1` (`Bearer`).

## The core app — what vibe-starter already is

`/iblai-vibe-ops-init` copies `skills/iblai-vibe-ops-init/assets/vibe-starter`:
Next.js 16 + Tailwind v4 + shadcn/ui with SSO; **home = chat with the app's
agent**; `/agents`; `/profile` + per-user app preferences; **User/Admin mode**
with an admin area (`/admin/users` + invites, `/admin/analytics/*`,
`/admin/billing`, `/admin/memory`, `/admin/organization` + org settings);
`/setup` (admins name the app, pick or create the agent); typed
`useUserSettings` / `useOrgSettings` on the platform; `lib/iblai/platform.ts`
for REST without a component; Vitest + Playwright journeys. Its `AGENTS.md`
is the CLAUDE.md that ops-init writes into projects.

### The Core Twelve

★ = the five platform families most apps read or write (deepest skills; each
links its `iblai/api` REST reference).

| # | Capability | SDK surface | Skill |
|---|---|---|---|
| 1 | Sign-in, session, org resolution | `AuthProvider`, `TenantProvider`, `SsoLogin`, `useUserData`, `useIsAdmin` | `/iblai-vibe-auth` (starter) |
| 2 | Home that chats with the app's agent | `Chat` (`/next`), `AppSidebar`, `NavBar` | `/iblai-vibe-agent-chat` (starter `/`) |
| 3 | Find / pick agents | `AgentSearch` | `/iblai-vibe-agent-search` (starter `/agents`) |
| 4 ★ | Create + configure an agent | server route; `AgentSettingsProvider` + `AgentSettingsTab` (+23 tabs) | `/iblai-vibe-agent-create`, `/iblai-vibe-agent-setting`, `/iblai-vibe-agent` |
| 5 ★ | The user's own profile | `Profile`, `UserProfileDropdown`, `useGetUserMetadataQuery` | `/iblai-vibe-profile` (starter) |
| 6 ★ | Custom per-user data | `useGetUserPlatformMetadataQuery`, `useUpdateUserPlatformMetadataMutation` | `/iblai-vibe-user-metadata` (starter) |
| 7 | Org settings + custom org data | `Account` → `OrganizationTab`; `useGetTenantMetadataQuery`, `useUpdateTenantMetadataMutation` | `/iblai-vibe-org-metadata`, `/iblai-vibe-account` (starter) |
| 8 | Users vs admins: directory, invites, roles, User/Admin mode | `Admin`, `UsersTab`, `RolesTab`, `PoliciesTab`, `InviteUserDialog`, `checkRbacPermission` | `/iblai-vibe-admin` (starter), `/iblai-vibe-invite`, `/iblai-vibe-rbac` |
| 9 ★ | Memory: user-global, per-agent, agent knowledge | `useGetGlobalMemoriesQuery`, `useGetUserMemorySettingsQuery`, `AgentMemoryTab`, `Account targetTab="memory"` | `/iblai-vibe-memory-guide`, `/iblai-vibe-memory` (starter), `/iblai-vibe-agent-memory` |
| 10 ★ | Analytics, transcripts, costs, audit, reports | `AnalyticsLayout` + tabs, `AgentAnalyticsTab` | `/iblai-vibe-analytics` (starter), `/iblai-vibe-agent-audit`, `/iblai-vibe-history` |
| 11 | Notifications | `NotificationDropdown`, `NotificationDisplay` | `/iblai-vibe-notification` (starter) |
| 12 | Money: credits, spend caps, your own pricing | `CreditBalance`, `BillingTab`, spend-cap hooks; paywall assets | `/iblai-vibe-pricing`, `/iblai-vibe-credit`, `/iblai-vibe-billing`, `/iblai-vibe-agent-billing`, `/iblai-vibe-monetization-app-paywall` |
| + | Ship everywhere | — | `/iblai-vibe-ops-deploy`, `/iblai-vibe-ops-build`, `/iblai-vibe-ops-release` |
| + | No component? | `lib/iblai/platform.ts` | `/iblai-vibe-api` |

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


## Skill catalogue by tier

Skills live in `skills/<name>/SKILL.md`; invoke with `/` in Claude Code.
Tier decides position and depth: Tier 0/1 skills get screenshots, the
feature template (`templates/skill-template-feature.md`), and ≤ 400 lines.

**Tier 0 — run first**

| Skill | Description |
|-------|-------------|
| `/iblai-vibe` | Start here — what you want → which skill |
| `/iblai-vibe-ops-init` | New project from vibe-starter; credentials ladder; writes the project CLAUDE.md |
| `/iblai-vibe-auth` | SSO auth for an existing Next.js app (providers, store, `lib/iblai/*`) |
| `/iblai-vibe-ops-test` | Test before showing work (Vitest, Playwright, screenshots) |
| `/iblai-vibe-ops-deploy` | Deploy through the platform's hosting API (Vercel-backed), containers, static hosts |

**Tier 1 — the core app** (journey order)

| Skill | Description |
|-------|-------------|
| `/iblai-vibe-agent-chat` | The in-process chat surface (message stream, canvas, voice, prompts) |
| `/iblai-vibe-agent-chat-sidebar` | Wrap the chat with the SDK sidebar (projects, pinned/recent) |
| `/iblai-vibe-project` | Projects surface (files, instructions, assigned agents) |
| `/iblai-vibe-agent-search` | Agent browser (starred, featured, custom, all) |
| `/iblai-vibe-agent-create` ★ | Create an agent from the app (server route + setup screen) |
| `/iblai-vibe-agent-setting` ★ | Agent identity, visibility, copy, delete |
| `/iblai-vibe-agent` | Family index for all 24 agent settings tabs |
| `/iblai-vibe-profile` ★ | Profile dropdown + settings page |
| `/iblai-vibe-user-metadata` ★ | Custom per-user data on the platform |
| `/iblai-vibe-account` | Account/org settings page (Organization, Management, Integrations, Advanced, Billing, Memory) |
| `/iblai-vibe-org-metadata` | Custom org data; GET-merge-PUT; where branding lives |
| `/iblai-vibe-admin` | User/Admin mode and the admin area |
| `/iblai-vibe-invite` | Invitation dialogs |
| `/iblai-vibe-rbac` | Roles, policies, action definitions, `checkRbacPermission` |
| `/iblai-vibe-navbar` | Responsive navbar (logo, links, bell, profile) |
| `/iblai-vibe-notification` | Notification bell + center |
| `/iblai-vibe-memory-guide` ★ | What memory means for your app; which surface for which audience |
| `/iblai-vibe-memory` | Org-wide memory admin |
| `/iblai-vibe-agent-memory` ★ | One agent's Memory tab |
| `/iblai-vibe-analytics` ★ | Analytics dashboard (org-wide or per agent) |
| `/iblai-vibe-agent-audit` | Agent audit log |
| `/iblai-vibe-history` | The user's own conversation history + exports |
| `/iblai-vibe-pricing` | How money works; which rail to charge users |
| `/iblai-vibe-credit` | Credit balance widget |
| `/iblai-vibe-billing` | Org Billing: plan & credits, spend limits, agent limits |
| `/iblai-vibe-agent-billing` | One agent's spend cap and per-user caps |
| `/iblai-vibe-monetization-app-paywall` | Pay-to-enter on the org's own Stripe key |
| `/iblai-vibe-api` | REST without a component: server route + `Api-Token`; map to `iblai/api` |

**Tier 2 — agent configuration** (after you have an agent): `/iblai-vibe-agent`
indexes the 24 tabs — `access`, `api`, `audit`, `billing`, `dataset`,
`disclaimer`, `embed`, `evals`, `grader`, `history`, `llm`, `lti`, `mcp`,
`memory`, `privacy`, `prompt`, `safety`, `sandbox`, `setting`, `skills`,
`support`, `task`, `tool`, `voice` — each `/iblai-vibe-agent-<tab>`.

**Tier 3 — vertical / optional**: `/iblai-vibe-monetization` (family index for
selling items via Stripe Connect: `/iblai-vibe-monetization-onboard`,
`/iblai-vibe-monetization-configure`, `/iblai-vibe-monetization-checkout`,
`/iblai-vibe-monetization-subscription`, `/iblai-vibe-monetization-analytics`), `/iblai-vibe-application` (admissions gate),
`/iblai-vibe-course-access`, `/iblai-vibe-course-create`,
`/iblai-vibe-crm-overview`, `/iblai-vibe-workflow`, `/iblai-vibe-onboard`,
`/iblai-vibe-local-llm`.

**Tier 4 — ops and polish**: `/iblai-vibe-ops-build` (macOS, Windows, iOS,
Android via Tauri v2), `/iblai-vibe-ops-release` (App Store / Play),
`/iblai-vibe-windows-msix`, `/iblai-vibe-iconography`, `/iblai-vibe-ops-upgrade`,
`/iblai-vibe-readme`, `/iblai-vibe-design`, `/iblai-vibe-deslop`,
`/iblai-vibe-scaffold`, `/iblai-vibe-component`, `/iblai-vibe-credential`.

**Tier 5 — security (unrelated to building on the platform; authorized use
only)**: `/iblai-vibe-security-recon`, `/iblai-vibe-security-owasp-audit`,
`/iblai-vibe-security-osint-recon`, `/iblai-vibe-security-disk-forensics`,
`/iblai-vibe-security-incident-triage`, `/iblai-vibe-security-cloud-audit`,
`/iblai-vibe-security-dependency-audit`, `/iblai-vibe-security-prompt-injection`.

### Companion repos

- [`iblai/api`](https://github.com/iblai/api) — `iblai-api-*` skills for every REST family (`npx skills add iblai/api`); the ★ families: [profile-metadata](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile-metadata/SKILL.md), [profile](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile/SKILL.md), [agent-setting](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-setting/SKILL.md), [agent-memory](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-memory/SKILL.md), [analytics](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-analytics/SKILL.md).
- [`iblai/os`](https://github.com/iblai/os) — the Agentic OS: reference implementation and the org's admin console.
- [`iblai/vibe-agent`](https://github.com/iblai/vibe-agent) — a finished one-agent app with its own paywall; the model for user-first app writing.
- [`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing) — 43 marketing skills (CRO, copywriting, SEO, paid ads, lifecycle, growth) plus platform CLIs and integration guides (`npx skills add iblai/vibe-marketing`).

## Verifying the SDK surface

`.mcp.json` configures `@iblai/mcp` (`pnpm dlx @iblai/mcp` in pnpm projects).
Before using a hook or component name, confirm it exists:

```
get_component_info("Chat")                    # Props, usage, examples
get_hook_info("useAdminMode")                 # (host hooks aren't in MCP — read the file)
get_api_query_info("useGetUserPlatformMetadataQuery")
get_provider_setup("auth")
```

or grep the installed `.d.ts` (`node_modules/.pnpm/@iblai+*/…/dist/**/*.d.ts`).
The `.d.ts` lags the runtime in places — verify against the bundle when a
documented prop is missing.

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

## Brand

- **Primary**: `#0058cc` (brand blue)
- **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack
- **Style**: shadcn/ui new-york variant, neutral base, Lucide icons

See [BRAND.md](BRAND.md) for the complete brand guidelines.

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

Asset-bearing skills map their templates to app paths in `skills/<name>/test.json`;
justified typecheck skips live in `scripts/skill-render-skips.json`. Screenshot
conventions: [docs/screenshots/README.md](docs/screenshots/README.md).
`scripts/check-skill-tables.mjs` fails when a skill directory is missing from
this catalogue or vice versa.

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

THIS PROJECT ALREADY HAS GIT INITIALIZED. DO NOT INITIALIZE GIT.
