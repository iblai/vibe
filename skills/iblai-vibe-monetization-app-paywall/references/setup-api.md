# Admin setup — curl by curl

Everything here runs with the tenant's **platform API key**
(`Authorization: Api-Token $TOKEN`), acting as the admin themselves. The
agent never handles the tenant's Stripe key — it lives in the platform's
credential store and every call below goes through the DM proxy.

## 0. Shorthand

Read `iblai.env` (values may contain spaces — do not `source` it). The
platform username comes from the `IBLAI_USERNAME` environment variable when
the host provides it, else from `iblai.env` — same as
`/iblai-vibe-ops-deploy` Step 1 (never name the variable `USERNAME`: zsh
binds that to the OS login name and silently discards assignments):

```bash
val() { grep -m1 "^$1=" iblai.env | cut -d= -f2-; }
DOMAIN=$(val DOMAIN); PLATFORM=$(val PLATFORM); TOKEN=$(val TOKEN)
IBLAI_USERNAME="${IBLAI_USERNAME:-$(val IBLAI_USERNAME)}"
[ -n "$IBLAI_USERNAME" ] || IBLAI_USERNAME=$(val USERNAME)   # legacy iblai.env key
AUTH="Authorization: Api-Token $TOKEN"
DM="https://api.$DOMAIN/dm"
```

If `IBLAI_USERNAME` is still empty, ask the user once for their platform
username and append `IBLAI_USERNAME=…` to `iblai.env`. Then:

```bash
PAY="$DM/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/payments"
```

## 1. Verify the tenant's Stripe connection (and the backend)

```bash
curl -s "$PAY/products/?limit=1" -H "$AUTH"
```

- `200` → ready.
- `400` with a self-describing message (`No Stripe credential configured for
  platform '<org>'…`) → the tenant has no Stripe credential. **Stop and hand
  off** — never ask for or accept a Stripe key in chat. Tell the admin to add
  an integration credential named `stripe` in the platform credentials UI,
  holding a **restricted** key: Stripe Dashboard → Developers → API keys →
  Create restricted key — write on Products, Prices, Checkout Sessions,
  Customers; read on Subscriptions; everything else None. Test-mode key first
  if they want a dry run. Re-run this probe once they confirm.
- `502` → Stripe rejected the stored key (typo / wrong mode) — the admin
  re-saves it in the credentials UI.
- `404` → either the platform backend predates the Stripe proxy/paywall
  (needs ibl-dm-pro ≥ PR #2977) or `$IBLAI_USERNAME` is not a member of
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

## Error table

| Status | Meaning | Fix |
|---|---|---|
| 400 | Missing credential, or actionable input problem (wrong app tag, disallowed redirect host, bad body) | Read the body — "No Stripe credential configured…" means hand off to an admin (§1, never collect the key in chat); anything else says exactly what to change |
| 404 | Backend predates the paywall endpoints, or path user not a platform member | Upgrade ibl-dm-pro / fix `IBLAI_USERNAME` |
| 429 | Stripe rate limit (passed through) | Wait `Retry-After` seconds, retry |
| 502 | Stripe rejected the stored key | Admin re-saves a valid restricted key in the platform credentials UI |

## Setup verify

- [ ] `GET $PAY/products/?limit=1` → 200
- [ ] The product carries `metadata.app == <slug>` and is active
- [ ] Each price in `PAYWALL_PRICE_IDS` is active (`GET $PAY/prices/<id>/`)
- [ ] Both `PAYWALL_*` lines present in `.env.local`
- [ ] `GET $PAY/paywall/access/?app=<slug>` returns
      `{"has_access": false, …}` for a fresh user — a JSON answer, not a 404
