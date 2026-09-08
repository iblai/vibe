---
name: iblai-api-agent-dataset
description: Manage an ibl.ai agent's training datasets (RAG) via the platform API — list training docs, add resources (file, URL, YouTube, Blackboard, website crawl, GitHub), train/untrain, set visibility and retrain schedule, and delete. Use when feeding an agent knowledge.
metadata:
  kind: api
---

# iblai-api-agent-dataset

Manage an agent's training datasets (RAG) through the API: list an agent's
training documents, add new resources to its knowledge base, train / untrain and
set visibility, configure a retrain schedule, and delete datasets. Use when
feeding an agent knowledge.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`),
  used here as the `pathway`.
- **Host:** these endpoints live under `…/dm/api/ai-index/…`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-index/orgs/{org}/users/{username}/documents/pathways/{mentor}/?limit=5&offset={n}&search={q}` — list training docs. Poll this every 2s while any document is `pending`.
- **GET** `https://api.iblai.app/dm/api/ai-index/documents/{document_id}/settings/` — retrain schedule.
- **GET** `https://api.github.com/repos/{owner}/{repo}/branches` — list GitHub branches for a repo resource (external, no auth).

## Writes

- **POST** `https://api.iblai.app/dm/api/ai-index/orgs/{org}/users/{username}/documents/train/` — add a training resource (`multipart/form-data`); `type` varies:
  - File:
    ```json
    {
      "file": "File (required)",
      "pathway": "{mentor}",
      "type": "file|<ext>",
      "user_image_description": "string"
    }
    ```
  - URL / YouTube / Blackboard:
    ```json
    {
      "type": "url|youtube|blackboard",
      "pathway": "{mentor}",
      "url": "string (required)"
    }
    ```
  - Website crawl:
    ```json
    {
      "type": "webcrawler",
      "pathway": "{mentor}",
      "url": "string",
      "crawler_max_depth": "number",
      "crawler_max_pages_limit": "number",
      "crawler_match_patterns": "string[]",
      "crawler_pattern_type": "glob|regex"
    }
    ```
  - GitHub:
    ```json
    {
      "url": "repo url",
      "branch": "string",
      "pathway": "{mentor}",
      "type": "github"
    }
    ```
  - **`custom_metadata`** (optional, works with **every** `type` above) — a flat JSON
    object of tags stored on the document, later usable as a hard retrieval filter at chat
    time via `document_filter` (see `/iblai-api-agent-session`). Send it as a nested object
    on a JSON body, or — because `train/` is `multipart/form-data` — as a **JSON-encoded
    string** form field:
    ```json
    { "custom_metadata": { "stateCode": "CA", "productGroup": "LICENSING", "year": 2026 } }
    ```
    Rules (rejected with a validation error otherwise): keys must be flat and
    alphanumeric/underscore (`^\w+$`, no `__`); values must be scalars (string, number, or
    boolean) — no nested objects, arrays, or `null`. Stored on the document as
    `metadata.custom_metadata` and echoed back by the list endpoint above. Leave a tag
    **off** documents that should be exempt from a filter on that key — a `document_filter`
    only excludes documents that carry the key with a *different* value, so untagged/generic
    material always survives (see `/iblai-api-agent-session ## Schema`).
- **PUT** `https://api.iblai.app/dm/api/ai-index/documents/{document_id}/` — **train / untrain + visibility (+ retag)**:
  ```json
  {
    "pathway": "{mentor}",
    "url": "string",
    "train": "boolean",
    "access": "public|private",
    "custom_metadata": { "stateCode": "CA" }
  }
  ```
  `custom_metadata` here replaces the document's stored tags (same validation as `train/`);
  omit it to leave existing tags unchanged.
- **POST** `https://api.iblai.app/dm/api/ai-index/documents/{document_id}/settings/` — **set retrain schedule**:
  ```json
  {
    "retrain_interval_days": "number (required)"
  }
  ```
- **DELETE** `https://api.iblai.app/dm/api/ai-index/documents/{document_id}/` — delete a dataset. Destructive — confirm with the user first.

## Example

Add a YouTube video to an agent's knowledge base:

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/ai-index/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/documents/train/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -F "type=youtube" \
  -F "pathway=$MENTOR" \
  -F "url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Upload a file tagged with `custom_metadata` (JSON-encoded string in the form field), so a
chat turn can later scope retrieval to it with `document_filter: {"stateCode":"CA"}`:

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/ai-index/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/documents/train/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -F "type=file" \
  -F "pathway=$MENTOR" \
  -F "file=@ca-insurance-explainer.pdf" \
  -F 'custom_metadata={"stateCode":"CA","productGroup":"LICENSING"}'
```

## Notes

- The list endpoint should be polled every 2s while any document is `pending` so
  newly added resources flip to trained as soon as processing finishes.
- `pathway` is the agent's `{mentor}` unique id on every train/PUT call.
- For GitHub resources, fetch the branch list from the unauthenticated
  `api.github.com/repos/{owner}/{repo}/branches` endpoint to populate `branch`.
- Deletion is destructive — confirm with the user first.
