# Commission interpretation

Detail for [`/iblai-vibe-monetization-analytics`](../SKILL.md) Step 3.

The commission ibl.ai takes per item type is on the Stripe Connect
status endpoint, NOT on the revenue response.

```tsx
import { useGetStripeConnectStatusQuery } from '@iblai/iblai-js/data-layer';

function CommissionTable({ platformKey }: { platformKey: string }) {
  const { data } = useGetStripeConnectStatusQuery({ platform_key: platformKey });
  // Treat as Record<string, number> — three layers disagree on which keys exist (see note below)
  const commission = (data?.commission_percent ?? {}) as Record<string, number>;
  const entries = Object.entries(commission);
  if (entries.length === 0) return null;
  return (
    <ul className="text-sm space-y-1">
      {entries.map(([itemType, pct]) => (
        <li key={itemType}>
          {itemType === 'mentor' ? 'Agent' : itemType}: {pct}%
        </li>
      ))}
    </ul>
  );
}
```

`commission_percent` has a **3-way divergence** — treat it as
`Record<string, number>` and iterate `Object.entries` defensively rather
than reading hardcoded keys:

| Layer | Keys declared |
|---|---|
| Backend wire | `mentor`, `course`, `program`, `pathway` (4) |
| OpenAPI schema component `ItemTypeCommission` | `mentor`, `course`, `program` (3 — no pathway) |
| SDK TypeScript type | `mentor`, `course` (2) |

The backend reads each percentage from per-Platform `Config` keys
(`STRIPE_ITEM_COMMISSION_PERCENT_MENTOR`, `_COURSE`, `_PROGRAM`,
`_PATHWAY`), so at runtime you may see up to four keys; never assume
exactly four are present. Render `mentor` as **"Agent"** to stay aligned
with the SDK's `displayItemType` helper —
see [/iblai-vibe-monetization → references/item-types.md](../../../monetization/iblai-vibe-monetization/references/item-types.md).

**Display informationally only.** Commission flows back to ibl.ai
automatically via Stripe Connect destination charges; do NOT subtract
from `sales_volume` to compute a "net" number unless explicitly asked.
