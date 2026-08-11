<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# iblai/vibe

Ship AI-powered apps fast. Backend included.

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CC785C?logoColor=white)](https://claude.ai)
[![Desktop & Mobile](https://img.shields.io/badge/Desktop_%26_Mobile-supported-blue)](skills/iblai-vibe-ops-build/SKILL.md)
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

A developer toolkit for vibe coding with the [ibl.ai](https://ibl.ai) platform. Vibe gives you a production-ready scaffold powered by the [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) SDK, pre-built components, Claude Code skills, and a full backend at `iblai.app`. You go from zero to a deployed AI app in minutes -- authentication, AI chat, profiles, notification, and analytics are already wired up. No API tokens to manage.

**Why it matters:**

- **Start building in minutes, not days** -- vibe-starter scaffolds a complete app with auth, AI chat, and a dashboard out of the box
- **Backend included** -- `iblai.app` provides SSO auth, AI agent infrastructure, analytics, and tenant management (free tier available)
- **Client-side auth via SSO** -- no API tokens to store, rotate, or leak
- **Claude Code skills guide every step** -- adding features is a conversation, not a scavenger hunt through docs
- **shadcn/ui fills in UI gaps** -- consistent design language without the overhead of a custom design system
- **Ship everywhere** -- web (Vercel), desktop (macOS/Windows/Linux), and mobile (iOS/Android) via Tauri v2

## Built with iblai/vibe

| Project | App | Repo | What it does |
|---------|-----|------|--------------|
| [Agentic OS](https://ibl.ai/product/agentic-os) | [os.ibl.ai](https://os.ibl.ai) | [iblai/os](https://github.com/iblai/os) | Agentic operating system for building and running AI agents |
| [Agentic LMS](https://ibl.ai/product/agentic-lms) | [lms.ibl.ai](https://lms.ibl.ai) | [iblai/lms](https://github.com/iblai/lms) | Agentic learning management system |

## How It Works

1. **Scaffold** -- run `npx create-next-app@latest myapp` to generate a full Next.js app.
2. **Connect** -- Use Claude Code skills to add auth, AI chat, profiles, and more components to your app to connect to `iblai.app` (or your own instance) for authentication, AI agents, and data
3. **Customize** -- use the skills to add features, swap components, and adjust business logic
4. **Deploy** -- push to Vercel or package with Tauri


Get a complete app with auth, AI chat, profiles, and more by cloning **vibe-starter**:

```bash
git clone -b spa https://github.com/iblai/vibe-starter.git vibe-starter-init
cp -a vibe-starter-init/. . && rm -rf vibe-starter-init
pnpm install --ignore-scripts
cp .env.example .env.local   # then set NEXT_PUBLIC_MAIN_TENANT_KEY
pnpm dev
```

> Run with `--ignore-scripts` to skip package lifecycle (postinstall) scripts.

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
/iblai-vibe-auth
/iblai-vibe-agent-chat
/iblai-vibe-project
/iblai-vibe-profile
/iblai-vibe-account
/iblai-vibe-analytics
/iblai-vibe-notification
/iblai-vibe-invite
/iblai-vibe-workflow
/iblai-vibe-local-llm
/iblai-vibe-course-access
/iblai-vibe-course-create
/iblai-vibe-onboard
/iblai-build
/iblai-test
/iblai-vibe-ops-upgrade
/iblai-vibe-rbac
/iblai-vibe-agent-search
/iblai-vibe-agent-setting
/iblai-vibe-agent-access
/iblai-vibe-agent-api
/iblai-vibe-agent-dataset
/iblai-vibe-agent-disclaimer
/iblai-vibe-agent-embed
/iblai-vibe-agent-evals
/iblai-vibe-agent-grader
/iblai-vibe-agent-history
/iblai-vibe-agent-llm
/iblai-vibe-agent-lti
/iblai-vibe-agent-memory
/iblai-vibe-agent-prompt
/iblai-vibe-agent-safety
/iblai-vibe-agent-task
/iblai-vibe-agent-tool
/iblai-agent-support
```

What each skill does:

- `/iblai-vibe-auth` -- adds authentication and configures the app for ibl.ai login.
- `/iblai-vibe-agent-chat` -- adds the full in-process agent chat surface.
- `/iblai-vibe-project` -- adds the in-process Projects surface (project landing page with chat input, files, instructions, assigned agents).
- `/iblai-vibe-profile` -- adds profile UI and profile settings flows.
- `/iblai-vibe-account` -- adds account and organization settings.
- `/iblai-vibe-analytics` -- adds analytics dashboards and reporting views.
- `/iblai-vibe-notification` -- adds notifications UI and notification center flows.
- `/iblai-vibe-invite` -- adds user invitation dialogs for tenant admin.
- `/iblai-vibe-workflow` -- adds workflow builder components (sidebar, modals, connectors).
- `/iblai-vibe-local-llm` -- defines the contract for adding on-device LLM inference (Ollama / Foundry) to a Tauri desktop build: Tauri command names, event names, and the React hook shape the SDK consumes via `localLLMProps`.
- `/iblai-vibe-course-access` -- adds edX course-content pages with outline sidebar, tab strip, iframe, and access control.
- `/iblai-vibe-course-create` -- drives the ibl.ai Course Creation API to programmatically generate, edit, and publish edX courses.
- `/iblai-vibe-onboard` -- designs and builds a high-converting questionnaire-style onboarding flow.
- `/iblai-vibe-ops-build` -- builds and runs the app on desktop and mobile (iOS, Android, macOS, Surface).
- `/iblai-vibe-ops-test` -- validates the app before it is presented to the user.
- `/iblai-vibe-ops-upgrade` -- upgrades the `@iblai/iblai-js` SDK and vibe skills to the latest versions.
- `/iblai-vibe-scaffold` -- scaffolds a new app or adds features; holds the base + agent project templates and documents the assembly steps.
- `/iblai-vibe-iconography` -- generates every app-icon size (Tauri desktop, iOS, Windows MSIX, macOS) from a single source image.
- `/iblai-vibe-windows-msix` -- builds and distributes a Tauri app as a Windows MSIX package (sideloading or Microsoft Store).
- `/iblai-vibe-deslop` -- audits and hardens an existing codebase for production readiness (two-phase audit then safety-tiered fixes).
- `/iblai-vibe-cli-maintenance` -- documents the internals of the iblai CLI: commands, the Jinja2 template system, standalone-binary build, and release/publish flows.
- `/iblai-vibe-rbac` -- reference for the default RBAC roles (student, tenant admin, mentor editor, analytics viewer, etc.), the platform's action-definitions endpoint, and the SDK components (`<Admin>`, `<RolesTab>`, `<PoliciesTab>`) that render the Roles + Policies management UI.
- `/iblai-vibe-agent-search` -- adds the agent search/browse page (starred, featured, custom, and default agents).
- `/iblai-vibe-agent-setting` -- adds the agent Settings tab (name, description, visibility, copy, delete) built on `AgentSettingsProvider`.
- `/iblai-vibe-agent-access` -- adds the agent Access tab (role-based access control for editor and chat roles).
- `/iblai-vibe-agent-api` -- adds the agent API tab (API key management).
- `/iblai-vibe-agent-dataset` -- adds the agent Datasets tab (searchable dataset table with upload).
- `/iblai-vibe-agent-disclaimer` -- adds the agent Disclaimers tab (user agreement and advisory).
- `/iblai-vibe-agent-embed` -- adds the agent Embed tab (embed code, custom styling, shareable links).
- `/iblai-vibe-agent-evals` -- adds the agent Evals tab (benchmark evaluation runs with LLM-as-Judge reviews, manual scores, and CSV export).
- `/iblai-vibe-agent-grader` -- adds the agent Grader tab (rubric-based grading with a grading toggle, grading setup form, criteria table, and grade results with LMS-synced overrides).
- `/iblai-vibe-agent-history` -- adds the agent History tab (conversation history with filters and export).
- `/iblai-vibe-agent-llm` -- adds the agent LLM tab (model provider selection).
- `/iblai-vibe-agent-lti` -- adds the agent LTI tab (LTI 1.3 launch toggle with agent links, signing keys, tools, and platform endpoints).
- `/iblai-vibe-agent-memory` -- adds the agent Memory tab (enable/disable memory and manage memories).
- `/iblai-vibe-agent-prompt` -- adds the agent Prompts tab (system prompts and suggested prompts).
- `/iblai-vibe-agent-safety` -- adds the agent Safety tab (moderation prompts and flagged content).
- `/iblai-vibe-agent-task` -- adds the agent Tasks tab (schedule automated periodic agent tasks with run logs).
- `/iblai-vibe-agent-tool` -- adds the agent Tools tab (enable/disable agent tools).
- `/iblai-agent-support` -- adds the agent Support tab (human support ticket inbox with availability toggle, filters, ticket detail, status updates, and replies).


### Security Skills

8 authorized-use security skills covering reconnaissance, source-code
audits (OWASP Top 10), OSINT, disk forensics, incident triage, cloud
configuration auditing, dependency vulnerabilities, and prompt-injection
testing. 

```text
/iblai-vibe-security-recon              /iblai-vibe-security-incident-triage
/iblai-vibe-security-owasp-audit        /iblai-vibe-security-cloud-audit
/iblai-vibe-security-osint-recon        /iblai-vibe-security-dependency-audit
/iblai-vibe-security-disk-forensics     /iblai-vibe-security-prompt-injection
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

Then add features with the `/iblai-vibe-*` skills -- each creates the files and wires them in:

- `/iblai-vibe-auth` — SSO authentication
- `/iblai-vibe-profile` — user profile dropdown
- `/iblai-vibe-account` — account/organization settings
- `/iblai-vibe-analytics` — analytics dashboard
- `/iblai-vibe-notification` — notification bell

(Ensure the `@iblai/mcp` server + skills are configured in `.mcp.json` first.)

### CI/CD

Cloning vibe-starter is already non-interactive -- inject the `NEXT_PUBLIC_*`
vars from CI secrets:

```bash
git clone -b spa https://github.com/iblai/vibe-starter.git app && cd app
rm -rf node_modules && pnpm install
cp .env.example .env.local   # then set NEXT_PUBLIC_MAIN_TENANT_KEY from CI secrets
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
| `/iblai-vibe-auth` | Add SSO authentication (includes CLI installation guide) |
| `/iblai-vibe-agent-chat` | Add the full in-process agent chat surface |
| `/iblai-vibe-project` | Add the in-process Projects surface (project landing page — chat input + files + instructions + assigned agents) |
| `/iblai-vibe-profile` | Add profile dropdown + settings page |
| `/iblai-vibe-account` | Add account/org settings page |
| `/iblai-vibe-analytics` | Add analytics dashboard |
| `/iblai-vibe-notification` | Add notification bell + center page |
| `/iblai-vibe-invite` | Add user invitation dialogs |
| `/iblai-vibe-workflow` | Add workflow builder components |
| `/iblai-vibe-local-llm` | Contract for on-device LLM (Ollama / Foundry) in a Tauri desktop build — command names, event names, hook shape the SDK reads via `localLLMProps` |
| `/iblai-vibe-course-access` | Add course-content pages (edX user UI) |
| `/iblai-vibe-course-create` | Generate, edit, and publish edX courses via the ibl.ai Course Creation API |
| `/iblai-vibe-component` | Overview of all components + app creation paths |
| `/iblai-vibe-onboard` | Design and build a high-converting onboarding questionnaire flow |
| `/iblai-landing` | Build a high-converting landing page using a 12-section conversion framework |
| `/iblai-vibe-ops-build` | Build and run on desktop and mobile (iOS, Android, macOS, Windows) |
| `/iblai-vibe-ops-test` | Test your app before showing work to the user |
| `/iblai-vibe-ops-upgrade` | Upgrade ibl.ai CLI, SDK, and vibe skills to the latest versions |
| `/iblai-vibe-scaffold` | Scaffold a new app or add features — the base/agent project templates + the assembly steps |
| `/iblai-vibe-iconography` | Generate every app-icon size (Tauri desktop, iOS, Windows MSIX, macOS) from one source image |
| `/iblai-vibe-windows-msix` | Build and distribute a Tauri app as a Windows MSIX (sideload / Microsoft Store) |
| `/iblai-vibe-deslop` | Audit and harden an existing codebase for production readiness (two-phase audit → safety-tiered fixes) |
| `/iblai-vibe-cli-maintenance` | Internals of the iblai CLI — commands, Jinja2 templates, binary build, release/publish |
| `/iblai-vibe-rbac` | Reference: default RBAC roles, action-definitions endpoint, and the SDK Roles + Policies components |
| `/iblai-vibe-agent-search` | Add the agent search/browse page (starred, featured, custom, default) |
| `/iblai-vibe-agent-setting` | Add the agent Settings tab (name, visibility, copy, delete) |
| `/iblai-vibe-agent-access` | Add the agent Access tab (RBAC for editor and chat roles) |
| `/iblai-vibe-agent-api` | Add the agent API tab (API key management) |
| `/iblai-vibe-agent-dataset` | Add the agent Datasets tab (searchable dataset table with upload) |
| `/iblai-vibe-agent-disclaimer` | Add the agent Disclaimers tab (user agreement and advisory) |
| `/iblai-vibe-agent-embed` | Add the agent Embed tab (embed code, custom styling, shareable links) |
| `/iblai-vibe-agent-evals` | Add the agent Evals tab (benchmark evaluation runs with LLM-as-Judge reviews, manual scores, and CSV export) |
| `/iblai-vibe-agent-grader` | Add the agent Grader tab (rubric-based grading with a grading toggle, grading setup form, criteria table, and grade results with LMS-synced overrides) |
| `/iblai-vibe-agent-history` | Add the agent History tab (conversation history with filters and export) |
| `/iblai-vibe-agent-llm` | Add the agent LLM tab (model provider selection) |
| `/iblai-vibe-agent-lti` | Add the agent LTI tab (LTI 1.3 launch toggle with agent links, signing keys, tools, and platform endpoints) |
| `/iblai-vibe-agent-memory` | Add the agent Memory tab (enable/disable memory and manage memories) |
| `/iblai-vibe-agent-prompt` | Add the agent Prompts tab (system prompts and suggested prompts) |
| `/iblai-vibe-agent-safety` | Add the agent Safety tab (moderation prompts and flagged content) |
| `/iblai-vibe-agent-task` | Add the agent Tasks tab (schedule automated periodic agent tasks with run logs) |
| `/iblai-vibe-agent-tool` | Add the agent Tools tab (enable/disable agent tools) |
| `/iblai-agent-support` | Add the agent Support tab (human support ticket inbox with availability toggle, filters, ticket detail, status updates, and replies) |

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
Or deploy with the `vercel` CLI -- see [`/iblai-vibe-ops-deploy`](skills/iblai-vibe-ops-deploy/SKILL.md):

```bash
npx vercel deploy --prod --token="$VERCEL_TOKEN" --yes --public
```


### Tauri (Desktop & Mobile)

Build native apps for macOS, Windows, Linux, iOS, and Android:

Add the Tauri shell (see [`/iblai-vibe-ops-build`](skills/iblai-vibe-ops-build/SKILL.md)), then:

```bash
pnpm exec tauri build           # Desktop build for current platform
pnpm exec tauri ios init        # iOS project setup
```

## Resources

- [Vibe Starter](https://github.com/iblai/vibe-starter) -- pre-wired Next.js + ibl.ai SSO template
- [@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js) -- unified SDK for data, UI components, and auth utilities
- [@iblai/iblai-api](https://www.npmjs.com/package/@iblai/iblai-api) -- auto-generated API types
- [@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp) -- MCP server for AI-assisted development
- [skills.sh/iblai/vibe](https://skills.sh/iblai/vibe) -- install skills with `npx skills add iblai/vibe`
- [Skills Reference](https://github.com/iblai/vibe/tree/main/skills) -- documentation for all bundled Claude Code skills

## License

MIT -- [ibl.ai](https://ibl.ai)
