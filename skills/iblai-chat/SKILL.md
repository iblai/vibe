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

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.
- A mentor/agent ID from your ibl.ai platform (get one at https://iblai.app)

## Add Chat

```bash
# If iblai is installed globally
iblai add chat

# Or via npx (when published)
npx @iblai/cli add chat
```

```bash
pnpm install
```

## Configure

Add your agent ID to `.env.local`:

```bash
NEXT_PUBLIC_DEFAULT_AGENT_ID=your-agent-id
```

Or use the CLI:

```bash
iblai config set NEXT_PUBLIC_DEFAULT_AGENT_ID your-agent-id
```

## What Was Generated

| File | Purpose |
|------|---------|
| `components/iblai/chat-widget.tsx` | `<mentor-ai>` web component wrapper with auth token delivery |

The ChatWidget reads `axd_token`, `tenant`, and `userData` from localStorage
and passes them to the MentorAI iframe via `authrelyonhost` mode.

## Usage

```tsx
import { ChatWidget } from "@/components/iblai/chat-widget";

// Basic
<ChatWidget mentorId="your-mentor-id" />

// Custom dimensions
<ChatWidget mentorId="..." width={900} height={700} />

// Dark theme
<ChatWidget mentorId="..." theme="dark" />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mentorId` | `string` | (required) | Mentor unique ID |
| `tenantKey` | `string` | from localStorage | Override tenant key |
| `theme` | `"light" \| "dark"` | `"light"` | Color theme |
| `width` | `number \| string` | `720` | Widget width |
| `height` | `number \| string` | `600` | Widget height |

## Verify

```bash
pnpm dev
```

Log in, then verify the chat widget connects and streams responses.

## Detailed Guide

For the complete implementation reference:
https://github.com/iblai/iblai-app-cli/blob/main/skills/components/iblai-add-chat.md
