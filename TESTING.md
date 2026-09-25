# Testing the skills

Four tiers, cheapest first. CI (`.github/workflows/skills-ci.yml`) is **opt-in per PR: add the `run-tests` label** (tiers 0–1.5 always; the agent tier additionally only on changed skills); the live tier is weekly/manual. skills-ci is not a merge-required check.

| Tier | Command | What it proves |
|---|---|---|
| 0 | `bash scripts/validate-skills.sh` | Frontmatter/spec conformance, off-spec dirs |
| 1 | `node scripts/test-skills-render.mjs [--build]` | Skill **code** (assets + SKILL.md ts/tsx fences) typechecks against the currently-pinned SDK in vibe-starter |
| 1.5 | `node scripts/check-sdk-pins.mjs [--fix]` | No `@iblai/*` version mention drifts from vibe-starter's `package.json` |
| 1.5 | `node scripts/check-links.mjs` | Every `github.com/iblai/...` / raw cross-repo link still resolves (404/410 fail; transient trouble warns) |
| 1.5 | `node scripts/check-skill-kinds.mjs` | Every skill declares `metadata.kind` (`ui`/`api`/`guide`/`ops`/`security`) and it agrees with its name prefix |
| 1.5 | `node scripts/build-catalogue.mjs` + `node scripts/check-skill-tables.mjs` | `docs/catalogue.md` is regenerated from frontmatter; every skill is in CLAUDE.md's tier table and the catalogue, and nothing named there is missing |
| 2 | `scripts/test-skills-agent.sh <skill>… \| --changed` | A headless Claude agent following the SKILL.md actually produces an app that typechecks and builds |
| 3 | `RUN_LIVE=1 scripts/test-skills-agent.sh …` | The built app performs a real SSO login against a live tenant |

## Tier 1 — deterministic render + typecheck

`scripts/test-skills-render.mjs` copies vibe-starter into `.skill-tests/` (node_modules symlinked locally, installed in CI) and typechecks two code sources:

1. **Assets** declared in `skills/<name>/test.json`:
   ```json
   {
     "vars": { "app_name": "…" },              // minimal-Jinja vars ({{ var }}, {% if %}, {% raw %}, {{ '{{' }})
     "overlay": { "assets/x.tsx.j2": "app/x.tsx" },  // rendered into the scratch app, then pnpm typecheck
     "render_only": ["assets/package.json.j2"],      // must render clean; .json must parse
     "assert_files": ["app/x.tsx"]             // used by the agent tier
   }
   ```
   Skills without a `test.json` are skipped by this source. `iblai-vibe-ops-init` is special-cased: vibe-starter itself gets `typecheck` + `test` (+ `build` with `--build`).

2. **SKILL.md prose fences** (` ```tsx/ts/typescript `): each fence lands in the scratch app (at the backticked path named just above it, else as an anonymous snippet) and the whole set is typechecked once. A **self-repair pass** removes *context* noise so only genuine drift fails: undeclared surrounding variables get `declare const x: any`, third-party modules the starter doesn't ship get module stubs, parse-broken anonymous fragments are dropped, and implicit-any nits are downgraded to warnings. **`@iblai/*` imports are never stubbed — a bad SDK import in prose is exactly the drift this exists to catch.**

   False positives go in `scripts/skill-render-skips.json` with a reason; every entry is untested prose, so keep it short. Current entries mostly document **SDK v2 `.d.ts` gaps** (components/hooks present in `dist/*.js` but missing from typings) — unskip them when the SDK ships the types.

## Tier 1.5 — pin drift

`scripts/check-sdk-pins.mjs` scans `skills/**` for `@iblai/<pkg>` version mentions in JSON deps, `pnpm add` lines, and markdown tables. Rules: packages in vibe-starter must match its major+minor; retired v1 packages (`@iblai/web-containers`, `@iblai/web-utils`, `@iblai/data-layer`, `@iblai/iblai-api`) must not appear with versions at all; anything else must be registered in the script's `EXPECTED` map. vibe-starter's `package.json` is the single source of truth — bump it first, mentions follow. `--fix` rewrites drifted mentions of starter-shipped packages to the starter's exact range in place, then re-checks (retired/unknown-package violations are never auto-fixed); the nightly `sdk-auto-update` workflow runs it on every run, so templates and SKILL.md pins follow a starter bump automatically.

## Tier 1.8 — composition (overlay clobbers)

`scripts/test-skills-compose.mjs` catches the one composition conflict that is deterministic: an **overlay clobber** — two skills (or one skill twice) writing the same destination file, where the last write silently wins and the other is lost. The render tier tests each skill in its own scratch and so can never see this. Deterministic, **no LLM, no build**. It does NOT attempt a semantic "do the skills work together" build — most skills wire themselves through SKILL.md prose (editing `providers/index.tsx`, …) rather than machine-applicable overlays, so true composition needs the agent tier; this is the file-level half. Intended overrides (a feature skill's real implementation replacing a scaffold stub) are registered in `scripts/overlay-clobber-allow.json` with a `reason`; anything else fails, so a newly-added skill that silently overwrites another skill's file is caught.
## Tier 1.7 — app boot smoke

`scripts/test-skills-boot.mjs` proves the scaffolded app actually **renders**, not just typechecks — catching "compiles but the page is blank / crashes on mount" (a broken provider, layout, or hook) that `tsc` can't see. Deterministic, **no LLM, no secrets**. It builds vibe-starter in a scratch (same approach as the render tier), boots `next start` via Playwright's `webServer`, loads an **unauthenticated** route (`/setup` — the app mounts its React tree client-side before any auth redirect, since middleware is CSP-only), and asserts the tree mounted with no *render-breaking* errors. It ignores expected unauthenticated noise (network failures, 401s, CSP reports) and fails only on real render breakage — `Minified React error`, `Hydration failed`, `Element type is invalid`, `Cannot read properties of undefined`, hook-order violations, etc. (`scripts/boot-smoke/smoke.spec.ts`). Scope (v1): the base scaffold; per-skill boot is a heavier follow-up.
## Tier 1.6 — endpoint & field schema drift

`scripts/check-endpoint-schema.mjs` guards `iblai-api-*` skills against documenting an endpoint the backend renamed/removed, or a request field it no longer accepts — the "skill says a path/field the API no longer serves" drift that silently 404s or no-ops a headless integration. Deterministic, **no LLM**. It fetches the live OpenAPI schema (`api.iblai.app/dm/api/docs/schema/`, override with `IBLAI_SCHEMA_FILE=` for offline/CI). Two passes:

- **Endpoints:** extract every callable `https://api.iblai.app/dm/...` URL a skill documents (those carrying a method — a bold `**VERB**`, a curl, or `-X`) and match each path **structurally** against the schema — a schema `{param}` absorbs any skill segment (`{param}`, `$SHELL_VAR`, or example value), while literal segments (`documents`, `train`) must match, so a renamed resource fails and param spelling never false-positives.
- **Fields:** pair each write endpoint (POST/PUT/PATCH) with the `json` request-body block that follows it, and check its top-level fields against the schema operation's `requestBody` (following `$ref`/`allOf`). Skips bodies whose schema allows `additionalProperties` or can't be resolved — never guesses. Catches the `mentor_name → agent_name` class the endpoint pass can't see.

Scope (v1): `/dm` REST only (not `/edx` or the asgi streaming host); request bodies, not response shapes. Known exceptions live in `scripts/endpoint-schema-allow.json` (paths) and `scripts/field-schema-allow.json` (fields), each with a `reason` — a permanent "schema gap" (real, absent from the published schema) or a temporary "drift" marker (skill wrong, remove once fixed). The same check runs nightly via `.github/workflows/schema-drift.yml`, which opens a GitHub issue on drift — so a backend change is caught within ~24h even with no open PR, then flows to installed skills through the fix → release → re-sync path.

## Tier 2 — agent-executed skills

`scripts/test-skills-agent.sh` builds a scratch vibe-starter per skill, copies `skills/` into the scratch `.claude/skills/` for discovery, runs `claude -p` headless (`MAX_TURNS`, `AGENT_TIMEOUT` env-tunable), then requires `pnpm typecheck && pnpm build` plus the manifest's `assert_files`. Locally it uses your logged-in `claude`; in CI it needs the `ANTHROPIC_API_KEY` secret and runs **only the skills the PR touches** (fork PRs skip with a notice — deterministic tiers still gate).

**The agent never sees real credentials** — scratch apps get dummy `.env.local`/`iblai.env` values only.

## Tier 3 — live platform

`RUN_LIVE=1` starts the built scratch app and drives vibe-starter's Playwright SSO setup (`e2e/auth.setup.ts`) against a real tenant.

Local env: `AUTH_HOST`, `PLAYWRIGHT_USERNAME`, `PLAYWRIGHT_PASSWORD`, `IBLAI_TEST_TENANT_KEY`, `IBLAI_TEST_API_KEY`.

CI (`live` job: weekly + `workflow_dispatch`): repo **secrets** `ANTHROPIC_API_KEY`, `IBLAI_TEST_USERNAME`, `IBLAI_TEST_PASSWORD`, `IBLAI_TEST_API_KEY`; repo **variables** (semi-public, deliberately unmasked) `IBLAI_TEST_TENANT_KEY`, `IBLAI_TEST_AGENT_ID`, `IBLAI_TEST_AUTH_HOST`. The job agent-builds auth → navbar → agent-chat, then logs in for real. Skips cleanly when secrets are absent.

### Log hygiene invariants (CI logs are public — the harness enforces these in code)

- Secrets enter only as `${{ secrets.* }}` (auto-masked); never transformed in shell (base64/URL-encode/substring defeats masking); short semi-public config lives in repo *variables* so masking isn't diluted.
- The agent tier runs on dummy credentials only; real secrets exist only in the live step's process env, after the agent has exited.
- Playwright: `--reporter=dot --trace=off`, failure details go to a file (`.live.log`) — never the console, because SSO redirect URLs can carry authorization codes.
- Server output (`pnpm start`) goes to `.server.log`, never the console.
- No artifact uploads from the live job (storage state under `e2e/.auth/` holds session cookies).
- No `set -x` in any harness script.

## Tier 4 — selection eval (local, subscription)

`scripts/eval-skill-selection.mjs` checks that the model picks the **right** skill for a build goal — picking the wrong one builds the wrong thing (it compiles and runs, it's just not what was asked). This is the one reliability check that genuinely needs a model: a fixed rule can't judge that *"charge users to enter my app"* means the app paywall and not credits.

Because it's model-driven (token cost, non-deterministic), it is **not** wired into blocking per-PR CI. Run it locally on a Claude subscription:

```bash
node scripts/eval-skill-selection.mjs         # shells out to `claude -p`
SKILL_EVAL_CMD='<cmd>' node scripts/eval-skill-selection.mjs   # any model, or a stub
```

The command receives the prompt (catalogue + goal) on stdin and prints a JSON array of skill names. Fixtures live in `scripts/skill-eval/fixtures.json`: each case has a goal, `expectAny` (pass if at least one is picked — tolerates equivalent choices) and `forbid` (fail if a wrong-neighbour is picked). A preflight fails if any fixture names a skill that no longer exists, so fixtures can't rot. Add a case whenever two skills are easy to confuse.

## Layout

`skills/<folder>/<name>/SKILL.md` — nine folders (`scripts/skill-categories.json`). `scripts/lib/skills.mjs` is the one discovery helper every script uses; `.claude/skills/` holds per-skill symlinks so local Claude Code sessions see the flat names.

## Adding a new skill

1. Put it in the right folder and in `scripts/skill-categories.json` (see CONTRIBUTING.md). If it ships assets, add `skills/<folder>/<name>/test.json` mapping them to app paths.
2. Keep prose fences compilable as written (imports included); purely illustrative fragments without imports are auto-skipped.
3. Run `node scripts/test-skills-render.mjs --skills <name>` and `node scripts/build-adapters.mjs` before pushing; CI enforces both.

## Screenshots

`scripts/capture-screenshots.mjs` walks a running vibe-starter (real SSO via
`e2e/auth.setup.ts`) and writes the journey set + per-skill PNGs listed in
`docs/screenshots/README.md`. Sanitize and compress before committing.

## The user test

Before a Tier 0/1 change merges, someone runs the 20-minute test in
`docs/user-first-plan.md` §6 (a bare `ibl.ai/join` account → a deployed app
with users, admins, custom data, and a chat) or the agent tier with the
persona prompt in `scripts/test-skills-agent.sh`, and attaches the screenshot.
