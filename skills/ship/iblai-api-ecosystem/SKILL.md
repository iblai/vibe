---
name: iblai-api-ecosystem
description: Map of the ibl.ai open-source ecosystem — the repo family and the shared @iblai tooling, all built on the api.iblai.app backend. iblai/vibe (this repo) holds both skill families — iblai-vibe-* to build apps with visual components and iblai-api-* to operate the platform headlessly (the former iblai/api); iblai/os and iblai/lms are complete forkable sample apps; iblai/iblai-infra-cli self-hosts the backend. Read this to orient: which repo to reach for when operating vs. building vs. forking vs. deploying. Not a REST skill — no endpoints.
metadata:
  kind: guide
---

# iblai-api-ecosystem

Orientation to the **ibl.ai open-source family**. Everything ibl.ai ships is built
on one hosted backend — `https://api.iblai.app` — with each **organization** (org)
fully isolated (its own users, agents, branding, data). The repos differ only in
what they let you *do* to that backend: operate it, build on it, fork a finished
product, or host it yourself.

You are inside **`iblai/vibe`** — one install (`npx skills add iblai/vibe --all`)
that carries two skill families: **`iblai-vibe-*`** (kind `ui`/`ops`/`guide`:
build apps with the SDK's visual components) and **`iblai-api-*`** (kind `api`:
operate the platform headlessly over REST — the former `iblai/api` repository,
merged here). This skill exists so you know where the sibling repos and tooling
fit, and which one to reach for next. It has no endpoints; the detail lives in
the reference files below. The two families are delineated in
[docs/skill-kinds.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-kinds.md).

## The repo family

| Repo | What it is | Reach for it when |
| ---- | ---------- | ----------------- |
| **[iblai/vibe](https://github.com/iblai/vibe)** *(this repo)* — `iblai-api-*` | **Management layer** — skills that map to exact `api.iblai.app` REST endpoints, plus one hosted chat MCP server. Operate the platform headlessly from an agent, terminal, or CI — no UI. | You want to configure agents, datasets, memory, users, roles, notifications, discovery, profiles, or analytics as `/` commands. Run `/iblai-api-login` first. |
| **[iblai/vibe](https://github.com/iblai/vibe)** *(this repo)* — `iblai-vibe-*` | **Build layer** — the vibe-starter Next.js template, `@iblai/iblai-js` SDK components, and the skills that mount them. Auth is client-side SSO (no API tokens in the browser). | You're building a new app on the ibl.ai backend. Start with `/iblai-vibe` and `/iblai-vibe-ops-init`. |
| **[iblai/os](https://github.com/iblai/os)** | **Sample app** — the open-source AI agent platform running at [os.ibl.ai](https://os.ibl.ai). A complete, production-grade codebase (web + native desktop/mobile), built *with* vibe. | You want a full AI-agent product to fork, point at your org, rebrand, and ship. See `references/repos.md`. |
| **[iblai/lms](https://github.com/iblai/lms)** | **Sample app** — the open-source skills-intelligence platform at [lms.ibl.ai](https://lms.ibl.ai): courses, competencies, credentials, analytics. Also built *with* vibe. | You want a learning/upskilling product to fork and ship. See `references/repos.md`. |
| **[iblai/iblai-infra-cli](https://github.com/iblai/iblai-infra-cli)** | **Deploy layer** — provision the backend on your own AWS account or servers with Terraform + Ansible (given access to the backend images). | You need to self-host instead of running against hosted `api.iblai.app`. See **`/iblai-api-infrastructure`** for the details. |

**How they relate:** the `iblai-vibe-*` skills *build* apps like os and lms on the
same backend that the `iblai-api-*` skills *operate* and iblai-infra-cli *deploys*. The two sample apps prove what the stack
produces; you can clone either and modify it. A free tier is available on the hosted
backend; for a license to the full platform codebase (to run locally or self-host),
contact [ibl.ai/contact](https://ibl.ai/contact).

## Which do I reach for?

- **Operate an existing org** (agents, users, analytics, no UI) → the **`iblai-api-*`** skills. Start with **`/iblai-api-login`**; hold a live conversation with a deployed agent via **`/iblai-api-agent-chat`** (the one runtime capability that isn't REST).
- **Build a new app** on the backend → the **`iblai-vibe-*`** skills: `/iblai-vibe` (start here), `/iblai-vibe-ops-init` (vibe-starter) → `references/app-tooling.md`.
- **Fork a finished product** → **iblai/os** (agents) or **iblai/lms** (learning) → `references/repos.md`.
- **Self-host the backend** → **iblai/iblai-infra-cli** → **`/iblai-api-infrastructure`**.

## Reference material

Full, deduped detail from the developer docs (which are being retired) lives here:

- **[`references/repos.md`](references/repos.md)** — per-repo deep dive: what each of vibe (both families) / os / lms / iblai-infra-cli *is*, who it's for, its features, tech stack, deploy options, and quick start. Reach here to decide which repo to fork or study.
- **[`references/app-tooling.md`](references/app-tooling.md)** — the vibe build layer in depth: the `iblai-app-cli` scaffolder, the `@iblai` SDK/API/MCP packages, the full vibe skills catalog, the shared backend's capabilities, and the end-to-end quickstart (scaffold → connect → customize → deploy web/desktop/mobile).

Related skills in this repo: **`/iblai-api-login`** (connect an org — run first), **`/iblai-api-agent-chat`** (runtime chat MCP), **`/iblai-api-infrastructure`** (self-hosting with iblai-infra-cli).
