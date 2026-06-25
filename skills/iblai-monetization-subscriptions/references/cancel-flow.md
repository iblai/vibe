# cancel-flow.md — branching on the cancel response

The cancel mutation returns ONE of two payloads depending on the subscription
type. Branch on which key is present — do not assume `portal_url` will always
be returned.

## Endpoints

> `{dm_url}` = your DM service host (e.g. `https://api.iblai.app/dm`). Auth
> header: `Authorization: Token <DM token>` — the **DM token**, not the
> AXD token; the AXD token returns `401`.

All paths confirmed live in the OpenAPI schema at
`{dm_url}/api/docs/schema/` (e.g.
`https://api.iblai.app/dm/api/docs/schema/`). Item-keyed endpoints expose
both canonical (`unique_id`-keyed) and composite forms — prefer canonical
for new client code; the shipped SDK still builds composite URLs.

| Method | Form | URL | Purpose |
|---|---|---|---|
| GET | **Canonical (recommended)** | `{dm_url}/api/billing/items/{item_unique_id}/subscription/` | Retrieve the current user's subscription to a specific item. |
| POST | **Canonical (recommended)** | `{dm_url}/api/billing/items/{item_unique_id}/subscription/cancel/` | Cancel the current user's subscription to an item. |
| GET | (platform-scoped, no canonical) | `{dm_url}/api/billing/platforms/{platform_key}/my-subscriptions/` | Paginated list of the current user's subscriptions on a Platform. |
| GET | Composite (legacy) | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/` | Composite form of subscription read. |
| POST | Composite (legacy) | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/` | Composite form of subscription cancel. |

All require `IsEdxAuthenticated` — the caller must be a logged-in user
with a valid DM token. There is no admin override and no public variant —
`ItemSubscriptionCancelView` is hard-locked to `request.user`. Force a
cancel-on-behalf-of-user via the Stripe Dashboard or a direct backend
admin tool.

## List response shape (`MySubscriptionsResponse`)

```jsonc
{
  "count": 12,
  "next_page": 2,
  "previous_page": null,
  "results": [
    {
      "unique_id": "0f3a…",
      "user_id": 42,
      "username": "ada",
      "email": "ada@example.com",
      "item_type": "mentor",
      "item_id": "0d2b…",
      "item_name": "Calculus Tutor",
      "status": "active",
      "price": {
        "id": "…",
        "name": "Pro Monthly",
        "amount": "19.00",
        "currency": "usd",
        "interval": "month",
        "features": [],
        "remark": "",
        "sort_order": 0,
        "is_active": true,
        "stripe_price_id": "price_…",
        "created_at": "…",
        "updated_at": "…"
      },
      "current_period_end": "2026-07-19T00:00:00Z",
      "cancel_at_period_end": false,
      "is_grandfathered": false,
      "created_at": "2026-04-19T00:00:00Z",
      "updated_at": "2026-06-19T00:00:00Z"
    }
  ]
}
```

`price.amount` is a **string** (DRF decimal). Pass it through `parseFloat`
before doing math — `Intl.NumberFormat` and `toFixed` both accept the string
form, but arithmetic does not.

## Query parameters (list)

| Name | Type | Notes |
|---|---|---|
| `status` | enum | `active`, `free`, `grandfathered`, `trialing`, `past_due`, `canceled`, `incomplete` |
| `item_type` | string | `mentor`, `course`, `program`, `pathway` |
| `search` | string | Server-side filter on `item_id` substring (`item_id__icontains`). The SDK's `MySubscriptionsParams` type lists `item_name?`, but the backend serializer (`SubscriptionListQPSerializer`) only honors `status`, `item_type`, and `search`. The `item_name` param is silently dropped — for text search, send `search`. |
| `page` | int | 1-indexed |
| `page_size` | int | Server default; PurchasesTab uses `8`. |

## Cancel response — two branches

The backend (`ItemSubscriptionCancelView` at
`billing/views.py:1885`) inspects the subscription and routes one of two ways.

### Branch A — immediate cancel

Triggered when the subscription has no `stripe_subscription_id` OR its
`stripe_subscription_id` starts with `one_time:`. Grandfathered subscriptions
usually land here because they have no Stripe subscription, but the routing is
keyed on `stripe_subscription_id`, not `is_grandfathered`. The view flips
`status → canceled`, stamps `canceled_at`, fires the `access_revoked`
notification, and returns the **full** `ItemSubscriptionSerializer(subscription).data`
— the entire 21-field subscription record, not a `{status, canceled_at, unique_id}`
summary.

```jsonc
{
  "unique_id": "0f3a…",
  "user_id": 42,
  "username": "ada",
  "email": "ada@example.com",
  "item_type": "mentor",
  "item_id": "0d2b…",
  "item_name": "Calculus Tutor",
  "status": "canceled",
  "price": { /* full price object */ },
  "current_period_start": "2026-05-19T00:00:00Z",
  "current_period_end": "2026-07-19T00:00:00Z",
  "trial_end": null,
  "cancel_at_period_end": false,
  "canceled_at": "2026-06-19T21:00:00Z",
  "is_grandfathered": false,
  "grandfathered_at": null,
  "billing_portal_url": null,
  "metadata": {},
  "created_at": "2026-04-19T00:00:00Z",
  "updated_at": "2026-06-19T21:00:00Z"
}
```

Render a success card ("Subscription Canceled — access has been revoked") and
return the user to the list.

### Branch B — Stripe Customer Portal redirect

Triggered for recurring subscriptions with a Stripe customer on file. The
backend mints a Stripe Customer Portal session and returns its URL.

```jsonc
{
  "portal_url": "https://billing.stripe.com/p/session/test_…"
}
```

Open it in a new tab; the actual cancel happens inside Stripe and is reflected
back via webhook. Do not poll — the `cancelSubscription` mutation already
invalidates the relevant tags so the next refetch will pick up the new state
once Stripe's webhook lands.

### Error responses

The cancel endpoint can also fail in three documented ways. Wrap the mutation's
`.unwrap()` call in a `try/catch` so each gets a distinct UX:

| Status | When | Body |
|---|---|---|
| `404` | No subscription exists for the calling user on `(item_type, item_id, platform)`. | DRF default `{ "detail": "Not found." }` |
| `400` | Recurring subscription has a `stripe_subscription_id` but is missing `stripe_customer_id`. | `{ "detail": "Missing Stripe customer ID for this subscription" }` |
| `500` | Stripe portal session creation throws. | `{ "detail": "Error creating customer portal: <error>" }` |

`404` typically means the local UI is stale — refetch `mySubscriptions`. `400`
is a data-integrity issue an end user cannot resolve; surface a "Contact
support" message. `500` is usually transient Stripe trouble; offer a Retry
that re-runs the mutation.

### Optional request body

```jsonc
{ "return_url": "https://app.example.com/iblai-profile" }
```

Only used when Branch B fires. If omitted, the backend falls back to the
HTTP `Referer` header, then to the Platform root. Pass `window.location.href`
when you want the user dropped back exactly where they were.

## Branching pattern

```ts
try {
  const result = await cancelSubscription({
    platform_key,
    item_type: sub.item_type,
    item_id: sub.item_id,
    ...(isRecurring ? { return_url: window.location.href } : {}),
  }).unwrap();

  if (result.portal_url) {
    // Branch B — open the Stripe portal
    window.open(result.portal_url, '_blank');
  } else if (result.status === 'canceled') {
    // Branch A — show success card and refresh list
    toast.success('Subscription canceled');
  }
} catch (err: any) {
  // err.status is the HTTP status; err.data is the parsed body
  if (err.status === 404) {
    toast.error('Subscription not found — refreshing list.');
    // refetch mySubscriptions
  } else if (err.status === 400) {
    toast.error('This subscription is in an inconsistent state. Contact support.');
  } else if (err.status === 500) {
    toast.error('Stripe is unavailable — try again in a moment.');
  } else {
    toast.error('Cancel failed.');
  }
}
```

## Cache invalidation

`useCancelSubscriptionMutation` invalidates four tags:

- `mySubscriptions` — the Purchases list refetches.
- `itemSubscription` — the detail view picks up the new `status` / `canceled_at`.
- `accessCheck` — any gated content (PaywallModal, locked routes) flips back
  to locked. This is the load-bearing one — forget it and the UI keeps
  showing "you have access" until the next hard navigation.
- `subscribers` — the admin subscriber list (Analytics surface) reflects the
  churn in real time.

The invalidation fires regardless of which branch the response takes, so the
UI converges whether the cancel was immediate or portal-mediated.

## Status reference (backend `ItemSubscription.StatusChoices`)

| Status | Meaning |
|---|---|
| `active` | Paid, current period not yet ended. |
| `trialing` | Inside a Stripe free-trial window. |
| `free` | Free-tier access (no Stripe subscription). |
| `grandfathered` | Manually granted legacy access. Has no Stripe customer. |
| `past_due` | Payment failed; access still granted until Stripe finalizes dunning. |
| `canceled` | Terminal state. Access revoked. |
| `incomplete` | Initial Stripe state before first payment succeeded. |

The list filter dropdown in the SDK PurchasesTab exposes only `active`,
`trialing`, `canceled`, `past_due`. The other three remain server-side filters
the schema accepts but the SDK UI does not surface.
