# `iblai add <feature>` — layer features onto an existing app

Adds ibl.ai features to an **existing** Next.js (App Router) project. Each
subcommand renders one feature's templates, installs its deps, and patches
the project's config/store so the feature is wired up end-to-end.

```bash
iblai add auth                 # always first — everything else needs it
iblai add chat
iblai add profile
iblai add notification
iblai add account
iblai add analytics
iblai add mcp                  # MCP config + Claude skills (no auth needed)
iblai add homepage             # replace the default Next.js home page
iblai add builds               # Tauri v2 desktop/mobile shell
```

## Subcommands

| Command | Needs auth? | What it generates |
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

`auth` takes `--platform/-p <key>` (also read from `IBLAI_PLATFORM_KEY` /
`PLATFORM`); if omitted it prompts. *`builds` needs a Next.js project but
not auth.

## Project detection

Every subcommand calls a Next.js guard first:

- Aborts if there's no `package.json` in the current directory ("run from
  the root of your Next.js project").
- Aborts if the project isn't Next.js.
- **Warns** (but continues) if no `app/` directory is found — files are
  written assuming App Router layout.

The auth-dependent commands additionally require auth to be present —
detected by the existence of `lib/iblai/config.ts` **or** `lib/config.ts`
(i.e. you've run `iblai add auth` or scaffolded with `iblai startapp`). If
missing, they tell you to run `iblai add auth` first and stop.

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
re-running `iblai add <feature>` won't duplicate aliases, imports, or env
lines.

## Where each feature's templates live now

The `.j2` templates each subcommand renders are stored as **assets** beside
that feature's skill — e.g.
[`iblai-auth/assets/`](../../iblai-auth/assets/),
[`iblai-agent-chat/assets/`](../../iblai-agent-chat/assets/),
[`iblai-account/assets/`](../../iblai-account/assets/),
[`iblai-notification/assets/`](../../iblai-notification/assets/),
[`iblai-profile/assets/`](../../iblai-profile/assets/),
[`iblai-analytics/assets/`](../../iblai-analytics/assets/). The Tauri shell
templates for `iblai add builds` are in
[`iblai-ops-build/assets/tauri/`](../../iblai-ops-build/assets/tauri/).

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-scaffold).
- Implementation internals: [`../../iblai-cli-maintenance/references/iblai-cli-add-command.md`](../../iblai-cli-maintenance/references/iblai-cli-add-command.md).
