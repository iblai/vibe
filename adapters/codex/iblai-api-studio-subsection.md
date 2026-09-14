# iblai-api-studio-subsection

> Manage subsections (sequential blocks) of an Open edX course on Studio — create them inside a section, rename, set the assignment type (graderType from the grading policy), due date, release date, hide-after-due, staff-only visibility and timed-exam settings, reorder or move them between sections, and delete. Use when the user says subsection, lesson, lecture, assignment, due date, graded, timed exam, or "make this a Homework". Session auth via studio.env.

# iblai-api-studio-subsection

A **subsection** (`sequential`) sits inside a section and holds units. It is
also the grading unit of Open edX: the assignment type and due date live here,
and a subsection marked with a type from the grading policy is what gets
graded. Same `/xblock/` endpoints as sections, different metadata.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A section locator from `/iblai-api-studio-section` (or the outline read).
3. For graded subsections: the assignment type exists in `/iblai-api-studio-grading`, and the course's pacing is decided (`/iblai-api-studio-settings`) — due dates behave differently on self-paced courses.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env`.
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- **Keys:** parent = a section locator (`…+type@chapter+block@…`); a subsection is `…+type@sequential+block@<hex>`.
- Assignment types must already exist in the grading policy (`/iblai-api-studio-grading`); the outline root's `course_graders` lists them.
- Edits are drafts until `/iblai-api-studio-publish`. DELETE removes all units inside — confirm with the user first.

## Reads

- **GET** `/xblock/outline/{section}` — subsections with their units: each `{id, display_name, category: "sequential", published, has_changes, visibility_state, graded, format, due, start, child_info.children: [units]}`.
- **GET** `/xblock/{subsection}` — one subsection: `metadata` (`display_name`, `due`, `start`, `hide_after_due`, `is_time_limited`, `default_time_limit_minutes`, …), `graded`, `format` (assignment type), `due_date`, `published`, `has_changes`, `visibility_state`.
- **GET** `/xblock/{subsection}?fields=graderType` — `{ "graderType": "Homework" | "notgraded", … }`.

## Writes

- **POST** `/xblock/` — create:
  ```json
  { "parent_locator": "<section>", "category": "sequential", "display_name": "1.1 Getting started" }
  ```
  → `{ "locator": "…+type@sequential+block@<hex>", "courseKey": "…" }`.
- **POST** `/xblock/{subsection}` — grading and schedule (send only what changes):
  ```json
  { "graderType": "Homework",
    "metadata": { "due": "2026-10-15T23:59:00Z", "hide_after_due": true } }
  ```
  → `{ "id", "data": null, "metadata": {…}, "graderType": "Homework" }`.
  `graderType` = a `type` from the grading policy exactly as spelled (`"Homework"`, `"Final Exam"`), or `"notgraded"` to ungrade. Studio also stores it as `format` and sets `graded`.
  Other metadata: `display_name`; `start` (release date; must not be before the section's); `visible_to_staff_only: true|false`; `hide_after_due` (users cannot open after the due date); `show_correctness: "always" | "never" | "past_due"`.
- **POST** `/xblock/{subsection}` — timed exam:
  ```json
  { "metadata": { "is_time_limited": true, "default_time_limit_minutes": 60, "is_practice_exam": false, "is_proctored_enabled": false } }
  ```
  (`is_time_limited: false` turns it off; the other exam keys can be omitted.)
- **POST** `/xblock/{section}` `{ "children": ["<sub A>", "<sub B>", …] }` — reorder inside the section (full list).
- **PATCH** `/xblock/` `{ "move_source_locator": "<subsection>", "parent_locator": "<other section>", "target_index": 0 }` — move to another section (index optional) → `{ "move_source_locator", "parent_locator", "source_index" }`.
- **POST** `/xblock/` `{ "duplicate_source_locator": "<subsection>", "parent_locator": "<section>" }` — duplicate with units.
- **DELETE** `/xblock/{subsection}` → `204`. Confirm with the user first.
- **POST** `/xblock/{subsection}` `{ "publish": "make_public" }` — publish it and its units.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
SECTION="block-v1:acme+DATA101+2026-T1+type@chapter+block@e28d428eea734d7fb9328e8d5fd404de"

SUB=$(curl "${S[@]}" -X POST "$STUDIO_URL/xblock/" \
  -d "{\"parent_locator\":\"$SECTION\",\"category\":\"sequential\",\"display_name\":\"1.1 Getting started\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["locator"])')

curl "${S[@]}" -X POST "$STUDIO_URL/xblock/$SUB" \
  -d '{"graderType":"Homework","metadata":{"due":"2026-10-15T23:59:00Z"}}'
```

## Notes

- A subsection with `graderType` set but no problems inside counts as an
  assignment with zero points; add a `/iblai-api-studio-problem` block or leave it `notgraded`.
- `due` on a self-paced course is ignored by the LMS (relative dates apply) — set `self_paced` deliberately in `/iblai-api-studio-settings`.
- Studio echoes metadata already stored (e.g. `default_time_limit_minutes: 0`) even when you did not send it; that is not an error.
- Ungrading: `{"graderType": "notgraded"}`; clearing a due date: `{"metadata": {"due": null}}`.
- Next: `/iblai-api-studio-unit`.