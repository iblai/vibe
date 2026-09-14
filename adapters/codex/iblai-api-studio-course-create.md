# iblai-api-studio-course-create

> Create a course on Open edX Studio (studio.learn.iblai.app) from the terminal — POST the org key and display name (optionally number and run) to Studio's course-management endpoint and get the course key back; list the user's courses, read a course summary, and derive the course root block for outline work. Use when the user wants a new Open edX course, asks for their course key, or needs to know which courses they can edit. Session auth via studio.env.

# iblai-api-studio-course-create

Create the course shell that every other `/iblai-api-studio-*` skill fills.
One call, one course key. Studio on ibl.ai exposes a management endpoint that
also registers the course in the ibl.ai catalog and gives the creator the
course-instructor role — use it, not the stock Studio route.

## Auth & conventions

- **Base URL:** `$STUDIO_URL` (`https://studio.learn.iblai.app`; test: `https://studio.learn.iblai.org`).
- **Auth:** Studio session cookies + CSRF from `studio.env` — run **`/iblai-api-studio-auth`** first.
- **Snippet used below:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- **Org key:** `STUDIO_ORG` in `studio.env` (the organization's key, e.g. `acme`) — ask if unset; never invent one and never use `main`.
- Course keys in **query strings must be URL-encoded**; in paths they may be raw.
- There is **no delete-course API**. Creating is not reversible from here — confirm the org, number and run with the user first.

## Reads

- **GET** `/api/contentstore/v2/home/courses?page=1&search=<text>` — the signed-in user's courses (paginated):
  `{count, num_pages, next, previous, results: {courses: [{course_key, display_name, org, number, run, url, cms_link, lms_link, rerun_link, is_active}], in_process_course_actions: []}}`.
  `search` matches the display name. (`/api/contentstore/v1/home/courses` returns the same unpaginated as `{courses, archived_courses}`.)
- **GET** `/api/ibl/manage/course/?course_key=<url-encoded key>` — one course's summary:
  `{course_key, org, number, run, display_name, url}`. `400 {"error":"course_key parameter is required"}` without the param; `404` if unknown.
- **GET** `/xblock/outline/block-v1:<org>+<number>+<run>+type@course+block@course` — the course root as Studio sees it (`display_name`, `published`, `has_changes`, `start`, `course_graders`, `child_info.children` = sections). Detailed in `/iblai-api-studio-section`.
- **GET** `/api/ibl/users/manage/roles/?username=$STUDIO_USERNAME` — the user's edX roles: `[{role, org, course}]`. Creating needs `org-instructor` (or `course-creator` / `org-course-creator`) for the target org.

## Writes

- **POST** `/api/ibl/manage/course/` — create a course. Confirm with the user first.
  ```json
  { "org": "acme", "display_name": "Intro to Data", "number": "DATA101", "run": "2026-T1" }
  ```
  `org` and `display_name` are required. `number` and `run` are optional: when
  omitted Studio assigns `C<n>` (next free number in the org) and the current
  `YYYY-MM`. Response `200`:
  ```json
  { "url": "/course/course-v1:acme+DATA101+2026-T1", "course_key": "course-v1:acme+DATA101+2026-T1" }
  ```
  Side effects: the caller becomes `course-instructor` + `course-staff` on it, is
  enrolled, and the course is registered in the ibl.ai catalog for that org
  (it shows in the LMS app's catalog immediately, empty and unpublished).

  Errors: `401` no/expired session → `/iblai-api-studio-auth`;
  `403 {"error": "Permission denied"}` — the user cannot create courses in that
  org, or `org` is missing → grant `org-instructor` via `/iblai-api-management`;
  `400 {"ErrMsg": "There is already a course defined with the same organization
  and course number…", "OrgErrMsg", "CourseErrMsg"}` — `org+number+run` exists
  (pick a new run, or reuse the existing key).

- The stock Studio `POST /course/` (`{org, number, run, display_name}`) exists
  but answers `403 "User does not have the permission to create courses in
  this organization"` for org instructors; only use it for global course
  creators, and prefer the endpoint above because of its catalog registration.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")

COURSE=$(curl "${S[@]}" -X POST "$STUDIO_URL/api/ibl/manage/course/" \
  -d "{\"org\":\"$STUDIO_ORG\",\"display_name\":\"Intro to Data\",\"number\":\"DATA101\",\"run\":\"2026-T1\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["course_key"])')
echo "$COURSE"                                   # course-v1:acme+DATA101+2026-T1
ROOT="block-v1:${COURSE#course-v1:}+type@course+block@course"   # parent_locator for sections
```

## Notes

- Derive the **course root block** as above; it is the `parent_locator` for
  `/iblai-api-studio-section` and the target for a whole-course publish.
- `number` and `run` become part of the key forever: letters, digits, `.`, `_`, `-`
  only, no spaces. Use a run that encodes the cohort (`2026-T1`, `self-paced`).
- A new course starts with `start` = `2030-01-01` (never released) and no
  content: set real dates in `/iblai-api-studio-settings`.
- Re-running with the same `number`+`run` fails; list first and reuse the key
  if the course already exists.
- LMS app URL to report: `$LMS_APP_URL/platform/<org>/courses/<course_key>`.
- Headless twin for AI-generated courses: `/iblai-api-course-create`.