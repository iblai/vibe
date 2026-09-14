---
name: iblai-api-studio-section
description: Manage the top level of an Open edX course outline on Studio — create sections (chapter blocks) under the course root, rename them, set release dates and staff-only visibility, reorder them, read the whole outline with publish state, and delete sections. Use when the user says section, week, module, chapter, course outline, "hide this from users", or reorder. Session auth via studio.env. For the build order and the other Studio skills, see /iblai-api-studio.
metadata:
  kind: api
---

# iblai-api-studio-section

A course outline is a tree: course → **section** (`chapter`) → subsection
(`sequential`) → unit (`vertical`) → components. Sections are the top level.
This skill covers sections and the outline read; subsections and units have
their own skills with the same `/xblock/` mechanics.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A course key from `/iblai-api-studio-course-create` (→ `ROOT` below) and the outline planned per `/iblai-api-studio`.
3. Building a whole new outline? `/iblai-api-studio-outline` creates every section/subsection/unit in one call; use this skill for edits and additions.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env`.
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- **Keys:** course root `ROOT=block-v1:<org>+<number>+<run>+type@course+block@course`; a section is `block-v1:…+type@chapter+block@<hex>` (the `locator` returned on create).
- Edits land in the **draft**; users see them only after `/iblai-api-studio-publish`.
- DELETE is destructive (removes every subsection/unit inside) — confirm with the user first.

## Reads

- **GET** `/xblock/outline/{ROOT}` — the full outline, sections → subsections → units (components are not included). Each node:
  `{id, display_name, category, has_children, published, published_on, has_changes, visibility_state, released_to_students, release_date, start, due, format, graded, has_explicit_staff_lock, studio_url, lms_url, actions, child_info: {category, display_name, children: […]}}`.
  `visibility_state` ∈ `live` · `ready` (published, release date in the future) · `unscheduled` · `needs_attention` (unpublished changes) · `staff_only` · `gated`.
  The root also carries `course_graders` (assignment types from the grading policy) and `start`.
- **GET** `/xblock/outline/{section}` — the same for one section and its descendants.
- **GET** `/xblock/{section}` — the section's own fields (`metadata`, `published`, `has_changes`, `start`, `visibility_state`), no children.

## Writes

- **POST** `/xblock/` — create a section:
  ```json
  { "parent_locator": "<ROOT>", "category": "chapter", "display_name": "Week 1 — Foundations" }
  ```
  → `{ "locator": "block-v1:…+type@chapter+block@<hex>", "courseKey": "course-v1:…" }`. New sections append at the end.
- **POST** `/xblock/{section}` — update fields; send only what changes:
  ```json
  { "metadata": { "display_name": "Week 1", "start": "2026-10-01T00:00:00Z", "visible_to_staff_only": true } }
  ```
  → `{ "id", "data": null, "metadata": {…echo of the stored metadata…} }`.
  `start` = release date (ISO 8601 UTC; users cannot open it before). `visible_to_staff_only: true` hides it from users even when published (`false` or `"nullout": ["visible_to_staff_only"]` to clear).
  Optional: `"metadata": {"highlights": ["Topic A", "Topic B"]}` for weekly highlight emails.
- **POST** `/xblock/{ROOT}` `{ "children": ["<section A>", "<section B>", …] }` — reorder sections (the list must contain every current section id). Sections cannot be moved with the `move_source_locator` PATCH (`400 "You can not move chapter into course"`); reorder this way.
- **POST** `/xblock/` `{ "duplicate_source_locator": "<section>", "parent_locator": "<ROOT>" }` — duplicate a section with everything inside → `{locator, courseKey}`.
- **DELETE** `/xblock/{section}` → `204`. Confirm with the user first.
- **POST** `/xblock/{section}` `{ "publish": "make_public" }` — publish the section and all its descendants (details and `discard_changes` in `/iblai-api-studio-publish`).

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"; ROOT="block-v1:${COURSE#course-v1:}+type@course+block@course"

SECTION=$(curl "${S[@]}" -X POST "$STUDIO_URL/xblock/" \
  -d "{\"parent_locator\":\"$ROOT\",\"category\":\"chapter\",\"display_name\":\"Week 1\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["locator"])')

curl "${S[@]}" -X POST "$STUDIO_URL/xblock/$SECTION" -d '{"metadata":{"start":"2026-10-01T00:00:00Z"}}' >/dev/null

curl "${S[@]}" "$STUDIO_URL/xblock/outline/$ROOT" | python3 -c '
import sys,json
for s in json.load(sys.stdin)["child_info"]["children"]:
    print(s["display_name"], s["visibility_state"], "changes" if s["has_changes"] else "", s["id"])'
```

## Notes

- Creating a section publishes nothing; a brand-new section reads `published: true, has_changes: false`
  only because it is empty — its content will need publishing.
- The outline call is the cheapest way to get every id at once; cache the ids you
  get back from creates instead of re-reading after each call.
- Dates are UTC ISO strings; Studio echoes them back normalized (`2026-10-01T00:00:00Z`).
- Course-level `start` (in `/iblai-api-studio-settings`) gates everything: a
  section release date earlier than the course start is still not visible.
- Next: `/iblai-api-studio-subsection` (lessons inside this section).
