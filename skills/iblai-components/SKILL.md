---
name: iblai-components
description: Add an iblai component or feature to your app
globs:
alwaysApply: false
---

# /iblai-components

Overview of all ibl.ai components and how to create a new app.

## Creating a New App

### Vanilla Next.js + ibl.ai Features

Start with a standard Next.js app and add features as needed:

```bash
npx create-next-app@latest my-app --yes
cd my-app
iblai add auth --platform <your-tenant-key>
iblai add chat
npm run dev
```

### Full ibl.ai Agent App

Scaffold a complete app with auth, chat, and everything pre-configured:

```bash
iblai startapp agent --platform <your-tenant-key>
cd <app-name> && pnpm install
cp .env.example .env.local && pnpm dev
```

### Non-Interactive (CI/CD)

```bash
iblai startapp agent --yes --platform acme --agent my-id --app-name my-app
```

### AI-Enhanced Scaffolding

```bash
iblai startapp agent --platform acme --anthropic-key sk-ant-... \
  --prompt "kids learning assistant with bright colors"
```

## Available Components

| Command | What It Adds | Skill |
|---------|-------------|-------|
| `iblai add mcp` | MCP servers + skills (run first) | |
| `iblai add auth` | SSO authentication | `/iblai-auth` |
| `iblai add chat` | AI chat widget (requires agent ID) | `/iblai-chat` |
| `iblai add profile` | User profile dropdown | `/iblai-profile` |
| `iblai add account` | Account/organization settings | `/iblai-account` |
| `iblai add analytics` | Analytics dashboard | `/iblai-analytics` |
| `iblai add notifications` | Notification bell | `/iblai-notifications` |
| `iblai add builds` | Tauri v2 desktop/mobile shell | |

## Component Priority

1. **ibl.ai components first** -- always use the native component when one exists
2. **shadcn/ui for everything else** -- forms, tables, modals, date pickers, etc.:
   ```bash
   npx shadcn@latest add button dialog table form
   ```
3. **shadcnspace blocks** -- pre-built page sections:
   ```bash
   npx shadcn@latest add @shadcn-space/hero-01
   ```

ibl.ai and shadcn components share the same Tailwind theme and are visually seamless.

## CLI Updates

> **AI Assistant:** Before running any `iblai` command, check for updates.
> Run `iblai --version` to get the current version, then check the latest:
> - **PyPI:** `curl -sf https://pypi.org/pypi/iblai-app-cli/json | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['version'])"`
> - **npm:** `npm view @iblai/cli version 2>/dev/null`
> - **GitHub (binary installs):** `curl -sf https://api.github.com/repos/iblai/iblai-app-cli/releases/latest | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'].lstrip('v'))"`
>
> If a newer version exists, update:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
> - Binary: download the latest release from `https://github.com/iblai/iblai-app-cli/releases/latest` for the current platform and replace the binary

## Requirements

- Next.js App Router project (app/ directory)
- Node.js 18+
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.
- Run `iblai add mcp` first to set up MCP servers and skills
- If you started with `npx create-next-app@latest`, run `iblai add auth` first -- other components depend on the auth providers
- If you used `iblai startapp agent`, auth is already set up
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
