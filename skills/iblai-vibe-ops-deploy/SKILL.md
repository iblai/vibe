---
name: iblai-vibe-ops-deploy
description: Use this skill when the user asks to deploy, publish, host, share, or ship their ibl.ai app to the web — it deploys through the ibl.ai platform's hosting API (Vercel-backed) using only the platform API key in iblai.env (no Vercel account, token, or CLI), then updates devUrl in tauri.conf.json for mobile dev builds. For desktop/mobile native builds, see /iblai-vibe-ops-build.
globs:
alwaysApply: false
---

# /iblai-vibe-ops-deploy

Deploy your app's frontend through the ibl.ai platform's hosting API. The
platform holds the Vercel credential for your tenant — you need only the
`DOMAIN` / `PLATFORM` / `TOKEN` already in `iblai.env`. No Vercel account,
no Vercel token, no `vercel` CLI.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

**How it works:** zip the app, POST it to the platform's hosting endpoint,
poll until the build is READY. The app lands on
`https://<vercel_project_name>.vercel.app`, public by default (no Vercel
SSO/password protection to disable). POST again with the same `project`
slug to redeploy.

## Step 1: Config

Read `iblai.env` (values may contain spaces — do not `source` it):

```bash
val() { grep -m1 "^$1=" iblai.env | cut -d= -f2-; }
DOMAIN=$(val DOMAIN); PLATFORM=$(val PLATFORM); TOKEN=$(val TOKEN); USERNAME=$(val USERNAME)
AUTH="Authorization: Api-Token $TOKEN"
```

If `USERNAME` is empty, auto-detect the key owner's platform username and
persist it:

```bash
USERNAME=$(curl -s "https://api.$DOMAIN/dm/api/core/users/platforms/" -H "$AUTH" \
  | jq -r --arg p "$PLATFORM" '(.results // .) | first(.[] | select(.key == $p) | .username) // empty')
[ -n "$USERNAME" ] && echo "USERNAME=$USERNAME" >> iblai.env
```

If auto-detect comes back empty, ask the user once for their platform
username and append `USERNAME=…` to `iblai.env` the same way. Then:

```bash
BASE="https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM/users/$USERNAME"
```

## Step 2: Project slug + mode

```bash
PROJECT=$(jq -r .name package.json | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//' | cut -c1-64 | sed -E 's/-+$//')

grep -qs "output: *['\"]export" next.config.* && MODE=static || MODE=nextjs
```

`project` must match `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$` (max 64).
Keep the slug stable — the same slug redeploys the same project and URL.

## Step 3: Zip

Limits: zip ≤ 50 MB, ≤ 2000 files, ≤ 200 MB uncompressed. The platform
strips `.git/`, `node_modules/`, `__MACOSX/`, `.DS_Store`, and `iblai.env`
from the upload, but keeping them out of the zip keeps you under the
limits.

**Static mode** (`output: 'export'` — Tauri shells, fully-prerendered
apps): build, add the SPA rewrite file, zip the *contents* of `out/` at the
zip root:

```bash
pnpm build
printf '%s' '{"cleanUrls":true,"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}' > out/vercel.json
rm -f app.zip && (cd out && zip -qr ../app.zip .)
```

**Server mode** (no `output: 'export'` — server actions, API routes,
middleware all work): the platform installs from the lockfile and builds,
so zip the app *source* at the zip root. Run this as ONE block, in order —
`.env.production` is how the deployed server gets its runtime env (it rides
the zip deliberately; `.env*` is already gitignored by the starter), and
the guards abort the deploy loudly instead of shipping a broken app:

```bash
# 1. Regenerate runtime env from .env.local on every deploy (never stale)
grep -E '^(NEXT_PUBLIC_[A-Za-z0-9_]+|IBLAI_API_KEY|PAYWALL_[A-Za-z0-9_]+)=' .env.local | grep -vE '=$|=your-' > .env.production

# 2. Guard: the server needs its platform key
grep -q '^IBLAI_API_KEY=' .env.production || { echo "ABORT: IBLAI_API_KEY missing/placeholder — fill it in .env.local"; exit 1; }

# 3. Zip the source (src-tauri/target alone would blow the 50 MB cap)
rm -f app.zip
zip -qr app.zip . -x 'node_modules/*' '.git/*' '.next/*' 'out/*' 'coverage/*' \
  'playwright-report/*' 'test-results/*' 'src-tauri/target/*' 'src-tauri/gen/*' \
  '.env*.local' 'iblai.env' 'app.zip'

# 4. Proof: the runtime env actually made it into the upload
unzip -l app.zip | grep -q '\.env\.production' || { echo "ABORT: .env.production not in zip"; exit 1; }
```

(Skip guard 2 only if this app deliberately has no server-side platform
key.)

## Step 4: Deploy + poll

```bash
RESP=$(curl -s -X POST "$BASE/providers/vercel/hosting/deployment/" -H "$AUTH" \
  -F "file=@app.zip" -F "project=$PROJECT" -F "framework=$MODE")
ID=$(echo "$RESP" | jq -r .id)
APP_URL="https://$(echo "$RESP" | jq -r .vercel_project_name).vercel.app"
```

A `202` returns the project row (`{id, name, vercel_project_name, url,
push_state, …}`). Anything else → see the error table.

Poll until the build finishes (static deploys take seconds, server builds a
few minutes; give up after ~10 min):

```bash
STATE=BUILDING; TRIES=0
until [ "$STATE" = "READY" ] || [ "$STATE" = "ERROR" ] || [ $TRIES -ge 60 ]; do
  sleep 10; TRIES=$((TRIES+1))
  STATE=$(curl -s "$BASE/providers/vercel/hosting/deployment/$ID/" -H "$AUTH" \
    | jq -r '.deployment.ready_state')
done
echo "$STATE $APP_URL"
```

On `ERROR`, print the build log tail and fix what it reports:

```bash
curl -s "$BASE/providers/vercel/hosting/deployment/$ID/" -H "$AUTH" | jq -r '.build_log_tail'
```

Redeploy = rebuild the zip, POST again with the same `project`.

## Step 5: Update Tauri (if present)

If `src-tauri/tauri.conf.json` exists, set `build.devUrl` to the deployed
URL so mobile/desktop dev builds load the hosted frontend.

## Errors

| Status | Meaning | Fix |
|---|---|---|
| 400 | No Vercel credential stored for this tenant, or bad zip | A platform admin adds a "Vercel" integration credential in the platform credentials UI (or the instance provides one); for zip errors check the size/file-count limits |
| 402 | Deploy credit cost unmet | Top up platform credits |
| 409 | A push for this project is already in flight, or name collision | Wait for the running push to finish, or pick another `project` slug |
| 429 | Rate limited | Wait the `Retry-After` seconds, then retry |
| 502 | Vercel rejected the tenant's stored credential | Admin re-saves a valid credential in the credentials UI |

## Custom Domain (optional)

```bash
curl -s -X POST "$BASE/providers/vercel/hosting/dns/" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"project\": $ID, \"domain\": \"app.example.com\"}" | jq '.required_records'
```

Hand the returned `required_records` DNS instructions to the user — they
add them at their registrar. `GET` / `DELETE` on the same path list /
remove domains.

## When to Deploy

- Before running dev builds (`pnpm exec tauri dev`, `… tauri ios dev`,
  `… tauri android dev`) so the WebView loads from a network URL
- After frontend changes when iterating on dev builds
- When sharing a preview URL

## Going Back to Local

Remove `devUrl` from `src-tauri/tauri.conf.json`; the WebView loads local
static files again.
