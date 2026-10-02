---
name: iblai-vibe-pr-review
description: Review or re-review a pull request on the iblai/vibe repo (or a stack of them) the way the maintainers do — replay the CI gates an unlabelled PR skips, prove each gate can fail, check every claim against the pinned SDK, the live API schema and real API behaviour, open every screenshot, and draft one comment per PR that ends in a verdict. Use when asked to review, re-review, check, or approve a vibe PR. Maintainers only, not shipped to builders; for the traps behind each step see references/known-traps.md.
metadata:
  internal: true
  kind: ops
---

# /iblai-vibe-pr-review

Review a pull request on iblai/vibe, or a stack of them, and draft one comment
per PR that ends in a verdict. This skill is for maintainers of this
repository: it is a real directory in `.claude/skills/` (the other entries there
link into `skills/`), it is marked `metadata.internal`, and it is not in the
catalogue, so builders who install vibe never receive it.

Read [references/known-traps.md](references/known-traps.md) once before your
first review: every step below exists because one of those traps was hit.

## Ground rules

- **Read, never write.** Do not push to the author's branch or edit their
  files. Draft the comments, show them, and post only when the person who asked
  for the review says so.
- **This repository is public.** A comment never carries a token, an org key,
  an email, an internal hostname, or a file path or class name from a private
  repository. Cite SDK behaviour by published package, version and export, and
  backend behaviour by route, status code and error text. Permalinks into this
  repository or iblai/os at a commit SHA are fine.
- **Prove before you report.** A check whose failure looks the same as its
  negative result is not a check. Before writing "X is absent", "never called"
  or "not exported", show that the place you searched exists and that the same
  search finds something you know is there.
- **Verify every mechanism**, including a sub-agent's or another reviewer's:
  the diagnosis must be able to produce the failure it claims, and the
  suggested fix must change the outcome.
- **Every review ends with a verdict**: a final `## Verdict` saying
  **Approved** (no blocking defect; a merge prerequisite is a caveat under the
  verdict, not a reason to withhold it) or **Changes requested** (naming the
  blocking items and nothing else). Say so plainly when it is a self-review,
  and that it does not replace another maintainer's.

## Step 1: Scope

```bash
gh pr view <n> -R iblai/vibe \
  --json number,title,author,baseRefName,headRefName,headRefOid,labels,isDraft,files
gh pr list -R iblai/vibe --author <login> --state open \
  --json number,title,baseRefName,headRefOid,updatedAt
```

- **A stack** is a set of PRs whose base is another PR's branch. Review the
  base first: everything reaches `main` through it. Notes about merge order and
  conflicts go in the base PR's comment; siblings point to it.
- **A re-review** starts from your last comment and the head it reviewed:
  `gh api repos/iblai/vibe/compare/<old-head>...<new-head>` shows only the new
  commits, and every prior item gets a line saying whether and how it was fixed.
- **The SDK version under review** is the one vibe-starter pins:
  `skills/start/iblai-vibe-ops-init/assets/vibe-starter/package.json` at the PR
  head. Check its `pnpm-workspace.yaml` for `overrides:` too: an override can
  pin a package below what `@iblai/iblai-js` would resolve.

## Step 2: Get the heads without touching your checkout

```bash
git fetch --no-write-fetch-head origin refs/pull/<n>/head   # objects only: no ref, no FETCH_HEAD
git worktree add --detach /tmp/vibe-pr-<n> <head-sha>        # a scratch tree for the gates
# … Steps 3 to 5 …
git worktree remove --force /tmp/vibe-pr-<n>
```

In plan mode, ask before creating the scratch tree; `gh pr diff <n>` is enough
for a first read.

## Step 3: Run the gates CI skipped

`skills-ci` runs only on PRs labelled `run-tests`. On an unlabelled PR every
job reports *skipped* and the PR page still looks green:

```bash
gh api repos/iblai/vibe/commits/<head-sha>/check-runs \
  --jq '.check_runs[] | "\(.name)=\(.conclusion // .status)"'
```

Ask a maintainer to add the label, or run the deterministic job yourself in
the scratch tree. `.github/workflows/skills-ci.yml` is the source of truth if
this list drifts:

```bash
cd /tmp/vibe-pr-<n>
bash scripts/validate-skills.sh
node scripts/check-sdk-pins.mjs
node scripts/check-links.mjs                 # network; compare a red with main
node scripts/check-endpoint-schema.mjs       # downloads the live schema: minutes
node scripts/check-skill-tables.mjs
node scripts/check-skill-kinds.mjs
node scripts/test-skills-compose.mjs
node scripts/build-adapters.mjs && git status --short adapters/            # must print nothing
node scripts/build-catalogue.mjs && git diff --exit-code docs/catalogue.md  # no CI gate runs this
# These install vibe-starter's dependencies; run them when the PR touches skill code or the starter:
node scripts/test-skills-render.mjs --skills <touched>   # add --build if vibe-starter changed
node scripts/test-skills-boot.mjs
```

Compare every red result with the same command on `main` before blaming the
PR, and say in the comment what you did not run.

**Prove each gate can fail.** Plant one fault per gate in the scratch tree,
watch the gate go red, then `git checkout -- . && git clean -fd`:

| Gate | Plant | Expect |
|---|---|---|
| adapters, catalogue | change a touched skill's `description:` | two stale adapters and a catalogue diff |
| `validate-skills.sh` | delete a skill's `name:` line | missing name |
| `check-skill-kinds.mjs` | `kind: banana` | unknown kind |
| `check-skill-tables.mjs` | raise a `README.md` folder-table count by one | the row disagrees with `skills/` |
| `check-sdk-pins.mjs` | `pnpm add @iblai/iblai-js@^0.0.1` in a fence | pin drift |
| `check-endpoint-schema.mjs` | a curl to `https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/bogus/` in a **`kind: api`** skill | path not in schema |

**A stack** also needs the pairwise conflict matrix against the base PR's head:

```bash
git merge-tree --write-tree --name-only --merge-base=<base-head> <head-a> <head-b>   # exit 1 = conflict
```

Then reason about identical edits, which git merges silently: two siblings
that each raise the same count by one land one short. Conflicts in generated
files (`adapters/`, `docs/catalogue.md`) are resolved by regenerating.

## Step 4: Check every claim

The gates check shape, not truth. Read every changed `SKILL.md` and test what
it says:

- **SDK names.** Every `@iblai/iblai-js/*` import, prop and type exists in the
  pinned version. Ask the `@iblai/mcp` server (`get_component_info`,
  `get_api_query_info`, `get_hook_info`) or read the installed `.d.ts` under
  `node_modules/.pnpm/@iblai+*/…` (`rg -uu`: `rg` skips `node_modules`). Follow
  an export to the package entry, not to a folder index. The `.d.ts` can lag
  the bundle.
- **Providers and grants.** A component that reads a context throws, or
  renders nothing, outside its provider. A component gated on per-agent RBAC
  grants shows nothing until the app loads them. Check the skill says where
  both come from in vibe-starter.
- **Endpoints.** `check-endpoint-schema.mjs` reads only literal
  `https://api.iblai.app/dm/…` URLs in `kind: api` skills. Check `ui` skills'
  "How it saves" tables and every relative path by hand against the live
  schema (`https://api.iblai.app/dm/api/docs/schema/?format=json`; its
  `info.version` is what production runs).
- **Behaviour.** The schema says nothing about side effects, defaults, ignored
  fields or who may call a route, and it is wrong in places (see
  `references/known-traps.md`). Prefer, in order: the SDK's types, the backend
  source if you can read it, a call against a demo organization. A "Verified
  against the live schema" line inside a skill goes stale and proves nothing
  about behaviour; ask for it in the PR body instead.
- **vibe-starter and OS claims.** "The starter's chat page has X": read that
  file at the PR head. "The OS mounts it the same way": read iblai/os `main`,
  and check whether the OS change is still an open PR.
- **Inherited lines.** A PR that stamps a file "Verified", or makes it another
  skill's twin, owns the errors already in it.

For a stack of more than three PRs, give each PR (or slice) to a sub-agent
with this skill, then verify every finding yourself before it goes in a
comment.

## Step 5: Open every screenshot

The gates check names, sizes and references, never pixels:

```bash
head=<head-sha> base=<base-head> out=/tmp/vibe-pr-<n>-shots
mkdir -p "$out"
for p in $(git diff --name-only --diff-filter=AM "$base...$head" -- '*.png'); do
  git show "${head}:${p}" > "$out/${p##*/}"
done
```

Open each one and look for: internal hostnames (link targets, endpoint lists,
address bars), stack traces or server paths, test fixtures (`e2e-*`,
`pagination-test-*`, keyboard-mash names), real emails or names, tokens or org
keys, the Next.js dev overlay (captures come from `pnpm build && pnpm start`),
and empty or clipped panels: an empty SDK panel is often a missing-grants bug,
not a quiet organization. Conventions: `docs/screenshots/README.md`. A deleted
or renamed PNG breaks installed copies of the released skill text, which link
through `refs/heads/main`; ask to keep the old file for a release.

## Step 6: Draft the comments

One comment per PR, short:

```markdown
Review against `@iblai/iblai-js` <version> (web-containers <version>), the production backend and its live OpenAPI schema (<info.version>). CI skipped every job (no `run-tests` label), so I ran the deterministic gates on this head: <list> pass, each proven to fail on a planted fault. Not run: <list>. All new screenshots viewed.

## Blocking

- [`SKILL.md:40-50`](<permalink at the head SHA>): what is wrong, what happens to a reader who follows it (input → wrong result), the fix in a clause.

## Should fix

## Nits

## Verdict

**Changes requested.** Blocking: <the blocking items, one line>.
```

- **Blocking** means a reader who follows the skill gets a broken build, a
  failing call, a leak, or a broken install. Everything else is should-fix or
  a nit.
- Each finding names its line and a failure scenario.
- A **re-review** comment is `## Resolved` (each prior item, where it is fixed,
  how you checked), `## Nits` (new ones only) and `## Verdict`.

Post when asked, with a quoted heredoc so `$VARS` and backticks survive, then
hand back the URLs:

```bash
gh pr comment <n> -R iblai/vibe --body-file - <<'EOF'
…
EOF
gh api "repos/iblai/vibe/issues/<n>/comments?per_page=100" --jq '.[-1].html_url'
```
