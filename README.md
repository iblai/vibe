<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# Vibe

Ship AI-powered apps fast. Backend included.

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CC785C?logoColor=white)](https://claude.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

</div>

---
## Quick Start
### Install Skills

Add ibl.ai skills to any project with one command:

```bash
npx skills add iblai/vibe
```
### ibl.ai Components for Next.js Apps
Ask Claude to add ibl.ai Chat, Profile, Account, Notification or Analytics component to your Next.js project. 
### ibl.ai App Template
Ask Claude to start an ibl.ai agent app.
## What is Vibe

A developer toolkit for vibe coding with the [ibl.ai](https://ibl.ai) platform. Vibe gives you a production-ready scaffold powered by [iblai-app-cli](https://github.com/iblai/iblai-app-cli), the [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) SDK, pre-built components, Claude Code skills, and a full backend at [iblai.app](https://iblai.app). You go from zero to a deployed AI app in minutes -- authentication, AI chat, profiles, notification, and analytics are already wired up. No API tokens to manage.

**Why it matters:**

- **Start building in minutes, not days** -- the CLI scaffolds a complete app with auth, AI chat, and a dashboard out of the box
- **Backend included** -- [iblai.app](https://iblai.app) provides SSO auth, AI agent infrastructure, analytics, and tenant management (free tier available)
- **Client-side auth via SSO** -- no API tokens to store, rotate, or leak
- **Claude Code skills guide every step** -- adding features is a conversation, not a scavenger hunt through docs
- **shadcn/ui fills in UI gaps** -- consistent design language without the overhead of a custom design system
- **Ship everywhere** -- web (Vercel), desktop (macOS/Windows/Linux), and mobile (iOS/Android) via Tauri v2

## How It Works

1. **Scaffold** -- run `npx @iblai/cli startapp agent` to generate a full Next.js app with auth, AI chat, profiles, and more
2. **Connect** -- your app connects to [iblai.app](https://iblai.app) (or your own tenant) for authentication, AI agents, and data
3. **Customize** -- use Claude Code skills to add features, swap components, and adjust business logic
4. **Deploy** -- push to Vercel, package with Tauri, or run in Docker


Get a complete app with auth, AI chat, profiles, and more in one command:

```bash
iblai startapp agent
cd <app-name> && pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to [iblai.app](https://iblai.app) for login -- sign in or create a free account, and you are back in your app with a fully authenticated session.

To get your own branded tenant (custom domain, your logo, your users), register at [mentorai.iblai.app](https://mentorai.iblai.app).

### Install Skills

Add ibl.ai skills to any project with one command:

```bash
npx skills add iblai/vibe
```


This installs 9 skills that teach your AI agent how to build with the ibl.ai platform -- authentication, AI chat, profiles, analytics, workflows, and more. Works with [Claude Code, Cursor, OpenCode, Copilot, and 15+ other agents](https://skills.sh).

### Skills Usage Guide

After installing the skills, use them directly in your AI agent with `/` commands:

```text
/iblai-auth
/iblai-chat
/iblai-profile
/iblai-account
/iblai-analytics
/iblai-notification
/iblai-invite
/iblai-workflow
/iblai-test
```

What each skill does:

- `/iblai-auth` -- adds authentication and configures the app for ibl.ai login.
- `/iblai-chat` -- adds the AI chat experience and agent integration.
- `/iblai-profile` -- adds profile UI and profile settings flows.
- `/iblai-account` -- adds account and organization settings.
- `/iblai-analytics` -- adds analytics dashboards and reporting views.
- `/iblai-notification` -- adds notifications UI and notification center flows.
- `/iblai-invite` -- adds user invitation dialogs for tenant admin.
- `/iblai-workflow` -- adds workflow builder components (sidebar, modals, connectors).
- `/iblai-test` -- validates the app before it is presented to the user.

## What You Get

| Feature | Description |
|---------|-------------|
| **Authentication** | SSO login via iblai.app -- no token management, session handling built in |
| **AI Chat** | Streaming chat with ibl.ai agents, markdown rendering, conversation history |
| **User Profile** | Editable profile page with avatar, bio, and preferences |
| **Account Settings** | Password changes, notification preferences, connected services |
| **Analytics Dashboard** | Usage metrics, conversation stats, and user activity |
| **Notification** | Real-time notification system with read/unread state |
| **Desktop & Mobile** | Tauri v2 integration for macOS, Windows, Linux, iOS, and Android |
| **AI Development Skills** | Claude Code skills that walk you through adding and customizing every feature |

## Add to Existing Apps

Already have a project? Install the skills and let your AI agent add features:

```bash
npx skills add iblai/vibe
```

Then use the CLI to add features:

```bash
iblai add mcp            # MCP servers + skills (run first)
iblai add auth           # SSO authentication
iblai add chat           # AI chat with streaming
iblai add profile        # User profile dropdown
iblai add account        # Account/organization settings
iblai add analytics      # Analytics dashboard
iblai add notification  # Notification bell
```

### CI/CD

Use `--yes` to skip interactive prompts:

```bash
npx @iblai/cli startapp agent --yes --platform acme --agent my-id --app-name my-app
```

## The iblai Backend

[iblai.app](https://iblai.app) is the production backend that powers every Vibe app. You do not need to build, host, or maintain any backend services.

**What iblai.app provides:**

- **SSO Authentication** -- OAuth-based login with session management, RBAC, and multi-tenant user isolation
- **AI Agent Infrastructure** -- create, configure, and serve AI agents with streaming responses, tool use, and RAG
- **Analytics** -- track user activity, conversation metrics, and engagement across your app
- **Tenant Management** -- each tenant gets its own users, agents, branding, and configuration

A free tier is available. Register at [mentorai.iblai.app](https://mentorai.iblai.app) to get your own tenant with custom branding and domain.

## AI-Assisted Development

Vibe is designed to be built with AI. The [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) server gives Claude Code deep knowledge of the ibl.ai platform, and the bundled skills guide you through every common task.

### MCP Server

Add this to your `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "iblai": {
      "command": "npx",
      "args": ["-y", "@iblai/mcp"]
    }
  }
}
```

This gives your AI assistant access to:

```
get_component_info("ChatWidget")              # Props, usage, examples for any component
get_hook_info("useAdvancedChat")              # Hook parameters and return types
get_api_query_info("useGetUserMetadataQuery") # RTK Query endpoint details
get_provider_setup("auth")                    # Provider hierarchy and setup code
create_page_template("Dashboard", "mentor")   # Generate a page following ibl.ai patterns
```

### Claude Code Skills

The scaffolded app ships with skills that teach Claude how to work with your codebase. Instead of reading docs, you tell Claude what you want and the skills provide the context:

| Skill | Description |
|-------|-------------|
| `/iblai-auth` | Add SSO authentication (includes CLI installation guide) |
| `/iblai-chat` | Add AI chat widget |
| `/iblai-profile` | Add profile dropdown + settings page |
| `/iblai-account` | Add account/org settings page |
| `/iblai-analytics` | Add analytics dashboard |
| `/iblai-notification` | Add notification bell + center page |
| `/iblai-invite` | Add user invitation dialogs |
| `/iblai-workflow` | Add workflow builder components |
| `/iblai-component` | Overview of all components + app creation paths |
| `/iblai-test` | Test your app before showing work to the user |

Skills are in `skills/` (symlinked to `.claude/skills/`). Read them, extend them, or write your own.

## Deploy Anywhere

### Vercel (recommended)

One-click deploy. Connect your repo, set your environment variables, and push.

```bash
vercel --prod
```

### Docker

```bash
docker build -t my-vibe-app .
docker run -p 3000:3000 my-vibe-app
```

### Tauri (Desktop & Mobile)

Build native apps for macOS, Windows, Linux, iOS, and Android:

```bash
iblai add builds              # Add Tauri support
iblai builds build            # Desktop build for current platform
iblai builds ios init         # iOS project setup
iblai builds ci-workflow --all  # GitHub Actions for all platforms
```

## Built With Vibe

- [**mentorAI**](https://github.com/iblai/mentorai) -- Production AI mentor platform with streaming chat, voice calls, screen sharing, analytics, RBAC, and Stripe billing

## Resources

- [iblai-app-cli](https://github.com/iblai/iblai-app-cli) -- the CLI that scaffolds Vibe apps
- [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) -- unified SDK for data, UI components, and auth utilities
- [@iblai/iblai-api](https://www.npmjs.com/package/@iblai/iblai-api) -- auto-generated API types
- [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) -- MCP server for AI-assisted development
- [mentorai.iblai.app](https://mentorai.iblai.app) -- register for a free tenant
- [skills.sh/iblai/vibe](https://skills.sh/iblai/vibe) -- install skills with `npx skills add iblai/vibe`
- [Skills Reference](https://github.com/iblai/iblai-app-cli#skills) -- documentation for all bundled Claude Code skills

## License

MIT -- [ibl.ai](https://ibl.ai)
