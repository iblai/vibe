# The ibl.ai repos, one by one

Every repo below builds on the same hosted backend (`https://api.iblai.app`), with
each **organization** (org) isolated — its own users, agents, branding, and data.
They differ in what they let you do to it. Vibe's *build* mechanics have their own
file (`app-tooling.md`); this file is the per-repo orientation: what each repo is,
who it's for, and the facts you need to fork or study it.

---

## iblai/vibe — the management layer (`iblai-api-*` skills, formerly iblai/api)

> **[github.com/iblai/vibe](https://github.com/iblai/vibe)** (merged from iblai/api) · MIT · works with Claude Code, Cursor, GitHub Copilot, and 15+ other skills-compatible agents.

A toolkit for operating the ibl.ai platform **headlessly** — from a coding agent, a
terminal, CI, or any MCP-capable assistant, no UI required. It packages every
agent-configuration and platform-admin operation as a **skill** that maps directly
to its exact `api.iblai.app` REST endpoints (method, URL, body), plus **one hosted
MCP server** for the single runtime capability that isn't a REST call: chatting with
a deployed agent (streamed responses, tool use, RAG).

It's for developers and platform administrators who'd rather configure agents,
manage datasets and memory, administer users and roles, send notifications, and pull
analytics as `/` commands than hunt through docs. Authenticate once and you can
target any org you belong to by org key + Api-Token.

**How it works:** *Install* (`npx skills add iblai/vibe --all`) → *Connect*
(`/iblai-api-login` captures your org + username from
[login.iblai.app/me](https://login.iblai.app/me) and stores an Api-Token in `.env`)
→ *Operate* (invoke any `/iblai-api-*` skill) → *Automate* (chain skills, or wire the
chat MCP server into your assistant).

**What the skills cover** — you're already in the repo, so browse `skills/` for the
authoritative list; the capability groups are:

- **Agent skills** (`/iblai-api-agent-*`) — one agent's creation, identity, model, prompts, knowledge (RAG datasets: files, URLs, YouTube, crawl, GitHub), memory, safety/moderation, PII/privacy, MCP connectors, evals (LLM-as-Judge + human scoring), scheduled tasks, history, audit, embed, and **chat**.
- **Org-admin skills** (bare `/iblai-api-*`) — users, groups, roles, policies, teams, and alerts (`management`); roles/policies/permission checks (`rbac`); SCIM 2.0 provisioning (`scim`); credits, paywalls, checkout, subscriptions (`billing`); Platform API Token rotation (`token`); plus `org`, `integration`, `notification`, `invite`, `feature`, `crm`.
- **Profile skills** — the signed-in user's own profile (`profile`) and a per-user, per-org metadata key-value store (`profile-metadata`).
- **Content & discovery** — faceted discovery + personalized RAG recommendations (`search`); KPIs, users, topics, transcripts, costs, courses, reports (`analytics`); the Course Creation API (`course-create`); courses/programs/pathways/taxonomy (`catalog`, `milestone`, `credential`, `catalog-media`, `catalog-invitation`).

> **Naming note.** This repo's skills are `iblai-api-*` (e.g. `/iblai-api-login`); vibe's skills are `iblai-*` (e.g. `/iblai-auth`). The names overlap in places — that's expected. Use the `iblai-api-*` names when operating this platform.

**Skills vs. the MCP server** — the split is *administer-over-REST vs. chat-at-runtime*.
Skills do everything reachable over REST; the hosted MCP server exists only to hold a
live conversation with a deployed agent. **If a skill covers it, there is no server
for it.** The chat MCP is hosted at `https://asgi.data.iblai.app/mcp/agent-chat/`
(auth header `Authorization: Api-Token <key>`); **`/iblai-api-agent-chat`** writes the
`claude mcp add` / `.mcp.json` config for you from your `.env` token and a chosen
agent.

**Auth:** base URL `https://api.iblai.app`; header `Authorization: Api-Token <key>`
on every request; org + username come from `login.iblai.app/me` (each org shows its
key — e.g. `enterprise`, `iblai`, or a UUID). `/iblai-api-login` mints your first
token; `/iblai-api-token` lists/creates/rotates them (the secret is shown once).
Never commit `.env`.

**Quick start:** [Node.js](https://nodejs.org) (for `npx`), a skills-compatible agent
(Claude Code, Cursor, OpenCode, 15+ others), and an ibl.ai account (no account? sign
up at [ibl.ai/join](https://ibl.ai/join) — it creates your account *and* your org).
Then `npx skills add iblai/vibe --all` and `/iblai-api-login`.

---

## iblai/vibe — the build layer

> **[github.com/iblai/vibe](https://github.com/iblai/vibe)** · MIT · Next.js · TypeScript · Tailwind CSS · desktop & mobile via Tauri v2. *"Ship AI-powered apps fast. Backend included."*

A developer toolkit for **vibe coding new applications on the existing ibl.ai
backend**. It hands you a production-ready scaffold — powered by the `iblai-app-cli`
scaffolder, the `@iblai/iblai-js` SDK, pre-built components, and Claude Code skills —
against a full backend at `iblai.app`. Zero to a deployed AI app in minutes, with
authentication, AI chat, profiles, notifications, and analytics already wired up.

Vibe is where you *start* when building something new. It's for developers (and their
AI agents) who want a working app without building or hosting backend services. Auth
is **client-side SSO** — no API tokens to store, rotate, or leak (the opposite of
this repo's Api-Token model, and the reason vibe is the right layer for end-user
apps). Both sample apps below — **os** and **lms** — are built with this toolkit.

The build mechanics — the CLI, the `@iblai` packages, the full skills catalog, the
backend capabilities, and the scaffold-to-deploy quickstart — are in
**[`app-tooling.md`](app-tooling.md)**.

---

## iblai/os — the AI agent platform (sample app)

> **[github.com/iblai/os](https://github.com/iblai/os)** · MIT · Next.js · runs on web, macOS, iOS, Android, Windows, and Linux. Live at [os.ibl.ai](https://os.ibl.ai).

A complete, production-grade application for building, deploying, and managing
conversational AI agents — prototype to production in minutes. It is the **frontend**
for the ibl.ai platform: the backend provides auth, agent APIs, and data services;
this repo is the full app codebase you can clone, run, and modify. Take it, point it
at your org, rebrand it, and ship it — as a web app or as native desktop/mobile from
the same codebase.

**Features:** custom **AI agents** (configurable LLMs, system prompts, tools, safety
filters); **RAG training** (upload docs, connect Google Drive / OneDrive / Dropbox,
or crawl websites); **voice calls** (real-time WebRTC via LiveKit); **deep research**
(multi-step reasoning); **canvas / artifacts** (generate, edit, version rich
documents in-chat); **screen sharing**; **web search**; **MCP servers** (GitHub,
Notion, Slack, and more); **analytics** (usage dashboards, topic analysis, transcript
viewer, financial reporting); **projects** (collaborative workspaces grouping agents
with shared context); **cross-platform** (web/desktop/mobile); **multi-organization**
isolation (per-org config, branding, users); **SSO** (OAuth, OIDC, SAML); **RBAC**;
**Stripe billing** (subscriptions, free trials, usage-based); **embed mode** (iframe
with custom styling); **custom domains**; **API keys**; **whitelabeling** (branding,
logos, disclaimers).

**Available on:** Web (production at os.ibl.ai, any modern browser), macOS, iOS,
Android, Windows, Linux — one codebase, six platforms, near-native performance.

**Deployment** (the backend is *not* included — see [ibl.ai](https://ibl.ai) to get
started):

- **Option A — existing org key.** Configure and deploy with Docker (recommended):
  ```bash
  cp .env.example .env.local
  docker build -t os .
  docker run -p 5000:5000 --env-file .env.local os
  ```
  Or standalone — the build emits a self-contained server under `.next/standalone/`
  (Next.js standalone output):
  ```bash
  pnpm build
  PORT=3000 node server-wrapper.js
  ```
- **Option B — enterprise.** For full backend infrastructure, request an enterprise
  license (full backend codebase) at [ibl.ai/contact](https://ibl.ai/contact). If you
  already have the Docker images, deploy them via
  [iblai/iblai-infra-cli](https://github.com/iblai/iblai-infra-cli) (see
  `/iblai-api-infrastructure`).
- **Desktop & mobile:** native build instructions in the repo's `docs/development.md`;
  full deployment in `docs/standalone-deployment.md`.

**Testing:** Playwright e2e tests in `e2e/`. `make e2e-ui` runs the suite;
`make e2e-install` installs browsers once. Other targets: `make e2e` (headless),
`make e2e-headed`, `make e2e-chrome`, `make e2e-journey J=01` (single journey),
`make e2e-report`. Coverage is tracked in `e2e/COVERAGE.md` and must not regress.

**Quick start:**
```bash
git clone https://github.com/iblai/os.git
cd os
pnpm install
```
Using Claude Code? Run `/setup` — it connects your ibl.ai org and configures
`.env.local` automatically. Manual setup: `cp .env.example .env.local`, then set
`NEXT_PUBLIC_MAIN_TENANT_KEY` to your org key from
[login.iblai.app/me](https://login.iblai.app/me), then `pnpm dev` and open
`http://localhost:3000`. The repo's `docs/development.md` covers env vars, scripts,
and architecture; the README's Troubleshooting section covers the common blank-page
causes (a stale server holding the port, or a stray parent lockfile nesting the
standalone output).

---

## iblai/lms — the skills-intelligence platform (sample app)

> **[github.com/iblai/lms](https://github.com/iblai/lms)** · Next.js 15 · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Tauri 2. Live at [lms.ibl.ai](https://lms.ibl.ai).

A production-ready learning and skills-management platform that connects learners
with courses, tracks competency growth, issues credentials, and delivers analytics.
It ships as a modern web app backed by the ibl.ai multi-org API with integrated LMS
and AI-agent capabilities, on the
[@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) SDK. Like os, it's a
full codebase you fork and modify — for an enterprise upskilling program, a
university's online courses, or a branded EdTech marketplace.

**Features:**

- **Course discovery & enrollment** — faceted search (subject, difficulty, skills,
  credential type, content type) with AI-powered personalized recommendations; rich
  course pages (syllabus, outcomes, instructor bios, prerequisites); flexible
  enrollment (self, invitation-only, Stripe-paid). Content, progress, and grading are
  delivered via the embedded **edX LMS** integration.
- **Skills & competency tracking** — a skill inventory with proficiency levels (0–5)
  and skill points from course/unit completions; skill leaderboards across learners
  and cohorts; an onboarding flow to self-report competencies; skills-to-course
  mapping.
- **Credentials & badges** — certificates, badges, and micro-credentials with issuer
  metadata, expiration tracking, and sharing for verification; course-linked
  credentials issued automatically on completion.
- **Programs & learning pathways** — multi-course programs with progress tracking and
  curated pathways toward career goals; pricing, enrollment windows, custom metadata;
  learners and orgs can build and share custom pathways.
- **Learner profile & analytics** — activity dashboard (courses enrolled/completed,
  skills acquired, time spent) with daily/weekly charts; a shareable public profile
  (education, experience, credentials); a resume builder.
- **Admin analytics** — platform-wide usage/engagement overview, per-learner
  analytics, topic analysis, a searchable transcript viewer, financial reporting, and
  downloadable custom reports.
- **Enterprise & platform** — per-org isolation (config, branding, users); granular
  RBAC; SSO with configurable identity providers; Stripe billing; in-app
  notifications; white-labeling (themes, logos, advanced CSS per org); an embedded
  conversational AI-agent sidebar for learner support; configurable onboarding with
  skill self-assessment.

**Tech stack:** Next.js 15 / React 19 / TypeScript 5.9; Tailwind CSS 4 + Radix UI +
shadcn/ui; Redux Toolkit + React-Redux (state); React Hook Form + TanStack Form + Zod
(forms); Recharts (charts); Framer Motion (animation); react-pdf + pdfjs-dist (PDF);
Tauri 2 (desktop/mobile shell); Vitest + Testing Library + Playwright (testing);
`@iblai/iblai-js` (SDK).

**Data flow:** React components and custom hooks → Redux (RTK Query) → the ibl.ai API,
via `@iblai/iblai-js` — which bundles the data layer (`/data-layer`), auth + org
utilities (`/web-utils`), and shared UI components (`/web-containers`) in one package.

**Configuration:** all app config is `NEXT_PUBLIC_*` (browser-exposed); defaults match
`.env.example`. Key required vars: `NEXT_PUBLIC_API_BASE_URL` (default
`https://api.iblai.app` — the `/dm`, `/axd`, `/lms`, and `/studio` paths derive from
it), `NEXT_PUBLIC_LMS_URL` (edX LMS host), `NEXT_PUBLIC_AUTH_URL` (auth service),
`NEXT_PUBLIC_MFE_URL` (Open edX micro-frontends host); full reference in the README.
**Feature flags** (env-toggled): `NEXT_PUBLIC_ENABLE_START_ROLE=true` (onboarding),
`NEXT_PUBLIC_ENABLE_MENTOR=true` (AI sidebar), `NEXT_PUBLIC_ENABLE_RBAC=true`,
`NEXT_PUBLIC_COURSE_ELIGIBILITY_ENABLED=true`, `NEXT_PUBLIC_HIDE_RECOMMENDED_TAB=false`.
The skill leaderboard is toggled via org metadata (`isSkillsLeaderBoardEnabled`);
theming is documented in the repo's `docs/theme-customization.md`.

**Deployment:**

- **Docker:** `docker build -t lms .` then `docker run -p 3000:3000 --env-file .env.local lms`.
- **Standalone:** `pnpm build` then `pnpm start` (a standard Next.js production
  server — deploy to any host with Node.js 25+).
- **Desktop & mobile (Tauri):** the Tauri 2 shell in `src-tauri/` packages the same
  Next.js bundle. There are no `pnpm tauri:*` scripts — invoke the Tauri CLI directly:
  ```bash
  cd src-tauri && cargo tauri dev      # desktop dev (hot reload)
  cd src-tauri && cargo tauri build    # desktop production build
  cd src-tauri && cargo tauri ios init      # iOS
  cd src-tauri && cargo tauri android init  # Android
  ```
  Requires the Rust toolchain (`rustup`), plus Xcode (iOS) and Android SDK + NDK
  (Android).

**Quick start:** prerequisites **Node.js 25.3.0+** (nvm recommended) and **pnpm 10+**
(`npm install -g pnpm`).
```bash
git clone https://github.com/iblai/lms.git
cd lms
pnpm install
cp .env.example .env.local   # edit with your ibl.ai URLs + feature flags
pnpm dev                     # open http://localhost:3000
```
Tests: `pnpm test` (Vitest unit), `pnpm test:coverage`, `pnpm test:e2e` (Playwright
headless), `pnpm test:e2e:ui`, `pnpm test:e2e:headed`. To *use* the app you need an
ibl.ai backend instance (Skills & Course API, edX LMS, auth, the data platform —
analytics/billing/users/notifications — and the conversational AI API). Visit
[ibl.ai](https://ibl.ai) to set up a backend or request a hosted instance.

---

## iblai/iblai-infra-cli — the deploy layer

> **[github.com/iblai/iblai-infra-cli](https://github.com/iblai/iblai-infra-cli)**

Deploy the ibl.ai platform on **your own infrastructure** — your AWS account or your
own servers — with Terraform + Ansible, given access to the backend images. This is
the alternative to running against the hosted `api.iblai.app`: the os and lms sample
apps and the api skills all point at *some* backend, and this repo is how you stand up
that backend yourself.

Its doc isn't reproduced here — the full infrastructure reference (the CLI,
AMI-based launch pipeline, single- vs. multi-server AWS architecture, and edX SSO
setup) lives in the **`/iblai-api-infrastructure`** skill. Reach for it when you need
to self-host rather than use the hosted backend.
