# Common Skill Setup

Shared setup, conventions, and pre-flight checks referenced by ibl.ai
skills. Each skill links here instead of repeating this boilerplate.

## Conventions

- Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK
  components. They ship with their own styling. Keep components as-is.
- Do NOT implement dark mode unless the user explicitly asks for it.
- Use `pnpm` as the default package manager. Fall back to `npm` if `pnpm`
  is not installed.
- The generated app should live in the current directory, not in a
  subdirectory.
- Project names MUST be all lowercase — npm rejects package names with
  capital letters. Convert names like `MyApp` to `my-app` before passing
  to `create-next-app` or `--app-name`. Allowed
  characters: lowercase letters, digits, `-`, `_`.
- When building a navbar or header, do NOT display the platform/tenant
  name. Use the ibl.ai logo instead.

## Brand

When building custom UI around SDK components, use the ibl.ai brand:

- **Primary**: `#0058cc`
- **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack
- **Style**: shadcn/ui new-york variant

Follow the component hierarchy: use ibl.ai SDK components
(`@iblai/iblai-js`) first, then shadcn/ui for everything else
(`npx shadcn@latest add <component>`). Do NOT write custom components
when an ibl.ai or shadcn equivalent exists. Both share the same Tailwind
theme and render in ibl.ai brand colors automatically.

Full brand guidelines:
[BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md).

## Environment files

- `iblai.env` is **NOT** a `.env.local` replacement — it holds the platform
  shorthand (`DOMAIN`, `PLATFORM`, `TOKEN`, optional `IBLAI_USERNAME` for
  deploys — the `IBLAI_USERNAME` environment variable wins when the host
  exports it) plus the `AUTH_*` branding values. Next.js still reads its
  runtime env vars from `.env.local`.
- `DOMAIN` is the single host knob: every platform API base is composed from
  it as `https://api.$DOMAIN/dm` (default `iblai.app`). Inside the ibl.ai
  desktop app the session guidance states the base domain — write that value.
  The sign-in (auth SPA) host is the one exception: it is not derivable from
  the domain, so use it only when the guidance or the user supplies it.
- The skills read `iblai.env` and derive the `NEXT_PUBLIC_*` values into
  `.env.local`. vibe-starter apps need only the tenant key and
  `IBLAI_API_KEY` — URL defaults live in `lib/iblai/config.ts`.

## Step 1: Check Environment

Check for an `iblai.env` in the project root. Look for `PLATFORM`,
`DOMAIN`, and `TOKEN` variables. If the file does not exist or is missing
these variables, tell the user:

> "You need an `iblai.env` with your platform configuration. Download the
> template and fill in your values:
> `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

Where the values come from: the org key (`PLATFORM`) is listed on
https://login.iblai.app/me (no account yet: https://ibl.ai/join); the
Platform API Token (`TOKEN`) is minted from that signed-in session by
`/iblai-api-login` (`npx skills add iblai/api`), or an org secret works
directly. Make sure `iblai.env` is gitignored before writing a token into it.

Do NOT ask the user for their platform key directly — guide them to
populate `iblai.env` instead.

## Verification

You MUST run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` — must pass with zero errors.
2. `pnpm test` — vitest must pass.
3. Start a dev server and touch test the route with Playwright:

```bash
pnpm dev &
npx playwright screenshot http://localhost:3000/<route> /tmp/<screenshot>.png
```

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.
