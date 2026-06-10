# iblai-ops-deploy

> Deploy your ibl.ai app to Vercel (or other platforms)

# /iblai-ops-deploy

Deploy your ibl.ai app frontend to a hosting platform. Currently supports
Vercel; extensible to other platforms.

> **Command reference:** the full deploy behavior — static
> vs server mode detection, scope resolution, env-var sync, auth-disable, and
> the `tauri.conf.json` `devUrl` update — is in
> [`references/deploy-command.md`](references/deploy-command.md).

## Prerequisites

- `VERCEL_TOKEN` set in `iblai.env`
- If missing or placeholder, ask the user once for their token and save it:
  ```bash
  echo 'VERCEL_TOKEN=<token>' >> iblai.env
  ```
  Token creation: https://vercel.com/account/tokens

## Deploy to Vercel

Run the deploy with the `vercel` CLI directly. First detect the mode from
`next.config` (`output: 'export'` ⇒ static, else server).

**Static mode** — `output: 'export'` is set (Tauri shells, fully-prerendered apps):

```bash
pnpm build
# write out/vercel.json: {"cleanUrls":true,"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}
npx vercel deploy out/ --token="$VERCEL_TOKEN" --yes --public   # add --scope <team> if scoped
```

**Server mode** — `output: 'export'` is **not** set (server actions, dynamic
routes, API routes):

```bash
npx vercel deploy --prod --token="$VERCEL_TOKEN" --yes --public   # add --scope <team> if scoped
```

Then, regardless of mode:

1. **Disable Vercel auth** — PATCH the project's `ssoProtection` and
   `passwordProtection` to `null` via the Vercel API so the deploy is public.
2. **Server mode only — sync env + rebuild:** push `.env.local` to the
   project (production + preview; `NEXT_PUBLIC_*` as `plain`, everything else
   `encrypted`; skip `VERCEL_*` / `NODE_ENV` / `VERCEL_TOKEN` / `your-…`
   placeholders; PATCH existing keys, POST new ones). If any key changed,
   redeploy with `--force` and `VERCEL_FORCE_NO_BUILD_CACHE=1` so the
   `NEXT_PUBLIC_*` values re-inline into the client bundle.
3. **Update Tauri** — set `src-tauri/tauri.conf.json` `build.devUrl` to the
   deployment URL (if Tauri is set up).

The exact Vercel API calls, scope resolution, and full reserved-var list are
in [`references/deploy-command.md`](references/deploy-command.md).

## When to Deploy

- Before running dev builds (`pnpm exec tauri dev`, `… tauri ios dev`,
  `… tauri android dev`) so the WebView loads from a network URL
- After frontend changes when iterating on dev builds
- When sharing a preview URL

## Going Back to Local

To stop using the Vercel URL for mobile dev builds, remove `devUrl` from
`src-tauri/tauri.conf.json`. The WebView will load local static files again.

## Reference

- Full behavior: [`references/deploy-command.md`](references/deploy-command.md)
- [Vercel token management](https://vercel.com/account/tokens)