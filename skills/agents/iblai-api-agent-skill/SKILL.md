---
name: iblai-api-agent-skill
description: Manage an ibl.ai agent's skills via the platform API — browse the org skill catalog, assign/unassign skills to an agent, create/edit/delete catalog skills (shared or private to one agent), and attach files to them. Use when giving an agent reusable skill instructions.
metadata:
  kind: api
---

# iblai-api-agent-skill

> **With a screen:** `/iblai-vibe-agent-skills` mounts `AgentSkillsTab` on the
> same data — this skill is its headless twin.

Manage an agent's skills via the API: browse the org's skill catalog, toggle
which skills an agent has assigned, and manage the catalog itself (create / edit
/ delete reusable skills). Use when giving an agent reusable skill instructions.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Assignment paths:** `…/orgs/{org}/agents/{mentor}/skills/` is the
  canonical spelling; `…/orgs/{org}/mentors/{mentor}/skills/` is a
  deprecated alias with the same behavior.
- Verified against the live schema
  (`https://api.iblai.app/dm/api/docs/schema/`, version 4.411.0) on 2026-10-02.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/agent-skills/` — the organization's skill catalog. Query: `enabled`, `search` (name/slug), `limit`, `offset`.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/agent-skills/{id}/` — one skill.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/agents/{mentor}/skills/` — skills assigned to this agent (`limit`, `offset`).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/agent-skill-resources/?skill={id}` — a skill's files (`file_type`, `limit`, `offset`).

## Writes

### Assignment (toggle)

- **POST** `…/agents/{mentor}/skills/` — assign a skill to the agent:
  ```json
  {
    "skill": "uuid (required)",
    "enabled": "boolean"
  }
  ```
- **PATCH** `…/agents/{mentor}/skills/{assignmentId}/` — enable / disable an assignment:
  ```json
  {
    "enabled": "boolean"
  }
  ```
- **DELETE** `…/agents/{mentor}/skills/{assignmentId}/` — unassign the skill (no body).

### Catalog CRUD

- **POST** `…/orgs/{org}/agent-skills/` — create a catalog skill:
  ```json
  {
    "name": "string (required)",
    "slug": "string (required)",
    "description": "string",
    "version": "string",
    "category": "string",
    "instruction": "string",
    "mentor": "uuid | null (set = private to that agent)",
    "metadata": "object",
    "enabled": "boolean"
  }
  ```
- **PATCH** `…/orgs/{org}/agent-skills/{id}/` — update the catalog skill (partial).
- **DELETE** `…/orgs/{org}/agent-skills/{id}/` — delete the catalog skill (no body). Destructive — confirm with the user first.
- **POST** `…/orgs/{org}/agent-skill-resources/` — attach a file to a catalog skill: `{ "skill": id, "file_type": "reference | script", "filename": "string", "content": "string" }` for text; multipart with `file` for `file_type: "asset"`.
- **PATCH** `…/orgs/{org}/agent-skill-resources/{id}/` — update a resource's filename or content.
- **DELETE** `…/orgs/{org}/agent-skill-resources/{id}/` — delete a resource (no body). Confirm with the user first.

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
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/agents/$MENTOR/skills/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "skill": "8f1c…uuid", "enabled": true }'
```

## Notes

- Skills need no sandbox; they apply to Base Agent agents.
- The assignment's `skill` is the skill's `unique_id` (UUID); resources key
  on the integer `id`.
- The catalog (`agent-skills/`) is org-scoped and shared across agents; the
  assignment list (`agents/{mentor}/skills/`) is per-agent. Editing a catalog
  skill affects every agent it is assigned to.
- Toggling `enabled` on an assignment keeps the skill assigned but inactive;
  use DELETE to remove the assignment entirely.
