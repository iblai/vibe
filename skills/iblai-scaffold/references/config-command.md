# `iblai config` — view & manage `.env.local`

Reads and edits the Next.js environment configuration for a generated
ibl.ai project. Two subcommands.

```bash
iblai config show                                  # print effective config + sources
iblai config set NEXT_PUBLIC_MAIN_TENANT_KEY acme  # write/replace a key in .env.local
iblai config set NEXT_PUBLIC_AUTH_URL https://login.example.com
```

> There is no `iblai config get` — use `show` (whole table) or read
> `.env.local` directly.

## `iblai config show`

Prints every known variable with its current value and **where the value
comes from**, resolved in priority order:

```
.env.local  >  system environment  >  built-in default
```

Missing values render as `(not set)`. If no `.env.local` exists, it prints
a hint to `cp .env.example .env.local`. Read-only — it never writes.

## `iblai config set KEY VALUE`

Upserts `KEY=VALUE` into `.env.local`: if the key already exists it's
replaced in place (comments and other lines preserved); otherwise it's
appended. Creates the file if absent.

## Known variables & defaults

These are the variables `config` knows about (defaults applied when the var
is unset in both `.env.local` and the system env):

| Variable | Default |
|---|---|
| `DOMAIN` | _(shorthand, empty)_ |
| `PLATFORM` | _(shorthand, empty)_ |
| `TOKEN` | _(shorthand, empty)_ |
| `IBLAI_API_KEY` | _(empty)_ |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.iblai.app` |
| `NEXT_PUBLIC_AUTH_URL` | `https://login.iblai.app` |
| `NEXT_PUBLIC_BASE_WS_URL` | `wss://asgi.data.iblai.app` |
| `NEXT_PUBLIC_PLATFORM_BASE_DOMAIN` | `iblai.app` |
| `NEXT_PUBLIC_MAIN_TENANT_KEY` | _(empty)_ |
| `NEXT_PUBLIC_DEFAULT_AGENT_ID` | _(empty)_ |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | `support@ibl.ai` |

## `iblai.env` vs `.env.local`

`iblai.env` holds only the **three shorthand** vars (`DOMAIN`, `PLATFORM`,
`TOKEN`). It is **not** a replacement for `.env.local` — Next.js still reads
its runtime vars from `.env.local`. The CLI bridges the two: when you
scaffold or run `iblai add auth`, it reads `iblai.env` and **derives** the
`NEXT_PUBLIC_*` values (API/auth/WS URLs, main tenant key) into
`.env.local`. `iblai config` then lets you inspect or override individual
derived values.

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-scaffold).
- The auth feature that consumes these vars: [`../../iblai-auth/SKILL.md`](../../iblai-auth/SKILL.md).
