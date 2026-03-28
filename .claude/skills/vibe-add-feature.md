---
description: Add an iblai component or feature to your app
globs:
alwaysApply: false
---

# /vibe-add-feature

Add pre-built iblai components to an existing Next.js app.

## Available Components

| Command | What It Adds |
|---------|-------------|
| `iblai add auth` | SSO authentication -- redirects to ibl.ai login, returns with session. Adds Redux store, AuthProvider, TenantProvider, SSO callback page. |
| `iblai add chat` | AI chat widget -- `<mentor-ai>` web component. Full-screen or embedded chat with streaming, file upload, voice. |
| `iblai add profile` | User profile dropdown -- avatar with dropdown menu, profile settings page. |
| `iblai add account` | Organization/account settings -- tenant management, team settings. |
| `iblai add analytics` | Analytics dashboard -- usage stats, user analytics, topic analysis. |
| `iblai add notifications` | Notification bell -- real-time notifications with unread badge, notification center page. |
| `iblai add builds` | Tauri v2 shell -- desktop (macOS/Windows/Linux) and mobile (iOS/Android) builds. |
| `iblai add mcp` | MCP + skills -- @iblai/mcp server config, Claude/OpenCode/Cursor skill files. |

## How to Use

1. **Navigate to your Next.js project root**

2. **Run the add command**:
   ```bash
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
- The `auth` component should be added first if you need authentication (other components depend on the auth providers)
