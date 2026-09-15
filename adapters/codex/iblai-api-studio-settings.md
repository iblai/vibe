# iblai-api-studio-settings

> Read and update an Open edX course's settings on Studio — schedule (start, end, enrollment dates), pacing, language, title/subtitle/description/short description/overview (about page), effort, intro video, course and banner images (asset upload), catalog fields that flow to the ibl.ai LMS app (subject, tags, level, topics, promotion, slug, agent), plus advanced settings such as advanced_modules — and the ordering rules (settings before content, pacing before the course starts, enrollment before start). Use when the user says course settings, schedule & details, dates, description, about page, course image, intro video, self-paced, catalog tags, advanced settings, or upload a file. Session auth via studio.env; run the auth preflight first.

# iblai-api-studio-settings

Course settings on ibl.ai Studio live behind one JSON endpoint that merges the
Open edX "Schedule & Details" fields with the ibl.ai catalog fields the LMS app
shows. Read it, send back only the keys you change. Files (course image,
banner, any asset) go through the assets endpoint first; advanced settings
(`advanced_modules` and friends) have their own endpoint.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A course key from `/iblai-api-studio-course-create`.
3. **Do this before building content and before the first publish.** Three rules that Studio enforces silently:
   - **Pacing is locked once the course has started.** `self_paced` can only change while `start_date` is in the future; after that the endpoint returns `200` and echoes the old value. Decide pacing now. (Workaround for a started course: set `start_date` to a future date, flip `self_paced`, restore `start_date`.)
   - **Enrollment opens before the course starts:** `enrollment_start` must be earlier than `start_date` (and `enrollment_end`, if set, later than `enrollment_start`).
   - The `/iblai-api-studio-outline` builder publishes the whole course; set dates, description and images first so the catalog never shows a half-configured course.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` (its values are single-quoted — bash strips the quotes; any other parser must strip them too, or Studio answers 500: `/iblai-api-studio-auth`).
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  U=("${S[@]:0:11}")   # same headers without Content-Type, for multipart uploads
  ```
- `COURSE="course-v1:<org>+<number>+<run>"`; **URL-encode it in query strings** (`CE=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$COURSE")`).
- Dates are ISO 8601 UTC (`2026-10-01T00:00:00Z`) or `null`.
- Settings changes take effect on the LMS immediately (no publish step); content still needs `/iblai-api-studio-publish`.
- Do **not** use the stock `/settings/details/{course}` for writes: partial bodies return `500`.
- **Silent no-ops:** the settings endpoint answers `200` with the stored object even when a field was refused (pacing after start, unknown keys). Always compare the response with what you sent.

## Reads

- **GET** `/api/ibl/v1/course_settings?course_key={CE}` → `{ "formData": { …59 keys… } }`:

  | Group | Keys |
  |---|---|
  | identity | `org`, `course_id` (number), `run`, `course_key`, `platform_key` (org key), `slug` |
  | schedule | `start_date`, `end_date`, `enrollment_start`, `enrollment_end`, `self_paced` (bool), `certificate_available_date`, `certificates_display_behavior` (`end` · `end_with_date` · `early_no_info`) |
  | about page | `title`, `subtitle`, `description`, `short_description`, `overview` (HTML), `about_sidebar_html`, `duration`, `effort` (e.g. `"3:00"` h:mm per week), `language` (`en`), `license`, `syllabus`, `learning_info` (list of strings), `instructor_info` (`{instructors: [{name, title, organization, image, bio}]}`), `pre_requisite_courses`, `entrance_exam_*` |
  | media | `intro_video` (YouTube video **id**, e.g. `dQw4w9WgXcQ`), `course_image_name` + `course_image_asset_path`, `banner_image_name` + `banner_image_asset_path`, `video_thumbnail_image_name` + `video_thumbnail_image_asset_path` |
  | ibl.ai catalog | `subject`, `tags` (list), `level`, `topics` (list), `promotion`, `audit_allowed`, `certificate_type`, `usage_limit`, `job_role`, `industry`, `custom`, `credential`, `social_team`, `social_channels`, `mentor_uuid` (agent attached to the course), `mentor_hidden`, `agent_content_mode`, `course_content_mode`, `agent_autoplay`, `agent_content_mode_audience`, `course_content_mode_audience`, `enable_agent_based_completion` |

- **GET** `/settings/advanced/{COURSE}` → `{ "<key>": { "value", "display_name", "help", "deprecated" }, … }` (about 68 keys: `advanced_modules`, `display_name`, `max_attempts`, `showanswer`, `rerandomize`, `days_early_for_beta`, `cert_html_view_enabled`, `mobile_available`, `invitation_only`, `catalog_visibility`, …).
- **GET** `/assets/{COURSE}/?page=0&page_size=50&sort=date_added&direction=desc&asset_type=Images|Documents|Audio|Code|Other&text_search=…` → `{ "assets": [ { "display_name", "content_type", "url", "portable_url", "external_url", "thumbnail", "id", "locked", "file_size", "date_added", "usage_locations" } ], "totalCount", "page", "pageSize", "start", "end" }`.
- **GET** `/api/ibl/manage/course/?course_key={CE}` → `{ course_key, org, number, run, display_name, url }` (display name only).

## Writes

- **POST** `/api/ibl/v1/course_settings` — merge-update; body = `course_key` + the keys to change (everything else is preserved). Response = the full updated settings object (top level, no `formData` wrapper).
  ```json
  { "course_key": "course-v1:acme+DATA101+2026-T1",
    "enrollment_start": "2026-09-15T00:00:00Z", "start_date": "2026-10-01T00:00:00Z", "end_date": "2026-12-15T00:00:00Z",
    "self_paced": false, "language": "en",
    "title": "Intro to Data", "subtitle": "Reading, measuring, deciding",
    "short_description": "A six-week introduction to working with data.",
    "overview": "<section class=\"about\"><h2>About This Course</h2><p>…</p></section>",
    "effort": "3:00", "intro_video": "dQw4w9WgXcQ",
    "subject": "Data", "tags": ["data", "statistics"], "level": "beginner" }
  ```
  The LMS reads the same object back (`GET $LMS_URL/api/ibl/v1/course_metadata?course_key=…`) and the ibl.ai catalog picks up the catalog keys — nothing else to sync.
  To clear a value send `null` (or `""` for the string fields Studio stores as text).
- **Course image / banner:** upload, then point the settings at the asset:
  1. **POST** `/assets/{COURSE}/` multipart `file=@cover.png` (use `"${U[@]}"`) → `{ "asset": { "display_name": "cover.png", "url": "/asset-v1:…+type@asset+block@cover.png", "portable_url": "/static/cover.png", "external_url": "https://<lms>/asset-v1:…", "id": "asset-v1:…", … }, "msg": "Upload completed" }`.
  2. **POST** `/api/ibl/v1/course_settings` `{ "course_key": "…", "course_image_name": "cover.png", "course_image_asset_path": "/asset-v1:…+type@asset+block@cover.png" }` (same pair for `banner_image_*` and `video_thumbnail_image_*`; use `asset.url` for the `_asset_path`).
  - Same filename re-uploaded replaces the file (URL unchanged). **DELETE** `/assets/{COURSE}/{asset_id}` → `204` removes one (confirm with the user first); **POST** `/assets/{COURSE}/{asset_id}` `{ "locked": true }` → `201 { "locked": true }` restricts it to enrolled users. (The v1 `course/asset/upload` route returns `500` — use this one.)
- **POST** `/settings/advanced/{COURSE}` — merge-update of advanced settings, `{ "<key>": { "value": … } }`; response = the full map. Example: `{ "advanced_modules": { "value": ["pdf"] } }` (read first and merge lists), `{ "invitation_only": { "value": true } }`, `{ "catalog_visibility": { "value": "about" } }`, `{ "days_early_for_beta": { "value": 7 } }`. A bad value returns `400` with `[ { "key", "message", "model": { "value" } } ]` and nothing is saved.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
U=("${S[@]:0:11}")
COURSE="course-v1:acme+DATA101+2026-T1"; CE=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$COURSE',safe=''))")

IMG=$(curl "${U[@]}" -X POST "$STUDIO_URL/assets/$COURSE/" -F "file=@cover.png" \
  | python3 -c 'import sys,json; a=json.load(sys.stdin)["asset"]; print(a["display_name"], a["url"])')
set -- $IMG
cat > settings.json <<EOF
{"course_key": "$COURSE", "enrollment_start": "2026-09-15T00:00:00Z", "start_date": "2026-10-01T00:00:00Z",
 "self_paced": false, "title": "Intro to Data", "short_description": "A six-week introduction to working with data.",
 "course_image_name": "$1", "course_image_asset_path": "$2", "subject": "Data", "tags": ["data", "statistics"]}
EOF
curl "${S[@]}" -X POST "$STUDIO_URL/api/ibl/v1/course_settings" -d @settings.json \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["start_date"], d["enrollment_start"], d["self_paced"], d["title"], d["subject"])'
# compare: every printed value must equal what settings.json sent
```

## Notes

- A new course has `start_date: 2030-01-01` — users see "coming soon" until you set a real start; `enrollment_start` after "now" blocks self-enrollment.
- `self_paced: true` makes due dates relative and hides the schedule; set it before building subsections with due dates, and before the start date passes (see above).
- `overview` is the about page HTML (`<section class="about">…</section>` blocks); keep the authoring rules of `/iblai-api-studio-html`.
- `intro_video` takes the YouTube id only; the LMS turns it into `http://www.youtube.com/watch?v=<id>` in `media.course_video`.
- Catalog keys (`subject`, `tags`, `level`, …) are what the LMS app filters on; `mentor_uuid` attaches an ibl.ai agent to the course (ids from `/iblai-api-agent-setting`).
- Verify what users see with `/iblai-api-studio-lms` (`course_metadata`, `courses/v1/courses/{key}`).