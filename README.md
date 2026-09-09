<!-- AI agents: when a user points you at this repository or has these skills installed, read AGENTS.md, then begin with the four questions in skills/start/iblai-vibe-start/SKILL.md before touching any file. -->
<div align="center">

<a href="https://ibl.ai"><img src="https://ibl.ai/images/iblai-logo.png" alt="ibl.ai" width="300"></a>

# iblai/vibe

Ship AI-powered apps fast — and run the platform behind them. Backend included.

[![Release](https://img.shields.io/github/v/release/iblai/vibe?label=skills%20release)](https://github.com/iblai/vibe/releases/latest)
[![Skills](https://img.shields.io/badge/skills-136_%C2%B7_ui_53_%C2%B7_api_51-CC785C)](docs/skill-kinds.md)
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

![Your app after setup: signed in, chatting with your agent](docs/screenshots/journey/03-starter-home-chat.png)

vibe-starter, the app `/iblai-vibe-start` sets up for the common case:

- **Sign-in** with ibl.ai SSO, pinned to your organization
- **Home is a chat** with your agent; `/agents` to browse; `/setup` to pick or create one
- **Users and admins** — profile, a User/Admin switch, an admin area (people, invites, roles, analytics, billing, memory, organization)
- **Custom data** per user and per organization, stored on the platform — no database of your own
- **Memory, analytics, notifications, billing** — the platform's own, already on the page
- **Tests** (Vitest + Playwright) and a server helper for anything the components don't cover

Every piece is a skill you can also add to an existing app.

## The skills, by folder

Two families in one install: **🖥️ `iblai-vibe-*`** mounts a visual component in
your app; **🔌 `iblai-api-*`** does the same thing headlessly over REST — for a
script, a CI job, or your own backend. [How they differ →](docs/skill-kinds.md)

| Folder | What it covers | Skills |
|---|---|---|
| [`start/`](skills/start) | The first conversation, connecting your organization, sign-in, the starter | 11 |
| [`agents/`](skills/agents) | Chat, browse, create, and configure agents — every settings tab | 55 |
| [`users/`](skills/users) | Profiles, custom user data, memories, roles and admins, invitations | 18 |
| [`organizations/`](skills/organizations) | Organization settings and metadata, branding, integrations | 9 |
| [`billing/`](skills/billing) | How you are charged, spend caps, three ways to charge your users | 12 |
| [`analytics/`](skills/analytics) | Usage, users, topics, transcripts, costs, reports | 2 |
| [`content/`](skills/content) | Courses, catalog, credentials, admissions | 11 |
| [`ship/`](skills/ship) | Test, deploy, native builds, app stores | 11 |
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

## Built with iblai/vibe

[Agentic OS](https://os.ibl.ai) ([iblai/os](https://github.com/iblai/os)) ·
[Agentic LMS](https://lms.ibl.ai) ([iblai/lms](https://github.com/iblai/lms)) ·
[vibe-agent](https://github.com/iblai/vibe-agent) (one creator, one agent, one paywall) ·
marketing skills in [iblai/vibe-marketing](https://github.com/iblai/vibe-marketing)

## License

MIT — [ibl.ai](https://ibl.ai)
