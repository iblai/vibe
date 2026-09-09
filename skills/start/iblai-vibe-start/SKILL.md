---
name: iblai-vibe-start
description: The first conversation for anything on ibl.ai — four questions that decide the whole shape of the work before any file is touched (new project or existing codebase; single-organization app, multi-organization app, or headless server-to-server; who signs in — members, the public, or nobody; which of users, memories, agents, and organizations the app is about), recorded in iblai.env and the project CLAUDE.md, then routed to the right skills. Use when the user says "start", "I want to build", "new app", "integrate ibl.ai into", "add ibl.ai to my project", "which skills do I need", "where do I start", or describes an app with users, agents, organizations, or memories without saying which. For scaffolding see /iblai-vibe-ops-init; for adding sign-in to an existing app see /iblai-vibe-auth; for headless work see /iblai-api-login.
globs:
alwaysApply: false
metadata:
  kind: guide
---

# /iblai-vibe-start

Ask four questions, write the answers down, route. Every later skill reads
the answers instead of asking again. Takes two minutes; prevents the two
expensive mistakes (building a single-org app that needed to be multi-org,
and wiring SSO into something that only needed a server token).

> Words: [docs/glossary.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/glossary.md).
> Sign-in mechanics and the three architectures in full: [docs/auth-model.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/auth-model.md).
> The entities every app is built on: [docs/domain-model.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/domain-model.md).

## Step 0: Skip what is already answered

Read `iblai.env` if it exists. These keys are the record of this conversation;
any that are present are settled — ask only the missing ones:

```
PROJECT=new | existing
ARCHITECTURE=single-org | multi-org | headless
ACCESS=members | public | none
DOMAIN_FOCUS=users,memories,agents,organizations   # comma-separated subset
```

If all four are present, say so in one line and go to **Step 5**.

## Step 1: New or existing?

> Is this a **new project**, or am I adding ibl.ai to an **existing** codebase?

- Look before asking: no `package.json` → new. A `package.json` with `next` →
  existing Next.js app. Anything else (Vite, Remix, Expo, a Python backend) →
  existing, and note the framework — the `ui` skills target Next.js; the `api`
  skills work anywhere.

## Step 2: One organization, many, or none?

> Who is this for?
> - **One organization** — mine, or one customer I deploy it to. Members sign in; the app is pinned to that org. *(most apps)*
> - **Many organizations** — one deployment, users move between orgs, like os.ibl.ai.
> - **No sign-in at all** — a script, a CI job, or my own backend calling the platform.

Map to `ARCHITECTURE=single-org | multi-org | headless`. Explain in one
sentence why it matters: single-org pins the org key and uses one
server-to-server token; multi-org puts the org in the URL and re-authenticates
per org; headless never touches SSO. Recommend **single-org** when unsure —
everything carries over to multi-org later.

## Step 3: Who signs in?

Skip when `ARCHITECTURE=headless` (`ACCESS=none`).

> Who reaches the app?
> - **Members only** — people who belong to the organization (invited, or self-joined). *(default)*
> - **The public too** — at least one agent is reachable without an account (a public assistant, a lead-capture bot, a demo).

Map to `ACCESS=members | public`. `public` means: mark that agent
`allow_anonymous` and leave its route out of `AuthProvider`'s protection
(docs/auth-model.md §4).

## Step 4: What is it about?

> Which of these does the app revolve around? Pick all that apply:
> - **Users** — profiles, per-user settings, roles and admins
> - **Memories** — the app remembers things about each person; agents personalize
> - **Agents** — creating or configuring agents, not just chatting with one
> - **Organizations** — org-level settings, branding, billing, many customers

Map to `DOMAIN_FOCUS=…`. Most apps say "users and agents"; that is fine.

## Step 5: Record and route

1. Write the four keys to `iblai.env` (create the file from
   `iblai.env.example` when missing; keep existing lines).
2. If a project `CLAUDE.md` / `AGENTS.md` exists, add or replace a
   `## Decisions` block:

   ```markdown
   ## Decisions (from /iblai-vibe-start)
   - Project: new | existing (<framework>)
   - Architecture: single-org | multi-org | headless — <one line why>
   - Access: members | public (<which agent is public>) | none
   - Focus: users, memories, agents, organizations
   ```

3. Credentials: run `/iblai-vibe-connect` (browser round trip; falls back to
   manual questions). Skip it when `iblai.env` already holds a real `PLATFORM`
   and `TOKEN`, or the host exports `IBLAI_API_KEY`.

4. Route — say which skill you are opening and why:

| Answers | Next |
|---|---|
| `new` + `single-org` | `/iblai-vibe-ops-init` — vibe-starter already is this architecture (pinned org, `/setup`, admin area, user + org settings) |
| `new` + `multi-org` | `/iblai-vibe-ops-init`, then `/iblai-vibe-auth` → "Going multi-org" (the OS pattern: org in the URL, `TenantSwitcher`, per-agent anonymous rule) |
| `existing` Next.js + `single-org` / `multi-org` | `/iblai-vibe-auth` (providers, store, SSO callback), then the feature skills for the focus |
| `existing` non-Next.js, any `ACCESS` | The `api` family: `/iblai-api-login`, then `/iblai-vibe-api`'s server-route pattern adapted to the framework; the SDK's React components need Next.js |
| `headless` | `/iblai-api-login`, then the `iblai-api-*` skill per family; `tutorials/` for end-to-end recipes |
| `ACCESS=public` (any) | after the above: `/iblai-vibe-agent-setting` (`allow_anonymous`) and `docs/auth-model.md` §4 |

5. Then by focus:

| Focus | Open |
|---|---|
| users | `/iblai-vibe-profile` ★, `/iblai-vibe-user-metadata` ★, `/iblai-vibe-admin` |
| memories | `/iblai-vibe-memory-guide` ★ |
| agents | `/iblai-vibe-agent-create` ★ → `/iblai-vibe-agent-setting` ★ → `/iblai-vibe-agent` |
| organizations | `/iblai-vibe-org-metadata`, `/iblai-vibe-account`, `/iblai-vibe-pricing` |

Always finish with `/iblai-vibe-ops-test` before showing work, and mention
`/iblai-vibe-ops-deploy` / `/iblai-vibe-ops-build` as the way to ship.

## Notes

- Never ask for a password, and never for the Platform API Token before
  `/iblai-vibe-ops-init` or `/iblai-api-login` needs it (they say where it
  comes from).
- The answers are not permanent: re-run this skill to change them; the
  record in `iblai.env` is the source of truth for later skills.
- Installed skills are a copy — if `.claude/skills/iblai-vibe/SKILL.md` is
  older than two weeks, suggest `/iblai-vibe-ops-upgrade` first.
