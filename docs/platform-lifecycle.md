# The platform lifecycle — from `ibl.ai/join` to a running app

Read this once, before `/iblai-vibe-ops-init`. It is the part of the journey
that happens *outside* your code: getting an organization, the two values
every app needs, how the organization is billed, and the settings that only
exist in the ibl.ai OS. Ten steps; most take a minute.

> Words: **organization (org)** is your workspace; its **org key** is its id;
> an **agent** is what the API calls a `mentor`. Full list in
> [glossary.md](glossary.md).

## 1. Get an organization — `ibl.ai/join`

Sign up at **https://ibl.ai/join**. It creates your account **and your own
organization**, and leaves you signed in.

Every account also belongs to a shared organization called **`main`**. That
one is everyone's, not yours: apps built with vibe refuse it, and nothing you
configure there is private. If `/me` (step 3) shows only `main`, you still
need to create an organization at `ibl.ai/join`.

<!-- screenshot: docs/screenshots/journey/00-join.png -->

## 2. Your organization lives in the OS — `os.ibl.ai`

The OS at **https://os.ibl.ai/platform/\<org-key\>/…** is two things at once:

- the reference app every vibe app is modelled on (its source is
  [iblai/os](https://github.com/iblai/os)), and
- **the admin console for your organization** — users, roles, LLM keys, API
  tokens, billing, memory, branding — until your own app grows an admin area
  (`/iblai-vibe-admin`).

Top-right there is a **User / Admin** toggle. Everything below that says
"Admin mode" needs it switched to **Admin**.

<!-- screenshot: docs/screenshots/journey/02-os-admin-toggle.png -->

## 3. Value one: the org key

Open **https://login.iblai.app/me**. Each organization you belong to is
listed with its **key** — a slug like `acme` or a UUID. The same key is the
path segment after `/platform/` in every OS URL.

Check it exists (public read, no auth):

```bash
curl -fsS https://api.iblai.app/dm/api/core/orgs/<org-key>/metadata/ | head -c 200
# 200 with "platform_name" → the key is right · 404 → typo
```

This is `PLATFORM` in `iblai.env` and `NEXT_PUBLIC_MAIN_TENANT_KEY` in `.env.local`.

<!-- screenshot: docs/screenshots/journey/01-me-org-key.png -->

## 4. Value two: a Platform API Token

Your app's server (deploys, admin routes, anything with no SDK component)
authenticates with one org-scoped secret. Three ways to get it:

1. **In the OS (no tooling):** Admin mode → settings → **Integrations** →
   **APIs** tab → **Add API**. Name it after the app (`my-app`), leave the
   expiry empty, keep the default Owner permissions, **Submit**. The secret
   is shown **once** — copy it now. (The same key list is reachable from any
   agent's Edit Agent → Integrations → API; they are one store.)
2. **From your agent:** `npx skills add iblai/vibe --all` then `/iblai-api-login` — it
   reads the signed-in session and mints the token for you (needs a browser
   tool such as `claude --chrome`).
3. **CI / headless:** an **org secret** (issued for automation) works directly
   as the token.

Verify it, and learn your username at the same time (the deploy skill needs
`IBLAI_USERNAME`):

```bash
curl -fsS -H "Authorization: Api-Token <token>" https://api.iblai.app/dm/api/core/token/verify/
# 200 with {"username": "..."} → keep both values · 401 → wrong token
```

This is `TOKEN` in `iblai.env` and `IBLAI_API_KEY` in `.env.local`.
Both files are gitignored in every vibe app; never paste the token into a
chat transcript, a commit, or a screenshot. It is also a standard OpenAI-style
key for the platform's OpenAI-compatible endpoint
(`https://asgi.data.iblai.app/api/ai-mentor/orgs/<org-key>/v1`, `Authorization: Bearer`)
— server-side only.

<!-- screenshot: docs/screenshots/journey/02b-os-integrations-apis-add.png -->

## 5. How you are billed — credits

Admin mode → settings → **Billing**.

- **Plan & Credits:** your plan (`Free` → `Trial` → `Premium`, **Upgrade** goes
  through Stripe checkout), your **credit balance**, **Add Credits**, and
  **Auto Recharge** (opt-in: threshold, amount, optional spending limit; needs
  a payment method on file, added via **Manage Billing** → Stripe portal).
- Agents draw credits down as they run. The balance is a hard ceiling: when it
  is spent, agents pause. No per-seat fees.
- **Spend Limits:** one org-wide cap on LLM cost per day/week/month/year,
  **Block Requests** or **Alert Only**, alerts at 80 % / 95 %.
- **Agent Limits:** the same per agent, and per user on an agent.

For what to charge *your* users, see `/iblai-vibe-pricing`.

<!-- screenshot: docs/screenshots/journey/02c-os-billing-plan-credits.png -->

## 6. More models — your own LLM keys

Admin mode → settings → **Integrations** → **LLMs** → **Add LLM**. Pick a
provider (OpenAI, Anthropic, Google, Azure OpenAI per deployment, …) and paste
its key; it is stored masked. Agents in the org can then select those models
(`/iblai-vibe-agent-llm`). Costs by provider and model appear under
**Analytics → Costs**.

<!-- screenshot: docs/screenshots/journey/02d-os-integrations-llms.png -->

## 7. Agents

Create one in the OS (**Explore → Create Agent**, or `/create-mentor`), or
from your app with `/iblai-vibe-agent-create`, or headless with
`/iblai-api-agent-create`. An agent's id is the UUID at the end of its OS URL:
`https://os.ibl.ai/platform/<org-key>/<agent-uuid>`. The vibe-starter `/setup`
page lets an admin pick or create the app's default agent without touching env
files.

## 8. People — users and admins

Admin mode → settings → **Management** → **Users**: every member with a
**Role** (`Admin` / `User`), optional **Policies** (finer grants from the
Roles + Policies tabs), and an active/inactive **Status**. **Invite** sends
one email or a CSV (`email`, `first_name`, `last_name`, `platform_key`,
`company_name`, `user_group`). The same surface is what `/iblai-vibe-admin`
mounts inside your app.

## 9. Sign-in must be allowed to come back — redirect origins

SSO returns the user to your app only if the app's origin is among the
organization's **allowed redirect origins**. `http://localhost:3000`, every
deployed URL (`https://<name>.vercel.app` and any custom domain), and a
mobile custom scheme (`<scheme>://`, see `/iblai-vibe-ops-build`) each need to
be listed. If sign-in redirects to `login.iblai.app` and never returns, this
is the first thing to check — ask your ibl.ai operator to add the origin.

## 10. Charging your users — three rails, one decision

| You want | Rail | Skill |
|---|---|---|
| Members pay to enter the whole app, on your own Stripe account, no commission | App paywall | `/iblai-vibe-monetization-app-paywall` |
| Sell specific agents / courses / items, subscriptions, revenue dashboards | Item monetization (Stripe Connect) | `/iblai-vibe-monetization` |
| Let org admins top up ibl.ai credits from inside the app | Platform credits | `/iblai-vibe-credit`, `/iblai-vibe-billing` |

`/iblai-vibe-pricing` walks through the choice.

## Before you run `/iblai-vibe-ops-init`

- [ ] I have my own organization (not `main`) and its **org key** — the metadata curl returns 200.
- [ ] I have a **Platform API Token** — `token/verify/` returns 200 and I noted the `username`.
- [ ] I know which **agent** the app fronts, or I will create one on `/setup`.
- [ ] `http://localhost:3000` is an allowed redirect origin (ask if unsure).
- [ ] I have Node 20+ and `pnpm` (or `npm`), and Claude Code / Cursor with `npx skills add iblai/vibe --all` done.

Then: `/iblai-vibe-ops-init` → `pnpm dev` → sign in → `/setup`.
