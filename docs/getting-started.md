# Getting started — the whole journey

The README gives you the three steps. This page is what actually happens in
each, which entry point is yours, and what to do when you are not starting from
scratch.

## Which entry point is yours

| You are | Architecture | Entry point |
|---|---|---|
| Starting a **new app for one organization** — yours, or a customer you deploy to (most apps) | **single-org**: the org key is pinned, one server-to-server token, members sign in with SSO | `/iblai-vibe-start` → `/iblai-vibe-ops-init` copies **vibe-starter** |
| Building **one deployment for many organizations**, users moving between them (the os.ibl.ai model) | **multi-org**: org in the URL, a switcher, re-auth per org | `/iblai-vibe-start` → `/iblai-vibe-ops-init`, then `/iblai-vibe-auth` → "Going multi-org" |
| Adding ibl.ai to an **existing Next.js app** | either of the above | `/iblai-vibe-start` → `/iblai-vibe-auth`, then the feature skills |
| Adding ibl.ai to an **existing app that is not Next.js** | either | `/iblai-vibe-start` → `/iblai-api-login`; the `iblai-api-*` skills work anywhere, the components need Next.js |
| Writing a **script, CI job, or backend** — nobody signs in | **headless**: a Platform API Token per org | `/iblai-vibe-start` → `/iblai-api-login`, then the `iblai-api-*` skill for the family |

How sign-in and organizations really work: [auth-model.md](auth-model.md).
The data every app is built on: [domain-model.md](domain-model.md).

## The journey

0. **Get an organization** — sign up at [ibl.ai/join](https://ibl.ai/join); it creates your account *and your organization*. (Everyone is also in the shared `main` org — that one is not yours.) → [Platform lifecycle](platform-lifecycle.md)
1. **Get two values** — your **org key** (on [login.iblai.app/me](https://login.iblai.app/me)) and a **Platform API Token** (os.ibl.ai → Admin → Integrations → APIs → Add API). → [same doc](platform-lifecycle.md#4-value-two-a-platform-api-token)
2. **Scaffold and run** — install the skills, run `/iblai-vibe-ops-init`, `pnpm dev`, sign in, pick or create your agent on `/setup`.
3. **Add the core** — profile, admin area, custom user and org data, memory, analytics, notifications: one skill each, [below](#the-core-app).
4. **Make it yours** — your pages with shadcn/ui; anything without a component through the REST API ([`/iblai-vibe-api`](../skills/start/iblai-vibe-api/SKILL.md)).
5. **Charge (optional)** — [`/iblai-vibe-pricing`](../skills/billing/iblai-vibe-pricing/SKILL.md): how you are billed, and the three ways to bill your users.
6. **Ship** — [`/iblai-vibe-ops-deploy`](../skills/ship/iblai-vibe-ops-deploy/SKILL.md) for a URL; [`/iblai-vibe-ops-build`](../skills/ship/iblai-vibe-ops-build/SKILL.md) and [`/iblai-vibe-ops-release`](../skills/ship/iblai-vibe-ops-release/SKILL.md) for desktop, mobile, and the stores.



Every step in detail, with what to click and what to check:
[platform-lifecycle.md](platform-lifecycle.md).

## Connecting your organization

`/iblai-vibe-connect` opens `login.iblai.app/connect`: you sign in (or create
an organization), pick the organization, click **Connect**, and the agent
receives the org key, your username, and a fresh Platform API Token on a
loopback callback — it writes `iblai.env`, `.env`, and `.env.local` and never
shows the token. No browser (SSH, a container)? The same page has a manual mode
you paste into the chat. Until the hosted page ships, the skills fall back to
asking for the two values and telling you exactly where they are:
[connect-flow.md](connect-flow.md).

## The core app

What `/iblai-vibe-ops-init` gives you, and the skill that owns each piece.
★ marks the five platform data families most apps read or write — each links
its headless twin, the `iblai-api-*` skill that documents the same data over REST.

| You get | Skill | Reads / writes on the platform |
|---|---|---|
| SSO sign-in, session, org resolution (a placeholder or `main` org shows an alert, not a login loop) | [`/iblai-vibe-auth`](../skills/start/iblai-vibe-auth/SKILL.md) | [login](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/start/iblai-api-login/SKILL.md) |
| **Home = chat** with your agent — streaming, files, voice, canvas | [`/iblai-vibe-agent-chat`](../skills/agents/iblai-vibe-agent-chat/SKILL.md) (+ [sidebar](../skills/agents/iblai-vibe-agent-chat-sidebar/SKILL.md), [projects](../skills/agents/iblai-vibe-project/SKILL.md)) | [agent-session](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-session/SKILL.md) |
| Agents browser (favorites, featured, custom, all) | [`/iblai-vibe-agent-search`](../skills/agents/iblai-vibe-agent-search/SKILL.md) | [search](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-search/SKILL.md) |
| ★ Create an agent from the app; set its identity, visibility, capabilities; every settings tab | [`/iblai-vibe-agent-create`](../skills/agents/iblai-vibe-agent-create/SKILL.md), [`/iblai-vibe-agent-setting`](../skills/agents/iblai-vibe-agent-setting/SKILL.md), [`/iblai-vibe-agent`](../skills/agents/iblai-vibe-agent/SKILL.md) | ★ [agent-setting](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-setting/SKILL.md) |
| ★ The user's profile — name, bio, image, education, résumé | [`/iblai-vibe-profile`](../skills/users/iblai-vibe-profile/SKILL.md) | ★ [profile](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-profile/SKILL.md) |
| ★ **Custom data per user** — preferences, flags, onboarding, app state (no DB, no localStorage) | [`/iblai-vibe-user-metadata`](../skills/users/iblai-vibe-user-metadata/SKILL.md) | ★ [profile-metadata](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-profile-metadata/SKILL.md) |
| **Organization settings + custom org data**; name, logos, support email | [`/iblai-vibe-org-metadata`](../skills/organizations/iblai-vibe-org-metadata/SKILL.md), [`/iblai-vibe-account`](../skills/organizations/iblai-vibe-account/SKILL.md) | [org](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/organizations/iblai-api-org/SKILL.md) |
| **Users vs admins** — User/Admin view switch, admin area, invites, roles and policies | [`/iblai-vibe-admin`](../skills/users/iblai-vibe-admin/SKILL.md), [`/iblai-vibe-invite`](../skills/users/iblai-vibe-invite/SKILL.md), [`/iblai-vibe-rbac`](../skills/users/iblai-vibe-rbac/SKILL.md) | [management](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-management/SKILL.md), [rbac](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-rbac/SKILL.md), [invite](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-invite/SKILL.md) |
| ★ **Memory** — what agents remember about people (user-global, per agent, agent knowledge) | [`/iblai-vibe-memory-guide`](../skills/users/iblai-vibe-memory-guide/SKILL.md), [`/iblai-vibe-memory`](../skills/users/iblai-vibe-memory/SKILL.md), [`/iblai-vibe-agent-memory`](../skills/agents/iblai-vibe-agent-memory/SKILL.md) | ★ [agent-memory](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-memory/SKILL.md) |
| ★ **Analytics** — usage, users, topics, transcripts, costs, audit, reports; org-wide or per agent | [`/iblai-vibe-analytics`](../skills/analytics/iblai-vibe-analytics/SKILL.md), [`/iblai-vibe-agent-audit`](../skills/agents/iblai-vibe-agent-audit/SKILL.md), [`/iblai-vibe-history`](../skills/users/iblai-vibe-history/SKILL.md) | ★ [analytics](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-api-analytics/SKILL.md) |
| Notifications — bell, inbox, alerts, admin send | [`/iblai-vibe-notification`](../skills/users/iblai-vibe-notification/SKILL.md) | [notification](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-notification/SKILL.md) |
| Navbar, onboarding flow, README | [`/iblai-vibe-navbar`](../skills/start/iblai-vibe-navbar/SKILL.md), [`/iblai-vibe-onboard`](../skills/users/iblai-vibe-onboard/SKILL.md), [`/iblai-vibe-readme`](../skills/ship/iblai-vibe-readme/SKILL.md) | — |
| Anything with no component | [`/iblai-vibe-api`](../skills/start/iblai-vibe-api/SKILL.md) | any of the 51 `iblai-api-*` skills |
| Test before showing work; keep current | [`/iblai-vibe-ops-test`](../skills/ship/iblai-vibe-ops-test/SKILL.md), [`/iblai-vibe-ops-upgrade`](../skills/start/iblai-vibe-ops-upgrade/SKILL.md) | — |



## How money works

- **You** run on prepaid, rechargeable **credits** with a hard ceiling (plans Free → Trial → Premium, opt-in auto-recharge, no per-seat fees). Add your own LLM keys for more models; put **spend caps** on the org, an agent, or one user on one agent.
- **Your users** can be charged three ways: pay-to-enter for the whole app on your own Stripe key with no commission ([`/iblai-vibe-monetization-app-paywall`](../skills/billing/iblai-vibe-monetization-app-paywall/SKILL.md), the [vibe-agent](https://github.com/iblai/vibe-agent) model); per-item sales with subscriptions and revenue dashboards via Stripe Connect ([`/iblai-vibe-monetization`](../skills/billing/iblai-vibe-monetization/SKILL.md) → [onboard](../skills/billing/iblai-vibe-monetization-onboard/SKILL.md), [configure](../skills/billing/iblai-vibe-monetization-configure/SKILL.md), [checkout](../skills/billing/iblai-vibe-monetization-checkout/SKILL.md), [subscription](../skills/billing/iblai-vibe-monetization-subscription/SKILL.md), [analytics](../skills/billing/iblai-vibe-monetization-analytics/SKILL.md)); or reselling platform credits ([`/iblai-vibe-credit`](../skills/billing/iblai-vibe-credit/SKILL.md), [`/iblai-vibe-billing`](../skills/billing/iblai-vibe-billing/SKILL.md), [`/iblai-vibe-agent-billing`](../skills/agents/iblai-vibe-agent-billing/SKILL.md)).
- One page decides: [`/iblai-vibe-pricing`](../skills/billing/iblai-vibe-pricing/SKILL.md).



## Two families of skills, one install

Every skill carries a `kind` in its frontmatter (`ui`, `api`, `guide`, `ops`,
`security` — [docs/skill-kinds.md](skill-kinds.md)). The name prefix tells
you the family; the kind tells you whether there is a screen.

| | `iblai-vibe-*` — **build** (has a screen) | `iblai-api-*` — **operate** (no screen) |
|---|---|---|
| What it does | Mounts an SDK visual component in your Next.js app — a page, a tab, a dialog, a widget | Drives the platform headlessly: exact REST endpoints (method, URL, body, errors), `curl` first |
| Who it is for | Builders shipping an app | Anyone operating an organization — from a terminal, a script, CI, a server route, or an agent |
| Credentials | The signed-in user's session in the browser; `IBLAI_API_KEY` only in server routes | `IBLAI_API_KEY` (Platform API Token) as `Authorization: Api-Token`, from `.env` or `iblai.env` |
| Start | `/iblai-vibe` → `/iblai-vibe-ops-init` | `/iblai-api-login` |
| Also | `guide` (indexes and decision pages), `ops` (build, deploy, test, release), `security` | Tutorials in [`tutorials/`](../tutorials/); the hosted chat MCP server in [`mcp/`](../mcp/) |

Builders use both: the `ui` skill mounts the component, its **Platform data**
table names the `api` twin for anything the component doesn't cover, and
[`/iblai-vibe-api`](../skills/start/iblai-vibe-api/SKILL.md) is the server-route pattern
that joins them. The `iblai-api-*` family is the former
[`iblai/api`](https://github.com/iblai/vibe/tree/main/skills) repository, merged
here with its authoring contract intact — [docs/api-skills.md](api-skills.md).

### Headless API skills (`kind: api`)

Connect once with [`/iblai-api-login`](../skills/start/iblai-api-login/SKILL.md) (org key,
username, Platform API Token → `.env` + `iblai.env`), then any skill below is a
`/` command that calls `https://api.iblai.app` with `Authorization: Api-Token`.

| Area | Skills |
|---|---|
| **Setup** | [`/iblai-api-login`](../skills/start/iblai-api-login/SKILL.md) (start with [`/iblai-vibe-start`](../skills/start/iblai-vibe-start/SKILL.md) if you have not) |
| **One agent** (★ = the families most apps read or write) | ★ [`agent-setting`](../skills/agents/iblai-api-agent-setting/SKILL.md), ★ [`agent-memory`](../skills/agents/iblai-api-agent-memory/SKILL.md), [`agent-create`](../skills/agents/iblai-api-agent-create/SKILL.md), [`agent-prompt`](../skills/agents/iblai-api-agent-prompt/SKILL.md), [`agent-llm`](../skills/agents/iblai-api-agent-llm/SKILL.md), [`agent-dataset`](../skills/agents/iblai-api-agent-dataset/SKILL.md), [`agent-tool`](../skills/agents/iblai-api-agent-tool/SKILL.md), [`agent-access`](../skills/agents/iblai-api-agent-access/SKILL.md), [`agent-embed`](../skills/agents/iblai-api-agent-embed/SKILL.md), [`agent-mcp`](../skills/agents/iblai-api-agent-mcp/SKILL.md), [`agent-safety`](../skills/agents/iblai-api-agent-safety/SKILL.md), [`agent-privacy`](../skills/agents/iblai-api-agent-privacy/SKILL.md), [`agent-disclaimer`](../skills/agents/iblai-api-agent-disclaimer/SKILL.md), [`agent-history`](../skills/agents/iblai-api-agent-history/SKILL.md), [`agent-audit`](../skills/agents/iblai-api-agent-audit/SKILL.md), [`agent-eval`](../skills/agents/iblai-api-agent-eval/SKILL.md), [`agent-skill`](../skills/agents/iblai-api-agent-skill/SKILL.md), [`agent-sandbox`](../skills/agents/iblai-api-agent-sandbox/SKILL.md), [`agent-support`](../skills/agents/iblai-api-agent-support/SKILL.md) |
| **Talk to an agent** | [`agent-session`](../skills/agents/iblai-api-agent-session/SKILL.md) (REST/SSE/WebSocket), [`agent-chat`](../skills/agents/iblai-api-agent-chat/SKILL.md) (hosted MCP server), [`inference`](../skills/agents/iblai-api-inference/SKILL.md) (OpenAI-compatible `/v1`) |
| **Organization** | [`org`](../skills/organizations/iblai-api-org/SKILL.md), [`management`](../skills/users/iblai-api-management/SKILL.md), [`rbac`](../skills/users/iblai-api-rbac/SKILL.md), [`invite`](../skills/users/iblai-api-invite/SKILL.md), [`scim`](../skills/users/iblai-api-scim/SKILL.md), [`token`](../skills/organizations/iblai-api-token/SKILL.md), [`integration`](../skills/organizations/iblai-api-integration/SKILL.md), [`notification`](../skills/users/iblai-api-notification/SKILL.md), [`feature`](../skills/users/iblai-api-feature/SKILL.md), [`billing`](../skills/billing/iblai-api-billing/SKILL.md), [`spend-caps`](../skills/billing/iblai-api-spend-caps/SKILL.md), [`crm`](../skills/organizations/iblai-api-crm/SKILL.md), [`external-service-proxy`](../skills/organizations/iblai-api-external-service-proxy/SKILL.md) |
| **The signed-in user** | ★ [`profile`](../skills/users/iblai-api-profile/SKILL.md), ★ [`profile-metadata`](../skills/users/iblai-api-profile-metadata/SKILL.md) |
| **Content, discovery, analytics** | ★ [`analytics`](../skills/analytics/iblai-api-analytics/SKILL.md), [`search`](../skills/agents/iblai-api-search/SKILL.md), [`catalog`](../skills/content/iblai-api-catalog/SKILL.md), [`catalog-media`](../skills/content/iblai-api-catalog-media/SKILL.md), [`catalog-invitation`](../skills/content/iblai-api-catalog-invitation/SKILL.md), [`course-create`](../skills/content/iblai-api-course-create/SKILL.md), [`milestone`](../skills/content/iblai-api-milestone/SKILL.md), [`credential`](../skills/content/iblai-api-credential/SKILL.md), [`apply`](../skills/content/iblai-api-apply/SKILL.md) |
| **Other LMSs** | [`canvas-course-builder`](../skills/content/iblai-api-canvas-course-builder/SKILL.md) (Canvas REST API) |
| **Guides (no endpoints)** | [`ecosystem`](../skills/ship/iblai-api-ecosystem/SKILL.md), [`infrastructure`](../skills/ship/iblai-api-infrastructure/SKILL.md) (self-hosting) |

Every name above is `/iblai-api-<name>`.

The full, tiered catalogue with one-line descriptions is in [`CLAUDE.md`](CLAUDE.md#skill-catalogue-by-tier).
Skills are in `skills/`; `npx skills add` installs them into your project's
`.claude/skills/`. Read them, extend them, or write your own — the front door
for agents is [`/iblai-vibe`](../skills/start/iblai-vibe/SKILL.md).



## The ibl.ai backend

`https://api.iblai.app` powers every vibe app; you build, host, and maintain
no backend services. It provides SSO (OAuth/OIDC/SAML) with multi-org
isolation and RBAC; agents with streaming, tools, RAG, memory, voice, and any
LLM; analytics; notifications; per-user and per-org metadata; credits,
spend caps, and Stripe billing. In the browser the SDK sends the signed-in
user's session token; your server holds one org-scoped Platform API Token in
the gitignored `iblai.env` / `.env.local`. How that fits together:
[docs/security-model.md](security-model.md).

### Two MCP servers

**`@iblai/mcp`** — SDK documentation for your coding assistant (components,
hooks, RTK Query endpoints, provider setup). `.mcp.json` at the project root
(vibe-starter ships it):

```json
{
  "mcpServers": {
    "iblai": { "command": "pnpm", "args": ["dlx", "@iblai/mcp"] }
  }
}
```

(`npx -y @iblai/mcp` in npm projects.) It gives your assistant
`get_component_info`, `get_hook_info`, `get_api_query_info`,
`get_provider_setup`, `create_page_template`, `get_playwright_helper_info`.

**`iblai-agent-chat`** — a *hosted* MCP server for the one runtime capability
that is not a REST call: holding a live conversation with a deployed agent
(streamed responses, tool use, RAG). No install; wire it with
[`/iblai-api-agent-chat`](../skills/agents/iblai-api-agent-chat/SKILL.md) or by hand from
[`mcp/iblai-agent-chat/README.md`](../mcp/iblai-agent-chat/README.md):

```bash
claude mcp add iblai-agent-chat --transport http https://asgi.data.iblai.app/mcp/agent-chat/ \
  --header "Authorization: Api-Token YOUR_API_TOKEN" --header "X-Mentor-Unique-Id: YOUR_AGENT_UUID"
```


