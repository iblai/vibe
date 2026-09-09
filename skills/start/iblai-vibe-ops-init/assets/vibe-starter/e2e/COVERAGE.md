# E2E coverage

Checkpoint-tracked journeys (see `/iblai-vibe-ops-test`). Every user-visible
surface in vibe-starter has a checkpoint; a change to a surface updates its
row. `coverage.json` is the machine-readable twin.

| # | Journey | Checkpoint | Spec |
|---|---|---|---|
| A1 | auth | authenticated user lands on the home page | `journeys/auth.journey.spec.ts` |
| A2 | auth | auth tokens are stored in localStorage | `journeys/auth.journey.spec.ts` |
| M1 | member | home shows a chat or the "No agent yet" state | `journeys/member.journey.spec.ts` |
| M2 | member | agents page lists agents | `journeys/member.journey.spec.ts` |
| M3 | member | profile carries the app preferences card | `journeys/member.journey.spec.ts` |
| M4 | member | User mode never shows admin links; /admin redirects home | `journeys/member.journey.spec.ts` |
| D1 | admin | admin links toggle with Admin mode | `journeys/admin.journey.spec.ts` |
| D2 | admin | /admin/users has Management + invite actions | `journeys/admin.journey.spec.ts` |
| D3 | admin | /admin/analytics renders the tab strip | `journeys/admin.journey.spec.ts` |
| D4 | admin | /admin/organization shows the app settings form | `journeys/admin.journey.spec.ts` |
| D5 | admin | /setup asks for the app name first | `journeys/admin.journey.spec.ts` |

Not yet covered (needs a second, non-admin test account or a fresh org):
completing `/setup` end to end, saving a preference and reading it back on a
second device, the invite email round trip.
