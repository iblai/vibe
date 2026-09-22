---
name: iblai-vibe-connect
description: "Connect a project to an ibl.ai organization — opens the browser, the user picks an org and clicks Connect, and the org key + a freshly minted Platform API Token are written into the project's env files without the token ever passing through the chat. Use when a project needs ibl.ai credentials: at the start of a build, when a deploy or API call fails for lack of a token, or when the user says 'connect my ibl.ai org / platform'. Called first by /iblai-vibe-start, /iblai-vibe-ops-init and /iblai-api-login, replacing the manual 'paste your PLATFORM and TOKEN' step."
globs:
alwaysApply: false
user-invocable: true
---

# /iblai-vibe-connect

Get the project's ibl.ai credentials (organization key + API token) via a
one-click browser flow instead of asking the user to copy a secret by hand.

## When to use

- Before building, whenever `iblai.env` lacks real `PLATFORM` and `TOKEN` values.
- When a deploy or an ibl.ai API call fails because no token is configured.
- When the user asks to "connect" / "link" their ibl.ai organization.

If `iblai.env` already has real `PLATFORM` and `TOKEN`, skip this — the project
is already connected.

## Run it

From the project root:

```bash
node <this-skill-dir>/scripts/connect.mjs --name "<project> on <hostname>"
```

- The script opens the user's browser to the auth app's `/connect` page, waits
  on a loopback port, and on success writes `iblai.env`, `.env`, and (for a
  Next.js app) `.env.local`, gitignoring all three. It prints one line like
  `connected: <org> (<key>) as <user> · token ****ab12`.
- **Never print or echo the token.** It goes browser → script → files, never
  through the chat.
- Tell the user to switch to their browser and click **Connect** — the run
  blocks until they do (5-minute timeout).

Options: `--org <key>` preselects an org; `--origin <url>` allow-lists the
app's local origin; `--dir <path>` writes elsewhere than the cwd. The flow
always uses `https://login.iblai.app`.

## Fallbacks

- **No browser** (SSH / container / remote agent): run the auth app's `/connect`
  with no callback in any browser, then pipe the shown block into
  `node .../connect.mjs --paste` (it writes the same files without echoing the
  token).
- **Hosted page not deployed yet:** the script exits with code `3` and prints
  `HOSTED_PAGE_UNAVAILABLE`. On that, fall back to asking the user for their
  ibl.ai `PLATFORM` (tenant key) and `TOKEN` (platform API key) and write them
  to `iblai.env` / `.env.local` yourself — the pre-connect-flow behavior. Do not
  echo the token back.
