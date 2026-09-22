# iblai-api-studio-lms

> Verify and operate the LMS side of an Open edX course built on Studio — the calls the lms.ibl.ai LMS app makes against the LMS API: enroll yourself or (as course staff) other users, check enrollment status, list a course's users, read the published outline and blocks as a user, read course details and the merged course metadata the catalog shows, and progress/grading as seen by users. Use after publishing to confirm what users see, to enroll test users, or when the user asks "is it in the catalog / can students see it". Session auth via studio.env (LMS cookies).

# iblai-api-studio-lms

The LMS app (`lms.ibl.ai`; test `lms.iblai.org`) renders a course from the
LMS API on `$LMS_URL` plus the ibl.ai catalog. This skill uses the LMS session
captured by `/iblai-api-studio-auth` to make the same calls, so you can prove a
build is visible, enroll users, and read what they will see. Nothing here
edits course content.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s (the second one is the LMS session used here); otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. The course is published (`/iblai-api-studio-publish`) and its `enrollment_start` is in the past and before `start_date` (`/iblai-api-studio-settings`) — otherwise enrollment and outline reads legitimately return "not yet".
3. A course key.

## Auth & conventions

- **Base URL:** `$LMS_URL` (`https://learn.iblai.app`; test `https://learn.iblai.org`). LMS app: `$LMS_APP_URL`.
- **Auth:** LMS session cookies from `studio.env` (values single-quoted — strip them in any non-bash parser: `/iblai-api-studio-auth`).
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  L=(-s -b "sessionid=$LMS_SESSION; csrftoken=$LMS_CSRF" -H "X-CSRFToken: $LMS_CSRF" \
     -H "Origin: $LMS_URL" -H "Referer: $LMS_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- `COURSE="course-v1:<org>+<number>+<run>"`; `CE` = the same URL-encoded (needed in **every query string**: `%3A` `%2B`).
- `$STUDIO_USERNAME` is the signed-in user; the same person must be enrolled to read blocks "as a user".
- Enrolling/unenrolling other people is outward-facing — confirm with the user first.

## Reads

- **GET** `/api/user/v1/me` → `{ "username" }` — session check.
- **GET** `/api/ibl/enrollment/enroll_status?course_id={CE}` → `{ "is_enrolled", "can_enroll", "invitation_only", "is_admin" }` for the signed-in user.
- **GET** `/api/enrollment/v1/enrollment/{username},{COURSE}` → `{ "created", "mode": "audit", "is_active", "course_details": { "course_id", "course_name", "enrollment_start", "enrollment_end", "course_start", "course_end", "invite_only", "course_modes": […], "pacing_type" }, "user" }` (own enrollment; `404` when not enrolled).
- **GET** `/api/ibl/v1/course_metadata?course_key={CE}` — the merged object the LMS app shows on the course page: all `/iblai-api-studio-settings` fields plus `display_name`, `course_price`, `advertised_start`, `display_organization`, `certificate_available`, `course_outline` (published tree). Catalog fields (`subject`, `tags`, `level`, …) read back from here prove the catalog sync.
- **GET** `/api/courses/v1/courses/{COURSE}` → Open edX course detail: `{ "id", "name", "org", "number", "start", "end", "enrollment_start", "enrollment_end", "pacing": "instructor" | "self", "short_description", "overview", "effort", "media": { "course_image": { "uri" }, "banner_image", "course_video": { "uri": "http://www.youtube.com/watch?v=…" } }, "blocks_url", "hidden", "invitation_only" }`. On some deployments this returns the shape with `null` values for a freshly built course (cache lag) — treat `course_metadata` above as the source of truth and use this only for `pacing`/`hidden`.
- **GET** `/api/ibl/completion/course_outline/{COURSE}?course_id={CE}` — the **published** outline as a user sees it, with completion: nested `{ id, block_id, type, display_name, lms_web_url, student_view_url, graded, start, has_score, effort_time, children: […] }` down to units. A unit missing here is unpublished or not yet released.
- **GET** `/api/courses/v2/blocks/?course_id={CE}&username={user}&depth=all&all_blocks=true&requested_fields=children,graded,format,due,type` → `{ "root", "blocks": { "<usage key>": { "id", "type", "display_name", "lms_web_url", "student_view_url", "children": […] } } }` — every visible block incl. components. `GET /api/courses/v2/blocks/{usage_key}?username={user}&depth=all` for one unit.
- **GET** `/api/course_home/progress/{COURSE}` → `{ "course_grade": { "percent", "letter_grade", "is_passing" }, "grading_policy": { "assignment_policies": [ { "type", "weight", "num_total", "num_droppable", "short_label" } ], "grade_range" }, "section_scores": [ { "display_name", "subsections": [ { "display_name", "assignment_type", "num_points_earned", "num_points_possible", "problem_scores", "url" } ] } ], "completion_summary", "enrollment_mode", "certificate_data" }` — grading policy and structure as graded.
- **GET** `/api/ibl/users/manage/roles/?username={user}` → `[ { "role", "org", "course" } ]` (course-staff / course-instructor / org-instructor …).
- **POST** `/courses/{COURSE}/instructor/api/get_students_features` (form-encoded, empty body; course staff only) → `{ "course_id", "students": [ { "id", "username", "email", "name", "enrollment_mode", … } ] }` — the enrolled users.

## Writes

- **POST** `/api/enrollment/v1/enrollment` `{ "course_details": { "course_id": "<COURSE>" } }` — enroll **yourself** (`mode` defaults to `audit`) → the enrollment object. Idempotent. `{ "course_details": {…}, "is_active": false }` unenrolls yourself. Passing `"user": "<other>"` needs global staff (`404` otherwise) — use the instructor route below.
- **POST** `/courses/{COURSE}/instructor/api/students_update_enrollment` (form-encoded; course staff/instructor) — enroll or unenroll other users by email or username. Confirm with the user first.
  ```bash
  curl "${L[@]:0:11}" -X POST "$LMS_URL/courses/$COURSE/instructor/api/students_update_enrollment" \
    --data-urlencode "identifiers=jdoe@example.com,asmith" --data-urlencode "action=enroll" \
    --data-urlencode "auto_enroll=true" --data-urlencode "email_students=false"
  ```
  → `{ "action": "enroll", "results": [ { "identifier", "before": { "user", "enrollment", "allowed", "auto_enroll" }, "after": {…} } ], "auto_enroll": true }`. `action=unenroll` removes. `identifiers` is comma/newline separated; unknown emails get `user: false` (with `auto_enroll=true` they are enrolled when they register). `email_students=true` sends the LMS enrollment email.

## Example

```bash
set -a; . ./studio.env; set +a
L=(-s -b "sessionid=$LMS_SESSION; csrftoken=$LMS_CSRF" -H "X-CSRFToken: $LMS_CSRF" \
   -H "Origin: $LMS_URL" -H "Referer: $LMS_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"; CE=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$COURSE',safe=''))")

curl "${L[@]}" -X POST "$LMS_URL/api/enrollment/v1/enrollment" -d "{\"course_details\":{\"course_id\":\"$COURSE\"}}" >/dev/null
curl "${L[@]}" "$LMS_URL/api/ibl/enrollment/enroll_status?course_id=$CE"          # {"is_enrolled":true,…}
curl "${L[@]}" "$LMS_URL/api/ibl/completion/course_outline/$COURSE?course_id=$CE" | python3 -c '
import sys,json
def walk(n,d=0):
    print("  "*d + n["type"].ljust(11), n["display_name"])
    for c in n.get("children",[]): walk(c,d+1)
walk(json.load(sys.stdin))'
ORG=${COURSE#course-v1:}; ORG=${ORG%%+*}
echo "LMS app URL: $LMS_APP_URL/platform/$ORG/courses/$COURSE"
```

## Notes

- **Catalog visibility:** a course created with `/iblai-api-studio-course-create` is registered in the ibl.ai catalog for its org at creation and appears in the LMS app's catalog immediately; settings written through `/iblai-api-studio-settings` (subject, tags, level, …) show up in `course_metadata` and the catalog without a separate sync. Api-Token catalog operations (programs, pathways, bulk enrollment, metadata for other orgs) are `/iblai-api-catalog` and `/iblai-api-catalog-invitation`.
- "Not visible" checklist: `enroll_status.is_enrolled` → the unit present in `course_outline` (published + released) → `courses/v1/courses` `start` in the past → `hidden`/`invitation_only` false.
- The LMS app's course page is `$LMS_APP_URL/platform/<org>/courses/<course_key>`; courseware is `…/course-content/<course_key>/course` (add `?unit_id=<unit locator>` to deep link).
- The LMS app itself authenticates with a JWT (`Authorization: JWT …`) to the same endpoints; the session cookie is equivalent for these reads and lasts longer.
- `students_update_enrollment` is form-encoded, so the example drops the JSON content type (`"${L[@]:0:11}"` keeps cookies, CSRF, Origin, Referer, Accept).