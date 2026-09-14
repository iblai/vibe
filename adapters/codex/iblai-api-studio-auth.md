# iblai-api-studio-auth

> Sign in to Open edX Studio (studio.learn.iblai.app) and the LMS from a browser window the user controls, capture the session cookies (studio_session_id, sessionid, csrftoken) with the bundled Playwright script, verify them, and write the gitignored studio.env that every /iblai-api-studio-* skill reads; --check validates an existing session in one command. Use first whenever the user wants to author or configure an Open edX course from the terminal, and again when a Studio call answers 302 to /login, 403 CSRF, or an HTML "Studio Server Error" page. Session auth only — no Api-Token, no password handling.

# iblai-api-studio-auth

Studio (the Open edX CMS) has no token API for authoring: every authoring
endpoint is guarded by a **Django session cookie + CSRF token**. This skill
captures that session from a browser the user signs into, verifies it against
Studio **and** the LMS (the LMS side shares the same login), and stores it
in `studio.env`. Run it once per host; sessions last about two weeks.

## Preflight — run this before any other Studio skill

```bash
node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --check && grep -q '^STUDIO_ORG=.\+' studio.env && echo "STUDIO_ORG set" || echo "MISSING: run /iblai-api-studio-auth and set STUDIO_ORG in studio.env"
```

`--check` prints `studio: ok · lms: ok` and exits 0 when both sessions work,
exits 2 when the file is missing or a session expired. Every other
`/iblai-api-studio-*` skill starts with this line; when it fails, come back
here instead of retrying calls.

## What gets written

| Key | Value | Used by |
|---|---|---|
| `STUDIO_URL` | `https://studio.learn.iblai.app` (default) — test server `https://studio.learn.iblai.org` | every `/iblai-api-studio-*` skill |
| `LMS_URL` | `https://learn.iblai.app` (derived: strip `studio.`) | `/iblai-api-studio-lms`, verification links |
| `LMS_APP_URL` | `https://lms.ibl.ai` (test: `https://lms.iblai.org`) — the app users open | course URLs in reports |
| `STUDIO_ORG` | org key used as the `org` when creating courses (set by hand once; the script preserves it) | `/iblai-api-studio-course-create` |
| `STUDIO_USERNAME` | the signed-in username (read from `GET $LMS_URL/api/user/v1/me`) | LMS calls that need `username` |
| `STUDIO_SESSION` / `STUDIO_CSRF` | Studio cookies `studio_session_id` / `csrftoken` | Studio `-b` cookie + `X-CSRFToken` |
| `LMS_SESSION` / `LMS_CSRF` | LMS cookies `sessionid` / `csrftoken` | LMS `-b` cookie + `X-CSRFToken` |
| `STUDIO_SESSION_EXPIRES` | cookie expiry (ISO) | "is it still valid?" without a request |

The file is `chmod 600` and the script adds it to `.gitignore`. **Never print a
session value** — the script prints `****` + last four only.

### Reading the file from a script (not just the shell)

Session values are **single-quoted** because Django session ids contain `|`
and `:`. `set -a; . ./studio.env; set +a` strips the quotes; a naive parser
does not, and Studio answers a malformed cookie with **HTTP 500 and an HTML
"Studio Server Error" page**, not 401/403. Strip them:

```python
import re
env = {m[1]: m[2].strip().strip("'") for m in (re.match(r"^([A-Z_]+)=(.*)$", l) for l in open("studio.env")) if m}
```

```js
const env = Object.fromEntries([...fs.readFileSync("studio.env","utf8").matchAll(/^([A-Z_]+)=(.*)$/gm)].map(([,k,v]) => [k, v.trim().replace(/^'(.*)'$/, "$1")]));
```

Sanity check: `len(env["STUDIO_SESSION"])` is the cookie length (typically 187), with no quote characters.

## Steps

1. **Run the capture script** from the project directory (needs Node 18+; uses
   Google Chrome / Edge if installed, else Playwright's Chromium; installs
   `playwright-core` into `~/.cache/iblai-studio/` once if no Playwright is
   resolvable — no browser download):

   ```bash
   node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs                       # production
   node .claude/skills/iblai-api-studio-auth/scripts/studio-login.mjs --studio https://studio.learn.iblai.org   # test server
   ```

   A browser window opens on `$STUDIO_URL/home`. Tell the user to **sign in
   there themselves** (Studio redirects to the LMS login, then back). Never type
   credentials for them. The script polls once a second for the
   `studio_session_id` + `sessionid` cookies, verifies both, writes the file,
   closes the browser, and prints one line:

   ```
   connected: studio.learn.iblai.app as <username> · session ****ab12 · expires 2026-09-28 → /path/studio.env
   ```

   Flags: `--out <file>` (default `./studio.env`), `--lms <url>`, `--lms-app <url>`,
   `--profile <dir>` (browser profile, default `~/.cache/iblai-studio/profile-<host>`
   — re-runs skip the login while the browser session lasts), `--timeout <s>`
   (default 300). Exit 1 = timed out waiting for a sign-in.

2. **Set the org key** (once): `STUDIO_ORG=<org key>` in `studio.env`. Course
   creation needs the key of the organization the user authors in (the path
   segment after `/platform/` on os.ibl.ai, or `PLATFORM` in `iblai.env`). If
   you do not know it, list the user's roles — `org-instructor` rows carry it:

   ```bash
   set -a; . ./studio.env; set +a
   curl -s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "Accept: application/json" \
     "$STUDIO_URL/api/ibl/users/manage/roles/?username=$STUDIO_USERNAME"     # [{"role":"org-instructor","org":"acme","course":""}, …]
   ```

3. **Verify** with the preflight line above.

## No browser available?

Have the user copy the cookies from DevTools (Application → Cookies) on a
signed-in Studio tab: `studio_session_id`, `csrftoken`; and on a signed-in LMS
tab: `sessionid`. Write `studio.env` yourself with the keys above (single-quote
the values), `chmod 600`, add it to `.gitignore`, then run `--check`. Ask for
cookies in a file or env var, never pasted into the chat when avoidable.

## How every Studio call is made (the snippet other skills reuse)

```bash
set -a; . ./studio.env; set +a
S=(-s -b "studio_session_id=$STUDIO_SESSION; csrftoken=$STUDIO_CSRF" -H "X-CSRFToken: $STUDIO_CSRF" \
   -H "Origin: $STUDIO_URL" -H "Referer: $STUDIO_URL/" -H "Accept: application/json" -H "Content-Type: application/json")
curl "${S[@]}" "$STUDIO_URL/api/contentstore/v2/home/courses"
```

- `Accept: application/json` is mandatory — the same URLs return HTML pages without it.
- `X-CSRFToken` + `Origin`/`Referer` on the Studio origin are required on every
  POST/PUT/PATCH/DELETE (Django CSRF checks `Origin` on HTTPS).
- LMS calls use `-b "sessionid=$LMS_SESSION; csrftoken=$LMS_CSRF" -H "X-CSRFToken: $LMS_CSRF" -H "Origin: $LMS_URL" -H "Referer: $LMS_URL/"`.

## Reading failures

| You see | It means | Do |
|---|---|---|
| `302` → `/login/…` (Studio), `401` (LMS API) | session expired or missing | re-run step 1 |
| `403` mentioning CSRF | `X-CSRFToken`/`Origin` missing or stale csrftoken | resend with the snippet; re-run step 1 if it persists |
| `403 {"error":"Permission denied"}` / `"You do not have permission…"` | signed in, but not staff/instructor on that org or course | `/iblai-api-studio-team`, `/iblai-api-management` |
| `500` + HTML "Studio Server Error" on a documented call | almost always a **malformed cookie** (quotes, truncation, wrong file) — or a parameter the skill flags as broken | run `--check`; compare cookie length; re-read the skill's notes |
| HTML page instead of JSON with `200` | missing `Accept: application/json` | add the header |

## Notes

- One `studio.env` = one host. Switching between production and the test server
  means re-running with `--studio` (or keeping two files and `--out`).
- The script never sees or stores a password; the browser profile directory
  under `~/.cache/iblai-studio/` holds the browser's own cookies — delete it to
  force a fresh login.
- Studio's session is created by an OAuth round trip through the LMS
  (`/login/edx-oauth2/` → LMS login → `/complete/edx-oauth2/`), which is why
  the LMS `sessionid` is always available too and why both are captured.
- Headless/CI: there is no service-account path for Studio authoring. For
  org-level user and role administration use `/iblai-api-management`
  (Api-Token); for catalog and enrollment data use `/iblai-api-catalog`.
- Family index and build order: `/iblai-api-studio`.