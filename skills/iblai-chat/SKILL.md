---
name: iblai-chat
description: Add AI chat widget to your Next.js app
globs:
alwaysApply: false
---

# /iblai-chat

Add an AI chat widget powered by ibl.ai mentors. Uses the `<mentor-ai>` web
component with streaming, session management, and authentication handled
automatically.

![Chat Page](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-chat/chat-page.png)


Before running `iblai add chat`, you MUST ask the user for
their **agent/mentor ID** (a UUID like `3f8a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c`).
This is required for the chat widget to connect to an AI agent.

If the user does not have an agent ID, direct them to https://mentorai.iblai.app
to create an AI agent. They can find the agent ID in the agent settings page.

Once you have the ID, set it in `.env.local`:
```
NEXT_PUBLIC_DEFAULT_AGENT_ID=<the-uuid-they-gave-you>
```

Do NOT add custom styles, colors, or CSS overrides to the ChatWidget.
It ships with its own styling. Keep the component as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around the chat widget, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.
- An agent/mentor ID from the user's ibl.ai platform (a UUID -- get one at https://mentorai.iblai.app)

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is
up to date. Run `iblai --version` to check the current version, then
upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Check Environment

Before proceeding, check for a `iblai.env`
in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
If the file does not exist or is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Get Agent ID from User

Ask the user for their agent/mentor ID. This is a UUID that identifies the AI
agent the chat widget will connect to.

Once the user provides their agent ID, write it directly
to `.env.local` using the Edit tool — do NOT echo it back in shell commands.
Add or update this line in `.env.local`:
```
NEXT_PUBLIC_DEFAULT_AGENT_ID=<the-uuid>
```

## Step 3: Run the Generator

```bash
iblai add chat
```

The generator creates the chat widget component and patches the Redux store
to include chat-specific reducers.

## What Was Generated

| File | Purpose |
|------|---------|
| `components/iblai/chat-widget.tsx` | `<mentor-ai>` web component wrapper with auth token delivery |

The ChatWidget reads `axd_token`, `tenant`, and `userData` from localStorage
and passes them to the MentorAI iframe via `authrelyonhost` mode.

## Step 4: Use the Widget

```tsx
import { ChatWidget } from "@/components/iblai/chat-widget";

// Full viewport (recommended)
<ChatWidget mentorId={process.env.NEXT_PUBLIC_DEFAULT_AGENT_ID!} width="100vw" height="100vh" />

// Custom viewport-relative dimensions
<ChatWidget mentorId="..." width="80vw" height="90vh" />

// Or hardcode an agent ID (useful for multi-agent pages)
<ChatWidget mentorId="3f8a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c" width="100vw" height="100vh" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mentorId` | `string` | (required) | Agent/mentor UUID -- ask the user for this |
| `tenantKey` | `string` | from `.env` | Override platform key (defaults to `NEXT_PUBLIC_MAIN_TENANT_KEY`) |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme |
| `width` | `number \| string` | `720` | Widget width -- use `vh`/`vw` strings (e.g., `"100vw"`) |
| `height` | `number \| string` | `600` | Widget height -- use `vh`/`vw` strings (e.g., `"100vh"`) |

## Step 5: Verify

Run `/iblai-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000 /tmp/home.png
   ```

## Detailed Guide

For the complete implementation reference:
https://raw.githubusercontent.com/iblai/iblai-app-cli/refs/heads/main/skills/components/iblai-add-chat.md

**Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
