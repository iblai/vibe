---
name: iblai-api-studio-publish
description: Publish draft changes of an Open edX course on Studio — make a unit, subsection, section or the whole course public, read the publish and visibility state of every block (published, has_changes, visibility_state), discard unpublished changes, and confirm users can now see the content. Use when the user says publish, go live, release, "users can't see", draft vs published, discard changes, or asks whether the course is published. Session auth via studio.env.
metadata:
  kind: api
---

# iblai-api-studio-publish

Every edit in Studio is a **draft**. Users see a block only once it — or an
ancestor — has been published. Publishing is a value of the `publish` key on
the generic block update, applied at any level of the tree. This skill is the
last step of a build and the first thing to check when "it's not showing".

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` — run **`/iblai-api-studio-auth`** first.
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- `ROOT="block-v1:<org>+<number>+<run>+type@course+block@course"`; any block locator works as the target.
- Publishing is outward-facing (users see it at once, on schedule) — confirm the target with the user before publishing a whole course. `discard_changes` destroys draft work — confirm with the user first.

## Concepts — what the state fields mean

| Field | Values | Meaning |
|---|---|---|
| `published` | bool | a published version exists |
| `has_changes` | bool | the draft differs from the published version |
| `visibility_state` | `live` | published, released, visible now |
| | `ready` | published, release date (`start`) in the future |
| | `unscheduled` | published but no release date |
| | `needs_attention` | unpublished, or published with unpublished changes |
| | `staff_only` | hidden from users (`visible_to_staff_only`) |
| | `gated` | behind a prerequisite |
| `released_to_students` | bool | `start` has passed (course start also applies) |

"Visible to a user" = `published` ∧ `released_to_students` ∧ not `staff_only` ∧ enrolled.

## Reads

- **GET** `/xblock/outline/{ROOT}` — the whole tree with the fields above on every section/subsection/unit (`child_info.children`, recursive). Use it to find everything with `has_changes: true`.
- **GET** `/xblock/outline/{section}` / **GET** `/xblock/{block}` — same fields for a subtree or one block.
- **GET** `/api/contentstore/v1/container/vertical/{unit}/children` — components of a unit (components have no publish state of their own; the unit's state covers them).

## Writes

- **POST** `/xblock/{block}` `{ "publish": "make_public" }` — publish the block **and everything below it**. `block` may be a unit, subsection, section, or `ROOT` for the whole course. → `{ "id", "data", "metadata" }` (`200`). Idempotent.
- **POST** `/xblock/{block}` `{ "publish": "discard_changes" }` — throw away the draft and revert to the published version (subtree). → `{ "id" }`. Confirm with the user first.
- **POST** `/xblock/{block}` `{ "publish": "republish" }` — re-run publish for a block already published with no changes (used after settings-only edits; harmless).
- Combining: an update and a publish can be one call — `{ "metadata": { "display_name": "Week 1" }, "publish": "make_public" }`.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"; ROOT="block-v1:${COURSE#course-v1:}+type@course+block@course"

# publish everything
curl "${S[@]}" -o /dev/null -w '%{http_code}\n' -X POST "$STUDIO_URL/xblock/$ROOT" -d '{"publish":"make_public"}'

# what is still not visible?
curl "${S[@]}" "$STUDIO_URL/xblock/outline/$ROOT" | python3 -c '
import sys,json
def walk(n, d=0):
    flag = "" if n["visibility_state"]=="live" else f'  ← {n["visibility_state"]}' + (" (unpublished changes)" if n.get("has_changes") else "")
    print("  "*d + n["category"].ljust(11), n["display_name"] + flag)
    for c in (n.get("child_info") or {}).get("children", []): walk(c, d+1)
walk(json.load(sys.stdin))'
```

## Notes

- Publishing does not change dates: a block published with `start` in the future is `ready`, not `live`. Course `start_date` (`/iblai-api-studio-settings`) gates all of it.
- `staff_only` stays hidden after publishing — clear `visible_to_staff_only` on the block (and check `ancestor_has_staff_lock`).
- Publish at the smallest sensible level while iterating (a unit); publish `ROOT` once at the end of a build.
- Course settings, grading policy and team changes need no publish.
- LMS-side confirmation (published outline, block list, enrollment) is `/iblai-api-studio-lms`; the LMS app URL is `$LMS_APP_URL/platform/<org>/course-content/<course_key>/course`.
