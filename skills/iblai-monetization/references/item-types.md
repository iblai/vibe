# Item types — the universal key

Every paywall artifact in the system — `ItemPaywallConfig`, `ItemPrice`,
`ItemSubscription`, the checkout URL, the access-check URL — addresses
itself with the same triple: **`(item_type, item_id, platform)`**.

There is no foreign key from the paywall to a domain model. The two
strings are stored loose:

| Field | Type | Source |
|---|---|---|
| `item_type` | `CharField(max_length=50, db_index=True)` | `billing/models.py:94` |
| `item_id` | `CharField(max_length=255, db_index=True)` | `billing/models.py:99` |
| `platform` | `FK(core.Platform, on_delete=CASCADE)` | `billing/models.py:104` |

That looseness is the point: any item — built-in or operator-defined —
can be sold without a schema change. It is also why the `custom:` prefix
exists.

## Why a triple, not a single ID

A Platform-A mentor and a Platform-B mentor with the same UUID are
independent products with independent paywalls, independent prices, and
independent subscribers. The Platform leg of the triple gives each
Platform its own private namespace.

## Built-in types

The enum lives at `billing/models.py:62-71` as `ItemType(TextChoices)`, with the `BUILT_IN_ITEM_TYPES` frozenset declared at module scope right after the class:

```python
class ItemType(models.TextChoices):
    MENTOR = "mentor", "Mentor"
    COURSE = "course", "Course"
    PROGRAM = "program", "Program"
    PATHWAY = "pathway", "Pathway"

BUILT_IN_ITEM_TYPES = frozenset(choice.value for choice in ItemType)
```

Each built-in type has a registered strategy class. The registry is
populated at app-ready time in `billing/apps.py:33-43`:

| `item_type` | Strategy class | File |
|---|---|---|
| `mentor` | `MentorCheckoutStrategy` | `billing/services/strategies/mentor.py` |
| `course` | `CourseCheckoutStrategy` | `billing/services/strategies/course.py` |
| `program` | `ProgramCheckoutStrategy` | `billing/services/strategies/program.py` |
| `pathway` | `PathwayCheckoutStrategy` | `billing/services/strategies/pathway.py` |
| anything else | `GenericCheckoutStrategy` | `billing/services/strategies/generic.py` |

The strategy contract is defined on `ItemCheckoutStrategy` in
`billing/services/strategies/base.py:26-83` — `resolve_item`,
`post_checkout`, `get_item_name`, `get_stripe_product_data`,
`post_enable_paywall`, `post_access_revoked`. Views dispatch via
`get_strategy_or_generic(item_type)` (`base.py:97-104`) so unknown types
never crash — they just route to the generic fallback.

## Custom items — the `custom:` prefix

Custom item types are namespaced with a literal `custom:` prefix so they
can never collide with a future built-in. Normalization happens server
side in `billing/models.py:19-45` (`normalize_item_type`) and is called
on every `save()` of `ItemPaywallConfig`, `ItemSubscription`, and any
other model carrying an `item_type` column. Built-in slugs pass through
untouched; everything else returns `f"custom:{slug}"`.

The Item Details wizard step in
`packages/web-containers/src/components/profile/monetization/paywall-detail.tsx:130-170`
drives the create flow:

1. Calls `slugify()` from `paywall-utils.ts` (lines 5-13) on both the user-typed
   "Item Type" and "Item Name" strings — lowercase, trim, strip
   non-word chars, collapse whitespace/underscores/dashes to single `-`,
   strip leading/trailing `-`.
2. POSTs the paywall as **dormant** so the row exists but enforces
   nothing:
   - `is_enabled: false`
   - `allow_free_tier: false`
   - `trial_period_days: 0`
   - `grandfathering_strategy: 'free_forever'`
3. Sets `on_successful_payment` to the operator-supplied "Product URL"
   via `buildOnSuccessfulPaymentUrl({ ..., isCustom: true,
   customProductUrl })`.

The backend then prepends `custom:` on save and the wizard advances to
the Pricing step against the now-existing config.

## `item_id` constraints by type

| Type | `item_id` shape |
|---|---|
| `mentor` | UUID (the `Mentor.id`) |
| `course` | course key, e.g. `course-v1:Org+Course+Run` |
| `program` | UUID (resolved via `pathway`-style key parsing in `ProgramCheckoutStrategy`) |
| `pathway` | UUID (`Pathway.pathway_uuid`) |
| `custom:*` | operator-defined; slugified from the wizard's "Item Name" field |

Hard cap: 255 chars (`billing/models.py:99-103`).

## Uniqueness

Both core models enforce one row per triple per Platform:

- `ItemPaywallConfig` — `UniqueConstraint(item_type, item_id, platform)`
  (`billing/models.py:170-175`). One paywall per item per Platform.
- `ItemSubscription` — `UniqueConstraint(item_type, item_id, platform,
  user)` (`billing/models.py:406-411`). One subscription per user per
  item per Platform.

## `displayItemType` — the SDK rebrand

The product surface presents "mentor" as **"Agent"**. The mapping lives
in `paywall-utils.ts` (around lines 26-30):

```ts
export function displayItemType(itemType: string): string {
  const stripped = itemType.replace(/^custom:/i, '');
  if (stripped.toLowerCase() === 'mentor') return 'Agent';
  return stripped;
}
```

Behavior:

| Stored `item_type` | `displayItemType` returns |
|---|---|
| `mentor` | `Agent` |
| `course` | `course` |
| `program` | `program` |
| `pathway` | `pathway` |
| `custom:foo-bar` | `foo-bar` |

The rebrand is presentation-only — every API request and every database
row continues to use the literal `mentor`.

## `buildOnSuccessfulPaymentUrl` defaults

Defined in `paywall-utils.ts` (around lines 43-75). Takes `authURL`, `itemType`,
`itemId`, `platformKey`, and optional `isCustom` / `customProductUrl`.
Derives the public-host extension (`mentorai.{ext}`, `skillsai.{ext}`)
from the auth URL's hostname via `getAuthURLExtension` (around lines 32-41).

| Type | URL it builds |
|---|---|
| `isCustom: true` | `customProductUrl.trim()` (or `undefined` if blank) |
| `mentor` / `agent` (case-insensitive) | `https://mentorai.{ext}/platform/{platformKey}/{itemId}` |
| `course` | `https://skillsai.{ext}/courses/{itemId}` |
| `program` | `https://skillsai.{ext}/programs/{itemId}` |
| anything else (including `pathway`) | `undefined` — caller must supply a URL |

Note: `pathway` is **not** mapped by `buildOnSuccessfulPaymentUrl` — the
function returns `undefined`. Operators paywalling a pathway must set
`on_successful_payment` explicitly on the config.

## Strategy resolution at runtime

Every billing view that touches a single item calls
`get_strategy_or_generic(item_type)` to dispatch domain-specific logic:

- **`resolve_item(item_id, platform_key)`** — load the domain object
  (Mentor, Course, Program, Pathway) and return a `ResolvedItem`.
  Generic strategy looks up the `ItemPaywallConfig` row itself and
  synthesises the name from `item_name` or `f"{item_type}:{item_id}"`.
- **`post_checkout(subscription, checkout_data)`** — built-in
  strategies enroll the user in the domain model; generic strategy
  fires `item_purchased` and does nothing else
  (`generic.py:69-81`).
- **`post_enable_paywall(config, platform)`** — built-in strategies
  grandfather existing learners according to
  `config.grandfathering_strategy`; generic strategy returns `0`
  (`generic.py:114-123`) because there are no existing domain users to
  grandfather.
- **`post_access_revoked(subscription)`** — built-in strategies
  un-enroll; generic strategy is a no-op.

So a `custom:`-prefixed paywall transacts money correctly and emits a
signal listeners can hook, but it never performs enrollment — the
operator's `on_successful_payment` URL is the entire post-purchase
experience.

## Related skills

- /iblai-monetization — overview and index
- /iblai-monetization-configure — wizard, paywall, and pricing CRUD
- /iblai-monetization-checkout — access-check and checkout flows
- /iblai-monetization-subscriptions — subscription list and cancel
