# iblai-vibe-monetization-app-paywall

> Put a Stripe "pay to enter" gate on a whole app on the organization's OWN Stripe account — Connect with Stripe (OAuth) or a pasted restricted key — through the DM paywall endpoints; no Stripe Connect Express, no commission, no webhooks, no platform key in the app. Installs /paywall/setup, where the admin answers free / one-time / monthly (USD) and connects Stripe (the agent never touches Stripe or a key), the PaywallGate, the /paywall page with Stripe's embedded checkout in a modal, and two admin routes that forward the admin's own token. Use when the user mentions charging for the whole app, pay to enter, app paywall, subscribe to use the app, gating the app behind payment, Connect with Stripe, paywall setup, or selling access with their own Stripe account. See /iblai-vibe-monetization for the item-level Connect family, /iblai-vibe-monetization-checkout for selling items in-platform, /iblai-vibe-ops-deploy for the server env, /iblai-vibe-auth for token wiring.

# /iblai-vibe-monetization-app-paywall

Gate a whole app behind a one-time or monthly payment on the **organization's own Stripe
account** — linked with **Connect with Stripe** (the admin signs in on Stripe; the platform
stores only the account id and drives it with ibl.ai's key plus a `Stripe-Account` header) or
by a pasted restricted key. The admin answers one question **in the app**, at
`/paywall/setup` — free, a one-time fee or a monthly fee, in USD — and connects Stripe there;
**the agent never touches Stripe**. The ibl.ai platform (DM) owns entitlement end to end: it
mints every Checkout Session, verifies the buyer's session read-after-write, records payments
durably, caches answers (grants 60 s, denies 15 s — a `session_id` punches through a cached
deny), checks subscriptions live, and keeps recorded payers in during a Stripe outage. The app
holds **no platform key** for any of it: members pay on their own session token, and the two
admin routes forward the admin's own. **No cookies, no webhooks, no local payment ledger.** It
is the model of ibl.ai's `vibe-agent` reference app, gated at the door instead of at the first
message.

How a visit flows, after `AuthProvider` has signed the visitor in:

- **An organization admin** goes straight in. While the paywall question is unanswered,
  `PaywallGate` takes them to `/paywall/setup` — once per session, from whatever page they opened.
- **A member** goes in without a Stripe call while nothing is for sale (free, or not answered
  yet). Otherwise the platform's verdict lets them in, or sends them to `/paywall` →
  **Continue to payment** → Stripe's form in a modal → paid → the app.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## This rail vs the Connect family

| | This skill (direct rail) | `/iblai-vibe-monetization-checkout` (Connect rail) |
|---|---|---|
| Sells | Entry to the **whole app** | Individual items (agents, courses…) in-platform |
| Stripe account | Organization's **own**: a Standard account linked with **Connect with Stripe** (OAuth), or a pasted restricted key (`rk_…`) | Stripe Connect Express, ibl.ai-managed |
| Commission | None | ibl.ai commission on each sale |
| Reconciliation | DM records + live checks, no webhooks | Webhook-reconciled subscriptions |
| Platform flag | None required | `enable_monetization` |

Selling items *inside* the app instead? Use the Connect family — start at
`/iblai-vibe-monetization`.

## Prerequisites

- A scaffolded vibe-starter app with working SSO auth, in **server mode**: `next.config.*`
  must NOT set `output: 'export'` — the two admin routes are route handlers.
- `iblai.env` with `PLATFORM` + `TOKEN`, for the probes below and — on an upgrade — reading the
  old setup. `IBLAI_USERNAME` comes from the environment (the ibl.ai desktop app exports it)
  or from `iblai.env`; if neither has it, ask the user once and persist it (same Step 1 as
  `/iblai-vibe-ops-deploy`).
- **Members' own checkout** needs the Students role's `Ibl.Mentor/StripePaywallSelf/action`:
  organizations seeded before it existed need an ibl.ai operator to run `seed_rbac_data`, or
  every member meets the platform's 403 at the gate.
- The agent **never asks for or accepts a Stripe key in chat**, and never creates Stripe
  products or prices: the admin's setup page does it.

## Step 1: Install (once per app)

Read `iblai.env` with the `val()` reader (do not `source` it) and resolve `IBLAI_USERNAME`
(env → `iblai.env` → ask once; both exactly as in `/iblai-vibe-ops-deploy` Step 1), then:

```bash
DM="https://api.$DOMAIN/dm"; AUTH="Authorization: Api-Token $TOKEN"
PAY="$DM/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/payments"
CONNECT="$DM/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/connect/"
META="$DM/api/core/orgs/$PLATFORM/metadata/"
```

1. **Probe the backend.** `GET $PAY/paywall/access/?app=probe` → a **404** means the platform
   predates the paywall endpoints (ibl-dm-pro PR #2977); `GET $CONNECT` → a **404** means it
   predates Connect with Stripe and the member rail (ibl-dm-pro 4.377.0). Either way stop and
   tell the user — nothing app-side can work around it. `available: false` on `$CONNECT` means
   a new connect cannot start yet (an operator issue); a pasted key still works.
2. **Upgrading from the previous release** (the app has `app/api/paywall/checkout/`, or
   `PAYWALL_PRICE_IDS` in `.env.local`)? Do [Upgrading](#upgrading-from-the-previous-release)
   first.
3. **Copy the files** — ready-made, typecheck- and unit-test-gated copies ship as ops-init
   assets (same resolution as vibe-starter itself):

   ```bash
   cp -a <skills-dir>/iblai-vibe-ops-init/assets/stripe-components/. .
   ```

   If the staged skills carry no `assets/` (some installers strip them), fall back to the
   drop-in bodies in [`references/app-files.md`](references/app-files.md) — identical content.
4. **Pin the slug** — append to `.env.local`:

   ```bash
   NEXT_PUBLIC_PAYWALL_APP_SLUG=my-app   # the lowercased package name: letters, digits, - or _, ≤ 64
   ```

   It keys the choice under `apps.<slug>` in the organization's metadata, tags the Stripe
   product (`metadata.app`), and names the app on every checkout — and the platform records
   payments under it. **Never change it afterwards**: a new value strands everyone who paid.
   It has no default on purpose: two apps on one organization must never share one.
5. **Make the three edits** ([`references/app-files.md`](references/app-files.md) shows each
   in full):
   - `app/(app)/layout.tsx` — wrap `{children}` in `<PaywallGate>` (from
     `@/components/paywall-gate`).
   - `middleware.ts` (or `proxy.ts`) — let Stripe's embedded checkout load. The SDK's default
     policy allows `js.stripe.com` but not `checkout.stripe.com`, so without this the form
     never renders on a production build:

     ```ts
     return applyCsp(request, {
       requestHeaders,
       mode: process.env.NODE_ENV === 'development' ? 'report-only' : undefined,
       // Stripe's embedded checkout (the paywall's pay modal).
       scriptSrc: ['https://checkout.stripe.com'],
       connectSrc: ['https://checkout.stripe.com'],
       frameSrc: ['https://checkout.stripe.com'],
       imgSrc: ['https://*.stripe.com'],
     });
     ```

   - `app/(app)/account/page.tsx` — the quiet **Payments setup** link for admins, the way
     back to the question: nothing new in the navbar.
6. `pnpm typecheck && pnpm test` — the copy brings `__tests__/paywall*.test.ts`.

| File | Role | ~Lines |
|---|---|---|
| `lib/paywall-client.ts` | Browser rail on the member's own token: the catalogue from public metadata, embedded checkout, access check, the setup check, the admin's texts | 361 |
| `lib/paywall.ts` | Server helpers for the admin routes: identity from the admin's own token, the Stripe proxy and Connect calls on their own path, the metadata record | 217 |
| `app/api/paywall/admin/setup/route.ts` | The whole setup in one call: source check → retire the old price → product (tagged) → price → record; free records only | 156 |
| `app/api/paywall/admin/connect/route.ts` | Connect with Stripe relay: GET / POST / DELETE, statuses verbatim | 44 |
| `components/paywall-gate.tsx` | The gate around `(app)`: admins in (and to setup while unanswered), members by the platform's verdict | 71 |
| `components/paywall-setup.tsx` | The setup screen: the question, then Connect with Stripe; reconnect, disconnect | 427 |
| `components/pay-modal.tsx` | Stripe's embedded checkout in a modal, then the platform's confirmation | 169 |
| `app/paywall/page.tsx` | Where unpaid members land: the price, Continue to payment, Restore access | 105 |
| `app/paywall/setup/page.tsx`, `app/paywall/setup/connect/page.tsx` | The two setup steps, outside `(app)`; Stripe returns to the second | 23 |

**Trust rules (non-negotiable):**

- Identity comes ONLY from the platform: the admin routes verify the caller's own token with
  `core/token/verify/` — never a client-sent username — and the platform enforces the admin
  role on every call they forward.
- No platform key and no Stripe secret in the app: never add `IBLAI_API_KEY` or a `sk_`/`rk_`
  key to the paywall. Only ids, amounts and the publishable key go into the organization's
  metadata — a public read.
- Surface the platform's 4xx bodies verbatim — they are actionable.

### Upgrading from the previous release

The previous paywall sold through two Api-Token server routes, with the agent creating the
Stripe objects and a `PRICES` constant on the page. In order:

1. **Read the old setup**: `PAYWALL_APP_SLUG` from `.env.local`, `GET $META`
   (`apps.<slug>.stripe`) and `GET $CONNECT` (`source`, `publishable_key`).
2. **Stop** if `source` is `"key"` and `publishable_key` is empty — apps that ran with
   `PAYWALL_EMBEDDED=0`. Checkout is embedded only now, so every buyer would be refused: have
   the admin add the account's publishable key (`pk_…`, a public value) to the organization's
   `stripe` credential on ibl.ai first.
3. **Remove what the new files replace** — `cp -a` keeps old files, and these no longer compile:

   ```bash
   rm -rf app/api/paywall/checkout app/api/paywall/access app/paywall/return \
     app/paywall/paywall-actions.tsx components/paywall-connect.tsx \
     components/paywall-embedded.tsx lib/paywall-connect.ts __tests__/paywall-connect.test.ts
   ```

4. **Copy** (Step 1, item 3), then set `NEXT_PUBLIC_PAYWALL_APP_SLUG` to the **old**
   `PAYWALL_APP_SLUG` — members who paid are recorded under it — and delete the
   `PAYWALL_PRICE_IDS`, `PAYWALL_APP_SLUG` and `PAYWALL_EMBEDDED` lines. `IBLAI_API_KEY` stays:
   other starter routes use it.
5. **The edits** (Step 1, item 5); the layout one is already there.
6. An app that sold **several** prices recorded none, and the admin's first save records one
   that binds every checkout, the old deployment's included — so have the admin answer
   `/paywall/setup` right before deploying the upgrade.

Existing payers keep their access as long as the slug is unchanged: the platform grants per
member and app, not per price. A record the old skill wrote (`stripe` with no `access`) keeps
selling its price until the admin answers, and the gate sends them to answer.

## Step 2: Hand over the setup page

Send the admin to **`<app URL>/paywall/setup`** — locally `http://localhost:3000/paywall/setup`,
on the port `pnpm dev` printed — not to the app's root; when you open the local preview, open
that page. (The root works too: the gate sends an admin whose question is unanswered there.
Name the page anyway.) There they:

- choose **Free access**, a **One-time fee** or a **Monthly fee**, with the USD price;
- for a paid answer while the organization has no Stripe source, press **Connect with
  Stripe** — sign in on Stripe (or create an account there), consent, and they are back on
  `/paywall/setup/connect`, where the answer saves itself.

Nothing is typed or copied, and nothing about Stripe goes through you. Say once that the
quiet **Payments setup** link on `/account` reopens it: a later "change the price" or "make it
free" is that page again, not you. The page refuses a paid plan while the Stripe source has
no publishable key, naming the fix — and on a connected account says when Stripe has not
enabled payments yet. Its reference — every call, the error reasons, and curl equivalents for
scripted setup or debugging — is [`references/setup-api.md`](references/setup-api.md).

## Step 3: Deploy

Server mode is required (no `output: 'export'`). `/iblai-vibe-ops-deploy` regenerates
`.env.production` from `.env.local` and copies every `NEXT_PUBLIC_*` key; before uploading,
confirm `grep NEXT_PUBLIC_PAYWALL_APP_SLUG .env.production`. The CSP edit (Step 1, item 5) is
what lets Stripe's form render once deployed: `pnpm dev` only reports policy violations, a
production build enforces them. Connect with Stripe's `return_url` is validated against the
organization's own deployed apps (`*.vercel.app` hosts), its custom domains, and localhost — a
400 naming the host at **Connect with Stripe** means the app isn't deployed under this
organization yet: deploy first, or attach the domain.

## Step 4: Verify

- [ ] As an admin with the question unanswered, opening `/` lands on `/paywall/setup`
- [ ] Monthly $29 with no Stripe source → **Continue** → **Connect with Stripe** → Stripe →
      back on `/paywall/setup/connect` → saved → the app
- [ ] `GET $META` shows `apps.<slug>` with `access`, `amount`, `stripe.price_id` and
      `stripe.publishable_key`
- [ ] With a **member** account (admins never pay): `/` → `/paywall` with the price →
      **Continue to payment** → Stripe's form in the modal → test card `4242 4242 4242 4242`
      → the app
- [ ] The same on a production build (`pnpm build && pnpm start`) or the deployed host — the
      only place the CSP is enforced
- [ ] A second unpaid member is held on `/paywall`; **Restore access** reports no payment found
- [ ] `GET $PAY/paywall/payments/?app=<slug>` lists the test payment
- [ ] Free: members go straight in, and no Stripe call is made
- [ ] Subscription only: cancel in the Stripe dashboard → access lapses within ~75 s (platform
      cache) plus up to 60 s held in the page

## Deliberately not built

- **Webhooks** — the platform records at the buyer's return and re-checks live; there is
  nothing to receive.
- **Several prices per app** — one question, one recorded price, and members can buy only that.
- **Hosted (redirect) checkout** — the modal is the only checkout; the setup refuses a paid
  plan on a source with no publishable key, so a buy cannot fail on it.
- **Self-serve cancel UI** — the admin cancels in their Stripe dashboard; access lapses within
  the cache window.
- **Refund auto-revoke** — a recorded one-time payment is permanent entitlement by design.
- **Guest checkout** — the app is login-first; anonymous buying belongs to the Connect rail.
- **Opening self-join and putting the price on the sign-in page** — `vibe-agent` does both;
  they are organization-wide settings, and a starter app's organization may serve other apps.

## Common mistakes

- Putting `/paywall` or `/paywall/setup` inside `(app)` — the gate would loop, or bounce the
  admin who came to set it up. Both live outside it, inside the root providers.
- Adding `^/paywall` to `PUBLIC_ROUTES` — checkout needs a signed-in member; login-first is the
  design.
- Skipping the CSP edit because it works under `pnpm dev` — dev only reports; once deployed,
  nobody can pay.
- Changing `NEXT_PUBLIC_PAYWALL_APP_SLUG` after a sale, or giving two apps on one organization
  the same one — payments are recorded under the slug.
- Testing the purchase as an admin — admins go straight in; use a member account.
- Disconnecting Stripe while a paid plan is recorded — the platform checks every member's access
  on the Stripe source, so members who paid are locked out too until an account is linked again.
  To stop charging, choose **Free access** (the page asks before unlinking).
- A member's 403 at the gate — the organization predates the member rail's permission
  (`seed_rbac_data`), or the browser's `app_tenant` names another organization than
  `NEXT_PUBLIC_MAIN_TENANT_KEY`: the platform refuses a token for one organization on another's
  path.
- `?stripe_connect=error&reason=invalid_grant` — Stripe refused the one-time code at the
  platform's exchange. Nothing the app sends reaches that exchange: a code spent twice, or —
  when it repeats — the ibl.ai instance's Connect credentials mixing test and live mode, which
  ibl.ai support fixes. A pasted restricted key plus its publishable key is the way round.
- Creating products and prices with curls, or collecting a Stripe key — the setup page does it;
  the curls in `references/setup-api.md` are for CI and debugging only.
- Expecting instant lockout after a subscription cancel — the window is the platform's cache
  (≤ ~75 s) plus up to 60 s held in the page.

## Related skills

- [`/iblai-vibe-monetization`](../../billing/iblai-vibe-monetization/SKILL.md) — family index; item-level Connect rail overview
- [`/iblai-vibe-monetization-checkout`](../../billing/iblai-vibe-monetization-checkout/SKILL.md) — sell individual items in-platform (Connect)
- [`/iblai-vibe-monetization-onboard`](../../billing/iblai-vibe-monetization-onboard/SKILL.md) — Stripe Connect **Express** onboarding (item rail only; not the Connect with Stripe link above)
- [`/iblai-vibe-ops-deploy`](../../ship/iblai-vibe-ops-deploy/SKILL.md) — ships the app + `.env.production` via ibl.ai hosting
- [`/iblai-vibe-ops-test`](../../ship/iblai-vibe-ops-test/SKILL.md) — validate before showing work
- [`/iblai-vibe-auth`](../../start/iblai-vibe-auth/SKILL.md) — SSO token wiring the gate depends on
- [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) — visual language for the pricing page