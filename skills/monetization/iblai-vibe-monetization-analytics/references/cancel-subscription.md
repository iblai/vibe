# Self-service CancelSubscription helper

Detail for [`/iblai-vibe-monetization-analytics`](../SKILL.md) Step 7.

The SDK ships a stand-alone `CancelSubscription` component, but it is
**not currently re-exported** from `@iblai/iblai-js/web-containers` (the
public `exports` map only declares `.`, `./next`, `./sso`, `./styles`).
To use it standalone, either wait for the SDK to add an export, or copy
`packages/web-containers/src/components/profile/monetization/cancel-subscription.tsx`
from `iblai/ibl-web-frontend` into your app.

```tsx
import CancelSubscription from '@/components/monetization/cancel-subscription';

<CancelSubscription platformKey={currentTenant.key} />
```

The component renders an inline form: pick `item_type`
(`mentor` | `course` | `program` | `pathway`), enter an `item_id`, click
**Look Up**, and the matching subscription card appears with a
confirm-typing gate. Under the hood it uses
`useLazyGetItemSubscriptionQuery` for the lookup and
`useCancelSubscriptionMutation` — the same mutation the user-side
`PurchasesTab` uses.

**This cancels the CALLER's own subscription, not someone else's.**
`ItemSubscriptionCancelView` (`billing/views.py:1885`) is hard-locked to
`request.user`; there is no `user_id` parameter and no admin override.
Spoofing `(item_type, item_id)` only changes which of the caller's own
subscriptions is resolved. To force-cancel another user's subscription,
use the Stripe Dashboard.

**Branch on the response.** Recurring (`price.interval === 'month' | 'year'`)
returns `{portal_url}` — the caller must follow that URL to finish the
cancel in Stripe's portal. Non-recurring returns the full subscription
record with `status: 'canceled'` immediately. Copy this branch verbatim:

```ts
if (result.portal_url) {
  // open Stripe portal — recurring path
} else if (result.status === 'canceled') {
  // immediate cancel — show success
}
```
