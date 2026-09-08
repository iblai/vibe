# Security model of a vibe app

What credentials exist, where each one lives, why, and what that means for
you. Written for the reader of
[iblai/vibe#167](https://github.com/iblai/vibe/issues/167) ("Auth tokens and
tenant state stored in plain localStorage") and for anyone doing a security
review of an app built from vibe-starter.

## Two kinds of credential

| | Session tokens | Platform API Token |
|---|---|---|
| What | `axd_token`, `dm_token`, `edx_jwt_token` (+ `userData`, `tenants`, `current_tenant`) | `IBLAI_API_KEY` (`TOKEN` in `iblai.env`) |
| Whose authority | the signed-in **user** — exactly their permissions in exactly their org | the **organization** — admin-level, org-scoped |
| Where it lives | the browser's `localStorage` for the app's origin | the server's environment only (`.env.local`, the hosting platform's env); `config.apiKey()` returns `""` in the browser by construction |
| Sent as | `Authorization: Token <dm_token>` by the SDK; `Bearer` on the AXD host | `Authorization: Api-Token <key>`; `Bearer` only on the OpenAI-compatible `/v1` |
| Lifetime | short; `*_expires` companions; refreshed by the SSO flow | until deleted in the OS (Integrations → APIs) |
| Threat it is exposed to | XSS on your origin (anything that runs JS on your page can read it) | server compromise, leaked env, a commit of `.env.local` |

## Why session tokens are in localStorage

The platform's sign-in is a hosted SSO flow: `login.iblai.app` authenticates
the user and returns them to your app at `/sso-login-complete` with the token
set in the URL, which `SsoLogin` stores. Every ibl.ai front end (the OS, the
LMS, vibe apps, the embeddable chat) shares this design:

- **Cross-app sync.** `AuthProvider`'s `enableStorageSync` lets several
  ibl.ai front ends on related origins observe one sign-in/sign-out.
- **No app server needed.** vibe apps can be fully static or run in a Tauri
  WebView with no session backend; the SDK's RTK Query layer attaches the
  token itself.
- **Multi-org routing.** `tenants` (the orgs the user belongs to, with
  `is_admin`) is what `TenantProvider` uses to decide the user may enter the
  org the app is pinned to — before any API call.

An httpOnly-cookie session would need a first-party backend on every origin,
which is exactly what this design avoids. The trade-off is that **XSS is the
threat model**, so the template invests in the mitigation for XSS:

## Content Security Policy

`middleware.ts` calls the SDK's `applyCsp`, which sets a per-request,
nonce-based CSP with `strict-dynamic`:

- **Production builds enforce** by default (the SDK's own resolution).
- **`next dev` runs report-only** so React Refresh / `eval()` and the error
  overlay work — the template passes `mode: 'report-only'` only when
  `NODE_ENV === 'development'`, which Next inlines per build command.
- **Runtime override:** `CSP_MODE=report-only` (validated by the SDK; unknown
  values fall safe to report-only). Use it to diagnose a blocked third-party
  script in production, then remove it.
- `app/layout.tsx` sets `dynamic = "force-dynamic"` because a statically
  prerendered page would ship nonce-less `<script>` tags that enforce mode
  blocks.

Check what a deployed app sends: `curl -sI https://<your-app>/ | grep -i content-security-policy`.

## What the template does with the Platform API Token

- It is read only in server files (`lib/iblai/platform.ts`, `app/api/**`).
- Every admin route first proves **who** is calling (the browser forwards its
  session `dm_token`; the server verifies it against
  `GET /dm/api/core/token/verify/`) and **that they administer the org**
  (`requireAdmin`), and only then acts with the org's key.
- `iblai.env*` and `.env*` are gitignored; the `/iblai-vibe-ops-init` skill
  never echoes the token; `/iblai-vibe-ops-deploy` passes it to the hosting
  platform as a server env var.
- `.npmrc` (written by ops-init) pins `minimum-release-age` and
  `save-exact` to blunt supply-chain attacks on dependencies.

## What you should still do

- Keep third-party scripts out of the app, or add them with the nonce.
- Never put a secret in org metadata (it is a public read) or in user
  metadata (readable by the user and org admins).
- Rotate the Platform API Token if it ever appears in a log or a transcript
  (Integrations → APIs → delete, then Add API).
- For a Tauri build, the WebView origin is the app; the same rules apply.
  Mobile sign-in goes through the system browser and returns via a custom
  scheme — list that scheme in the org's allowed redirect origins.

Related: [glossary.md](glossary.md) · `/iblai-vibe-auth` · `/iblai-vibe-api` · `/iblai-vibe-ops-deploy`.
