# E2E coverage

Checkpoint-tracked journeys (see `/iblai-vibe-ops-test`): every page, every API
route and every user-visible surface has a checkpoint, one Playwright test titled
`<ID> · …`. `coverage.json` is the machine-readable twin: each journey names the
pages and routes it visits. `pnpm e2e:coverage` checks the two against the specs
and the app, then approximates coverage from the journeys — an app file counts
when a journey visits a page that imports it — and fails under 95%. Not counted:
`components/ui/**` (shadcn primitives, reached through the components that use
them). Member journeys (M*) sign in as the member test account, the rest as the
admin; `pnpm e2e:accounts` creates both, and `pnpm test:e2e` creates them itself
when they are missing. The default run is Chrome desktop + a phone (the `mobile`
project, a Pixel 7 viewport); `pnpm test:e2e:all` adds Firefox and WebKit.

| # | Journey | Checkpoint | Spec |
|---|---|---|---|
| — | sign-in | both accounts sign in through the login page and return by `/sso-login-complete` | `auth.setup.ts` |
| A1 | auth | authenticated user lands on the home page | `journeys/auth.journey.spec.ts` |
| A2 | auth | auth tokens are stored in localStorage | `journeys/auth.journey.spec.ts` |
| M1 | member | home shows a chat or the "No agent yet" state, never a crash | `journeys/member.journey.spec.ts` |
| M2 | member | the agents page lists agents | `journeys/member.journey.spec.ts` |
| M3 | member | the profile page carries the app preferences card | `journeys/member.journey.spec.ts` |
| M4 | member | a member never sees admin links or the Admin mode switch; /admin/users sends them home | `journeys/member.journey.spec.ts` |
| M5 | member | /setup tells a member only admins can set it up | `journeys/member.journey.spec.ts` |
| D1 | admin | admin links appear in Admin mode and disappear in User mode | `journeys/admin.journey.spec.ts` |
| D2 | admin | /admin/users hosts the Management surface and the invite actions | `journeys/admin.journey.spec.ts` |
| D3 | admin | /admin/analytics renders the tab strip | `journeys/admin.journey.spec.ts` |
| D4 | admin | /admin/organization shows the app settings form | `journeys/admin.journey.spec.ts` |
| D5 | admin | /setup asks for the app name first | `journeys/admin.journey.spec.ts` |
| K1 | pages | /account shows the organization settings | `journeys/pages.journey.spec.ts` |
| K2 | pages | /notifications shows the notification center | `journeys/pages.journey.spec.ts` |
| K3 | pages | /admin/analytics/users opens inside the analytics tab strip | `journeys/pages.journey.spec.ts` |
| K4 | pages | /admin/analytics/topics opens inside the analytics tab strip | `journeys/pages.journey.spec.ts` |
| K5 | pages | /admin/analytics/transcripts opens inside the analytics tab strip | `journeys/pages.journey.spec.ts` |
| K6 | pages | /admin/analytics/financial opens inside the analytics tab strip | `journeys/pages.journey.spec.ts` |
| K7 | pages | /admin/analytics/reports opens inside the analytics tab strip | `journeys/pages.journey.spec.ts` |
| K8 | pages | /admin/billing mounts the account panel | `journeys/pages.journey.spec.ts` |
| K9 | pages | /admin/memory shows the memory panel | `journeys/pages.journey.spec.ts` |
| R1 | api | the admin lists the agents through /api/admin/agents | `journeys/api.journey.spec.ts` |
| R2 | api | creating an agent without a name is refused with 400 | `journeys/api.journey.spec.ts` |
| R3 | api | the admin reads a member's metadata through /api/admin/user-metadata | `journeys/api.journey.spec.ts` |
| R4 | api | reading metadata without a username is refused with 400 | `journeys/api.journey.spec.ts` |
| R5 | api | a member is refused with 403 | `journeys/api.journey.spec.ts` |
| P1 | mobile | a phone shows every page without sideways overflow | `journeys/mobile.journey.spec.ts` |
| P2 | mobile | the drawer reaches Agents | `journeys/mobile.journey.spec.ts` |

Not covered yet: the Billing tab itself (the SDK shows Plan & Credits only to an
organization with billing enabled; elsewhere `/admin/billing` opens on
Organization), the navbar's own controls (bell, profile menu, the drawer's
Escape), saving a preference and reading it back, the org settings form's save
(an org-wide write — intercept the PUT with `page.route` when you add it), error
states (`page.route` answering 500), the locale switch, creating an agent on
`/setup` end to end (a real agent to delete afterwards), sign-out (it would end
the shared session), and the invite email round trip (needs an inbox).
