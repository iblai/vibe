# The connect flow — one link that returns an organization key and an API token

**Status: specification.** The client half (a script and a skill) ships in this
repo; the hosted half is one page on `login.iblai.app` that the ibl.ai web team
implements from this document. Until it exists, the client falls back to the
manual path (`/iblai-vibe-ops-init`'s questions), so nothing breaks.

## The problem it removes

Today a builder must: open `ibl.ai/join`, sign up, find their organization key
on `login.iblai.app/me`, open `os.ibl.ai`, switch to Admin, go to
Integrations → APIs → Add API, copy a secret, paste it into a chat, and never
paste it anywhere else. Every one of those steps has a way to go wrong, and
the token passes through the conversation.

With the connect flow the agent says *"opening your browser to connect your
ibl.ai organization"*, the builder signs in (or creates an organization),
clicks **Connect**, and the agent already has what it needs — the token never
appears in the chat.

## The contract

### 1. The client opens a URL

```
https://login.iblai.app/connect
   ?callback=http://127.0.0.1:<port>/callback
   &state=<random 32+ chars>
   &name=<app name, e.g. "my-app on Miguel's laptop">
   [&org=<org key, to preselect>]
```

- `callback` — a loopback URL the client is listening on (`127.0.0.1` or
  `localhost` only; the page must refuse anything else). Omitted → **manual
  mode** (§4).
- `state` — echoed back unchanged; the client rejects a callback whose `state`
  does not match (CSRF guard, exactly as OAuth loopback flows do).
- `name` — the label the minted token gets (`Platform API Token` → *Name*), so
  the user can recognize and revoke it later under Integrations → APIs.
- `org` — optional preselection when the client already knows the key.

### 2. The page

Hosted on `login.iblai.app` (that is where the session lives; `ibl.ai/connect`
may 302 here). Behavior:

1. **Not signed in** → the normal login flow, with `join` offered
   (`ibl.ai/join` creates the account **and** an organization), returning to
   `/connect` with the same query string afterwards.
2. **Signed in** → show the account and the organizations the user belongs to
   (the same data `/me` renders). `main` is listed but disabled with the note
   *"shared organization — create your own"* and a **Create organization**
   button (→ `ibl.ai/join`, then back).
3. The user picks an organization and clicks **Connect** (button text:
   *"Connect `<org name>` to `<name>`"*). The page mints a Platform API Token
   with the session's `dm_token`:

   ```http
   POST https://api.iblai.app/dm/api/core/platform/api-tokens/
   Authorization: Token <dm_token>
   { "username": "<username>", "name": "<name>", "key": "", "platform_key": "<org>", "created": "<now>", "expires": "" }
   ```

   `(platform_key, name)` must be unique — on a collision, append a short
   suffix (`my-app-2`) rather than failing.
4. **Callback mode** → redirect the browser to
   `callback?state=…&code=<one-time code>`; the client exchanges the code
   (§3). Show *"Connected — you can close this tab"*.
   **Manual mode** → show the values with copy buttons (§4).

Also add the loopback origin the app will use to the organization's **allowed
redirect origins** when the client passes `&origin=http://localhost:3000` —
this is the step new apps most often miss (sign-in never returns).

### 3. The code exchange (why not the token in the URL)

The redirect carries a **one-time code**, not the secret, so the secret never
lands in browser history or a proxy log:

```http
POST https://login.iblai.app/connect/exchange
Content-Type: application/json
{ "code": "<code>", "state": "<state>" }

200 { "domain": "iblai.app", "org": "<org key>", "org_name": "<display name>",
      "username": "<username>", "token": "<platform api token>", "expires": "" }
```

Codes expire in 60 seconds and are valid once. A wrong `state` is a `400`.
(For a first version, redirecting straight to
`callback?state=…&org=…&username=…&token=…&domain=…` is acceptable — the
listener is on the machine the user is sitting at — but the exchange is the
target.)

### 4. Manual mode (no loopback: SSH, containers, a remote agent)

`https://login.iblai.app/connect` with no `callback`: after **Connect** the
page shows

```
DOMAIN=iblai.app
PLATFORM=<org key>
TOKEN=<platform api token>          (shown once)
IBLAI_USERNAME=<username>
```

as a copyable block, plus the one line to run:
`npx -y @iblai/connect --paste` (or simply "paste this into the chat" — the
skill accepts it and writes the files without echoing the token).

## The client (in this repo)

`skills/start/iblai-vibe-connect/scripts/connect.mjs` (Node 18+, no dependencies):

1. Starts an HTTP listener on `127.0.0.1:<random port>` with a 5-minute timeout.
2. Opens `https://login.iblai.app/connect?callback=…&state=…&name=…[&origin=…]`
   in the default browser (`open` / `xdg-open` / `start`); prints the URL too
   (remote sessions copy it).
3. On the callback: verifies `state`, exchanges `code` (or reads the fields),
   verifies the token with `GET /dm/api/core/token/verify/`, and writes
   - `iblai.env`: `DOMAIN`, `PLATFORM`, `TOKEN`, `IBLAI_USERNAME`
   - `.env`: `IBLAI_ORG`, `IBLAI_USERNAME`, `IBLAI_API_KEY`
   - `.env.local` (when a Next.js app is present): `NEXT_PUBLIC_MAIN_TENANT_KEY`, `IBLAI_API_KEY`
   creating each from its `.example` when missing, updating lines in place
   otherwise, and making sure all three are gitignored.
4. Prints `connected: <org name> (<org key>) as <username> · token ****ab12`
   and exits. The token is never printed.
5. `--paste` reads the manual-mode block from stdin instead of opening a browser.

`/iblai-vibe-connect` is the skill that runs it and is what `/iblai-vibe-start`,
`/iblai-vibe-ops-init`, and `/iblai-api-login` call first; if the script exits
with `HOSTED_PAGE_UNAVAILABLE` (a 404 on `/connect`), they fall back to their
manual questions.

## Security notes for the web team

- Loopback only for `callback`; reject other hosts and non-`http(s)` schemes.
- Bind the code to `state` and to the session that created it; single use; 60 s.
- Mint with the minimal scope the platform offers for a token that will be
  used from a builder's server (Owner today; a narrower "app" scope when
  available).
- Log the mint (who, which org, which name) — the same audit as Add API.
- Never put the token in a `GET` URL when the exchange endpoint exists.

## What changes for users

`/iblai-vibe-start` → *"Connect your ibl.ai organization"* → browser → click →
back in the chat with the organization named and the files written. The
platform lifecycle doc's steps 3–4 become one step.
