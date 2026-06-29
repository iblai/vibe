---
name: iblai-scaffold
description: Scaffold a new ibl.ai app or add ibl.ai features to an existing Next.js project — the project templates and the `startapp` / `add` / `config` steps that assemble them. Use when creating a new app, scaffolding from templates, wiring up the base providers/store/auth, or adding a feature by hand. Holds the base + agent project templates as assets. For per-feature wiring see /iblai-auth; for the desktop/mobile shell see /iblai-ops-build.
globs:
alwaysApply: false
---

# /iblai-scaffold

How an ibl.ai app gets its skeleton: the **project templates** that scaffold
a new app or add a feature, and the steps that assemble them. The templates
here record what a generated app contains; the references document the
assembly steps (`iblai startapp`, `iblai add`, `iblai config`) so the skills
can perform them directly — render the `assets/` templates, then apply the
patches described in each reference.

> Do NOT add custom styles / colors to ibl.ai SDK components — they ship
> with their own styling. See
> [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md).

> **Common setup (env, conventions, verification):** see
> [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Two ways in

| Path | How | Result |
|---|---|---|
| **New app** | clone **vibe-starter**, or render the `base`+`agent` templates | A complete app — auth, providers, Redux store, a chat page, Tauri-ready |
| **Existing app** | [`/iblai-auth`](../iblai-auth/SKILL.md), then the feature skills | ibl.ai features layered onto a vanilla Next.js project |

Both map `PLATFORM`/`TOKEN`/`DOMAIN` from `iblai.env` into the
`NEXT_PUBLIC_*` vars in `.env.local` (see
[`references/config-command.md`](references/config-command.md)).

> **Prefer the starter for greenfield work.** For brand-new projects,
> `vibe-starter` (a pre-wired clone — see the repo CLAUDE.md "Getting
> Started") is the recommended path; the `base`+`agent` templates here are
> the manual equivalent.

## Env: `.env.local` before build

A vibe app (cloned from **vibe-starter** or rendered from these templates)
needs a `.env.local` to build or run. **Always ensure one exists before
`pnpm build`** — a missing file is the usual cause of a blank or
mis-tenanted build:

```bash
[ -f .env.local ] || cp .env.example .env.local   # if the app ships .env.example
```

No `.env.example` in the project? Seed one from this skill's canonical copy
(the vibe-starter `.env.example`): [`assets/env.example`](assets/env.example).
Then map `PLATFORM` → `NEXT_PUBLIC_MAIN_TENANT_KEY` and `TOKEN` →
`IBLAI_API_KEY` from `iblai.env` (see
[`references/config-command.md`](references/config-command.md)).

## The templates

The Jinja2 (`.j2`) templates the CLI renders live as assets beside this
skill. They use `{{ variable }}` placeholders the command fills in
(platform key, app name, agent id, …) — see
[`references/template-system.md`](references/template-system.md) for the
variable contract.

- **[`assets/base/`](assets/base/)** — the non-shared foundation:
  `app/(app)/{layout,page}.tsx`, `providers/index.tsx`, `store/index.ts`,
  `lib/iblai/{auth-utils,config}.ts`, `lib/config.ts`, `next.config.ts`,
  `components/ui/{button,sonner}.tsx`, `package.json`, `.env.example`.
- **[`assets/shared/`](assets/shared/)** — rendered into **every** app
  (base *and* agent): root `app/layout.tsx`, the `(auth)/sso-login-complete`
  callback, `components/app-shell.tsx`, `providers/store-provider.tsx`,
  `hooks/use-user.ts`, `lib/{utils,hooks}.ts`, `CLAUDE.md`, `.mcp.json`,
  `public/env.js`, the tooling configs (eslint/tsconfig/tailwind/postcss/
  vitest), and the Playwright `e2e/` suite.
- **[`assets/agent/`](assets/agent/)** — the agent-app overlay on top of
  base+shared: a chat `app/(app)/page.tsx`, `lib/config.ts`,
  `components.json`, `package.json`, `.env.example`.

The Tauri desktop/mobile shell templates (`src-tauri/`, CI workflows)
that `iblai add builds` renders live with the build skill:
[`iblai-ops-build/assets/tauri/`](../iblai-ops-build/assets/tauri/).

Per-feature templates (auth, account, analytics, chat, notification,
profile) live with **their** skill's assets, not here — e.g.
[`iblai-auth/assets/`](../iblai-auth/assets/),
[`iblai-account/assets/`](../iblai-account/assets/). Icons live in
[`iblai-ops-build/assets/icons/`](../iblai-ops-build/assets/icons/).

## The commands

| Command | What it does | Reference |
|---|---|---|
| `iblai startapp <type>` | Render `base` + (`agent`) into a new project | [`references/startapp-command.md`](references/startapp-command.md) |
| `iblai add <feature>` | Detect the project, render one feature's templates, patch `next.config` / `package.json` | [`references/add-command.md`](references/add-command.md) |
| `iblai config [get/set/show]` | Read/derive `.env.local` from `iblai.env` shorthand vars | [`references/config-command.md`](references/config-command.md) |

`iblai add` is the dispatcher each feature skill points at (`iblai add auth`
→ `/iblai-auth`, `iblai add account` → `/iblai-account`, …). The
[`add-command`](references/add-command.md) reference documents the shared
mechanics: project detection, idempotency, and the `next.config` /
provider-chain patching every feature relies on.

## Provider chain (what `base` wires up)

```
AuthProvider > TenantProvider > {children}
```

`initializeDataLayer(dmUrl, lmsUrl, legacyLmsUrl, storageService, httpErrorHandler)`
is called with 5 args (data-layer v1.2+). Redux Toolkit is deduplicated via
a webpack `resolve.alias` in `next.config.ts` — without it, SDK components
bind a different `ReactReduxContext` and RTK Query hooks return `undefined`.
The `base` templates encode all of this; reproduce them faithfully if
scaffolding by hand.

## References

- [`references/startapp-command.md`](references/startapp-command.md) — `iblai startapp` behavior + flags.
- [`references/add-command.md`](references/add-command.md) — `iblai add` project detection + feature generation.
- [`references/config-command.md`](references/config-command.md) — `iblai config` + the `iblai.env` → `.env.local` derivation.
- [`references/template-system.md`](references/template-system.md) — the Jinja2 template/variable contract.

## Related skills

- [`/iblai-auth`](../iblai-auth/SKILL.md) — the first `iblai add`; SSO auth, store, providers.
- [`/iblai-ops-build`](../iblai-ops-build/SKILL.md) — `iblai add builds` (Tauri shell) + `iblai builds`.
- [`/iblai-ops-deploy`](../iblai-ops-deploy/SKILL.md) — `iblai deploy`.
- [`/iblai-ops-init`](../iblai-ops-init/SKILL.md) — update a project's CLAUDE.md with platform guidance.
- [`/iblai-cli-maintenance`](../iblai-cli-maintenance/SKILL.md) — internals of the CLI that renders all of the above.
