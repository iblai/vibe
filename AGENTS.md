# AGENTS.md

This is **iblai/vibe** — the toolkit for building apps on the
[ibl.ai](https://ibl.ai) platform and for operating it headlessly. One
install (`npx skills add iblai/vibe --all`), two skill families:

- **`iblai-vibe-*`** (kind `ui` / `ops` / `guide`) — mount the `@iblai/iblai-js`
  SDK's visual components in a Next.js app (vibe-starter), build, test, ship.
- **`iblai-api-*`** (kind `api`) — exact REST endpoints for every platform
  family, no screen; the former `iblai/api` repository, merged here with its
  contract intact (`docs/api-skills.md`).

- **Full agent guidance lives in [CLAUDE.md](CLAUDE.md)** — read it first.
- **Start at [`skills/iblai-vibe/SKILL.md`](skills/iblai-vibe/SKILL.md)** — what
  you want → which skill. Headless: [`skills/iblai-api-login/SKILL.md`](skills/iblai-api-login/SKILL.md).
- The families and kinds: [docs/skill-kinds.md](docs/skill-kinds.md). Sibling
  repos: [`iblai/os`](https://github.com/iblai/os) (reference app),
  [`iblai/vibe-agent`](https://github.com/iblai/vibe-agent),
  [`iblai/vibe-marketing`](https://github.com/iblai/vibe-marketing).
- Skills are a copy — refresh with the install command or `/iblai-vibe-ops-upgrade`.
  Cursor and Codex rule formats are pre-generated in `adapters/`.
