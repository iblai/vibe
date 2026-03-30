---
description: Set up environment variables for your ibl.ai app
globs:
alwaysApply: false
---

# /vibe-setup-env

Expand the simple `.env.example` into a full `.env.local` for your ibl.ai app.

## Prerequisites

- `iblai` CLI available (`iblai --version`). If not available, run `/vibe-install-cli`

## Quick Setup

1. Copy the example to your app root:
   ```bash
   cp .env.example .env.local
   ```

2. Set your platform key:
   ```bash
   # If iblai is installed globally
   iblai config set NEXT_PUBLIC_MAIN_TENANT_KEY your-actual-key

   # Or via npx (when published)
   npx @iblai/cli config set NEXT_PUBLIC_MAIN_TENANT_KEY your-actual-key
   ```

3. Verify:
   ```bash
   iblai config show
   # or: npx @iblai/cli config show
   ```

## How the Two Variables Map

The `.env.example` has two simple values:

| Variable | Default | What it is |
|----------|---------|------------|
| `DOMAIN` | `iblai.app` | Base domain for all ibl.ai services |
| `PLATFORM` | `your-platform` | Your tenant/platform key |

These map to the full environment your app needs:

| App Variable | Derived From |
|-------------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.{DOMAIN}` |
| `NEXT_PUBLIC_AUTH_URL` | `https://login.{DOMAIN}` |
| `NEXT_PUBLIC_BASE_WS_URL` | `wss://asgi.data.{DOMAIN}` |
| `NEXT_PUBLIC_PLATFORM_BASE_DOMAIN` | `{DOMAIN}` |
| `NEXT_PUBLIC_MAIN_TENANT_KEY` | `{PLATFORM}` |

## Using the CLI

The `iblai config` command manages `.env.local` for you:

```bash
# View current config (shows all variables with values and sources)
iblai config show

# Set your platform key
iblai config set NEXT_PUBLIC_MAIN_TENANT_KEY my-org

# Override the default domain (for custom deployments)
iblai config set NEXT_PUBLIC_API_BASE_URL https://api.my-domain.com
iblai config set NEXT_PUBLIC_AUTH_URL https://login.my-domain.com
iblai config set NEXT_PUBLIC_BASE_WS_URL wss://asgi.data.my-domain.com
iblai config set NEXT_PUBLIC_PLATFORM_BASE_DOMAIN my-domain.com
```

## Default (iblai.app)

For the default free tenant, you only need to set your platform key:

```bash
iblai config set NEXT_PUBLIC_MAIN_TENANT_KEY my-org
```

Everything else defaults to iblai.app endpoints automatically.

## Custom Domain

If you have a custom domain (e.g., `my-company.com`), set all values:

```
DOMAIN=my-company.com
PLATFORM=my-company
```

Then use `iblai config set` for each `NEXT_PUBLIC_*` variable, replacing
`iblai.app` with your domain.

## Getting a Tenant Key

- Use `iblai` as the default free tenant for development
- Register at https://iblai.app for your own tenant with custom branding
- Your tenant key is shown in the iblai.app dashboard under Settings
