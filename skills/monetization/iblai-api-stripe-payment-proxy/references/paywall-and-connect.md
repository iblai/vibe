# The app paywall and Connect with Stripe, end to end

`SKILL.md` lists the endpoints; this page walks the two features that sit on top of the
proxy in the order a real app uses them. Shorthand, after the credential snippet in
`SKILL.md`'s Example:

```bash
BASE="$API/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/providers/stripe"
PAY="$BASE/payments"; CONNECT="$BASE/connect/"
META="$API/dm/api/core/orgs/$IBLAI_ORG/metadata/"
AUTH="Authorization: Api-Token $IBLAI_API_KEY"; JSON='Content-Type: application/json'
SLUG=my-app                       # the app's slug — the value the app reads at runtime
RUN="setup-$(date +%s)"           # idempotency prefix; a retry reuses it
```

## 1. Give the organization a Stripe source

Two ways, and the first wins whenever both exist:

- **A pasted restricted key** — an integration credential named `stripe` whose value is
  `{"key": "rk_…", "publishable_key": "pk_…"}` (`/iblai-api-integration`). Scope the key
  to write on Customers, Products, Prices, Payment Links and Checkout Sessions and read
  on Subscriptions. The publishable key is a public value; without it no embedded
  checkout can render, so no paid plan can be set up on that source.
- **Connect with Stripe** — OAuth, nothing typed anywhere:

  ```bash
  curl -s -X POST "$CONNECT" -H "$AUTH" -H "$JSON" \
    -d '{"return_url":"https://my-app.example/paywall/setup"}'
  # → {"authorize_url":"https://connect.stripe.com/oauth/authorize?…"}
  ```

  Send the admin's browser to `authorize_url`. They sign in to Stripe (or create an
  account right there), pick the account and click Connect; Stripe returns through the
  platform to `return_url?stripe_connect=connected` — or `…=error&reason=<code>`, codes
  in [`errors.md`](errors.md). Then read the status **once**:

  ```bash
  curl -s "${CONNECT}?refresh=1" -H "$AUTH"
  ```

### The status payload (`GET connect/`)

| Field | Meaning |
|---|---|
| `source` | What the proxy runs on now: `"key"` (a pasted credential — it wins), `"connected"` (the linked account), or `null` (nothing yet: every proxy call answers `400`). |
| `connected` | An account is linked — whether or not a pasted key currently shadows it. |
| `key_credential_set` | A pasted `stripe` credential exists. |
| `available` | Whether a **new** Connect with Stripe can start on this instance. `false` with `connected: true` is a real state: the linked account keeps working, only starting over is unavailable. |
| `publishable_key` | The key Stripe.js is initialised with for this source; `""` when the source has none (embedded checkout then answers `400`). |
| `stripe_account` | The linked account id for Stripe.js's `stripeAccount` option, or `null` on a pasted key. |
| `account_id`, `livemode`, `charges_enabled`, `details_submitted`, `business_name`, `email`, `connected_at` | The linked account's snapshot — present only when `connected`. `charges_enabled: false` means Stripe has not enabled payments on that account yet. |
| `stale` | The snapshot could not be refreshed from Stripe on this read. |

The snapshot is read from Stripe at most once a minute; `refresh=1` forces a read. Use
it once after the OAuth return, never in a poll — each forced read holds a worker on a
synchronous Stripe call.

## 2. Create what the app sells, and record it

```bash
prod=$(curl -s -X POST "$PAY/products/" -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $RUN-product" \
  -d "{\"name\":\"My App\",\"metadata\":{\"app\":\"$SLUG\"}}" | jq -r .id)
price=$(curl -s -X POST "$PAY/prices/" -H "$AUTH" -H "$JSON" -H "Idempotency-Key: $RUN-price" \
  -d "{\"product\":\"$prod\",\"currency\":\"usd\",\"unit_amount\":2900,\"nickname\":\"Monthly access\",\"recurring\":{\"interval\":\"month\"}}" \
  | jq -r .id)
```

`metadata.app` on the **product** is what the paywall enforces: a price on an untagged
product cannot mint access to the app, however cheap. One-time access is the same price
without `recurring`. Changing the amount later means a new price and
`{"active": false}` on the old one — never a second live price for the same app.

**Record the price** in the organization's metadata so the platform knows the app's
contract (`/iblai-api-org`; the same object the app reads at runtime). The write
**merges** nested keys and never deletes one, so write every key explicitly — free
access is `"price_id": null`, not an omitted key. Read the current object first and keep
what is there:

```bash
curl -s "$META" -H "$AUTH" | jq .apps            # what is recorded today
curl -s -X PUT "$META" -H "$AUTH" -H "$JSON" -d "{\"metadata\":{\"apps\":{\"$SLUG\":{
  \"version\":1,\"access\":\"monthly\",\"amount\":2900,\"currency\":\"usd\",
  \"stripe\":{\"product_id\":\"$prod\",\"price_id\":\"$price\",\"publishable_key\":\"pk_…\",\"stripe_account\":\"acct_…\"},
  \"updated_at\":\"$(date -u +%FT%TZ)\",\"updated_by\":\"$IBLAI_USERNAME\"}}}}"
```

`publishable_key` and `stripe_account` come from `GET connect/` (`null` on a pasted key);
recording them lets the app render checkout without asking again. The object is a
**public read** — ids, amounts and the publishable key only, never a secret. From now on
`paywall/checkout/` accepts this price and no other for `$SLUG`, for every caller.

## 3. The member rail — pay from a browser, no platform key in the app

The member's **own** session token on the member's **own** path; the default member
role holds the verb (`Ibl.Mentor/StripePaywallSelf/action`):

```bash
ME="$API/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/<me>/providers/stripe/payments"
curl -s -X POST "$ME/paywall/checkout/" -H "Authorization: Token <dm_token>" -H "$JSON" \
  -d "{\"app\":\"$SLUG\",\"price_id\":\"$price\",\"ui_mode\":\"embedded\",\"payment_method_types\":[\"card\"]}"
# → {"client_secret":"cs_…","session_id":"cs_…","publishable_key":"pk_…","stripe_account":"acct_…"|null}
curl -s "$ME/paywall/access/?app=$SLUG&session_id=cs_…" -H "Authorization: Token <dm_token>"
# → {"has_access": true, "mode": "subscription", "checked_at": "…"}
```

- A member can buy **only the recorded price**: without one the checkout answers `400`
  saying no price is recorded, and another price answers `400` naming the recorded one.
- Another user's path is `403`; the ledger is `403`. Only these two calls, on the own path.
- The browser renders the session with Stripe.js — `loadStripe(publishable_key,
  stripe_account ? { stripeAccount } : undefined)`, then an embedded checkout fed the
  `client_secret`. Stripe never redirects in embedded mode: on completion the page asks
  `paywall/access/` with the `session_id` (every few seconds for up to a minute is
  plenty) and lets the member in only on `has_access: true`.

## 4. The server rail — an app's server acting for a member

The same two calls with the organization's Platform API Token on the **member's** path,
for an app that keeps its gate server-side:

```bash
U="$API/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/jane/providers/stripe/payments"
curl -s -X POST "$U/paywall/checkout/" -H "$AUTH" -H "$JSON" \
  -d "{\"app\":\"$SLUG\",\"price_id\":\"$price\",\"success_url\":\"https://my-app.example/thanks?sid={CHECKOUT_SESSION_ID}\",\"cancel_url\":\"https://my-app.example/pricing\"}"
# → {"checkout_url":"https://checkout.stripe.com/…","session_id":"cs_…"}
curl -s "$U/paywall/access/?app=$SLUG" -H "$AUTH"
```

`success_url` and `cancel_url` must sit on localhost, one of the organization's deployed
app hosts or one of its custom domains (`https` outside localhost); anything else is a
`400` naming only the host — no open redirect wearing the organization's checkout. The
recorded-price rule binds this caller too once a price is recorded; when nothing is
recorded, a server or admin may sell any price whose product carries the app's tag.

## 5. Who paid

```bash
curl -s "$PAY/paywall/payments/?app=$SLUG" -H "$AUTH" \
  | jq '{count, results: [.results[] | {username, user_email, mode, status, amount_total, currency, updated_at}]}'
```

Rows are the platform's own records — no Stripe call. `status` is `paid` for a one-time
payment; for a subscription it is the last observed Stripe status (`active`, `trialing`,
`canceled`, …), refreshed on every uncached access check. `username` is kept on the row
so the record survives the buyer's deletion; `user_email` and `user_full_name` are read
through the user and come back `null` once they are gone, rather than naming whoever
holds that username next. `username=` filters one buyer; `limit` (max 200) and `offset`
page.

## 6. What the access check does

`GET …/paywall/access/?app=<slug>[&session_id=]` answers from, in order:

1. a short cache — grants for 60 s, denials for 15 s (a `session_id` bypasses a cached
   denial once, so the return page never sees a stale "no");
2. the platform's recorded **one-time** payments — a completed one-time checkout is
   permanent access and answers without a Stripe call;
3. the `session_id` the buyer returned with — read-after-write safe, ahead of Stripe's
   search index (which lags about a minute);
4. Stripe itself: the customer tagged `metadata.ibl_username`, their completed sessions
   for this app; a subscription grants only while `active` or `trialing`, checked live so
   a cancellation lands within the cache window.

If Stripe cannot be reached, a user with a recorded grant keeps access with
`"stale": true`; a user without one is refused. Neither outcome is cached, so recovery
is immediate once Stripe answers again.

## 7. Reconnecting, switching accounts, stopping

- **Another account, or the same one after the admin revoked the platform on Stripe:**
  `DELETE connect/` (`204`; `502` keeps the link — retry), `POST connect/` and the OAuth
  round trip again, then **re-create the product and price and re-record them** — the
  old ids live on the old account and answer `404` here.
- **A pasted key added while an account is linked** shadows the link at once (`source`
  flips to `"key"`); if the key belongs to another Stripe account, the same re-create
  and re-record applies.
- **To stop charging**, record free access (`"access": "free"`, `"price_id": null`)
  rather than unlinking: while a paid price is recorded, an organization with no Stripe
  source locks **every** member out, because the access check needs the source before
  it reads any record.
