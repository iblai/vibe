# iblai-api-token

> Manage an organization's Platform API Tokens via the platform API — list, create (secret shown once), and delete Api-Tokens by name. Use when issuing or rotating the keys that authenticate ibl.ai API access.

# iblai-api-token

Manage the organization's **Platform API Tokens** — the keys that authenticate every
ibl.ai API call. List the tokens, create a new Api-Token (the secret is shown only
once), retrieve or update a token by name, and delete a token by name. Tokens are
`platform_key`-scoped, not agent-scoped.

A token's RBAC authority is controlled by its **`mode`**:

- **`owner`** (default) — the token resolves permissions using its creator's RBAC
  permissions. Simplest option; the token acts with the owner's authority.
- **`token_policies`** — the token carries its **own** fine-grained RBAC, independent
  of the owner. You attach specific RBAC policies/groups to the token, and only those
  determine what it can do. Use this to issue narrowly-scoped service tokens for an
  organization.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Token $DM_TOKEN` -- the session token
  (`dm_token` in `login.iblai.app` localStorage) of a signed-in org admin.
  These endpoints reject every `Api-Token`, valid or not, with `401`; see
  `/iblai-api-login` step 2 for reading `dm_token`.
- **Path vars:** `{org}` = `$IBLAI_ORG`.
- **Host:** these endpoints live under `…/dm/api/core/…`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`.

## Reads

- **GET** `https://api.iblai.app/dm/api/core/platform/api-tokens/?platform_key={org}&page={n}&page_size={size}` — list API keys. Pagination is opt-in: send `page_size` to get `{count, next_page, previous_page, results}`, where `next_page` / `previous_page` are page numbers (or `null`), not URLs; the published OpenAPI schema says `next` / `previous`, which is wrong. Without `page_size` the endpoint returns the full, unpaged list. The list view omits `policies`/`groups`.
- **GET** `https://api.iblai.app/dm/api/core/platform/api-tokens/{name}?platform_key={org}` — retrieve a single token, including its currently associated `policies` and `groups`.
- **GET** `https://api.iblai.app/dm/api/core/platform/api-tokens/field-permissions/?platform_key={org}` — report which RBAC-gated fields (`mode`, `policies_to_add`, `policies_to_remove`, `groups_to_add`, `groups_to_remove`) the caller may write. Returns `{field: {"write": bool}}`. Useful for building the create form. Gated on create access.

## Writes

- **POST** `https://api.iblai.app/dm/api/core/platform/api-tokens/` — create a token (returns the secret only once):
  ```json
  {
    "name": "string (required)",
    "platform_key": "{org} (required)",
    "expires_in": "duration, e.g. \"2592000\" seconds or \"30 00:00:00\" (optional; omit for no expiry)",
    "mode": "owner | token_policies (optional, default 'owner')",
    "policies_to_add": "[int] policy IDs (optional, mode=token_policies only)",
    "groups_to_add": "[int] group IDs (optional, mode=token_policies only)"
  }
  ```
  `username`, `key`, `created`, and `expires` are read-only: the server sets
  them and ignores them on input. Expiry is set only through `expires_in`
  (`[DD] [HH:[MM:]]ss[.uuuuuu]`); a body that sends only `expires` mints a key
  that never expires.
- **PATCH** `https://api.iblai.app/dm/api/core/platform/api-tokens/{name}?platform_key={org}` — update a token's `mode` and its policy/group associations:
  ```json
  {
    "mode": "owner | token_policies",
    "policies_to_add": "[int] policy IDs",
    "policies_to_remove": "[int] policy IDs",
    "groups_to_add": "[int] group IDs",
    "groups_to_remove": "[int] group IDs"
  }
  ```
- **DELETE** `https://api.iblai.app/dm/api/core/platform/api-tokens/{name}?platform_key={org}` — delete a key by name. Destructive — confirm with the user first.

## RBAC-scoped fields

`mode` and the four relation fields (`policies_to_add`, `policies_to_remove`,
`groups_to_add`, `groups_to_remove`) are **privileged**: writing them needs
field-level RBAC write access (`Ibl.Core/ApiTokens/*/write`), separate from ordinary
create/update access. Constraints the server enforces:

- Policies/groups can only be set when `mode` is `token_policies`; sending them with
  `owner` mode is rejected.
- Referenced policies/groups must belong to the token's platform (the organization),
  otherwise the request is rejected.
- **No escalation:** you cannot grant a token more authority than you hold yourself —
  each candidate policy (including those reached via `groups_to_add`) must be a subset
  of the granter's own permissions.
- A `token_policies` token does **not** inherit the owner's staff/superuser flags
  (fail-closed).

## Examples

Create a basic (owner-mode) Platform API Token named `prod-integration`. The
secret (`key`) is shown only once; write it straight to `.env.local` so it
never lands in the terminal or a transcript:

```bash
curl -s -X POST \
  "https://api.iblai.app/dm/api/core/platform/api-tokens/" \
  -H "Authorization: Token $DM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "prod-integration",
    "platform_key": "'"$IBLAI_ORG"'"
  }' \
  | python3 -c 'import json,sys; print("IBLAI_API_KEY=" + json.load(sys.stdin)["key"])' \
  >> .env.local
```

Create an RBAC-scoped token for the organization — its own policies/groups decide what it
can do, independent of the creator:

```bash
curl -s -X POST \
  "https://api.iblai.app/dm/api/core/platform/api-tokens/" \
  -H "Authorization: Token $DM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "scoped-service-token",
    "platform_key": "'"$IBLAI_ORG"'",
    "mode": "token_policies",
    "policies_to_add": [12, 34],
    "groups_to_add": [5]
  }' \
  | python3 -c 'import json,sys; print("SCOPED_API_KEY=" + json.load(sys.stdin)["key"])' \
  >> .env.local
```

Re-scope an existing token's policies:

```bash
curl -X PATCH \
  "https://api.iblai.app/dm/api/core/platform/api-tokens/scoped-service-token?platform_key=$IBLAI_ORG" \
  -H "Authorization: Token $DM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "token_policies",
    "policies_to_add": [56],
    "policies_to_remove": [12]
  }'
```

## Notes

- The create response returns the token secret (`key`) **only once** —
  write it straight to a gitignored server-side env file (`.env.local`),
  never print it; it cannot be retrieved again afterward.
- `/iblai-api-login` uses this same `POST …/platform/api-tokens/` endpoint to mint
  the Api-Token it stores as `IBLAI_API_KEY`.
- Retrieve, update, and delete are by token **name** (not id), and are scoped to the
  org via `platform_key={org}`.
- `policies`/`groups` are returned only on detail responses (retrieve/create/update),
  not in the list view.
- The agent **API** tab (`/iblai-vibe-agent-api`) is a UI over these same
  org-wide tokens: list (10 per page), create, and delete by name.