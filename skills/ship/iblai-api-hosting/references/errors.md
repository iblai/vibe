# Hosting error surface

Every status a caller can get, what produces it, and what to do about it. Error
bodies below use placeholder messages — the wording is not a stable contract, so
branch on the status and the shape, never on the text.

## Body shapes

Three envelopes are in play:

| Shape | Produced by |
|---|---|
| `{"error": "<message>"}` | The hosting layer's own refusals. |
| `{"error": "<message>", "code": "<provider code>"}` | A provider failure relayed through. |
| `{"<field>": ["<message>"]}` | Request validation — the key is the offending field. |
| `{"detail": "<message>"}` | Framework-level auth, not-found and throttling. |

## Common statuses

| Status | Condition | What to do |
|---|---|---|
| 400 | `provider` was sent with a value other than `vercel`. | Drop the param; it defaults correctly. |
| 400 | A request field failed validation. The body names the field. | Fix the field. |
| 400 | No hosting account is configured for the organization. | An organization admin must configure hosting. The caller cannot fix this by retrying. |
| 401 | No credential, or an unrecognised one. | Authenticate. Depending on which scheme claims the challenge you may see `403` instead. |
| 403 | The caller is not an organization admin of `{org}`. | This family is admin-only. Granting the RBAC verbs does **not** lift this. |
| 403 | The caller is an admin but the RBAC verb is not held. | Ask for the verb from the table in the skill. |
| 404 | No such project for that `{org}` / `{username}` / `{pk}` combination. | Check the id. Note an unauthorized caller gets `403` before the lookup runs, so `404` never leaks which ids exist. |
| 404 | On deploy: `{username}` is not a member of the organization. | The owner must be a member first. |
| 429 | ibl.ai is throttling the caller. Body is `{"detail": ...}`, with `Retry-After`. | Slow down. |
| 502 | The hosting provider rejected the stored credential, or was unreachable. | See *Provider translation* below. |

## Deploy-specific statuses

`POST deployment/` evaluates its checks in a fixed order, which matters when a
request is wrong in more than one way:

1. `provider` → `400`
2. Authorization → `403`
3. Field validation (`project` slug, `deployment_hash`, zip size, `framework`) → `400`
4. Owner membership → `404`
5. Hosting configured → `400`
6. **Balance check → `402`**
7. Archive structure → `400`
8. In-flight push → `409`
9. Name collision → `409`

So a caller whose balance is short **and** whose zip is malformed gets `402`, not
`400` — the archive is never parsed.

| Status | Condition | What to do |
|---|---|---|
| 402 | A per-deploy price applies and the owner's credit balance is short. Body carries `error`, `message`, `details` (`platform_key`, `available_credits`, `required_credits`, `deficit_credits`, and `spending_limit` when an auto-recharge cap is in play) and, for the account owner, `pricing_table`. | Add credits, then retry. This is a balance *check*; the actual charge happens after the push succeeds, so a deploy that fails later is not billed. |
| 409 | A push for this project is already in flight. Body carries `push_state` (`pending` or `uploading`). | Poll the detail endpoint until terminal, then retry. A stuck push self-clears after about 15 minutes. |
| 409 | The derived project name is already taken in this organization by another owner. | Choose a different `project` slug. |
| 415 | A JSON body was sent. | This endpoint is `multipart/form-data` only. |

## Domain-specific statuses

`GET dns/` and `DELETE dns/` validate their query params **before** the
authorization check, so an authenticated non-admin with a malformed query gets
`400` rather than `403`.

| Status | Condition | What to do |
|---|---|---|
| 400 | `project` missing or not a positive integer, or `domain` malformed. | Fix the query. `domain` must be lowercase punycode with an alphabetic TLD. |
| 400 | `DELETE dns/` without `domain`. | It is required, despite being optional on the list read. |
| 409 | The domain is already in use. | The reservation spans **all** ibl.ai app domains, not just hosting, so this can collide with an auth, agent or analytics domain. Nothing was sent to the provider and nothing was left behind — pick another name. |

## Provider translation

Every failure from the hosting provider passes through one translation step:

| Provider returned | Caller gets | Meaning |
|---|---|---|
| 401, 403 | **502**, `{"error", "code"}` | The organization's stored hosting credential is bad or revoked. This is a server-side configuration problem — retrying will not help. Escalate to whoever administers hosting. |
| 400, 404, 409 | **the same status**, `{"error", "code"}` | Relayed. A `409` on a domain attach usually means another account already holds it. |
| 429, 503 | **429**, `{"error", "code"}`, plus `Retry-After` when the provider supplied one | Rate limited upstream. Back off. A missing `Retry-After` still means rate limited. |
| anything else, or a network failure | **502**, `{"error", "code"}` | Transient. Retry with backoff. |

Note the caller never sees a `401` or `403` caused by the *server's* hosting
credential — those become `502`, so an auth error you receive is always about
*your* token.

**The read endpoints do not use this table.** On `GET deployment/` and
`GET deployment/{pk}/`, provider failures are caught earlier and become `200` with
`stale: true` plus `upstream_error`, or `extras_error`. The table applies to
`DELETE deployment/{pk}/`, `GET dns/?domain=`, `POST dns/` and `DELETE dns/` — the
write and live-inspect paths.

## Telling the two 429s apart

They need different handling and the body distinguishes them:

- `{"detail": ...}` — ibl.ai's own throttle. The caller is sending too fast. Back off
  and reduce concurrency.
- `{"error": ..., "code": ...}` — the hosting provider's limit, relayed. The upstream
  account is saturated; honour `Retry-After` if present.

Throttling applies to the organization-scoped endpoints only. The public boot lookup
is deliberately exempt.

## No retries anywhere

There are no server-side retries and no sleeps in this family. Every retry, backoff
and poll interval is the caller's responsibility.
