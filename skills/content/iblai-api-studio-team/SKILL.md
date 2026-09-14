---
name: iblai-api-studio-team
description: Manage an Open edX course team on Studio — list who can edit a course, add a user as staff or instructor by email, change their role, and remove them; check a user's edX roles across courses. Use when the user says course team, add an instructor, give someone edit access, co-author, staff vs admin/instructor, or remove someone from the course. Session auth via studio.env. For the build order and the other Studio skills, see /iblai-api-studio.
metadata:
  kind: api
---

# iblai-api-studio-team

The course team is who can open the course in Studio. Two roles: **staff**
(edit content and settings) and **instructor** (staff + manage the team; Studio
calls it "Admin"). Members are addressed by **email** and must already have an
account on the LMS. Org-level access (`org-instructor`, `course-creator`) is
not managed here — that is `/iblai-api-management`.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A course key; the signed-in user must be an **instructor** on it (the creator is).
3. The member's account email (they need an LMS account already — `/iblai-api-invite` otherwise).

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env`.
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- `COURSE="course-v1:<org>+<number>+<run>"` (raw in paths); `{email}` is the member's account email.
- Only instructors can change the team; staff get `403`.
- Removing a member is outward-facing (they lose access at once) — confirm with the user first.

## Reads

- **GET** `/course_team/{COURSE}/{email}` → `{ "email", "active": true, "role": "instructor" | "staff" | null }` (`null` = not on the team). `404 {"error": "Could not find user by email address '…'."}` when no such account.
- **List the team** — there is no JSON list route; the team page embeds it. Fetch the page as HTML and pull the array:
  ```bash
  curl -s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "Accept: text/html" "$STUDIO_URL/course_team/$COURSE" \
    | python3 -c 'import sys,re,json; h=sys.stdin.read(); m=re.search(r"ManageCourseUsersFactory\(.*?(\[\{.*?\}\])", h, re.S); print(json.dumps(json.loads(m.group(1)), indent=1))'
  ```
  → `[ { "id": 2300, "username": "jdoe", "email": "jdoe@example.com", "role": "instructor" }, … ]`.
- **GET** `/api/ibl/users/manage/roles/?username={username}` → `[ { "role": "course-instructor" | "course-staff" | "org-instructor" | …, "org", "course": "course-v1:…" | "" } ]` — every edX role one user holds (same route on the LMS host). Handy to confirm access without the page scrape.

## Writes

- **POST** `/course_team/{COURSE}/{email}` `{ "role": "staff" }` or `{ "role": "instructor" }` → `204`. Adding also enrolls the user in the course. Sending a new role for an existing member changes it. Errors: `404` unknown email; `400 {"error": "You may not remove the last Admin. Add another Admin first."}` when demoting the only instructor.
- **DELETE** `/course_team/{COURSE}/{email}` → `204`. Confirm with the user first. `400 {"error": "You may not remove the last Admin. Add another Admin first."}` protects the last instructor.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"

curl "${S[@]}" -o /dev/null -w '%{http_code}\n' -X POST "$STUDIO_URL/course_team/$COURSE/ta@example.com" -d '{"role":"staff"}'   # 204
curl "${S[@]}" "$STUDIO_URL/course_team/$COURSE/ta@example.com"                                                            # {"email":…,"role":"staff"}
```

## Notes

- Emails are matched to LMS accounts; invite people to the organization first (`/iblai-api-invite`) if the lookup returns `404`.
- The course creator is instructor + staff automatically (`/iblai-api-studio-course-create`).
- `staff` can publish content; only `instructor` can add/remove team members and delete the course from the UI.
- User enrollment is a different thing — `/iblai-api-studio-lms`.
