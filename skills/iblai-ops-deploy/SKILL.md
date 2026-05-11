---
name: iblai-ops-deploy
description: Deploy your ibl.ai app to Vercel (or other platforms)
globs:
alwaysApply: false
---

# /iblai-ops-deploy

Deploy your ibl.ai app frontend to a hosting platform. Currently supports
Vercel; extensible to other platforms.

## Prerequisites

- `VERCEL_TOKEN` set in `iblai.env`
- If missing or placeholder, ask the user once for their token and save it:
  ```bash
  echo 'VERCEL_TOKEN=<token>' >> iblai.env
  ```
  Token creation: https://vercel.com/account/tokens

## Deploy to Vercel

Run the CLI command:

```bash
iblai deploy vercel
```

The CLI auto-detects the deploy mode from `next.config` and adapts:

**Static mode** — when `next.config` sets `output: 'export'` (Tauri shells, fully-prerendered apps):

1. Builds the frontend (`pnpm build`)
2. Writes `out/vercel.json` with `cleanUrls` + SPA rewrite
3. Deploys `out/` to Vercel (public)
4. Disables Vercel authentication and password protection
5. Updates `src-tauri/tauri.conf.json` `devUrl` with the deployment URL (if Tauri is set up)
6. Prints the deployment URL

**Server mode** — when `output: 'export'` is **not** set (Next.js with server actions, dynamic routes, API routes, server-only env vars):

1. Deploys the repo root to Vercel (`--prod`); Vercel runs the Next.js build remotely
2. Disables Vercel authentication and password protection
3. **Uploads env vars from `.env.local`** to the Vercel project for production + preview environments. `NEXT_PUBLIC_*` keys are stored as `plain`; everything else as `encrypted`. Reserved (`VERCEL_*`, `NODE_ENV`, `VERCEL_TOKEN`) and placeholder values (`your-...`, empty) are skipped automatically. Idempotent: existing keys are PATCHed, new keys are POSTed.
4. **Rebuilds (no cache) if env vars changed** — `NEXT_PUBLIC_*` values are inlined into the client bundle at build time. The CLI reruns the deploy with `--force` and `VERCEL_FORCE_NO_BUILD_CACHE=1` in the environment after any create/update; without the no-cache hint, Vercel restores the previous build's compiled bundle and the new values never reach the client.
5. Updates `src-tauri/tauri.conf.json` `devUrl` if Tauri is set up
6. Prints the deployment URL

Override detection if needed:

```bash
iblai deploy vercel --mode static   # force static
iblai deploy vercel --mode server   # force server
```

## When to Deploy

- Before running dev builds (`iblai builds dev`, `iblai builds ios dev`, `iblai builds android dev`)
  so the WebView loads from a network URL
- After frontend changes when iterating on dev builds
- When sharing a preview URL

## Going Back to Local

To stop using the Vercel URL for mobile dev builds, remove `devUrl` from
`src-tauri/tauri.conf.json`. The WebView will load local static files again.

## Reference

- `iblai deploy vercel --help`
- [Vercel token management](https://vercel.com/account/tokens)
