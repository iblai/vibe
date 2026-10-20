# HeyGen error surface

Every status a caller can get from `providers/heygen/video/`, what produces it, and
what to do. Messages shown here are placeholders — wording is not a stable contract,
so branch on the status and the body shape, never on the text.

## Body shapes

| Shape | Produced by |
|---|---|
| `{"error": "<message>", "code": "<upstream code>"}` | A HeyGen failure translated by ibl.ai. |
| `{"detail": "<message>"}` | Framework-level auth, not-found and throttling. |
| `{"<field>": ["<message>"]}` | Request or query validation; the key names the field. |
| `{"error": "payment_required", …}` | Insufficient credits — see below. |

## Statuses

| Status | Condition | What to do |
|---|---|---|
| 400 | A body or query field failed validation. | Fix the field named in the body. |
| 400 | No HeyGen account is configured for the organization. | An organization admin must add one. Not fixable by retrying. |
| 400 | An uploaded asset is over the size cap. | Shrink the file. **This is a `400`, not a `413`** — a `413` could only come from a proxy in front of the API. |
| 401 | No credential, or an unrecognised one. | Authenticate. |
| 402 | A billable action, ibl.ai's HeyGen account is serving the call, and the balance is short. Checked **before** HeyGen is contacted. | Add credits and retry. See the full body below. |
| 403 | Acting on another user's `{username}` path without being an organization admin. | Use your own path. |
| 403 | Authenticated but the RBAC verb is missing. | Ask an admin for the verb. |
| 403 | The id in the path was created by a different user, or belongs to another organization. | Use your own resource. |
| 404 | HeyGen does not recognise the id. | Check the id. Remember `avatar_item.id` is a *look* id, not a group id. |
| 404 | The streaming action slug is not one of the seven. | Fix the slug — it is `keep-alive`, not `keep_alive`. |
| 404 | On a billable route, `{username}` is not a member of the organization. | Fix the path user. |
| 405 | Wrong method for the route. | — |
| 409 | HeyGen reported a conflict. | Relayed as-is; read `code`. |
| 429 | HeyGen rate-limited the call, **or** HeyGen was temporarily unavailable. Both arrive as `429`. `Retry-After` is set when HeyGen supplied one. | Back off. On session create it can also mean the account is at its concurrent-session limit. |
| 429 | ibl.ai is throttling the caller. Body is `{"detail": ...}`. | Slow down. |
| 502 | HeyGen rejected the server's stored key, returned a 5xx, or was unreachable. | Retry later. A persistent `502` means the organization's HeyGen configuration needs attention — the caller cannot fix it. |

## Upstream translation

ibl.ai does not pass HeyGen's status codes through faithfully. The mapping:

| HeyGen returned | Caller gets | Why it matters |
|---|---|---|
| 401, 403 | **502** | You never see an auth failure caused by the *server's* HeyGen key. A `401` you receive is always about your own ibl.ai token. |
| 503 | **429** | Upstream unavailability is presented as "back off", because that is the correct client behaviour either way. |
| 5xx, network failure | **502** | Transient. |
| 400, 404, 409 | same status | Relayed. |

## The `402` body

This is the standard ibl.ai insufficient-credit envelope:

```json
{
  "error": "payment_required",
  "message": "<a message explaining the balance is short>",
  "details": {
    "platform_key": "acme",
    "available_credits": 120,
    "required_credits": 500,
    "deficit_credits": 380
  },
  "pricing_table": {
    "pricing_table_id": "prctbl_…",
    "pricing_table_js": "https://js.stripe.com/v3/pricing-table.js",
    "publishable_key": "pk_…",
    "client_reference_id": "…"
  }
}
```

Variants you should handle:

- When an auto-recharge spending cap is in play rather than a flat empty balance,
  `details` gains `spending_limit` with `limit_usd`, `charged_usd`, `remaining_usd`
  and `period_ends_at` (ISO-8601 or `null`), and `message` says so.
- `pricing_table` is **absent** unless the authenticated caller owns the credit
  account. It can also be present with empty strings if billing configuration is
  unavailable. `client_reference_id` only appears for some organizations.
- When the user has no credit account at all, the body is just `error`, `message` and
  `details.platform_key`.
- `available_credits`, `required_credits` and `deficit_credits` are **credits, not
  USD** — converted by the account's own rate.

## Which endpoints can return `402`

Only these five:

- `POST voices/clone/`
- `POST voices/speech/`
- `POST avatar-groups/`
- `POST videos/`
- `POST streaming/sessions/`

Every read, `POST avatar-groups/{id}/consent/`, `POST assets/` and all seven streaming
control actions are free and never return `402`.

And only when **both** are true: a price is configured for that action, and the call
is being served by ibl.ai's HeyGen account. An organization using its own HeyGen key
pays HeyGen directly and is never charged credits here.

The check runs before HeyGen is contacted, so a `402` means nothing was generated.
Conversely the charge is recorded after a successful call — a call that fails
upstream is never billed.

## Ownership `403`s

Three route groups check the id against the user who created it:

- `avatar-groups/{group_id}/`, `…/looks/`, `…/consent/` — keyed on the **group** id
- `videos/{video_id}/`
- `streaming/sessions/{session_id}/{action}/`

Two behaviours to design around:

- An organization admin may act on any id owned **within their own organization**;
  across organizations it is still `403`.
- **An id with no ownership record is allowed through.** The gate only refuses ids it
  knows belong to someone else. An id that did not originate from this surface — or
  one whose create response carried no recognisable id — is not protected by it.
  Do not treat this gate as an authorization boundary for resources you did not mint
  here.

`voices/*`, `assets/`, `streaming/knowledge-bases/` and `streaming/avatars/` have no
ownership concept at all.
