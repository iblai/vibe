# Headless API skills — the `iblai-api-*` contract

The `iblai-api-*` skills operate the ibl.ai platform **without a user
interface**: each maps one capability to its exact `api.iblai.app` REST
endpoints (method, URL, body, errors) so an agent, a script, a CI job, or a
server route calls the platform correctly the first time. They came from the
former `iblai/api` repository and keep its contract, reproduced here. The
visual-component skills (`iblai-vibe-*`, kind `ui`) are described in
[skill-kinds.md](skill-kinds.md).

## Using an API skill

1. **Connect once:** `/iblai-api-login` — signs the user in
   ([ibl.ai/join](https://ibl.ai/join) if new, [login.iblai.app/me](https://login.iblai.app/me)
   otherwise), captures the **org key** and **username**, mints a **Platform
   API Token**, and writes them to `.env` **and** `iblai.env`. An **org
   secret** works directly as the token for headless/CI use.
2. **Every call:** base URL `https://api.iblai.app` (or `https://api.$DOMAIN`
   when self-hosted), header `Authorization: Api-Token $IBLAI_API_KEY`.
   Path variables: `{org}` = `$IBLAI_ORG` (a.k.a. `platform_key`),
   `{username}` = `$IBLAI_USERNAME`, `{mentor}` = an agent's `unique_id`.
3. **Load the credentials** from whichever file the project has:

   ```bash
   set -a; [ -f .env ] && . ./.env; set +a
   val() { grep -m1 "^$1=" iblai.env 2>/dev/null | cut -d= -f2-; }
   : "${IBLAI_ORG:=$(val PLATFORM)}"; : "${IBLAI_API_KEY:=$(val TOKEN)}"; : "${IBLAI_USERNAME:=$(val IBLAI_USERNAME)}"
   DOMAIN="${DOMAIN:-$(val DOMAIN)}"; DOMAIN="${DOMAIN:-iblai.app}"; API="https://api.$DOMAIN"
   ```

   `IBLAI_ORG` = `PLATFORM` = `NEXT_PUBLIC_MAIN_TENANT_KEY`; `IBLAI_API_KEY` =
   `TOKEN`. Never commit either file; never print the token.
4. **Destructive or outward-facing calls** (delete, send, invite, checkout)
   are marked "confirm with the user first" — do.
5. **Inside a Next.js app**, the same endpoints are called from a server route
   with `lib/iblai/platform.ts` — see `/iblai-vibe-api`. In the browser, use the
   SDK hook instead (it carries the user's session).

## Runtime chat: the hosted MCP server

Skills cover everything reachable over REST. The one **runtime** capability
that is not a REST admin call — holding a live conversation with a deployed
agent (streamed responses, tool use, RAG) — is a hosted Model Context Protocol
server, `iblai-agent-chat` (`mcp/iblai-agent-chat/README.md`). Wire it with
`/iblai-api-agent-chat`; talk over raw REST/SSE with `/iblai-api-agent-session`
instead when you want transport control. Rule: **if a skill covers it, there
is no server for it.**

This is a different server from `@iblai/mcp` in `.mcp.json`, which gives your
coding assistant the SDK's component and hook documentation.

## Authoring contract (when you add or change an `iblai-api-*` skill)

### Structure and sources of truth

- **Where a skill lives:** `skills/<category>/<name>/SKILL.md`. The nine categories — `start`, `agents`, `users`, `organizations`, `billing`, `analytics`, `content`, `ship`, `security` — and every skill's category are recorded in `scripts/skill-categories.json`; add a new skill there too. Installs flatten the tree, so a skill is always `.claude/skills/<name>/` at runtime — **never** write a category segment into a `.claude/skills/…` path.
- Each skill is a `SKILL.md` with YAML frontmatter (`name`, `description`) following the format of `skills/agents/iblai-api-agent-setting/SKILL.md` and `skills/start/iblai-api-login/SKILL.md`. A skill MAY additionally bundle a **`references/`** directory and an **`assets/`** directory for sample files, each linked from `SKILL.md` via a `## Reference material` section. `references/` holds anything that would bloat the scannable primary: exhaustive lookup tables (field schemas, action catalogs) **and** the developer docs' fuller explanatory material — concepts, architecture/data-flow, configuration and integration guides, and troubleshooting (this is where non-endpoint doc content that doesn't belong in the endpoint-focused `SKILL.md` is preserved, including UI/integration walkthroughs). **`SKILL.md` itself stays the scannable, endpoint-focused primary and still obeys the "APIs not UIs" rule; `references/` is doc-sourced supplementary material.** See `skills/organizations/iblai-api-external-service-proxy/`, `skills/organizations/iblai-api-crm/`, and `skills/agents/iblai-api-agent-memory/` for the pattern.
- **Canonical section structure (every endpoint-documenting skill MUST follow this):**
  1. `## Auth & conventions` — base URL, header, path vars, prefix, "run `/iblai-api-login` first" line, and the destructive-confirm note.
  2. *(optional)* one short explanatory section (e.g. `## Concepts`, `## Pagination`) when the API needs framing before the endpoints.
  3. `## Reads` — every read endpoint (**GET**/**HEAD**).
  4. `## Writes` — every write endpoint (**POST**/**PUT**/**PATCH**/**DELETE**); mark each destructive/outward-facing call "Confirm with the user first."
  5. `## Example` — one realistic `curl`.
  6. `## Notes` — gotchas.
  - **Multi-resource skills** (catalog, crm, rbac, billing, …) keep their resource grouping as `###` sub-headings **inside** `## Reads` and `## Writes` (a resource with both appears under each). Do **not** group endpoints by resource at the top level — Reads/Writes is always the top-level split.
  - A read-only skill may omit `## Writes`; a write-only skill may omit `## Reads`.
  - Exceptions: non-REST skills do not use Reads/Writes — `iblai-api-login` and `iblai-api-agent-chat` (setup flows), and `iblai-api-infrastructure` and `iblai-api-ecosystem` (deployment / open-source-ecosystem guides sourced from the developer docs, content held in `references/`). These are guides, not endpoint references.
- **Auth model (every skill):** base URL `https://api.iblai.app`, header `Authorization: Api-Token $IBLAI_API_KEY`. Path vars `{org}` = `$IBLAI_ORG` (a.k.a. `platform_key`), `{username}` = `$IBLAI_USERNAME`, `{mentor}` = the agent's unique id.
- **Gateway prefixes — `/dm` and `/edx`.** `api.iblai.app` is a gateway that sits **in front of** the backend services and strips a prefix before routing:
  - `https://api.iblai.app/dm/...` → the **Data Manager** service (the `iblai/iblai-dm-pro` (private backend repo) repo).
  - `https://api.iblai.app/edx/...` → the **Open edX** service (a different system).

  The prefix is added at the gateway, so it does **not** appear in any backend `urls.py` — the source repos register bare `/api/...` routes. A skill must prepend the right prefix (e.g. a DM route `/api/catalog/courses/` is documented and called as `https://api.iblai.app/dm/api/catalog/courses/`). When in doubt, an endpoint is a **`/dm`** endpoint.
- **Source of truth = the repo URLconf, not the docs.** Skills for DM features are derived from `iblai-dm-pro`. The app `USAGE.md` files are a starting point but contain errors, gaps, and (critically) endpoints that only apply to **edX** — those do **not** belong here. **Rule: only document an endpoint if it is registered in that repo's `urls.py` (i.e. reachable at `api.iblai.app/dm/...`).** If a path is not in this repo's URL configuration, drop it — it would not resolve via `/dm`. Always verify each endpoint's method, path, and request fields against the actual `urls.py` / views / serializers before shipping a skill.
- **Connecting an organization:** `/iblai-api-login` opens `https://login.iblai.app/me`, lets the user pick one of their organizations, and writes `IBLAI_ORG`, `IBLAI_USERNAME`, and `IBLAI_API_KEY` to `.env`. Always ask the user which org to target — accounts can belong to many (40+ is normal).
  - **Logged out:** `/me` redirects to `/login`. Detect this (URL is `/login`, no "My Account" content), hand the user the `https://login.iblai.app/me` URL, and wait for them to sign in — never enter their credentials.
  - **After login the platform redirects somewhere else** (the destination varies and may change), NOT back to `/me`. Don't depend on where it lands — always **re-navigate explicitly to `https://login.iblai.app/me`** before reading params.
  - `/me` is **server-rendered** — there is no JSON API; read org keys + username from the rendered page content. Each org block is the display name followed by its key (e.g. `Enterprise → enterprise`, `ibl.ai → iblai`, or a UUID).
  - There is **no working logout route** (`/logout`, `/api/auth/logout` both 4xx); the session is an httpOnly cookie. To force a logged-out state for testing, clear the browser's cookies for `login.iblai.app`.
- Mark every DELETE / destructive / outward-facing call (delete, send, invite) "confirm with the user first."

### Terminology (settled — use consistently)

The wire and the prose use different words for the same things. **Prose in this
repo uses `organization` / `org key`, `agent`, and `user`. The words *tenant*,
*mentor*, and *learner* appear only as verbatim wire names, in backticks.**

- **Platform** — the ibl.ai system as a whole (`api.iblai.app`, `login.iblai.app`). One platform serves every customer. **Never** use "platform" to mean a single customer's workspace. (It is fine in product terms like "Platform API Token" and in prose like "the platform API".)
- **Organization (org)** — one customer's isolated workspace (its own users, agents, branding, data). This is the **primary noun** in all prose and docs. It matches what customers see on `login.iblai.app/me` ("Organizations") and the API path `/orgs/{org}/`.
- **org key** — the organization's identifier, e.g. `enterprise`. On the API wire it also appears as `org`, `platform_key`, and `platform_org` — **keep those verbatim** in endpoint references; they all mean *the org key*.
- **Agent** — a configured AI assistant. On the wire it is `mentor` (`mentor_unique_id`, `/mentors/{mentor}/`, the `X-Mentor-Unique-Id` header) — **keep those verbatim**.
- **User** — a person with an account in the org. On the wire, LMS/catalog routes sometimes say `learner` — **keep that verbatim** where the API does.
- **`tenant`** — a wire name only, never prose. Not even as an adjective: write "multi-organization", "organization isolation", "organization key" — not "multi-tenant", "tenant isolation", "tenant key". Write `` `tenant` `` in backticks only where the API or the SDK really uses it: the `tenant` query param on some search endpoints, `localStorage` keys `tenant` / `tenants` / `current_tenant` / `visiting_tenant`, and the SDK's `TenantProvider` / `useTenantSwitch` / `NEXT_PUBLIC_MAIN_TENANT_KEY` / `IBL_TENANT`. Note the MCP scope enum is `user|mentor|platform`, **not** `…|tenant`. The `@iblai` SDK / vibe / os keep `tenant` in env vars; this repo's own env vars deliberately use `org` instead.

Env vars follow the noun: active workspace is `IBLAI_ORG` + `IBLAI_API_KEY`; saved per-workspace keys are `IBLAI_ORG_<NAME>_KEY`.

### Naming

Scope is encoded by prefix: `iblai-api-agent-*` acts on one agent;
`iblai-api-profile*` on the signed-in user; org-wide skills are bare
(`iblai-api-management`, `-rbac`, `-crm`, `-token`, `-integration`,
`-notification`, `-invite`; `iblai-api-org` is the org-settings skill);
cross-cutting skills are bare too (`-search`, `-analytics`, `-course-create`,
`-login`). Every `iblai-api-*` skill carries `metadata.kind: api` (or `guide`
for the two non-REST guides, `-ecosystem` and `-infrastructure`).

### Verification

Run `bash scripts/validate-skills.sh`, `node scripts/check-skill-kinds.mjs`,
`node scripts/check-links.mjs`, `node scripts/build-adapters.mjs`, and
`node scripts/check-skill-tables.mjs` before opening a PR; confirm each
endpoint against the live OpenAPI schema
(`https://api.iblai.app/dm/api/docs/schema/`) and the backend URLconf.

### Building a new MCP server

```bash
# Install dependencies
cd mcp/iblai-<service>
uv sync

# Run the server
uv run iblai-<service>

# Run tests
uv run pytest
```

Each server contains:

- **server.py**: tool definitions via `@server.tool()` decorators
- **auth.py**: `AuthManager` supporting api_key, bearer, basic, custom_header, oauth2_client_credentials via env vars
- **client.py**: `APIClient` for async httpx requests

Conventions: server names `iblai-<service>`, package names `iblai_<service>`; stdio transport locally, streamable-http for hosted. The hosted servers expect `Authorization: Api-Token <key>`; the `org` is derived from the token.

## Tutorials

`tutorials/` holds end-to-end walkthroughs that combine several `iblai-api-*`
skills into a working result (e.g. `tutorials/voice-agent`: an agent on your
own server that places outbound phone calls).
