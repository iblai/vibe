# Known traps when reviewing vibe PRs

Lessons from past reviews, each one hit at least once. Backend facts are
stated as HTTP behaviour; check them again when the backend moves (`info.version`
in the live schema).

## CI and the gates

- **An unlabelled PR runs nothing.** `skills-ci` is gated on the `run-tests`
  label, so a green PR page and an unverified PR look the same; the check runs
  say `skipped`.
- **No gate regenerates `docs/catalogue.md`.** `check-skill-tables.mjs` compares
  only the set of skill names mentioned, so a stale catalogue body passes.
  Regenerate it and diff.
- **`check-skill-tables.mjs` reads every slash-prefixed `iblai-vibe-…` or
  `iblai-api-…` name in `CLAUDE.md` and `docs/catalogue.md`, paths included, as
  a product skill that must exist under `skills/`.** Internal skills (this one)
  are named there without the slash.
- **`check-endpoint-schema.mjs` has blind spots.** It scans only `kind: api`
  skills, reads only literal `https://api.iblai.app/dm/…` URLs on a `**METHOD**`
  or `curl` line, and a schema `{param}` absorbs any sibling segment. Relative
  paths, tables and `ui` skills are never checked, and a planted fault in a
  `ui` skill stays green.
- **`test-skills-render.mjs` places a fence by a backticked `*.ts(x)` path in the
  four lines above it**, not by a `// path` comment inside it. Untargeted fences
  become `snippet-N.tsx`; an unresolvable `@/…` import is stubbed like a
  third-party module, so an import from one fence's file into another is never
  checked; fences without `import`/`export` are skipped. Skip indices in
  `scripts/skill-render-skips.json` count ts/tsx fences from 0, so adding a
  fence shifts every later index.
- **`build-adapters.mjs` reads only `SKILL.md`.** An edit under `references/`
  regenerates nothing.
- **`check-links.mjs` can be red on `main`** for links no PR touched; it skips
  dot-directories and `adapters/`.
- **The 400-line cap for Tier 0/1 skills is not enforced**; `validate-skills.sh`
  warns only above 500.
- **The live schema is several megabytes and streams slowly.** Give the
  endpoint check minutes, not seconds.
- **`scripts/sweep-terms.py` rewrites files in place** and is in no gate; run
  repo-wide it corrupts the line that explains its own rule. Run it in a
  scratch tree and read the diff.

## Generated files and releases

- `adapters/` and `docs/catalogue.md` are generated. A conflict in either is
  resolved by regenerating; a byte-identity diff against the regenerated file
  proves it, reading it does not.
- The catalogue cuts each description at its first " — ", so a description
  whose first clause does not stand alone becomes a fragment such as
  "Add the agent Skills tab (AgentSkillsTab".
- `CHANGELOG.md` is written by `release.yml`; a PR never edits it. The commit
  subject decides the release: `feat:` minor; `fix:`, `perf:`, `docs:`,
  `refactor:` patch; `chore:`, `ci:`, `test:`, `style:`, `build:` none.
- Skill text reaches users only when a release is cut; screenshots linked
  through `refs/heads/main` change for every reader the moment the PR merges.
- A file that calls itself a byte mirror of a skill's `assets/` (an
  `app-files.md` reference) drifts, and nothing compares the two. Check byte
  identity.
- The repository has no prettier config: `prettier --write` reflows lines the
  author did not touch.

## SDK surface

- **An `overrides:` pin in vibe-starter's `pnpm-workspace.yaml` hides export
  drift.** A skill can import a name the current SDK no longer exports and
  still compile in the starter. Removing the pin breaks those skills, and
  existing projects keep the pin because the upgrade skill bumps only
  `@iblai/iblai-js`.
- **SDK packages have dropped public exports in patch releases**, and a value →
  type-only demotion breaks a consumer the same way. Check every named import
  against the pinned version's surface (the rollup `.d.ts` export block).
- **`@iblai/data-layer` is a singleton peer**: a mismatched copy binds
  silently; pnpm only warns.
- **A plausible name may not exist**: docs have imported `useChatV2` where the
  export is `useChat`. Ask `@iblai/mcp` or read the `.d.ts`.
- **Agent tabs read `AgentSettingsProvider`** and throw outside it; a
  `mentorId` prop overrides only the agent, not the organization, the user or
  the RBAC switch.
- **RBAC**: `enableRBAC={false}` shows every control and leaves the server's
  403 as the only gate. Grant-gated components read grants either from the
  store (`state.rbac`) or from the provider's `rbacPermissions`; check which.
  `updateRbacPermissions` merges into the store, while a nested provider's
  `rbacPermissions` replaces the outer value for its subtree. `TenantProvider`
  loads organization-level grants only; per-agent grants
  (`/mentors/<agent db id>/#…`) must be loaded by the app.
- **RTK Query caches by arguments**: "this query is a cache read" holds only if
  the arguments match exactly.

## API behaviour the schema gets wrong or does not state

Each of these was once documented the other way in a skill:

- Opt-in paginated lists return `{count, next_page, previous_page, results}`
  with page numbers; the published schema says `next` / `previous`.
- The Platform API Token routes (`/api/core/platform/api-tokens/`) accept only a
  signed-in admin's session token (`Authorization: Token <dm_token>`); any
  `Api-Token` gets 401, and the schema declares no security. On create,
  `username`, `key`, `created` and `expires` are read-only; expiry is
  `expires_in`, at least one minute.
- Agent routes under `…/orgs/{org}/mentors/{uuid}/…` are also served under
  `…/agents/{uuid}/…`, the canonical spelling. Agent settings live under
  `…/orgs/{org}/users/{username}/mentors/{uuid}/settings/`, and the PUT is
  partial.
- `can_use_tools: false` clears the agent's tools; `tool_slugs: null` is a 400.
- Turning on the Grading tool creates the grader setup; POSTing a setup that
  already exists returns 400.
- A support ticket's `close/` sets only the status; `resolved_at` is never set.
- `moderation-logs/` returns Moderation System rows only; Safety System rows are
  at `safety-logs/`.
- Agent spend-cap `alert_thresholds` are fractions in (0, 1].
- A settings GET returns a defaults `call_configuration` with `id: null` when
  none was saved.
- The LTI routes serve GET and POST on the collection and GET, PUT and DELETE
  on `{id}/`; `platform_key` goes in the query on GET and DELETE and in the body
  on POST and PUT; tools require `launch_gate`.
- A Platform API Token in `token_policies` mode is refused on the Stripe
  provider routes; only `owner` mode passes.
- "Stripe Connect" names two unrelated rails, the app paywall and the item
  marketplace; the SDK's `useGetStripeConnect*` hooks are the item rail only.

## Screenshots

- Shots captured on a shared dev organization have carried an internal staging
  hostname, a backend traceback with a server path, and e2e fixtures filling a
  list. Only opening each PNG finds that.
- Captures come from a production build; `pnpm dev` burns the Next.js dev
  overlay into every frame.
- A screenshot can be a picture of a bug: RBAC on without grants silently
  empties SDK panels.
- A starter's `playwright/.auth/*.json` holds live tokens. A PR must never add
  it (a blind `git add -A` after a capture run does).

## Stacks

- Siblings can make the identical edit, which git merges silently to a wrong
  total while their real conflicts sit on other lines.
- A base PR that removes a pin or renames a route can break skills in its
  siblings; record the merge order in the base PR's comment.
- A sibling that links a skill only another sibling creates must land with or
  after it.

## Public repository

- iblai/vibe and iblai/os are public.
  Skills and comments describe the reachable HTTP surface and the published
  SDK, never a backend setting name, CLI option, file path, model, migration or
  internal host.
- In vibe prose "platform" is the whole ibl.ai system, never one customer's
  workspace. Say organization, agent and user; wire names (`tenant`, `mentor`,
  `platform_key`) appear only in backticks.
- No token, org key or email in code, docs, screenshots or the PR; use
  placeholders such as `acme` and `jane@example.com`.

## Shell and tooling

- `rg` skips `node_modules` and ignored paths, so a "not exported" search there
  is vacuous; use `rg -uu` and a positive control.
- pnpm puts a transitive dependency under
  `node_modules/.pnpm/<pkg>@<version>_<hash>/node_modules/<pkg>/`, not
  `node_modules/<pkg>/`. With `-s` or `-q`, "missing directory" and "string
  absent" print the same.
- Claude Code's shell is zsh: write `${sha}:path` (`$sha:path` triggers a
  modifier), and an unquoted `$VAR` holding a list is one word.
- `gh api --jq` takes no `--arg`; build the string outside jq.
- In JavaScript `1 << 31` is negative; use `2 ** 31` for a `maxBuffer`.
- `git merge-tree --write-tree` writes unreachable tree objects (harmless;
  `git gc` removes them).
