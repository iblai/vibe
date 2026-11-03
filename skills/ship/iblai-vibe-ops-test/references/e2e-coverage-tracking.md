# E2E coverage: the ledger and `pnpm e2e:coverage`

E2E coverage is not measured by instrumenting the browser. Two files in `e2e/`
record what the journeys cover, and one script checks them against the specs
and the app, then approximates coverage from the pages the journeys visit.

- **`coverage.json`** — the ledger, for machines: each journey, its spec, the
  pages and API routes it visits, its checkpoints.
- **`COVERAGE.md`** — the same for people: one row per checkpoint, plus what is
  not covered and why.
- **`coverage.mjs`** — `pnpm e2e:coverage`: the checks below, the number, the
  gaps. Node 22, no dependencies; vibe-starter ships it — copy the file into any
  app and add `"e2e:coverage": "node e2e/coverage.mjs"` to `package.json`.

## The ledger

```json
{
  "version": 2,
  "summary": { "totalCheckpoints": 28, "totalJourneys": 7 },
  "journeys": [
    { "id": "sign-in", "spec": "auth.setup.ts", "sourceFiles": ["app/sso-login-complete/page.tsx"], "checkpoints": [] },
    {
      "id": "pages",
      "spec": "journeys/pages.journey.spec.ts",
      "sourceFiles": ["app/(app)/account/page.tsx", "app/(app)/admin/billing/page.tsx"],
      "checkpoints": [
        { "id": "K1", "name": "/account shows the organization settings" },
        { "id": "K8", "name": "/admin/billing shows Plan & Credits" }
      ]
    }
  ]
}
```

- A checkpoint is one Playwright test titled `'<ID> · <name>'` — `test(`,
  `test.fixme(` or `test.skip(` — in the journey's spec. Ids are unique across
  the ledger (`A1`, `M4`, `K3`, `R2`, `P1`).
- `sourceFiles` holds only pages (`app/**/page.tsx`) and API routes
  (`app/**/route.ts`): what the journey visits. Components, hooks and lib files
  are never listed — the script finds them through the pages' imports.
- The sign-in setup (`auth.setup.ts`) is a journey with no checkpoints: it is
  how the SSO landing page gets visited.
- `summary` is what the journeys add up to; the script recomputes it.

`COVERAGE.md` keeps one table row per checkpoint (`| K1 | pages | … | spec |`)
and a "Not covered" paragraph naming what is left out and why (sign-out would
end the shared session; an invite needs an inbox).

## What `pnpm e2e:coverage` checks

1. Every `e2e/journeys/*.spec.ts` is a journey, and every journey's spec exists.
2. Every checkpoint id heads exactly one test title in its spec, and every
   titled test is in the ledger.
3. `summary` equals the recomputed counts.
4. Every `sourceFiles` entry exists, is a page or route, and its path appears in
   the spec (`'/admin/users'`, `` `${appHost}/setup` ``, `'/api/admin/agents'`;
   a `[x]` or `[[...x]]` segment cuts the path to its static prefix).
5. Every `page.tsx` and `route.ts` under `app/` is visited by some journey.
6. Every checkpoint id appears in `COVERAGE.md`.

## The number

App files are the `.ts`/`.tsx` under `app/`, `components/`, `hooks/`, `lib/`,
`providers/`, `store/` and `i18n/`, plus `middleware.ts`/`proxy.ts`/
`instrumentation.ts`; not `components/ui/**` (shadcn primitives), `*.d.ts` or
tests. From every visited page and route — with the `layout`, `template`,
`loading`, `error` and `not-found` files around it and the always-loaded
`middleware.ts` and `i18n/request.ts` — the script follows `@/` and relative
imports; every file it reaches counts as exercised. Coverage = reached lines ÷
app lines, threshold 95%, and the suite must hold at least six checkpoints per
1,000 app lines (the OS runs 8.9, sis and crm 6 to 7). It is an approximation: a file counts when a journey
visits a page that imports it, whether or not a test clicked the control that
renders it — that is what the checkpoints are for.

```
e2e coverage · 7 journeys · 28 checkpoints (9.0 per 1,000 app lines, floor 6) · 19/19 pages and routes visited
  app files reached 51/51 · lines 3124/3124 · 100.0% (threshold 95)
  approximate: a file counts when a journey visits a page that imports it (components/ui/** not counted)
```

Under the threshold it lists each unreached file with its line count and why
— `no journey visits /account`, `imported by app/(app)/account/page.tsx — no
journey visits /account`, `imported by nothing` (dead code: use it or delete
it) — and exits 1. A page nobody visits is a gap, never an exclusion: add the
journey.

## How the OS, sis and crm do it

The OS (`e2e/scripts/check-journey-coverage.mjs`; 98 journeys, 956 checkpoints)
checks that every changed page is in some journey's `sourceFiles`, warns on
components, keeps per-checkpoint statuses (`covered`, `pending`,
`not-reproducible`, `deprecated`) and fails a push whose checkpoint count
dropped (`--no-regress` in pre-push). sis and wallet check the ledger in a
vitest test (ids ↔ titles, every page mapped, summary = sums); crm runs the OS
script with `--all` in CI. None of them computes how much of the app the
journeys reach; `pnpm e2e:coverage` adds that and drops the statuses: a
checkpoint is a test that runs.
