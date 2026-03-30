---
name: iblai-components
description: Add an iblai component or feature to your app
globs:
alwaysApply: false
---

# /iblai-components

Add pre-built iblai components to an existing Next.js app.

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
- `iblai` CLI available (`iblai --version`). If not available, run `/iblai-install`
- The `auth` component should be added first if you need authentication (other components depend on the auth providers)
