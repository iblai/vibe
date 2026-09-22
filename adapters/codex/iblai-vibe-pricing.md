# iblai-vibe-pricing

> Decide how money works for an ibl.ai app — how your organization is charged (prepaid credits, plans, auto-recharge, your own LLM keys, spend caps) and which of the three rails to use to charge your own users (platform credits, an app paywall on your own Stripe key, or item-level monetization via Stripe Connect). Use when the user mentions pricing, charging users, paywall, subscription, credits, "how do I get paid", Stripe, spend limits, budgets, or LLM cost. For the credit widget see /iblai-vibe-credit; for the org billing page see /iblai-vibe-billing; for per-agent caps see /iblai-vibe-agent-billing; for a whole-app paywall see /iblai-vibe-monetization-app-paywall; for selling items see /iblai-vibe-monetization.

# /iblai-vibe-pricing

> **First time here?** If `iblai.env` has no `ARCHITECTURE=`, run `/iblai-vibe-start` first (four questions; two minutes) — it decides single-org / multi-org / headless and who signs in, and every skill reads the answer.

One page that answers two questions before any billing skill is run:

1. **How does ibl.ai charge *me* (the organization)?**
2. **How do I charge *my users* — and which rail?**

Read this, pick a rail with the table in §2, then open the skill that wires it.
This skill builds nothing itself.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).
> Terms: [docs/glossary.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/glossary.md).

## 1. How the organization is charged

The platform meters usage in **credits**, not seats. Everything below is
managed in os.ibl.ai (Admin mode → settings → **Billing**) and readable from
your app with the SDK / REST surface in §4.

| Concept | What it means for you | Where |
|---|---|---|
| **Credits** | A prepaid, rechargeable balance. Agent usage (LLM calls, RAG, voice, …) draws it down. When it is spent, agents pause — the balance is a hard ceiling you set. | Billing → Plan & Credits (`Add Credits`) |
| **Plan** | `Free` → `Trial` → `Premium`. Free/Trial show an **Upgrade** button (Stripe checkout); Premium shows its renewal date. | Billing → Plan & Credits |
| **Payment method** | Stored in Stripe via **Manage Billing** (Stripe portal). Required before Add Credits and Auto Recharge work. | Billing → Plan & Credits |
| **Auto Recharge** | Opt-in. Threshold, recharge amount, and an optional spending limit (defaults when enabled empty: $5 threshold / $16 recharge; spending limit `Unlimited` unless set). | Billing → Manage Usage |
| **Your own LLM keys** | Admins add provider keys (OpenAI, Anthropic, Google, Azure per-deployment, …) under **Integrations → LLMs**. Agents can then choose those models. Costs attributed to each provider/model appear in **Analytics → Costs**. | Integrations → LLMs; `/iblai-vibe-agent-llm` |
| **Spend caps** | Admin ceilings on LLM cost at three scopes — the whole org, one agent, one user on one agent — per day/week/month/year, enforced as **Block Requests** (HTTP `429`, the chat is refused) or **Alert Only**; near-limit alerts at 80 % and 95 % by default. The tightest applicable cap governs. | Billing → Spend Limits / Agent Limits; `/iblai-vibe-billing`, `/iblai-vibe-agent-billing` |
| **`IBLAI_API_KEY` as an LLM key** | Your Platform API Token is also a standard OpenAI-style key on `https://asgi.data.<domain>/api/ai-mentor/orgs/<org>/v1` (`Authorization: Bearer`). Calls made with it are your org's usage. Server-side only. | `/iblai-vibe-ops-init`, `iblai-api-inference` |

**Rule of thumb for a new app:** set an org-wide monthly spend cap in *Alert
Only* mode on day one, then tighten to *Block* once you know the real number
(the Spend Limits tab shows actual spend this month and all time before you
set anything).

## 2. Charging your users — pick a rail

| | **A · Platform credits** | **B · App paywall (your Stripe)** | **C · Item monetization (Stripe Connect)** |
|---|---|---|---|
| What is sold | ibl.ai credits / plan tier to the org's own members | Entry to the **whole app** — one-time or subscription | Access to **specific items**: an agent, course, program, pathway, or custom item, with pricing tiers |
| Whose Stripe | ibl.ai's | **Yours** — a *restricted* key stored on the org as the `stripe` integration credential (never typed into a chat) | Your Stripe **Connect Express** account, ibl.ai-managed |
| Commission | — | None | ibl.ai commission per sale |
| Webhooks | — | None (verified polling by the platform) | Webhook-reconciled subscriptions |
| Buyer sees | `CreditBalance` widget + Stripe pricing page | Your `/paywall` page → Stripe Checkout → back into the app as a member | `PaywallModal` per item, guest/public buy, `PurchasesTab` in Profile |
| Admin sees | Billing tab | The `/setup` question (free / one-time / monthly) | `MonetizationTab` in Account: paywall config, prices, subscribers, revenue |
| Needs an operator flag | `show_paywall` | none | `enable_monetization` |
| Choose when | Your org resells ibl.ai usage to its own admins/trial users | "One app, one price, my customers" (the [`iblai/vibe-agent`](https://github.com/iblai/vibe-agent) model) | A marketplace of agents/courses with per-item prices, trials, subscriptions, and revenue reporting |
| Skill | `/iblai-vibe-credit`, `/iblai-vibe-billing` | `/iblai-vibe-monetization-app-paywall` | `/iblai-vibe-monetization` (family index) |

Decision in three questions:

1. **Are you charging for the app as a whole, or for things inside it?** Whole app → **B**. Things inside → **C**.
2. **Do you want to keep 100 % on your own Stripe account, with no webhooks to host?** → **B**.
3. **Do you need subscriptions per item, trials per item, guest checkout, or revenue/subscriber dashboards?** → **C**.

`A` is not a way to charge your end users for your product; it is how an org
tops up its own credits.

## 3. What the platform must have before money flows

| Rail | Prerequisite | How to check |
|---|---|---|
| A | `show_paywall` on the org | `JSON.parse(localStorage.tenants).find(t => t.key === org).show_paywall` |
| B | A `stripe` integration credential on the org (restricted key: write on Products, Prices, Checkout Sessions, Customers; read on Subscriptions); backend that serves `…/providers/stripe/payments/paywall/access/` | `GET $PAY/products/?limit=1` → `200` connected, `400` no credential, `502` Stripe rejected the key, `404` old backend (`$PAY` defined in `/iblai-vibe-monetization-app-paywall` Step 1) |
| C | `enable_monetization` on the org; Connect Express onboarding complete (`is_ready_for_payments`) | `/iblai-vibe-monetization-onboard` |

Flags are set by an ibl.ai operator — there is no in-app toggle. If a flag is
off, none of that rail's UI renders even when the code is correct.

## 4. Reading money from your app

SDK hooks (verified in `@iblai/data-layer` 1.13.x): `useGetCreditTransactionsQuery`,
`useGetTenantSpendCapQuery`, `useGetAgentSpendCapQuery`, `useGetUserSpendCapQuery`,
`useGetSpendCapStatusQuery` (safe to show end users: zone + percent, never dollars),
`useDeleteTenantSpendCapMutation` / `…AgentSpendCap…` / `…UserSpendCap…`.
Components: `CreditBalance`, `BillingTab` (both `@iblai/iblai-js/web-containers`).

REST (server-side, `Authorization: Api-Token $IBLAI_API_KEY`):

| Need | Call | Reference |
|---|---|---|
| Org credit account | `GET /dm/api/billing/account/?platform_key={org}` | [iblai-api-billing](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/billing/iblai-api-billing/SKILL.md) |
| Transactions | `GET /dm/api/billing/transactions/?platform_key={org}` | same |
| Org cap | `PUT/GET/DELETE /dm/api/ai-mentor/orgs/{org}/spend-caps/tenant/` | [iblai-api-spend-caps](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/billing/iblai-api-spend-caps/SKILL.md) |
| A user's cap status (safe to show end users) | `GET /dm/api/ai-mentor/orgs/{org}/spend-caps/status/{user_id}/[?mentor=]` | same |
| Costs by provider / model / user | `GET /dm/api/analytics/financial/?platform_key={org}&metric=total_costs&date_filter=30d` | [iblai-api-analytics](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/analytics/iblai-api-analytics/SKILL.md) |

Details of every endpoint and error code for rails B and C:
[`references/rails.md`](references/rails.md).

## Related skills

- `/iblai-vibe-credit` — the navbar credit widget (rail A)
- `/iblai-vibe-billing` — org Billing page: plan, credits, spend limits, agent limits
- `/iblai-vibe-agent-billing` — one agent's cap and per-user caps
- `/iblai-vibe-monetization-app-paywall` — rail B end to end
- `/iblai-vibe-monetization` — rail C family index
- `/iblai-vibe-admin` — who may see billing (admins only)