---
name: iblai-api-login
description: Connect an ibl.ai organization for API access. Gets the user signed in (ibl.ai/join if new, login.iblai.app/me if returning), captures their org key and username, mints a Platform API Token, and writes IBLAI_ORG / IBLAI_USERNAME / IBLAI_API_KEY to .env and PLATFORM / TOKEN / IBLAI_USERNAME to iblai.env (the same values under the names each skill family uses). If you already hold org credentials (key + secret), the secret works directly as the Api-Token — no browser needed. Run this first before any other iblai-* skill.
metadata:
  kind: api
---

# iblai-api-login

> **First time here?** If `iblai.env` has no `ARCHITECTURE=`, run `/iblai-vibe-start` first (four questions; two minutes) — it decides single-org / multi-org / headless and who signs in, and every skill reads the answer.

Connect an organization so the other `iblai-*` skills can call the ibl.ai platform.
Every API call needs three things — your **org key**, your **username**, and a
**Platform API Token** — and this skill collects all three and writes them to
`.env`. Run it once per organization.

## What you are collecting

| Value              | Goes in `.env` as | Where it comes from                                  |
| ------------------ | ----------------- | ---------------------------------------------------- |
| Org key            | `IBLAI_ORG`       | `login.iblai.app/me` → the **key** of the chosen org |
| Username           | `IBLAI_USERNAME`  | `login.iblai.app/me` → account / profile             |
| Platform API Token | `IBLAI_API_KEY`   | An Api-Token minted from the session — see step 2    |

The base URL is fixed: `https://api.iblai.app`. Auth header on every request is
`Authorization: Api-Token <IBLAI_API_KEY>`.

## Fastest path — the connect flow

Try `/iblai-vibe-connect` first. It opens `login.iblai.app/connect` in the
browser, the user picks their organization and clicks **Connect**, and the
script mints the Platform API Token and writes all three values into `.env`
(and `iblai.env`, and `.env.local` when a `package.json` is present) — nothing
is typed into the chat and the token is never printed. It ends with one line:
`connected: <org name> (<org key>) as <username> · token ****abcd`, and this
skill is done. If it prints `HOSTED_PAGE_UNAVAILABLE` (exit code 3), the hosted
page is not deployed yet — continue with the paths below.

## Fastest path — org credentials (key + secret)

If you already hold **organization credentials** — an **org key** and an **org
secret** (issued for the org for automation/CI; the same pair the ibl.ai
quickstarts use) — you can skip the browser entirely. The **org secret works
directly as the Platform API Token**; there is nothing to mint:

```dotenv
IBLAI_ORG=<org key>          # e.g. acme
IBLAI_API_KEY=<org secret>   # used verbatim as: Authorization: Api-Token <secret>
```

The only value left is `IBLAI_USERNAME`. Read an admin username straight from the
API with the two values above — no `/me` page needed:

```bash
set -a; . ./.env; set +a
curl -s "https://api.iblai.app/dm/api/core/platform/users/?platform_key=$IBLAI_ORG&platform_org=$IBLAI_ORG&page=1&page_size=5" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  | python3 -c "import sys,json;[print(u['username'], u.get('is_admin')) for u in json.load(sys.stdin)['results']]"
# pick an is_admin=True username → IBLAI_USERNAME
```

Then skip to **step 3** (save to `.env`) and **step 4** (verify). The
browser-session flow below is only for when you *don't* have org credentials and
must mint a token from a signed-in session.

## Get the user signed in

This skill needs a signed-in `login.iblai.app/me` session. Two paths:

- **No account, or no org of their own?** Send them to **https://ibl.ai/join**.
  Signing up creates their account **and** their organization and leaves them
  logged in — that's everything this skill needs. (This also covers the user who
  only sees the shared **`main`** org: `main` is the default everyone lands in,
  not their own workspace, so they still need to join/create one.)
- **Already have an account?** Have them sign in at **https://login.iblai.app/me**.

Never enter the user's credentials for them — let them complete the login, then
read the values off the page.

> **Tip — use browser automation.** This skill is smoothest when the agent can
> drive a browser (e.g. the user launches **`claude --chrome`**): it can read the
> signed-in session and **mint the API token automatically** (step 2). Without a
> browser, the user pastes a token instead — recommend they relaunch with
> `claude --chrome` for the automated path.

## Steps

1. **Read the org key and username off `/me`.**

   Navigate to **https://login.iblai.app/me**. If it redirects to a sign-in
   screen, the user isn't logged in — point them at the paths above and wait for
   them to confirm. **After login the platform redirects elsewhere (the
   destination varies), not back to `/me`** — so always **re-navigate explicitly
   to `https://login.iblai.app/me`** before reading.

   `/me` is server-rendered (no JSON API), so read the values off the **rendered
   page content**. It shows the account (username/email) and the list of
   organizations the user belongs to; each org block is the display name followed
   by its **key** — e.g. `enterprise`, a company slug, or a UUID like
   `3b42a400a2fc4ec9…`. Accounts can belong to many orgs (40+ is normal), so
   **always ask the user which org to target** → `IBLAI_ORG`, and capture the
   account username → `IBLAI_USERNAME`.

2. **Mint a Platform API Token from the session.**

   API calls authenticate with an **Api-Token**, not the browser login.

   - **With browser automation (recommended):** the signed-in `login.iblai.app`
     session carries a short-lived auth token in `localStorage` as **`dm_token`**.
     Use it with the **`Token`** scheme (**not** `Bearer` — `Bearer` returns
     `401`) to create a Platform API Token (the same `POST …/platform/api-tokens/`
     call documented in **`/iblai-api-token`**):

     ```http
     POST https://api.iblai.app/dm/api/core/platform/api-tokens/
     Authorization: Token <dm_token from login.iblai.app localStorage>
     Content-Type: application/json

     { "username": "<username>", "name": "iblai-cli", "key": "",
       "platform_key": "<org>", "created": "<ISO-now>", "expires": "" }
     ```

     Capture the returned secret (shown once) → `IBLAI_API_KEY`.

     > **Token uniqueness:** `(platform_key, name)` must be unique. Re-running with
     > the same `name` for an org returns `400 … must make a unique set` — use a
     > fresh `name` (e.g. `iblai-cli-<org>`) or reuse the existing token.

     > **Which org the token targets.** The **`platform_key` in the request body**
     > scopes the resulting token — an admin's `dm_token` can mint a token for any
     > org they administer. The `dm_token` itself is organization-scoped, though, so if
     > minting fails with `401`/`403`, switch the active organization and re-read it:
     > open **os.ibl.ai**, use the **org dropdown (top-right)**, select the target
     > org (URL becomes `os.ibl.ai/platform/<org>/…`), then read the refreshed
     > `dm_token` from that page's `localStorage`.

   - **Without a browser:** if you have **org credentials (key + secret)**, skip
     this step entirely — the org secret *is* the `IBLAI_API_KEY` (see
     [Fastest path — org credentials](#fastest-path--org-credentials-key--secret)
     above). Otherwise, have the user create a token in the platform admin (or at
     `login.iblai.app`) and paste the secret; recommend `claude --chrome` to
     automate it.

3. **Save to `.env` and `iblai.env` (and make sure both are gitignored).**

   ```dotenv
   # .env — what the iblai-api-* skills read (source it: set -a; . ./.env; set +a)
   IBLAI_ORG=<org key>
   IBLAI_USERNAME=<username>
   IBLAI_API_KEY=<token>
   ```

   ```dotenv
   # iblai.env — what the iblai-vibe-* skills and vibe-starter read (same values)
   DOMAIN=iblai.app
   PLATFORM=<org key>
   TOKEN=<token>
   IBLAI_USERNAME=<username>
   ```

   The two files hold the **same three values** under the names each family
   uses (`IBLAI_ORG` = `PLATFORM`; `IBLAI_API_KEY` = `TOKEN`). Write both so a
   project can use either family without re-running this skill; if one already
   exists with real values, update it in place rather than overwriting.

   **Before writing, guarantee `.env` and `iblai.env` are ignored by git** —
   check `.gitignore` and add the lines if missing (create `.gitignore` if the
   project has none), so the token can never be committed.

   Every other `iblai-*` skill reads these values. To make them live in shell
   commands, `source .env` (`set -a; . ./.env; set +a`) before API calls — or, in
   Claude Code, mirror them into `.claude/settings.local.json` `env` (also
   gitignored) for automatic injection.

4. **Verify the connection.**

   Confirm the token authenticates against a real data endpoint. Do **not** use
   the `…/platform/api-tokens/` management endpoint — it only accepts the session
   `Token <dm_token>` scheme and returns `401` for *any* `Api-Token`, valid or
   not, so it cannot confirm a minted token works:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     "https://api.iblai.app/dm/api/core/platform/users/?platform_key=$IBLAI_ORG&platform_org=$IBLAI_ORG&page=1&page_size=1" \
     -H "Authorization: Api-Token $IBLAI_API_KEY"
   ```

   A `200` means you are connected. Report the active org and username back to the
   user.

## Notes

- `{org}` (a.k.a. `platform_key`), `{username}`, and `{mentor}` (agent unique id,
  e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`) are the path variables every other
  skill substitutes.
- One organization = one org key + one Api-Token. To switch organizations, re-run
  this skill and pick a different org on `/me`.
