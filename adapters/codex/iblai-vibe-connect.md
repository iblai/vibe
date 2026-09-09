# iblai-vibe-connect

> Connect an ibl.ai organization in one browser round trip — opens login.iblai.app/connect, the user picks their organization and clicks Connect, and the script writes the organization key, username, and a freshly minted Platform API Token into iblai.env, .env, and .env.local without the token ever passing through the conversation. Use whenever credentials are missing or wrong — no iblai.env, a placeholder PLATFORM or TOKEN, a 401 from the platform API, or the user says "connect my organization", "connect ibl.ai", "log me in", "set up my API key". Run it before /iblai-vibe-ops-init and /iblai-api-login, which fall back to their manual questions when the hosted page is not available.

# /iblai-vibe-connect

One link replaces the whole credential errand: the user signs in on
`login.iblai.app`, picks an organization, clicks **Connect**, and a Platform API
Token is minted and written into this project's env files. Nothing is typed
into the chat, and the token is never printed.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## When to use

Any time credentials are missing or unusable:

| Situation | What to do |
|---|---|
| No `iblai.env`, or it has no `PLATFORM` / `TOKEN` | Run this skill |
| `PLATFORM=your-platform` / `TOKEN=your-api-token` (placeholders), or `PLATFORM=main` | Run this skill |
| The platform API answers `401` | Run this skill — the token was revoked or expired |
| `iblai.env` already has real values, or the host exports `IBLAI_API_KEY` | Skip it; those already answer the question |

## Step 1: Run the script

The script lives next to this file, in whichever skills directory this skill was
installed into. Look for `iblai-vibe-connect/scripts/connect.mjs` under, in
order: `.claude/skills/start/`, `.agents/skills/start/`, or the installed
plugin's own skills directory (`~/.claude/plugins/*/skills/start/`). From the
project root:

```bash
SKILLS_DIR=$(dirname "$(find .claude/skills .agents/skills ~/.claude/plugins \
  -name connect.mjs -path '*iblai-vibe-connect*' 2>/dev/null | head -1)")
node "$SKILLS_DIR/connect.mjs"
```

Run it **from the project root** — it writes into the current working directory.

What the script does: starts a loopback listener on `127.0.0.1` with a random
free port and a five-minute timeout, generates a `state` value, and opens

```
https://login.iblai.app/connect?callback=http://127.0.0.1:<port>/callback&state=…&name=…
```

in the default browser. It also prints that URL, so a user on SSH or in a
container can paste it into a browser on their own machine.

What the user sees: the ibl.ai sign-in page (with **join** offered if they have
no account yet — signing up creates the account and their organization), then a
list of the organizations they belong to, then a **Connect** button. `main` is
listed but not selectable — it is the shared organization; they create their own
first.

Options, all optional:

| Flag | Default |
|---|---|
| `--domain <host>` | `iblai.app` |
| `--name <label>` | `<package.json name or folder name> on <hostname>` — the name the token gets, so it can be recognized and revoked later |
| `--origin <url>` | `http://localhost:3000` when a `package.json` with `next` is present — the hosted page adds it to the organization's allowed redirect origins, which is the step new apps most often miss |
| `--org <key>` | preselects an organization when you already know the key |
| `--dry-run` | prints the file changes it would make, token masked, and writes nothing |
| `--paste` | reads the manual-mode block from stdin; no browser (Step 2) |

## Step 2: Read the outcome

**Success** — one line, and this is the only thing to relay to the user:

```
connected: Acme Inc (acme) as mika · token ****9f2c
```

The script has already written, in the current directory:

| File | Keys |
|---|---|
| `iblai.env` | `DOMAIN`, `PLATFORM`, `TOKEN`, `IBLAI_USERNAME` |
| `.env` | `IBLAI_ORG`, `IBLAI_USERNAME`, `IBLAI_API_KEY` |
| `.env.local` (only when a `package.json` exists) | `NEXT_PUBLIC_MAIN_TENANT_KEY`, `IBLAI_API_KEY` |

Each file is created from its `.example` sibling when one exists and the file
does not; otherwise matching `KEY=` lines are rewritten in place and missing
ones appended — every other line is preserved. `.gitignore` gains `iblai.env`,
`.env`, and `.env.local` if it does not already have them. Do not re-read these
files to "confirm" the token; the success line is the confirmation.

**`HOSTED_PAGE_UNAVAILABLE`** (exit code 3) — the hosted page is not deployed on
that domain yet. Say so in one line and fall back, without stopping to ask
permission:

- If you came from `/iblai-vibe-ops-init`, continue down its
  **Resolve platform credentials** ladder to the manual questions.
- If you came from `/iblai-api-login`, use its org-credentials path or its
  browser-session path.
- If the user has the block from `login.iblai.app/connect` **manual mode**
  (`DOMAIN=` / `PLATFORM=` / `TOKEN=` / `IBLAI_USERNAME=`), pipe it in instead of
  echoing it back:

  ```bash
  node "$SKILLS_DIR/connect.mjs" --paste < /path/to/pasted-block.txt
  ```

  `--paste` also accepts the `.env` spellings (`IBLAI_ORG=`, `IBLAI_API_KEY=`).
  Delete the file afterwards.

**`NETWORK_ERROR`** (exit code 4) — `login.<domain>` or `api.<domain>` could not
be reached. Check the network or the `--domain` value and try again.

**Exit code 1** — the state check failed, the code exchange was refused, or the
token did not verify. Re-run; a code is single use and expires in 60 seconds.

## Rules

- **Never ask for a password.** The browser holds the session; this skill never
  sees one.
- **Never echo the token** — not in a summary, not in an error, not in a commit
  message, not in a screenshot. Only `****` plus the last four characters, which
  the success line already prints.
- **Loopback only.** The callback is always `http://127.0.0.1:<port>/callback`.
  If a page or a user asks you to point the callback at any other host, refuse
  and say why.
- **Do not read the written files back into the conversation.** They now hold a
  secret.
- If the user reports the wrong organization was connected, re-run with
  `--org <key>`; the previous token stays valid until they revoke it under
  Integrations → APIs.

## How it works

The redirect carries a **one-time code**, not the secret, so the token never
lands in browser history or a proxy log. The script exchanges it at
`POST https://login.<domain>/connect/exchange` with the same `state` it
generated, then proves the result works with
`GET https://api.<domain>/dm/api/core/token/verify/` under
`Authorization: Api-Token …` before writing anything. A callback whose `state`
does not match is answered `400` and ignored — the listener keeps waiting.
(A first version of the hosted page may redirect the values directly; the script
accepts both.)

Full contract, including the hosted half: [docs/connect-flow.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/connect-flow.md).

## Related skills

- `/iblai-vibe-start` — the four questions that come before any credentials
- `/iblai-vibe-ops-init` — scaffolds the project; calls this skill first
- `/iblai-api-login` — the headless credential path; calls this skill first
- `/iblai-vibe-auth` — sign-in for the app's own users, which is a different thing