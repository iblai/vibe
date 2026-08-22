# iblai-vibe-ops-deploy

> Use this skill when the user asks to deploy, publish, host, share, or ship their ibl.ai app to the web — it deploys through the ibl.ai platform's hosting API (Vercel-backed) using only the platform API key in iblai.env (no Vercel account, token, or CLI), then updates devUrl in tauri.conf.json for mobile dev builds. Also covers deploying to infrastructure the team controls — a container on their own server, on-prem, Cloud Run, Kubernetes — and to any static host. For desktop/mobile native builds, see /iblai-vibe-ops-build.

# /iblai-vibe-ops-deploy

Deploy your app's frontend through the ibl.ai platform's hosting API. The
platform holds the Vercel credential for your tenant — you need only the
`DOMAIN` / `PLATFORM` / `TOKEN` already in `iblai.env`. No Vercel account,
no Vercel token, no `vercel` CLI.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

**How it works:** zip the app, POST it to the platform's hosting endpoint,
poll until the build is READY. The app lands on the `*.vercel.app` URL the
API reports (never derived from the project name), public by default (no Vercel
SSO/password protection to disable). POST again with the same `project`
slug to redeploy.

## Which target

Platform hosting (Steps 1–5 below) is the default and covers most asks. It is
**not** the right answer when the app has to run on infrastructure the team
controls:

- The user said *server*, *on-prem*, *self-host*, *our own VM*, *Docker*,
  *Kubernetes*, *air-gapped*, or named an internal hostname → **container**,
  see [`references/docker-deploy.md`](references/docker-deploy.md).
- The project already has a `Dockerfile` / `docker-compose.yml` /
  `entrypoint.sh` (skillsai and mentorai both do) → **container**. Deploy the
  way the project already deploys.
- No `package.json`, or the app is plain HTML/JS served from a directory →
  **static host** (see the section near the end), or a container, which adds
  rewrites and runtime config a bare static host cannot do.

If the target is a compliance or data-residency decision — a school district, a
health system, a government tenant — do not pick it for them. Ask.

## Step 1: Config

Read `iblai.env` (values may contain spaces — do not `source` it). The
platform username comes from the `IBLAI_USERNAME` environment variable when
the host provides it (the ibl.ai desktop app exports it), else from
`iblai.env`. (Never name the variable `USERNAME` — zsh binds that to the OS
login name and silently discards assignments.)

```bash
val() { grep -m1 "^$1=" iblai.env | cut -d= -f2-; }
DOMAIN=$(val DOMAIN); PLATFORM=$(val PLATFORM); TOKEN=$(val TOKEN)
IBLAI_USERNAME="${IBLAI_USERNAME:-$(val IBLAI_USERNAME)}"
[ -n "$IBLAI_USERNAME" ] || IBLAI_USERNAME=$(val USERNAME)   # legacy iblai.env key
AUTH="Authorization: Api-Token $TOKEN"
```

If `IBLAI_USERNAME` is still empty, ask the user once for their platform
username and persist it: append `IBLAI_USERNAME=…` to `iblai.env`. Do not
try to auto-detect it and do not pre-verify the token — a wrong username or
token fails loudly on the first deploy call below. Then:

```bash
BASE="https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME"
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
grep -E '^(NEXT_PUBLIC_[A-Za-z0-9_]+|IBLAI_API_KEY|PAYWALL_[A-Za-z0-9_]+|CSP_MODE)=' .env.local | grep -vE '=$|=your-' > .env.production

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
# The live URL is Vercel's to mint — NEVER build it from the project name
# (long names get right-truncated, collisions get a hash suffix). `.url` is
# the confirmed host from a previous deploy; empty on the very first one —
# the poll below fills it from the deployment's alias list.
APP_URL=$(echo "$RESP" | jq -r '.url // empty')
```

A `202` returns the project row (`{id, name, vercel_project_name, url,
vercel_alias, push_state, …}`). Anything else → see the error table.

Poll until the build finishes (static deploys take seconds, server builds a
few minutes; give up after ~10 min):

```bash
STATE=BUILDING; TRIES=0
until [ "$STATE" = "READY" ] || [ "$STATE" = "ERROR" ] || [ "$STATE" = "PUSH_FAILED" ] || [ $TRIES -ge 60 ]; do
  sleep 10; TRIES=$((TRIES+1))
  R=$(curl -s "$BASE/providers/vercel/hosting/deployment/$ID/" -H "$AUTH")
  case "$(echo "$R" | jq -r .push_state)" in
    failed) echo "push failed: $(echo "$R" | jq -r .push_error)"; STATE=PUSH_FAILED ;;
    # .deployment is the PREVIOUS deployment until the new push lands — read
    # it only after push_state reaches "pushed", or a stale READY masks failure
    pushed)
      STATE=$(echo "$R" | jq -r '.deployment.ready_state // "BUILDING"')
      # The deployment's alias list is the authoritative live host.
      ALIAS=$(echo "$R" | jq -r '.deployment.aliases[0] // empty')
      [ -n "$ALIAS" ] && APP_URL="https://$ALIAS" ;;
  esac
done
echo "$STATE ${APP_URL:-'(URL not reported yet)'}"
```

If `APP_URL` is still empty on READY, re-poll the detail endpoint and read
`.deployment.aliases[0]` — tell the user the URL is not confirmed yet rather
than guessing one from the project name.

On `PUSH_FAILED`, the printed `push_error` says why the upload never reached
Vercel (fix it, rebuild the zip, POST again). On `ERROR`, print the build
log tail and fix what it reports:

```bash
curl -s "$BASE/providers/vercel/hosting/deployment/$ID/" -H "$AUTH" | jq -r '.build_log_tail'
```

Redeploy = rebuild the zip, POST again with the same `project`.

## Step 5: Update Tauri (if present)

If `src-tauri/tauri.conf.json` exists and `APP_URL` is known, set
`build.devUrl` to it so mobile/desktop dev builds load the hosted frontend.
(Skip while the URL is unconfirmed — never write a guessed one.)

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

## Deploy to a server the team controls

Full recipe — Dockerfile (Next.js and static shapes), nginx routes,
entrypoint, compose, TLS, CI smoke test — in
[`references/docker-deploy.md`](references/docker-deploy.md). The shape:

```bash
docker build -t <app> .
docker run -d -p 8080:8080 \
  -e NEXT_PUBLIC_IBL_PLATFORM=<tenant> \
  -e NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app \
  <app>
```

Two rules decide whether the deploy survives contact with a second
environment:

- **One image, every environment.** No tenant, no backend, no customer baked
  in. The digest that passed staging is the digest that runs production, and
  repointing is a restart. See *Runtime configuration* below — do that part
  before containerizing, not after.
- **Reproduce the SSO callback route.** The ibl.ai Auth SPA returns to
  `<origin>/sso-login-complete`. A static server that does not map that path
  404s the callback and login dies with no useful error. Next.js routing
  handles it; nginx, S3 and GitHub Pages do not, unless told.

## Static host

For an app with no build step, or an existing bucket/host:

1. Render the config file the browser reads (below) for the *target*
   environment, not the developer's.
2. Upload the served directory.
3. Reproduce the `/sso-login-complete` → `/sso-login-complete.html` rewrite in
   the host's config.
4. Serve that config file `Cache-Control: no-store`. Cached, a repointed
   deployment keeps sending returning users to the old backend — and it looks
   like the repoint silently failed.

## Runtime configuration

Read [`references/runtime-config.md`](references/runtime-config.md) before any
deploy that is not throwaway.

An ibl.ai frontend is defined by which backend it talks to. Baked in at build
time — inlined `NEXT_PUBLIC_*`, a hand-edited committed config — those values
make an artifact that can only ever be one environment: staging and production
become different builds, and repointing means a rebuild. Rendering them at
process start from the environment is what every ibl.ai app that ships to a
server already does (`window.__ENV__` in skillsai/mentorai).

## Every target: the tenant has to know the origin

Add the deployment's origin to the tenant's **allowed redirect origins**.
Sign-in leaves for the login SPA and returns to `<origin>/sso-login-complete`;
an origin the tenant does not know is a login that never comes back — and the
symptom looks like a broken app, not a missing setting.

## When to Deploy

- Before running dev builds (`pnpm exec tauri dev`, `… tauri ios dev`,
  `… tauri android dev`) so the WebView loads from a network URL
- After frontend changes when iterating on dev builds
- When sharing a preview URL
- When handing an app to someone who has to run it on their own
  infrastructure — that is the container path, and it is worth setting up
  before they ask

## Going Back to Local

Remove `devUrl` from `src-tauri/tauri.conf.json`; the WebView loads local
static files again.

## Reference

- Container/server: [`references/docker-deploy.md`](references/docker-deploy.md)
- Runtime config: [`references/runtime-config.md`](references/runtime-config.md)