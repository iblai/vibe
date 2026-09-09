# iblai-vibe-monetization-app-paywall

> Put a Stripe "pay to enter" gate on a whole app on the platform's OWN Stripe account via the DM Stripe proxy paywall endpoints — a pasted restricted key or Connect with Stripe (OAuth); no Stripe Connect Express, no commission, no webhooks. Admin setup (probe the Stripe source — never collect a key in chat — connect it, create the app-tagged product + prices, record the price), two server routes + lib/paywall.ts, the client PaywallGate, the /paywall pages, and the member self-service rail (embedded Checkout on the member's own token, no platform key in the app). Use when the user mentions charging for the whole app, pay to enter, app paywall, subscribe to use the app, gating the app behind payment, Connect with Stripe, or selling access with their own Stripe account. See /iblai-vibe-monetization for the item-level Connect family, /iblai-vibe-monetization-checkout for selling items in-platform, /iblai-vibe-ops-deploy for the server env, /iblai-vibe-auth for token wiring.

# /iblai-vibe-monetization-app-paywall

Gate a whole app behind a one-time or subscription payment on the **platform's
own Stripe account** — linked by a pasted restricted key, or by **Connect with
Stripe** (the admin signs in on Stripe; the DM stores only the account id and
drives it with ibl.ai's key plus a `Stripe-Account` header). The ibl.ai
platform (DM) owns entitlement end to end:
it mints the Stripe Checkout session, verifies the buyer's return
read-after-write, records payments durably, caches answers (grants 60s,
denies 15s — a `session_id` punches through a cached deny), checks
subscriptions live so cancellation bites within the cache window, and keeps
recorded payers in during a Stripe outage (`stale: true`) while failing
closed for unknown users. The app stays thin: two server routes, one client
gate, one pricing page — or no server routes at all on the member self-service
rail (below), where the browser pays on the member's own token. **No cookies,
no webhooks, no local payment ledger.**

How a visit flows: anonymous visitor → `AuthProvider` → hosted Auth SPA →
back logged in → `PaywallGate` (inside the `(app)` layout) asks
`GET /api/paywall/access` → denied → `/paywall` pricing page → buy → Stripe
Checkout → `/paywall/return?session_id=…` → access confirmed → app.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## This rail vs the Connect family

| | This skill (direct rail) | `/iblai-vibe-monetization-checkout` (Connect rail) |
|---|---|---|
| Sells | Entry to the **whole app** | Individual items (agents, courses…) in-platform |
| Stripe account | Platform's **own** account via the DM Stripe proxy: a pasted restricted key (`rk_…`), or a Standard account linked with **Connect with Stripe** (OAuth) | Stripe Connect Express, ibl.ai-managed |
| Commission | None | ibl.ai commission on each sale |
| Reconciliation | DM records + live checks, no webhooks | Webhook-reconciled subscriptions |
| Platform flag | None required | `enable_monetization` |

Selling items *inside* the app instead? Use the Connect family — start at
`/iblai-vibe-monetization`.

## Prerequisites

- `iblai.env` with `PLATFORM` + `TOKEN` (platform API key). `IBLAI_USERNAME`
  comes from the environment (the ibl.ai desktop app exports it) or from
  `iblai.env`; if neither has it, ask the user once and persist it (same
  Step 1 as `/iblai-vibe-ops-deploy`).
- A scaffolded vibe-starter app with working SSO auth.
- The platform has a **Stripe source**: an integration credential named
  `stripe` holding a restricted key, or an account linked with **Connect with
  Stripe** (Step 1 can drive that: the admin signs in on Stripe in their
  browser; nothing is typed or copied). A pasted key wins when both exist.
  The agent **never asks for or accepts a Stripe key in chat**.
- **Server mode**: `next.config.*` must NOT set `output: 'export'` — the
  paywall needs API routes.
- **Backend version**: probe
  `GET $PAY/paywall/access/?app=probe` (see Step 1 shorthand). A **404 means
  the platform backend predates the paywall endpoints** (needs ibl-dm-pro ≥
  PR #2977) — stop and tell the user; nothing app-side can work around it.
  `GET $CONNECT` 404 → the backend predates Connect with Stripe and the
  member rail (ibl-dm-pro ≥ 4.377.0); `available: false` there → its
  migration is not applied yet. A pasted key works on either.

## Step 1: Admin setup (once per app)

Full curls, error table, and verify list: [`references/setup-api.md`](references/setup-api.md).
Condensed sequence — read `iblai.env` with the `val()` reader (do not
`source` it), resolve `IBLAI_USERNAME` (env → `iblai.env` → ask once; both
exactly as in `/iblai-vibe-ops-deploy` Step 1), then with
`PAY="https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/payments"`,
`CONNECT="https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/connect/"`
and `AUTH="Authorization: Api-Token $TOKEN"`:

1. **Probe the platform's Stripe source**: `GET $CONNECT` →
   `{source, connected, available, publishable_key, stripe_account, …}`.
   - `source: "key"` or `"connected"` → continue (`key` wins when both exist).
   - `source: null` → nothing yet. Offer **Connect with Stripe** (confirm
     with the user first — it opens Stripe): `POST $CONNECT`
     `{"return_url":"<the app's URL, or http://localhost:3000/setup>"}` →
     open `authorize_url` in the browser; the admin signs in to Stripe (or
     creates an account there) and clicks Connect; Stripe returns through the
     platform to `return_url?stripe_connect=connected` (or
     `…=error&reason=<code>`); re-run `GET $CONNECT` until `connected`
     (plain — not `?refresh=1` in a loop, that read holds a worker on a
     Stripe call; use it once afterwards if the snapshot matters).
     Reconnect (another Stripe account, or the same one after the admin
     revoked the app on Stripe): `DELETE $CONNECT` (confirm first; a `502`
     means Stripe could not confirm it and the link is kept — retry), then
     the same `POST` round trip, then re-record the price (item 5) on the
     new account. The other way stays: a platform admin adds an integration
     credential named `stripe` in the platform credentials UI, holding a
     **restricted** key: Stripe Dashboard → Developers → API keys → Create
     restricted key — write on Products, Prices, Checkout Sessions,
     Customers; read on Subscriptions; everything else None. In the platform
     UI, **not in this chat** — never ask for or accept the key here.
   - `502` from any proxy call → Stripe rejected the source (wrong-mode key,
     or the account was disconnected on Stripe's side).
   - `404` → old backend (then `GET $PAY/products/?limit=1` still tells a
     pasted-key setup apart: 200 ready, 400 no credential) or
     `$IBLAI_USERNAME` not a member.
2. **Create the product**, tagged for this app:
   `POST $PAY/products/` `{"name":"<App> access","metadata":{"app":"<slug>"}}`.
   The `metadata.app` tag is what the DM enforces at checkout — it must
   equal `PAYWALL_APP_SLUG` exactly. Use the deploy project slug
   (lowercased package name) as the value.
3. **Create price(s)**: `POST $PAY/prices/`
   `{"product":"prod_…","unit_amount":2900,"currency":"usd"}` — add
   `"recurring":{"interval":"month"}` for a subscription. Checkout mode
   follows the price type automatically.
4. **Capture display data**: `GET $PAY/prices/<id>/` → amount/currency/
   interval → fill the `PRICES` constant in `app/paywall/page.tsx`.
5. **Record the price on the platform** (one price per app):
   `PUT https://api.$DOMAIN/dm/api/core/orgs/$PLATFORM/metadata/`
   `{"metadata":{"apps":{"<slug>":{"stripe":{"product_id":"prod_…","price_id":"price_…","publishable_key":"<from GET $CONNECT>","stripe_account":"<acct_… or null>"}}}}}`
   — a deep merge, other keys survive; it is a public read, never put a
   secret there. The recorded price is the contract: **a caller buying on
   their own path** (a member on the self-service rail, or the platform
   key's owner testing their own app) **must have one and can buy only it**,
   and once recorded it binds every checkout. An app selling **several**
   prices through the server rail leaves this out — then test the paywall
   with a member account, not as the key's owner.
6. **Write env** — append to `.env.local`:

   ```bash
   PAYWALL_PRICE_IDS=price_xxx,price_yyy   # server-only allowlist, comma-separated
   PAYWALL_APP_SLUG=my-app                 # must equal the product's metadata.app
   ```

## Step 2: Install the app files

Ready-made, typecheck- and unit-test-gated copies ship as ops-init assets —
install them with one copy (from wherever the skills are staged; same
resolution as vibe-starter itself):

```bash
cp -a <skills-dir>/iblai-vibe-ops-init/assets/stripe-components/. .
```

If the staged skills carry no `assets/` (some installers strip them), fall
back to the complete drop-in bodies in
[`references/app-files.md`](references/app-files.md) — identical content.
Either way, only `PRICES` in `app/paywall/page.tsx` and the two env lines are
per-app; the copy also brings `__tests__/paywall*.test.ts`, which run under
the app's existing `pnpm test`.

| File | Role | ~Lines |
|---|---|---|
| `lib/paywall.ts` | Server-only helpers: `resolveUser` (identity from the forwarded `dm_token`), `userFromRequest`, `dmPaywallFetch` (Api-Token calls to the DM) | 75 |
| `app/api/paywall/access/route.ts` | GET → resolve user → forward optional `session_id` → DM's answer verbatim | 22 |
| `app/api/paywall/checkout/route.ts` | POST → resolve user → allowlisted `price_id` → DM mints the Checkout session | 32 |
| `components/paywall-gate.tsx` | Client gate + shared `checkPaywallAccess()`; denied → `/paywall` | 55 |
| `app/paywall/page.tsx` + `app/paywall/paywall-actions.tsx` | Pricing page (outside `(app)`, login-first via the existing providers) + buy/auto-verify/restore actions | 105 |
| `app/paywall/return/page.tsx` | Confirms the purchase by `session_id`, then into the app | 38 |
| `app/(app)/layout.tsx` | 3-line edit: wrap `{children}` in `<PaywallGate>` | — |

**Trust rules (non-negotiable):**

- User identity comes ONLY from `resolveUser` on the server — never accept a
  client-sent username.
- `price_id` must pass the `PAYWALL_PRICE_IDS` allowlist.
- `IBLAI_API_KEY` and `PAYWALL_*` are server-only — never `NEXT_PUBLIC_*`,
  never imported into client components.
- Surface DM 400 bodies verbatim — they are actionable (missing credential,
  wrong app tag, disallowed redirect host).

## The member self-service rail (no platform key in the app)

`paywall/checkout/` and `paywall/access/` also serve the **path user
themselves**: the browser calls them on the member's own username path with
the member's own DM token (`Authorization: Token <dm_token>`, the SDK's
`dm_token`), so the app holds no platform key at all — this is how ibl.ai's
`vibe-agent` reference app pays in its modal. RBAC:
`Ibl.Mentor/StripePaywallSelf/action`, a Students-role verb (platforms seeded
before it need `seed_rbac_data`); RBAC off: any signed-in member on their own
path. Other users' paths and the payments ledger keep the admin verbs.

```http
POST {dm_url}/api/ai-mentor/orgs/<org>/users/<me>/providers/stripe/payments/paywall/checkout/
Authorization: Token <the member's dm_token>
{"app": "<slug>", "price_id": "price_…", "ui_mode": "embedded", "payment_method_types": ["card"]}
→ {"client_secret": "cs_…", "session_id": "cs_…", "publishable_key": "pk_…", "stripe_account": "acct_…" | null}
```

Render it with Stripe.js: `loadStripe(publishable_key, stripe_account ?
{ stripeAccount: stripe_account } : undefined)`, then
`createEmbeddedCheckoutPage({ fetchClientSecret: async () => client_secret,
onComplete })`; Stripe never redirects (`redirect_on_completion: never`). In
`onComplete`, poll
`GET …/users/<me>/providers/stripe/payments/paywall/access/?app=<slug>&session_id=<session_id>`
with the same token until `has_access` is true (a `session_id` punches
through a cached deny). Rules: the recorded price (Step 1, item 5) is required —
400 `no price recorded` without it — and only it can be bought; `ui_mode`
omitted is hosted checkout on this rail too (`success_url`/`cancel_url`,
`checkout_url`). The admin's own DM token works the same way on the admin's
own path for Step 1 (`GET`/`POST $CONNECT`, products, prices, the metadata
PUT), so a setup screen inside the app needs no platform key either.

## Step 3: Deploy

Server mode is required (no `output: 'export'`). `/iblai-vibe-ops-deploy`
regenerates `.env.production` from `.env.local` on every deploy and its copy
list includes `PAYWALL_*`; before uploading, confirm
`grep PAYWALL_ .env.production` shows both lines. The DM validates
`success_url`/`cancel_url` against the platform's own deployed apps
(`*.vercel.app` hosts), its custom domains, and localhost — a checkout 400
naming the host means the app isn't deployed under this platform yet:
deploy first, or attach the domain.

## Step 4: Verify

- [ ] Anon visit `/` → Auth SPA → back logged in → landed on `/paywall`
      (never a blank app)
- [ ] `/paywall` shows the price card(s) with real name/amount/interval;
      buy → `checkout.stripe.com`
- [ ] Test card `4242 4242 4242 4242` → `/paywall/return?session_id=…` →
      "Confirming…" → app home (the `session_id` punches through any cached
      deny)
- [ ] Clear `sessionStorage` → reload `/` → brief loader → still in the app
      (DM re-verifies)
- [ ] Entitled user opening `/paywall` directly is bounced back to `/`
- [ ] A second (unpaid) platform user is stuck on `/paywall`; "Restore
      access" reports no payment found
- [ ] `GET $PAY/paywall/payments/?app=<slug>` lists the test payment
- [ ] `GET $CONNECT` shows the `source` in use and, when connected,
      `charges_enabled: true` (`?refresh=1` for a live read; the snapshot is
      otherwise refreshed at most once a minute)
- [ ] Subscription price only: cancel in the Stripe dashboard → clear
      `sessionStorage` → access lapses within ~75s (DM cache) + up to 60s of
      client grant cache
- [ ] Deployed: `.env.production` in the zip carries both `PAYWALL_*` lines;
      SSO lands on the deployed app's `/sso-login-complete` and `axd_token`
      appears in localStorage

## Deliberately not built

- **Webhooks** — the DM records at the buyer's return and re-checks live;
  there is nothing to receive.
- **Self-serve cancel UI** — the admin cancels in their Stripe dashboard;
  access lapses within the cache window.
- **Refund auto-revoke** — a recorded one-time payment is permanent
  entitlement by DM design (Stripe never flips a completed session).
- **Guest checkout** — the app is login-first; `/paywall` sits behind
  `AuthProvider`, so every buyer has an account. Anonymous buying belongs to
  the Connect rail.

## Common mistakes

- Putting `/paywall` inside `(app)` — the gate would loop. It must live
  OUTSIDE the gated group but inside the root providers.
- Adding `^/paywall` to `PUBLIC_ROUTES` — checkout needs a logged-in
  platform member; login-first is the design.
- Calling the DM paywall endpoints from the browser **with the Api-Token** —
  it is org-wide authority; only the app's server routes hold it. The browser
  rail is the member's own `Token` on the member's own path (above).
- Testing the paywall as the platform key's owner with no recorded price —
  a caller on their own path must buy the recorded price (400
  `no price recorded`): record it (Step 1, item 5) or test with a member account.
- Asking for a Stripe key when `GET $CONNECT` says `source: null` — offer
  Connect with Stripe first; the key path is the admin's, in the platform UI.
- Mixing auth schemes: DM paywall/proxy calls take
  `Api-Token <platform key>`; `core/token/verify/` identity resolution
  takes the end user's `Token <dm_token>`.
- Forgetting `PAYWALL_*` in `.env.production` — works locally, then every
  deployed user gets 500s from the paywall routes.
- Hardcoding a URL into `success_url` instead of using the request origin —
  breaks the moment the app moves hosts.
- Treating the `sessionStorage` grant cache as security — it only prevents a
  loading flash; the DM is the authority.
- Expecting instant lockout after a subscription cancel — the window is the
  DM cache (≤ ~75s) plus up to 60s of client grant cache.

## Related skills

- [`/iblai-vibe-monetization`](../iblai-vibe-monetization/SKILL.md) — family index; item-level Connect rail overview
- [`/iblai-vibe-monetization-checkout`](../iblai-vibe-monetization-checkout/SKILL.md) — sell individual items in-platform (Connect)
- [`/iblai-vibe-monetization-onboard`](../iblai-vibe-monetization-onboard/SKILL.md) — Stripe Connect **Express** onboarding (item rail only; not the Connect with Stripe link above)
- [`/iblai-vibe-ops-deploy`](../iblai-vibe-ops-deploy/SKILL.md) — ships the app + `.env.production` via ibl.ai hosting
- [`/iblai-vibe-ops-test`](../iblai-vibe-ops-test/SKILL.md) — validate before showing work
- [`/iblai-vibe-auth`](../iblai-vibe-auth/SKILL.md) — SSO token wiring the gate depends on
- [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) — visual language for the pricing page