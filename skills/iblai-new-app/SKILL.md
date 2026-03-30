---
name: iblai-new-app
description: Scaffold and configure a new iblai-powered app
globs:
alwaysApply: false
---

# /iblai-new-app

Scaffold a new AI-powered app using the iblai CLI.

## Steps

1. **Check prerequisites**: Node.js 18+, pnpm (recommended)
   - `iblai` CLI: `iblai --version` (if not available, run `/iblai-install`)

2. **Scaffold the app** (choose one):
   ```bash
   # If iblai is installed globally
   iblai startapp agent --platform <tenant> --agent <agent-id>

   # Or via npx (when published)
   npx @iblai/cli startapp agent --platform <tenant> --agent <agent-id>
   ```
   - If the user doesn't have a tenant yet, use `iblai` as the default
   - If they don't have an agent ID, omit `--agent` (will prompt or use default)

3. **Install dependencies**:
   ```bash
   cd <app-name>
   pnpm install
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```
   Default config connects to iblai.app. For custom tenants, update `NEXT_PUBLIC_MAIN_TENANT_KEY`.

5. **Start development**:
   ```bash
   pnpm dev
   ```
   Visit http://localhost:3000. You'll be redirected to iblai.app login.

6. **Set up AI-assisted development**:
   - The generated app includes `.mcp.json` for the @iblai/mcp server
   - Skills are in `.claude/skills/` -- invoke with `/` prefix
   - For existing projects without MCP config, run `npx @iblai/cli init`

## Non-Interactive Mode (CI/CD)

Skip all prompts with `--yes` (requires `--platform` and `--app-name`):

```bash
npx @iblai/cli startapp agent \
  --yes \
  --platform acme \
  --agent my-agent-id \
  --app-name my-app
```

## AI-Enhanced Scaffolding

To customize the app with AI during scaffolding:
```bash
npx @iblai/cli startapp agent \
  --platform acme \
  --anthropic-key sk-ant-... \
  --prompt "Make this a kids learning assistant with bright, playful colors"
```

## Add AI Skills to an Existing Project

For existing Next.js projects that need MCP config and AI skills:
```bash
cd your-existing-project
npx @iblai/cli init
```

This adds `.mcp.json`, `skills/`, and tool symlinks for Claude Code, OpenCode, and Cursor.
## What Gets Generated

- Next.js 15 App Router project with TypeScript
- SSO authentication flow (client-side, no API tokens)
- AI chat interface (agent template) or blank canvas (base template)
- Redux Toolkit store with @iblai/iblai-js data layer
- Tailwind CSS 4 + shadcn/ui (new-york style)
- Playwright E2E test setup
- CLAUDE.md, skills, and MCP config for AI-assisted development
