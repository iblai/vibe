# Admin setup — curl by curl

Everything here runs with the organization's **platform API key**
(`Authorization: Api-Token $TOKEN`), acting as the admin themselves. The
agent never handles the organization's Stripe key — it lives in the platform's
credential store and every call below goes through the DM proxy.

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
```

## 1. Verify the organization's Stripe source (and the backend)

```bash
curl -s "$CONNECT" -H "$AUTH"
```

Answers `{connected, available, key_credential_set, source, publishable_key,
stripe_account}` plus, when connected, the account snapshot (`account_id`,
`livemode`, `charges_enabled`, `details_submitted`, `business_name`, `email`,
`connected_at`, `stale`). The snapshot is read from Stripe at most once a
minute; `?refresh=1` reads it now.

`available` answers one narrow question — whether a **new** Connect with Stripe
can be started on this backend — so `available: false` with `connected: true` is
a real combination and not an error: an organization whose account is already
linked keeps its working payments proxy, and only starting over is unavailable.
Read `source` for what the proxy runs on, and `available` only before offering
the Connect button.

- `source: "key"` → a pasted `stripe` credential runs the proxy (it wins over
  a connected account). `source: "connected"` → the linked account runs it.
- `source: null` → nothing yet. Two ways, the admin's choice:
  - **Connect with Stripe** (confirm with the user first — it opens Stripe):

    ```bash
    curl -s -X POST "$CONNECT" -H "$AUTH" -H 'Content-Type: application/json' \
      -d '{"return_url":"http://localhost:3000/setup"}'
    # → {"authorize_url":"https://connect.stripe.com/oauth/authorize?…"} — open it in the browser
    curl -s "$CONNECT?refresh=1" -H "$AUTH"      # after the return: "connected": true
    ```

    `return_url` must be on one of the organization's deployed apps, its custom
    domains, or localhost. The admin signs in to Stripe (or creates an
    account there) and clicks Connect; Stripe sends the browser back through
    the platform to `return_url?stripe_connect=connected`, or
    `…?stripe_connect=error&reason=<code>` — `access_denied` (cancelled),
    `invalid_grant` (link expired, or the instance's key and client id are
    from different modes), `already_connected`, `account_linked_elsewhere`
    (that Stripe account is linked to another organization), `not_configured`
    (the instance has no Connect credential), `stripe_unreachable`. `409` on
    the POST means an account is already connected; `503` (or
    `available: false`) means the backend has nowhere to keep the OAuth state,
    so it needs an operator (a migration, or a cache it can actually write to) —
    tell the admin that, do not retry, and note that an already-linked
    organization still works meanwhile (`connected: true`).
    `DELETE $CONNECT` (204) deauthorizes at Stripe and forgets the link —
    confirm with the user first; a `502` there means Stripe could not
    confirm it and the link is kept (retry). Reconnect (another account, or
    the same one after the admin revoked the app on Stripe) = `DELETE`, the
    `POST` round trip again, then re-record the price (§3b) on the new
    account.
  - **A pasted key**: the admin adds an integration credential named `stripe`
    in the platform credentials UI, holding a **restricted** key: Stripe
    Dashboard → Developers → API keys → Create restricted key — write on
    Products, Prices, Checkout Sessions, Customers; read on Subscriptions;
    everything else None. Test-mode key first if they want a dry run. **Never
    ask for or accept the key in chat.**
- `502` on any proxy call → Stripe rejected the source (wrong-mode key, or
  the account was disconnected on Stripe's side) — the admin re-saves the
  key, or reconnects.
- `404` → the platform backend predates Connect with Stripe (ibl-dm-pro <
  4.377.0; `GET $PAY/products/?limit=1` then tells a pasted-key setup apart:
  200 ready, 400 no credential; a 404 there too means it predates the
  proxy/paywall, PR #2977) or `$IBLAI_USERNAME` is not a member of
  `$PLATFORM`. Fix before continuing.

## 2. Create the product, tagged for this app

```bash
curl -s -X POST "$PAY/products/" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"<App> access","metadata":{"app":"<slug>"}}'
```

`metadata.app` is what the DM enforces at checkout — it must equal the app's
`PAYWALL_APP_SLUG` exactly (a price on an untagged product cannot mint
access).

## 3. Create price(s)

One-time:

```bash
curl -s -X POST "$PAY/prices/" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"product":"prod_...","unit_amount":2900,"currency":"usd"}'
```

Subscription — add `"recurring":{"interval":"month"}` (or `"year"`).
Checkout mode (payment vs subscription) follows the price type
automatically.

## 3b. Record the price on the platform

```bash
curl -s -X PUT "$META" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"metadata":{"apps":{"<slug>":{"stripe":{"product_id":"prod_...","price_id":"price_...","publishable_key":"<publishable_key from $CONNECT>","stripe_account":"<stripe_account from $CONNECT, or null>"}}}}}'
```

A deep merge — the organization's other metadata keys survive — and a **public
read**: ids and the publishable key only, never a secret. The recorded price
is the contract: a caller buying on their **own** path (a member on the
self-service rail, or the platform key's owner testing their own app) must
have one and can buy only it, and once recorded it binds every checkout. One
price per app: an app selling several prices through the server rail leaves
this out and is tested with a member account.

## 4. Capture display data

```bash
curl -s "$PAY/prices/<price_id>/" -H "$AUTH" | jq '{unit_amount, currency, recurring}'
```

Fill the `PRICES` constant in `app/paywall/page.tsx` from this (re-run steps
3–4 whenever prices change — display data is deliberately duplicated).

## 5. Write the app env

Append to `.env.local`:

```bash
PAYWALL_PRICE_IDS=price_xxx,price_yyy
PAYWALL_APP_SLUG=<slug>
```

## 6. Who paid (admin reporting)

```bash
curl -s "$PAY/paywall/payments/?app=<slug>" -H "$AUTH" | jq '{count, results: [.results[] | {username, mode, status, amount_total, currency}]}'
```

Filter a single buyer with `&username=<name>`. Rows are the DM's own
records — no Stripe calls; subscriptions carry the last observed status and
refresh on every uncached access check.

## 7. Member self-service checkout (the browser, the member's own token)

The same two endpoints on the **member's own path** with the member's DM
token — no platform key in the app:

```bash
ME="$DM/api/ai-mentor/orgs/$PLATFORM/users/<me>/providers/stripe/payments"
curl -s -X POST "$ME/paywall/checkout/" -H "Authorization: Token <dm_token>" \
  -H 'Content-Type: application/json' \
  -d '{"app":"<slug>","price_id":"price_...","ui_mode":"embedded","payment_method_types":["card"]}'
# → {"client_secret":"cs_…","session_id":"cs_…","publishable_key":"pk_…","stripe_account":"acct_…"|null}
curl -s "$ME/paywall/access/?app=<slug>&session_id=cs_..." -H "Authorization: Token <dm_token>"
# → {"has_access": true, "mode": "payment", "checked_at": "…"}
```

`ui_mode` omitted is hosted checkout (`success_url`/`cancel_url` →
`checkout_url`). The browser renders the embedded session with Stripe.js
(`loadStripe(publishable_key, {stripeAccount})` when `stripe_account` is
set) and polls the access check with the `session_id` on completion. RBAC:
`Ibl.Mentor/StripePaywallSelf/action` (Students role; `seed_rbac_data` on
organizations seeded before it). The recorded price (§3b) is required here.

## Error table

| Status | Meaning | Fix |
|---|---|---|
| 400 | No Stripe source, or actionable input problem (wrong app tag, price not the recorded one, "no price recorded" on an own-path checkout, disallowed redirect host, bad body) | Read the body — no source means §1 (Connect with Stripe, or the admin pastes a key; never collect it in chat); "no price recorded" means §3b; anything else says exactly what to change |
| 403 | Own-path call by a member without the Students verb, or a member on another user's path | `seed_rbac_data`; the browser rail is own-path only |
| 404 | Backend predates the paywall endpoints (or, on `$CONNECT`, Connect with Stripe), or path user not a platform member | Upgrade ibl-dm-pro / fix `IBLAI_USERNAME` |
| 409 | `POST $CONNECT` while an account is connected | `GET $CONNECT` shows it; `DELETE` first to link another |
| 429 | Stripe rate limit (passed through) | Wait `Retry-After` seconds, retry |
| 502 | Stripe rejected the source (key or connected account) | Admin re-saves a valid restricted key, or reconnects |
| 502 | `DELETE $CONNECT` while Stripe is unreachable or failing | Still connected; retry the disconnect |
| 503 | `POST $CONNECT` when the backend cannot keep the OAuth state (`available: false`) | Ops; a pasted key, and an account already linked, both work meanwhile |

## Setup verify

- [ ] `GET $CONNECT` → `source` is `key` or `connected` (and, connected,
      `charges_enabled: true`)
- [ ] `GET $PAY/products/?limit=1` → 200
- [ ] The product carries `metadata.app == <slug>` and is active
- [ ] Each price in `PAYWALL_PRICE_IDS` is active (`GET $PAY/prices/<id>/`)
- [ ] Both `PAYWALL_*` lines present in `.env.local`
- [ ] `GET $META` shows `apps.<slug>.stripe.price_id` (single-price apps)
- [ ] `GET $PAY/paywall/access/?app=<slug>` returns
      `{"has_access": false, …}` for a fresh user — a JSON answer, not a 404
