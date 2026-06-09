# iblai-cli-maintenance

> Internals of the `iblai` CLI (iblai-app-cli) — how its commands, Jinja2 template system, standalone-binary build, and release/publish flows are structured. Use when maintaining, debugging, rebuilding, or reproducing the iblai CLI itself, or when you need to know how `iblai add` / `iblai startapp` / `iblai builds` work under the hood. The CLI is slated for retirement; this skill preserves its construction so the behavior can be reproduced or ported.

# /iblai-cli-maintenance

Maintainer-facing reference for the `iblai` command-line tool
(`iblai-app-cli`). It captures **how the CLI is built**, not how to use it
day-to-day — the user-facing behavior of each command lives with the skill
that owns the feature:

- `iblai add <feature>`, `iblai startapp`, `iblai config`, and the template
  system → [`/iblai-scaffold`](../iblai-scaffold/SKILL.md)
- `iblai builds …` (Tauri desktop/mobile) → [`/iblai-ops-build`](../iblai-ops-build/SKILL.md)
- `iblai deploy …` → [`/iblai-ops-deploy`](../iblai-ops-deploy/SKILL.md)

> **The CLI is being retired.** This skill exists so the tool can be
> rebuilt, forked, or its logic ported into a successor. When the
> `iblai-app-cli` repo is deleted, these references are the record of how
> it worked.

## What's here

| Reference | Covers |
|---|---|
| [`references/iblai-cli-add-command.md`](references/iblai-cli-add-command.md) | How `iblai add` detects an existing project and generates feature files (`commands/add.py`) |
| [`references/iblai-cli-startapp.md`](references/iblai-cli-startapp.md) | How `iblai startapp` scaffolds a new app from the `base`/`agent` templates (`commands/startapp.py`) |
| [`references/iblai-cli-templates.md`](references/iblai-cli-templates.md) | The Jinja2 template system — directory layout, variables, rendering |
| [`references/iblai-cli-builds.md`](references/iblai-cli-builds.md) | How the `iblai builds` group wraps `@tauri-apps/cli` with prerequisite checks + passthrough (`commands/builds.py`) |
| [`references/iblai-cli-build-binary.md`](references/iblai-cli-build-binary.md) | Building `iblai` as a single-file executable with PyInstaller |
| [`references/iblai-cli-publish.md`](references/iblai-cli-publish.md) | Release + publish flows (GitHub, npm, PyPI) |

## Relationship to the templates

The Jinja2 templates the CLI renders now live as **skill assets** beside
the feature they scaffold (e.g.
[`iblai-auth/assets/`](../iblai-auth/assets/),
[`iblai-scaffold/assets/base/`](../iblai-scaffold/assets/base/),
[`iblai-ops-build/assets/icons/`](../iblai-ops-build/assets/icons/)).
`references/iblai-cli-templates.md` explains the variable contract those
`.j2` files expect.

## Related skills

- [`/iblai-scaffold`](../iblai-scaffold/SKILL.md) — user-facing `iblai add` / `iblai startapp` / `iblai config` + the scaffold templates.
- [`/iblai-ops-build`](../iblai-ops-build/SKILL.md) — user-facing `iblai builds`.
- [`/iblai-ops-deploy`](../iblai-ops-deploy/SKILL.md) — user-facing `iblai deploy`.