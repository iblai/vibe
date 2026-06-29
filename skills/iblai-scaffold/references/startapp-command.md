# `iblai startapp <template>` — scaffold a new app

Creates a brand-new ibl.ai application from a template into a fresh
directory.

```bash
iblai startapp agent                              # interactive
iblai startapp agent --platform acme --agent my-agent-123
iblai startapp agent --output ./my-apps           # parent dir for the new app
iblai startapp agent -p acme --app-name acme-app --yes   # non-interactive
```

## Template types

`TEMPLATE` is a required positional argument. Currently the only supported
value is **`agent`** (a full-screen chat app). The agent template renders
`base` + `shared`, then overlays the `agent` templates (page, config,
`.env.example`, `package.json`).

## Options

| Flag | Env | Purpose |
|---|---|---|
| `-p, --platform` | `IBLAI_PLATFORM_KEY`, `PLATFORM` | Platform (tenant) key |
| `-a, --agent` | `IBLAI_AGENT_ID` | Agent / mentor id (required for `agent`) |
| `--app-name` | `IBLAI_APP_NAME` | App name → directory + `package.json` |
| `-o, --output` | `IBLAI_OUTPUT_DIR` | Parent dir for the generated app (default `.`) |
| `--builds` | — | Include the Tauri v2 desktop/mobile shell (`src-tauri/`) |
| `-y, --yes` | — | Skip all prompts (then `--platform` + `--app-name` are required) |
| `--env-file` | — | Load a custom `.env` |
| `--stage` | `DEV_STAGE` | Load `.env.{stage}` overrides |
| `-P, --prompt` | `IBLAI_PROMPT` | NL prompt to AI-customize the app (needs an AI key) |
| `--openai-key` / `--anthropic-key` | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Enable AI-assisted generation |
| `--ai-provider` / `--ai-model` / `--ai-temperature` / `--ai-max-tokens` | `IBLAI_AI_*` | Tune the AI pass |

### Configuration priority

```
CLI flags  >  system env vars  >  .env.{DEV_STAGE}  >  .env  >  interactive prompts
```

## Interactive flow

When values are missing and `--yes` is not set, it prompts in order:

1. **Platform key** (required)
2. **Agent id** (required for the `agent` template)
3. **App name** (defaults to `{platform}-agent-app`; must be alphanumeric
   plus `-`/`_`)
4. **Include desktop/mobile build support?** (Tauri, defaults to No — skipped
   if `--builds` was already passed)

## Output behavior

The app is written to `<output>/<app-name>`. If that directory already
exists, the command **errors** rather than overwriting. App names containing
`/`, `\`, or `..` are rejected (path-traversal guard). If generation throws
partway, the partial directory is removed.

> **Generating into the current directory.** `startapp` always creates a
> subdirectory. The canonical pattern is to generate into a temp parent and
> copy back: `iblai startapp agent -o iblai-init` → then
> `cp -a iblai-init/<app-name>/. . && rm -rf iblai-init` → `pnpm install --ignore-scripts` (skips package lifecycle scripts).

## AI assistance (optional)

Passing an AI key turns on an AI-assisted pass; `--prompt` additionally
*enhances* generated files from a natural-language instruction (e.g.
`--prompt "Make this app for kids aged 5-10"`). `--prompt` **requires** an AI
key or the command errors. Without keys, generation is fully deterministic.

## After it finishes

The success panel prints the next steps:

```bash
cd <output>/<app-name>
pnpm install --ignore-scripts
cp .env.example .env.local      # then fill in your values
pnpm dev                        # or: iblai builds dev  (when --builds)
```

> Run with `--ignore-scripts` to skip package lifecycle (postinstall) scripts.

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-scaffold).
- Generator hierarchy + internals: [`../../iblai-cli-maintenance/references/iblai-cli-startapp.md`](../../iblai-cli-maintenance/references/iblai-cli-startapp.md).
