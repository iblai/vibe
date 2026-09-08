# Glossary

The words used across `iblai/vibe`, `iblai/api`, `iblai/os`, and the platform
itself. When a term has several spellings on the wire, the **Meaning** column is
what to say in prose and the **On the wire / in code** column is what to keep
verbatim in code, env files, and endpoint references.

| Term | Meaning | On the wire / in code |
|---|---|---|
| **Platform** | The ibl.ai system as a whole — `api.iblai.app`, `login.iblai.app`, `os.ibl.ai`. One platform serves every customer. | Product terms only: "Platform API Token", "the platform API" |
| **Organization (org)** | One customer's isolated workspace: its users, agents, branding, data, and credits. The primary noun for a workspace. | `platform_key`, `platform_org`, `org`, `tenant`; SDK/env: `NEXT_PUBLIC_MAIN_TENANT_KEY`, `localStorage.tenants` |
| **Org key** | The organization's identifier — a slug like `acme` or a UUID. Listed on [login.iblai.app/me](https://login.iblai.app/me) and in every `os.ibl.ai/platform/<org-key>/…` URL. | `PLATFORM` in `iblai.env`; `IBLAI_ORG` in `iblai/api` |
| **`main`** | The shared default org every account belongs to. It is never *your* org; apps refuse it. | `PLACEHOLDER_PLATFORMS` in `lib/iblai/tenant.ts` |
| **Member / user** | A signed-in person who belongs to the org. | `is_admin: false` on the org's entry in `localStorage.tenants` |
| **Admin** | A member holding the org's Admin role — every policy implicitly. Manages users, roles, billing, memory, branding. | `is_admin: true`; `isTenantAdmin()` in the app; `Ibl.*` in RBAC |
| **Agent** | A configured AI assistant: LLM, prompts, datasets (RAG), tools, memory, safety, voice. What the API calls a *mentor*. | `mentor`, `mentor_unique_id`, `mentor_id` (numeric), the UUID at the end of `os.ibl.ai/platform/<org-key>/<agent-uuid>` |
| **Platform API Token** | A server-side secret scoped to one org. Sent as `Authorization: Api-Token <token>` on every REST call; also a standard OpenAI-style `Bearer` key on the OpenAI-compatible `/v1` endpoints. Minted in os.ibl.ai (Admin → Integrations → APIs → Add API) or by `/iblai-api-login`. An **org secret** works as one too. | `TOKEN` in `iblai.env`, `IBLAI_API_KEY` in `.env.local` — never in client code |
| **Session tokens** | Browser-side tokens the SSO flow issues for the signed-in user: `axd_token`, `dm_token`, `edx_jwt_token`, plus `userData` and `tenants`. Sent as `Authorization: Token <dm_token>` by the SDK. | `localStorage` (see [security-model.md](security-model.md)) |
| **User metadata** | One schemaless JSON object per user × org — preferences, flags, onboarding progress, app state. | `GET/PATCH/PUT/DELETE …/dm/api/core/users/platform-metadata/?platform_key=` |
| **Org metadata** | One JSON object per org holding the OS's own settings (default agent, help center, auth-page branding, toggles) **and** your app's keys. Public read; **PUT replaces the whole object** — always GET, merge, PUT. | `GET/PUT …/dm/api/core/orgs/{org}/metadata/` |
| **Memory** | What agents remember: *global memories* (per user, every agent), *agent memories* (per user × agent, by category), *agent knowledge* (per agent, shared, injected as `## Agent Knowledge`). Gated by the org flag `enable_memsearch`, the agent flag `enable_memory_component`, and the user's capture/recall toggles. | `global-memories`, `mentor-memories`, `agent-memories`, `memsearch-settings` |
| **Credits** | The prepaid, rechargeable balance the org's usage draws down. Plans: Free, Trial, Premium. Auto-recharge is opt-in; the balance is a hard ceiling. | `GET /dm/api/billing/account/` |
| **Spend cap** | An admin ceiling on LLM cost — org-wide, one agent, or one user on one agent — per day/week/month/year, enforced as *block* (HTTP 429) or *alert only*. | `…/spend-caps/tenant/`, `…/mentors/{mentor}/spend-cap/`, `…/spend-caps/users/{username}/` |
| **App paywall** | Pay-to-enter for a whole app on the org's **own** Stripe key. No Stripe Connect, no commission, no webhooks. | `/iblai-vibe-monetization-app-paywall` |
| **Monetization (Connect)** | Selling individual items (agents, courses, programs, custom) through Stripe Connect Express, with an ibl.ai commission. | `/iblai-vibe-monetization*`, `enable_monetization` |
| **Allowed redirect origins** | The origins SSO is permitted to return to after sign-in. Every origin your app runs on — `http://localhost:3000`, the deployed URL, a Tauri custom scheme — must be listed, or sign-in never comes back. | An org-level setting maintained for your org by ibl.ai — if sign-in never returns to your app, this is the first thing to check; ask your ibl.ai operator to add the origin |
| **DM** | The Data Manager service behind `api.iblai.app/dm/…` — agents, memory, analytics, billing, RBAC, metadata. | `dmUrl()` in `lib/iblai/config.ts` |
| **LMS** | The Open edX service behind `api.iblai.app/lms/…` and `learn.<domain>` — courses, the user's account record (name, bio, image). | `lmsUrl()`, `legacyLmsUrl()` |
| **vibe-starter** | The Next.js template `/iblai-vibe-ops-init` copies into a new project: SSO, navbar, chat, agents, profile, admin area, metadata helpers. | `skills/iblai-vibe-ops-init/assets/vibe-starter/` |
