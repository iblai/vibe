# Testing the skills

Four tiers, cheapest first. CI (`.github/workflows/skills-ci.yml`) is **opt-in per PR: add the `run-tests` label** (tiers 0–1.5 always; the agent tier additionally only on changed skills); the live tier is weekly/manual. skills-ci is not a merge-required check.

| Tier | Command | What it proves |
|---|---|---|
| 0 | `bash scripts/validate-skills.sh` | Frontmatter/spec conformance, off-spec dirs |
| 1 | `node scripts/test-skills-render.mjs [--build]` | Skill **code** (assets + SKILL.md ts/tsx fences) typechecks against the currently-pinned SDK in vibe-starter |
| 1.5 | `node scripts/check-sdk-pins.mjs [--fix]` | No `@iblai/*` version mention drifts from vibe-starter's `package.json` |
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

## Adding a new skill

1. If it ships assets, add `skills/<name>/test.json` mapping them to app paths.
2. Keep prose fences compilable as written (imports included); purely illustrative fragments without imports are auto-skipped.
3. Run `node scripts/test-skills-render.mjs --skills <name>` and `node scripts/build-adapters.mjs` before pushing; CI enforces both.
