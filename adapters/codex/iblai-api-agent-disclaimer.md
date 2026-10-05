# iblai-api-agent-disclaimer

> Manage an ibl.ai agent's disclaimers via the platform API — the Advisory text (saved through the agent settings endpoint) and the User Agreement (create/update/activate). Use when adding legal or advisory notices users must see or accept.

# iblai-api-agent-disclaimer

Manage an agent's disclaimers via the API: the Advisory text (a single field on
the agent's `settings/`) and the User Agreement (its own create / update /
activate lifecycle). Use when adding legal or advisory notices users must see or
accept.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — Advisory text lives in the `disclaimer` field.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/disclaimers/?mentor_id={mentor}&scope=mentor` — User Agreement list (read `results[0]` for the active agreement). `mentor_id` must be an agent in `{org}`, or the call returns 404.
- **GET** `…/users/{username}/disclaimers/{id}/` — one disclaimer.

Each disclaimer in these responses (and in the write responses) carries a
`permissions` object describing what the caller may do with it. Use it to
disable edit controls instead of waiting for a 403:

```json
"permissions": {
  "field": {
    "content": { "read": true, "write": false },
    "active": { "read": true, "write": false },
    "title": { "read": true, "write": false }
  },
  "object": { "write": false, "delete": false }
}
```

This is the same envelope as every other RBAC endpoint. `field` has one
entry per response field. Field values are never blanked. `object.delete` is always `false` because disclaimers cannot be
deleted (deactivate with `active: false`).

## Writes

- **PUT** `…/users/{username}/mentors/{mentor}/settings/` — save **Advisory** text:
  ```json
  {
    "disclaimer": "string"
  }
  ```
- **POST** `…/users/{username}/disclaimers/` — create a **User Agreement**:
  ```json
  {
    "content": "string (required)",
    "mentors": ["uuid"],
    "scope": "mentor",
    "active": "boolean"
  }
  ```
- **PATCH** `…/users/{username}/disclaimers/{id}/` — update content or toggle activation:
  ```json
  {
    "content": "string"
  }
  ```
  or
  ```json
  {
    "active": "boolean"
  }
  ```

- **POST** `…/users/{username}/disclaimers/{id}/add-mentor/` or `…/remove-mentor/` — attach or detach another agent:
  ```json
  {
    "mentor_id": "uuid"
  }
  ```

## Permissions

- Reads need `Ibl.Mentor/Disclaimers/list` / `read` on the agent
  (`view_disclaimers`).
- **Every write** (create, PUT/PATCH, add/remove-mentor) needs
  `Ibl.Mentor/Disclaimers/write` on each agent involved. That is the
  `write_disclaimers` flag on the agent in the RBAC permission check. Create
  no longer accepts `Ibl.Mentor/Disclaimers/action` alone.
  - Moving a disclaimer onto another agent (`mentors` in a PATCH) or
    add-mentor needs `write` on that agent too.
  - Switching to `scope: "platform"`, or editing a platform-scope disclaimer,
    needs `write` on `/platforms/{pk}/disclaimers/`.
- Seeded roles: Students and Mentor Viewer read; Mentor Editor, the agent's
  owner, and org admins write.
- The `{username}` in the path is not what gets authorized: the caller behind
  the `Api-Token` is. A refused write returns **403** and changes nothing.

## Example

Create and activate a User Agreement for an agent:

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/disclaimers/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "By continuing, you agree to use this assistant for educational purposes only.",
    "mentors": ["'"$MENTOR"'"],
    "scope": "mentor",
    "active": true
  }'
```

## Notes

- The **Advisory** is one field (`disclaimer`) on the agent `settings/` — send only
  that key in the PUT; other settings are left unchanged.
- The **User Agreement** is a separate object users must accept; activate exactly one
  per agent via `active: true`, and deactivate others with a PATCH `active: false`.
- The disclaimers list endpoint is filtered with `mentor_id` + `scope=mentor`; the
  current agreement is the first item in `results`.