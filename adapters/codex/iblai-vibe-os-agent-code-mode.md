# iblai-vibe-os-agent-code-mode

> Use the ibl.ai desktop app's Code mode, or add it to your own vibe Next.js + Tauri app. A Code pill under the chat box turns the agent into a coding helper that edits files, runs commands and saves its work in a folder on your computer, asking before every change unless you say otherwise; it runs on ibl.ai, on Codex with a ChatGPT plan, or on Claude Code with a Claude plan, and a phone paired to the computer can drive it. Ships the Tauri Rust modules and the OS chat pieces. Use when the user mentions 'code mode', 'coding mode', 'Codex', 'Claude Code', 'sign in with ChatGPT', 'use my Claude subscription', 'opencode', 'let the agent edit my files', 'run commands from chat', or 'use Code from my phone'. Needs /iblai-vibe-ops-build first; for on-device models see /iblai-vibe-local-llm.

# /iblai-vibe-os-agent-code-mode

**Code** is the ibl.ai desktop app's coding helper. Turn it on under the
message box and the agent stops only answering: it edits files, runs
commands and saves its work in a folder on your computer, and it asks you
before it changes anything unless you tell it not to. It can do the work
itself, or hand it to Codex or Claude Code on your own ChatGPT or Claude
plan, and a phone paired to the computer can drive it from anywhere in the
house. The first half of this page is how to use it; the second half adds
it to an app of your own.

![The Code panel under the chat box: the on/off switch, Approvals, the Agent choice (ibl.ai, Codex, Claude Code) with its sign-in line, the Workspace folder, and Phone Access](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-5-agent-codex-signed-out.png)

> **Common setup (brand, conventions, env files, verification):** see
> [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Using Code in the ibl.ai desktop app

### 1. Turn it on

Click **Code** under the message box: its panel opens, and the switch at
the top turns Code on. The first time, Code asks **How should Code ask for
approval?**

- **Ask me each time** — every edit and every command shows up as a card
  in the reply that you allow or deny. Start here.
- **Approve automatically** — Code works without asking. The panel's own
  warning applies: *use it only in folders you trust*.

There is no default; you choose, and you can change it any time under
**Approvals** in the panel. On first use Code also asks you to choose a
folder and downloads what it needs. The pill spins for a moment while it
picks up the agent's skills.

### 2. Choose who does the work

The **Agent** row picks who runs Code. The line under it tells you what is
still missing before you can send.

| Agent | What you need | What it runs on |
|---|---|---|
| **ibl.ai** | Nothing to sign in to | Your organization's models and credits, with the app's skills. The only choice on a phone. |
| **Codex** | A ChatGPT plan, or an OpenAI API key | OpenAI's Codex, on your plan |
| **Claude Code** | A Claude plan, or an Anthropic Console account | Anthropic's Claude Code, on your plan |

What the line under the row means:

- **Not installed** / **Installing…** — the app installs Codex and Claude
  Code by itself when it starts; if that failed, **Install** tries again.
- **Not signed in** — sign in, next step.
- A grey dot with your account (or **Ready**) — good to go.
- **Not available on this computer** — Windows, or the Mac App Store
  build; see *When something's off* below.

While Code runs on Codex or Claude Code, the picker at the top left shows
that agent and its model ("Codex · GPT-6-Luna", "Claude Code · Default" in
the pictures). Change the model there. The choice is saved on this
computer only.

### 3. Sign in to Codex

Choose **Codex**. The line reads *Not signed in — sign in to Codex in the
ChatGPT app.* with a **Check Again** button:

![Agent set to Codex, the signed-out line and the Check Again button](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-5-agent-codex-signed-out.png)

1. Open the ChatGPT app and go to **Codex**. No ChatGPT app yet? Download
   it from [chatgpt.com](https://chatgpt.com/) — Codex is part of it; there
   is no separate app to install.
2. Sign in there with the account that has your plan:

   ![The ChatGPT app's Sign in to ChatGPT screen](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-6-chatgpt-app-sign-in.png)

   You are in when Codex asks *What should we build?*:

   ![Codex in the ChatGPT app, signed in: What should we build?](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-7-chatgpt-app-codex-signed-in.png)

3. Back in the ibl.ai app, click **Check Again**. The line now shows how
   you are signed in:

   ![Agent set to Codex, signed in: the line reads "Logged in using an API key"](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-8-agent-codex-signed-in.png)

Prefer a terminal? Install the Codex command-line tool with OpenAI's
one-line installer, `curl -fsSL https://chatgpt.com/codex/install.sh | sh`,
then run `codex` and pick **Sign in with ChatGPT**, **Sign in with Device
Code** or **Provide your own API key** from its menu; the ibl.ai app picks
that sign-in up on **Check Again** too.

If you send a message before signing in, a small notice says **Codex isn’t
signed in** and repeats the hint.

### 4. Sign in to Claude Code

Choose **Claude Code**. Claude Code signs in from a terminal, so the line
reads *Not signed in — run `claude` in a terminal.* with a **Check Again**
button:

![Agent set to Claude Code, the terminal hint and the Check Again button](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-9-agent-claude-signed-out.png)

1. Open a terminal and run `claude`. If the command is not found, install
   Claude Code first from [claude.ai/code](https://claude.ai/code).
2. Pick **Claude account with subscription** (or the Console account if
   you pay per use) and finish in the browser it opens:

   ![The Claude Code terminal welcome with "Select login method"](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-10-claude-terminal-login.png)

3. Back in the app, click **Check Again**. The line shows your account:

   ![Agent set to Claude Code, signed in: a grey dot and the account's email](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-11-agent-claude-signed-in.png)

If you send a message first, the notice **Claude Code isn’t signed in**
repeats the terminal hint.

### 5. Pick the workspace

The **Workspace** is the folder Code works in. The app makes one for you
under `~/.local/share/iblai/workspaces/` with a name like
`gentle-delta-fba5`; **New Workspace** makes another, **Select Workspace**
points Code at a folder of your own, and **Open in Finder** (or *Open in
…* with whatever opens folders on your computer) shows you what is in it.
Every change Code makes is saved there as a step you can go back to.

### 6. Approve what Code wants to do

With **Ask Me** on, each thing Code wants to do appears in its reply as a
card titled **Code needs your permission**, naming the action (read,
write, exec, delete, move, search, fetch) and the file or command, with
**Allow** and **Deny**. A card left alone for about three minutes counts
as Deny. On Codex, Ask Me also asks before it reaches the internet. With
**Automatic** on, no cards appear on any agent.

### 7. Code from your phone

Your phone cannot run Code by itself; it runs it on your computer, over
your home or office network.

On the computer, open the Code panel and click **Enable** next to
**Phone Access**. A QR code, an address and a password appear:

![The Code panel with Phone Access enabled: the pairing QR code, the address and the password](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-1-code-pill.png)

On the phone, open Code. Under **Your Computer**, tap **Scan QR Code**, or
type the address and password:

![Phone, not yet paired: Your Computer with Scan QR Code, or the address and password typed by hand](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-2-phone-pairing.png)

Once paired, the panel says **Connected To** your computer and shows its
workspace; pick another with **Select Workspace** or start a **New
Workspace**, then send your message as usual:

![Phone, paired: Connected To the computer, its workspace, Select / New Workspace, Disconnect](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-3-phone-connected.png)

![Phone, Code on: choosing one of the computer's workspaces](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-os-agent-code-mode/assets/iblai-vibe-os-agent-code-mode-4-phone-workspaces.png)

Good to know:

- Both devices must be on the same network. If the phone asks to find
  devices on your local network, tap **Allow**.
- The phone runs Code with the ibl.ai agent; Codex and Claude Code are
  choices on the computer.
- **Disconnect** on the phone, or **Disable** on the computer, ends it.
  Closing the desktop app ends it too, and the next **Enable** makes a
  new password.

### When something's off

| The panel says | What to do |
|---|---|
| **Not available on this computer** | Code needs a Mac or Linux build from ibl.ai; Windows and the Mac App Store build cannot run it. |
| **Code needs bubblewrap (bwrap)** | Linux only. Install it with your package manager, then reopen the app. |
| **Skills couldn’t be synced — Code will run without them** | Code still works; it just does not know the ibl.ai skills this time. Check your connection and turn Code off and on. |
| **Codex isn’t signed in** / **Claude Code isn’t signed in** | Steps 3 and 4 above. |
| *… isn’t available for Code — turns will fail* | You are on an on-device model that cannot use tools. Pick another model at the top left; see [`/iblai-vibe-local-llm`](../iblai-vibe-local-llm/SKILL.md). |
| **Your computer isn't reachable** | The desktop app is closed, Phone Access is off, or the two devices are on different networks. |

## Adding Code to your own app

> **The Agent row (Codex, Claude Code) ships with the OS app.** The copies
> below are the OS app's own implementation of Code on the ibl.ai agent:
> the Rust modules in [`assets/tauri/src-tauri/`](assets/tauri/src-tauri/)
> (copy into your `src-tauri/`, same layout as `/iblai-vibe-ops-build`'s
> templates, no `.j2` to render) and the chat pieces in
> [`assets/nextjs/`](assets/nextjs/). Codex and Claude Code land here once
> that OS work merges. The mechanics, every command and event, and the
> wiring are in [`references/`](references/).

How it works, in one paragraph: with the Code pill on, a chat turn no
longer goes to the hosted agent. The Tauri backend spawns
[opencode](https://github.com/sst/opencode) as a per-chat subprocess,
drives it over the Agent Client Protocol, and points its model calls at
ibl.ai's OpenAI-compatible API through a loopback proxy that injects the
user's token. The agent edits files, runs shell commands and commits in a
git-backed workspace; every operation it wants surfaces as a permission
card the user answers. A mobile build cannot spawn binaries, so a phone
pairs to a desktop over the LAN and runs the same turns against it.

### Prerequisites

1. **Tauri shell** via [`/iblai-vibe-ops-build`](../../ship/iblai-vibe-ops-build/SKILL.md)
   — `src-tauri/` with the template `lib.rs`, plus the Rust toolchain.
2. **Sign-in** via [`/iblai-vibe-auth`](../../start/iblai-vibe-auth/SKILL.md)
   — Code reads the org key and DM token from the SDK's auth storage.
3. **Platform**: macOS or Linux desktop for the agent itself (Linux also
   needs `bwrap`/bubblewrap on PATH for the sandbox); iOS/Android only
   as a *paired* client. **Windows is not supported** — `install_opencode`
   returns an error and the pill hides. A **Mac App Store** build hides it
   too: under the App Sandbox (`APP_SANDBOX_CONTAINER_ID` set) the app
   can't spawn the downloaded binary, so ship Code in the Developer ID /
   notarized `.dmg` build from `/iblai-vibe-ops-build`, not the MAS one.
4. **Your own chat surface.** The SDK's `<Chat>` transport already routes
   Code turns, but `<Chat>` has no composer slot and does not render
   reasoning, tool calls, or permission cards — the OS app owns those
   pieces (shipped here). If your app mounts the SDK `<Chat>` unchanged,
   you get streaming Code replies but no way to answer permission prompts:
   every manual-mode operation times out as denied after 180 s. Either
   host the shipped components in your own composer/message bubble, or
   consciously choose `auto` approvals (see Security).
5. Ask the user for a real agent UUID for testing. Do NOT invent one.

### Step 1: Rust — drop in the modules

```bash
cp -R <skill>/assets/tauri/src-tauri/src/*            src-tauri/src/
cp    <skill>/assets/tauri/src-tauri/permissions/code-mode.toml   src-tauri/permissions/
cp    <skill>/assets/tauri/src-tauri/capabilities/mobile-pairing.json src-tauri/capabilities/
```

| File | What it is |
|---|---|
| `opencode_acp.rs` | The ACP transport: one `opencode acp` child per chat, sandboxing (macOS `sandbox-exec`, Linux `bwrap`), permission cards, workspaces, per-agent skills dir, session reuse and reaping |
| `opencode_proxy.rs` | Loopback token-injecting proxy the agent's model calls go through; mints the scoped `IBLAI_API_KEY`; composes `AGENTS.md` guidance |
| `opencode_installer.rs` | Downloads the pinned opencode release (`OPENCODE_VERSION`), writes `opencode.json`, syncs the latest `iblai/vibe` release into the agent's skills |
| `opencode_build_prompt.txt` | System-prompt line compiled in via `include_str!` — keep the name |
| `remote_code.rs` | Desktop phone-access host: `opencode serve` + pairing QR |
| `remote_code_client.rs` | Mobile: the same `opencode_*` commands proxied to a paired desktop over HTTP + SSE |
| `permissions/code-mode.toml` | One `allow-*` per command, grouped as the `code-mode` set |
| `capabilities/mobile-pairing.json` | Camera permissions for scanning the pairing QR (iOS/Android only) |

Then wire them — module declarations with their `cfg` gates, the
`emit_on_main` helper, `log_fe`, plugins, setup hooks, the two
`generate_handler!` lists, and the exit hook — exactly as in
[`references/lib-rs-wiring.md`](references/lib-rs-wiring.md). Add the
Cargo entries from [`references/cargo-deps.toml`](references/cargo-deps.toml)
and reference the `code-mode` set from `capabilities/default.json` per
[`references/capabilities.md`](references/capabilities.md).

**On-device models:** `opencode_acp.rs` can run Code against a local
Ollama/Foundry model and reaches into the local-LLM modules for that. If you
have not implemented [`/iblai-vibe-local-llm`](../iblai-vibe-local-llm/SKILL.md),
add the two small stubs in the wiring reference (§4) — cloud Code never
touches them.

```bash
cd src-tauri && cargo check          # must compile before touching the frontend
```

### Step 2: Frontend — the transport is already in the SDK

`useChatV2` (in `@iblai/web-utils`, used by the SDK `<Chat>` and by the OS
chat) routes a turn to `opencode_chat_stream` whenever **both** hold:

- `isTauriCodeHost()` — a Tauri desktop, or a Tauri mobile app with
  `localStorage.ibl_remote_code_ready === "true"` (set by pairing);
- `localStorage.ibl_coding_mode_enabled === "true"`.

It reads `ibl_coding_mode_model` (`provider/model`, default `openai/gpt-4o`)
and `ibl_coding_mode_mentor` (the active agent UUID, for that agent's synced
skills), calls the command with the DM token, and listens on `ollama:token`
/ `ollama:done` / `ollama:error` / `ollama:restart` plus `opencode:reasoning`
/ `opencode:tool_call`, populating `reasoningContent` and `toolCalls` on the
streaming message. Stop → `opencode_stop`; chat closed → `opencode_close`.
Nothing per-surface to wire for the transport.

### Step 3: Frontend — host the OS chat pieces

Copy [`assets/nextjs/`](assets/nextjs/) into your app and adapt the `@/…`
imports. These are the OS app's components (paths in the OS repo shown),
not SDK exports:

| Asset | OS path | Role |
|---|---|---|
| `components/chat-input-form/coding-mode-button.tsx` | `components/chat-input-form/coding-mode-button.tsx` | The **Code** pill + popover: enable toggle, first-run **Approvals** dialog (Ask Me / Automatic), workspace picker (Select / New / open folder), install + vibe-skills status, desktop **phone access** (QR), mobile **pairing** (scan / manual, Your Computer card, Disconnect). Writes the `ibl_coding_mode_*` flags and mirrors `permission_mode` to platform user-metadata under `code_mode` |
| `components/chat/code-permission-card.tsx` | `components/chat/code-permission-card.tsx` | `<CodePermissionCards>` — listens on `opencode:permission_request` / `opencode:permission_resolved`, renders Allow / Deny inside the reply bubble, answers with `opencode_permission_respond`. **This is the security boundary** |
| `components/chat/tool-call-indicator.tsx`, `tool-call-item.tsx`, `tool-call-utils.ts` | `components/chat/…` | Collapsible tool-activity list for the `toolCalls` the transport fills (`TOOL_NAME_MAP` / `ToolCallInfo` from `@iblai/web-utils`) |
| `components/chat/reasoning-section.tsx` | `components/chat/reasoning-section.tsx` | Collapsible "thinking" panel for `reasoningContent` |
| `hooks/use-opencode-skill-sync.ts` | `hooks/use-opencode-skill-sync.ts` | Fetches the active agent's Agent Skills + resources (`useLazyGetAgentSkillsQuery`, `useLazyGetMentorSkillAssignmentsQuery`, `useLazyGetAgentSkillResourcesQuery` from `@iblai/data-layer`) and materialises them on disk via `begin_opencode_skills_sync` + `set_opencode_skills`, with bounded retries |
| `hooks/use-opencode-learner.ts` | `hooks/use-opencode-learner.ts` | On sign-in calls `set_opencode_learner` (who the agent acts as, DM base, platform domain, auth URL) and pre-warms `ensure_opencode_platform_key` |
| `messages/code-mode.en.json` | `messages/en.json` (`chatInputFormCodingModeButton`, `chatCodePermissionCard`) | The `next-intl` strings the button and cards use |

**Adapt these imports** (everything else is shadcn primitives + SDK):

| In the asset | In a vibe-starter app |
|---|---|
| `@/lib/config` → `config.dmUrl()`, `getEnv('NEXT_PUBLIC_AUTH_URL')` | `@/lib/iblai/config` — same `config.dmUrl()`, `config.authUrl()`, `config.platformBaseDomain()`, `getEnv` |
| `@/types/tauri` → `isTauriApp`, `isTauriMobile` | drop [`/iblai-vibe-local-llm`'s `types/tauri.ts`](../iblai-vibe-local-llm/assets/nextjs/types/tauri.ts) in, or copy the two probes (`__TAURI__` on `window`; `platform()` from `@tauri-apps/plugin-os` ∈ ios/android) |
| `@/hooks/use-mentors/use-mentor-settings` → `llmProvider`, `llmName` | `useGetMentorSettingsQuery` from `@iblai/data-layer` (used only to pre-select the agent's model) |
| `@/hooks/use-tauri-offline` → `isTauriOfflineMode()` | `() => localStorage.getItem('ibl_local_llm_enabled') === 'true'` if you have local models, else `() => false` |
| `@/lib/utils` → `getUserOS()` | `platform()` from `@tauri-apps/plugin-os` |
| `@/hooks/use-user`, `@/features/utils` → `useUsername`, `getUserEmail` | read `userData` from localStorage (`user_nicename`, `user_email`) |
| `@/components/markdown` | your Markdown renderer (the SDK `Chat` uses `react-markdown`) |
| `@/components/ui/{popover,switch,tooltip,alert-dialog,collapsible}` | `npx shadcn@latest add popover switch tooltip alert-dialog collapsible` |
| `next-intl` `useTranslations('…')` | `pnpm add next-intl` and load `messages/code-mode.en.json`, or inline the strings |

Mount them: `<CodingModeButton sessionId={…} skillSync={useOpencodeSkillSync({ org, mentorUniqueId })} />`
in your composer's button row (the OS gates it to Tauri after mount, never
during hydration), `<CodePermissionCards generationId={…} />` +
`<ReasoningSection>` + `<ToolCallIndicator>` inside the assistant bubble,
and `useOpencodeLearner()` once near the app root. Frontend deps:

```bash
pnpm add @tauri-apps/plugin-os @tauri-apps/plugin-dialog @tauri-apps/plugin-opener
pnpm add @tauri-apps/plugin-barcode-scanner   # mobile builds only
```

### Step 4: Use MCP tools for the SDK side

```
get_hook_info("useChatV2")
get_component_info("Chat")
get_api_query_info("useGetAgentSkillsQuery")
```

## Linked SDK exports

From `@iblai/iblai-js/web-utils` (the transport lives here):

- `useChatV2` — routes turns to Code when the flags are set; fills
  `reasoningContent` / `toolCalls` on the streaming message.
- `isTauriDesktop()`, `isTauriEmbeddedLLMHost()` — the public platform
  predicates (the streaming internals of `opencode-client.ts` are
  deliberately private; `isTauriCodeHost` is used by `useChatV2`).
- `TOOL_NAME_MAP`, `ToolCallInfo` — what the tool-call components render.

From `@iblai/iblai-js/data-layer`:

- `useLazyGetAgentSkillsQuery`, `useLazyGetMentorSkillAssignmentsQuery`,
  `useLazyGetAgentSkillResourcesQuery` — the skills sync source
  ([`/iblai-vibe-agent-skills`](../iblai-vibe-agent-skills/SKILL.md)).
- `useGetUserPlatformMetadataQuery`, `useUpdateUserPlatformMetadataMutation`
  — the `code_mode.permission_mode` preference that follows the user
  ([`/iblai-vibe-user-metadata`](../../users/iblai-vibe-user-metadata/SKILL.md)).
- `useGetMentorSettingsQuery` — the agent's LLM provider/model, pre-selected
  as the Code model.

## Security (read before shipping)

- **Permission cards are the boundary.** The agent runs at the user's own
  privilege; the sandbox only hides secrets and confines writes. Rust pins
  `permission: "ask"` into the config on every spawn — it cannot be
  loosened on disk. Render the cards.
- **No default approval mode.** `get_opencode_permission_mode()` is
  `null` until the user chooses; the button raises the first-run dialog.
  Never pick `auto` for them.
- **The DM token never reaches the agent** — the loopback proxy injects
  it. The one credential handed over is a scoped, week-long, revocable
  platform API key (`IBLAI_API_KEY`), so the synced `iblai-*` skills can act
  on the platform; non-admins get none and turns continue.
- **Phone access** binds `0.0.0.0` with a fresh password per enable and is
  killed with the app. Show the QR only to the person at the desk.

Full rationale, on-disk layout, and the agent's environment:
[`references/architecture.md`](references/architecture.md).

## Verify

1. `cd src-tauri && cargo check` — zero errors.
2. `pnpm build` — zero errors; `pnpm test` passes.
3. `pnpm exec tauri dev` (desktop): open a chat, click **Code** — first
   click installs opencode (log lines on `model:installation-log`) and
   asks for an approval mode; ask the agent to *"create hello.txt with one
   line"*; a **permission card** appears in the reply; Allow; the file
   exists under `~/.local/share/iblai/workspaces/…`.
4. `pnpm exec tauri ios dev "<device>"` after **phone access** is on
   the desktop: scan the QR, send the same prompt, see the same card.
5. Screenshot the composer with the pill on:
   ```bash
   npx playwright screenshot http://localhost:3000/ /tmp/code-mode.png
   ```

## Platform data

| Call | Purpose |
|---|---|
| `POST {asgi}/api/ai-mentor/orgs/{org}/v1/chat/completions` | the agent's model calls, via the loopback proxy with the DM token injected |
| `GET {dm}/api/ai-mentor/orgs/{org}/v1/models` | the Code model picker |
| `GET …/orgs/{org}/agent-skills/`, `…/agents/{uuid}/skills/`, `…/agent-skill-resources/` | the agent's skills synced to disk — [`/iblai-api-agent-skill`](../iblai-api-agent-skill/SKILL.md) |
| `POST {dm}/api/core/platform/api-tokens/` (by `platform_api_key`) | the scoped `IBLAI_API_KEY` — [`/iblai-api-token`](../../organizations/iblai-api-token/SKILL.md) |
| `GET/POST {dm}/api/core/users/platform-metadata/` (`code_mode.permission_mode`) | approval mode following the user — [`/iblai-api-profile-metadata`](../../users/iblai-api-profile-metadata/SKILL.md) |
| `https://github.com/iblai/vibe/releases/latest` | the vibe skills the agent gets, resolved at every launch |

## Related skills

- [`/iblai-vibe-ops-build`](../../ship/iblai-vibe-ops-build/SKILL.md) — the Tauri shell this drops into.
- [`/iblai-vibe-local-llm`](../iblai-vibe-local-llm/SKILL.md) — on-device models Code can run against; also the `types/tauri.ts` probes.
- [`/iblai-vibe-agent-chat`](../iblai-vibe-agent-chat/SKILL.md) — the SDK chat surface whose transport carries Code turns.
- [`/iblai-vibe-agent-skills`](../iblai-vibe-agent-skills/SKILL.md) — the Agent Skills the sync hook materialises for the agent.
- [`/iblai-vibe-agent-sandbox`](../iblai-vibe-agent-sandbox/SKILL.md) — the *platform-side* sandbox kinds (Computing Runtime / VM Shell / Claw); Code mode is the *desktop-side* runtime and is independent of them.