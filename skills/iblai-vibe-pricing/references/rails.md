# Rails B and C — endpoint quick reference

Everything below is documented in full by the skill named in each row; this file
only puts the two rails side by side.

## Rail B — app paywall on the org's own Stripe key

Base: `PAY=https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME/providers/stripe/payments`
Header: `Authorization: Api-Token $TOKEN` (the platform API token; the org's
`stripe` credential is used server-side by the platform, never by the app).

| Step | Call | Notes |
|---|---|---|
| Probe Stripe connection | `GET $PAY/products/?limit=1` | `200` ok · `400` no `stripe` credential · `502` key rejected · `404` backend too old |
| Create product | `POST $PAY/products/` `{"name":"<App> access","metadata":{"app":"<slug>"}}` | `metadata.app` must equal `PAYWALL_APP_SLUG` |
| Create price | `POST $PAY/prices/` `{"product":"prod_…","unit_amount":2900,"currency":"usd"[,"recurring":{"interval":"month"}]}` | one-time without `recurring` |
| Access check (app server, as the buyer) | `GET $PAY/paywall/access/?app=<slug>[&session_id=]` | cached grants 60 s / denies 15 s; `stale: true` during a Stripe outage |
| Checkout | `POST $PAY/paywall/checkout/` | allowlisted `price_id` |
| Who paid | `GET $PAY/paywall/payments/?app=<slug>` | ledger |

Skill: `/iblai-vibe-monetization-app-paywall` (installs `lib/paywall.ts`, two
route handlers, `PaywallGate`, `/paywall` pages, unit tests from
`iblai-vibe-ops-init/assets/stripe-components/`).

## Rail C — item-level monetization via Stripe Connect Express

Base: `{dm_url}/api/billing/…` with the signed-in user's **DM token**
(`Authorization: Token <dm_token>`) from the browser, or `Api-Token` server-side.

| Step | Call | Skill |
|---|---|---|
| Connect onboarding status / links | `…/api/service/platforms/{org}/stripe/connect/…` | `/iblai-vibe-monetization-onboard` |
| Paywall config + prices for an item | `GET/PUT …/billing/platforms/{org}/items/{item_type}/{item_id}/paywall/`, `…/paywall/prices/` | `/iblai-vibe-monetization-configure` |
| Public pricing (no auth) | `GET …/items/{item_type}/{item_id}/pricing/` | `/iblai-vibe-monetization-checkout` |
| Access check | `GET …/billing/access-check/{item_type}/{item_id}/` → `200` or `402` | same |
| Checkout (auth / guest) | `POST …/checkout/`, `…/checkout-guest/` | same |
| My subscriptions / cancel | `GET …/platforms/{org}/my-subscriptions/` | `/iblai-vibe-monetization-subscription` |
| Subscribers / revenue / paywalls overview | `GET …/platforms/{org}/{subscribers,revenue,paywalls}/` | `/iblai-vibe-monetization-analytics` |

Full REST: [iblai-api-billing](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-api-billing/SKILL.md).
