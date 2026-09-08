# iblai-api-agent-skill

> Manage an ibl.ai agent's skills via the platform API — browse the org skill catalog, assign/unassign skills to an agent, and create/edit/delete catalog skills. Requires a connected sandbox. Use when giving an agent reusable skill instructions.

# iblai-api-agent-skill

Manage an agent's skills via the API: browse the org's skill catalog, toggle
which skills an agent has assigned, and manage the catalog itself (create / edit
/ delete reusable skills). Use when giving an agent reusable skill instructions.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/mentors/{mentor}/claw-config/` — gate (skills require a sandbox).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/agent-skills/` — platform skill catalog.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/mentors/{mentor}/skills/` — skills assigned to this agent.

## Writes

### Assignment (toggle)

- **POST** `…/mentors/{mentor}/skills/` — assign a skill to the agent:
  ```json
  {
    "skill": "uuid (required)",
    "enabled": "boolean"
  }
  ```
- **PATCH** `…/mentors/{mentor}/skills/{assignmentId}/` — enable / disable an assignment:
  ```json
  {
    "enabled": "boolean"
  }
  ```
- **DELETE** `…/mentors/{mentor}/skills/{assignmentId}/` — unassign the skill (no body).

### Catalog CRUD

- **POST** `…/orgs/{org}/agent-skills/` — create a catalog skill:
  ```json
  {
    "name": "string (required)",
    "slug": "string (required)",
    "description": "string",
    "version": "string",
    "instruction": "string",
    "metadata": "object",
    "enabled": "boolean"
  }
  ```
- **PATCH** `…/orgs/{org}/agent-skills/{id}/` — update the catalog skill (partial).
- **DELETE** `…/orgs/{org}/agent-skills/{id}/` — delete the catalog skill (no body). Destructive — confirm with the user first.
- **POST** `…/orgs/{org}/agent-skill-resources/` — attach a resource/file to a catalog skill: `{ "skill": id, "file_type": "string", "filename": "string", "content": "string" }`.
- **POST** `…/orgs/{org}/agent-skill-assignments/` — assign a catalog skill to an agent (org-level twin of the mentor-nested `skills/` assignment above): `{ "agent": id, "skill": id, "enabled": bool }`.

## Example

Create a catalog skill, then assign it to the agent:

```bash
# Create the skill in the org catalog
curl -X POST \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/agent-skills/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cite Sources",
    "slug": "cite-sources",
    "description": "Always cite sources inline.",
    "instruction": "When answering, cite each claim with a source.",
    "enabled": true
  }'

# Assign it to the agent (use the returned skill uuid)
curl -X POST \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/mentors/$MENTOR/skills/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "skill": "8f1c…uuid", "enabled": true }'
```

## Notes

- Skills require a **connected sandbox** — the feature is gated via the
  `claw-config/` endpoint above. If it returns `404` the agent has no sandbox
  wired up; connect one first via **`/iblai-api-agent-sandbox`**.
- The catalog (`agent-skills/`) is org-scoped and shared across agents; the
  assignment list (`mentors/{mentor}/skills/`) is per-agent. Editing a catalog
  skill affects every agent it is assigned to.
- Toggling `enabled` on an assignment keeps the skill assigned but inactive;
  use DELETE to remove the assignment entirely.