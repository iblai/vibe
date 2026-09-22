# Recipes and troubleshooting

Contents: [File uploads](#file-uploads) · [Course copy](#course-copy) ·
[Common Cartridge import](#common-cartridge-import) ·
[Enrollments at scale](#enrollments-at-scale) · [Publishing](#publishing) ·
[Verifying a build](#verifying-a-build) · [Cleaning up](#cleaning-up-a-bad-run) ·
[Error responses](#error-responses) · [GraphQL](#graphql)

---

## File uploads

Three steps, and the third is the one people skip.

```python
from canvas_client import CanvasClient
c = CanvasClient()
attachment = c.upload_file(
    "syllabus.pdf",
    f"/courses/{course_id}/files",
    parent_folder_path="course files/handouts",
    on_duplicate="overwrite",
)
print(attachment["id"], attachment["url"])
```

By hand:

```bash
# 1. announce
INIT=$(curl -s -X POST "$CANVAS_API_URL/api/v1/courses/$CID/files" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -d 'name=syllabus.pdf' -d 'size=204800' \
  -d 'content_type=application/pdf' \
  -d 'parent_folder_path=course files' -d 'on_duplicate=overwrite')

# 2. upload to the returned upload_url with upload_params, file LAST
#    (order matters: S3-backed instances reject out-of-order multipart fields)

# 3. follow the 3xx Location header to finalise
```

Notes:

- The endpoint you POST to in step 1 determines the file's permissions. A file uploaded to
  `/courses/:id/files` is course content; one uploaded to a submissions endpoint can only be
  attached to that submission.
- `on_duplicate=overwrite` replaces the existing file **and keeps its id**, so links don't
  break. `rename` creates `syllabus-1.pdf` and silently orphans your links.
- For files already on a public URL, pass `url=https://...` in step 1 instead of uploading;
  Canvas fetches it in the background. Poll `GET /files/:id` until `upload_status` is
  `success` before linking to it.
- `size` is optional but strongly worth sending — it surfaces quota problems before you
  transfer the bytes.

---

## Course copy

The right tool for duplicating a course. It preserves internal links, module structure and
relative dates, which a hand-built copy cannot.

```bash
curl -X POST "$CANVAS_API_URL/api/v1/courses/$NEW_CID/content_migrations" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -d 'migration_type=course_copy_importer' \
  -d 'settings[source_course_id]='"$OLD_CID" \
  -d 'date_shift_options[shift_dates]=true' \
  -d 'date_shift_options[old_start_date]=2025-09-01' \
  -d 'date_shift_options[new_start_date]=2026-09-01' \
  -d 'date_shift_options[old_end_date]=2025-12-15' \
  -d 'date_shift_options[new_end_date]=2026-12-15'
```

Poll until done:

```bash
curl -s "$CANVAS_API_URL/api/v1/courses/$NEW_CID/content_migrations/$MID" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq '.workflow_state, .progress_url'
```

`workflow_state` runs `pre_processing` → `running` → `completed` (or `failed`). Then check
`GET /courses/:id/content_migrations/:mid/migration_issues` — a "completed" migration can
still have dropped items, and this is the only place that shows up.

For a partial copy, add `settings[import_type]=...`, wait for `waiting_for_select`, read
`GET .../selective_data`, then `PUT` the migration with `copy[all_assignments]=1`,
`copy[modules][id_xxx]=1`, etc.

---

## Common Cartridge import

```bash
# Step 1 returns pre_attachment.upload_url and upload_params
curl -X POST "$CANVAS_API_URL/api/v1/courses/$CID/content_migrations" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -d 'migration_type=common_cartridge_importer' \
  -d 'pre_attachment[name]=course.imscc' \
  -d 'pre_attachment[size]=8412345'
# Step 2: upload the .imscc to that URL exactly as in the file upload flow.
# The migration starts automatically once the upload completes.
```

Same flow with `migration_type=moodle_converter`, `qti_converter` (question banks),
`canvas_cartridge_importer`, `zip_file_importer` (bulk files into a folder).

`GET /courses/:id/content_migrations/migrators` lists what the instance actually supports.

---

## Enrollments at scale

Per-user calls are fine up to a few hundred. Beyond that:

```bash
# Account-level bulk enrollment
curl -X POST "$CANVAS_API_URL/api/v1/accounts/$AID/bulk_enrollment" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -F 'user_ids[]=1' -F 'user_ids[]=2' \
  -F 'course_ids[]=10' \
  -F 'enrollment_type=StudentEnrollment'
```

Or a SIS import, which is by far the fastest path for thousands of rows:

```bash
curl -X POST "$CANVAS_API_URL/api/v1/accounts/$AID/sis_imports?import_type=instructure_csv" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  -H "Content-Type: text/csv" --data-binary @enrollments.csv
```

`enrollments.csv` needs `course_id,user_id,role,section_id,status`. Be careful: by default a
full SIS import can **delete** enrollments not present in the file. Pass
`batch_mode=false` (the default) unless the user genuinely owns the SIS feed, and always dry
run first with `GET /accounts/:id/sis_imports/:id` on a small batch.

Always set `enrollment[enrollment_state]=active` for programmatic enrollment — the default
`invited` leaves users staring at an invitation banner they never accept.

---

## Publishing

```bash
# modules first (published cannot be set at module creation time)
curl -X PUT "$CANVAS_API_URL/api/v1/courses/$CID/modules/$MID" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" -d 'module[published]=true'

# then the course
curl -X PUT "$CANVAS_API_URL/api/v1/courses/$CID" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" -d 'course[event]=offer'
```

Unpublishing a course with `course[event]=claim` only works before any student submission
exists. After that, `conclude` is the only way to take it out of circulation.

If requirements were added to a module students had already unlocked,
`PUT /courses/:cid/modules/:mid/relock` recomputes progressions. Without it the new
requirements apply only to students who hadn't reached the module.

---

## Verifying a build

Before telling the user it worked:

```bash
curl -s "$CANVAS_API_URL/api/v1/courses/$CID?include[]=syllabus_body" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq '.workflow_state, .default_view'

curl -s "$CANVAS_API_URL/api/v1/courses/$CID/modules?include[]=items&per_page=100" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" \
  | jq '.[] | {name, published, items: [.items[]? | {title, type, published}]}'
```

What to look for: any module or item with `published: false` that the user expected live,
module items whose `content_id` is null (broken link), and `items_count` disagreeing with
the number of items you created.

The most useful single check is to view the course as a student —
`GET /courses/:id/modules?student_id=<a real student id>` returns their view including lock
state, which is what actually matters.

---

## Cleaning up a bad run

There is no bulk delete. In rough order of preference:

1. **If you own the course and it has no submissions**: `DELETE /courses/:id?event=delete`.
   Cleanest possible outcome.
2. **If it's a scratch course**: `POST /courses/:id/reset_content` wipes all content and
   keeps enrollments and the course id. Irreversible.
3. **Selective**: iterate the manifest and `DELETE` each object. Delete module items before
   modules, and content objects last (deleting an assignment orphans its module item).

Deleted objects are soft-deleted; they stop appearing in list endpoints but SIS IDs stay
taken. Use `enable_sis_reactivation=true` when recreating a course with a previously used
`sis_course_id`.

---

## Error responses

| Status / body                                        | What it usually means                                                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized`                                   | Token missing, expired, or revoked. Check `GET /users/self`.                                                                                 |
| `401` with `"insufficient scopes"`                   | OAuth developer key lacks the scope for this endpoint — different from a permissions problem.                                                |
| `403 Forbidden` (plain)                              | Real permissions problem. The token's user isn't a teacher/admin on this object. Do **not** retry.                                           |
| `403`/`429` with `"Rate Limit Exceeded"` in the body | Throttled. Back off exponentially, drop to one request at a time.                                                                            |
| `404 Not Found` on a valid-looking id                | Object is soft-deleted, in a different account, or the id is a New Quizzes assignment id used against the Classic endpoint.                  |
| `400` `"unknown student ids"`                        | Passing a numeric id where an `sis_user_id:` reference was needed, or a user not enrolled in the course.                                     |
| `422 Unprocessable` with an `errors` object          | Validation. Read `errors` — it names the field. Common: due date outside term, missing required `module[name]`, `points_possible` on a quiz. |
| Silent success, nothing visible                      | The classic one: object created but unpublished, or inside an unpublished module, or the course itself is unpublished.                       |
| Quiz answers scrambled                               | Bracket-encoded array of hashes. Resend as a JSON body.                                                                                      |
| Module item created but shows "no content"           | `content_id` pointed at a deleted object, or a `Page` item was given `content_id` instead of `page_url`.                                     |
| Duplicate everything after a re-run                  | No idempotency. Use a manifest — see `scripts/build_course.py`.                                                                              |

Canvas error bodies are usually `{"errors": [{"message": "..."}]}` or
`{"errors": {"field": [{"message": "..."}]}}`. Always print the body; the status alone
rarely tells you anything.

---

## GraphQL

`POST /api/graphql` with `{"query": "...", "variables": {...}}` and the same bearer token.
Worth reaching for when you need to **read** a lot of related data in one round trip —
course + modules + items + assignment details — which would otherwise be dozens of REST
calls and a pagination loop.

```graphql
query ($id: ID!) {
  course(id: $id) {
    name
    modulesConnection {
      nodes {
        name
        published
        moduleItems {
          title
          content {
            __typename
            ... on Assignment {
              name
              dueAt
            }
          }
        }
      }
    }
  }
}
```

Mutations exist but cover far less than REST. Build with REST, audit with GraphQL.
