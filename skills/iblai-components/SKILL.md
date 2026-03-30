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
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir
cd my-app
iblai add auth --platform your-tenant
iblai add chat
pnpm install && pnpm dev
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

| Command | What It Adds |
|---------|-------------|
| `iblai add auth` | SSO authentication -- see `/iblai-auth` for step-by-step walkthrough |
| `iblai add chat` | AI chat widget -- see `/iblai-chat` |
| `iblai add profile` | User profile -- see `/iblai-profile` |
| `iblai add account` | Account settings -- see `/iblai-account` |
| `iblai add analytics` | Analytics dashboard -- see `/iblai-analytics` |
| `iblai add notifications` | Notifications -- see `/iblai-notifications` |
| `iblai add builds` | Tauri v2 shell -- desktop (macOS/Windows/Linux) and mobile (iOS/Android) builds |
| `iblai add mcp` | MCP + skills -- @iblai/mcp server config, Claude/OpenCode/Cursor skill files |

## How to Use

1. **Navigate to your Next.js project root**

2. **Run the add command** (choose one):
   ```bash
   # If iblai is installed globally
   iblai add auth

   # Or via npx (when published)
   npx @iblai/cli add auth
   ```

3. **Install new dependencies** (if any were added to package.json):
   ```bash
   pnpm install
   ```

4. **Verify** -- the CLI will tell you what files were created and any manual steps needed

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
- If you started with `npx create-next-app@latest`, run `iblai add auth` first -- other components depend on the auth providers
- If you used `iblai startapp agent`, auth is already set up
