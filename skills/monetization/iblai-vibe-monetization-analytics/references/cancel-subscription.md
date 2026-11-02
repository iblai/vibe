# Self-service CancelSubscription helper

Detail for [`/iblai-vibe-monetization-analytics`](../SKILL.md) Step 7.

The SDK has a stand-alone `CancelSubscription` component, but
`@iblai/iblai-js` 2.36.2 does **not export it** from `web-containers` or
`web-containers/next`, so build the same form in your app from
`useLazyGetItemSubscriptionQuery` (the lookup) and
`useCancelSubscriptionMutation` — the same mutation the user-side
`PurchasesTab` uses.

```tsx
'use client';
import { useState } from 'react';
import {
  useCancelSubscriptionMutation,
  useLazyGetItemSubscriptionQuery,
} from '@iblai/iblai-js/data-layer';

export function CancelSubscription({ platformKey }: { platformKey: string }) {
  const [itemType, setItemType] = useState('mentor');
  const [itemId, setItemId] = useState('');
  const [lookUp, { data: sub, error }] = useLazyGetItemSubscriptionQuery();
  const [cancel, { isLoading }] = useCancelSubscriptionMutation();
  const item = { platform_key: platformKey, item_type: itemType, item_id: itemId };

  const onCancel = async () => {
    const result = await cancel({ ...item, return_url: window.location.href }).unwrap();
    if (result.portal_url) window.location.assign(result.portal_url);
    // otherwise result.status === 'canceled': it ended immediately
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); lookUp(item); }}>
      <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
        {['mentor', 'course', 'program', 'pathway'].map((t) => <option key={t}>{t}</option>)}
      </select>
      <input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="Item ID" />
      <button type="submit">Look Up</button>
      {error && <p>No subscription found.</p>}
      {sub && (
        <button type="button" disabled={isLoading} onClick={onCancel}>
          Cancel {sub.item_name}
        </button>
      )}
    </form>
  );
}
```

Pick an `item_type`, enter an `item_id`, click **Look Up**, and the
caller's subscription to that item appears with a cancel button. Put a
confirmation in front of the cancel call; the SDK component makes the
user type one.

**This cancels the CALLER's own subscription, not someone else's.**
`POST …/items/{item_type}/{item_id}/subscription/cancel/` acts only on the
signed-in caller; there is no `user_id` parameter and no admin override,
and an item the caller holds no subscription to returns `404`
(`{"detail": "Not found."}`).
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
