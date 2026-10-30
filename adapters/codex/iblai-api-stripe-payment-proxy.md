# iblai-api-stripe-payment-proxy

> Drive an ibl.ai organization's own Stripe account through the platform's Stripe payment proxy — customers, products, prices, payment links and checkout sessions forwarded to Stripe verbatim with the organization's key held server-side; gate a deployed app behind a one-time or subscription payment (paywall checkout, access check, payments ledger); link or unlink the account with Connect with Stripe. Use when an app's server, a script or an agent must sell on the organization's own Stripe account without ever handling a Stripe key. For platform credits, spend caps and per-item sales on Stripe Connect Express see /iblai-api-billing and /iblai-api-spend-caps; the visual twin is /iblai-vibe-monetization-app-paywall.

# iblai-api-stripe-payment-proxy

> **Two rails to Stripe.** This surface drives the **organization's own Stripe account**
> — direct charges, no commission — so that a deployed app's server, a script or an agent
> never holds a Stripe key. `/iblai-api-billing` documents the other rail: platform
> credits and per-item paywalls sold through Stripe Connect **Express**, a different
> service with its own endpoints. Selling access to a whole app is this skill; selling
> agents, courses or custom items is that one. The visual twin of this skill is
> `/iblai-vibe-monetization-app-paywall`.

The Data Manager forwards typed calls to Stripe with the organization's credential and
returns **Stripe's own response body**, so Stripe's API reference describes the payload
shapes; what this skill adds is the ibl.ai envelope — auth, who may call, which Stripe
account answers — and the two features layered on top of the proxy:

- **Proxy** — customers (with search), products, prices, payment links and checkout
  sessions: list, create, retrieve, update; expire a checkout session.
- **Paywall** — start a checkout that buys a user access to an app, ask whether a user
  has paid, list who paid. The records live on the platform, so a paid user keeps access
  while Stripe is down.
- **Connect with Stripe** — link the organization's Stripe account by OAuth (no key
  typed anywhere), read its status, unlink it.

Nothing here spends platform credits; every call runs on the organization's account.

## The schema is the contract

These endpoints live on the Data Manager and its live OpenAPI schema is the source of
truth — the paths and fields below are verified against it but can drift between
releases. Check before building:

- **Schema (raw):** `https://api.iblai.app/dm/api/docs/schema/`
- **Swagger UI:** `https://api.iblai.app/dm/api/docs/`

```bash
curl -sS "https://api.iblai.app/dm/api/docs/schema/" -o /tmp/iblai_schema.yaml
grep -nE "providers/stripe" /tmp/iblai_schema.yaml
```

For the objects inside a proxy response — a customer, a price, a checkout session —
Stripe's documentation is the reference; the platform passes them through unchanged.

## Auth & conventions

- **Base:** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/`
  — Data Manager endpoints behind the gateway's `/dm` prefix; `payments/…` is the proxy
  and the paywall, `connect/` is Connect with Stripe. The schema publishes this family
  under `ai-mentor` only.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request (a Platform API
  Token). A signed-in user's session token, `Authorization: Token <dm_token>`, works on
  the same routes — that is how a member pays from a browser (see Access).
- **`{org}`** = `$IBLAI_ORG`, the organization **key**. It must be the organization the
  token belongs to: any other value, an unknown one included, is refused with one and
  the same `403` whose body names the organization — so that answer is an identifier
  problem, not a permissions one.
- **`{username}`** (`user_id` on the wire) is the user the call is **attributed to** — on
  the paywall calls, the user whose access is being bought or checked. It must be a
  member of the organization (`404` otherwise). It grants nothing by itself: naming your
  own username does not lower the bar. Use `$IBLAI_USERNAME` for proxy calls.
- **Which Stripe account answers**, decided on every call: **(1)** the organization's
  pasted `stripe` integration credential — value `{"key": "rk_…", "publishable_key":
  "pk_…"}`, added with `/iblai-api-integration`; a **restricted** key with write on
  Customers, Products, Prices, Payment Links and Checkout Sessions and read on
  Subscriptions is enough — wins whenever it is set; **(2)** otherwise the account
  linked with Connect with Stripe; **(3)** otherwise a `400` whose body names both
  options. There is no fallback to any shared or platform-owned account, ever.
- **Verbatim contract.** Request bodies and query strings are forwarded to Stripe beyond
  a small typed floor (the required fields named below); anything else you send passes
  through untouched, and Stripe's own `400` comes back when it objects. Responses are
  Stripe's body byte for byte — lists arrive as `{"object": "list", "data": [...],
  "has_more": …}`. Only the paywall and Connect endpoints answer in the platform's own
  shape.
- **Updates are `POST`** to the object's URL — Stripe's convention — never `PUT` or
  `PATCH`. **There is no delete:** archive products, prices and payment links with
  `{"active": false}`; customers and checkout sessions cannot be removed through this
  surface (expire an open session with `…/expire/`).
- **Lists** take `limit` (1–100), `starting_after`, `ending_before` and any Stripe filter
  for that object (`active`, `customer`, `email`, `product`, …). A repeated query key
  keeps only its **last** value, so one `expand[]=…` per `GET`; for several expansions
  put `expand` in a `POST` body instead.
- **`Idempotency-Key`** — send it on every create and update; the platform forwards it to
  Stripe verbatim and never retries on its own. A `502` on a write is **indeterminate**
  (Stripe may have applied it): retry only with the same key.
- Run `/iblai-api-login` first to populate `$IBLAI_ORG`, `$IBLAI_USERNAME` and
  `$IBLAI_API_KEY`.
- **Confirm with the user first** before anything that mints something payable or
  changes what customers can buy: creating a payment link or a checkout session, starting
  a paywall checkout, archiving a product or price, and linking or unlinking the Stripe
  account.

## Access

This is an **administrator surface**: the verbs below are held by organization admins
and by custom roles granted them; members do **not** get them by default. The single
exception is the member rail — `paywall/checkout/` and `paywall/access/` on the caller's
**own** `{username}` path, held by the default member role so an app can let a
signed-in user pay with their own session token and no Platform API Token in the
browser. On another user's path, and on the ledger, the admin verbs apply again.

| Verb | Resource | Covers |
|---|---|---|
| `Ibl.Mentor/Stripe/list` | `/platforms/{id}/stripe-payments/` | every collection `GET` and `customers/search/` |
| `Ibl.Mentor/Stripe/read` | `/platforms/{id}/stripe-payments/` | every single-object `GET` |
| `Ibl.Mentor/Stripe/write` | `/platforms/{id}/stripe-payments/` | every single-object `POST` (update) |
| `Ibl.Mentor/Stripe/action` | `/platforms/{id}/stripe-payments/` | every collection `POST` (create) and `…/expire/` |
| `Ibl.Mentor/StripePaywall/action` | `/platforms/{id}/stripe-paywall/` | `paywall/checkout/` for any member |
| `Ibl.Mentor/StripePaywall/read` | `/platforms/{id}/stripe-paywall/` | `paywall/access/` for any member |
| `Ibl.Mentor/StripePaywall/list` | `/platforms/{id}/stripe-paywall/` | `paywall/payments/` |
| `Ibl.Mentor/StripePaywallSelf/action` | `/platforms/{id}/stripe-paywall-self/` | `paywall/checkout/` and `paywall/access/` on the caller's own path — the member verb |
| `Ibl.Mentor/StripeConnect/read` | `/platforms/{id}/stripe-connect/` | `GET connect/` |
| `Ibl.Mentor/StripeConnect/action` | `/platforms/{id}/stripe-connect/` | `POST` and `DELETE connect/` |

Connect is deliberately its own family: a role granted the payments verbs cannot re-point
where the organization's money lands. With RBAC off, every call except the member rail
needs an organization admin.

**Platform API Tokens.** A token in the default `owner` mode acts with its creator's
authority for its organization — an admin's token passes everything above, on any
member's path. A token in `token_policies` mode is **refused (`403`) on this whole
surface**, whatever policies it carries; mint an owner-mode token (`/iblai-api-token`).
A `403` with `Permission denied` is a missing verb; a `403` that names the organization
is the `{org}` binding above.

## Reads

### Customers

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/customers/` — list customers (`limit`, `starting_after`, `ending_before`, `email`, …).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/customers/search/?query=` — search with Stripe's query language, e.g. `query=email:'jane@example.com'` or `query=metadata['ibl_username']:'jane'`; `limit` (1–100) and `page` (the cursor from `next_page`) are optional. Stripe's search index lags new objects by up to about a minute.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/customers/{customer_id}/` — one customer.

### Products

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/products/` — list products (`active=true` skips archived ones).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/products/{product_id}/` — one product.

### Prices

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/prices/` — list prices (`product=prod_…`, `active=true`, …).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/prices/{price_id}/` — one price; `?expand[]=product` embeds its product.

### Payment links

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/payment-links/` — list payment links.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/payment-links/{payment_link_id}/` — one payment link; `url` is the page you hand out.

### Checkout sessions

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/checkout-sessions/` — list sessions (`customer=cus_…`, `status=complete`, …).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/checkout-sessions/{session_id}/` — one session: `status` (`open` | `complete` | `expired`), `payment_status`, `mode`, `customer`, `amount_total`; `?expand[]=subscription` embeds the subscription of a subscription-mode session.

### Paywall

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/paywall/access/?app=<slug>` — has `{username}` paid for `app`? Answers `{"has_access": bool, "mode": "payment" | "subscription" | null, "checked_at": "<ISO 8601>"}`, plus `"stale": true` when Stripe could not be reached and the answer came from the platform's own records. Add `&session_id=cs_…` on the page the buyer returns to after checkout: that session grants at once, before Stripe's search index catches up. Grants are cached 60 s, denials 15 s. Callable by the user themselves on their own path.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/paywall/payments/?app=<slug>` — the ledger: every payment and subscription the paywall has observed for the organization, newest first, from the platform's records (no Stripe call). `app` and `username` filter; `limit` (default 50, max 200) and `offset` page. `{"count": n, "results": [...]}`, each row `id, username, user_email, user_full_name, app, mode, status, stripe_session_id, stripe_customer_id, stripe_subscription_id, amount_total, currency, created_at, updated_at`. `status` is `paid` for a one-time payment and the subscription's last observed Stripe status otherwise. `{username}` in the path is only the caller's attribution; filter buyers with `username=`. A deleted buyer keeps `username` on the row while `user_email` and `user_full_name` come back `null`.

### Connect with Stripe

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/connect/` — what the proxy runs on right now: `source` (`"key"` — a pasted credential, which wins — `"connected"`, or `null` — nothing yet), `connected`, `key_credential_set`, `available` (can a **new** Connect with Stripe start on this instance), and the `publishable_key` and `stripe_account` a browser needs to render an embedded checkout for that source. When an account is linked the body also carries `account_id`, `livemode`, `charges_enabled`, `details_submitted`, `business_name`, `email`, `connected_at` and `stale` — a snapshot read from Stripe at most once a minute; `?refresh=1` reads it now (once, after the OAuth return — never in a loop). Field table: [`references/paywall-and-connect.md`](references/paywall-and-connect.md).
- **GET** `https://api.iblai.app/dm/api/ai-account/stripe-connect/callback/` — **Stripe's return, for browsers only**; you never call it. Stripe sends the admin there with `state` and `code`; the platform records the account and redirects to the `return_url` given at start with `?stripe_connect=connected` or `?stripe_connect=error&reason=<code>`. A reused or expired link answers `400` JSON instead.

## Writes

Every create and update is a `POST`. Send an `Idempotency-Key` on each.

### Customers

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/customers/` — create a customer. No field is required; the typed hints:
  ```json
  { "email": "jane@example.com", "name": "Jane Doe", "metadata": { "ibl_username": "jane" } }
  ```
  Anything else Stripe's customer object takes (`description`, `phone`, `address`, …) passes through. The paywall finds its customers by `metadata.ibl_username`; use the same tag when you create them yourself.
- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/customers/{customer_id}/` — update a customer with any Stripe customer fields, e.g. `{"name": "Jane A. Doe"}`.

### Products

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/products/` — create a product. `name` is required.
  ```json
  { "name": "My App", "description": "Monthly access", "metadata": { "app": "my-app" } }
  ```
  `default_price_data` creates a price in the same call. `metadata.app` is what the paywall enforces — set it to the app's slug when the product gates an app.
- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/products/{product_id}/` — update a product; `{"active": false}` archives it. **Confirm with the user first** when archiving.

### Prices

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/prices/` — create a price. `currency` is required, and one of `product` (an id) or `product_data` (creates the product inline).
  ```json
  { "product": "prod_…", "currency": "usd", "unit_amount": 2900, "recurring": { "interval": "month" } }
  ```
  Omit `recurring` for a one-time price; `nickname`, `tax_behavior`, `metadata`, … pass through. A price's amount is immutable once created — to change it, create a new price and retire the old one.
- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/prices/{price_id}/` — update a price: `{"active": false}` retires it; `nickname` and `metadata` are editable. **Confirm with the user first** when retiring.

### Payment links

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/payment-links/` — create a payment link. **Confirm with the user first.** `line_items` (non-empty) is required:
  ```json
  { "line_items": [ { "price": "price_…", "quantity": 1 } ] }
  ```
  Returns Stripe's payment link; `url` is the page anyone can pay on. `after_completion`, `allow_promotion_codes`, `metadata`, … pass through.
- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/payment-links/{payment_link_id}/` — update a payment link; `{"active": false}` deactivates it.

### Checkout sessions

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/checkout-sessions/` — create a raw Stripe Checkout Session. **Confirm with the user first.** The platform requires no field; the typed hints:
  ```json
  { "mode": "payment", "line_items": [ { "price": "price_…", "quantity": 1 } ], "success_url": "https://my-app.example/thanks?sid={CHECKOUT_SESSION_ID}", "customer": "cus_…" }
  ```
  `cancel_url`, `ui_mode`, `metadata`, `customer_email`, … pass through; Stripe decides what a given `mode` requires. Returns the session — `url` for a hosted page, `client_secret` for an embedded one. This is the raw session; to sell **access to an app**, use `paywall/checkout/` below, which adds the entitlement rules and records the payment.
- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/checkout-sessions/{session_id}/expire/` — expire an open session (empty body). Answers the session with `"status": "expired"`. **Confirm with the user first.**

### Paywall

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/payments/paywall/checkout/` — start a checkout that buys `{username}` access to `app`. **Confirm with the user first.**
  ```json
  { "app": "my-app", "price_id": "price_…", "ui_mode": "embedded", "payment_method_types": ["card"] }
  ```
  `app` (a slug, ≤ 64 chars) and `price_id` are required. Rules, each a `400` when broken: the price must be active and belong to an active product tagged `metadata.app` equal to `app`; when the organization has **recorded** the app's price in its metadata (`apps.<app>.stripe.price_id`, see the reference) that price is the only one anyone may buy — and a caller buying on their **own** path must have a recorded price to buy at all. The mode follows the price: one-time → `payment`, recurring → `subscription`. The customer is found or created by `metadata.ibl_username`.
  - `"ui_mode": "hosted"` (the default) requires `success_url` and `cancel_url` on `localhost` (any port), one of the organization's deployed app hosts, or one of its custom domains — `https` everywhere but localhost; `{CHECKOUT_SESSION_ID}` is allowed in the URL. Answers `{"checkout_url": "https://checkout.stripe.com/…", "session_id": "cs_…"}`: send the browser there.
  - `"ui_mode": "embedded"` needs no URLs and never redirects. Answers `{"client_secret": "cs_…_secret_…", "session_id": "cs_…", "publishable_key": "pk_…", "stripe_account": "acct_…" | null}` for Stripe.js — `loadStripe(publishable_key, stripe_account ? { stripeAccount } : undefined)`, then an embedded checkout. `400` when the organization's Stripe source has no publishable key. On completion, call `paywall/access/` with the `session_id`.

### Connect with Stripe

- **POST** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/connect/` — start linking the organization's own Stripe account. **Confirm with the user first.**
  ```json
  { "return_url": "https://my-app.example/paywall/setup" }
  ```
  Answers `{"authorize_url": "https://connect.stripe.com/oauth/authorize?…"}`: send the admin's browser there; they sign in to Stripe (or create an account on the spot) and click Connect; Stripe returns through the platform's callback, which records the account and redirects to `return_url?stripe_connect=connected` — or `…?stripe_connect=error&reason=<code>` (codes in the reference). `return_url` obeys the same host rule as the hosted checkout. `400`: an untrusted `return_url`, the shared `main` organization, or an instance without Connect configured; `409`: an account is already linked — `DELETE` first, there is no silent replace; `503`: the instance has nowhere to keep the OAuth state (`GET connect/` shows `available: false`) — an operator's fix; a pasted key and an already-linked account both keep working meanwhile.
- **DELETE** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/connect/` — revoke the platform's access at Stripe and forget the link. **Confirm with the user first**: while an app has a recorded paid price, unlinking locks every member out until an account is linked again (the access check runs on the Stripe source before it reads any record). `204` done; `404` nothing was linked; `502` Stripe could not confirm the revocation and **the link is kept** — retry.

## Example

Load credentials the way every `iblai-api-*` skill does, then create a product and a
monthly price, hand out a payment link, and read who has paid for the app:

```bash
set -a; [ -f .env ] && . ./.env; set +a
val() { grep -m1 "^$1=" iblai.env 2>/dev/null | cut -d= -f2-; }
: "${IBLAI_ORG:=$(val PLATFORM)}"; : "${IBLAI_API_KEY:=$(val TOKEN)}"; : "${IBLAI_USERNAME:=$(val IBLAI_USERNAME)}"
DOMAIN="${DOMAIN:-$(val DOMAIN)}"; DOMAIN="${DOMAIN:-iblai.app}"; API="https://api.$DOMAIN"

BASE="$API/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/providers/stripe"
PAY="$BASE/payments"; CONNECT="$BASE/connect/"
AUTH="Authorization: Api-Token $IBLAI_API_KEY"; JSON='Content-Type: application/json'
RUN="setup-$(date +%s)"          # one idempotency prefix per run; a retry reuses it

# Which Stripe account will answer? (source: key | connected | null)
curl -s "$CONNECT" -H "$AUTH" | jq '{source, publishable_key, livemode, charges_enabled}'

# A product tagged for the app, and a monthly price on it
prod=$(curl -s -X POST "$PAY/products/" -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $RUN-product" \
  -d '{"name":"My App","metadata":{"app":"my-app"}}' | jq -r .id)
price=$(curl -s -X POST "$PAY/prices/" -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $RUN-price" \
  -d "{\"product\":\"$prod\",\"currency\":\"usd\",\"unit_amount\":2900,\"recurring\":{\"interval\":\"month\"}}" | jq -r .id)

# A page anyone can pay on
curl -s -X POST "$PAY/payment-links/" -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $RUN-link" \
  -d "{\"line_items\":[{\"price\":\"$price\",\"quantity\":1}]}" | jq -r .url

# Who has paid for the app (platform records, no Stripe call)
curl -s "$PAY/paywall/payments/?app=my-app" -H "$AUTH" \
  | jq '{count, results: [.results[] | {username, mode, status, amount_total, currency}]}'
```

Check one member's access from a server route, then start an embedded checkout for them:

```bash
ME="$API/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/jane/providers/stripe/payments"
curl -s "$ME/paywall/access/?app=my-app" -H "$AUTH"    # {"has_access": false, "mode": null, "checked_at": "…"}
curl -s -X POST "$ME/paywall/checkout/" -H "$AUTH" -H "$JSON" \
  -d "{\"app\":\"my-app\",\"price_id\":\"$price\",\"ui_mode\":\"embedded\"}"
# → {"client_secret":"cs_…","session_id":"cs_…","publishable_key":"pk_…","stripe_account":"acct_…"|null}
```

## Notes

- **A `502` is never your fault.** Stripe rejecting the stored key, or a connected account
  that revoked the platform, comes back as `502` with a body saying the configured
  credential was rejected; a `401` you receive is always about your own ibl.ai token.
  The fix is the admin's: re-save the key, or reconnect. Stripe's own `400`, `402` (card
  errors), `404` and `409` pass through as `{"error", "code"}`; `429` passes through with
  `Retry-After` when Stripe sent one; every other upstream failure is `502`.
- **`404` has three readings**: `{username}` is not a member of `{org}`; Stripe does not
  know the id on a single-object route; or a self-hosted backend predates the feature —
  a `404` on `connect/` alone means Connect with Stripe arrived after the proxy and the
  paywall on that instance.
- **Objects live on the account that answered.** After a reconnect to a different Stripe
  account, or once a pasted key for another account shadows the linked one, ids minted
  before answer `404` here — re-create the product and price, and re-record them for the
  app.
- **Read `GET connect/` once, not in a loop.** Each `refresh=1` holds a worker on a
  synchronous Stripe call; the snapshot is otherwise refreshed at most once a minute.
- **The paywall's cache windows are visible.** A cancelled subscription is enforced on the
  next uncached check (grants are cached 60 s); a fresh payment is seen at once when the
  return page passes `session_id`, otherwise within 15 s.
- **Test and live are separate accounts.** A test-mode key sees only test objects, and a
  live-mode connected account moves real money: check `livemode` on `GET connect/` before
  a script creates anything.
- **The recorded price is the contract.** An app's setup writes `apps.<slug>.stripe.price_id`
  into the organization's metadata (`/iblai-api-org`); once it exists, `paywall/checkout/`
  refuses every other price for that app, for admins too. Free access is recorded as
  `"price_id": null` — never by omitting the key, because the metadata write merges.
- The generic multi-provider gateway (`/iblai-api-external-service-proxy`) does **not**
  front Stripe; this surface is the only Stripe door.

## Reference material

- [`references/paywall-and-connect.md`](references/paywall-and-connect.md) — the app-paywall flow end to end (the Stripe source, what the app sells and how it is recorded, the member rail, the server rail, the ledger, access semantics, reconnecting), and the Connect status payload field by field.
- [`references/errors.md`](references/errors.md) — every status, the condition behind it, the Stripe-to-platform status translation, the indeterminate `502` on writes, and the `reason` codes on the Connect return URL.