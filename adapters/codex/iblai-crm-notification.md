# iblai-crm-notification

> Reference for the three CRM notification event types (`CRM_PERSON_CREATED`, `CRM_DEAL_STAGE_CHANGED`, `CRM_PERSON_LINKED_TO_USER`) the ibl.ai CRM dispatches after a write commits — payload shapes, recipient routing modes (default / per-Platform configured), and how to surface them in your app. Use when the user mentions CRM notifications, lead/deal alerts, "who gets notified when a deal moves stages", recipient mode configuration, or wiring a CRM-only inbox; see /iblai-crm-overview for setup, /iblai-crm-lead-flow and /iblai-crm-deal-flow for the events' source skills, and /iblai-notification for the bell UI that actually renders these events. This is a REFERENCE skill — it documents the contract; it does NOT build the bell UI.

# /iblai-crm-notification

Reference skill for the three CRM notification event types. Documents
when each one fires, the context keys included in the payload, the
recipient-routing modes available per Platform, and where the developer
goes next to surface these events in the UI. This skill does NOT build
the notification bell — that is `/iblai-notification`.

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-auth`)
- MCP and skills set up (`iblai add mcp`)
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing,
  tell the user to download the template:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- The signed-in user holds a CRM role (`CRM Viewer` is enough to read
  inbox entries that target them; see `/iblai-rbac`)

## The three CRM notification types

Every CRM write that produces a notification routes through exactly one
of these three event types. Full payload tables (every `context` key)
live in
[`references/notification-types.md`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-crm-notification/references/notification-types.md).

| `event_type` | Fires when | Source skill | Default recipients |
|---|---|---|---|
| `CRM_PERSON_CREATED` | A person row is created via any path — REST `POST /persons/`, the Django admin, or bulk import | `/iblai-crm-lead-flow` | Platform admins + `person.owner` |
| `CRM_DEAL_STAGE_CHANGED` | A deal moves between stages via `POST /deals/{id}/move-stage/`, `POST /deals/{id}/won/`, or `POST /deals/{id}/lost/`. No-op transitions (destination stage equals current stage) are SUPPRESSED — no notification | `/iblai-crm-deal-flow` | Platform admins + `deal.owner` |
| `CRM_PERSON_LINKED_TO_USER` | A person is bound to a Platform user — either by explicit `POST /persons/{id}/link-user/` or implicitly by the auto-link signal when a new user registers with a matching email | `/iblai-crm-lead-flow` | Platform admins + `person.owner` |

"Object owner" is `person.owner` for the two person-scoped events and
`deal.owner` for the stage-change event. If the owner field is unset on
the triggering object, the configured recipient mode decides whether to
fall back to admins or drop the notification — see `## Recipient routing`
below.

## After-commit dispatch

All three event types dispatch **asynchronously after the writing
transaction commits**. The CRM signal is observed inside the request, but
the actual notification send fires from a post-commit hook on the
database transaction. The practical consequences:

- A write that rolls back — failed validation, database constraint, a
  `move-stage` call that raises mid-transition — produces no
  notification. The signal is observed, the dispatch is not.
- By the time a recipient sees the email, push entry, or inbox row, the
  underlying record is durably on disk. There are no ghost notifications
  for state that never persisted.
- Context keys are snapshotted at signal time from the live object. A
  template that references `{{ deal_lead_value }}` reads the value as it
  stood the moment the stage transition committed; later edits to the
  deal do not re-render or re-send.

Cross-reference: this is the same after-commit rule the [System Overview](../../../docs/developer/applications/crm.md#2-system-overview) "Side
Effects" block describes, and it is shared with the audit `Activity` row
that `move-stage`/`won`/`lost` writes alongside the notification (see
`/iblai-crm-activity`).

## Recipient routing

Every CRM notification template — and any notification type that opts
into the shared recipients pipeline — can be configured per Platform
with one of five recipient modes:

| Mode | Effect |
|---|---|
| `platform_admins_only` | Deliver to active Platform admins only. The object's owner is ignored. |
| `object_owner_only` | Deliver to the object's owner. If the owner field is unset, fall back to Platform admins so nothing is silently dropped. |
| `object_owner_only_strict` | Deliver to the object's owner only. If the owner is unset, no one is notified. Use when the notification is meaningless without an owner. |
| `platform_admins_and_object_owner` | **Default.** Both audiences receive the notification, deduplicated so an admin who is also the owner does not get two copies. |
| `custom` | Deliver to a hand-picked list of users, user groups, or RBAC role-policy holders. Admins and the owner are NOT implicitly included. |

When the mode is `custom`, the template's `recipients_custom_recipients`
field holds a list of dicts. Each entry takes one of three shapes:

```json
{ "type": "user",        "id": 123 }
{ "type": "user_group",  "id": 7 }
{ "type": "rbac_policy", "policy_name": "CRM Manager" }
```

Entries compose freely — a single list can mix individual users, groups,
and policy holders. The resolver expands each entry, unions the results,
deduplicates, and runs the active-Platform-membership filter as a final
gate. Stale entries (departed users, reassigned policies, drained
groups) simply contribute zero recipients on that dispatch.

Recipient configuration lives on the **notification template, not the
CRM models**. Changing it for `CRM_DEAL_STAGE_CHANGED` on a given
Platform is a `PATCH` against that Platform's template for that type,
setting `recipients_recipient_mode` and (if `custom`) populating
`recipients_custom_recipients`. The CRM does not add a separate API
surface for this — the same template-management endpoints documented in
`/iblai-notification` handle these three types alongside every other
notification type on the platform. This skill does NOT modify those
endpoints; it just documents which event types route through them.

Full mode table, custom-shape examples, the change-recipients workflow,
and the active-membership filter rules are in
[`references/notification-types.md`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-crm-notification/references/notification-types.md).

## Channels

Email delivery is wired by default for all three CRM event types.
Per-user notification preferences are honored by the underlying delivery
machinery — the CRM does not bypass them. Additional channels (in-app
inbox feed, push notification) follow the template's channel
configuration, inspected and changed via the same templates API.

The **in-app bell + notification center** that surfaces inbox entries is
NOT in scope for this skill. Send the developer to `/iblai-notification`
for the drop-in `<NotificationDropdown>` and `<NotificationDisplay>`
components.

## Consuming the events in your UI

This is a reference skill. To actually show a user the three CRM event
types in the browser:

1. Install the bell + center via `/iblai-notification`. That skill ships
   `components/iblai/notification-bell.tsx` and the
   `<NotificationDisplay>` page surface (Inbox + Alerts tabs).
2. The bell's inbox list is a standard notification feed — every
   delivered notification carries an `event_type` matching one of the
   three values from the table above. Filter the inbox query to those
   three values (or any subset) when you want a CRM-only inbox view.
3. For deeper drill-down (clicking an inbox entry that says "Deal moved
   to Negotiation" and jumping to the kanban card), wire the
   `onViewNotifications` callback on `<NotificationDropdown>` to route
   to the deal detail page built by `/iblai-crm-deal-flow`.

## Verify

End-to-end smoke once the bell is wired:

1. From the kanban built in `/iblai-crm-deal-flow`, move a deal from one
   stage to another via `POST /deals/{id}/move-stage/`. Make sure the
   destination stage actually differs from the current one (same-stage
   moves are suppressed and produce nothing).
2. Within a few seconds, confirm a `CRM_DEAL_STAGE_CHANGED` row appears
   in the inbox bell installed by `/iblai-notification` for the deal's
   owner.
3. Open the deal's activity timeline (`/iblai-crm-activity`) and confirm
   the corresponding audit `Activity` row exists with `type=note`,
   `done=true`, `title="Stage changed"`. The notification and the audit
   row are written together — if one is missing while the other is
   present, the transaction split unexpectedly and is worth filing.
4. Re-run the same `move-stage` call with `stage_code` set to the
   destination it just reached. The API should return the deal
   unchanged, no new audit row, and no new notification.

Run `/iblai-ops-test` before reporting done.

## Related skills

- `/iblai-crm-overview` — setup, RBAC, seeded defaults
- `/iblai-crm-lead-flow` — source of `CRM_PERSON_CREATED` and `CRM_PERSON_LINKED_TO_USER`
- `/iblai-crm-deal-flow` — source of `CRM_DEAL_STAGE_CHANGED`
- `/iblai-notification` — bell UI + notification center that consumes these events
- `/iblai-rbac` — required CRM roles
- `/iblai-auth` — token wiring