# Admin setup — curl by curl

Everything here runs with the tenant's **platform API key**
(`Authorization: Api-Token $TOKEN`), acting as the admin themselves. Never
echo the Stripe key into logs and never commit it.

## 0. Shorthand

Read `iblai.env` (values may contain spaces — do not `source` it):

```bash
val() { grep -m1 "^$1=" iblai.env | cut -d= -f2-; }
DOMAIN=$(val DOMAIN); PLATFORM=$(val PLATFORM); TOKEN=$(val TOKEN); USERNAME=$(val USERNAME)
AUTH="Authorization: Api-Token $TOKEN"
DM="https://api.$DOMAIN/dm"
```

If `USERNAME` is empty, auto-detect the key owner's platform username and
persist it (same as `/iblai-vibe-ops-deploy` Step 1):

```bash
USERNAME=$(curl -s "$DM/api/core/users/platforms/" -H "$AUTH" \
  | jq -r --arg p "$PLATFORM" '(.results // .) | first(.[] | select(.key == $p) | .username) // empty')
[ -n "$USERNAME" ] && echo "USERNAME=$USERNAME" >> iblai.env
```

(If auto-detect comes back empty, ask the user once and append the line the
same way.) Then:

```bash
PAY="$DM/api/ai-mentor/orgs/$PLATFORM/users/$USERNAME/providers/stripe/payments"
```

## 1. Store the tenant's Stripe key

Ask the admin for a **restricted** key: Stripe Dashboard → Developers → API
keys → Create restricted key — write on Products, Prices, Checkout Sessions,
Customers; read on Subscriptions; everything else None. Test-mode key first
if they want a dry run.

```bash
curl -s -X POST "$DM/api/ai-account/orgs/$PLATFORM/integration-credential/" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"stripe\",\"value\":{\"key\":\"rk_...\"},\"platform\":\"$PLATFORM\"}"
```

## 2. Verify the credential (and the backend)

```bash
curl -s "$PAY/products/?limit=1" -H "$AUTH"
```

- `200` → ready.
- `400` with a self-describing message → credential missing; do step 1.
- `502` → Stripe rejected the stored key (typo / wrong mode) — re-save it.
- `404` → either the platform backend predates the Stripe proxy/paywall
  (needs ibl-dm-pro ≥ PR #2977) or `$USERNAME` is not a member of
  `$PLATFORM`. Fix before continuing.

## 3. Create the product, tagged for this app

```bash
curl -s -X POST "$PAY/products/" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"<App> access","metadata":{"app":"<slug>"}}'
```

`metadata.app` is what the DM enforces at checkout — it must equal the app's
`PAYWALL_APP_SLUG` exactly (a price on an untagged product cannot mint
access).

## 4. Create price(s)

One-time:

```bash
curl -s -X POST "$PAY/prices/" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"product":"prod_...","unit_amount":2900,"currency":"usd"}'
```

Subscription — add `"recurring":{"interval":"month"}` (or `"year"`).
Checkout mode (payment vs subscription) follows the price type
automatically.

## 5. Capture display data

```bash
curl -s "$PAY/prices/<price_id>/" -H "$AUTH" | jq '{unit_amount, currency, recurring}'
```

Fill the `PRICES` constant in `app/paywall/page.tsx` from this (re-run steps
4–5 whenever prices change — display data is deliberately duplicated).

## 6. Write the app env

Append to `.env.local`:

```bash
PAYWALL_PRICE_IDS=price_xxx,price_yyy
PAYWALL_APP_SLUG=<slug>
```

## 7. Who paid (admin reporting)

```bash
curl -s "$PAY/paywall/payments/?app=<slug>" -H "$AUTH" | jq '{count, results: [.results[] | {username, mode, status, amount_total, currency}]}'
```

Filter a single buyer with `&username=<name>`. Rows are the DM's own
records — no Stripe calls; subscriptions carry the last observed status and
refresh on every uncached access check.

## Error table

| Status | Meaning | Fix |
|---|---|---|
| 400 | Missing credential, or actionable input problem (wrong app tag, disallowed redirect host, bad body) | Read the body — it says exactly what to change |
| 404 | Backend predates the paywall endpoints, or path user not a platform member | Upgrade ibl-dm-pro / fix `USERNAME` |
| 429 | Stripe rate limit (passed through) | Wait `Retry-After` seconds, retry |
| 502 | Stripe rejected the stored key | Re-save a valid `rk_` key |

## Setup verify

- [ ] `GET $PAY/products/?limit=1` → 200
- [ ] The product carries `metadata.app == <slug>` and is active
- [ ] Each price in `PAYWALL_PRICE_IDS` is active (`GET $PAY/prices/<id>/`)
- [ ] Both `PAYWALL_*` lines present in `.env.local`
- [ ] `GET $PAY/paywall/access/?app=<slug>` returns
      `{"has_access": false, …}` for a fresh user — a JSON answer, not a 404
