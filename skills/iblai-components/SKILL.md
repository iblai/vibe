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

## Requirements

- Next.js App Router project (app/ directory)
- Node.js 18+
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.
- Run `iblai add mcp` first to set up MCP servers and skills
- If you started with `npx create-next-app@latest`, run `iblai add auth` first -- other components depend on the auth providers
- If you used `iblai startapp agent`, auth is already set up
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
