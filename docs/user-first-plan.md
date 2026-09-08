# vibe, user-first: study and implementation plan

**Status:** proposal · **Baseline:** `iblai/vibe@620d20a` (v1.26.0 + three SDK bumps, `main` as of 2026-09-08) · **Author:** study run in Claude Code, 2026-09-08

This document is written to be executed by another agent (a weaker model is fine). Every task states *why*, *which files*, *exact steps*, *acceptance*, and *how to verify*. Read §0 before touching anything. Read §1–§3 to understand the reasoning; §4 onward is the work.

---

## 0. How to use this document

1. **Work in order of tiers, not of sections.** §5 gives the sequencing. Do not start Tier 2 tasks before Tier 0/1 are green.
2. **Every task ends with the verification block it names.** Run the commands; paste their output into the PR. Do not report a task done without them.
3. **Hard repo rules that apply to every task** (they are enforced by CI on PRs labeled `run-tests`, and by the nightly SDK job):
   - A skill is `skills/<name>/SKILL.md` with YAML frontmatter (`name` must equal the directory; `description` 1–1024 chars with trigger phrases). Keep SKILL.md **≤ 500 lines**; move bulk to `references/`.
   - After editing any SKILL.md run `node scripts/build-adapters.mjs` and commit `adapters/` (CI fails if it is stale).
   - Never mention an `@iblai/*` version that differs from `skills/iblai-vibe-ops-init/assets/vibe-starter/package.json` (`node scripts/check-sdk-pins.mjs --fix` rewrites drift).
   - Any `github.com/iblai/...` link must resolve (`node scripts/check-links.mjs`).
   - Skill code (assets + ` ```tsx ` fences in prose) must typecheck against the pinned SDK: `node scripts/test-skills-render.mjs --skills <name>`.
   - Never write a real `TOKEN` / `IBLAI_API_KEY` / `dm_token` into a tracked file, a screenshot, a commit message, or a log. Tenant keys and emails stay out of screenshots and docs (use a sanitized demo org — see §7.3).
   - Conventional commits (`feat:` → minor, `fix:`/`docs:` → patch); the release workflow tags `main` automatically. Never hand-edit `CHANGELOG.md` or a version.
4. **macOS note:** `bash scripts/validate-skills.sh` currently reports every skill as "Missing YAML frontmatter" on macOS because line 44 uses GNU-only `head -n -1`. Task **T5.3** fixes this first; until then run the validator on Linux (CI) or apply T5.3 locally.
5. **Verification against the SDK, not memory.** Before using a hook or component name in a skill or template, confirm it exists: `get_component_info("<Name>")` / `get_api_query_info("<hook>")` via the `@iblai/mcp` server in `.mcp.json`, or grep `node_modules/@iblai/{data-layer,web-containers,web-utils}/dist/**/*.d.ts` in a scaffolded starter. Appendix B lists what was verified for this plan (SDK 2.9.x).
6. **Terminology in anything new you write:** *organization (org)* for a customer's workspace; *org key* for its identifier; *agent* for what the API calls a mentor. Keep wire names (`platform_key`, `mentor`, `tenant`) verbatim in code and endpoint references. See Appendix F.

---

## 1. What the study found

### 1.1 The repo today (facts)

| Item | Value |
|---|---|
| Version / HEAD | v1.26.0 · `620d20a` (2026-09-08), fast-forwarded and confirmed equal to `origin/main` |
| Skills | 77 directories under `skills/`; 77 Cursor + 77 Codex adapters generated from them |
| Skill families by count | 27 `iblai-vibe-agent-*` (24 per-agent settings tabs + chat, chat-sidebar, search) · 7 `monetization*` · 8 `security-*` · 6 `ops-*` · 22 everything else (auth, chat, profile, account, analytics, memory, billing, credit, invite, rbac, navbar, notification, history, project, search, application, course×2, crm, workflow, onboard, design, deslop, readme, iconography, msix, local-llm, scaffold, component, index) |
| SKILL.md length | 9 skills exceed the 500-line spec: navbar 903, profile 864, workflow 758, agent-chat 583, course-access 552, **auth 540**, monetization-checkout 525, ops-build 512, monetization-analytics 505 |
| Screenshots | 45 skills have at least one PNG; **32 have none** — including `auth`, `ops-init` (vibe-starter itself), `navbar`, `ops-deploy`, `ops-test`, `scaffold`, the whole monetization family, `iblai-vibe` (index) |
| Template | `vibe-starter` (Next.js 16.2.4, React 19.2, Tailwind v4, shadcn, `@iblai/iblai-js ^2.9.3`, `@iblai/agent-ai ^2.9.3`) ships SSO + navbar + `/profile` + `/account` + `/notifications`. Home page is a placeholder ("Your app is ready. Add features with the /iblai-vibe skills"). No chat, no agent, no admin/user distinction beyond an `isAdmin` boolean derived from `localStorage.tenants` |
| Guidance files | `CLAUDE.md` 32 KB (opens with MCP, architecture, Redux dedup, env, then the 77-row skill table); `README.md` 27 KB (same table twice); `AGENTS.md` pointer; `docs/skill-setup.md` (shared boilerplate); `BRAND.md`; `TESTING.md` |
| CI | `skills-ci.yml` (opt-in via `run-tests` label; tiers 0–1.5 deterministic; agent tier on changed skills; weekly live SSO smoke), `sdk-auto-update.yml` (daily bump + `--fix` pins + adapters + render check), `release.yml` (conventional commits → tag) |
| Contributors, last 60 days | 100 % ibl.ai staff plus the release bot (null-crafter 44, Raza Fayyaz 27, sonegillis 8, Miguel 4, Bhargav 2, others 1 each). The only external contributions in the period are issue #155 + PRs #152–#154 (mamigot, porting a production Flutter app) and issue #167 (hyojunlim, an automated audit) |

### 1.2 What the last few weeks tell us (issues and PRs, 2026-08-15 → 2026-09-08)

| # | Date | Type | What it was really about |
|---|---|---|---|
| **#155** | 08-15 | issue (external) | vibe-starter hung on "Loading…" after a *successful* login. Root cause: an env knob (`NEXT_PUBLIC_API_BASE_URL`) with a misleading failure ("User still does not belong to tenant"). Also found: hydration mismatch on every route, dev CSP blocking `eval()`. Fixed in template + a runtime guard; three external PRs (#152, #153, #154). **Lesson:** setup failure modes are invisible and mis-attributed; the reporter diagnosed it only by comparing with os.ibl.ai. |
| #157–#159, #162 | 08-19 → 08-22 | PRs (staff) | More surfaces: agent billing, tenant billing, tenant memory, user history — each a full new skill with screenshots. Breadth, same weight as auth. |
| #160, #163, #165 | 08-21 → 08-26 | PRs (staff) | Deploy plumbing: `IBLAI_USERNAME` identity chain, container/static targets, skip-unchanged deploys, "stop asking for Stripe keys", `Api-Token` vs `Token` scheme fix. **Lesson:** the credentials/identity story has been patched repeatedly; it is the single most fragile part of the first-run experience. |
| #164, #166 | 08-24, 08-27 | PRs (staff) | Test infra gated behind a label; sandbox docs. |
| **#167** | 09-02 | issue (external, automated) | "Auth tokens and tenant state stored in plain localStorage"; CSP report-only detection. Closed without a comment. **Lesson:** a security-minded newcomer's first impression; there is no doc explaining *why* the SDK stores session tokens in localStorage (SSO design) or how CSP mode is chosen. |
| #168 | 09-02 | PR (staff) | "explain the five core iblai/api families, add the live-tenant pattern" — the first move toward weighting. Landed as a section at the *bottom* of CLAUDE.md. |
| — | 09-03 → 09-08 | bot | Three SDK bumps (2.8.1 → 2.9.3). The SDK moves faster than the docs. |

### 1.3 The platform lifecycle a user actually goes through (and where vibe documents it)

This is the sequence a person follows before a single line of app code exists. Pieces of it are described in `iblai/api` (`/iblai-api-login`), in `iblai/vibe-agent` (`AGENTS.md` "Get and run"), in `iblai/os` docs (`ibl.ai/docs/os/organization-settings/*`), and in `ibl.ai/pricing` — **nowhere in vibe as one story**.

| Step | What happens | Where it is documented today | Gap for a vibe user |
|---|---|---|---|
| 1. **Join** | `https://ibl.ai/join` (a Stripe-Checkout-based sign-up) creates the account **and** the user's own organization and leaves them signed in. Everyone also belongs to the shared `main` org — which is *not* theirs. | api README, vibe-agent AGENTS.md ("`main` is never it") | vibe README says "Sign up at ibl.ai/join" and nothing about `main`. `PLACEHOLDER_PLATFORMS` in `tenant.ts` does treat `main` as a placeholder — silently. |
| 2. **Land in the OS** | The org is usable at `https://os.ibl.ai/platform/<org-key>/…` (User/Admin toggle top-right; Admin mode exposes Organization, Management, Integrations, Billing, Memory, Monetization, Advanced). | ibl.ai/docs/os | Not mentioned in vibe. The OS is the reference app *and* the admin console for every vibe app (LLM keys, users, billing live there). vibe never says "your app's admin console is os.ibl.ai until you build one". |
| 3. **Org key** | Listed on `https://login.iblai.app/me`; also the `<org-key>` path segment in os.ibl.ai; public read `GET https://api.iblai.app/dm/api/core/orgs/<key>/metadata/` → 200 proves it exists (`platform_name`). | api login skill, vibe-agent | vibe: `iblai.env` comment only. |
| 4. **Platform API Token** | Minted in os.ibl.ai → Admin mode → **Integrations → APIs → Add API** (name, no expiry, Owner permissions; secret shown once), or by `/iblai-api-login` from the `dm_token` in the login session, or an org secret. Verified with `GET /dm/api/core/token/verify/` under `Authorization: Api-Token …`. | vibe-agent AGENTS.md step 2 (the only place with the click path); api login skill | vibe ops-init asks the user to paste `TOKEN` without saying where it comes from unless the desktop app exports it. `docs/skill-setup.md` points at `/iblai-api-login`, which needs a browser tool. |
| 5. **Credits** | Self-serve orgs run on prepaid, rechargeable credits with a hard ceiling; plans **Free / Trial / Premium**; `Add Credits`, `Auto Recharge` (defaults $5 threshold / $16 recharge), a Stripe payment method on file; usage is metered against credits, not seats. Spend caps at org / agent / user-on-agent scope (block or alert). | ibl.ai/pricing; docs/os/organization-settings/billing; api `iblai-api-billing`, `iblai-api-spend-caps` | vibe has `/iblai-vibe-credit`, `/iblai-vibe-billing`, `/iblai-vibe-agent-billing` but no sentence saying "this is how *you* get charged". |
| 6. **LLMs** | Org admins add provider keys under Integrations → LLMs (OpenAI, Anthropic, Google, Azure per-deployment, …); agents then get more model options; `IBLAI_API_KEY` doubles as an OpenAI-compatible key at `https://asgi.data.<domain>/api/ai-mentor/orgs/<org>/v1`. | docs/os/organization-settings/integrations-llms; ops-init skill (the `/v1` note) | Not in the vibe journey. |
| 7. **Agents** | Created in the OS (`/create-mentor`) or by `POST …/mentor-with-settings/`; the agent's UUID is the last path segment of its os.ibl.ai URL; every vibe chat skill needs one. | api agent-create; vibe agent-chat prerequisites | vibe-starter has no default agent and no way to create one. |
| 8. **Your own pricing on top** | Three distinct rails: (a) platform credits (ibl.ai's Stripe), (b) **app paywall** on the org's own Stripe key — pay-to-enter, no commission (`/iblai-vibe-monetization-app-paywall`, the `vibe-agent` model), (c) **item-level monetization** via Stripe Connect Express with commission (`/iblai-vibe-monetization*`). | Three skill families, each explains itself | No one-page decision: "I want to charge my users — which rail?" |
| 9. **Redirect origins** | Every origin an app runs on (localhost, the deployed URL, the Tauri scheme) must be in the org's allowed redirect origins or SSO never returns. | vibe-agent README/AGENTS.md | Absent from vibe. |
| 10. **Ship** | Web via the platform hosting API (`/iblai-vibe-ops-deploy`); macOS/Windows/iOS/Android via Tauri (`/iblai-vibe-ops-build`, `-release`, `-windows-msix`, `-iconography`). | Well documented, with screenshots for build | Listed as ops, not as the point. |

### 1.4 The problems, stated plainly

- **P1 — Everything weighs the same.** `CLAUDE.md`'s skill table has 77 rows in install order; a per-agent LTI tab sits next to SSO auth. `README.md` prints the same list twice. `/iblai-vibe` (the index) routes between *repos*, not between *jobs to be done*. The 24 `agent-*` tab skills are a third of the catalogue and are relevant only after an app exists and an agent exists.
- **P2 — Written from the engineer's chair.** `CLAUDE.md` opens with "MCP Server (Use First)", then the provider chain, `initializeDataLayer` arity, Redux dedup, CI tiers. The "Learn from a live tenant" section assumes someone who already has an os.ibl.ai URL and a Chrome session. Vocabulary is *tenant* / *platform* / *org* interchangeably (the API repo settled on *org* in June).
- **P3 — The "common stuff" is not a product.** For "an app with users (custom metadata), admins, organizations (custom metadata), agents, memories": the SDK has every hook (Appendix B) but vibe has **no skill** for per-user metadata (CLAUDE.md literally says "No `/iblai-vibe-*` skill wraps this family — call the hooks"), **no skill** for org metadata (`useGetTenantMetadataQuery` / `useUpdateTenantMetadataMutation` exist; `/iblai-api-org` documents the endpoint; the GET-merge-PUT footgun is documented only in the API repo), **no user/admin app shell** (os and vibe-agent both have a User/Admin mode; the starter has an `isAdmin` boolean and nothing gated by it), **no agent creation** (API only), **no default agent** in the starter (the chat skill demands a UUID "Never use a placeholder"), and memory guidance is split across three skills without a "what memory means for *your* app" page.
- **P4 — First-run friction is the dominant failure.** #155 and #167 are both first-day experiences. The credentials ladder has been patched five times in a month (#160, #163, #165, ops-init, app-paywall). `.mcp.json` in the README uses `npx @iblai/mcp`, which the package's own README says fails under pnpm (use `pnpm dlx`). Nothing checks the org key or token before the first `pnpm dev`.
- **P5 — No pictures of the journey.** 32 skills have no screenshot; there is no screenshot of vibe-starter; the os.ibl.ai click paths a user must follow (`/me`, Integrations → APIs, Billing) have no images in vibe. `vibe-agent` and `os` both lead their READMEs with screenshots.
- **P6 — Money is explained as features, not as a model.** Credits, BYO LLM keys, spend caps, the app paywall, and Connect monetization are five skills; no page says: *ibl.ai charges your org for what agents consume; you decide whether and how to charge your users on top*.
- **P7 — Hygiene that costs newcomers time.** Validator broken on macOS; nine skills over the length spec; the same 25-line brand/conventions block copy-pasted into ~60 skills although `docs/skill-setup.md` exists for exactly that; README/starter drift (starter README lists `components/navbar/credit-balance-widget` — the file is `nav-bar.tsx`; README "What You Get" claims "Password changes, connected services" for Account, which is not what `<Account>` shows).

### 1.5 What is already right (keep it)

- vibe-starter's env story after #155: hosted URL defaults live in code; `.env.local` needs only `NEXT_PUBLIC_MAIN_TENANT_KEY` + `IBLAI_API_KEY`; the runtime guard names the real failure. Keep and build on it.
- `docs/skill-setup.md` as the single boilerplate; `test.json` overlays + the render gate; `check-sdk-pins --fix` + nightly bump; conventional-commit releases. These are the mechanics a user-first rewrite rides on.
- The five "Platform data most apps lean on" families in CLAUDE.md (#168) — correct choice of families; wrong position and depth. This plan promotes them to the spine (§3).
- `vibe-agent` as a worked example of user-first writing: one job, a numbered "Get and run", explicit personas (platform admins vs members), invariants with reasons, screenshots first. Reuse its patterns (§4, E2/E3).

---

## 2. Who we are building for

### 2.1 Personas

| Persona | Has | Wants | Does not have / know |
|---|---|---|---|
| **Builder** (indie dev, consultant, internal team dev, a founder who can drive Claude Code / Cursor) | An ibl.ai account from `ibl.ai/join`, an org, maybe a Claude Code session, maybe a browser | "Spin up an app that does *common stuff* with agents, users (custom metadata), organizations (custom metadata) — on web, iOS, Android, macOS, Windows — without reinventing SSO/profile/org/analytics" | The SDK's internals, Redux, what a DM token is, what `main` is, where an API token comes from, which of three Stripe rails to use |
| **Member** (the Builder's end user) | An email; possibly an ibl.ai account | Sign in, chat with the app's agent(s), have a profile, have the app remember things, maybe pay | Anything about ibl.ai |
| **Admin** (the Builder, or the Builder's customer's admin) | Admin on the org | See users, invite, promote/demote, set roles, see analytics, watch spend, manage memories, set the app's branding and settings | The OS admin console unless told it exists |

### 2.2 "Common stuff" — the Core Twelve

These are the capabilities every custom app on the platform tends to need, in the order a Builder meets them. Each names its SDK surface, the vibe skill (or **GAP**), and the `iblai/api` family. **The five families the user called out as outsized (agent-setting, agent-memory, analytics, profile, profile-metadata) are marked ★.**

| # | Capability | SDK surface (verified, Appendix B) | vibe skill today | `iblai/api` family |
|---|---|---|---|---|
| 1 | Sign-in (SSO), session, org resolution | `AuthProvider`, `TenantProvider`, `SsoLogin`, `useUserData`, `useUsername`, `useUserTenants`, `useIsAdmin` | `/iblai-vibe-auth` (540 lines; starter has it) | `iblai-api-login` |
| 2 | A home that does something: chat with the app's agent | `Chat` (`/next`), `AppSidebar`/`PlatformSidebar`, `NavBar` | `/iblai-vibe-agent-chat` (needs a UUID); starter home is a placeholder | `iblai-api-agent-chat`, `agent-session` |
| 3 | Find / pick agents | `AgentSearch` | `/iblai-vibe-agent-search` | `iblai-api-search` |
| 4 ★ | Create + configure an agent (identity, visibility, capabilities) | `AgentSettingsProvider` + `AgentSettingsTab` (+33 tabs); `useGetMentorSettingsQuery`, `useEditMentorMutation`, fork/delete | `/iblai-vibe-agent-setting` + 33 tab skills; **GAP: create** | ★ `iblai-api-agent-setting`, `agent-create` |
| 5 ★ | The user's own profile (name, bio, image, language, social, education, résumé) | `Profile`, `UserProfileDropdown`, `useGetUserMetadataQuery`, `useUpdateUserMetadataEdxMutation`, `useUploadProfileImageMutation` | `/iblai-vibe-profile` (864 lines; starter has `/profile`) | ★ `iblai-api-profile` |
| 6 ★ | **Custom per-user metadata** (preferences, flags, onboarding, app state; admin cross-user) | `useGetUserPlatformMetadataQuery`, `useUpdateUserPlatformMetadataMutation` (PATCH); PUT/DELETE/`delete_keys` REST-only | **GAP** ("call the hooks") | ★ `iblai-api-profile-metadata` |
| 7 | **Org settings + custom org metadata** (name, logo, support email, help URL, default agent, *your keys*) | `Account` → `OrganizationTab`; `useGetTenantMetadataQuery`, `useUpdateTenantMetadataMutation`, `useTenantMetadata` | `/iblai-vibe-account` (settings UI) — **GAP for custom keys + the GET-merge-PUT rule** | `iblai-api-org` |
| 8 | Users vs admins: directory, invite, roles/policies, User/Admin mode | `Admin`, `UsersTab`, `RolesTab`, `PoliciesTab`, `InviteUserDialog`, `InvitedUsersDialog`, `useIsAdmin`, `checkRbacPermission`, `useGetUserInvitationsQuery`, `useCreateUserInvitationMutation` | `/iblai-vibe-account` (Management tab), `/iblai-vibe-invite`, `/iblai-vibe-rbac` — **GAP: an app-shell pattern (User/Admin mode) and an "admin area" page** | `iblai-api-management`, `rbac`, `invite`, `scim` |
| 9 ★ | Memory: user-global, per-agent (categories), agent knowledge; capture/recall toggles; org gate | `useGetUserMemorySettingsQuery`/`useUpdateUserMemorySettingsMutation`, `useGetGlobalMemoriesQuery`, `useCreate/Update/DeleteGlobalMemoryMutation`, `useGetMemsearchStatusQuery`, `AgentMemoryTab`, `Profile` Memory tab, `Account targetTab="memory"` | `/iblai-vibe-memory` (org), `/iblai-vibe-agent-memory` (agent), profile tab — **GAP: one page on what memory means for an app + agent knowledge (REST-only)** | ★ `iblai-api-agent-memory` |
| 10 ★ | Analytics (org and per-agent), transcripts, costs, per-user, audit, reports | `AnalyticsLayout` + `Overview/Users/Topics/Transcripts/Financial/Reports`, `AgentAnalyticsTab`, `useGet*StatsQuery`, `useGetAuditLogsQuery`, reports hooks; `llm-usage/` REST-only | `/iblai-vibe-analytics`, `/iblai-vibe-agent-audit` | ★ `iblai-api-analytics` |
| 11 | Notifications (bell, inbox, alerts, admin send) | `NotificationDropdown`, `NotificationDisplay`, `SendNotificationDialog` | `/iblai-vibe-notification` (starter has it) | `iblai-api-notification` |
| 12 | Money: credits/plan, spend caps, and *your* pricing | `CreditBalance`, `BillingTab`, spend-cap hooks; app-paywall assets; monetization components | `/iblai-vibe-credit`, `-billing`, `-agent-billing`, `-monetization-app-paywall`, `-monetization*` — **GAP: the decision page** | `iblai-api-billing`, `spend-caps` |
| + | Ship: web, macOS, Windows, iOS, Android, stores | — | `/iblai-vibe-ops-deploy`, `-build`, `-release`, `-windows-msix`, `-iconography` | `iblai-api-infrastructure` (self-host) |

### 2.3 The journey the docs must tell (J0–J6)

- **J0 Get an org** — `ibl.ai/join` → your org (not `main`) → os.ibl.ai. 
- **J1 Get credentials** — org key from `/me` or the os URL; API token from Integrations → APIs (or `/iblai-api-login`); verify both with two curls.
- **J2 Scaffold and run** — `npx skills add iblai/vibe --all` → `/iblai-vibe-ops-init` → `pnpm dev` → sign in → see a *working* app (chat with a default agent).
- **J3 Add the core** — profile, admin area, metadata, memories, analytics, notifications: each one skill, each with a screenshot of what you get.
- **J4 Make it yours** — custom user/org metadata, branding, roles, your own pages (shadcn), the REST fallback for anything without a component.
- **J5 Charge (optional)** — pick a rail; wire it.
- **J6 Ship** — web URL in minutes; native shells; stores.

The measurable target is §6's **20-minute test**.

---

## 3. Priority model (the answer to "equal weight")

Every skill gets a tier. The tier decides: position in README/CLAUDE.md, whether it is in the "Start here" path, whether it must have a screenshot, whether it is agent-tested in CI on every PR, and its documentation depth budget.

| Tier | Meaning | Skills | Rules |
|---|---|---|---|
| **0 — Run first** | Cannot build anything without them | `iblai-vibe` (index), `ops-init`, `auth`, `ops-test`, `ops-deploy` | Always in the first screen of README/CLAUDE.md; screenshot mandatory; agent-tested on **every** PR (not label-gated); ≤ 300 lines each |
| **1 — The core app** (the Core Twelve) | What "common stuff" means | `agent-chat`, `agent-search`, **`agent-setting`★**, **`agent-create`★ (new)**, `profile`★, **`user-metadata`★ (new)**, `account`, **`org-metadata` (new)**, **`admin` (new, family index)**, `invite`, `rbac`, `navbar`, `notification`, **`memory-guide`★ (new: one page over `memory` + `agent-memory` + profile tab)**, `memory`, `agent-memory`★, `analytics`★, `agent-audit`, `credit`, `billing`, `agent-billing`, **`pricing` (new decision page)**, `monetization-app-paywall`, `history`, `project`, `agent-chat-sidebar` | Listed in journey order, grouped by capability; screenshot mandatory; each follows the Tier-1 skill template (§4 E6); the ★ five get the deepest treatment (SDK hooks table + REST table + one worked example each) |
| **2 — Agent configuration** | After you have an agent | the remaining 23 `agent-*` tabs (`access`, `api`, `dataset`, `disclaimer`, `embed`, `evals`, `grader`, `history`, `llm`, `lti`, `mcp`, `privacy`, `prompt`, `safety`, `sandbox`, `skills`, `support`, `task`, `tool`, `voice`, …) | Appear **once** in README/CLAUDE.md as one row ("Agent configuration — 24 tabs → `/iblai-vibe-agent`") with the new family index `iblai-vibe-agent` (new) listing them; screenshots already exist — keep |
| **3 — Vertical / optional** | Only some apps | `monetization` (index) + `onboard`, `configure`, `checkout`, `subscription`, `analytics`; `application`; `course-access`, `course-create`; `crm-overview`; `workflow`; `onboard`; `local-llm` | Collapsed to family rows; keep |
| **4 — Ops & polish** | | `ops-build`, `ops-release`, `ops-upgrade`, `windows-msix`, `iconography`, `readme`, `design`, `deslop`, `scaffold`, `component`, `credential` | `ops-build`/`ops-release` are promoted into the journey's J6 row (native is a headline promise); the rest one row each at the end |
| **5 — Security** | Unrelated to building on the platform | the 8 `security-*` | One paragraph at the very end of README with a link; not in CLAUDE.md's main table (keep a short "Security skills" subsection at the bottom). *Recommendation to maintainers:* move them to a sibling repo in a later release so `--all` installs stop pulling 8 unrelated skills; not in scope here. |

**Depth budget** (lines of SKILL.md a skill may spend, to stop the inflation that produced 903-line skills): Tier 0 ≤ 300 · Tier 1 ≤ 400 (★ ≤ 500) · Tier 2–5 ≤ 500 as the spec says. Excess goes to `references/`.

---

## 4. The work — epics and tasks

Task IDs are `T<epic>.<n>`. "Files" are relative to the repo root. "Acceptance" is what a reviewer checks. "Verify" is what you run.

### Epic E1 — Rewrite the front door around the journey (README, CLAUDE.md, index, glossary)

**Why:** P1, P2, P6. A Builder reads three things: the GitHub README, the project `CLAUDE.md` the ops-init skill writes, and the `/iblai-vibe` index. All three must tell J0–J6 in that order and put the Core Twelve first.

#### T1.1 — New `README.md`

Files: `README.md`

Steps:
1. Keep the header block (logo, badges, hosted note). Replace everything below with this outline, in this order (draft copy for the first two sections is in Appendix D.1):
   1. **What you can build in 20 minutes** — 4 sentences + **one hero screenshot** of vibe-starter after E2 (`docs/screenshots/journey/03-starter-home-chat.png`) and a 4-image strip (mac, iOS, Android, Windows shells — reuse `skills/iblai-vibe-ops-build/iblai-vibe-ops-build-{osx,ios,android}.png`; capture Windows per §7).
   2. **The journey** — J0…J6 as a numbered list, one line each, each linking to the skill or doc that does it. J0 and J1 link to `docs/platform-lifecycle.md` (T1.5).
   3. **Quick start** — the exact 6 commands/prompts: `npx skills add iblai/vibe --all` → `/iblai-vibe-ops-init` → answer 2 questions (org key, token — with "where they come from" in one line each) → `pnpm dev` → sign in → `/iblai-vibe-ops-deploy`. Nothing else.
   4. **The core app (Tier 0 + 1)** — one table, journey order, columns: *You get* (a screenshot thumbnail link) · *Skill* · *Reads/writes on the platform* (link to the `iblai/api` family raw SKILL.md). Mark ★ on the five families.
   5. **How money works** — 6 lines: credits ceiling, LLM keys, spend caps, the three rails for charging *your* users, link to `/iblai-vibe-pricing` (T3.5).
   6. **Everything else** — Tier 2 (one row + link to `/iblai-vibe-agent`), Tier 3 family rows, Tier 4 rows.
   7. **Ship everywhere** — the existing Tauri/App Store/desktop-signing content, trimmed to 30 lines, screenshots kept.
   8. **When there is no component** — 5 lines pointing at `/iblai-vibe-api` (T3.7) and `npx skills add iblai/api`.
   9. **Companion repos**, **Resources**, **Security skills** (one paragraph), **License**.
2. Delete the duplicated 77-row lists. Do not list Tier 2 tabs individually anywhere in README.
3. Fix the drift called out in §1.4 P7 ("What You Get" table rows must describe what the SDK components actually render — take wording from `ibl.ai/docs/os/*` overview lines).

Acceptance: README ≤ 350 lines; first screenshot within the first 40 lines; no skill named more than once; every link resolves.

Verify: `node scripts/check-links.mjs`; `wc -l README.md`; `grep -c "iblai-vibe-agent-lti" README.md` → `0`.

#### T1.2 — Restructure `CLAUDE.md` (the repo's own) and the CLAUDE.md that `ops-init` writes into apps

Files: `CLAUDE.md`, `skills/iblai-vibe-ops-init/SKILL.md` (Step 2 "Content to write"), `skills/iblai-vibe-scaffold/assets/shared/CLAUDE.md.j2`, `skills/iblai-vibe-ops-init/assets/vibe-starter/AGENTS.md`

Steps:
1. Repo `CLAUDE.md` new order (draft in Appendix D.2):
   1. One paragraph: what vibe is, for whom, the 20-minute promise.
   2. **Start here (agent instructions)** — the decision table: "user says X → do Y" for the top 12 intents (new app; add chat; users/admins; custom user data; custom org data; memories; analytics; charge users; deploy; iOS/Android; something with no component; upgrade). This replaces "MCP Server (Use First)" at the top; MCP moves to §"Verifying SDK surface".
   3. **The platform lifecycle in 10 lines** (link to `docs/platform-lifecycle.md`).
   4. **Credentials** — the ladder from ops-init (env → `iblai.env` → ask), the two verification curls, the `main` trap, redirect origins, "never echo the token". Keep the existing `iblai.env` / `.env.local` explanation but shorter.
   5. **The Core Twelve** table (from §2.2, with the ★).
   6. **Skill catalogue by tier** (Tier 2–5 collapsed as in README).
   7. **Architecture notes** (provider chain, `initializeDataLayer` 5 args, RTK dedup, imports) — unchanged content, moved down.
   8. **Brand** (unchanged), **Commands**, **Contributing to skills** (validator, adapters, pins, links, render, agent tests — link `TESTING.md`), **Learn from a live tenant** (unchanged, last).
2. The CLAUDE.md that ops-init writes into a *project* (Step 2 of `iblai-vibe-ops-init/SKILL.md`) gets the same "Start here" decision table and the Core Twelve, and drops nothing that is there today except the flat skill list, which becomes the tiered one. Mirror the change in `scaffold/assets/shared/CLAUDE.md.j2` and vibe-starter's `AGENTS.md`.
3. Keep `AGENTS.md` (repo root) as the two-paragraph pointer it is; update its links.

Acceptance: repo CLAUDE.md ≤ 450 lines; the first 60 lines contain the decision table; the ops-init-generated CLAUDE.md and the starter AGENTS.md are byte-consistent for the shared sections (add a `__tests__/source-paths.test.ts`-style assertion in the starter if feasible, else a note in TESTING.md).

Verify: `node scripts/test-skills-render.mjs --skills iblai-vibe-ops-init` (starter still typechecks); `node scripts/build-adapters.mjs && git diff --exit-code adapters/`.

#### T1.3 — Rewrite the `/iblai-vibe` index skill as a job-to-be-done router

Files: `skills/iblai-vibe/SKILL.md`

Steps: keep the repo map table (it is good), then add **"What do you want to do?"** — the same 12-intent table as CLAUDE.md §2 but each row says which skill to open *and* which `iblai/api` skill covers the same data (★ rows first). Add a "Not sure? run `/iblai-vibe-ops-init`" line. Description in frontmatter must mention: users, admins, organizations, custom metadata, agents, memories, analytics, charge, iOS, Android.

Acceptance: ≤ 120 lines; every intent row links to an existing skill; frontmatter description ≤ 1024 chars.

Verify: `bash scripts/validate-skills.sh` (after T5.3) shows the skill passing; `node scripts/check-links.mjs`.

#### T1.4 — Terminology and glossary

Files: `docs/glossary.md` (new, content in Appendix F), `docs/skill-setup.md` (link it), `CLAUDE.md` (link it)

Steps: write the glossary; in **new or rewritten prose** use *org / org key / agent / member / admin*; do **not** mass-rename existing skills (churn without user value) — only touch wording in files this plan already edits.

Acceptance: glossary exists and is linked from CLAUDE.md, README, `docs/skill-setup.md`, and the `/iblai-vibe` index.

#### T1.5 — `docs/platform-lifecycle.md` (J0 + J1 + money, with screenshots)

Files: `docs/platform-lifecycle.md` (new), `docs/screenshots/journey/*.png` (see §7.2 manifest)

Steps: write the ten steps of §1.3 as a user guide (not a table): Join → your org vs `main` → os.ibl.ai and the Admin toggle → org key (`/me` screenshot + the os URL) → API token (Integrations → APIs → Add API, screenshot; `/iblai-api-login` as the automated alternative; org secret for CI) → verify (two curls, expected 200 bodies with the secret masked) → credits & plan (screenshot of Billing) → LLM keys (screenshot) → spend caps (one paragraph) → redirect origins (where in the OS; what breaks without it) → "your own pricing" (three rails, link to `/iblai-vibe-pricing`). End with a checklist the Builder ticks before `/iblai-vibe-ops-init`.

Acceptance: every step has either a screenshot or a curl; no real org key, email, or token appears; `check-links` passes.

---

### Epic E2 — Make vibe-starter the "common app", not a placeholder

**Why:** P3, P4. The starter is what `/iblai-vibe-ops-init` copies; it is the product. Today it stops at "your app is ready". After E2 it *is* the Core Twelve app: sign in → chat with the app's agent; agents page; profile; admin area (users, invites, roles, analytics, billing, memory) visible only in Admin mode; per-user and org metadata helpers; a first-run `/setup` that picks or creates the default agent. Port patterns from `iblai/vibe-agent` (admin mode, setup, invariants) and `iblai/os` (routes, sidebar) rather than inventing.

All tasks in E2 edit under `skills/iblai-vibe-ops-init/assets/vibe-starter/` (called `starter/` below). The starter is special-cased by the render gate: `node scripts/test-skills-render.mjs --skills iblai-vibe-ops-init --build` runs `typecheck` + `test` + `build` on it. Run that after every task.

#### T2.1 — Home = chat with the app's default agent, with an honest empty state

Files: `starter/app/(app)/page.tsx`, `starter/lib/iblai/config.ts`, `starter/.env.example`, `starter/__tests__/config.test.ts`

Steps:
1. Add `NEXT_PUBLIC_DEFAULT_AGENT_ID=` and `NEXT_PUBLIC_APP_NAME=` to `.env.example` with the comment text from `vibe-agent/.env.example` (agent uuid = last path segment of `https://os.ibl.ai/platform/<org-key>/<agent-uuid>`; app name = two/three Title Case words).
2. Add `defaultAgentId()` and `appName()` accessors to `config.ts` (same pattern as `mainTenantKey()`), and unit tests for both (empty → `""`).
3. Replace the placeholder home with the `Chat` mount from `/iblai-vibe-agent-chat` (in-process `Chat` from `@iblai/iblai-js/web-containers/next`, keyed by `?session=` / `?new=` exactly as vibe-agent's `app/(app)/(paid)/page.tsx` does — read that file first). When `defaultAgentId()` is empty render an **empty state card**: "No agent yet" with two buttons — *Pick an agent* (→ `/agents`, T2.2) and *Set up* (→ `/setup`, T2.6; admins only) — and a one-line hint for non-admins ("Ask an admin to finish setup").
4. Keep `reactStrictMode: false` and the `<Chat>` `key` remount rule (vibe-agent invariant: any other remount wedges voice input) — add the comment.

Acceptance: with a real agent id the home page chats; without one the empty state renders; `pnpm test` covers both accessors.

Verify: render gate `--build`; `npx playwright screenshot http://localhost:3000 /tmp/home.png` after sign-in (manual, then the e2e in T2.8).

#### T2.2 — `/agents` page (browse, star, open)

Files: `starter/app/(app)/agents/page.tsx`, `starter/app/(app)/layout.tsx` (nav link)

Steps: mount `AgentSearch` exactly as `/iblai-vibe-agent-search` Step 2 shows; `onAgentClick` → `router.push('/?agent=<uuid>&new=<nonce>')` and have the home page honour `?agent=` over `defaultAgentId()`. Add "Agents" to `NAV_LINKS`.

Acceptance: the page lists Favorites/Featured/Custom/All for the signed-in user; clicking a card starts a chat with it.

#### T2.3 — User/Admin mode and the admin cluster

Files: `starter/lib/iblai/admin-mode.tsx` (new; port from `vibe-agent/lib/iblai/admin-mode.tsx`), `starter/lib/iblai/tenant.ts` (add `isTenantAdmin()`), `starter/components/navbar/admin-mode-switch.tsx` (new; port from vibe-agent), `starter/components/navbar/nav-bar.tsx`, `starter/app/(app)/layout.tsx`

Steps:
1. `isTenantAdmin()` = the `is_admin` flag of the entry in `localStorage.tenants` whose `key === resolveAppTenant()` — **not** the SDK `useIsAdmin()` (vibe-agent invariant; document why in a comment: the SDK hook answers for the SDK's current tenant, which can differ from the app's pinned org).
2. `AdminModeProvider` + `useAdminMode()`; default Admin for admins, resets on reload; `isLiveAdmin = isTenantAdmin() && adminMode`.
3. Navbar: the User/Admin switch (in the profile menu on narrow screens). `NAV_LINKS` becomes two arrays: `MEMBER_LINKS` (Home, Agents, Profile) and `ADMIN_LINKS` (Users, Analytics, Billing, Memory, Organization) rendered only when `isLiveAdmin`.
4. Layout gate: `/admin/*` routes redirect to `/` when `!isLiveAdmin`.

Acceptance: a non-admin never sees admin links or pages; an admin can flip to User mode and see exactly what a member sees (this is the feature — "put yourself in the user's shoes" built into the app).

Verify: two e2e checkpoints in T2.8 (admin sees cluster; User mode hides it).

#### T2.4 — Admin area: users, invites, roles; analytics; billing; memory; organization

Files: `starter/app/(app)/admin/users/page.tsx`, `…/admin/analytics/{layout,page}.tsx` (+ `users`, `topics`, `transcripts`, `financial`, `reports` sub-pages), `…/admin/billing/page.tsx`, `…/admin/memory/page.tsx`, `…/admin/organization/page.tsx`

Steps:
- `/admin/users`: mount `<Account … targetTab="management" enableRbac>` (the SDK `Admin` surface: Users · Groups · Roles · Policies · Teams · Alerts) full-width, no card (vibe-agent hosts SDK panels the OS way: `flex-1 min-h-0` wrapper, component's own background — read its "Scrolling, three kinds of page" invariant). Add an "Invite" button opening `InviteUserDialog` and a "Pending" button opening `InvitedUsersDialog` (from `/iblai-vibe-invite`).
- `/admin/analytics/*`: the `AnalyticsLayout` + `AnalyticsSettingsProvider` pattern from `/iblai-vibe-analytics`; org-wide by default; `?agent=<uuid>` scopes to one agent (`mentor_unique_id`).
- `/admin/billing`: `<Account targetTab="billing" billingURL topUpURL>` per `/iblai-vibe-billing`.
- `/admin/memory`: `<Account targetTab="memory">` per `/iblai-vibe-memory`.
- `/admin/organization`: `<Account targetTab="organization">` (name, logo, support email, help center) — and, below it, the **custom org settings** form from T2.5.
- The existing `/account` page stays as the member-facing account page; admin tabs move to the routes above (deep-links keep working via `targetTab`).

Acceptance: each page renders for an admin, is hidden for members, and has a screenshot in §7.2.

#### T2.5 — Typed metadata helpers (per-user and org) — the ★ profile-metadata capability, made concrete

Files: `starter/lib/iblai/metadata.ts` (new), `starter/app/api/admin/user-metadata/route.ts` (new), `starter/__tests__/metadata.test.ts` (new), `starter/components/settings/app-preferences.tsx` (new, member-facing example), `starter/components/settings/org-settings.tsx` (new, admin example)

Steps:
1. `metadata.ts` exports:
   - `useUserSettings<T>(defaults: T)` → `{ settings, update(partial), remove(keys), isLoading }` built on `useGetUserPlatformMetadataQuery({ platform_key })` and `useUpdateUserPlatformMetadataMutation` (PATCH with `metadata` / `delete_keys`). Namespaced under one key (`app.<PAYWALL_APP_SLUG|package name>`), flat keys inside, allowlist validation, graceful defaults on error (all from `iblai-api-profile-metadata/references/guide.md` best practices).
   - `useOrgSettings<T>(defaults: T)` → same shape over `useGetTenantMetadataQuery` / `useUpdateTenantMetadataMutation`, **implementing GET-merge-PUT** (the org metadata PUT replaces the whole object; dropping keys silently breaks the OS — this is the single most important comment in the file). Namespaced under `apps.<slug>` — the same convention vibe-agent uses for the paywall choice, so the two coexist.
   - Types: `UserSettings`, `OrgSettings` with two example fields each (`theme`, `onboardingStep`; `welcomeMessage`, `supportUrl`).
2. `app/api/admin/user-metadata/route.ts`: server route, `Api-Token` from `config.apiKey()`, verifies the caller is an admin (forward the caller's `dm_token` to `GET /dm/api/core/token/verify/` and check the org's `is_admin` — same pattern as vibe-agent's admin rail), then `GET/PATCH …/users/platform-metadata/?platform_key=&username=<target>`. This is the only way to write *another* user's metadata from the app.
3. Two small UI examples: `app-preferences.tsx` (a theme/onboarding toggle card on `/profile`, member) and `org-settings.tsx` (welcome message + support URL on `/admin/organization`, admin).
4. Unit tests: PATCH body shape; org merge preserves unknown keys; namespacing; error fallback.

Acceptance: a member can save a preference and see it after reload on another device; an admin can edit org settings without clobbering `overall_default_mentor`/other OS keys (test asserts the merged PUT body); the admin route rejects non-admins with 403.

Verify: `pnpm test`; manual: `curl -s "https://api.$DOMAIN/dm/api/core/orgs/$PLATFORM/metadata/" -H "Authorization: Api-Token $TOKEN"` before/after shows only `apps.<slug>` changed.

#### T2.6 — First-run `/setup` (admin only): pick or create the default agent, name the app

Files: `starter/app/setup/page.tsx` (outside `(app)`, no navbar — vibe-agent pattern with `OnboardingShell`), `starter/components/setup/setup-screen.tsx`, `starter/app/api/admin/setup/route.ts`, `starter/lib/iblai/setup.ts`

Steps:
1. Gate: providers redirect an admin to `/setup` until `apps.<slug>.default_agent_id` exists in org metadata **or** `NEXT_PUBLIC_DEFAULT_AGENT_ID` is set (env wins, like vibe-agent's `PAYWALL_PRICE_IDS`).
2. Screen 1: app name (suggested from the org's `platform_name`, rule from vibe-agent step 4). Screen 2: **pick an agent** (list via `GET …/search/orgs/{org}/users/{username}/mentors/` through the server route) **or create one** (name + one line → `POST …/mentor-with-settings/` with `template_name: "ai-mentor"` — `/iblai-api-agent-create`). Screen 3 (optional, off by default): "Charge for access?" → hands off to `/iblai-vibe-monetization-app-paywall` (do not build Stripe into the starter; vibe-starter stays Stripe-free by decision — CHANGELOG 1.25.1).
3. Save: `apps.<slug> = { name, default_agent_id, updated_at }` via the org-metadata helper (GET-merge-PUT). Home reads `config.defaultAgentId() || orgSettings.default_agent_id`.
4. "Setup" is reachable later from `/admin/organization` (quiet link), never from the navbar (vibe-agent invariant).

Acceptance: a fresh admin on a fresh org gets from sign-in to a working chat without leaving the app and without touching env files; a member never sees `/setup`.

#### T2.7 — Env, MCP, and guard hygiene

Files: `starter/.env.example`, `starter/.mcp.json` (new), `starter/lib/iblai/config.ts`, `starter/README.md`, `starter/providers/iblai-providers.tsx`

Steps:
1. Ship `.mcp.json` in the starter with `{"iblai": {"command": "pnpm", "args": ["dlx", "@iblai/mcp"]}}` — the package's own README says `npx` may fail to link the binary in pnpm projects. Update the root README's MCP snippet to show both forms.
2. Placeholder guard: when `NEXT_PUBLIC_MAIN_TENANT_KEY` is empty/placeholder/`main`, render a full-page alert naming the fix (vibe-agent invariant: "A missing or placeholder key renders an alert") instead of redirecting to login.
3. Starter README: fix the file-name drift (`credit-balance-widget` → what exists), add the new routes, the setup flow, and the redirect-origins line.
4. `.gitignore` already ignores `iblai.env*` and `.env*` — keep; add `.mcp.json`? **No** — it holds no secrets; commit it.

Acceptance: `pnpm dev` with an empty tenant key shows the alert, not a login loop.

#### T2.8 — Tests and e2e for everything E2 added

Files: `starter/__tests__/*.test.ts`, `starter/e2e/journeys/{chat,admin,setup}.journey.spec.ts`, `starter/e2e/COVERAGE.md` + `coverage.json` (the `/iblai-vibe-ops-test` v2 checkpoint format)

Steps: unit tests for `config` accessors, `isTenantAdmin`, metadata helpers, setup save; Playwright journeys (using the existing `e2e/auth.setup.ts` real-SSO setup): member sees home chat + agents + profile and **no** admin links; admin sees the cluster, flips to User mode, cluster disappears; `/setup` completes and home chats. Keep the log-hygiene invariants from `TESTING.md` (dot reporter, no traces, no console secrets).

Acceptance: `pnpm test` green; `pnpm test:e2e` green against the live test org (CI `live` job); `COVERAGE.md` lists every new checkpoint.

#### T2.9 — Answer #167 in the template and in a doc

Files: `docs/security-model.md` (new), `starter/middleware.ts` (comment only), `starter/lib/iblai/auth-utils.ts` (comment only)

Steps: write the page: what tokens exist (`axd_token`, `dm_token`, `edx_jwt_token`, `userData`, `tenants`), why the SDK keeps them in `localStorage` (cross-SPA SSO sync, `enableStorageSync`), what that implies (XSS is the threat; CSP with nonces is the mitigation; `IBLAI_API_KEY` never in the browser), how CSP mode is chosen (`applyCsp`: enforce in prod, report-only in `next dev`, `CSP_MODE` override validated by the SDK), the `.npmrc` supply-chain settings ops-init writes, and what a Tauri shell changes. Link it from the starter README and from `/iblai-vibe-auth`. Reference the issue number.

Acceptance: a reader of #167 finds every question answered on one page.

---

### Epic E3 — New skills for the missing "common stuff"

Each new skill follows the Tier-1 template (E6, T6.1). Each ships: frontmatter with trigger phrases, a "What you get" screenshot, `assets/*.j2` + `test.json` overlay so the render gate typechecks the code, a REST table linking the `iblai/api` raw SKILL.md, and a "Verify" block. Add every new skill to `CLAUDE.md`, `README.md`, the `/iblai-vibe` index, and regenerate adapters.

#### T3.1 — `/iblai-vibe-user-metadata` ★ (per-user custom data)

Files: `skills/iblai-vibe-user-metadata/{SKILL.md,test.json,assets/metadata.ts.j2,assets/app-preferences.tsx.j2,assets/admin-user-metadata-route.ts.j2,iblai-vibe-user-metadata-1-preferences.png,iblai-vibe-user-metadata-2-admin.png}`

Content: what the store is (one JSON object per user × org, auto-created, schemaless); the hook pair; PATCH vs PUT vs DELETE vs `delete_keys` (only PATCH is a hook — the rest is the server route); admin cross-user (`&username=`, 403 for non-admins, 404 unknown user); namespacing/allowlist/no-secrets rules; the two examples (preferences; onboarding progress resume); RTK cache invalidation note; the REST table from `iblai-api-profile-metadata`. Assets are the T2.5 files, templated. Trigger phrases: "custom user fields", "user preferences", "remember the user's", "onboarding progress", "feature flag per user", "store data per user".

Acceptance: `node scripts/test-skills-render.mjs --skills iblai-vibe-user-metadata` passes; ≤ 400 lines.

#### T3.2 — `/iblai-vibe-org-metadata` (org custom data + branding)

Files: `skills/iblai-vibe-org-metadata/{SKILL.md,test.json,assets/org-settings.tsx.j2,iblai-vibe-org-metadata-1-settings.png}`

Content: the org metadata object (`GET/PUT …/orgs/{org}/metadata/`) holds *the OS's own settings* (`overall_default_mentor`, `help_center_url`, `chat_area_size`, runtime toggle slugs, the auth SPA branding `auth_web_*`) **and** your keys; **PUT replaces — always GET, merge, PUT** (show the helper; show the bug it prevents); it is a **public read** (never put secrets there — vibe-agent stores only ids and amounts); namespace under `apps.<slug>`; hooks `useGetTenantMetadataQuery` / `useUpdateTenantMetadataMutation` / `useTenantMetadata`; where branding lives instead (`OrganizationTab`: name, light/dark logo, support email, help center; auth page branding via `/iblai-vibe-auth` Step 2). Trigger phrases: "organization settings", "org-level config", "per-tenant setting", "white-label", "app settings for the whole org".

#### T3.3 — `/iblai-vibe-admin` (family index: users vs admins)

Files: `skills/iblai-vibe-admin/{SKILL.md,assets/admin-mode.tsx.j2,assets/admin-mode-switch.tsx.j2,test.json,iblai-vibe-admin-1-user-mode.png,iblai-vibe-admin-2-admin-mode.png,iblai-vibe-admin-3-users.png}`

Content: the two audiences; `isTenantAdmin()` vs `useIsAdmin()` (and why); User/Admin mode (assets from T2.3); the admin cluster routes; what each admin page mounts (Account `targetTab` map: `management`, `organization`, `integrations`, `advanced`, `billing`, `memory`, `monetization`); the platform's two predefined roles (Admin / User) + policies for finer grants (link `/iblai-vibe-rbac`); invites (single + CSV columns `email, first_name, last_name, platform_key, company_name, user_group`) via `/iblai-vibe-invite`; activate/deactivate; SCIM for directories (`iblai-api-scim`); "until you build an admin area, os.ibl.ai *is* your admin console" with the click paths. Trigger phrases: "admin", "administrators", "user management", "roles", "invite users", "admin dashboard", "who can".

#### T3.4 — `/iblai-vibe-agent-create` ★ (create an agent from your app)

Files: `skills/iblai-vibe-agent-create/{SKILL.md,test.json,assets/create-agent-route.ts.j2,assets/create-agent-dialog.tsx.j2,iblai-vibe-agent-create-1-dialog.png}`

Content: there is no SDK component for creation (verified — Appendix B), so the pattern is a server route (`Api-Token`, admin-verified) that calls `POST …/orgs/{org}/users/{username}/mentor-with-settings/` (`template_name: "ai-mentor"`, `new_mentor_name`, `display_name`, `description`, `system_prompt`, `llm_provider`) and returns `unique_id`; a shadcn dialog (name + purpose) that calls it; then hand-off to `/iblai-vibe-agent-setting` (★ `iblai-api-agent-setting`: settings GET, multipart PUT of changed fields, fork, delete) and the Tier-2 tabs via `/iblai-vibe-agent`; the "who may create" gate (`rbac/student-agent-creation/status/` toggle; `MENTOR_CREATORS` role). Trigger phrases: "create an agent", "new agent", "let users create agents", "agent from a template".

#### T3.5 — `/iblai-vibe-pricing` (decision page: how money works, which rail)

Files: `skills/iblai-vibe-pricing/SKILL.md`, `references/rails.md`

Content (≤ 200 lines): (1) how *you* are charged — credits ceiling, plan tiers, auto-recharge, BYO LLM keys, spend caps at three scopes with block/alert, the learner-safe status endpoint; (2) how to charge *your users* — a decision table over three rails (credits widget for orgs that resell ibl.ai credits; **app paywall** on your own Stripe key — whole app, no commission, no webhooks, the `vibe-agent` model; **Connect monetization** — per item, ibl.ai commission, subscriptions, revenue analytics) with "choose this when" rows; (3) the flags an ibl.ai operator must set (`show_paywall`, `enable_monetization`) and how to check them (`tenants[].show_paywall`); (4) hand-offs to `/iblai-vibe-credit`, `/iblai-vibe-billing`, `/iblai-vibe-agent-billing`, `/iblai-vibe-monetization-app-paywall`, `/iblai-vibe-monetization`. Trigger phrases: "charge", "pricing", "subscription", "paywall", "credits", "how do I get paid", "Stripe", "spend limit", "cost".

#### T3.6 — `/iblai-vibe-agent` (family index for the 24 agent tabs)

Files: `skills/iblai-vibe-agent/SKILL.md`

Content: the `AgentSettingsProvider` layout once (from `/iblai-vibe-agent-setting` Step 2); a table of all 24 tabs with one line each + screenshot thumbnail + the matching `iblai/api` skill; a suggested route layout `app/(app)/agents/[mentorId]/<tab>/page.tsx`; "most apps need only settings, prompts, llm, datasets, memory, tools, access — add the rest when asked". This is the only Tier-2 entry that appears in README/CLAUDE.md tables.

#### T3.7 — `/iblai-vibe-api` (the bridge: when there is no component, the REST API is fair game)

Files: `skills/iblai-vibe-api/{SKILL.md,assets/platform-fetch.ts.j2,assets/route-example.ts.j2,test.json}`

Content: the rule (browser → SDK hooks with the session token; server → `Api-Token $IBLAI_API_KEY`, never in client code; `/v1` uses `Bearer`); a 20-line `lib/iblai/platform.ts` helper (`platformFetch(path, init)` that adds the header, the `/dm` prefix, and maps 401/403/404/429); the admin-verification pattern (`token/verify/` on the forwarded `dm_token`); three worked examples end to end — (a) admin writes another user's metadata, (b) create an agent, (c) send a notification (`iblai-api-notification`); a pointer table: for family X read `iblai/api` skill Y (raw URL) — all 50, grouped, ★ first; the live OpenAPI schema URL (`https://api.iblai.app/dm/api/docs/schema/`) and the grep recipe from `/iblai-vibe-monetization`. Trigger phrases: "no component for", "call the API", "endpoint", "REST", "server route", "backend call".

#### T3.8 — `/iblai-vibe-memory-guide` ★ (one page: what memory means for your app)

Files: `skills/iblai-vibe-memory-guide/SKILL.md` (≤ 250 lines), screenshots reused from `memory`, `agent-memory`, and the profile Memory tab

Content: the three stores (user-global; per-agent by category with extraction prompts and the five default categories; agent knowledge — shared, curated, injected as `## Agent Knowledge`, REST-only); the three control levels (org `enable_memsearch`, agent `enable_memory_component`, user capture/recall toggles) and the **visibility rule** (hide memory UI unless org status and agent flag are on; always show the user toggles); which surface to mount for which audience (member → `Profile` Memory tab; admin of an agent → `AgentMemoryTab`; org admin → `Account targetTab="memory"`); the ★ `iblai-api-agent-memory` endpoint table (list/grouped/across-agents; categories; agent knowledge; global; settings) for anything custom (e.g., "show what the app remembers on the home page"). Trigger phrases: "remember", "memory", "personalize", "what the agent knows about the user", "forget".

---

### Epic E4 — Screenshots program

**Why:** P5. Pictures are how a Builder decides in five seconds whether a skill gives them what they want; the OS click paths (token, billing) are impossible to follow from prose alone.

#### T4.1 — Conventions

Files: `docs/screenshots/README.md` (new)

Rules: PNG, 1440×900 viewport, light mode, 1× DPR, no browser chrome; file name `skills/<skill>/<skill>-<n>-<slug>.png` (existing convention) or `docs/screenshots/journey/<nn>-<slug>.png`; a **sanitized demo org** (name "Acme Demo", users `demo-admin@example.com`, `demo-member@example.com`, no real emails/keys; tokens never visible — blur or crop); every screenshot referenced by raw GitHub URL in SKILL.md (existing convention) and by relative path in README/docs; keep each under 400 KB (`pngquant`/`oxipng` if needed); re-capture when the SDK changes the surface.

#### T4.2 — Capture procedure

Files: `scripts/capture-screenshots.mjs` (new), `starter/e2e/screenshots.spec.ts` (new, tagged, excluded from the default run)

Steps: a Playwright script that reuses `e2e/auth.setup.ts` storage state, walks the starter routes (`/`, `/agents`, `/profile`, `/account`, `/notifications`, `/admin/users`, `/admin/analytics`, `/admin/billing`, `/admin/memory`, `/admin/organization`, `/setup`) in both modes and writes the manifest files in §7.2. OS/`login.iblai.app`/`ibl.ai/join` screenshots are manual (document the steps in `docs/screenshots/README.md`; blur emails). Native shells: existing `ops-build` images; add a Windows one.

#### T4.3 — Fill the gaps

Add screenshots to: `auth` (the customized login page + the redirect back), `ops-init` (the starter home after setup), `navbar` (desktop + drawer), `ops-deploy` (the READY URL in the terminal + the live page), `ops-test` (a green run), `monetization-app-paywall` (pricing page + return), `monetization*` (the admin tab exists in `configure` — reuse), `iblai-vibe` (the journey strip), and every new E3 skill. Security and pure-reference skills (`credential`, `local-llm`, `design`, `deslop`, `readme`, `iconography`, `msix`, `scaffold`, `component`, `upgrade`) are exempt.

Acceptance: every Tier 0/1 skill has ≥ 1 screenshot; README and `docs/platform-lifecycle.md` have the journey set; `find skills -name '*.png' -size +400k` is empty.

---

### Epic E5 — First-run friction and hygiene

#### T5.1 — The credentials ladder, complete (ops-init)

Files: `skills/iblai-vibe-ops-init/SKILL.md`

Steps: after "Resolve platform credentials", add the **no-token path** with the exact os.ibl.ai click path from `vibe-agent` (Admin mode → Integrations → APIs → Add API → name `<app>`, expiry empty, Owner → Submit; secret shown once) and the `/iblai-api-login` alternative (needs a browser tool; org secret for CI). Add the two verifications **before** writing files: `curl -fsS https://api.$DOMAIN/dm/api/core/orgs/$PLATFORM/metadata/` → 200 (public; `platform_name`), and `curl -fsS -H "Authorization: Api-Token $TOKEN" https://api.$DOMAIN/dm/api/core/token/verify/` → 200 (`username` in the body → persist as `IBLAI_USERNAME`, which `/iblai-vibe-ops-deploy` needs). Refuse `main` with the sentence from vibe-agent. Reuse vibe-agent's masked-confirmation write script (Python heredoc) so the token is never echoed. Add the "allowed redirect origins" line with where to set it.

Acceptance: a Builder with only a `/join` account completes ops-init without reading any other doc; the token never appears in the transcript.

#### T5.2 — Redirect origins + `main` documented everywhere they bite

Files: `skills/iblai-vibe-auth/SKILL.md` (Troubleshooting), `skills/iblai-vibe-ops-deploy/SKILL.md` (post-deploy checklist), `skills/iblai-vibe-ops-build/SKILL.md` (mobile scheme), `docs/platform-lifecycle.md`

#### T5.3 — Portable validator

Files: `scripts/validate-skills.sh` line 44

Steps: replace `| head -n -1 | tail -n +2` with `| sed '1d;$d'` (drops first and last `---` lines; works on BSD and GNU). Re-run on macOS and Linux.

Acceptance: `bash scripts/validate-skills.sh` on macOS reports the same pass/warn set as CI.

#### T5.4 — De-duplicate boilerplate and bring skills under the length spec

Files: every `skills/*/SKILL.md` that contains the 25-line "Do NOT add custom styles… Follow BRAND.md…" block and the "Step 0: Start from vibe-starter?" block; the nine over-length skills

Steps: write `scripts/dedupe-boilerplate.mjs` that replaces each recognized block with the single line `> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](…)` when that line is already present (it is, in most). Then, for the nine: move prop tables / troubleshooting / long code to `references/` with links. Do **not** change instructions' meaning; run the render gate on each.

Acceptance: `validate-skills.sh` shows zero length warnings; render gate green for every touched skill; `git diff --stat` shows only removals + pointers.

#### T5.5 — Drift fixes

`README.md` "What You Get" rows; starter README file names; `CLAUDE.md` skill table vs `skills/` (script it: `scripts/check-skill-tables.mjs` fails when a `skills/<name>` is missing from CLAUDE.md's catalogue or vice versa — add to `skills-ci.yml` deterministic job).

---

### Epic E6 — A quality bar for Tier 0/1 skills

#### T6.1 — Tier-1 skill template

Files: `templates/skill-template-feature.md` (new; keep the existing `skill-template.md` for security/reference skills), `docs/skill-setup.md` (link)

Sections, in order, with a line budget each: frontmatter (description with trigger phrases; ≤ 1024 chars) · **What you get** (1 screenshot + 3 lines) · **When to use / when not** (2–4 bullets; the sibling skills) · **Prerequisites** (auth; org key; agent uuid if needed — "ask, never invent") · **Steps** (numbered; each step ends with the file it produced) · **Verify** (`pnpm build`, `pnpm test`, screenshot command, what the screenshot must show) · **Customize** (MCP `get_component_info` calls; props table ≤ 20 rows or link to `references/props.md`) · **Platform data** (hooks table + `iblai/api` raw link + the 3 most common REST calls) · **Related** · nothing else. Total ≤ 400 lines (★ ≤ 500).

#### T6.2 — Apply the template to Tier 0/1

Rewrite `auth`, `ops-init`, `agent-chat`, `profile`, `account`, `navbar`, `notification`, `analytics`, `invite`, `rbac`, `memory`, `agent-memory`, `agent-setting`, `credit`, `billing`, `agent-billing`, `history`, `agent-search`, `ops-deploy`, `ops-test` to the template. Preserve every fact and every gotcha (move, don't delete); the render gate proves code fences still compile.

---

### Epic E7 — Native-first visibility

`README.md` J6 row and "Ship everywhere" section; `docs/platform-lifecycle.md` last step; `/iblai-vibe-ops-init` closing message ("Next: `/iblai-vibe-ops-deploy` for a URL, `/iblai-vibe-ops-build` for macOS/Windows/iOS/Android"). Add the Windows screenshot. Confirm the starter still satisfies the mobile safe-area and `viewport-fit=cover` rules after E2 (they are in `globals.css`/`layout.tsx` today — add an e2e assertion).

### Epic E8 — Governance so it stays user-first

- `skills-ci.yml`: run tiers 0–1.5 on **every** PR (drop the label gate for deterministic tiers; keep the label for the agent tier), plus `scripts/check-skill-tables.mjs` (T5.5).
- Add `scripts/test-user-journey.sh`: the tier-2 agent harness with a **persona prompt** ("You are a builder with org key X and token Y; make me an app where members chat with our support agent, admins see users and analytics, and every user has a `favorite_topic` preference") against a scratch starter; asserts the E2 files exist and `pnpm build` passes. Runs weekly with the `live` job.
- PR template: a "User test" checkbox — "I ran the 20-minute test (§6) or the journey script and attached the screenshot".
- `CHANGELOG.md` headings gain a *"For builders"* line per release (what a user sees), generated from `feat:`/`fix:` subjects — a small tweak in `release.yml`'s changelog step.

---

## 5. Sequencing

| Phase | Tasks | Why this order |
|---|---|---|
| **A — unblock and re-frame (first)** | T5.3 (validator) → T1.4 (glossary) → T1.5 (lifecycle doc, text first, screenshots later) → T3.5, T3.7, T3.8, T3.6 (pure-doc skills) → T1.3 (index) → T1.2 (CLAUDE.md) → T1.1 (README, without the hero screenshot yet) | Cheap, no code risk, immediately changes what a newcomer reads; the new doc skills give README/CLAUDE.md something to point at |
| **B — the product** | T2.1 → T2.7 → T2.3 → T2.2 → T2.5 → T2.4 → T2.6 → T2.8 → T2.9; then T3.1, T3.2, T3.3, T3.4 (their assets are the starter files, templated) | Starter first because the skills' assets and screenshots come from it |
| **C — pictures and friction** | T4.1 → T4.2 → T4.3; T5.1, T5.2, T5.5; README hero screenshot | Needs B's screens |
| **D — quality and governance** | T6.1 → T6.2; T5.4; E7; E8 | Rewrites are safest once the content is stable |

Each phase is its own PR series; label `run-tests`; do not merge a phase with red deterministic tiers.

---

## 6. Definition of done: the 20-minute test

A person with **only** an `ibl.ai/join` account and Claude Code, following README → `docs/platform-lifecycle.md` → `/iblai-vibe-ops-init`, reaches all of the following within 20 minutes, without opening any other repo:

1. Signed in to their own app on `localhost:3000` with their own org (not `main`).
2. `/setup` completed: app named, a default agent picked or created.
3. Home page chats with that agent; `/agents` lists agents; `/profile` edits their profile and saves a custom preference that survives reload.
4. In Admin mode: `/admin/users` shows them as Admin, sends an invite; `/admin/analytics` renders; `/admin/organization` saves a custom org setting without breaking the OS's own settings (verified by the curl in T2.5).
5. In User mode: none of the above is visible.
6. `/iblai-vibe-ops-deploy` returns a live URL and sign-in works there (redirect origin added as instructed).
7. (Stretch, 40 minutes) `/iblai-vibe-ops-build` runs the same app in the iOS simulator or as a macOS window.

Record the run as `docs/screenshots/journey/*.png` (§7.2) and as the persona script in E8.

---

## 7. Appendices

### 7.1 Appendix A — Skill inventory by tier (current state → target)

| Skill | Lines | Screenshot | Tier | Action |
|---|---|---|---|---|
| iblai-vibe | 62 | no | 0 | T1.3 rewrite; journey strip screenshot |
| iblai-vibe-ops-init | 369 | no | 0 | T5.1; starter screenshot |
| iblai-vibe-auth | 540 | no | 0 | T6.2 ≤ 300; login screenshots |
| iblai-vibe-ops-test | 499 | no | 0 | T6.2; green-run screenshot |
| iblai-vibe-ops-deploy | 350 | no | 0 | T5.2; URL screenshot |
| iblai-vibe-agent-chat | 583 | yes (2) | 1 | T6.2 ≤ 400 (brownfield notes → references) |
| iblai-vibe-agent-search | 234 | yes | 1 | T6.2 |
| iblai-vibe-agent-setting ★ | 291 | yes | 1 | T6.2 (≤ 500), REST table from `iblai-api-agent-setting` |
| iblai-vibe-agent-create ★ (new) | — | — | 1 | T3.4 |
| iblai-vibe-profile ★ | 864 | yes | 1 | T6.2 ≤ 500; tabs → references |
| iblai-vibe-user-metadata ★ (new) | — | — | 1 | T3.1 |
| iblai-vibe-account | 271 | yes | 1 | T6.2 |
| iblai-vibe-org-metadata (new) | — | — | 1 | T3.2 |
| iblai-vibe-admin (new) | — | — | 1 | T3.3 |
| iblai-vibe-invite | 153 | yes | 1 | T6.2 (fix `org` vs `tenant` prop drift in its example) |
| iblai-vibe-rbac | 143 | yes | 1 | keep |
| iblai-vibe-navbar | 903 | no | 1 | T6.2 ≤ 400; visual spec → references; screenshots |
| iblai-vibe-notification | 322 | yes | 1 | T6.2 |
| iblai-vibe-memory-guide ★ (new) | — | — | 1 | T3.8 |
| iblai-vibe-memory | 247 | yes (4) | 1 | keep |
| iblai-vibe-agent-memory ★ | 213 | yes | 1 | keep; link guide |
| iblai-vibe-analytics ★ | 167 | yes | 1 | T6.2; REST table from `iblai-api-analytics` (scoping rule `mentor_unique_id`) |
| iblai-vibe-agent-audit | 331 | yes | 1 | keep |
| iblai-vibe-credit | 261 | yes | 1 | keep; link pricing |
| iblai-vibe-billing | 289 | yes (7) | 1 | keep; link pricing |
| iblai-vibe-agent-billing | 355 | yes (5) | 1 | keep |
| iblai-vibe-pricing (new) | — | — | 1 | T3.5 |
| iblai-vibe-monetization-app-paywall | 208 | no | 1 | screenshots |
| iblai-vibe-history | 248 | yes (3) | 1 | keep |
| iblai-vibe-project | 269 | yes (2) | 1 | keep |
| iblai-vibe-agent-chat-sidebar | 282 | yes (2) | 1 | keep |
| iblai-vibe-api (new) | — | — | 1 | T3.7 |
| iblai-vibe-agent (new index) | — | — | 2 | T3.6 |
| 23 other `iblai-vibe-agent-*` tabs | 136–471 | yes | 2 | keep; listed only in the index |
| monetization (index, onboard, configure, checkout, subscription, analytics) | 385–525 | partial | 3 | collapse to family row; checkout/analytics ≤ 500 |
| application, course-access, course-create, crm-overview, workflow, onboard, local-llm | 143–758 | mostly | 3 | workflow ≤ 500; course-access ≤ 500 |
| ops-build, ops-release, ops-upgrade, windows-msix, iconography, readme, design, deslop, scaffold, component, credential | 48–512 | build only | 4 | ops-build ≤ 500 |
| 8 security-* | 124–307 | no | 5 | one paragraph at the end |

### 7.2 Appendix E — Screenshot manifest

`docs/screenshots/journey/`:

| File | Shows | Source |
|---|---|---|
| `00-join.png` | `ibl.ai/join` sign-up form | manual, ibl.ai |
| `01-me-org-key.png` | `login.iblai.app/me` with the org block and its key (demo org) | manual |
| `02-os-admin-toggle.png` | os.ibl.ai top bar, User/Admin toggle in Admin | manual |
| `02b-os-integrations-apis-add.png` | Integrations → APIs → Add API dialog (name filled, no key visible) | manual |
| `02c-os-billing-plan-credits.png` | Organization Settings → Billing → Plan & Credits (Free plan) | manual |
| `02d-os-integrations-llms.png` | Integrations → LLMs with one masked key | manual |
| `02e-os-redirect-origins.png` | where allowed redirect origins are set | manual (locate in OS; if not exposed in UI, document the API and skip) |
| `03-starter-home-chat.png` | starter home chatting with the default agent (**README hero**) | script |
| `03b-starter-home-empty.png` | the "No agent yet" empty state | script |
| `04-starter-setup.png` | `/setup` pick-or-create agent | script |
| `05-starter-agents.png` | `/agents` | script |
| `06-starter-profile-preferences.png` | `/profile` with the custom preference card | script |
| `07-admin-users.png` | `/admin/users` (Users tab, Invite button) | script |
| `08-admin-analytics.png` | `/admin/analytics` overview | script |
| `09-admin-organization.png` | `/admin/organization` with custom org settings | script |
| `10-user-mode.png` | same app in User mode (no admin links) | script |
| `11-login-custom.png` | the customized `login.iblai.app` page for the app | manual |
| `12-deploy-ready.png` | terminal: READY + URL (masked) | manual |
| `13-macos.png`, `13-ios.png`, `13-android.png`, `13-windows.png` | native shells | reuse ops-build + capture Windows |

Per-skill screenshots for the new skills are named in each T3.x task.

### 7.3 Appendix B — SDK surface verified for this plan (`@iblai/data-layer` 1.13.2, `@iblai/web-containers` 1.19.10, `@iblai/web-utils` 2.4.3, resolved by `@iblai/iblai-js` 2.9.6; starter pins `^2.9.3`)

Verified by grepping the packages' `dist/**/*.d.ts` on 2026-09-08. Re-verify with `get_api_query_info` / `get_component_info` before use; the `.d.ts` is known to lag the runtime bundle (see `/iblai-vibe-agent-chat` caveat).

- **Per-user metadata (★):** `useGetUserPlatformMetadataQuery`, `useUpdateUserPlatformMetadataMutation`. (Profile identity: `useGetUserMetadataQuery`, `useUpdateUserMetadataMutation`, `useGetUserMetadataEdxQuery`, `useUpdateUserMetadataEdxMutation`.)
- **Org metadata:** `useGetTenantMetadataQuery`, `useUpdateTenantMetadataMutation`; web-utils `useTenantMetadata`, `useCurrentTenant`, `useUserTenants`, `useTenantSwitchSync`.
- **Users / admin:** web-utils `useIsAdmin`, `useUserData`, `useUsername`, `checkRbacPermission`; data-layer `useGetAccessibleUsersQuery`, `useGetUserInvitationsQuery`, `useCreateUserInvitationMutation`, `useGetUserAppsQuery`; components `Admin`, `UsersTab`, `RolesTab`, `PoliciesTab`, `InviteUserDialog`, `InvitedUsersDialog`, `TenantSwitcher`, `OrganizationTab`, `Account`.
- **Memory (★):** `useGetUserMemorySettingsQuery`, `useUpdateUserMemorySettingsMutation`, `useGetGlobalMemoriesQuery`, `useCreateGlobalMemoryMutation`, `useUpdateGlobalMemoryMutation`, `useDeleteGlobalMemoryMutation`, `useGetMemsearchConfigQuery`, `useUpdateMemsearchConfigMutation`, `useGetMemsearchStatusQuery`; component `AgentMemoryTab` (next).
- **Spend / billing:** `useGetTenantSpendCapQuery`, `useDeleteTenantSpendCapMutation`, `useGetAgentSpendCapQuery`, `useDeleteAgentSpendCapMutation`, `useGetUserSpendCapQuery`, `useDeleteUserSpendCapMutation`, `useGetSpendCapStatusQuery`, `useGetCreditTransactionsQuery`; components `CreditBalance`, `BillingTab`.
- **Analytics (★):** `useGetUsersStatsQuery`, `useGetRegisteredUsersTrendQuery`, `useGetWatchedUsersQuery` (+ the `useGet*StatsQuery` family named in CLAUDE.md); components `AnalyticsLayout`, `AnalyticsOverview`, `AnalyticsUsersStats`, `AnalyticsTopicsStats`, `AnalyticsTranscriptsStats`, `AnalyticsFinancialStats`, `AnalyticsReports`, `AnalyticsSettingsProvider`.
- **Agent (★ setting):** `AgentSettingsProvider`, `AgentSettingsTab`, `AgentSearch`, `Chat`, `AppSidebar`, `PlatformSidebar`, `SidebarProvider`, `SidebarInset`, `NavBar`, `UserProfileDropdown`, `SsoLogin`, `Profile`, `OnboardingWizard`, `OnboardingShell`, `TopBanner`, `Loader`. **No agent-creation component exists** (`CreateAgentDialog`/`CreateMentor*` absent) — T3.4's pattern is a server route + shadcn dialog.

### 7.4 Appendix C — REST endpoints for the common stuff (from `iblai/api`, verified against its `main` on 2026-09-08)

All under `https://api.iblai.app`, header `Authorization: Api-Token $IBLAI_API_KEY` (server-side), `{org}` = org key. Raw skill URL pattern: the `iblai/api` raw base plus `skills/<skill>/SKILL.md` — e.g. [profile-metadata](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile-metadata/SKILL.md), [agent-setting](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-setting/SKILL.md), [agent-memory](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-memory/SKILL.md), [analytics](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-analytics/SKILL.md), [profile](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile/SKILL.md).

| Need | Method + path | Skill |
|---|---|---|
| Org exists / public metadata | `GET /dm/api/core/orgs/{org}/metadata/` (no auth needed) | `iblai-api-org` |
| Org settings write | `PUT /dm/api/core/orgs/{org}/metadata/` body `{ "metadata": { …whole object… } }` — **GET first, merge, PUT** | `iblai-api-org` |
| Token verify → username | `GET /dm/api/core/token/verify/` | (vibe-agent AGENTS.md) |
| Mint token from session | `POST /dm/api/core/platform/api-tokens/` with `Authorization: Token <dm_token>` | `iblai-api-login`, `iblai-api-token` |
| ★ Per-user metadata | `GET/PATCH/PUT/DELETE /dm/api/core/users/platform-metadata/?platform_key={org}[&username={other}]`; PATCH body `{ "metadata": {…}, "delete_keys": [] }` | `iblai-api-profile-metadata` |
| ★ Profile (basic/social) | `GET/PATCH /lms/api/user/v1/accounts/{username}` (`application/merge-patch+json`); education/experience/résumé under `/dm/api/career/…` | `iblai-api-profile` |
| Users list (+policies) | `GET /dm/api/core/platform/users/?platform_key={org}&platform_org={org}&query=&page=&page_size=&return_policies=true` | `iblai-api-management` |
| Activate/deactivate | `POST /dm/api/core/users/platforms/` `{user_id, platform_key, active}` | `iblai-api-management` |
| Invite | `POST /dm/api/catalog/invitations/platform/` `{email, platform_key, redirect_to, source, active, …CSV fields}`; list `GET …?platform_key=&sort=-id` | `iblai-api-invite` |
| Roles / policies / groups | `/dm/api/core/rbac/{roles,policies,groups}/`; discovery `rbac/actions/definitions/`; agent access `rbac/agent-access/` | `iblai-api-rbac`, `iblai-api-management` |
| ★ Create agent | `POST /dm/api/ai-mentor/orgs/{org}/users/{username}/mentor-with-settings/` `{template_name:"ai-mentor", new_mentor_name, display_name, description, system_prompt, llm_provider}` → `unique_id` | `iblai-api-agent-create` |
| ★ Agent settings | `GET …/users/{username}/mentors/{mentor}/settings/`; `PUT` same (multipart, changed keys only); `POST …/mentors/{mentor}/fork/`; `DELETE …/users/{username}/{mentor}/` | `iblai-api-agent-setting` |
| List agents | `GET /dm/api/search/orgs/{org}/users/{username}/mentors/` | `iblai-api-search` |
| ★ Memory | agent: `…/users/{username}/mentors/{mentor}/mentor-memories[-list]/` (GET/POST/PATCH/DELETE); categories `…/orgs/{org}/mentors/{mentor}/memory-categories/`; agent knowledge `…/orgs/{org}/mentors/{mentor}/agent-memories/`; global `…/users/{username}/global-memories/`; settings `…/users/{username}/memsearch-settings/`, status `…/memsearch-status/` | `iblai-api-agent-memory` |
| ★ Analytics | `/dm/api/analytics/{topics,conversations,sessions,ratings,time,users,messages,content,financial,llm-usage,user,learners}…?platform_key={org}[&mentor_unique_id=]`; audit `…/mentors/audit-logs/`; reports `/dm/api/reports/platforms/{org}/…` | `iblai-api-analytics` |
| Notifications | see `iblai-api-notification` (counts, inbox, mark read, send) | `iblai-api-notification` |
| Credits / paywalls / checkout | `/dm/api/billing/account/`, `/transactions/`, `…/items/{item}/paywall/`, `/access-check/…`, `…/checkout…` | `iblai-api-billing` |
| Spend caps | `PUT/GET/DELETE /dm/api/ai-mentor/orgs/{org}/spend-caps/tenant/`, `…/mentors/{mentor}/spend-cap/`, `…/spend-caps/users/{username}/`; learner-safe `GET …/spend-caps/status/{user_id}/` | `iblai-api-spend-caps` |
| App paywall (own Stripe) | `…/orgs/{org}/users/{username}/providers/stripe/payments/{products,prices,paywall/access,paywall/checkout,paywall/payments}` | vibe `monetization-app-paywall` |
| OpenAI-compatible LLM | `https://asgi.data.<domain>/api/ai-mentor/orgs/{org}/v1/{chat/completions,models}` with `Authorization: Bearer $IBLAI_API_KEY` | `iblai-api-inference` |

### 7.5 Appendix D — Draft copy

**D.1 README, first two sections (paste and adjust):**

> ## Build the app you actually need — in 20 minutes
>
> Sign-in, users and admins, organizations, AI agents, memory, analytics, billing — every custom app on ibl.ai needs the same dozen things. vibe gives you each one as a ready component plus a Claude Code skill that wires it in. You bring your org and your idea; the platform brings SSO, agents, RAG, LLMs, and a Stripe-backed credit meter. Ship it as a website, a macOS/Windows app, and an iOS/Android app from one codebase.
>
> ![Your app after setup: signed in, chatting with your agent](docs/screenshots/journey/03-starter-home-chat.png)
>
> ## The journey
>
> 0. **Get an org** — sign up at [ibl.ai/join](https://ibl.ai/join); it creates your account *and your organization* (everyone is also in the shared `main` org — that one is not yours). → [Platform lifecycle](docs/platform-lifecycle.md)
> 1. **Get two values** — your org key (on [login.iblai.app/me](https://login.iblai.app/me)) and a Platform API Token (os.ibl.ai → Admin → Integrations → APIs). → same doc
> 2. **Scaffold and run** — `npx skills add iblai/vibe --all`, then `/iblai-vibe-ops-init`, then `pnpm dev`; sign in; pick or create your agent on `/setup`.
> 3. **Add the core** — profile, admin area, custom user/org data, memory, analytics, notifications: one skill each, below.
> 4. **Make it yours** — your pages with shadcn; anything without a component through the REST API (`/iblai-vibe-api`).
> 5. **Charge (optional)** — `/iblai-vibe-pricing` explains how you are billed and the three ways to bill your users.
> 6. **Ship** — `/iblai-vibe-ops-deploy` for a URL; `/iblai-vibe-ops-build` and `/iblai-vibe-ops-release` for desktop, mobile, and the stores.

**D.2 CLAUDE.md "Start here" decision table (top of file):**

| The user says… | Do this |
|---|---|
| "new app", "start a project", "scaffold" | `/iblai-vibe-ops-init` (copies vibe-starter; asks only for org key + token; refuses `main`) |
| "chat", "talk to the agent", "assistant" | starter already has it on `/`; needs an agent — `/setup` or `/iblai-vibe-agent-create`; customize with `/iblai-vibe-agent-chat` |
| "create an agent", "another agent" | `/iblai-vibe-agent-create` ★ then `/iblai-vibe-agent-setting` ★ (tabs: `/iblai-vibe-agent`) |
| "users", "admins", "roles", "invite" | `/iblai-vibe-admin` (User/Admin mode, `/admin/users`), `/iblai-vibe-invite`, `/iblai-vibe-rbac` |
| "store something per user", "preferences", "onboarding progress", "custom user fields" | `/iblai-vibe-user-metadata` ★ (never localStorage, never your own DB) |
| "organization setting", "white-label", "per-org config" | `/iblai-vibe-org-metadata` (GET-merge-PUT) + `/iblai-vibe-account` |
| "profile", "avatar", "résumé" | `/iblai-vibe-profile` ★ |
| "remember", "memory", "personalize" | `/iblai-vibe-memory-guide` ★ → `memory` / `agent-memory` |
| "analytics", "usage", "costs", "transcripts", "who changed what" | `/iblai-vibe-analytics` ★, `/iblai-vibe-agent-audit` |
| "charge", "pricing", "paywall", "credits", "spend limit" | `/iblai-vibe-pricing` → the rail it picks |
| "deploy", "URL", "iOS", "Android", "Mac", "Windows", "App Store" | `/iblai-vibe-ops-deploy`, `/iblai-vibe-ops-build`, `/iblai-vibe-ops-release` |
| anything with no component | `/iblai-vibe-api` (server route + `Api-Token`; the matching `iblai/api` skill) |

Rules that never change: components before custom code (SDK → shadcn → custom); `pnpm install --ignore-scripts`; lowercase project names; ask for a real agent UUID, never invent one; never print a token; run `/iblai-vibe-ops-test` before saying "done".

### 7.6 Appendix F — Glossary (content for `docs/glossary.md`)

| Term | Meaning | On the wire / in code |
|---|---|---|
| **Platform** | The ibl.ai system as a whole (`api.iblai.app`, `login.iblai.app`, `os.ibl.ai`) | "Platform API Token" |
| **Organization (org)** | One customer's isolated workspace: users, agents, branding, data, credits | `platform_key`, `platform_org`, `org`, `tenant` (SDK/env: `NEXT_PUBLIC_MAIN_TENANT_KEY`, `localStorage.tenants`) |
| **Org key** | The org's identifier (`acme`, or a UUID). Never `main`. | `PLATFORM` in `iblai.env` |
| **`main`** | The shared default org every account belongs to. Not yours. | refused by ops-init |
| **Member / user** | A signed-in person who belongs to the org | `is_admin: false` in `tenants[]` |
| **Admin** | A member with the org's Admin role (all policies implicitly) | `is_admin: true`; `isTenantAdmin()` |
| **Agent** | A configured AI assistant (LLM, prompts, datasets, tools, memory) | `mentor`, `mentor_unique_id` (UUID) |
| **Platform API Token** | A server-side secret scoped to one org; `Authorization: Api-Token …`; also a `Bearer` key on the OpenAI-compatible `/v1` | `TOKEN` / `IBLAI_API_KEY` |
| **Session tokens** | Browser-side, minted by SSO: `axd_token`, `dm_token`, `edx_jwt_token`; `Authorization: Token …` | `localStorage` (see `docs/security-model.md`) |
| **User metadata** | Schemaless JSON per user × org | `…/users/platform-metadata/` |
| **Org metadata** | One JSON object per org holding OS settings + yours; public read; PUT replaces | `…/orgs/{org}/metadata/` |
| **Memory** | User-global memories; per-agent memories by category; agent knowledge (shared) | `global-memories`, `mentor-memories`, `agent-memories` |
| **Credits** | Prepaid balance the org's usage draws down; Free/Trial/Premium plans; auto-recharge | `/dm/api/billing/account/` |
| **Spend cap** | Admin ceiling on LLM cost at org / agent / user-on-agent scope; block or alert | `…/spend-caps/…` |
| **App paywall** | Pay-to-enter for a whole app on the org's own Stripe key, no commission | `/iblai-vibe-monetization-app-paywall` |
| **Monetization (Connect)** | Selling items (agents, courses…) via Stripe Connect Express with ibl.ai commission | `/iblai-vibe-monetization*` |
| **Redirect origins** | Allowed origins SSO may return to; every app origin must be listed | set in the OS |

---

*End of plan.*

---

## 8. Implementation status (branch `dev-ux-revamp`, 2026-09-08)

Done on this branch, verified by the repo's own gates (validator, adapters,
pins, links, table check, render gate with `--build`, starter typecheck /
lint / unit tests):

| Epic | Task | Status |
|---|---|---|
| E1 | T1.1 README · T1.2 CLAUDE.md (repo + ops-init-generated + scaffold `.j2` + starter `AGENTS.md`) · T1.3 `/iblai-vibe` index · T1.4 glossary · T1.5 `docs/platform-lifecycle.md` | done (lifecycle doc has screenshot placeholders — see E4) |
| E2 | T2.1 home = chat + empty state · T2.2 `/agents` · T2.3 User/Admin mode · T2.4 admin area (users + invites, analytics ×6, billing, memory, organization) · T2.5 `useUserSettings` / `useOrgSettings` + admin route + tests · T2.6 `/setup` (name app, pick/create agent) · T2.7 env accessors, `.mcp.json`, placeholder alert, README · T2.8 unit tests (29) + Playwright member/admin journeys + `COVERAGE.md` · T2.9 `docs/security-model.md` | done — `pnpm typecheck`, `pnpm test`, `pnpm build` green |
| E3 | T3.1 `user-metadata` ★ · T3.2 `org-metadata` · T3.3 `admin` · T3.4 `agent-create` ★ · T3.5 `pricing` · T3.6 `agent` (index) · T3.7 `api` · T3.8 `memory-guide` ★ — all with `test.json` overlays where they ship code | done — render gate green |
| E4 | T4.1 conventions · T4.2 `scripts/capture-screenshots.mjs` · T4.3 | conventions + script done; **the PNGs are placeholders** (`scripts/placeholder-screenshot.py`) until someone with an admin account on the demo org runs the capture script and takes the manual OS/`/me`/`/join` shots |
| E5 | T5.1 credentials ladder (verify curls, OS click path, `main` refusal, redirect origins) · T5.2 redirect-origin notes in auth/deploy/build · T5.3 portable validator · T5.4 `scripts/dedupe-boilerplate.mjs` (43 skills, 246 paragraphs) + the eight over-length skills trimmed into `references/` · T5.5 `scripts/check-skill-tables.mjs` in CI | done |
| E6 | T6.1 `templates/skill-template-feature.md` · T6.2 | template done; the Tier 0/1 rewrites to the template are **partial** (auth, profile, navbar, agent-chat trimmed and de-duplicated; the remaining Tier 1 skills keep their structure) |
| E7 | native visibility in README/lifecycle/ops-init closing message | done (Windows shell screenshot still to capture) |
| E8 | table check in `skills-ci.yml` · PR template · TESTING.md | done; the persona-prompt journey script and the "deterministic tiers on every PR" change are **not** done (they change CI cost — a maintainer decision) |

Not done, deliberately: moving the security skills to a sibling repo;
un-gating CI tiers; the live 20-minute test (needs an `ibl.ai/join` account
and an admin on a demo org); real screenshots.
