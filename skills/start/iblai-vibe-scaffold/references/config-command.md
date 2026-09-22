# `.env.local` reference

The known environment variables for a generated ibl.ai project, resolved
in priority order: `.env.local` > system environment > built-in default in
`lib/iblai/config.ts`.

## Known variables & defaults

Defaults apply when the var is unset in both `.env.local` and the system
env:

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
its runtime vars from `.env.local`. The skills bridge the two: they read
`iblai.env` and **derive** `NEXT_PUBLIC_MAIN_TENANT_KEY` ← `PLATFORM` and
`IBLAI_API_KEY` ← `TOKEN` into `.env.local`.

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-vibe-scaffold).
- The auth feature that consumes these vars: [`../../iblai-vibe-auth/SKILL.md`](../../iblai-vibe-auth/SKILL.md).
