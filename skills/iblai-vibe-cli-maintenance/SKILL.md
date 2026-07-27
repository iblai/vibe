---
name: iblai-vibe-cli-maintenance
description: Internals of the `iblai` CLI (iblai-app-cli) — how its commands, Jinja2 template system, standalone-binary build, and release/publish flows are structured. Use when maintaining, debugging, rebuilding, or reproducing the iblai CLI itself, or when you need to know how `iblai add` / `iblai startapp` / `iblai builds` work under the hood — it preserves the CLI's construction so the behavior can be reproduced or ported.
globs:
alwaysApply: false
---

# /iblai-vibe-cli-maintenance

Maintainer-facing reference for the `iblai` command-line tool
(`iblai-app-cli`). It captures **how the CLI is built**, not how to use it
day-to-day — the user-facing behavior of each command lives with the skill
that owns the feature:

- `iblai add <feature>`, `iblai startapp`, `iblai config`, and the template
  system → [`/iblai-vibe-scaffold`](../iblai-vibe-scaffold/SKILL.md)
- `iblai builds …` (Tauri desktop/mobile) → [`/iblai-vibe-ops-build`](../iblai-vibe-ops-build/SKILL.md)
- `iblai deploy …` → [`/iblai-vibe-ops-deploy`](../iblai-vibe-ops-deploy/SKILL.md)

> This skill is the authoritative record of how the `iblai` CLI is built —
> so it can be rebuilt, forked, or its logic ported. The references below
> are the source of truth.

## What's here

| Reference | Covers |
|---|---|
| [`references/iblai-vibe-cli-add-command.md`](references/iblai-vibe-cli-add-command.md) | How `iblai add` detects an existing project and generates feature files (`commands/add.py`) |
| [`references/iblai-vibe-cli-startapp.md`](references/iblai-vibe-cli-startapp.md) | How `iblai startapp` scaffolds a new app from the `base`/`agent` templates (`commands/startapp.py`) |
| [`references/iblai-vibe-cli-templates.md`](references/iblai-vibe-cli-templates.md) | The Jinja2 template system — directory layout, variables, rendering |
| [`references/iblai-vibe-cli-builds.md`](references/iblai-vibe-cli-builds.md) | How the `iblai builds` group wraps `@tauri-apps/cli` with prerequisite checks + passthrough (`commands/builds.py`) |
| [`references/iblai-vibe-cli-build-binary.md`](references/iblai-vibe-cli-build-binary.md) | Building `iblai` as a single-file executable with PyInstaller |
| [`references/iblai-vibe-cli-publish.md`](references/iblai-vibe-cli-publish.md) | Release + publish flows (GitHub, npm, PyPI) |

## Relationship to the templates

The Jinja2 templates the CLI renders now live as **skill assets** beside
the feature they scaffold (e.g.
[`iblai-vibe-auth/assets/`](../iblai-vibe-auth/assets/),
[`iblai-vibe-scaffold/assets/base/`](../iblai-vibe-scaffold/assets/base/),
[`iblai-vibe-ops-build/assets/icons/`](../iblai-vibe-ops-build/assets/icons/)).
`references/iblai-vibe-cli-templates.md` explains the variable contract those
`.j2` files expect.

## Related skills

- [`/iblai-vibe-scaffold`](../iblai-vibe-scaffold/SKILL.md) — user-facing `iblai add` / `iblai startapp` / `iblai config` + the scaffold templates.
- [`/iblai-vibe-ops-build`](../iblai-vibe-ops-build/SKILL.md) — user-facing `iblai builds`.
- [`/iblai-vibe-ops-deploy`](../iblai-vibe-ops-deploy/SKILL.md) — user-facing `iblai deploy`.
