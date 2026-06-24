# Checkout API

> `{dm_url}` = your DM service host (e.g. `https://api.iblai.app/dm`). Auth
> header for authenticated checkout: `Authorization: Token <DM token>` —
> the **DM token**, not the AXD token. Guest endpoints use `AllowAny`
> (no token attached).

Six endpoints create a Stripe Checkout Session for an item, plus one
callback endpoint that processes Stripe's redirect. All live under
`{dm_url}/api/billing/` and use the Connect destination-charge contract.

## The checkout endpoints — canonical first

| Endpoint | Form | Auth | When to use |
|---|---|---|---|
| `POST {dm_url}/api/billing/items/{item_unique_id}/checkout/` | **Canonical (recommended)** | `IsEdxAuthenticated` | Buyer is signed in and you have the paywall config's `unique_id`. |
| `POST {dm_url}/api/billing/items/prices/{price_unique_id}/checkout/` | **Canonical (recommended)** | `IsEdxAuthenticated` | Buyer is signed in and the URL pins a specific price (one-click upgrade, "Buy Pro" button). No body `price_id` needed — the URL fixes it. |
| `POST {dm_url}/api/billing/items/{item_unique_id}/checkout-guest/` | **Canonical (recommended)** | `AllowAny` | Anonymous buyer; you have the paywall config's `unique_id`. |
| `POST {dm_url}/api/billing/prices/{price_unique_id}/checkout-guest/` | **Canonical (recommended)** | `AllowAny` | Anonymous buyer with only a price uuid (e.g. a `/buy/{uniqueId}` shareable link). The backend derives Platform/item_type/item_id from the price. |
| `POST {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout/` | Composite (legacy) | `IsEdxAuthenticated` | Buyer is signed in; you already have the `(platform_key, item_type, item_id)` triple from context (e.g. the shipped `PaywallModal`). |
| `POST {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-guest/` | Composite (legacy) | `AllowAny` | Anonymous buyer; same triple available. |

**Canonical buyer routes 404 on disabled paywalls.** All four canonical
checkout views carry `require_enabled_paywall = True` — a request against a
paywall whose `is_enabled = False` returns
`404 {"detail": "Paywall configuration not found."}` *before* reaching
Stripe. Composite routes do not — they delegate to the parent view and
fail later. Prefer canonical so the failure mode is consistent.

Backend views (verified):

- Canonical: `ItemCheckoutByUniqueIdView`, `ItemCheckoutByPriceUniqueIdView`,
  `ItemGuestCheckoutByUniqueIdView` in `new_views.py` —
  `ConfigUniqueIdMixin` / `PriceUniqueIdMixin` resolve the UUID at dispatch
  and short-circuit. `ItemGuestCheckoutByPriceView` (`billing/views.py:1804`)
  is the by-price guest variant.
- Composite: `ItemCheckoutView` — `billing/views.py:1556`, `IsEdxAuthenticated`.
  `ItemGuestCheckoutView` — `billing/views.py:1751`, `AllowAny`, subclasses
  `ItemCheckoutView`.

## Request body (`CheckoutSessionCreateSerializer`, `billing/serializers.py:626`)

Shared by all three endpoints:

| Field | Type | Notes |
|---|---|---|
| `price_id` | UUID | `ItemPrice.unique_id` to charge. Required unless the URL already pins the price (the by-price endpoint). |
| `success_url` | URL (nullable) | Where Stripe sends the browser after successful payment. May be overridden server-side by `paywall_config.on_successful_payment` if set. |
| `cancel_url` | URL (nullable) | Where Stripe sends the browser if the buyer cancels. Falls back to the request's absolute root if omitted. |
| `email` | email (nullable) | Required for guest checkout only. Pre-fills Stripe Checkout's email field and is the dedup key for existing-subscription rejection. |

Serializer-level rules:

- `is_authenticated=False` context (guest) requires `email`.
- `price_resolved=False` context (anything except the by-price endpoint) requires `price_id`.

## Response (`CheckoutSessionResponseSerializer`, `billing/serializers.py:663`)

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_...",
  "session_id": "cs_test_...",
  "platform_key": "main"
}
```

The SDK type currently declares only `{ checkout_url, session_id }`; the wire also returns `platform_key` (the value the request resolved against). SDK type is missing this field.

On success the SDK's PaywallModal does `window.location.href = result.checkout_url`. The browser leaves your app and Stripe hosts the payment page.

## Stripe Connect destination-charge contract

Checkout sessions are created with destination charges: the buyer pays the Platform's connected Stripe account, and `application_fee_amount` routes the ibl.ai commission back to the marketplace. The split happens server-side inside `StripeConnectService().create_checkout_with_destination(...)` (`billing/views.py:1662-1665`). The SPA never computes or displays the fee — Stripe handles it.

Commission percentages are configurable per Platform and exposed on the Connect status response as `commission_percent` (a dict keyed by item type — mentor / course / program / pathway). See `/iblai-monetization-onboard` for the status endpoint.

Note: the SDK TypeScript type `StripeConnectStatusResponse.commission_percent` may not include all 4 keys (currently lists mentor/course only). Read defensively as `Record<string, number>`.

## `is_ready_for_payments` gate

Before creating the session the view checks the Platform's `stripe_connect_account`:

```python
connect_account = getattr(platform, "stripe_connect_account", None)
if not connect_account or not connect_account.is_ready_for_payments:
    raise ValidationError({"detail": "Platform payment system not configured"})
```

(`billing/views.py:1602-1604`) `is_ready_for_payments` requires `charges_enabled` AND `onboarding_complete` AND the account not be disconnected. DRF turns the `ValidationError` into a **400 Bad Request** with `{"detail": "Platform payment system not configured"}`. The SDK's `MonetizationTab` reads the same flag from the Connect status endpoint and disables the entire Paywall section client-side, so a healthy UI never sends a checkout request to an unready Platform — but you should still handle the 400 defensively.

## Existing-subscription rejection

Both checkout views run `_check_existing_subscription(...)` before creating the session:

- **Authenticated** (`views.py:1719-1730`) — keyed on `(user, item_type, item_id, platform)`. Returns **400** with `{"detail": "You already have an active subscription to this item", "subscription_id": "<uuid>"}`.
- **Guest** (`views.py:1777-1784`) — keyed on `(email, item_type, item_id, platform)`. Returns **400** with `{"detail": "An active subscription already exists for this email"}`.

The guest variant prevents a logged-out buyer from double-buying with the same email; the surface to render in the UI is "you already have this — sign in to view it".

## Checkout callback

```
# Canonical (recommended)
GET {dm_url}/api/billing/items/{item_unique_id}/checkout-callback/
GET {dm_url}/api/billing/items/{item_unique_id}/checkout-callback/{checkout_session_id}/

# Composite (legacy)
GET {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/
GET {dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/{checkout_session_id}/
```

All four shapes route to the same callback logic — `ItemCheckoutCallbackView`
(`billing/views.py:2257`, `permission_classes = [AllowAny]`) for composite,
`ItemCheckoutCallbackByUniqueIdView` (`new_views.py`) for canonical. The
session id can come from the URL path OR from `?checkout_session_id=` /
`?stripe_checkout_id=` query params (`views.py:2282-2284`). Stripe itself only redirects the buyer's browser here — this view always responds with `302 redirect` to the eventual `return_url` (default: the Platform root).

What it does:

1. Validate Platform + item.
2. Resolve the session id from path or query.
3. Read query params via `ItemCheckoutCallbackQPSerializer` (`return_url` only).
4. Look up the Stripe Checkout Session via `StripeGatewayService().get_checkout_session(...)` against the Platform's connected account. If missing → 404; if `status != "complete"` → 400.
5. Call `handle_item_checkout_completed(...)` to create/update the subscription synchronously — same path the `checkout.session.completed` webhook uses.
6. Append `email`, `platform_key`, `subscription_id` query params to `return_url` and `302` to it.

### Race with the webhook

The webhook `checkout.session.completed` and the callback land independently. Idempotency is enforced by the service layer (`billing/services/item_paywall.py:184`):

```python
subscription, created = ItemSubscription.objects.select_for_update(
    nowait=False
).get_or_create(...)
```

Whichever path arrives first creates the row; the second path takes the `not created` branch and only updates Stripe-side fields without re-firing side effects. The callback is safe to retry, and the buyer's return-to-site UX is unblocked even if the webhook is delayed.

## SDK conventions for `success_url` / `cancel_url`

The PaywallModal hardcodes both to the current page:

```ts
const result = await createCheckout({
  platform_key: platformKey,
  item_type: itemType,
  item_id: itemId,
  price_id: price.id,
  success_url: window.location.href,
  cancel_url: window.location.href,
}).unwrap();

if (result.checkout_url) {
  window.location.href = result.checkout_url;
}
```

(SDK source: `packages/web-containers/src/components/modals/paywall-modal.tsx`.) This is correct for the in-app modal flow — the buyer returns to whatever page they were on, the `useCheckAccessQuery` re-runs on remount, and the now-unlocked content renders.

For a custom buy page (e.g. `/buy/{uniqueId}`), choose URLs deliberately:

- If `success_url` points back to the same buy page, the page will render the paywall again until the webhook lands (which invalidates the access-check cache) — typically <1s but unbounded by network. Set it to the unlocked content URL instead.
- Setting `cancel_url` back to the buy page is usually fine; the buyer just lands on the listing again with no charge.

## Verifying the contract before you ship

- Schema: `grep -E "checkout_create|checkout_guest_create|checkout_callback_retrieve" /tmp/iblai_schema.yaml` lists the four operations. Confirm shapes in the `components.schemas.CheckoutSessionCreate` and `CheckoutSessionResponse` blocks.
- Backend: read `billing/views.py:1556-1850` for the three checkout views and `:2257-2360` for the callback.
- SDK: `gh api repos/iblai/ibl-web-frontend/contents/packages/web-containers/src/components/modals/paywall-modal.tsx --jq '.content' | base64 -d` shows the `success_url = cancel_url = window.location.href` hardcoding.

## Related skills

- [/iblai-monetization](../iblai-monetization) — overview, schema-validation pattern.
- [/iblai-monetization-onboard](../iblai-monetization-onboard) — `is_ready_for_payments`, commission_percent source.
- [/iblai-monetization-configure](../iblai-monetization-configure) — paywall + price CRUD that produces the `price_id` you charge.
- [/iblai-monetization-subscriptions](../iblai-monetization-subscriptions) — what the subscription row looks like after callback / webhook completes.
