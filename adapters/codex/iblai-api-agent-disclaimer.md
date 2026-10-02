# iblai-api-agent-disclaimer

> Manage an ibl.ai agent's disclaimers via the platform API — the Advisory text (saved through the agent settings endpoint), the User Agreement (create/update/activate), and the record of who accepted it. Use when adding legal or advisory notices users must see or accept, or auditing acceptances.

# iblai-api-agent-disclaimer

Manage an agent's disclaimers via the API: the Advisory text (a single field on
the agent's `settings/`), the User Agreement (its own create / update /
activate lifecycle), and the agreements users record when they accept it. Use
when adding legal or advisory notices users must see or accept. The UI twin is
[`/iblai-vibe-agent-disclaimer`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-disclaimer/SKILL.md).

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/settings/` — Advisory text lives in the `disclaimer` field.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/disclaimers/?mentor_id={mentor}&scope=mentor` — User Agreement list (read `results[0]` for the agent's agreement). Rows carry `id`, `content`, `title`, `active`, `scope`, `mentors[]`, `has_agreed` (whether the caller accepted it), `created_at`, `updated_at`. Other filters: `active`, `search`, `ordering`, `page`, `page_size`.
- **GET** `…/users/{username}/disclaimer-agreements/?disclaimer={id}&mentor_id={mentor}` — who accepted the agreement: `id`, `disclaimer`, `agreed_at`, `user_id`, `user_email`, `user_full_name`. Filter one user with `username`; paginate with `page` / `page_size`. Admins see every user; others see only their own.

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

- **POST** `…/users/{username}/disclaimers/{id}/add-mentor/` /
  `…/remove-mentor/` — attach or detach one more agent (body `{"mentor_id": "uuid"}`,
  admins only). Removing the last agent fails with 400.
- **POST** `…/users/{username}/disclaimer-agreements/` — accept an agreement as
  the caller (`{"disclaimer": id}`). **DELETE** `…/disclaimer-agreements/{id}/`
  withdraws one (admins may delete any user's).

There is no DELETE for a User Agreement: switch it off with `active: false`.

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
- A POST without `active` creates the agreement already active.
- Verified against the live schema (4.411.0) and a live create on 2026-10-02.