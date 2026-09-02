# iblai-vibe

> Ecosystem index for building on the ibl.ai platform — the map of which repo and skill family covers a task, all reachable from this one repo. Use when the user mentions ibl.ai, iblai, or vibe, points an agent at github.com/iblai/vibe, asks where a capability lives, or asks which repo or skill to install. Frontend apps are built here in iblai/vibe (see /iblai-vibe-scaffold, /iblai-vibe-auth, and the vibe-starter template); REST API operation skills plus a chat MCP server live in iblai/api; the open-source agentic OS reference app is iblai/os; marketing and growth skills are in iblai/vibe-marketing.

# /iblai-vibe

Single entry point to the ibl.ai development ecosystem. Point a harness
or agent at [github.com/iblai/vibe](https://github.com/iblai/vibe) and
route from here: this repo builds the frontend, the companion repos
cover the REST API, the open-source OS app, and marketing. This skill
builds nothing itself — open it for orientation, then jump to the repo
or skill that matches the task.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## The repo map

| Repo | What it holds | Get it |
|---|---|---|
| [`iblai/vibe`](https://github.com/iblai/vibe) (this repo) | `/iblai-vibe-*` skills for building frontend apps on the platform — SSO auth, agent chat, the full agent-settings surface, analytics, deploy/build/release ops, security audits — plus the vibe-starter Next.js template and the `@iblai/iblai-js` SDK wiring | `npx skills add iblai/vibe --all` |
| [`iblai/api`](https://github.com/iblai/api) | `iblai-api-*` skills for operating the platform's REST API directly (agents, catalog, CRM, billing, analytics, infrastructure, …), a chat MCP server (`mcp/`), and `tutorials/` | `npx skills add iblai/api` |
| [`iblai/os`](https://github.com/iblai/os) | Source of the Agentic OS ([os.ibl.ai](https://os.ibl.ai)) — the flagship production app built on this same SDK. Reference implementation; self-hostable | clone / browse the repo |
| [`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing) | 43 marketing skills (CRO, copywriting, SEO, paid ads, lifecycle, growth) plus `tools/` (62 platform CLIs, 80 integration guides) | `npx skills add iblai/vibe-marketing` |

## Start here

- **New app** → vibe-starter via `/iblai-vibe-ops-init` (pre-wired
  Next.js + SSO + navbar), or assemble by hand with `/iblai-vibe-scaffold`.
- **Add a feature to an existing app** → the `/iblai-vibe-*` skill table
  in this repo's [CLAUDE.md](https://github.com/iblai/vibe/blob/main/CLAUDE.md#skills);
  wire `/iblai-vibe-auth` first, then the feature skill.
- **Drive the platform REST API** (automations, backends, data work) →
  install `iblai/api` and open the `iblai-api-*` skill for that API family.
- **See how a production app wires the SDK** → read the `iblai/os` source,
  or — if the user is signed in to os.ibl.ai — learn from the live tenant
  ([CLAUDE.md → Learn from a live tenant](https://github.com/iblai/vibe/blob/main/CLAUDE.md#learn-from-a-live-tenant)):
  decode the URL, mint a token from the session, read real responses.
- **Marketing / growth work** → install `iblai/vibe-marketing`.

## Key links

- [CLAUDE.md](https://github.com/iblai/vibe/blob/main/CLAUDE.md) — full agent guidance and the complete skill table
- [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) — brand guidelines
- [skills/](https://github.com/iblai/vibe/tree/main/skills) — every skill in canonical SKILL.md format (Cursor / Codex adapters pre-generated in [adapters/](https://github.com/iblai/vibe/tree/main/adapters))
- [ibl.ai/docs](https://ibl.ai/docs) — platform documentation
- [ibl.ai/developer](https://ibl.ai/developer) — developer docs
- `iblai/api` quick references for the five REST families most apps read or write (raw SKILL.md; the matching SDK hooks and vibe skills are in [CLAUDE.md → Platform data most apps lean on](https://github.com/iblai/vibe/blob/main/CLAUDE.md#platform-data-most-apps-lean-on)):
  [profile-metadata](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile-metadata/SKILL.md) — schemaless per-user × org JSON for preferences, flags, onboarding progress, app state; no vibe skill, call the SDK hooks ·
  [agent-setting](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-setting/SKILL.md) — an agent’s identity and capability flags via one PUT of changed fields; fork, delete ·
  [agent-memory](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-agent-memory/SKILL.md) — global, per-agent, and shared-knowledge memories plus capture/recall toggles ·
  [analytics](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-analytics/SKILL.md) — usage, costs, transcripts, per-user learning, reports; `mentor_unique_id` scopes to one agent ·
  [profile](https://raw.githubusercontent.com/iblai/api/refs/heads/main/skills/iblai-api-profile/SKILL.md) — the signed-in user’s account, social links, career records, résumé

## Related skills

- `/iblai-vibe-component` — overview of every SDK component this repo can add
- `/iblai-vibe-ops-init` — set up a project (CLAUDE.md guidance + vibe-starter)
- `/iblai-vibe-crm-overview` — the same index pattern, scoped to the CRM API family
- `/iblai-vibe-ops-upgrade` — keep the SDK and skills current