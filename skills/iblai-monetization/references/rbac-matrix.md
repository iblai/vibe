# Monetization RBAC matrix

> Throughout this file, `{dm_url}` resolves to the data-manager host (e.g.
> `https://api.iblai.app/dm`). The auth header is `Authorization: Token
> <DM token>` — the DM token, not the AXD token. Canonical (`unique_id`)
> and composite (`platform/type/id`) endpoints share the same
> `permission_classes`; the resolver mixin only injects URL kwargs at
> dispatch time, so the matrix below applies to both forms.

## TL;DR

Monetization uses **DRF permission classes**, NOT the custom RBAC decorator
stack the CRM family uses. There is no `Ibl.Monetization/*` action prefix.
Every endpoint pins exactly one of three classes:

- **`IsPlatformAdmin`** — caller must be admin on the Platform inferred from
  the URL's `{platform_key}` segment (or hold a Platform API key scoped to
  that Platform). Manager admins (`is_staff` / `is_superuser`) also pass.
- **`IsEdxAuthenticated`** — caller must be any active authenticated user
  (edX user, manager user, or student-token user). No Platform-membership
  check; the view enforces ownership of the record at the data layer.
- **`AllowAny`** — public, no auth required. On the SDK side these are the
  endpoints that set `skipAuth: true`. The view still validates input
  server-side (e.g. duplicate-email guard on guest checkout).

Class definitions: `core/permissions.py:115` (`IsEdxAuthenticated`),
`core/permissions.py:216` (`IsPlatformAdmin`).

## Full endpoint matrix

The "Canonical form" column gives the recommended `unique_id`-keyed URL; the
"Composite form" column gives the still-supported `(platform_key, item_type,
item_id)`-keyed URL. Both forms share the same permission class.

### Stripe Connect (platform-scoped only — no canonical alternative)

| Endpoint | Method | View class | Permission |
|---|---|---|---|
| `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/status/` | GET | `StripeConnectStatusView` | `IsPlatformAdmin` |
| `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/` | POST | `StripeConnectOnboardView` | `IsPlatformAdmin` |
| `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/onboard/refresh/` | POST | `StripeConnectOnboardView` (reused) | `IsPlatformAdmin` |
| `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/dashboard/` | GET | `StripeConnectDashboardLinkView` | `IsPlatformAdmin` |
| `{dm_url}/api/service/platforms/{platform_key}/stripe/connect/` | DELETE | `StripeConnectDisconnectView` | `IsPlatformAdmin` |

### Item-keyed (canonical + composite)

| Capability | Method | Canonical form (recommended) | Composite form (legacy) | View class | Permission |
|---|---|---|---|---|---|
| Paywall config | GET / PUT / DELETE | `{dm_url}/api/billing/items/{item_unique_id}/paywall/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/` | `ItemPaywallConfigView` / `ItemPaywallConfigByUniqueIdView` | `IsPlatformAdmin` |
| Paywall config (initial create) | POST / PUT | — (no `unique_id` yet) | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/` | `ItemPaywallConfigView` | `IsPlatformAdmin` |
| Prices list | GET / POST | `{dm_url}/api/billing/items/{item_unique_id}/paywall/prices/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/` | `ItemPriceListView` / `ItemPriceListByUniqueIdView` | `IsPlatformAdmin` |
| Price detail | GET / PUT / DELETE | `{dm_url}/api/billing/items/prices/{price_unique_id}/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall/prices/{price_id}/` | `ItemPriceDetailView` / `ItemPriceDetailByUniqueIdView` | `IsPlatformAdmin` |
| Public pricing | GET | `{dm_url}/api/billing/items/{item_unique_id}/pricing/` and `{dm_url}/api/billing/items/{item_unique_id}/public-pricing/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/pricing/` | `PublicItemPricingView` / `PublicItemPricingByUniqueIdView` | `AllowAny` |
| Access check (unscoped) | GET | `{dm_url}/api/billing/items/{item_unique_id}/access-check/` | `{dm_url}/api/billing/access-check/{item_type}/{item_id}/?platform_key=…` | `ItemAccessCheckView` / `ItemAccessCheckByUniqueIdView` | `IsEdxAuthenticated` |
| Access check (scoped) | GET | `{dm_url}/api/billing/items/{item_unique_id}/scoped-access-check/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/` | `ScopedItemAccessCheckView` / `ScopedItemAccessCheckByUniqueIdView` | `IsEdxAuthenticated` |
| Authenticated checkout | POST | `{dm_url}/api/billing/items/{item_unique_id}/checkout/` or `{dm_url}/api/billing/items/prices/{price_unique_id}/checkout/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout/` | `ItemCheckoutView` / `ItemCheckoutByUniqueIdView` / `ItemCheckoutByPriceUniqueIdView` | `IsEdxAuthenticated` |
| Guest checkout | POST | `{dm_url}/api/billing/items/{item_unique_id}/checkout-guest/` or `{dm_url}/api/billing/prices/{price_unique_id}/checkout-guest/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-guest/` | `ItemGuestCheckoutView` / `ItemGuestCheckoutByUniqueIdView` / `ItemGuestCheckoutByPriceView` | `AllowAny` |
| Checkout callback | GET | `{dm_url}/api/billing/items/{item_unique_id}/checkout-callback/[<session_id>/]` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/checkout-callback/[<session_id>/]` | `ItemCheckoutCallbackView` / `ItemCheckoutCallbackByUniqueIdView` | `AllowAny` |
| Subscription read | GET | `{dm_url}/api/billing/items/{item_unique_id}/subscription/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/` | `ItemSubscriptionView` / `ItemSubscriptionByUniqueIdView` | `IsEdxAuthenticated` |
| Subscription cancel | POST | `{dm_url}/api/billing/items/{item_unique_id}/subscription/cancel/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription/cancel/` | `ItemSubscriptionCancelView` / `ItemSubscriptionCancelByUniqueIdView` | `IsEdxAuthenticated` |
| Item subscribers | GET | `{dm_url}/api/billing/items/{item_unique_id}/subscribers/` | `{dm_url}/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscribers/` | `ItemSubscribersView` / `ItemSubscribersByUniqueIdView` | `IsPlatformAdmin` |

### Platform-scoped (no canonical alternative)

| Endpoint | Method | View class | Permission |
|---|---|---|---|
| `{dm_url}/api/billing/platforms/{platform_key}/my-subscriptions/` | GET | `UserAllSubscriptionsView` | `IsEdxAuthenticated` |
| `{dm_url}/api/billing/platforms/{platform_key}/paywalls/` | GET | `PlatformPaywallsView` | `IsPlatformAdmin` |
| `{dm_url}/api/billing/platforms/{platform_key}/subscribers/` | GET | `PlatformSubscribersView` | `IsPlatformAdmin` |
| `{dm_url}/api/billing/platforms/{platform_key}/revenue/` | GET | `PlatformRevenueView` | `IsPlatformAdmin` |

Source lines (re-verify before quoting in code):

- Billing composite views: `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/views.py`
  — `ItemPaywallConfigView`, `ItemPriceListView`, `ItemPriceDetailView`,
  `ItemAccessCheckView`, `ScopedItemAccessCheckView`, `ItemCheckoutView`,
  `ItemGuestCheckoutView`, `ItemGuestCheckoutByPriceView`,
  `ItemSubscriptionView`, `ItemSubscriptionCancelView`,
  `PublicItemPricingView`, `ItemSubscribersView`, `PlatformSubscribersView`,
  `PlatformPaywallsView`, `PlatformRevenueView`, `UserAllSubscriptionsView`,
  `ItemCheckoutCallbackView`.
- Billing canonical views: `web/ibl-dm-core-apps/ibl-dm-billing-app/billing/new_views.py`
  — `ConfigUniqueIdMixin`, `PriceUniqueIdMixin`, and 14 `*ByUniqueIdView`
  subclasses (one per item-keyed view above). The mixins resolve the
  `(platform_key, item_type, item_id)` triple from a UUID at dispatch and
  short-circuit `BaseItemPaywallMixin` helpers via cache.
- Billing URL map: `billing/urls/monetization.py` — composite routes under
  `urlpatterns`; canonical routes appended via `urlpatterns += unique_id_paths`.
- Stripe Connect views: `web/ibl-dm-core-apps/ibl-dm-multi-services-app/dl_iblai_services_app/views/stripe_connect.py`
  — `StripeConnectOnboardView` (`:35`), `StripeConnectStatusView` (`:92`),
  `StripeConnectDashboardLinkView` (`:119`), `StripeConnectDisconnectView`
  (`:155`).
- Stripe Connect URL map (incl. `/onboard/refresh/` reusing
  `StripeConnectOnboardView`):
  `web/ibl-dm-core-apps/ibl-dm-multi-services-app/dl_iblai_services_app/urls.py:356-380`.

## `IsPlatformAdmin` semantics

From `core/permissions.py:216`:

- **Manager users** (Django `User` with `is_staff` or `is_superuser`)
  always pass — they are the global admins.
- **edX users** must hold a `UserPlatformLink` where `is_admin=True` for
  the Platform identified by `platform_key` (or `platform_org`) in the URL.
  Lookup goes through `get_user_platform_link(user_id, platform_key=...)`.
- **Platform API keys** pass only when the key's scoped Platform matches
  the `platform_key` (or `platform_org`) in the URL.
- Anything else returns `False` → 403.

Implication: a Platform admin on Platform A cannot use that membership to
access Platform B's paywalls / prices / subscribers / revenue. The path's
`{platform_key}` is the scope — there is no cross-Platform escape hatch.

## `IsEdxAuthenticated` semantics

From `core/permissions.py:115`:

- Manager `User` → requires `is_authenticated`.
- `EdxUser` → requires `active=True`.
- Student-token (`AuthStudent`) → requires the wrapped internal user is
  active. This is what lets the student LMS bearer token reach checkout
  endpoints.
- Anything else → `False`.

These endpoints do **not** check Platform membership at the permission
layer. View code enforces ownership: e.g. `my-subscriptions/` and
`subscription/cancel/` filter / mutate by `request.user.id` so a
non-admin can only see / cancel their own subscriptions.

## Stripe Connect-specific guard (`StripeConnectPlatformOwnerMixin`)

All four Connect views inherit
`StripeConnectPlatformOwnerMixin` from
`dl_iblai_services_app/views/mixins.py:25`. On top of `IsPlatformAdmin`,
three of them (`onboard`, `dashboard`, `disconnect`) call
`self._validate_platform_owner_access(request, platform)` before doing
any work (`views/stripe_connect.py:66`, `:147`, `:185`).

What that adds:

- Rejects `platform.key == "main"` outright — the "main" Platform has no
  owner, so no Stripe Connect account.
- Resolves the canonical Platform owner via `get_platform_owner(...)` and
  requires the requesting `EdxUser`'s `id` to match the owner's `id`.
  Other Platform admins on the same Platform are blocked — Stripe Connect
  is owner-only, not admin-broadly.
- `StripeConnectStatusView` skips the strict owner check and instead
  routes through `enforce_can_sell_items(request, platform)` so any
  caller with the `Ibl.Billing/CanSellItems/action` policy can read
  status (used to render onboarding UI for non-owner admins).

## Guest checkout email validation (`AllowAny` ≠ no validation)

`ItemGuestCheckoutView` (`billing/views.py:1751`) and its
`ItemGuestCheckoutByPriceView` subclass (`:1804`) ship `AllowAny` and
clear `authentication_classes` so unauthenticated buyers can checkout.
They also override `get_permissions()` to short-circuit the
`RbacPermissionMixin` parent.

Server-side input checks still apply (`views.py:1777-1784`):

- `email` is required by `CheckoutSessionCreateSerializer`.
- `_check_existing_subscription(None, email, item_type, str(item_id),
  platform)` runs; on a hit the view returns
  `400 {"detail": "An active subscription already exists for this email"}`.
- Trial-day computation also keys off `email` so repeat guests don't
  abuse the free-trial window.

The frontend should still surface a friendly email-collection step before
calling the endpoint — the 400 path is the backend's defense, not the UX.

## 404 vs 403 (Platform isolation)

Records belonging to a different Platform return **404 Not Found**, never
403. Returning 403 would leak the existence of cross-Platform records to
the caller. This applies to:

- `paywall/`, `paywall/prices/`, `paywall/prices/{price_id}/` — looking
  up an item or price that exists under a different Platform's
  `paywall_config` returns 404.
- `subscribers/`, `subscription/`, `subscription/cancel/`,
  `my-subscriptions/` — subscriptions owned by another Platform are
  invisible.
- `revenue/`, `paywalls/`, `subscribers/` (Platform-level analytics) —
  scoping is by URL `{platform_key}`; results are filtered, never 403'd.

403 is reserved for the permission-class failures (wrong role) and for
the owner-only Stripe Connect mixin (right Platform, wrong user).

## Canonical-form 404s

The canonical (`unique_id`) resolver mixin raises DRF `NotFound` (404) when:

- the supplied `item_unique_id` matches no `ItemPaywallConfig` row;
- the supplied `price_unique_id` matches no active, non-deleted `ItemPrice`
  whose paywall is enabled;
- the canonical buyer route (`checkout`, `checkout-guest`, by-price variants)
  resolves a config whose `is_enabled = False` (the resolver enforces
  `require_enabled_paywall = True` — composite routes do **not** carry this
  gate).

All resolver 404s render as `Content-Type: application/json` with
`{"detail": "<message>"}` — never Django's HTML 404 page.

## See also

- `/iblai-monetization` — family index and SKILL overview.
- `/iblai-rbac` — generic RBAC primer (the CRM-style decorator stack
  monetization does NOT use).
- `/iblai-auth` — token wiring for `IsEdxAuthenticated` and
  `IsPlatformAdmin` requests in a Next.js app.
