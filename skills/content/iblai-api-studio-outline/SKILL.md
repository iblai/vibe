---
name: iblai-api-studio-outline
description: Build or bulk-edit an Open edX course outline on Studio — a new course in one request from a JSON spec via the IBL course-creator API (POST /api/v1/ibl/course/create_full_course, which also publishes), or an existing course at scale with the bundled reconcile driver that diffs the same spec against the live outline and creates/updates/reorders/deletes idempotently; plus the v1 helpers to list every unit with its components and create/update/publish single blocks. Use when a course plan is known up front, when many readings/units of an existing course must change at once, or to resume a bulk build. Session auth via studio.env; single-block edits are the section/subsection/unit/html/problem skills. For the build order and the other Studio skills, see /iblai-api-studio.
metadata:
  kind: api
---

# iblai-api-studio-outline

The IBL course-creator app on Studio adds `api/v1/ibl/…` routes that wrap the
stock `/xblock/` handler for bulk work. `create_full_course` walks a JSON
spec — sections → subsections → units → components — creates everything
inside one modulestore transaction and **publishes the whole course** at the
end. A five-section course with text and quizzes becomes one request instead
of a hundred.

## Before you start

0. **Three situations, three tools.** New, empty course → `create_full_course` (below; it appends and then publishes the *entire* course, drafts included). One section, lesson, unit or component of an existing course → the individual skills (`/iblai-api-studio-section`, `-subsection`, `-unit`, `-html`, `-problem`, `-pdf`), which act on one locator. Many changes to an existing course (rewrite readings, add units across lessons, restructure) → the **reconcile driver** (section "Bulk edits to an existing course" below), which diffs the same spec against the live outline and only touches what differs.
1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` must print two `ok`s — otherwise run **`/iblai-api-studio-auth`** first, do not attempt the calls below.
2. A course key from `/iblai-api-studio-course-create`; the user must be instructor on it (the creator is). For `create_full_course`, confirm with `GET /xblock/outline/{ROOT}` that `child_info.children` is empty; for the reconcile driver, that outline is the baseline it diffs against.
3. **Settings and grading first** (`/iblai-api-studio-settings`, `/iblai-api-studio-grading`): this call publishes, and pacing cannot change after the course start.
4. The outline planned per `/iblai-api-studio` "Planning a production-grade outline" and reviewed with the user.
5. If sub-agents wrote parts of the spec: they worked from the same content brief, and every fragment has been reviewed against it (`/iblai-api-studio` "Content quality") — consistent voice and headings, no thin or placeholder units, valid OLX, titles on every block. The builder posts whatever it is given and publishes it; divergent or shallow content goes live verbatim.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` (its values are single-quoted — bash strips the quotes; any other parser must strip them too, or Studio answers 500: `/iblai-api-studio-auth`).
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- `COURSE="course-v1:<org>+<number>+<run>"`; `ROOT="block-v1:<org>+<number>+<run>+type@course+block@course"`.
- Responses use `xblock_locator` (v1 routes) where the stock handler says `locator`.
- **Do not send `position`** on the v1 create route: it returns `500` on this deployment. Order is creation order; reorder afterwards with `children` (`/iblai-api-studio-section`).
- The v1 `course/asset/upload` route also returns `500` — upload assets with `POST /assets/{COURSE}/` (`/iblai-api-studio-settings`).
- Creating content is not reversible in bulk (there is no undo; delete blocks one by one) — show the user the spec and confirm before posting.

## Reads

- **GET** `/api/v1/ibl/course/{COURSE}/units` → `{ "units": [ { "id": "<unit locator>", "display_name", "type": "vertical", "children": [ { "id", "display_name", "type": "html" | "problem" | "pdf" | … } ] } ] }` — every unit in outline order with its components, straight from the modulestore (no cache lag). The cheapest way to get all locators after a bulk build.
- **GET** `/api/v1/ibl/xblock/get-details?locator=<url-encoded usage key>` → `{ "id", "data", "display_name" }` for `html` (and `video`) blocks; `406` for other types.
- Full tree with publish state: `GET /xblock/outline/{ROOT}` (`/iblai-api-studio-section`).

## Writes

- **POST** `/api/v1/ibl/course/create_full_course` — build and publish the tree. Confirm with the user first.
  ```json
  { "course_parent_locator": "<ROOT>",
    "section": [
      { "name": "Week 1 · Foundations",
        "subsection": [
          { "name": "1.1 What is data?",
            "unit": [
              { "name": "Overview",
                "problems": [
                  { "problem_type": "html", "data": "<section><h3>Why data matters</h3><p>…</p></section>" },
                  { "problem_type": "video", "metadata": { "display_name": "Intro video", "youtube_id_1_0": "dQw4w9WgXcQ", "html5_sources": [] } }
                ] },
              { "name": "Practice",
                "problems": [
                  { "problem_type": "blank",
                    "data": "<problem>…OLX with one or more responses…</problem>",
                    "metadata": { "display_name": "Check your understanding", "max_attempts": 3, "weight": 2, "showanswer": "finished", "markdown": null } }
                ] }
            ] }
        ] }
    ] }
  ```
  → `200 { "course_parent_locator": "<ROOT>", "created_units": [ { "locator": "<unit>", "display_name" } ] }`.
  Keys are exactly `section[].name`, `subsection[].name`, `unit[].name`, `unit[].problems[]`; every level is required (a unit may have `"problems": []`).
  `problems[].problem_type`: `html` (`data` = HTML fragment), `blank` (a `problem` block: `data` = OLX, `metadata` as in `/iblai-api-studio-problem`, optional `boilerplate`), `multiplechoice` (same, seeded from the multiple-choice boilerplate), `dropdown` (same, `boilerplate: "optionresponse.yaml"`), `video` (`metadata.youtube_id_1_0`, `html5_sources`), `drag-and-drop-v2`, `lti_consumer`, `ibl_openedx_scorm_xblock`. **`pdf` is not supported** — add PDFs afterwards with `/iblai-api-studio-pdf`.
  Always put `"markdown": null` in a problem's `metadata` so the OLX is authoritative.
  Limits: html components are created with the default title **"Text"** (the builder ignores `display_name` for `html`) — rename them afterwards with the update route below or the section rhythm will look uniform; the whole course is published on success, including previously unpublished drafts.
  Errors: `400` (serializer message) for a missing `course_parent_locator`; `403 "You do not have permission to create content in this course"`; a `500` HTML page usually means a malformed spec (e.g. a missing `problems` key) — nothing before the failing block is rolled back, so read the outline before retrying.
- **POST** `/api/v1/ibl/xblock/create` `{ "category": "chapter" | "sequential" | "vertical" | "html" | "problem", "parent_locator": "<parent>", "display_name": "…", "boilerplate": "…" }` → `{ "xblock_locator": "…" }`. Same as `POST /xblock/`; no `position`.
- **POST** `/api/v1/ibl/xblock/update` `{ "locator": "<block>", "category": "<its category>", "courseKey": "<COURSE>", "data": "…", "metadata": { "display_name": "…", … } }` → `200` (empty). Top-level `display_name` is ignored — put it in `metadata`.
- **POST** `/api/v1/ibl/xblock/publish` `{ "locator": "<block>" }` → `200` (empty). Same as `{ "publish": "make_public" }` on `/xblock/{block}`.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"; ROOT="block-v1:${COURSE#course-v1:}+type@course+block@course"

# spec.json written from the reviewed plan; validate every OLX string first
python3 - <<'PY'
import json, xml.dom.minidom
spec = json.load(open("spec.json"))
for s in spec["section"]:
    for ss in s["subsection"]:
        for u in ss["unit"]:
            for p in u["problems"]:
                if p["problem_type"] in ("blank", "multiplechoice", "dropdown"):
                    xml.dom.minidom.parseString(p["data"])
print("spec ok:", sum(len(ss["unit"]) for s in spec["section"] for ss in s["subsection"]), "units")
PY
curl "${S[@]}" -X POST "$STUDIO_URL/api/v1/ibl/course/create_full_course" -d @spec.json > build.json
python3 -c 'import json; print(len(json.load(open("build.json"))["created_units"]), "units created")'

# rename the html blocks the builder titled "Text"
curl "${S[@]}" "$STUDIO_URL/api/v1/ibl/course/$COURSE/units" | python3 -c '
import json, sys, subprocess
for u in json.load(sys.stdin)["units"]:
    for c in u["children"]:
        if c["type"] == "html" and c["display_name"] == "Text":
            print(c["id"])' | while read -r ID; do
  curl "${S[@]}" -o /dev/null -X POST "$STUDIO_URL/api/v1/ibl/xblock/update" \
    -d "{\"locator\":\"$ID\",\"category\":\"html\",\"courseKey\":\"$COURSE\",\"metadata\":{\"display_name\":\"Reading\"}}"
done
```

## Bulk edits to an existing course — reconcile

`scripts/reconcile.py` (standard library only) takes the **same spec shape**
and makes the live course match it: creates what is missing, updates
components whose `data`/`metadata` differ, reorders, reports blocks that are
live but not in the spec (deletes them only with `--delete`), and publishes
changed units with `--publish`. Idempotent — a second run is a no-op. Dry run
by default.

```bash
python3 .claude/skills/iblai-api-studio-outline/scripts/reconcile.py spec.json --course "$COURSE"                       # plan only
python3 .claude/skills/iblai-api-studio-outline/scripts/reconcile.py spec.json --course "$COURSE" --apply --publish     # do it
python3 .claude/skills/iblai-api-studio-outline/scripts/reconcile.py spec.json --course "$COURSE" --apply --delete      # also remove blocks absent from the spec — confirm with the user first
```

- Matching: by `"id"` (a locator) when a node carries one, else by **name at
  the same level** (section/subsection/unit `name`, component `display_name`
  + type). Rename = delete + create, so give nodes an `id` (from `build.json`)
  before renaming.
- Spec additions over `create_full_course`: `subsection.graderType`, and
  `display_name` on every component (required — it is the match key).
  `problem_type` handled: `html`, `blank`, `multiplechoice`, `dropdown`,
  `video`; `pdf` is skipped with a note (`/iblai-api-studio-pdf`).
- Plan lines read `create | update | reorder | grade | delete | extra | publish  <path> [locator]`; `--apply` writes `build.json` (path → locator).
- Cost: 3 calls for the plan (outline + units + nothing else) plus one `GET`
  per matched component, then one call per change. Rewriting 40 readings ≈ 45
  calls.
- Flags: `--env studio.env`, `--map build.json`. Exit with the failing call's
  status on any HTTP error (302/403/500 → `/iblai-api-studio-auth`).

Workflow for "rewrite the readings and add units": export the live outline
into a spec (`GET /xblock/outline/{ROOT}` + `GET /api/v1/ibl/course/{COURSE}/units`,
or reuse the previous `spec.json`), edit it, dry-run, review the plan with the
user, `--apply --publish`.

## Same thing, three names

| Endpoint | locator | title | type |
|---|---|---|---|
| stock `/xblock/…` create / outline | `locator` (create) · `id` (read) | `display_name` | `category` |
| v1 `xblock/create` · `course/{COURSE}/units` | `xblock_locator` (create) · `id` (units) | `display_name` | `type` |
| `/api/contentstore/v1/container/vertical/{unit}/children` | `block_id` | `name` | `block_type` |

## Notes

- Keep `spec.json` and `build.json` next to the project: together they are the
  resumable record of what exists (re-running the bulk call duplicates every
  section; the reconcile driver does not).
- One `blank` problem per unit with several `*response` elements is the
  intended shape; several problem blocks in one unit force separate
  submissions (`/iblai-api-studio-problem`).
- The builder publishes; if the user wants to review before going live, build
  with the block-by-block skills instead, or build into a course whose
  `start_date` is in the future and `visible_to_staff_only` is set on sections.
- Stock equivalents: `POST /xblock/` (`/iblai-api-studio-section`), `POST /xblock/{block}` (`/iblai-api-studio-html`), `{ "publish": "make_public" }` (`/iblai-api-studio-publish`).
