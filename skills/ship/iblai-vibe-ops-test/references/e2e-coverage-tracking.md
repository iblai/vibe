# E2E Coverage Tracking (`COVERAGE.md` + `coverage.json`)

E2E test coverage isn't lines-of-code — it's **user behaviours**.
Mentorai tracks every user-visible behaviour as a "checkpoint" in two
sibling files inside `e2e/`:

- **`COVERAGE.md`** — human-readable journey-by-journey checklist with
  `[x]` / `[ ]` markers
- **`coverage.json`** — machine-readable counts + journey index +
  per-checkpoint status (used by CI gates and the coverage bot)

Coverage = `covered_checkpoints / total_checkpoints * 100`. The goal
is **100%** before merging changes to user-facing flows.

## When to add a checkpoint

Whenever you ship a new page, dialog, button, form field, or distinct
user flow:

1. Add one bullet to the relevant journey in `COVERAGE.md` (or create a
   new journey).
2. Add the same entry to `coverage.json` with `status: "uncovered"`.
3. Write the Playwright spec that exercises it.
4. Flip the bullet to `[x]` and the JSON `status` to `"covered"` once
   the test lands and passes.

If a journey is removed (feature deleted), mark its checkpoints
`status: "deprecated"` with a reason — don't delete the entries. CI
counts deprecated checkpoints separately so historical coverage
doesn't silently regress.

## `e2e/COVERAGE.md` — template

```markdown
# <App Name> E2E Coverage — User Journey Checklist

> Last updated: YYYY-MM-DD | <N> checkpoints (<active> active, <dep> deprecated) | <J> journeys | <pct>% covered

## How This Works

Each **checkpoint** maps to a concrete user action or verification within a spec file.
Coverage = `covered_checkpoints / total_checkpoints * 100`.

When adding a new page or modifying an existing user flow:

1. Add checkpoints to the relevant journey below (or create a new journey)
2. Write Playwright tests for each checkpoint
3. Mark the checkpoint `[x]` once the test is in the suite and passing
4. The pre-push hook and CI workflow block pushes with uncovered routes

---

## Journey 1: Authentication (N checkpoints) — `journeys/01-authentication.spec.ts`

**Source files:** `app/sso-login/page.tsx`, `app/sso-login-complete/page.tsx`

- [x] Unauthenticated user can sign in via SSO
- [x] User with invalid credentials sees an error message
- [ ] User can reset password via the forgot-password flow

---

## Journey 2: Home & Navigation (N checkpoints) — `journeys/02-home-navigation.spec.ts`

**Source files:** `app/page.tsx`, `components/sidebar.tsx`, `components/navbar.tsx`

- [x] Home page renders without JS error overlay
- [x] Sidebar collapses and expands
- [x] Each top-level nav link routes to the right page
```

The header summary line is updated every time `coverage.json` changes
(via the bot or by hand).

## `e2e/coverage.json` — template

```json
{
  "version": 2,
  "lastUpdated": "YYYY-MM-DD",
  "summary": {
    "totalCheckpoints": 0,
    "coveredCheckpoints": 0,
    "deprecatedCheckpoints": 0,
    "percent": 0,
    "totalJourneys": 0,
    "activeJourneys": 0
  },
  "journeys": [
    {
      "id": "authentication",
      "name": "Authentication",
      "spec": "01-authentication.spec.ts",
      "sourceFiles": [
        "app/sso-login/page.tsx",
        "app/sso-login-complete/page.tsx"
      ],
      "checkpoints": [
        {
          "id": "auth-01",
          "description": "Unauthenticated user can sign in via SSO",
          "status": "covered"
        },
        {
          "id": "auth-02",
          "description": "User with invalid credentials sees an error message",
          "status": "covered"
        },
        {
          "id": "auth-03",
          "description": "User can reset password via the forgot-password flow",
          "status": "uncovered"
        }
      ]
    },
    {
      "id": "home-navigation",
      "name": "Home & Navigation",
      "spec": "02-home-navigation.spec.ts",
      "sourceFiles": [
        "app/page.tsx",
        "components/sidebar.tsx",
        "components/navbar.tsx"
      ],
      "checkpoints": [
        {
          "id": "nav-01",
          "description": "Home page renders without JS error overlay",
          "status": "covered"
        },
        {
          "id": "nav-02",
          "description": "Sidebar collapses and expands",
          "status": "covered"
        },
        {
          "id": "nav-03",
          "description": "Each top-level nav link routes to the right page",
          "status": "covered"
        }
      ]
    }
  ]
}
```

### Checkpoint statuses

| Status | Meaning |
|--------|---------|
| `covered` | Spec exists and passes against this checkpoint |
| `uncovered` | Behaviour exists in the app but has no spec yet — must be `0` before merging user-facing changes |
| `deprecated` | The flow itself was removed. Keep the entry with a reason in `description` so historical coverage doesn't silently jump |

### Computing the summary

```javascript
const total      = journeys.flatMap(j => j.checkpoints).length
const deprecated = journeys.flatMap(j => j.checkpoints).filter(c => c.status === 'deprecated').length
const covered    = journeys.flatMap(j => j.checkpoints).filter(c => c.status === 'covered').length
const active     = total - deprecated
const percent    = Math.round((covered / active) * 100)
```

## Wiring + enforcement (optional)

Mentorai gates pushes with two scripts:

| Hook | Script | Effect |
|------|--------|--------|
| `pre-push` (husky) | `node e2e/scripts/check-journey-coverage.mjs --no-regress` | Fails the push if coverage % dropped vs the last commit |
| GitHub Actions | `.github/workflows/e2e-coverage-bot.yml` | A bot account auto-updates `COVERAGE.md` / `coverage.json` on every PR; required-reviewer protects `main` |

Both are optional. The minimum useful pattern is:

1. Maintain `COVERAGE.md` + `coverage.json` by hand.
2. Read `coverage.json` in a CI step and fail if `summary.percent < 95`
   (or whatever threshold you set).

### Minimum CI gate (no bot)

```yaml
# .github/workflows/e2e-coverage.yml
name: E2E Coverage
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Enforce 95% e2e checkpoint coverage
        run: |
          PERCENT=$(jq '.summary.percent' e2e/coverage.json)
          if [ "$PERCENT" -lt 95 ]; then
            echo "E2E coverage $PERCENT% < 95% threshold"
            exit 1
          fi
          echo "E2E coverage $PERCENT% ✓"
```

## Why both formats?

- `COVERAGE.md` is for **humans** — the PR reviewer skims it to confirm
  the new feature's user flow was added, and that `[ ]` items got
  flipped to `[x]`.
- `coverage.json` is for **machines** — CI gates and the coverage bot
  read it to compute the percentage and to enforce no-regression.

Keep them in sync manually (or via the bot). The summary header in
`COVERAGE.md` should always match `coverage.json#/summary`.
