<!-- AI agents: when a user points you at this repository or has these skills installed, read AGENTS.md, then begin with the four questions in skills/start/iblai-vibe-start/SKILL.md before touching any file. -->
<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# iblai/vibe

Ship AI-powered apps fast — and run the platform behind them. Backend included.

[![Release](https://img.shields.io/github/v/release/iblai/vibe?label=skills%20release)](https://github.com/iblai/vibe/releases/latest)
[![Skills](https://img.shields.io/badge/skills-154_%C2%B7_ui_54_%C2%B7_api_66-CC785C)](docs/skill-kinds.md)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude Code](https://img.shields.io/badge/Claude_Code-CC785C?logoColor=white)](https://claude.ai/code)
[![OpenAI Codex](https://img.shields.io/badge/OpenAI_Codex-000000?logo=openai&logoColor=white)](https://openai.com/codex)
[![Cursor](https://img.shields.io/badge/Cursor-000000?logoColor=white)](https://cursor.com)
[![Desktop & Mobile](https://img.shields.io/badge/Desktop_%26_Mobile-supported-blue)](skills/ship/iblai-vibe-ops-build/SKILL.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)

</div>

> **Note:** This toolkit runs against the hosted `iblai.app` environment. If you'd like a license to the full platform codebase to run locally or self-host, reach out to our team at [ibl.ai/contact](https://ibl.ai/contact).

---

Build the app you actually need on [ibl.ai](https://ibl.ai) — sign-in, an AI
agent to talk to, users and admins, custom data, memory, analytics, billing —
as a website and as macOS, Windows, iOS, and Android apps. Or run the platform
with no UI at all. One install; your coding agent does the rest.

## Three steps

**1. Install the skills** in the agent you already use.

```bash
npx skills add iblai/vibe --all        # Claude Code, OpenAI Codex, Cursor, OpenCode, Copilot …
```

Claude Code users can install the plugin instead (same skills, plus the SDK-docs
MCP server, updated with `/plugin update`): `/plugin marketplace add iblai/vibe`
then `/plugin install iblai-vibe@iblai`.

**2. Say hello.**

```text
/iblai-vibe-connect
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
/iblai-vibe-agent-history
/iblai-vibe-agent-llm
/iblai-vibe-agent-memory
/iblai-vibe-agent-prompt
/iblai-vibe-agent-safety
/iblai-vibe-agent-task
/iblai-vibe-agent-tool
```

What each skill does:

- `/iblai-vibe-connect` -- connects the project to an ibl.ai organization via a one-click browser flow, writing the org key + a minted API token into the env files (the token never passes through the chat). Runs first, before building.
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
- `/iblai-vibe-agent-history` -- adds the agent History tab (conversation history with filters and export).
- `/iblai-vibe-agent-llm` -- adds the agent LLM tab (model provider selection).
- `/iblai-vibe-agent-memory` -- adds the agent Memory tab (enable/disable memory and manage memories).
- `/iblai-vibe-agent-prompt` -- adds the agent Prompts tab (system prompts and suggested prompts).
- `/iblai-vibe-agent-safety` -- adds the agent Safety tab (moderation prompts and flagged content).
- `/iblai-vibe-agent-task` -- adds the agent Tasks tab (schedule automated periodic agent tasks with run logs).
- `/iblai-vibe-agent-tool` -- adds the agent Tools tab (enable/disable agent tools).


### Security Skills

8 authorized-use security skills covering reconnaissance, source-code
audits (OWASP Top 10), OSINT, disk forensics, incident triage, cloud
configuration auditing, dependency vulnerabilities, and prompt-injection
testing. 
/iblai-vibe-start
```

Four questions — new project or existing code · one organization, many, or none ·
who signs in · what it's about (users · memories · agents · organizations). Then
it connects your ibl.ai organization (one click in the browser, or two pasted
values — the token never enters the chat) and builds. Thirty seconds after you
sign in you are chatting with your own agent, with users, an admin area, custom
user and organization settings, memory, analytics, and billing already wired.

**3. Ship.** `/iblai-vibe-ops-deploy` gives you a URL. `/iblai-vibe-ops-build`
gives you macOS, Windows, iOS, and Android.

New to ibl.ai? [ibl.ai/join](https://ibl.ai/join) creates your account and your
organization — free to start. Want the details of every step?
[Getting started →](docs/getting-started.md)

## What you get

vibe-starter, the app `/iblai-vibe-start` sets up for the common case:

- **Sign-in** with ibl.ai SSO, pinned to your organization
- **Home is a chat** with your agent; `/agents` to browse; `/setup` to pick or create one
- **Users and admins** — profile, a User/Admin switch, an admin area (people, invites, roles, analytics, billing, memory, organization)
- **Custom data** per user and per organization, stored on the platform — no database of your own
- **Memory, analytics, notifications, billing** — the platform's own, already on the page
- **Tests** (Vitest + Playwright) and a server helper for anything the components don't cover

Every piece is a skill you can also add to an existing app.

## Six things almost every app touches

Whatever you build, you will read or write these. Each has a component skill
and a headless twin that does the same thing over REST:

| | With a screen | Headless |
|---|---|---|
| **Custom data per user** — preferences, flags, onboarding, app state | `/iblai-vibe-user-metadata` | `/iblai-api-profile-metadata` |
| **The user's profile** — name, bio, image, résumé | `/iblai-vibe-profile` | `/iblai-api-profile` |
| **Memory** — user-global, per user × agent, agent knowledge | `/iblai-vibe-memory-guide` → `/iblai-vibe-memory`, `/iblai-vibe-agent-memory` | `/iblai-api-agent-memory` |
| **Custom data per organization** — branding, toggles, defaults | `/iblai-vibe-org-metadata` | `/iblai-api-org` |
| **Agent configuration** — create; identity, visibility, capabilities | `/iblai-vibe-agent-create` → `/iblai-vibe-agent-setting` | `/iblai-api-agent-create`, `/iblai-api-agent-setting` |
| **Analytics** — usage, transcripts, costs, audit, reports | `/iblai-vibe-analytics` | `/iblai-api-analytics` |

Not sure whether you want the per-user, per-agent, or per-organization one?
[Which scope stores what →](docs/catalogue.md#core)

## The skills, by folder

Two families in one install: **🖥️ `iblai-vibe-*`** mounts a visual component in
your app; **🔌 `iblai-api-*`** does the same thing headlessly over REST — for a
script, a CI job, or your own backend. [How they differ →](docs/skill-kinds.md)

| Folder | What it covers | Skills |
|---|---|---|
| [`start/`](skills/start) | The first conversation, connecting your organization, sign-in, the starter | 11 |
| [`agents/`](skills/agents) | Chat, browse, create, and configure agents — every settings tab | 56 |
| [`users/`](skills/users) | Profiles, custom user data, memories, roles and admins, invitations | 18 |
| [`organizations/`](skills/organizations) | Organization settings and metadata, branding, integrations | 9 |
| [`billing/`](skills/billing) | How you are charged, spend caps, three ways to charge your users | 12 |
| [`analytics/`](skills/analytics) | Usage, users, topics, transcripts, costs, reports | 2 |
| [`content/`](skills/content) | Courses, catalog, credentials, admissions, Open edX Studio, avatar video | 26 |
| [`ship/`](skills/ship) | Test, deploy, hosting, native builds, app stores | 12 |
| [`security/`](skills/security) | Authorized-use security work | 8 |

The full list with one line per skill: [docs/catalogue.md](docs/catalogue.md).

## Keep it current

This repo changes often. Installed skills are a copy — refresh them with the
install command above, or `/iblai-vibe-ops-upgrade` in Claude Code (your agent
will suggest it when the copy is more than two weeks old).
[Details →](docs/keep-current.md)

## Learn more

- [Getting started](docs/getting-started.md) — the journey in detail, and what to do when you already have an app
- [How sign-in and organizations work](docs/auth-model.md) — one organization, many, or none
- [Users, agents, organizations](docs/domain-model.md) — the data every app is built on
- [How money works](skills/billing/iblai-vibe-pricing/SKILL.md) · [Ship anywhere](docs/ship.md) · [The two MCP servers](docs/mcp-servers.md)
- [Contributing a skill](CONTRIBUTING.md) — including where it goes and how to catalogue it

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
| `/iblai-vibe-connect` | Connect the project to an ibl.ai org — one-click browser flow that writes the org key + a minted API token into the env files (no token in the chat) |
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
| `/iblai-vibe-agent-history` | Add the agent History tab (conversation history with filters and export) |
| `/iblai-vibe-agent-llm` | Add the agent LLM tab (model provider selection) |
| `/iblai-vibe-agent-memory` | Add the agent Memory tab (enable/disable memory and manage memories) |
| `/iblai-vibe-agent-prompt` | Add the agent Prompts tab (system prompts and suggested prompts) |
| `/iblai-vibe-agent-safety` | Add the agent Safety tab (moderation prompts and flagged content) |
| `/iblai-vibe-agent-task` | Add the agent Tasks tab (schedule automated periodic agent tasks with run logs) |
| `/iblai-vibe-agent-tool` | Add the agent Tools tab (enable/disable agent tools) |

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
## Built with iblai/vibe

[Agentic OS](https://os.ibl.ai) ([iblai/os](https://github.com/iblai/os)) ·
[Agentic LMS](https://lms.ibl.ai) ([iblai/lms](https://github.com/iblai/lms)) ·
[vibe-agent](https://github.com/iblai/vibe-agent) (one creator, one agent, one paywall) ·
marketing skills in [iblai/vibe-marketing](https://github.com/iblai/vibe-marketing)

## License

MIT — [ibl.ai](https://ibl.ai)
