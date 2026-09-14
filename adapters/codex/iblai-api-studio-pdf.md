# iblai-api-studio-pdf

> Add a PDF viewer component to an Open edX unit on Studio — enable the pdf advanced module on the course, upload the PDF as a course asset, create the pdf block, and save its title and href through the block's own save_pdf handler (the generic xblock update does not persist the file field). Use when the user wants a PDF, slides, a syllabus, a reading handout or any document displayed inline in a unit. Session auth via studio.env.

# iblai-api-studio-pdf

The `pdf` XBlock renders a PDF inline in the unit. It is an *advanced module*:
the course has to list it in `advanced_modules` before Studio will create one,
and it saves its fields through its own handler, not the generic xblock update.
Three steps: enable once per course → upload the file → create + save.

## Before you start

1. Preflight: `node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check` prints two `ok`s; otherwise run **`/iblai-api-studio-auth`** first — do not attempt the calls below.
2. A unit locator (`/iblai-api-studio-unit`, or the unit list from `/iblai-api-studio-outline` — the bulk builder cannot create `pdf` blocks, so they are always added here afterwards).
3. The PDF file on disk (compressed if large).

## Auth & conventions

- **Base URL:** `$STUDIO_URL`; Studio session cookies from `studio.env`.
- **Snippet:**
  ```bash
  set -a; . ./studio.env; set +a
  S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
  ```
- **Keys:** `COURSE` = `course-v1:…`; parent = a unit locator; the block is `…+type@pdf+block@<hex>`.
- Fields: `display_name` (title) and `href` (URL of the PDF — a course asset `/static/<file>.pdf` or an absolute `https://` URL).
- Draft until the unit is published (`/iblai-api-studio-publish`). DELETE is destructive — confirm with the user first.

## Reads

- **GET** `/settings/advanced/{COURSE}` — `{ …, "advanced_modules": { "value": ["pdf", …], … } }`; the block can be created only when `"pdf"` is in `value`.
- **GET** `/xblock/{pdf}` — `{ "display_name", "category": "pdf", "metadata": { "display_name" }, "published", "has_changes" }`. The `href` is **not** in `metadata`; read it from the studio view:
- **GET** `/xblock/{pdf}/studio_view` — `{ "html": "…<input id=\"edit_href\" … value=\"/static/syllabus.pdf\">…" }`; regex `id="edit_href"[^>]*value="([^"]*)"`.
- **GET** `/assets/{COURSE}/?asset_type=Documents&page_size=50` — uploaded PDFs (`assets[].portable_url` is the `/static/…` path to use).

## Writes

1. **Enable the module** (once per course; keeps the other entries):
   **POST** `/settings/advanced/{COURSE}` `{ "advanced_modules": { "value": ["pdf"] } }` → the full advanced-settings map with the new value. Read first and merge if `value` already lists other modules.
2. **Upload the PDF** (multipart, field `file`, no JSON content type):
   ```bash
   curl -s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
     -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" \
     -X POST "$STUDIO_URL/assets/$COURSE/" -F "file=@syllabus.pdf"
   ```
   → `{ "asset": { "display_name": "syllabus.pdf", "content_type": "application/pdf", "url": "/asset-v1:…+type@asset+block@syllabus.pdf", "portable_url": "/static/syllabus.pdf", "external_url": "https://<lms>/asset-v1:…", "id": "asset-v1:…", "locked": false, … }, "msg": "Upload completed" }`. Re-uploading the same filename replaces the asset.
3. **Create the block:** **POST** `/xblock/` `{ "parent_locator": "<unit>", "category": "pdf", "display_name": "Syllabus" }` → `{ "locator": "…+type@pdf+block@<hex>", "courseKey" }`.
   `400`/`500` here usually means step 1 was skipped.
4. **Save title + file:** **POST** `/xblock/{pdf}/handler/save_pdf`
   ```json
   { "display_name": "Syllabus", "href": "/static/syllabus.pdf" }
   ```
   → `{ "result": "success" }` (or `{ "result": "error", "message": "…" }`). This is the only call that persists `href`.
- **POST** `/xblock/{pdf}` `{ "metadata": { "display_name": "New title" } }` — rename only. Sending `href` or `url` in `metadata` is silently ignored or returns `500`; never use it for the file.
- **DELETE** `/xblock/{pdf}` → `204`. Confirm with the user first.

## Example

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
COURSE="course-v1:acme+DATA101+2026-T1"
UNIT="block-v1:acme+DATA101+2026-T1+type@vertical+block@645f5ded5f544adab9fb603c4afc3bac"

# 1. enable (merge with existing modules)
MODS=$(curl "${S[@]}" "$STUDIO_URL/settings/advanced/$COURSE" | python3 -c '
import sys,json; v=json.load(sys.stdin)["advanced_modules"]["value"]; print(json.dumps(sorted(set(v)|{"pdf"})))')
curl "${S[@]}" -X POST "$STUDIO_URL/settings/advanced/$COURSE" -d "{\"advanced_modules\":{\"value\":$MODS}}" >/dev/null

# 2. upload (multipart: same cookies/CSRF, no JSON content type)
U=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json")
STATIC=$(curl "${U[@]}" -X POST "$STUDIO_URL/assets/$COURSE/" -F "file=@syllabus.pdf" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["asset"]["portable_url"])')      # /static/syllabus.pdf

# 3 + 4. create and save
PDF=$(curl "${S[@]}" -X POST "$STUDIO_URL/xblock/" -d "{\"parent_locator\":\"$UNIT\",\"category\":\"pdf\",\"display_name\":\"Syllabus\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["locator"])')
curl "${S[@]}" -X POST "$STUDIO_URL/xblock/$PDF/handler/save_pdf" -d "{\"display_name\":\"Syllabus\",\"href\":\"$STATIC\"}"
```

## Notes

- `href` accepts `/static/<name>` (course asset, portable across reruns and hosts) or an absolute URL; use assets for anything the org owns. External URLs must allow embedding (no `X-Frame-Options: DENY`).
- The viewer is an inline reader; there is no download toggle in this block's fields — link the `external_url` from an `/iblai-api-studio-html` block if users need a download link.
- Verify with `studio_view` (regex above) after saving; the generic `GET /xblock/{pdf}` will always show only `display_name`.
- The `-F` upload must not carry `Content-Type: application/json`; the example uses a second header array without it.
- Large PDFs: Studio accepts uploads up to the deployment's limit (tens of MB); compress first when in doubt.