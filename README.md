<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# Vibe

Ship AI-powered apps fast. Backend included.

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CC785C?logoColor=white)](https://claude.ai)
[![Desktop & Mobile](https://img.shields.io/badge/Desktop_%26_Mobile-supported-blue)](skills/iblai-ops-build/SKILL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

</div>

> **Note:** This toolkit runs against the hosted `iblai.app` environment. If you'd like a license to the full platform codebase to run locally or self-host, reach out to our team at [ibl.ai/contact](https://ibl.ai/contact).

---
## Quick Start
### Install Skills
#### Vibe Skills
Add ibl.ai skills to any project with one command:

```bash
npx skills add iblai/vibe
```

#### Vibe Marketing Skills
For marketing skills — conversion, copywriting, SEO, paid ads, lifecycle, growth (43 skills + 62 platform CLIs + 80 integration guides) — install the companion repo side-by-side:

```bash
npx skills add iblai/vibe-marketing
```

See [`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing) for the full catalogue.

### ibl.ai Components for Next.js Apps
Ask Claude to add ibl.ai Chat, Profile, Account, Notification or Analytics component to your Next.js project. 
### ibl.ai App Template
Ask Claude to start an ibl.ai agent app.
## What is Vibe

A developer toolkit for vibe coding with the [ibl.ai](https://ibl.ai) platform. Vibe gives you a production-ready scaffold powered by [iblai-app-cli](https://github.com/iblai/iblai-app-cli), the [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) SDK, pre-built components, Claude Code skills, and a full backend at `iblai.app`. You go from zero to a deployed AI app in minutes -- authentication, AI chat, profiles, notification, and analytics are already wired up. No API tokens to manage.

**Why it matters:**

- **Start building in minutes, not days** -- the CLI scaffolds a complete app with auth, AI chat, and a dashboard out of the box
- **Backend included** -- `iblai.app` provides SSO auth, AI agent infrastructure, analytics, and tenant management (free tier available)
- **Client-side auth via SSO** -- no API tokens to store, rotate, or leak
- **Claude Code skills guide every step** -- adding features is a conversation, not a scavenger hunt through docs
- **shadcn/ui fills in UI gaps** -- consistent design language without the overhead of a custom design system
- **Ship everywhere** -- web (Vercel), desktop (macOS/Windows/Linux), and mobile (iOS/Android) via Tauri v2

## How It Works

1. **Scaffold** -- run `npx create-next-app@latest myapp` to generate a full Next.js app.
2. **Connect** -- Use Claude Code skills to add auth, AI chat, profiles, and more components to your app to connect to `iblai.app` (or your own instance) for authentication, AI agents, and data
3. **Customize** -- use the skills to add features, swap components, and adjust business logic
4. **Deploy** -- push to Vercel or package with Tauri


Get a complete app with auth, AI chat, profiles, and more in one command (Check [iblai/iblai-app-cli](https://github.com/iblai/iblai-app-cli) for installation guide for the `iblai` CLI):

```bash
iblai startapp agent -o iblai-init
cp -a iblai-init/<app-name>/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `login.iblai.app` for login -- sign in or create a free account, and you are back in your app with a fully authenticated session.

### Install Skills

Add ibl.ai skills to any project with one command:

```bash
npx skills add iblai/vibe
```


This installs our vibe skills that teach your AI agent how to build with the ibl.ai platform -- authentication, AI chat, profiles, analytics, workflows, and more. Works with [Claude Code, Cursor, OpenCode, Copilot, and 15+ other agents](https://skills.sh).

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
/iblai-course-access
/iblai-course-create
/iblai-onboard
/iblai-build
/iblai-test
/iblai-ops-upgrade
/iblai-agent-search
/iblai-agent-setting
/iblai-agent-access
/iblai-agent-api
/iblai-agent-dataset
/iblai-agent-disclaimer
/iblai-agent-embed
/iblai-agent-history
/iblai-agent-llm
/iblai-agent-memory
/iblai-agent-prompt
/iblai-agent-safety
/iblai-agent-tool
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
- `/iblai-course-access` -- adds edX course-content pages with outline sidebar, tab strip, iframe, and access control.
- `/iblai-course-create` -- drives the ibl.ai Course Creation API to programmatically generate, edit, and publish edX courses.
- `/iblai-onboard` -- designs and builds a high-converting questionnaire-style onboarding flow.
- `/iblai-ops-build` -- builds and runs the app on desktop and mobile (iOS, Android, macOS, Surface).
- `/iblai-ops-test` -- validates the app before it is presented to the user.
- `/iblai-ops-upgrade` -- upgrades the ibl.ai CLI, SDK, and vibe skills to the latest versions.
- `/iblai-agent-search` -- adds the agent search/browse page (starred, featured, custom, and default agents).
- `/iblai-agent-setting` -- adds the agent Settings tab (name, description, visibility, copy, delete) built on `AgentSettingsProvider`.
- `/iblai-agent-access` -- adds the agent Access tab (role-based access control for editor and chat roles).
- `/iblai-agent-api` -- adds the agent API tab (API key management).
- `/iblai-agent-dataset` -- adds the agent Datasets tab (searchable dataset table with upload).
- `/iblai-agent-disclaimer` -- adds the agent Disclaimers tab (user agreement and advisory).
- `/iblai-agent-embed` -- adds the agent Embed tab (embed code, custom styling, shareable links).
- `/iblai-agent-history` -- adds the agent History tab (conversation history with filters and export).
- `/iblai-agent-llm` -- adds the agent LLM tab (model provider selection).
- `/iblai-agent-memory` -- adds the agent Memory tab (enable/disable memory and manage memories).
- `/iblai-agent-prompt` -- adds the agent Prompts tab (system prompts and suggested prompts).
- `/iblai-agent-safety` -- adds the agent Safety tab (moderation prompts and flagged content).
- `/iblai-agent-tool` -- adds the agent Tools tab (enable/disable agent tools).


### Security Skills

8 authorized-use security skills covering reconnaissance, source-code
audits (OWASP Top 10), OSINT, disk forensics, incident triage, cloud
configuration auditing, dependency vulnerabilities, and prompt-injection
testing. 

```text
/iblai-security-recon              /iblai-security-incident-triage
/iblai-security-owasp-audit        /iblai-security-cloud-audit
/iblai-security-osint-recon        /iblai-security-dependency-audit
/iblai-security-disk-forensics     /iblai-security-prompt-injection
```

See [`CLAUDE.md`](CLAUDE.md#security-skills) for one-line descriptions.

### Marketing Skills

The 43 marketing skills (CRO, copywriting, SEO, paid ads, lifecycle,
growth) plus the `tools/` directory (62 platform CLIs + 80 integration
guides) now live in the companion
[`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing) repo.

Install side-by-side with vibe:

```bash
npx skills add iblai/vibe-marketing
```

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

Then use the [CLI](https://github.com/iblai/iblai-app-cli) to add features:

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
iblai startapp agent --yes --platform acme --agent my-id --app-name my-app -o iblai-init
cp -a iblai-init/my-app/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
cp .env.example .env.local
```

## The iblai Backend

`https://api.iblai.app` is the production backend that powers every Vibe app. You do not need to build, host, or maintain any backend services.

**What iblai.app provides:**

- **SSO Authentication** -- OAuth-based login with session management, RBAC, and multi-tenant user isolation
- **AI Agent Infrastructure** -- create, configure, and serve AI agents with streaming responses, tool use, and RAG
- **Analytics** -- track user activity, conversation metrics, and engagement across your app
- **Tenant Management** -- each tenant gets its own users, agents, branding, and configuration

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
| `/iblai-course-access` | Add course-content pages (edX learner UI) |
| `/iblai-course-create` | Generate, edit, and publish edX courses via the ibl.ai Course Creation API |
| `/iblai-component` | Overview of all components + app creation paths |
| `/iblai-onboard` | Design and build a high-converting onboarding questionnaire flow |
| `/iblai-landing` | Build a high-converting landing page using a 12-section conversion framework |
| `/iblai-ops-build` | Build and run on desktop and mobile (iOS, Android, macOS, Windows) |
| `/iblai-ops-test` | Test your app before showing work to the user |
| `/iblai-ops-upgrade` | Upgrade ibl.ai CLI, SDK, and vibe skills to the latest versions |
| `/iblai-agent-search` | Add the agent search/browse page (starred, featured, custom, default) |
| `/iblai-agent-setting` | Add the agent Settings tab (name, visibility, copy, delete) |
| `/iblai-agent-access` | Add the agent Access tab (RBAC for editor and chat roles) |
| `/iblai-agent-api` | Add the agent API tab (API key management) |
| `/iblai-agent-dataset` | Add the agent Datasets tab (searchable dataset table with upload) |
| `/iblai-agent-disclaimer` | Add the agent Disclaimers tab (user agreement and advisory) |
| `/iblai-agent-embed` | Add the agent Embed tab (embed code, custom styling, shareable links) |
| `/iblai-agent-history` | Add the agent History tab (conversation history with filters and export) |
| `/iblai-agent-llm` | Add the agent LLM tab (model provider selection) |
| `/iblai-agent-memory` | Add the agent Memory tab (enable/disable memory and manage memories) |
| `/iblai-agent-prompt` | Add the agent Prompts tab (system prompts and suggested prompts) |
| `/iblai-agent-safety` | Add the agent Safety tab (moderation prompts and flagged content) |
| `/iblai-agent-tool` | Add the agent Tools tab (enable/disable agent tools) |

Skills are in `skills/` (symlinked to `.claude/skills/`). Read them, extend them, or write your own.

## Platform Capabilities

| Feature | Web | macOS | Windows/Surface | iOS | Android |
|---------|-----|-------|-----------------|-----|---------|
| SSO Authentication | Yes | Yes | Yes | No | No |
| AI Chat | Yes | Yes | Yes | Yes | Yes |
| User Profile | Yes | Yes | Yes | Yes | Yes |
| Account Settings | Yes | Yes | Yes | Yes | Yes |
| Analytics Dashboard | Yes | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes |

> **iOS & Android SSO limitation:** Mobile WebViews use a non-standard user-agent that SSO providers reject. Completing the OAuth flow requires a system browser popup (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android). This is not yet implemented -- mobile users must authenticate via another method for now.

## Deploy Anywhere

### Vercel (recommended)

One-click deploy. Connect your repo, set your environment variables, and push.

```bash
iblai deploy vercel
```


### Tauri (Desktop & Mobile)

Build native apps for macOS, Windows, Linux, iOS, and Android:

```bash
iblai add builds              # Add Tauri support
iblai builds build            # Desktop build for current platform
iblai builds ios init         # iOS project setup
iblai builds ci-workflow --all  # GitHub Actions for all platforms
```

## Built with iblai/vibe

Apps shipped on top of this toolkit. Open a PR to add yours.

| Project | What it does |
|---------|--------------|
| [iblai/videoai](https://github.com/iblai/videoai) | AI video generation and editing |
| [iblai/recruitai](https://github.com/iblai/recruitai) | AI-powered recruiting and candidate screening |

## Resources

- [iblai-app-cli](https://github.com/iblai/iblai-app-cli) -- the CLI that scaffolds Vibe apps
- [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) -- unified SDK for data, UI components, and auth utilities
- [@iblai/iblai-api](https://www.npmjs.com/package/@iblai/iblai-api) -- auto-generated API types
- [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) -- MCP server for AI-assisted development
- [skills.sh/iblai/vibe](https://skills.sh/iblai/vibe) -- install skills with `npx skills add iblai/vibe`
- [Skills Reference](https://github.com/iblai/iblai-app-cli#skills) -- documentation for all bundled Claude Code skills

## License

MIT -- [ibl.ai](https://ibl.ai)
