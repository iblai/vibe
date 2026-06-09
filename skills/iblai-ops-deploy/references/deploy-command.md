# `iblai deploy vercel` — deploy the frontend to Vercel

Builds and deploys the app to Vercel, auto-detecting **static** vs
**server** mode, then disables Vercel's auth wall, syncs env vars, and points
the Tauri `devUrl` at the deployment.

```bash
iblai deploy vercel                  # auto-detect mode
iblai deploy vercel --mode server    # force server (SSR / API routes)
iblai deploy vercel --scope my-team  # pin the Vercel team
```

## Prerequisites

- `VERCEL_TOKEN` in `iblai.env` (create at
  https://vercel.com/account/tokens). The command validates it against the
  Vercel API and aborts on a missing/invalid/placeholder token.
- The `vercel` CLI is invoked via `npx`.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--mode` | `auto` | `auto` \| `static` \| `server`. `auto` → `static` when `next.config` sets `output: 'export'` (Tauri shells), else `server`. |
| `--scope` | _(auto)_ | Vercel team id/slug. Resolved as: `--scope` flag → previous deploy's `.vercel/project.json` `orgId` → single-team API lookup. |

## Static vs server

- **static** — runs the local frontend build, writes `out/vercel.json`
  (`cleanUrls` + SPA rewrite to `/index.html`), and deploys the `out/`
  folder: `npx vercel deploy out/ --token=… --yes --public`.
- **server** — deploys the repo and lets Vercel run the Next.js build
  remotely, provisioning serverless functions for server actions, API
  routes, and dynamic pages: `npx vercel deploy --prod --token=… --yes
  --public`.

`--scope <org>` is appended when a team is resolved.

## What it does after deploying

1. **Resolves the deployment URL** (Vercel API latest deployment, falling
   back to the CLI stdout).
2. **Disables auth protection** on the project (`ssoProtection` and
   `passwordProtection` cleared) so the deploy is publicly reachable.
3. **Syncs env vars (server mode only):** parses `.env.local` and upserts
   each var onto the Vercel project for **production + preview**.
   `NEXT_PUBLIC_*` go in as `plain`, everything else as `encrypted`.
   Reserved Vercel vars, `VERCEL_TOKEN`, and `your-…` placeholders are
   skipped. If any var was created/updated, it **redeploys with `--force`**
   and `VERCEL_FORCE_NO_BUILD_CACHE=1` so the new `NEXT_PUBLIC_*` values are
   re-inlined into the client bundle (they're baked at build time).
4. **Updates `src-tauri/tauri.conf.json`** `build.devUrl` → the deployment
   URL (so `iblai builds dev` loads the hosted frontend instead of building
   locally — see the `builds` dev special-casing).

The deploy subprocess has a 10-minute timeout; a non-zero exit aborts.

## Notes

- Static deploys don't push env vars — `NEXT_PUBLIC_*` are already inlined by
  the local build.
- Re-running is safe: env-var sync is idempotent (POST new, PATCH existing),
  and scope/project are recovered from `.vercel/project.json`.

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-ops-deploy).
- The `devUrl` it sets is consumed by [`../../iblai-ops-build/references/builds-command.md`](../../iblai-ops-build/references/builds-command.md).
