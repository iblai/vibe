---
name: iblai-new-app
description: Create a new ibl.ai-powered app
globs:
alwaysApply: false
---

# /iblai-new-app

Two ways to create an ibl.ai-powered app, depending on what you need.

## Vanilla Next.js + ibl.ai Features

Start with a standard Next.js app and add ibl.ai features as needed.

```bash
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir
cd my-app
```

Then add features incrementally:

```bash
iblai add auth           # SSO authentication
iblai add chat           # AI chat widget
iblai add profile        # User profile page
iblai add notifications  # Notification bell
# or prefix with: npx @iblai/cli add auth
```

```bash
pnpm install
pnpm dev
```

Use this when:
- You're adding ibl.ai to an existing project
- You want full control over the initial project structure
- You only need specific features (e.g., auth only, no chat)

The `create-next-app` flags:
- `--typescript` -- required (iblai templates generate .tsx)
- `--tailwind` -- required (SDK uses Tailwind CSS)
- `--eslint` -- recommended
- `--app` -- required (App Router, not Pages Router)
- `--src-dir` -- optional (iblai CLI auto-detects both layouts)

## Full ibl.ai Agent App

Scaffold a complete app with auth, AI chat, profiles, and more in one command.

```bash
iblai startapp agent --platform <tenant> --agent <agent-id>
# or: npx @iblai/cli startapp agent --platform <tenant> --agent <agent-id>
```

```bash
cd <app-name>
pnpm install
cp .env.example .env.local
pnpm dev
```

Use this when:
- You want everything pre-configured from the start
- You're building an AI agent app with chat as the core feature
- You want the full ibl.ai stack (auth + chat + providers + store + e2e tests)

If you don't have a tenant yet, use `iblai` as the default.
If you don't have an agent ID, omit `--agent` (the CLI will prompt).

## After Setup

Both paths give you a Next.js app connected to iblai.app.
Visit http://localhost:3000 -- you'll be redirected to login.iblai.app.
Log in or create a free account, then you're back in your app.

For environment configuration, see `/iblai-env`.
For CLI installation, see `/iblai-install`.

## Non-Interactive Mode (CI/CD)

Skip all prompts with `--yes` (requires `--platform` and `--app-name`):

```bash
iblai startapp agent \
  --yes \
  --platform acme \
  --agent my-agent-id \
  --app-name my-app
```

## AI-Enhanced Scaffolding

Customize the generated app with AI during scaffolding:

```bash
iblai startapp agent \
  --platform acme \
  --anthropic-key sk-ant-... \
  --prompt "Make this a kids learning assistant with bright, playful colors"
```

## What the Full Agent App Generates

- Next.js 16 App Router project with TypeScript
- SSO authentication flow (client-side, no API tokens)
- AI chat interface (`<mentor-ai>` web component)
- Redux Toolkit store with @iblai/iblai-js data layer
- Tailwind CSS 4 + shadcn/ui (new-york style)
- Playwright E2E test setup
- CLAUDE.md, skills, and MCP config for AI-assisted development
