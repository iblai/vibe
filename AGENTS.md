# AGENTS.md

**First message from a user about building on or operating ibl.ai → run the four
questions in [`skills/iblai-vibe-start/SKILL.md`](skills/iblai-vibe-start/SKILL.md)
before touching any file**, unless `iblai.env` already records `ARCHITECTURE=`.
This file is read by OpenAI Codex, Claude Code (via `CLAUDE.md`), and any
agent that honors `AGENTS.md`; the same rule is in every skill's common setup.

This is **iblai/vibe** — the toolkit for building apps on the
[ibl.ai](https://ibl.ai) platform and for operating it headlessly. One
install (`npx skills add iblai/vibe --all`), two skill families:

- **`iblai-vibe-*`** (kind `ui` / `ops` / `guide`) — mount the `@iblai/iblai-js`
  SDK's visual components in a Next.js app (vibe-starter), build, test, ship.
- **`iblai-api-*`** (kind `api`) — exact REST endpoints for every platform
  family, no screen; the former `iblai/api` repository, merged here with its
  contract intact (`docs/api-skills.md`).

- **Full agent guidance lives in [CLAUDE.md](CLAUDE.md)** — read it first.
- **The first conversation is `/iblai-vibe-start`** — new or existing project;
  single-org, multi-org, or headless; who signs in; users / memories / agents /
  organizations. Recorded in `iblai.env`; every later skill reads it.
  How sign-in and tenancy work: [docs/auth-model.md](docs/auth-model.md).
- **Start at [`skills/iblai-vibe/SKILL.md`](skills/iblai-vibe/SKILL.md)** — what
  you want → which skill. Headless: [`skills/iblai-api-login/SKILL.md`](skills/iblai-api-login/SKILL.md).
- The families and kinds: [docs/skill-kinds.md](docs/skill-kinds.md). Sibling
  repos: [`iblai/os`](https://github.com/iblai/os) (reference app),
  [`iblai/vibe-agent`](https://github.com/iblai/vibe-agent),
  [`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing).
- Skills are a copy — refresh with the install command or `/iblai-vibe-ops-upgrade`.
  Cursor and Codex rule formats are pre-generated in `adapters/`.
