# E2E coverage

Checkpoint-tracked journeys (see `/iblai-vibe-ops-test`). Every user-visible
surface in vibe-starter has a checkpoint; a change to a surface updates its
row. `coverage.json` is the machine-readable twin. Member journeys (M*) sign in
as the member test account, the rest as the admin; `pnpm e2e:accounts` creates both.
The default run is Chrome desktop + a phone (the `mobile` project, a Pixel 7 viewport);
`pnpm test:e2e:all` adds Firefox and WebKit.

| # | Journey | Checkpoint | Spec |
|---|---|---|---|
| A1 | auth | authenticated user lands on the home page | `journeys/auth.journey.spec.ts` |
| A2 | auth | auth tokens are stored in localStorage | `journeys/auth.journey.spec.ts` |
| M1 | member | home shows a chat or the "No agent yet" state | `journeys/member.journey.spec.ts` |
| M2 | member | agents page lists agents | `journeys/member.journey.spec.ts` |
| M3 | member | profile carries the app preferences card | `journeys/member.journey.spec.ts` |
| M4 | member | a member never sees admin links or the Admin mode switch; /admin redirects home | `journeys/member.journey.spec.ts` |
| M5 | member | /setup tells a member only admins can set it up | `journeys/member.journey.spec.ts` |
| D1 | admin | admin links toggle with Admin mode | `journeys/admin.journey.spec.ts` |
| D2 | admin | /admin/users renders the SDK Management panel (tab strip + member table) and the invite actions | `journeys/admin.journey.spec.ts` |
| D3 | admin | /admin/analytics renders the tab strip | `journeys/admin.journey.spec.ts` |
| D4 | admin | /admin/organization shows the app settings form | `journeys/admin.journey.spec.ts` |
| D5 | admin | /setup asks for the app name first | `journeys/admin.journey.spec.ts` |
| P1 | mobile | a phone shows home, agents, profile and the admin pages without sideways overflow | `journeys/mobile.journey.spec.ts` |
| P2 | mobile | the drawer reaches Agents | `journeys/mobile.journey.spec.ts` |

Not yet covered: completing `/setup` end to end (needs a fresh org), saving a
preference and reading it back on a second device, the invite email round trip
(needs an inbox).
