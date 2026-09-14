# iblai-api-studio-settings

> Read and update an Open edX course's settings on Studio — schedule (start, end, enrollment dates), pacing, language, title/subtitle/description/short description/overview (about page), effort, intro video, course and banner images (asset upload), catalog fields that flow to the ibl.ai LMS app (subject, tags, level, topics, promotion, slug, agent), plus advanced settings such as advanced_modules. Use when the user says course settings, schedule & details, dates, description, about page, course image, intro video, self-paced, catalog tags, advanced settings, or upload a file. Session auth via studio.env.

# iblai-api-studio-settings

Course settings on ibl.ai Studio live behind one JSON endpoint that merges the
Open edX "Schedule & Details" fields with the ibl.ai catalog fields the user
app shows. Read it, send back only the keys you change. Files (course image,
banner, any asset) go through the assets endpoint first; advanced settings
(`advanced_modules` and friends) have their own endpoint.

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env` — run **`/iblai-api-studio-auth`** first.
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

## Reads

- **GET** `/api/ibl/v1/course_settings?course_key={CE}` → `{ "formData": { …59 keys… } }`:

  | Group | Keys |
  |---|---|
  | identity | `org`, `course_id` (number), `run`, `course_key`, `platform_key` (org key), `slug` |
  | schedule | `start_date`, `end_date`, `enrollment_start`, `enrollment_end`, `self_paced` (bool), `certificate_available_date`, `certificates_display_behavior` (`end` · `end_with_date` · `early_no_info`) |
  | about page | `title`, `subtitle`, `description`, `short_description`, `overview` (HTML), `about_sidebar_html`, `duration`, `effort` (e.g. `"3:00"` h:mm per week), `language` (`en`), `license`, `syllabus`, `learning_info` (list of strings), `instructor_info` (`{instructors: [{name, title, organization, image, bio}]}`), `pre_requisite_courses`, `entrance_exam_*` |
  | media | `intro_video` (YouTube video **id**, e.g. `dQw4w9WgXcQ`), `course_image_name` + `course_image_asset_path`, `banner_image_name` + `banner_image_asset_path`, `video_thumbnail_image_name` + `video_thumbnail_image_asset_path` |
  | ibl.ai catalog | `subject`, `tags` (list), `level`, `topics` (list), `promotion`, `audit_allowed`, `certificate_type`, `usage_limit`, `job_role`, `industry`, `custom`, `credential`, `social_team`, `social_channels`, `mentor_uuid` (agent attached to the course), `mentor_hidden`, `agent_content_mode`, `course_content_mode`, `agent_autoplay`, `agent_content_mode_audience`, `course_content_mode_audience`, `enable_agent_based_completion` |

- **GET** `/settings/advanced/{COURSE}` → `{ "<key>": { "value", "display_name", "help", "deprecated" }, … }` (about 68 keys: `advanced_modules`, `display_name`, `max_attempts`, `showanswer`, `rerandomize`, `days_early_for_beta`, `cert_html_view_enabled`, `discussion_*`, `mobile_available`, `invitation_only`, `catalog_visibility`, …).
- **GET** `/assets/{COURSE}/?page=0&page_size=50&sort=date_added&direction=desc&asset_type=Images|Documents|Audio|Code|Other&text_search=…` → `{ "assets": [ { "display_name", "content_type", "url", "portable_url", "external_url", "thumbnail", "id", "locked", "file_size", "date_added", "usage_locations" } ], "totalCount", "page", "pageSize", "start", "end" }`.
- **GET** `/api/ibl/manage/course/?course_key={CE}` → `{ course_key, org, number, run, display_name, url }` (display name only).

## Writes

- **POST** `/api/ibl/v1/course_settings` — merge-update; body = `course_key` + the keys to change (everything else is preserved). Response = the full updated settings object (top level, no `formData` wrapper).
  ```json
  { "course_key": "course-v1:acme+DATA101+2026-T1",
    "start_date": "2026-10-01T00:00:00Z", "enrollment_start": "2026-09-15T00:00:00Z", "self_paced": false,
    "title": "Intro to Data", "subtitle": "Reading, measuring, deciding",
    "short_description": "A six-week introduction to working with data.",
    "overview": "<section class=\"about\"><h2>About This Course</h2><p>…</p></section>",
    "effort": "3:00", "language": "en", "intro_video": "dQw4w9WgXcQ",
    "subject": "Data", "tags": ["data", "statistics"], "level": "beginner" }
  ```
  The LMS reads the same object back (`GET $LMS_URL/api/ibl/v1/course_metadata?course_key=…`) and the ibl.ai catalog picks up the catalog keys — nothing else to sync.
  To clear a value send `null` (or `""` for the string fields Studio stores as text).
- **Course image / banner:** upload, then point the settings at the asset:
  1. **POST** `/assets/{COURSE}/` multipart `file=@cover.png` (use `"${U[@]}"`) → `{ "asset": { "display_name": "cover.png", "url": "/asset-v1:…+type@asset+block@cover.png", "portable_url": "/static/cover.png", "external_url": "https://<lms>/asset-v1:…", "id": "asset-v1:…", … }, "msg": "Upload completed" }`.
  2. **POST** `/api/ibl/v1/course_settings` `{ "course_key": "…", "course_image_name": "cover.png", "course_image_asset_path": "/asset-v1:…+type@asset+block@cover.png" }` (same pair for `banner_image_*` and `video_thumbnail_image_*`; use `asset.url` for the `_asset_path`).
  - Same filename re-uploaded replaces the file (URL unchanged). **DELETE** `/assets/{COURSE}/{asset_id}` → `204` removes one (confirm with the user first); **POST** `/assets/{COURSE}/{asset_id}` `{ "locked": true }` → `201 { "locked": true }` restricts it to enrolled users.
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
curl "${S[@]}" -X POST "$STUDIO_URL/api/ibl/v1/course_settings" -d "$(python3 -c "import json;print(json.dumps({
  'course_key': '$COURSE', 'start_date': '2026-10-01T00:00:00Z', 'self_paced': False,
  'title': 'Intro to Data', 'short_description': 'A six-week introduction to working with data.',
  'course_image_name': '$1', 'course_image_asset_path': '$2', 'subject': 'Data', 'tags': ['data','statistics']}))")" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["start_date"], d["title"], d["course_image_asset_path"], d["subject"])'

curl "${S[@]}" "$STUDIO_URL/api/ibl/v1/course_settings?course_key=$CE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["formData"]["short_description"])'
```

## Notes

- A new course has `start_date: 2030-01-01` — users see "coming soon" until you set a real start. `enrollment_start` after "now" blocks self-enrollment.
- `self_paced: true` makes due dates relative and hides the schedule; set it before building subsections with due dates.
- `overview` is the about page HTML (`<section class="about">…</section>` blocks); keep the same authoring rules as `/iblai-api-studio-html`.
- `intro_video` takes the YouTube id only; the LMS turns it into `http://www.youtube.com/watch?v=<id>` in `media.course_video`.
- Catalog keys (`subject`, `tags`, `level`, …) are what the LMS app filters on; `mentor_uuid` attaches an ibl.ai agent to the course (get ids from `/iblai-api-agent-setting`).
- Verify what users see with `/iblai-api-studio-lms` (`course_metadata`, `courses/v1/courses/{key}`).