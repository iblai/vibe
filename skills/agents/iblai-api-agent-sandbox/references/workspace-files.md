# iblai-api-agent-sandbox — workspace files & config

Doc-sourced explanatory material complementing the verified endpoints in
**`/iblai-api-agent-sandbox`**. This is the field reference behind
`PATCH …/mentors/{mentor}/agent-config/` (see the skill's **Writes**); it details how each
`agent-config` field maps to a file in the claw workspace, what the `config` patch holds,
and which config paths are blocked.

> Source: the platform-integration guide from [github.com/iblai/iblai-claw-setup](https://github.com/iblai/iblai-claw-setup).

## The workspace-file model

Agent configuration defines the **workspace files and settings pushed to the claw
instance**. Each text field on `agent-config` maps to a markdown file in the agent's
workspace; the file is written on the instance when you push config.

| Field | Pushed as | Description |
|---|---|---|
| `identity` | `IDENTITY.md` | Agent persona — name, visual description, vibe. |
| `soul` | `SOUL.md` | Behavioral guidelines — personality, values, boundaries. |
| `user_context` | `USER.md` | User-specific environment details. |
| `tools` | `TOOLS.md` | Environment-specific reference notes for tool usage. |
| `agents` | `AGENTS.md` | Multi-agent routing configuration. |
| `bootstrap` | `BOOTSTRAP.md` | One-time first-run instructions (**consumed after use**). |
| `heartbeat` | `HEARTBEAT.md` | Periodic awareness-checklist content. |
| `memory` | `MEMORY.md` | Seed memory — long-term curated facts. |
| `model` | `config.patch` | LLM model identifier. |
| `config` | `config.patch` | Instance settings (heartbeat schedule, session isolation, skill toggles). |

- All **text** fields are **optional** and default to the empty string.
- `config` is JSON and defaults to `{}`.
- `model` sets the LLM; pair it with `allowed_models` (a string array) to restrict the
  selectable set.

## The `config` instance patch

`config` is a JSON patch applied to the instance's own settings (not a workspace file body).
It typically carries the **heartbeat schedule**, **session isolation**, **skill toggles**,
and **model fallbacks** — for example:

```json
{ "heartbeat": { "every": "30m" }, "session": { "dmScope": "per-channel-peer" } }
```

Applying a `config` patch causes **the gateway to restart itself**.

## Blocked config paths (deny-list)

Writes to the following `config` paths are **rejected**. They govern the instance's
security boundaries, so the platform refuses to let a pushed patch weaken them — a config
push can tune behavior, never disable device auth, escape the sandbox, or open host command
execution:

| Blocked path | What it controls (why it's protected) |
|---|---|
| `gateway.auth` | Gateway authentication. |
| `gateway.controlUi.dangerouslyDisableDeviceAuth` | Bypass of control-UI device auth. |
| `tools.exec.host` | Host (non-sandboxed) command execution. |
| `sandbox.mode` | Sandbox enforcement mode. |
| `hooks.allowUnsafeExternalContent` | Acceptance of unsafe external content in hooks. |

A patch that touches any of these is rejected on write; keep them out of the `config`
object entirely.
