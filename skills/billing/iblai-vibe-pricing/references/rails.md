# Rails B and C — endpoint quick reference

Everything below is documented in full by the skill named in each row; this file
only puts the two rails side by side.

## Rail B — app paywall on the org's own Stripe key

The app holds no platform key: the admin's setup page and the buyer's pay modal run on each
person's own session token (`Authorization: Token <dm_token>`), on their own username path.
Base: `…/dm/api/ai-mentor/orgs/{org}/users/{username}/providers/stripe/` — `payments/` (the
Stripe proxy) and `connect/` (Connect with Stripe).

| Step | Who, how | Call | Notes |
|---|---|---|---|
| Probe the Stripe source | admin | `GET connect/` | `source`: `key` (pasted `stripe` credential, wins) · `connected` · `null`; `publishable_key` |
| Link Stripe | admin, `/paywall/setup` | `POST connect/` `{return_url}` → `authorize_url` | Stripe returns through the platform with `?stripe_connect=connected` or `=error&reason=` |
| Create product + price | admin, the setup route | `POST payments/products/` (`metadata.app` = the app's slug), `POST payments/prices/` | the previous price is archived: `POST payments/prices/{id}/` `{"active": false}` |
| Record the price | admin, the setup route | `PUT …/core/orgs/{org}/metadata/` `apps.<slug>` | public read; the recorded price is the only one a member can buy |
| Checkout | member, the pay modal | `POST payments/paywall/checkout/` `{app, price_id, ui_mode: "embedded"}` | answers `client_secret`, `publishable_key`, `stripe_account` for Stripe.js |
| Access check | member | `GET payments/paywall/access/?app=<slug>[&session_id=]` | cached grants 60 s / denies 15 s; `stale: true` during a Stripe outage |
| Who paid | admin | `GET payments/paywall/payments/?app=<slug>` | ledger |

Skill: `/iblai-vibe-monetization-app-paywall` (installs `/paywall/setup` — the question, free /
one-time / monthly, and Connect with Stripe — `PaywallGate`, the `/paywall` page with Stripe's
embedded checkout in a modal, two admin routes and unit tests, from
`iblai-vibe-ops-init/assets/stripe-components/`). The agent never touches Stripe: the admin
answers and connects in the app.

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

Full REST: [iblai-api-billing](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/billing/iblai-api-billing/SKILL.md).
