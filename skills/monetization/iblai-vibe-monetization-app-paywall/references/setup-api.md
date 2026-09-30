# Paywall setup — what the app calls, and the curl equivalents

The installed app does all of this itself from `/paywall/setup`, on the signed-in admin's
**own** session token (`Authorization: Token <dm_token>`) through its two admin routes,
`app/api/paywall/admin/connect` and `app/api/paywall/admin/setup`; members pay on their own
token (§4). This page is the reference behind that screen: every platform call it makes and
what each answers — and, for CI or debugging only, the same calls as curls with the
organization's **platform API key** (`Authorization: Api-Token $TOKEN`, acting as
`$IBLAI_USERNAME`). Never collect a Stripe key: it lives in the platform's credential store,
and every call below goes through the platform's proxy.

## 0. Shorthand

Read `iblai.env` (values may contain spaces — do not `source` it). The
platform username comes from the `IBLAI_USERNAME` environment variable when
the host provides it, else from `iblai.env` — same as
`/iblai-vibe-ops-deploy` Step 1 (never name the variable `USERNAME`: zsh
binds that to the OS login name and silently discards assignments):

```bash
val() { grep -m1 "^$1=" iblai.env | cut -d= -f2-; }
DOMAIN=$(val DOMAIN); DOMAIN="${DOMAIN:-iblai.app}"
PLATFORM=$(val PLATFORM); TOKEN=$(val TOKEN)
IBLAI_USERNAME="${IBLAI_USERNAME:-$(val IBLAI_USERNAME)}"
[ -n "$IBLAI_USERNAME" ] || IBLAI_USERNAME=$(val USERNAME)   # legacy iblai.env key
AUTH="Authorization: Api-Token $TOKEN"
DM="https://api.$DOMAIN/dm"
```

If `IBLAI_USERNAME` is still empty, ask the user once for their platform
username and append `IBLAI_USERNAME=…` to `iblai.env`. Then:

```bash
PAY="$DM/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/payments"
CONNECT="$DM/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/connect/"
META="$DM/api/core/orgs/$PLATFORM/metadata/"
SLUG=my-app   # NEXT_PUBLIC_PAYWALL_APP_SLUG from .env.local
```

## 1. The organization's Stripe source — `GET $CONNECT`

```bash
curl -s "$CONNECT" -H "$AUTH"
```

Answers `{connected, available, key_credential_set, source, publishable_key,
stripe_account}` plus, when connected, the account snapshot (`account_id`, `livemode`,
`charges_enabled`, `details_submitted`, `business_name`, `email`, `connected_at`, `stale`),
read from Stripe at most once a minute (`?refresh=1` reads it now — once, never in a loop).

- `source: "key"` → a pasted `stripe` credential runs the proxy (it wins over a connected
  account); `publishable_key` is whatever that credential stores beside the key.
  `source: "connected"` → the linked account runs it, with ibl.ai's own publishable key.
- `source: null` → nothing yet, and `publishable_key` is `""` — which says nothing about the
  key until there is a source. `available` answers one narrow question: can a **new** Connect
  with Stripe start on this backend. `available: false` with `connected: true` is real: the
  linked account keeps working, only starting over is unavailable.
- A paid plan needs a source **with** a publishable key: embedded checkout is initialised with
  it, and the platform refuses one without (the setup screen refuses the save first, naming
  the fix).

### Connect with Stripe (the screen's button)

```bash
curl -s -X POST "$CONNECT" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"return_url":"http://localhost:3000/paywall/setup/connect"}'
# → {"authorize_url":"https://connect.stripe.com/oauth/authorize?…"}
```

`return_url` must be on one of the organization's deployed apps, its custom domains, or
localhost. The admin signs in to Stripe (or creates an account there) and clicks Connect;
Stripe sends the browser back through the platform to `return_url?stripe_connect=connected`,
or `…?stripe_connect=error&reason=<code>`:

| `reason` | Meaning | What to do |
|---|---|---|
| `access_denied` | The admin cancelled on Stripe | Nothing, or connect again |
| `invalid_grant` | Stripe refused the one-time code at the platform's token exchange — nothing the app sends reaches it. Either the code was spent (a replay) or, when it repeats, the instance's Connect credential (`auth_stripe`) has a client id and secret key from different modes (test vs live) or accounts | Try once more; if it repeats, ibl.ai support fixes the instance credential. A pasted restricted key plus its publishable key works meanwhile |
| `already_connected` | The organization already has a linked account | `DELETE` first to link another |
| `account_linked_elsewhere` | That Stripe account is linked to another organization | Use another account, or unlink it there |
| `not_configured` | The instance has no Connect credential, or Stripe rejected it | ibl.ai support |
| `stripe_unreachable` | Stripe did not answer | Retry |
| `oauth_error` | Stripe came back without a code or an account id | Retry |
| `platform_missing` | The organization was deleted mid-flow | — |

`409` on the POST means an account is already connected. `503` (or `available: false`) means
the backend has nowhere to keep the OAuth state — an operator's fix (a migration, or a cache it
can actually write to); do not retry, and note that a pasted key and an already-linked account
both keep working. `400` names an untrusted `return_url` or an instance without Connect.

`DELETE $CONNECT` → `204` deauthorizes at Stripe and forgets the link; `404` = nothing was
connected; `502` = Stripe could not confirm it, so the link is **kept** (retry). While a paid
plan is recorded, unlinking locks **every** member out — the access check runs on the Stripe
source before it looks at recorded payments — until an account is linked again; to stop
charging, save **Free access** instead. Reconnect (another account, or the same one after the
admin revoked ibl.ai on Stripe) is `DELETE`, the `POST` round trip, then a new save (§2) — the
old price lives on the old account.

### A pasted key (the other way, the admin's, never in chat)

An integration credential named `stripe` in the platform's credentials, holding a
**restricted** key under `key` — Stripe Dashboard → Developers → API keys → Create restricted
key: write on Products, Prices, Checkout Sessions, Customers; read on Subscriptions;
everything else None — and the account's **publishable key** (`pk_…`, a public value) under
`publishable_key`: without it no paid plan can be saved. **Never ask for or accept either key in
chat.**

- `502` on any proxy call → Stripe rejected the source (a wrong-mode key, or an account
  disconnected on Stripe's side): the admin re-saves the key, or reconnects.
- `404` on `$CONNECT` → the backend predates Connect with Stripe (ibl-dm-pro < 4.377.0), or
  `$IBLAI_USERNAME` is not a member of `$PLATFORM`.

## 2. Save — what `POST /api/paywall/admin/setup` does

The screen posts `{"access": "free" | "one_time" | "monthly", "amount": <cents>}` with an
`Idempotency-Key`; the route runs these steps on the admin's own path and token, suffixing the
key per Stripe write (`-archive`, `-product`, `-price`) so a retried save is safe. **Free runs
only step e**, with `price_id: null` — zero Stripe or connect calls, ever.

a. **The source**: `GET $CONNECT` — no `source` → 400 `Connect a Stripe account first`; no
   `publishable_key` → 400 naming the fix for that source. Nothing is touched either way.

b. **Retire the recorded price** (`apps.<slug>.stripe.price_id`, also on a record the previous
   release wrote with no `access`):

   ```bash
   curl -s -X POST "$PAY/prices/price_old/" -H "$AUTH" -H 'Content-Type: application/json' \
     -d '{"active":false}'      # 404 = nothing to retire: after a reconnect it lives elsewhere
   ```

c. **The product**: reuse the recorded one while `GET $PAY/products/<id>/` shows it `active`
   and tagged `metadata.app == $SLUG`, else create one, named after the app — what Stripe's
   checkout shows:

   ```bash
   curl -s -X POST "$PAY/products/" -H "$AUTH" -H 'Content-Type: application/json' \
     -d "{\"name\":\"My App\",\"metadata\":{\"app\":\"$SLUG\"}}"
   ```

   `metadata.app` is what the platform enforces at checkout — a price on an untagged product
   cannot mint access.

d. **The price**, USD; monthly is a subscription (checkout mode follows the price type):

   ```bash
   curl -s -X POST "$PAY/prices/" -H "$AUTH" -H 'Content-Type: application/json' \
     -d '{"product":"prod_…","unit_amount":2900,"currency":"usd","nickname":"Monthly access","recurring":{"interval":"month"}}'
   ```

e. **Record the choice** — every key, nulls included:

   ```bash
   curl -s -X PUT "$META" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"metadata\":{\"apps\":{\"$SLUG\":{
     \"version\":1,\"access\":\"monthly\",\"amount\":2900,\"currency\":\"usd\",
     \"stripe\":{\"product_id\":\"prod_…\",\"price_id\":\"price_…\",\"publishable_key\":\"pk_…\",\"stripe_account\":\"acct_…\"},
     \"updated_at\":\"$(date -u +%FT%TZ)\",\"updated_by\":\"$IBLAI_USERNAME\"}}}}"
   ```

   The platform **deep-merges** this write and cannot delete a key, so a field left out keeps
   its old value — which is why free writes `price_id: null` rather than omitting it. It is a
   **public read**: ids, amounts and the publishable key only, never a secret. The recorded
   price is the contract: a member buying on their own path can buy only it (400 `no price
   recorded` without one), and once recorded it binds every checkout.

## 3. Who paid (admin reporting)

```bash
curl -s "$PAY/paywall/payments/?app=$SLUG" -H "$AUTH" | jq '{count, results: [.results[] | {username, user_email, user_full_name, mode, status, amount_total, currency}]}'
```

Filter a single buyer with `&username=<name>`. Rows are the platform's own
records — no Stripe calls; subscriptions carry the last observed status and
refresh on every uncached access check. `username` is stored on the payment
row so the record survives the buyer's deletion; `user_email` and
`user_full_name` are read through the user and come back `null` once they are
gone, rather than naming whoever holds that username next.

## 4. The member rail (what the pay modal does)

The same two paywall endpoints on the **member's own path** with the member's own token —
no platform key in the app:

```bash
ME="$DM/api/ai-mentor/orgs/$PLATFORM/users/<me>/providers/stripe/payments"
curl -s -X POST "$ME/paywall/checkout/" -H "Authorization: Token <dm_token>" \
  -H 'Content-Type: application/json' \
  -d "{\"app\":\"$SLUG\",\"price_id\":\"price_…\",\"ui_mode\":\"embedded\",\"payment_method_types\":[\"card\"]}"
# → {"client_secret":"cs_…","session_id":"cs_…","publishable_key":"pk_…","stripe_account":"acct_…"|null}
curl -s "$ME/paywall/access/?app=$SLUG&session_id=cs_…" -H "Authorization: Token <dm_token>"
# → {"has_access": true, "mode": "payment", "checked_at": "…"}
```

The modal renders the session with Stripe.js (`loadStripe(publishable_key, {stripeAccount})`
when `stripe_account` is set, then `createEmbeddedCheckoutPage`); Stripe never redirects, and
on completion the modal polls the access check with the `session_id` every 3 s for up to a
minute. Only `has_access: true` lets a member in. RBAC: `Ibl.Mentor/StripePaywallSelf/action`
(the Students role; `seed_rbac_data` on organizations seeded before it). The access check runs
on the organization's Stripe source, so with none it answers 400 for everyone.

## Error table

| Status | Meaning | Fix |
|---|---|---|
| 400 | No Stripe source, or a source with no publishable key; an actionable input problem (wrong app tag, not the recorded price, `no price recorded`, a disallowed `return_url` host, a bad body) | Read the body — no source means §1 (Connect with Stripe, or the admin's pasted key); anything else says exactly what to change |
| 403 | A member without the Students verb on their own path; a member on another user's path; a non-admin on the admin routes; a token for another organization than the path's | `seed_rbac_data`; the member rail is own-path only; the browser's `app_tenant` must name the app's organization |
| 404 | Backend predates the paywall endpoints (or, on `$CONNECT`, Connect with Stripe), or the path user is not a member | Upgrade ibl-dm-pro / fix `IBLAI_USERNAME` |
| 409 | `POST $CONNECT` while an account is connected | `GET $CONNECT` shows it; `DELETE` first to link another |
| 429 | Stripe rate limit (passed through) | Wait `Retry-After` seconds, retry |
| 500 | The app's own `NEXT_PUBLIC_PAYWALL_APP_SLUG` or `NEXT_PUBLIC_MAIN_TENANT_KEY` is missing or not a slug | Fix `.env.local` (and redeploy) |
| 502 | Stripe rejected the source (key or connected account), or `DELETE $CONNECT` could not reach Stripe | Re-save a valid key or reconnect; after a failed disconnect the account is still connected — retry |
| 503 | `POST $CONNECT` when the backend cannot keep the OAuth state (`available: false`) | Operator; a pasted key, and an account already linked, both work meanwhile |

## Setup verify

- [ ] `GET $CONNECT` → `source` is `key` or `connected`, with a non-empty `publishable_key`
      (and, connected, `charges_enabled: true`)
- [ ] `GET $META` → `apps.$SLUG` carries `access`, `amount` and `stripe.price_id`
- [ ] The recorded product carries `metadata.app == $SLUG` and is active
      (`GET $PAY/products/<id>/`), and the recorded price is active (`GET $PAY/prices/<id>/`)
- [ ] `grep NEXT_PUBLIC_PAYWALL_APP_SLUG .env.local` prints the slug
- [ ] `GET $PAY/paywall/access/?app=$SLUG` answers a JSON verdict for the key's owner, not a 404
