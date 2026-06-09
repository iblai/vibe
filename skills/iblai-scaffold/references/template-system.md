# The scaffold template system

How the `.j2` templates (now stored as skill **assets**) are organized and
what variables they expect. There is no template renderer in vibe — this
documents the contract so you can fill the `{{ placeholders }}` by hand or
with your own tooling when reproducing a generated app.

## Template layers

The CLI rendered an app by layering directories, **first match wins**:

| Layer | Rendered into | Now lives at |
|---|---|---|
| `base/` | base + agent apps | [`iblai-scaffold/assets/base/`](../assets/base/) |
| `shared/` | base + agent apps | [`iblai-scaffold/assets/shared/`](../assets/shared/) |
| `agent/` | agent apps only (overrides base) | [`iblai-scaffold/assets/agent/`](../assets/agent/) |
| `add/<feature>/` | `iblai add <feature>` | each feature skill's `assets/` |
| `tauri/` | `iblai add builds` | [`iblai-ops-build/assets/tauri/`](../../iblai-ops-build/assets/tauri/) |
| `icons/` | static copy | [`iblai-ops-build/assets/icons/`](../../iblai-ops-build/assets/icons/) |

The base app composed `base/` + `shared/` (+ `add/` as a fallback). The
agent app rendered the base, then overlaid `agent/` — so
`agent/package.json.j2` won over `base/package.json.j2`. Reproduce that
precedence if you hand-assemble: **agent overrides base; shared fills the
rest.**

## Path mapping

A template's path maps directly to the output path with the `.j2` suffix
stripped:

```
base/app/(app)/layout.tsx.j2      →  app/(app)/layout.tsx
shared/app/layout.tsx.j2          →  app/layout.tsx
agent/lib/config.ts.j2            →  lib/config.ts
```

Files **without** `.j2` (e.g. `shared/app/globals.css`,
`shared/declarations.d.ts`, `tauri/src-tauri/build.rs`) are copied as-is —
no rendering.

## Variable contract

Templates receive a small context dict. Fill these placeholders:

| Variable | Type | Meaning | Appears in |
|---|---|---|---|
| `app_name` | string | Project / package name (lowercase) | `package.json`, layout, config, `Cargo.toml` |
| `platform_key` | string | ibl.ai platform (tenant) key | `.env.example`, `config.ts` |
| `mentor_id` | string | Default agent/mentor UUID (agent apps) | `.env.example`, `config.ts`, `page.tsx` |
| `has_mentor_id` | bool | Whether a mentor id was supplied | CLAUDE.md / conditional blocks |
| `tauri` / `builds` | bool | Whether the Tauri shell is included | `next.config.ts`, `package.json`, CLAUDE.md |

### Jinja2 conventions in the templates

```jinja
{{ app_name }}                       {# interpolation #}
{{ app_name | replace('-', '_') }}   {# filter #}
{% if tauri %} output: "export", {% endif %}     {# conditional #}
{% if has_mentor_id %}NEXT_PUBLIC_DEFAULT_AGENT_ID={{ mentor_id }}{% endif %}
```

The renderer used `trim_blocks` + `lstrip_blocks`, so `{% %}` blocks left no
stray blank lines. Templates that need a **literal** `{{ }}` (e.g. GitHub
Actions `${{ github.ref }}` in the `tauri/workflows/` files) wrapped it in
`{% raw %} … {% endraw %}` — when reading those `.j2` assets, treat
`{% raw %}` spans as literal output.

## Filling a template by hand

1. Pick the right layer (agent overrides base; shared is common).
2. Strip `.j2` for the output path.
3. Replace every `{{ var }}` using the table above; resolve `{% if %}`
   branches for your case (Tauri or not, agent or not); keep `{% raw %}`
   bodies verbatim.

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-scaffold).
- Full layout + generator internals: [`../../iblai-cli-maintenance/references/iblai-cli-templates.md`](../../iblai-cli-maintenance/references/iblai-cli-templates.md).
