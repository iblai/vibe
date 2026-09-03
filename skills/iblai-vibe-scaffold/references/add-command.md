# Adding a feature by hand — layer features onto an existing app

Adds ibl.ai features to an **existing** Next.js (App Router) project. Each
feature renders its templates, installs its deps, and patches the
project's config/store so the feature is wired up end-to-end.

## Features

| Feature | Needs auth? | What it generates |
|---|---|---|
| `auth` | — (it *is* auth) | `AuthProvider`/`TenantProvider`, SSO callback, store, `lib/iblai/` |
| `chat` | yes | `<mentor-ai>` chat widget (`components/iblai/chat-widget`) |
| `profile` | yes | profile dropdown |
| `notification` | yes | notification bell + unread badge |
| `account` | yes | `/account` org-settings page |
| `analytics` | yes | `/analytics` dashboard page |
| `mcp` | no | `.mcp.json` + `.claude/skills/` + `@iblai/mcp` devDep |
| `homepage` | no | replaces the default Next.js home page (no-op if none found) |
| `builds` | no* | Tauri shell under `src-tauri/` (skips if it already exists) |

*`builds` needs a Next.js project but not auth.

## Project detection

Every feature applies a Next.js guard first:

- Aborts if there's no `package.json` in the current directory ("run from
  the root of your Next.js project").
- Aborts if the project isn't Next.js.
- **Warns** (but continues) if no `app/` directory is found — files are
  written assuming App Router layout.

The auth-dependent features additionally require auth to be present —
detected by the existence of `lib/iblai/config.ts` **or** `lib/config.ts`
(i.e. auth is already wired — `/iblai-vibe-auth` or vibe-starter). If
missing, wire auth first via `/iblai-vibe-auth`.

Detection also adapts to the project's shape: `src/` vs root layout,
TypeScript, an existing Redux store, and whether `@iblai/iblai-js` is
already a dependency.

## What a feature does, in order

1. **Render** the feature's `.j2` templates into the project
   (`lib/iblai/`, `components/iblai/`, route pages, …).
2. **Install dependencies** with the project's package manager — detected
   from the lockfile in order: `pnpm-lock.yaml` → `yarn.lock` →
   `bun.lock(b)` → `package-lock.json` → fall back to `npm`.
3. **Patch `next.config.*`** — add the webpack `resolve.alias` that
   deduplicates `@reduxjs/toolkit` (without it, SDK components bind a
   different `ReactReduxContext` and RTK Query hooks return `undefined`).
4. **Patch `globals.css`** — add the SDK styles `@import`.
5. **Patch `.env.local`** — add the feature's env vars.
6. **Patch the Redux store** — register the feature's API slices / reducers.
7. Print a success panel listing created files + next steps.

All patchers are **idempotent** — they look for a marker before editing, so
re-applying a feature won't duplicate aliases, imports, or env
lines.

## Where each feature's templates live now

The `.j2` templates each feature renders are stored as **assets** beside
that feature's skill — e.g.
[`iblai-vibe-auth/assets/`](../../iblai-vibe-auth/assets/),
[`iblai-vibe-agent-chat/assets/`](../../iblai-vibe-agent-chat/assets/),
[`iblai-vibe-account/assets/`](../../iblai-vibe-account/assets/),
[`iblai-vibe-notification/assets/`](../../iblai-vibe-notification/assets/),
[`iblai-vibe-profile/assets/`](../../iblai-vibe-profile/assets/),
[`iblai-vibe-analytics/assets/`](../../iblai-vibe-analytics/assets/). The Tauri shell
templates for the build skill are in
[`iblai-vibe-ops-build/assets/tauri/`](../../iblai-vibe-ops-build/assets/tauri/).

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-vibe-scaffold).
