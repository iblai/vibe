# iblai-api-profile-metadata

> Read and write per-user, per-organization metadata via the platform API — a key-value store for user preferences, app settings, feature flags, and onboarding progress. Defaults to the signed-in user; admins can target another user. Use to persist per-user state.

# iblai-api-profile-metadata

Read and write per-user, per-organization metadata via the API: a key-value store
for preferences, app settings, feature flags, and onboarding progress, all served
from a single `…/dm/api/core/users/platform-metadata/` endpoint. Defaults to the
signed-in user; admins can target another user.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG` (passed as the `platform_key` query
  param), `{username}` = `$IBLAI_USERNAME`.
- **Host:** all operations hit `…/dm/api/core/users/platform-metadata/` and take
  `?platform_key={org}`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Concepts

- **One object per user × org.** Metadata is a single JSON object stored per
  (`{username}`, `{org}`) pair, so the same user holds independent metadata in each
  org. Keys are arbitrary strings; values are arbitrary JSON (strings, numbers,
  booleans, nested objects/arrays). The store enforces no schema, key namespace, or
  value types — any namespacing convention is yours to keep, not the API's.
- **Auto-created on first use.** GET/PATCH/PUT create the record on demand; a GET for
  a user with no metadata yet returns `"metadata": {}` (`200`, never `404`).
- **Admin cross-user access.** Add `&username={other}` to act on another user. The
  caller must be an **org admin** for `{org}` (an active platform link with admin
  rights); otherwise the API returns
  `403 {"error": "Only tenant admins can access other users' metadata"}`. An unknown
  target username returns `404 {"error": "User not found"}`. Confirm with the user
  before writing to another user's metadata.

## Reads

### Endpoints (all take `?platform_key={org}`; admins may add `&username={other_user}`)

- **GET** `https://api.iblai.app/dm/api/core/users/platform-metadata/?platform_key={org}` — retrieve the user's full metadata object (defaults to the authenticated user). Returns the shape in **`## Schema`**.

### Admin (target another user)

- Append `&username={other_user}` to read another user's metadata (org admin only).
  See **Concepts** for the permission model and errors.

## Writes

### Endpoints (all take `?platform_key={org}`; admins may add `&username={other_user}`)

- **PATCH** `https://api.iblai.app/dm/api/core/users/platform-metadata/?platform_key={org}` — merge: update and/or delete specific keys, leaving all others intact. Include at least one of `metadata` or `delete_keys`:
  ```json
  {
    "metadata": { "<key>": "<value>" },
    "delete_keys": ["<key>"]
  }
  ```
  Updates are applied first, then deletions — so a key listed in **both** `metadata`
  and `delete_keys` ends up removed. Returns the full object (`200`).
- **PUT** `https://api.iblai.app/dm/api/core/users/platform-metadata/?platform_key={org}` — replace the entire object with the supplied `metadata`, dropping every key not included:
  ```json
  {
    "metadata": { }
  }
  ```
  The `{ "metadata": … }` wrapper is required and must be a JSON object (a non-object
  → `400 {"error": "metadata must be a JSON object"}`); an omitted or empty `metadata`
  clears everything. Returns the full object (`200`). Destructive (drops unlisted
  keys) — confirm with the user first.
- **DELETE** `https://api.iblai.app/dm/api/core/users/platform-metadata/?platform_key={org}` — reset the user's metadata to `{}` (the record is kept) and return `204 No Content` with an empty body. Destructive — confirm with the user first.

### Admin (target another user)

- Append `&username={other_user}` to PATCH/PUT/DELETE another user's metadata (org
  admin only). Confirm with the user first. See **Concepts** for the permission
  model and errors.

## Example

Persist onboarding progress and a theme preference for the signed-in user, leaving
all other keys untouched:

```bash
curl -X PATCH \
  "https://api.iblai.app/dm/api/core/users/platform-metadata/?platform_key=$IBLAI_ORG" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "metadata": { "onboarding_step": "3", "theme": "dark" } }'
```

## Notes

- PATCH is the safe choice for incremental updates; PUT and DELETE are destructive —
  PUT drops every key not sent, DELETE clears all — so confirm before using them.
- **Errors.** Missing `platform_key` → `400 {"error": "platform_key query parameter is required"}`.
  Unknown `platform_key` → `404 {"error": "Platform not found"}`. PATCH with neither
  `metadata` nor `delete_keys` → `400 {"non_field_errors": ["Provide 'metadata' to update or 'delete_keys' to remove keys."]}`.
  PUT with a non-object `metadata` → `400 {"error": "metadata must be a JSON object"}`.
  Cross-user without org-admin rights → `403`; unknown target user → `404` (see Concepts).
  Missing or invalid `Authorization` header → `401 {"detail": "Authentication credentials were not provided."}`.

## Schema

GET, PATCH, and PUT all return the full metadata object:

```json
{
  "username": "john_doe",
  "platform_key": "enterprise",
  "metadata": { "theme": "dark", "onboarding_completed": true },
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:45:00Z"
}
```

- Only `metadata` is writable; `username`, `platform_key`, `created_at`, and
  `updated_at` are read-only. `platform_key` echoes the org key; timestamps are
  ISO 8601.
- DELETE returns `204 No Content` with an empty body.

## Reference material

The endpoints, schema, and errors above are the primary surface. This companion file
(ported from the developer guide) preserves the surrounding concepts and guidance — read
it for depth, not for endpoint truth:

- [`references/guide.md`](references/guide.md) — what the store is for (the four data
  categories), the four use-case patterns (preferences, feature flags, onboarding,
  multi-org), best practices (PATCH-vs-PUT intent, structure/namespacing, performance,
  security, error handling), and the schema-migration strategy.