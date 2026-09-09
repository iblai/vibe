# iblai-vibe-ops-init

> Start a new ibl.ai project by default, scaffold from the bundled vibe-starter template, and write the project CLAUDE.md with ibl.ai platform guidance. Use this when the user says "start a new project", "new app", "scaffold an app", "new ibl.ai project", or asks to bootstrap an ibl.ai codebase from scratch. Also use to refresh CLAUDE.md in an existing ibl.ai project.

# /iblai-vibe-ops-init

Bootstrap a new ibl.ai project (defaults to scaffolding from the bundled
vibe-starter template) and write
or update the project's `CLAUDE.md` with ibl.ai platform guidance. The
CLAUDE.md tells Claude Code how to work with the project -- which components
to use, how to add features, and what patterns to follow.

## What This Skill Does

1. **If the working directory is empty / a brand-new project:** scaffold
   from the bundled vibe-starter (Step 0) before doing anything else
2. Check if `CLAUDE.md` already exists in the project root
3. If it exists, **merge** the ibl.ai section into it (do not overwrite
   existing content)
4. If it does not exist, **create** it with the full ibl.ai guidance below

## Step -1: The first conversation

If `iblai.env` lacks `ARCHITECTURE=` / `ACCESS=` / `DOMAIN_FOCUS=`, run
`/iblai-vibe-start` first (four questions, two minutes). vibe-starter is a
**single-organization** app — the common case; `multi-org` continues with
`/iblai-vibe-auth` → "Going multi-org" after the scaffold, and `headless`
skips this skill for `/iblai-api-login`. Write the answers into the generated
CLAUDE.md's `## Decisions` block (Step 2).

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

- **If they say yes / use it / vibe-starter:** materialize the starter (below).
- **If they say no / skip:** go straight to Step 1 to write CLAUDE.md,
  then resume whatever the user originally asked for. Do NOT scaffold a
  vanilla Next.js app -- the user said skip.

### Materialize the starter (only if the user said yes)

The starter template ships with this skill, in the `assets/vibe-starter/`
directory beside this SKILL.md. Copy it into the project root (`cp -a`
keeps the dotfiles), then install:

```bash
cp -a <this-skill-dir>/assets/vibe-starter/. .
pnpm install --ignore-scripts
git init   # only if the project is not already a git repo
```

> Run with `--ignore-scripts` to skip package lifecycle (postinstall) scripts.

If this skill was installed without its `assets/` directory (some
installers ship only the SKILL.md), fetch the template from the vibe repo
instead -- tell the user that is the path you are taking:

```bash
git clone --depth 1 https://github.com/iblai/vibe.git vibe-tmp
cp -a vibe-tmp/skills/iblai-vibe-ops-init/assets/vibe-starter/. . && rm -rf vibe-tmp
pnpm install --ignore-scripts
git init   # only if the project is not already a git repo
```

### Resolve platform credentials and write env files

After the copy completes, climb this ladder and stop at the first rung that
yields both values. Inside the ibl.ai desktop app both rungs 1 and 2 hit, so
the user is asked nothing:

1. **`iblai.env` already exists with real values for both `PLATFORM` and
   `TOKEN`** -- reuse them and skip the prompts entirely.

2. **Otherwise read them from the environment.** The ibl.ai desktop app
   exports `IBLAI_API_KEY`, `IBLAI_PLATFORM_KEY`, and `IBLAI_USERNAME` into
   the agent's environment. Use whatever is present without asking for it and
   without echoing it back:

   ```bash
   PLATFORM="${IBLAI_PLATFORM_KEY:-}"
   TOKEN="${IBLAI_API_KEY:-}"
   ```

   When `IBLAI_USERNAME` is exported, persist it to `iblai.env` as well --
   that saves `/iblai-vibe-ops-deploy` asking for it later.

3. **Ask only for the values still missing** -- standalone opencode / Claude
   Code users outside the desktop app. Say where each value comes from; never
   ask for a password.

   > What is your ibl.ai **PLATFORM** (organization key)? It is listed on
   > https://login.iblai.app/me next to each organization you belong to, and
   > it is the segment after `/platform/` in any os.ibl.ai URL. **Not `main`** --
   > that is the shared org everyone is in; if you only see `main`, create your
   > own at https://ibl.ai/join first.

   > What is your ibl.ai **TOKEN** (Platform API Token)? Create one in the OS:
   > https://os.ibl.ai → switch the top-right toggle to **Admin** → settings →
   > **Integrations** → **APIs** tab → **Add API** → name it after this app,
   > leave the expiry empty, keep Owner permissions → Submit. The secret is
   > shown once -- paste it here. (Alternatives: `/iblai-api-login` from
   > `npx skills add iblai/vibe --all` mints it from your signed-in session; an org
   > secret works too.)

   Never ask for `TOKEN` when `IBLAI_API_KEY` is exported -- the environment
   already answered it. Refuse `main` and the placeholders (`your-platform`,
   `your-tenant`, …) and ask again.

4. **Verify both before writing anything** (values in shell variables, never
   echoed):

   ```bash
   curl -fsS -o /dev/null "https://api.${DOMAIN:-iblai.app}/dm/api/core/orgs/$PLATFORM/metadata/" \
     && echo "org key ok" || echo "org key not found (typo?)"
   USERNAME_JSON=$(curl -fsS -H "Authorization: Api-Token $TOKEN" \
     "https://api.${DOMAIN:-iblai.app}/dm/api/core/token/verify/") \
     && echo "token ok" || echo "token refused -- ask for it again"
   IBLAI_USERNAME="${IBLAI_USERNAME:-$(printf '%s' "$USERNAME_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("username",""))')}"
   ```

   A 404 on the first call means the org key is wrong; a 401 on the second
   means the token is wrong. `token/verify/` also returns the `username` --
   persist it as `IBLAI_USERNAME` so `/iblai-vibe-ops-deploy` never has to ask.

Then write the values to both files:

1. **`iblai.env`** -- create if missing, or update the `PLATFORM` and `TOKEN`
   lines in place. `DOMAIN` is the platform's **base domain**: inside the
   ibl.ai desktop app your session guidance states it ("The platform's base
   domain is …") -- write exactly that value, and if an existing `iblai.env`
   disagrees with it, update `DOMAIN` to match (a stale domain sends every
   skill to the wrong host). Outside the desktop app keep whatever the user
   already set, defaulting to `iblai.app`. Example contents:

   ```
   DOMAIN=iblai.app
   PLATFORM=<the value the user gave>
   TOKEN=<the value the user gave>
   ```

2. **`.env.local`** -- write directly. Do NOT re-run any scaffolding (e.g.
   the `/iblai-vibe-auth` file generation) -- the starter already has everything
   wired and regenerating those files can clobber the starter's versions.
   If `.env.local` does not exist yet, copy the starter's example first
   (`cp .env.example .env.local`), then update or append both lines (write
   `TOKEN` as `IBLAI_API_KEY`). The API/auth/websocket URLs default to
   hosted iblai.app in `lib/iblai/config.ts`, so when `DOMAIN` is
   `iblai.app` these two values are all that must change:

   ```
   NEXT_PUBLIC_MAIN_TENANT_KEY=<PLATFORM>
   IBLAI_API_KEY=<TOKEN>
   ```

   When `DOMAIN` is anything else, the hosted defaults would point at the
   wrong platform -- also write, from the same `DOMAIN` (and the sign-in URL
   your session guidance states, if it states one; the auth host is NOT
   derivable from the domain, so never guess it):

   ```
   NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=<DOMAIN>
   NEXT_PUBLIC_API_BASE_URL=https://api.<DOMAIN>
   NEXT_PUBLIC_AUTH_URL=<the sign-in URL from the session guidance, when given>
   ```

Do NOT print or echo the `TOKEN` / `IBLAI_API_KEY` value back to the user
once captured -- confirm with a masked form only (`abc…z9`). Write
`IBLAI_USERNAME=<username>` to `iblai.env` as well when known.

Then tell the user the two things the platform must know about this app:

- **Allowed redirect origins:** `http://localhost:3000` now, and the deployed
  URL after `/iblai-vibe-ops-deploy`. If sign-in redirects to
  `login.iblai.app` and never comes back, this is the cause -- ask the ibl.ai
  operator to add the origin.
- **The app's agent:** none is needed to start -- the first admin to sign in
  lands on `/setup` to pick or create one. If the user already gave an
  os.ibl.ai URL (`https://os.ibl.ai/platform/<org-key>/<agent-uuid>`), write
  the UUID to `.env.local` as `NEXT_PUBLIC_DEFAULT_AGENT_ID` now.

`IBLAI_API_KEY` also unlocks LLM features without any separate provider key:
it is a standard OpenAI api key on the platform's OpenAI-compatible endpoint.
Point any OpenAI client at
`base_url = https://asgi.data.{DOMAIN}/api/ai-mentor/orgs/{PLATFORM}/v1` with
the key as `api_key` (sent as `Authorization: Bearer …`) for chat completions
(including streaming) and model listing (`GET /models` returns what the
platform can actually serve). Server-side only, like every other use of the
key — never in client code. Note the `Bearer` scheme applies to this `/v1`
surface only; all other platform APIs keep `Authorization: Api-Token`.

After the starter is in place, the user's project already has sign-in, a
home page that chats with the app's agent, an agents browser, profile with
app preferences, User/Admin mode with an admin area (users, analytics,
billing, memory, organization), per-user and per-org settings on the
platform, a first-run `/setup`, and the server helper for REST calls. They
can skip `/iblai-vibe-auth`, `/iblai-vibe-navbar`, `/iblai-vibe-profile`,
`/iblai-vibe-account`, `/iblai-vibe-notification`, `/iblai-vibe-agent-search`,
`/iblai-vibe-admin`, `/iblai-vibe-user-metadata`, `/iblai-vibe-org-metadata`,
`/iblai-vibe-agent-create`, `/iblai-vibe-analytics`, and `/iblai-vibe-api` --
those are wired. Next steps to offer: `pnpm dev` → sign in → `/setup`; then
`/iblai-vibe-ops-deploy` for a URL and `/iblai-vibe-ops-build` for
macOS/Windows/iOS/Android.

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

The generated file is the same `AGENTS.md` that ships in vibe-starter (kept
in sync: `assets/vibe-starter/AGENTS.md` is the source of truth). For a
project that did not come from the starter, keep the "Start here" table and
the rules, and trim the "Map of this app" to the files that exist.

```markdown
# CLAUDE.md

This project is built on the ibl.ai platform using the `@iblai/iblai-js` SDK.
It was scaffolded from **vibe-starter** and already has: SSO sign-in, a home
page that chats with the app's agent, an agents browser, profile with app
preferences, an admin area (users, analytics, billing, memory, organization)
that only org admins see, typed per-user and per-org settings on the
platform, and a first-run `/setup`.

## Decisions (from /iblai-vibe-start)

Read `iblai.env` for `PROJECT`, `ARCHITECTURE`, `ACCESS`, `DOMAIN_FOCUS`;
if they are missing, run `/iblai-vibe-start` before substantial work and
record the answers here:

- Project: new
- Architecture: single-org — this app is pinned to one organization (`NEXT_PUBLIC_MAIN_TENANT_KEY`); members sign in with SSO; the server holds that org's Platform API Token. Multi-org: `/iblai-vibe-auth` → "Going multi-org".
- Access: members (add a public agent route to `PUBLIC_ROUTES` + `allow_anonymous` for `public`)
- Focus: users, agents

## Start here — what the user says → what to do

| The user says… | Do this |
|---|---|
| "who signs in", "one org or many", "make it multi-tenant", "public agent" | `/iblai-vibe-start` (re-run to change the decisions above); mechanics in the vibe repo's `docs/auth-model.md` |
| "chat", "the agent", "assistant" | Already on `/`. No agent yet? An admin runs `/setup` (pick or create). Customize with `/iblai-vibe-agent-chat`. |
| "create an agent", "another agent" | `/iblai-vibe-agent-create` → then `/iblai-vibe-agent-setting` and the tabs in `/iblai-vibe-agent` |
| "users", "admins", "roles", "invite", "who can" | `/iblai-vibe-admin` (User/Admin mode, `/admin/users`), `/iblai-vibe-invite`, `/iblai-vibe-rbac` |
| "remember the user's…", "preferences", "onboarding progress", "custom user fields" | `/iblai-vibe-user-metadata` (`useUserSettings` in `lib/iblai/metadata.ts`) — never localStorage, never your own DB |
| "organization setting", "white-label", "app-wide config" | `/iblai-vibe-org-metadata` (`useOrgSettings`, GET-merge-PUT) + `/iblai-vibe-account` |
| "profile", "avatar", "résumé" | `/iblai-vibe-profile` (already on `/profile`) |
| "remember", "memory", "personalize" | `/iblai-vibe-memory-guide` → `/iblai-vibe-memory`, `/iblai-vibe-agent-memory` |
| "analytics", "usage", "costs", "transcripts", "audit" | `/iblai-vibe-analytics` (already on `/admin/analytics`), `/iblai-vibe-agent-audit` |
| "charge", "pricing", "paywall", "credits", "spend limit" | `/iblai-vibe-pricing` → the rail it picks |
| "notifications" | `/iblai-vibe-notification` (already on `/notifications`) |
| "deploy", "URL", "share it" | `/iblai-vibe-ops-deploy` |
| "iOS", "Android", "Mac", "Windows", "App Store" | `/iblai-vibe-ops-build`, `/iblai-vibe-ops-release` |
| anything with no component | `/iblai-vibe-api` — server route + `Api-Token`, and the matching `iblai-api-*` skill |
| "tests", "before you show me" | `/iblai-vibe-ops-test` — `pnpm build`, `pnpm test`, screenshot |

**Freshness rule:** the installed skills are a copy of
[iblai/vibe](https://github.com/iblai/vibe), which changes often. If
`.claude/skills/iblai-vibe/SKILL.md` is older than 14 days or older than the
latest release, suggest `/iblai-vibe-ops-upgrade` before substantial work.

Two skill families are installed: `iblai-vibe-*` (mount visual components,
build, ship — this app) and `iblai-api-*` (headless REST, no screen — for
scripts, CI, server routes, and operating the org). See `docs/skill-kinds.md`
in the vibe repo.

Rules that never change: SDK components → shadcn/ui → custom, in that order;
`pnpm install --ignore-scripts`; lowercase project names; ask for a real
agent UUID, never invent one; never print a token; run `/iblai-vibe-ops-test`
before saying "done".

## Component Priority

1. **ibl.ai components** (`@iblai/iblai-js`) — always first
2. **shadcn/ui** (`pnpm dlx shadcn@latest add <name>`) — everything else
3. **Custom/third-party** — only when neither exists

Do NOT build custom components when an SDK component exists. Do NOT restyle
SDK components — wrap the *container*, never the internals. ibl.ai and
shadcn share one Tailwind theme and render in brand colors automatically.

## Map of this app

| Where | What |
|---|---|
| `app/(app)/page.tsx` | Home: SDK `<Chat>` with the app's agent (`?agent=` → env → org setting); `?session=` restores, `?new=` starts fresh; the `key` is the only legitimate remount. Empty state when no agent. |
| `app/(app)/agents/page.tsx` | SDK `AgentSearch`; clicking a card opens it on `/` |
| `app/(app)/profile/page.tsx` | SDK `Profile` + `AppPreferences` (per-user settings) |
| `app/(app)/account/page.tsx`, `notifications/` | SDK `Account`, `NotificationDisplay` |
| `app/(app)/admin/**` | Admin mode only: users (+ invites), analytics tabs, billing, memory, organization (+ `OrgSettingsForm`) |
| `app/setup/` | First-run: name the app, pick/create the agent → org metadata. Admins only; no navbar. |
| `app/api/admin/**` | Server routes: `requireAdmin` (forwarded session token → `token/verify/`) then `Api-Token` calls |
| `lib/iblai/config.ts` | Env accessors; `apiKey()` is server-only |
| `lib/iblai/tenant.ts` | `resolveAppTenant()`, `readTenants()`, `isTenantAdmin()` (not the SDK's `useIsAdmin`) |
| `lib/iblai/admin-mode.tsx` | `AdminModeProvider` / `useAdminMode` — the User/Admin view |
| `lib/iblai/metadata.ts` (+ `metadata-core.ts`) | `useUserSettings`, `useOrgSettings` — namespaced under `apps.<slug>`; org writes GET-merge-PUT |
| `lib/iblai/platform.ts` | `platformFetch`, `verifyCaller`, `requireAdmin`, `platformFailure` |
| `lib/iblai/admin-client.ts` | browser `adminFetch()` for `/api/admin/*` |
| `providers/iblai-providers.tsx`, `store/iblai-store.ts` | SDK providers (+ service worker, toaster, Radix guard); the store's slice keys are fixed by the SDK — keep them |
| `e2e/` | Playwright: auth, member, admin journeys; `COVERAGE.md` + `coverage.json` |

## Invariants (and why)

- The org comes from `NEXT_PUBLIC_MAIN_TENANT_KEY` (`resolveAppTenant()`); a
  placeholder or `main` renders an alert, never a login loop.
- `IBLAI_API_KEY` is server-only: never `NEXT_PUBLIC_`, never read outside
  `lib/iblai/platform.ts` / `app/api/**`. Every admin route calls
  `requireAdmin` first.
- `<Chat>` never remounts except through its `key`; `reactStrictMode` stays
  `false` (SDK voice bug). Keep `public/sw.js` — `ServiceWorkerProvider` registers it.
- Org metadata is a public read and PUT replaces it: write only through
  `useOrgSettings` / `mergeAppNamespace`; never a secret.
- Admin UI gates on `useAdminMode().adminMode`; admin *writes* gate on the server.
- No `output: 'export'` — the admin routes need a server.

## SDK Imports

```typescript
import { initializeDataLayer, mentorReducer } from "@iblai/iblai-js/data-layer";
import { AuthProvider, TenantProvider, useChatV2 } from "@iblai/iblai-js/web-utils";
import { Profile, AnalyticsLayout, NotificationDropdown } from "@iblai/iblai-js/web-containers";
import { SsoLogin, UserProfileDropdown, Account, Chat, AgentSearch } from "@iblai/iblai-js/web-containers/next";
```

## Environment

`iblai.env` (gitignored) holds the platform shorthand: `DOMAIN`, `PLATFORM`,
`TOKEN`, optional `IBLAI_USERNAME`. `.env.local` (gitignored) is what Next.js
reads: `NEXT_PUBLIC_MAIN_TENANT_KEY` (= `PLATFORM`), `IBLAI_API_KEY`
(= `TOKEN`), optional `NEXT_PUBLIC_DEFAULT_AGENT_ID`, `NEXT_PUBLIC_APP_NAME`,
`NEXT_PUBLIC_SUPPORT_EMAIL`. The API/auth/websocket URLs default to hosted
iblai.app in `lib/iblai/config.ts`; override only when self-hosting
(`NEXT_PUBLIC_PLATFORM_BASE_DOMAIN`, `NEXT_PUBLIC_API_BASE_URL`, the sign-in
URL). When the host exports `IBLAI_API_KEY` / `IBLAI_PLATFORM_KEY` /
`IBLAI_USERNAME` (the ibl.ai desktop app does), use those and never ask.

Every origin the app runs on (localhost, the deployed URL, a Tauri scheme)
must be in the org's allowed redirect origins or sign-in never returns.

## Brand

- **Primary** `#0058cc`, **Gradient** `linear-gradient(135deg, #00b0ef, #0058cc)`, button `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- shadcn/ui new-york variant, system sans-serif, Lucide icons; SDK components ship their own styles — do NOT override them

## Layout Patterns

- Page background `var(--sidebar-bg, #fafbfc)`; member pages wrap SDK components in `bg-white rounded-lg border border-[var(--border-color)] overflow-hidden`, `w-full px-4` / `md:w-[75vw] md:px-0`.
- Admin pages host SDK panels the OS way: full width, `flex-1 min-h-0`, the component's own background.
- Mobile safe area: `globals.css` `env(safe-area-inset-*)` on body; `viewport-fit=cover` in `app/layout.tsx`.

## Commands

```bash
pnpm dev             # Dev server (localhost:3000)
pnpm build           # Production build
pnpm typecheck       # Type-check
pnpm test            # Vitest
pnpm test:e2e        # Playwright (needs e2e/.env.development)
```
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

## Step 4: Create `.npmrc` to prevent supply chain attacks
Create `.npmrc` in the current directory and add the content below:
```
min-release-age=7
minimum-release-age=10080
save-exact=true
```
## Step 5: Confirm

After writing the file, tell the user:

> Updated `CLAUDE.md` with ibl.ai platform guidance. Claude Code will now
> prioritize ibl.ai SDK components over custom implementations and use the
> correct skills when adding features.