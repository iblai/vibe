# Building apps on ibl.ai — vibe + app-cli

This is the **build layer** in depth: how [iblai/vibe](https://github.com/iblai/vibe)
and the `iblai-app-cli` scaffolder let you (and your AI agent) go from zero to a
deployed AI app on the ibl.ai backend in minutes — with authentication, AI chat,
profiles, notifications, and analytics already wired up. Unlike this repo
(the `iblai-api-*` skills, now in this same repo), which authenticate with an Api-Token to *operate* the platform, the `iblai-vibe-*` skills
apps authenticate with **client-side SSO** — there are no API tokens to store, rotate,
or leak. Two production apps are built this way: **Agentic OS**
([os.ibl.ai](https://os.ibl.ai)) and **Agentic LMS** ([lms.ibl.ai](https://lms.ibl.ai)).

Install the skills into any project with `npx skills add iblai/vibe`; then tell your
AI agent what you want and the skills supply the context (they're symlinked into
`.claude/skills/`). For a full platform-codebase license (run locally / self-host),
contact [ibl.ai/contact](https://ibl.ai/contact).

## What you get

| Feature | Description |
| ------- | ----------- |
| **Authentication** | SSO login via iblai.app — no token management; session handling built in |
| **AI Chat** | Streaming chat with ibl.ai agents, markdown rendering, conversation history |
| **User Profile** | Editable profile page with avatar, bio, and preferences |
| **Account Settings** | Password changes, notification preferences, connected services |
| **Analytics Dashboard** | Usage metrics, conversation stats, user activity |
| **Notifications** | Real-time notification system with read/unread state |
| **Desktop & Mobile** | Tauri v2 integration for macOS, Windows, Linux, iOS, and Android |
| **AI Development Skills** | Claude Code skills that walk you through adding and customizing every feature |

**Why it matters:** start building in minutes, not days (the CLI scaffolds a complete
app out of the box); backend included (free tier available); client-side SSO auth (no
tokens to leak); Claude Code skills make adding features a conversation, not a docs
scavenger hunt; shadcn/ui fills UI gaps without a custom design system; ship
everywhere — web (Vercel), desktop (macOS/Windows/Linux), and mobile (iOS/Android)
via Tauri v2.

**How it works:** *Scaffold* (generate a full Next.js app with the CLI) → *Connect*
(skills add auth, AI chat, profiles, and more, wired to `iblai.app` — or your own
instance — for auth, agents, and data) → *Customize* (skills add features, swap
components, adjust business logic) → *Deploy* (push to Vercel, package with Tauri, or
run in Docker).

## The `@iblai` packages

| Package / tool | What it is |
| -------------- | ---------- |
| **`iblai-app-cli`** (npm **`@iblai/cli`**) | The scaffolding CLI — generates ibl.ai frontend apps (Next.js + React) from project templates, component libraries, and config presets. Invoked as `iblai …` or `npx @iblai/cli …`. Ships with the vibe repo. |
| **[`@iblai/iblai-js`](https://www.npmjs.com/package/@iblai/iblai-js)** | The unified SDK — data layer (`/data-layer`), auth + org utilities (`/web-utils`), and shared UI components (`/web-containers`) in one package. |
| **[`@iblai/iblai-api`](https://www.npmjs.com/package/@iblai/iblai-api)** | Auto-generated API types. |
| **[`@iblai/mcp`](https://www.npmjs.com/package/@iblai/mcp)** | The AI-assisted-development MCP server (below). |

> **On the CLI's home:** `iblai-app-cli` is a command-line scaffolding tool that
> generates ibl.ai frontend applications with Next.js and React, providing project
> templates, component libraries, and configuration presets. Its authoritative repo is
> **[github.com/iblai/vibe](https://github.com/iblai/vibe)** (the docs also reference
> it as `iblai/iblai-app-cli`). To work on the CLI itself: `git clone
> https://github.com/iblai/vibe.git && cd vibe`, then run it to scaffold an app.

## AI-assisted development (the `@iblai/mcp` dev server)

Distinct from this repo's *runtime* chat MCP server: the
[`@iblai/mcp`](https://www.npmjs.com/package/@iblai/mcp) server gives Claude Code deep
**build-time** knowledge of the ibl.ai platform. Add it to `.mcp.json` at the project
root:

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

It exposes: `get_component_info("ChatWidget")` (props, usage, examples),
`get_hook_info("useAdvancedChat")` (hook params + return types),
`get_api_query_info("useGetUserMetadataQuery")` (RTK Query endpoint details),
`get_provider_setup("auth")` (provider hierarchy + setup code), and
`create_page_template("Dashboard", "agent")` (generate a page following ibl.ai
patterns).

## The skills catalog

After `npx skills add iblai/vibe`, use these as `/` commands in your agent:

**App-building** — `/iblai-auth` (SSO auth + app config; includes the CLI install
guide), `/iblai-agent-chat` (full in-process agent chat surface), `/iblai-project`
(in-process Projects surface — landing page with chat input, files, instructions,
assigned agents), `/iblai-profile`, `/iblai-account` (account + org settings),
`/iblai-analytics`, `/iblai-notification`, `/iblai-invite` (org-admin user
invitations), `/iblai-workflow` (workflow builder — sidebar, modals, connectors),
`/iblai-local-llm` (on-device LLM inference via Ollama / Foundry in a Tauri desktop
build), `/iblai-course-access` (edX course-content pages — outline sidebar, tab strip,
iframe, access control), `/iblai-course-create` (drive the Course Creation API to
generate/edit/publish edX courses), `/iblai-onboard` (questionnaire-style onboarding
flow), `/iblai-landing` (12-section conversion-framework landing page), `/iblai-component`
(overview of all components + app-creation paths), `/iblai-rbac` (default roles, the
action-definitions endpoint, and the Roles + Policies management UI components).

**Agent-tab skills** — one per tab of the agent-management surface: `/iblai-agent-search`
(browse page), `/iblai-agent-setting`, `/iblai-agent-access`, `/iblai-agent-api`,
`/iblai-agent-dataset`, `/iblai-agent-disclaimer`, `/iblai-agent-embed`,
`/iblai-agent-history`, `/iblai-agent-llm`, `/iblai-agent-memory`, `/iblai-agent-prompt`,
`/iblai-agent-safety`, `/iblai-agent-tool`.

**Ops skills** — `/iblai-ops-build` (build + run on desktop and mobile), `/iblai-ops-test`
(validate the app before showing the user), `/iblai-ops-upgrade` (upgrade the ibl.ai
CLI, SDK, and vibe skills). *(Earlier docs list these as `/iblai-build`, `/iblai-test`,
and a `/iblai-screenshot` skill for capturing app-store screenshots for web/iOS/Android;
`/iblai-chat` was the earlier name for the chat skill.)*

**Security skills** (8, authorized-use) — `/iblai-security-recon`,
`/iblai-security-owasp-audit`, `/iblai-security-osint-recon`,
`/iblai-security-disk-forensics`, `/iblai-security-incident-triage`,
`/iblai-security-cloud-audit`, `/iblai-security-dependency-audit`,
`/iblai-security-prompt-injection` — covering reconnaissance, source-code audits (OWASP
Top 10), OSINT, disk forensics, incident triage, cloud-config auditing, dependency
vulnerabilities, and prompt-injection testing.

**Marketing skills** (companion repo) — 43 marketing skills (CRO, copywriting, SEO,
paid ads, lifecycle, growth) plus 62 platform CLIs and 80 integration guides live in
[iblai/vibe-marketing](https://github.com/iblai/vibe-marketing), installed side by side:
`npx skills add iblai/vibe-marketing`.

## The shared backend

`https://api.iblai.app` is the production backend that powers every vibe app — you
don't build, host, or maintain any backend services. It provides:

- **SSO authentication** — OAuth-based login with session management, RBAC, and
  multi-organization user isolation.
- **AI agent infrastructure** — create, configure, and serve agents with streaming
  responses, tool use, and RAG.
- **Analytics** — user activity, conversation metrics, and engagement across your app.
- **Per-organization management** — each org gets its own users, agents, branding, and
  configuration.

A free tier is available.

**Platform capabilities by target:**

| Feature | Web | macOS | Windows/Surface | iOS | Android |
| ------- | --- | ----- | --------------- | --- | ------- |
| SSO Authentication | Yes | Yes | Yes | No | No |
| AI Chat | Yes | Yes | Yes | Yes | Yes |
| User Profile | Yes | Yes | Yes | Yes | Yes |
| Account Settings | Yes | Yes | Yes | Yes | Yes |
| Analytics Dashboard | Yes | Yes | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes | Yes | Yes |

> **iOS & Android SSO limitation:** mobile WebViews use a non-standard user-agent that
> SSO providers reject. Completing the OAuth flow requires a system-browser popup
> (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android) — not yet
> implemented, so mobile users must authenticate via another method for now.

## Quick start

**Scaffold a new app** (auth, AI chat, profiles, and more in one command):

```bash
npx skills add iblai/vibe                     # install the skills first
iblai startapp agent -o iblai-init            # or: npx @iblai/cli startapp agent -o iblai-init
cp -a iblai-init/<app-name>/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. You'll be redirected to `login.iblai.app` — sign in or
create a free account, and you're back in your app with a fully authenticated session.

**CI/CD** — use `--yes` to skip the interactive prompts:

```bash
npx @iblai/cli startapp agent --yes --platform acme --agent my-id --app-name my-app -o iblai-init
cp -a iblai-init/my-app/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
cp .env.example .env.local
```

**Add features to an existing project** (run `mcp` first):

```bash
iblai add mcp            # MCP servers + skills (run first)
iblai add auth           # SSO authentication
iblai add chat           # AI chat with streaming
iblai add profile        # User profile dropdown
iblai add account        # Account/organization settings
iblai add analytics      # Analytics dashboard
iblai add notification   # Notification bell
```

**Deploy** — Vercel (recommended), Docker, or native via Tauri:

```bash
iblai deploy vercel              # or: vercel --prod
```

```bash
docker build -t my-vibe-app .
docker run -p 3000:3000 my-vibe-app
```

```bash
iblai add builds                 # add Tauri support (macOS/Windows/Linux/iOS/Android)
iblai builds build               # desktop build for current platform
iblai builds ios init            # iOS project setup
iblai builds ci-workflow --all   # GitHub Actions for all platforms
```

## Resources

- **[github.com/iblai/vibe](https://github.com/iblai/vibe)** — the repo (SDK, skills,
  and the `iblai-app-cli` scaffolder).
- **[@iblai/iblai-js](https://www.npmjs.com/package/@iblai/iblai-js)** — unified SDK
  (data, UI components, auth utilities).
- **[@iblai/iblai-api](https://www.npmjs.com/package/@iblai/iblai-api)** — auto-generated
  API types.
- **[@iblai/mcp](https://www.npmjs.com/package/@iblai/mcp)** — MCP server for
  AI-assisted development.
- **[skills.sh/iblai/vibe](https://skills.sh/iblai/vibe)** — install with
  `npx skills add iblai/vibe`.
