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

This single command handles the full flow:

1. Builds the frontend (`pnpm build`)
2. Writes `out/vercel.json` with `cleanUrls` + SPA rewrite
3. Deploys `out/` to Vercel (public)
4. Disables Vercel authentication and password protection
5. Updates `src-tauri/tauri.conf.json` `devUrl` with the deployment URL (if Tauri is set up)
6. Prints the deployment URL

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
