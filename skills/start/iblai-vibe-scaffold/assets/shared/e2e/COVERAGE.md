# E2E coverage

Checkpoint-tracked journeys (see `/iblai-vibe-ops-test`): every page and every
user-visible surface gets a checkpoint, one Playwright test titled `<ID> · …`.
`coverage.json` is the machine-readable twin: each journey names the pages and
routes it visits. `pnpm e2e:coverage` checks the two against the specs and the
app, then approximates coverage from the journeys — an app file counts when a
journey visits a page that imports it — and fails under 95%. Add a journey for
every page you add; a page nobody visits is a gap, never an exclusion. A fresh
scaffold lists its kit files that no page imports yet (`imported by nothing`):
use them from a page or delete them.

| # | Journey | Checkpoint | Spec |
|---|---|---|---|
| — | sign-in | both accounts sign in through the login page and return by `/sso-login-complete` | `auth.setup.ts` |
| A1 | auth | authenticated user lands on the home page | `journeys/auth.journey.spec.ts` |
| A2 | auth | auth tokens are stored in localStorage | `journeys/auth.journey.spec.ts` |
| P1 | mobile | a phone shows home without sideways overflow | `journeys/mobile.journey.spec.ts` |
