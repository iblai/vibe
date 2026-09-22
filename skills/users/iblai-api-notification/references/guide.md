# Notification system guide

Concepts, the direct-send builder flow, channel setup, and lifecycle that
complement the endpoints in `SKILL.md` (`/iblai-api-notification`). All paths sit
under `https://api.iblai.app/dm/api/notification/v1/`; header
`Authorization: Api-Token $IBLAI_API_KEY`; `{org}` / `{platform_key}` = `$IBLAI_ORG`.

## How notifications happen

Event-driven. Two paths, same channels and the same template/toggle config:

- **Automatic** — platform events (enrollment, completion, credential, license,
  role change, …) fire the matching type. Each event passes four gates in order:
  (1) is the type enabled for the org? (2) which channels are configured?
  (3) which template applies — the org's customized copy or the inherited
  default? (4) who are the recipients?
- **Direct send** — you compose and send on demand via the notification-builder.

The **org type toggle** (`templates/{type}/toggle/`) is gate 1: disabled ⇒ no one
in the org receives that type. It is a separate record from template content
*and* from per-user preferences — toggling doesn't touch the template, and
resetting a template doesn't touch the toggle.

## Direct-send builder

Compose → target → preview → send. Org Admin or Department Admin. Endpoints are in
`SKILL.md`; the flow:

1. **`context/`** (GET) — discover the template ids, channel ids, and source
   types available to the org. Use these ids in the later steps.
2. **`validate_source/`** (POST) — check one source before committing: returns
   `valid_count`, `invalid_entries`, `sample_recipients`.
3. **`preview/`** (POST) — merge every source, **dedupe** recipients, create a
   build. Returns `build_id`, `count`, `warning`. Browse the full resolved list
   with `{build_id}/recipients/?search=&page=`.
4. **`send/`** (POST, confirm first) — deliver to the build. If `preview/` was
   given a future `process_on`, `send/` queues it for scheduled delivery instead.

**Recipient sources** — each `{ "type", "data" }`; combine freely, merged +
deduped at preview:

| `type` | `data` | Resolves to |
|---|---|---|
| `email` | comma-separated emails | that list (Django email validation) |
| `username` | comma-separated usernames | those org users |
| `platform` | org key | all users in the org |
| `csv` | multipart file upload | rows of a CSV with an `email` column header |
| `department` | department id (int) | active department members |
| `usergroup` | user-group id (int) | active group members |
| `pathway` | pathway id | suggested pathway members |
| `program` | program id | suggested program members |

For a `csv` source, send the request as multipart form-data (not JSON) with the
uploaded file in a `file_0` field; the other source types pass `data` as a JSON string.

**Duplicate detection.** Preview hashes recipients + template + channels
(SHA-256). If an identical notification went out in the last 24h, `preview/`
returns a `warning` and `send/` responds `"Similar notifications found"` without
resending.

**Send `message`:** `"Notifications sent"` (immediate) · `"Notifications queued"`
(scheduled, `process_on` future) · `"Similar notifications found"` (deduped, not
sent).

**Build status** (the build record's own state machine, separate from the send
message): `draft` (preview created) → `previewed` (recipients resolved) →
`sending` on send, or `queued` when `process_on` is future → `completed` (all
delivered) or `failed` (delivery error). A `queued` build moves to `sending` once
`process_on` is reached.

One preview body — custom content to two combined sources:

```json
{
  "channels": [1, 2],
  "template_data": { "message_title": "Heads up", "message_body": "Hi {{ username }}" },
  "sources": [
    { "type": "department", "data": 42 },
    { "type": "email", "data": "a@x.com,b@x.com" }
  ]
}
```

## Channels

- **Email (SMTP).** Test credentials with `config/test-smtp/` before switching
  production email — it opens a live SMTP connection and sends a real message.
  Gotcha: `use_tls` and `use_ssl` are **mutually exclusive** — `use_tls:true` with
  port 587, or `use_ssl:true` with port 465, never both true. `from_email`
  defaults to `smtp_username`. A failed test names its cause in `message` —
  authentication failure (bad username/password) vs connection failure (bad
  host/port).
- **Push (FCM).** `register-fcm-token/` only works when push is enabled for the
  org. Beyond `registration_id` + `name`, the register body also accepts `active`
  (default true), `cloud_message_type` (default `FCM`), `application_id` (default
  `ibl_fcm_app`).
- **In-app.** No setup — read via the notifications list/count endpoints in
  `SKILL.md`.

## Permissions

| Action | Role |
|---|---|
| Read/manage own notifications | authenticated user |
| List/customize templates, toggle types, test SMTP | Org Admin |
| Send direct notifications | Org Admin or Department Admin |

When RBAC is enforced a role check is **not** sufficient — the user must also hold
the resource-action grant: `Ibl.Notifications/Notification/{list,write,delete}`,
`…/NotificationTemplate/write`, `…/SMTP/action`.

## Lifecycle & status

Two independent state machines per notification:

- **Delivery** (email): `INITIATED` (send started) · `NONE` (no email attempted —
  push/in-app only) · `FAILED`.
- **User-facing:** `UNREAD` (default on delivery) ⇄ `READ`; `CANCELLED` is
  terminal (dismissed/revoked, cannot revert).

## Gotchas

- The notifications list returns **unread first**, then read in
  reverse-chronological order.
- Check `notifications-count/` before pulling the full list — skip the list when
  it's zero. Always paginate the list.
- Prefer `bulk-update/` over marking one-by-one.
- Test a template (`templates/{type}/test/`) before enabling it org-wide; disable
  types the org doesn't use.
- Errors: `401` bad/missing token · `403` insufficient role or RBAC grant · `404`
  check `org` / `username` / `notification_id` / `type` in the path · `400`
  malformed body.
