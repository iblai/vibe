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
iblai add auth --platform your-tenant
iblai add chat
npm run dev
```

### Full ibl.ai Agent App

Scaffold a complete app with auth, chat, and everything pre-configured:

```bash
iblai startapp agent --platform your-tenant
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

### CLI-Generated (use the CLI)

| Command | What It Adds |
|---------|-------------|
| `iblai add auth` | SSO authentication -- see `/iblai-auth` |
| `iblai add chat` | AI chat widget -- see `/iblai-chat` (requires agent ID from user) |

### AI-Built (you build these using the skill documentation)

| Skill | What It Adds |
|-------|-------------|
| `/iblai-profile` | User profile dropdown + settings page |
| `/iblai-account` | Account/organization settings page |
| `/iblai-analytics` | Analytics dashboard page |
| `/iblai-notifications` | Notification bell + center page |

These components are built by the AI assistant using SDK components and the
detailed code provided in each skill. The MCP tools (`get_component_info`,
`get_hook_info`) provide props references and usage examples.

### Other CLI Commands

| Command | What It Adds |
|---------|-------------|
| `iblai add builds` | Tauri v2 shell -- desktop and mobile builds |
| `iblai add mcp` | MCP + skills -- @iblai/mcp server config, Claude/OpenCode/Cursor skill files |

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

## Requirements

- Next.js App Router project (app/ directory)
- Node.js 18+
- `iblai` CLI available for auth and chat (`iblai --version`). See `/iblai-auth` prerequisites for installation.
- If you started with `npx create-next-app@latest`, run `iblai add auth` first -- other components depend on the auth providers
- If you used `iblai startapp agent`, auth is already set up
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
