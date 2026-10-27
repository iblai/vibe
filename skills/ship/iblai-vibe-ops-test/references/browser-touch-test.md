# The browser for the touch test

`/iblai-vibe-ops-test` drives the running app through the agent's browser
tools. Two tools qualify; the skill picks whichever the session has.

## Claude in Chrome (`claude --chrome`)

Claude Code's own integration: the built-in `claude-in-chrome` MCP server
drives the user's signed-in Chrome in a visible window.

- Turn it on per session with `claude --chrome`, or once under `/chrome` →
  "Enabled by default". Needs the Claude in Chrome extension (1.0.36 or later),
  a claude.ai sign-in (`/login` — an API key turns it off), Chrome or Edge; not
  on WSL. A project cannot turn it on: a value in `.claude/settings.json` is
  ignored.
- It pauses on sign-in pages and CAPTCHAs for the user, and a JavaScript dialog
  blocks it until the user dismisses it.
- Tool names: `/mcp` → `claude-in-chrome` → View tools. The documented ones are
  `tabs_context_mcp` (with `createIfEmpty`), `browser_batch` and a screenshot
  tool with `save_to_disk`; map the rest from their names, never from memory.

## Chrome DevTools MCP

Google's [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp):
one `.mcp.json` entry, any MCP client, its own Chrome with a persistent profile
(the user signs in once per machine). A second entry, `chrome-devtools-main`,
attaches to the user's own Chrome instead (below).

### Your own Chrome

`chrome-devtools-main` runs the same server with `--autoConnect`: on Chrome 144 or
newer it attaches to the running Chrome's default profile, signed in as the user
is, so a touch test needs no second sign-in.
The user enables it once on `chrome://inspect/#remote-debugging` and clicks
Allow when Chrome asks; until then every call answers "Could not connect to
Chrome" (measured with chrome-devtools-mcp 1.12.0: it never launches its own
window in this mode), and the agent falls back to `chrome-devtools`. Older
Chrome: use `chrome-devtools` and sign in once in its window.

Claude Code — `.mcp.json` at the project root (vibe-starter and the scaffold
ship it; Claude Code asks once to approve a project server):

```json
{
  "mcpServers": {
    "chrome-devtools": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest"] },
    "chrome-devtools-main": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest", "--autoConnect"] }
  }
}
```

For every project instead: `claude mcp add --scope user chrome-devtools -- npx -y chrome-devtools-mcp@latest`.
The first `npx` start can exceed the MCP startup timeout — `MCP_TIMEOUT=60000 claude`.
To skip the per-call prompts the user may add `"mcp__chrome-devtools__*"` to
`permissions.allow` in `.claude/settings.json` — their choice, not the skill's,
since it also pre-approves `evaluate_script`.

Codex — `~/.codex/config.toml`:

```toml
[mcp_servers.chrome-devtools]
command = "npx"
args = ["-y", "chrome-devtools-mcp@latest"]
```

Cursor — `.cursor/mcp.json`, the same shape as `.mcp.json`. Restart the agent
after adding a server.

Flags (`npx -y chrome-devtools-mcp@latest --help`): `--headless` (no window —
only routes that need no sign-in can be touched), `--isolated` (a throwaway
profile, so the sign-in is lost), `--autoConnect` (the user's running Chrome,
see above), `--browserUrl http://127.0.0.1:9222` (attach to a Chrome started
with `--remote-debugging-port=9222` and its own `--user-data-dir` — the
sandbox and CI option, never the main profile), `--channel`, `--executablePath`.

### The tools, step by step

| Step | Chrome DevTools MCP | Claude in Chrome |
|---|---|---|
| Find the tab | `list_pages`, `select_page`, `new_page` | `tabs_context_mcp` |
| Open the route | `navigate_page` | the navigate tool |
| Read the page | `take_snapshot` (a11y tree with uids) | the read-page / find tool |
| Act | `click`, `fill`, `fill_form`, `press_key`, `type_text`, `hover`, `upload_file`, `handle_dialog` | the click / type / form tools |
| Wait | `wait_for` (text) | — |
| Console, network | `list_console_messages`, `list_network_requests`, `get_network_request` | the console / network tools |
| Phone width | `emulate` viewport `412x915x2,mobile,touch`; `""` clears | resize the window |
| Run JS | `evaluate_script` | the JavaScript tool |
| Evidence | `take_screenshot` | the screenshot tool |

### Headless and CI

```bash
claude -p "Run the /iblai-vibe-ops-test touch test on /" \
  --mcp-config '{"mcpServers":{"chrome-devtools":{"command":"npx","args":["-y","chrome-devtools-mcp@latest","--headless"]}}}' \
  --strict-mcp-config --allowedTools "mcp__chrome-devtools__*" --permission-mode dontAsk
```

runs the touch test without a window; only routes that need no sign-in are
reachable there. The Playwright suite (`pnpm test:e2e`) stays the CI test.

## What to look for

- Broken layouts — overlapping elements, overflow, collapsed (0 px) sections
- Missing content — blank cards, stuck `Loading…`, placeholder text; an empty
  SDK Management panel usually means `enableRbac` without `rbacPermissions`
- Style — wrong brand color (primary `#0058cc`), the system font instead of
  Open Sans, unstyled raw HTML, invisible text
- Responsive — horizontal scrollbar, content cut off at 412 px
- SDK components — rendering outside their white card wrapper, missing
  borders or rounding
- Navigation — navbar absent, active tab not highlighted
- Console — React errors (`Minified React error`, `Hydration failed`), 401 or
  403 on the platform API

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No page found" after a DevTools call | Its Chrome restarted: `list_pages`, then navigate again |
| "browser is already running" | Another session holds the profile: close it, or `--isolated` (forgets the sign-in) |
| Sign-in never comes back to the app | The origin (port included) is not in the organization's allowed redirect origins |
| A snapshot is cut off | Snapshot the route, not the whole app; `MAX_MCP_OUTPUT_TOKENS` raises the cap |
| `resize_page` stays near 850 px | Use `emulate` for a phone |
| The chat composer ignores `fill` | Click the box and `type_text`; Enter does not send — click `Send message`; the reply is done when its `Copy to Clipboard` appears |
| Claude in Chrome "not available" | Only the user can turn it on: `claude --chrome`, or `/chrome` |
