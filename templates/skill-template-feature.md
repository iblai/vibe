---
name: iblai-vibe-<feature>
description: <What the user gets, in one sentence.> Use when the user mentions '<trigger one>', '<trigger two>', or wants <the outcome>. For <sibling need> see /iblai-vibe-<sibling>; for the REST contract see /iblai-api-<family>. (200–1024 characters; triggers and siblings are what the router reads.)
globs:
alwaysApply: false
---

# /iblai-vibe-<feature>

<Two or three sentences: what this adds to the app and for whom (member / admin / builder).>

![<What the screenshot shows>](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-vibe-<feature>/iblai-vibe-<feature>-1-<slug>.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## What you get

- <Component or hook, one line>
- <File this skill creates, one line>
- <What vibe-starter already ships, if anything>

## When to use / when not

| Use it for | Not for |
|---|---|
| <need> | <the sibling skill that covers the other need> |

## Prerequisites

- Auth in place (`/iblai-vibe-auth`, or vibe-starter).
- <A real agent UUID — ask, never invent.> / <An admin account.> / <A server env var.>

## Step 1: <Verb the thing>

<Numbered, concrete steps. Each step ends with the file it produced or the command it ran.>

## Step 2: <Verb the next thing>

```tsx
// app/(app)/<route>/page.tsx — compiles as written against the pinned SDK
```

## Verify

1. `pnpm build` and `pnpm test` pass.
2. `pnpm dev`, sign in, open `/<route>`: <what must be visible>.
3. `npx playwright screenshot http://localhost:3000/<route> /tmp/<feature>.png` — the screenshot shows <…>.

## Customize

```
get_component_info("<Component>")
```

| Prop | Type | Description |
|---|---|---|
| <≤ 20 rows; the rest in references/props.md> | | |

## Platform data

| Hook / call | Purpose |
|---|---|
| `use<…>Query` | <…> |
| `POST …/dm/api/<…>/` (REST only) | <…> |

REST reference: [<family>](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-api-<family>/SKILL.md).

## Related skills

- `/iblai-vibe-<sibling>` — <why>

<!-- Budget: ≤ 400 lines (★ core families ≤ 500). Move long tables, troubleshooting, and brownfield notes to references/. Keep every code fence compilable — the render gate typechecks it. -->
