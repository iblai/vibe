# iblai-vibe-house-journeys

> The three first-run journeys of an ibl.ai official app, the OS's way — a user whose only organization is the community one gets the app on it, on read-only sample data, trial-gated, with the SDK's "Upgrade for free" ($0 Stripe checkout → an organization of their own); a visitor on an organization they do not belong to gets a preview with Join and Create your own organization; an admin's first run is the SDK OnboardingWizard (organization → sector → invite your team), then the Stripe path (credit badge, Billing); members get the organization's own onboarding form. ONLY when the user explicitly says they are making an ibl.ai official app — every other app keeps vibe-starter's default first run. Use when the user says "make an ibl.ai official app", "house journeys", "the OS's onboarding", "trial-gated", "Upgrade for free". For a customer app's first run see /iblai-vibe-ops-init (/setup); for pay-to-enter see /iblai-vibe-monetization-app-paywall; for the badge alone /iblai-vibe-credit.

# /iblai-vibe-house-journeys

**Only for ibl.ai official apps.** Run this skill only when the user explicitly says the app
is an ibl.ai official app ("make an ibl.ai official app", "this is an official ibl.ai app").
Any other app — a customer's, a demo, an unspecified one — keeps vibe-starter's default first
run (`/setup` from the home page's empty state) and never gets these journeys. When in doubt,
ask; never assume.

What an official app does on first run, the way the OS does it, for three kinds of signed-in
user — plus the organization's own form for its members:

- **A user whose only organization is the community one (`main`).** The app runs on it, on
  the app's own read-only sample: every read answers from the sample, every change opens
  the upgrade dialog, and a notice above the page says so. The sidebar shows the admin
  cluster trial-gated: any click opens the SDK's upgrade dialog ("Subscribe to unlock full
  features" · **Upgrade for free**), a $0 Stripe checkout that gives them an organization of
  their own and returns them into this app as its admin. The top bar carries the credit
  badge ("Free" · Upgrade Plan).
- **A visitor on an organization they do not belong to** (a link into `/platform/<org>`). A
  preview instead of the SDK's silent join attempt: the organization's logo and name,
  **Join** (the auth page's join: it joins them and returns, or says the organization does
  not allow it — only its admins can read that flag ahead of time), **Create your own
  organization** (the same $0 checkout), **Back to my organization**. The app runs on their
  own organization underneath.
- **The admin of their own organization.** Their first visit opens the SDK
  `OnboardingWizard` setup flow — organization → sector → invite your team → done — once per
  session until it is completed. Then the Stripe path: the credit badge (plan, **Upgrade**,
  **Add Credits**, **Manage Billing**; the SDK runs every checkout) and the Billing tab of the
  account dialog, where a 402 lands.
- **A member.** The form the admin authored in Management › Onboarding, with its agent on the
  last step, at `/platform/<org>/onboarding` until they answer; nothing when none is set up.





> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## What you get

Real files under `assets/`, self-contained on purpose: they import only the SDK, React, Next,
next-intl, `@/lib/iblai/config` and `@/components/loading-screen`, so they drop into any
house-shell app unchanged.

| File | Role |
|---|---|
| `lib/iblai/house-journeys.ts` | The pure rules: `decideEntry` (enter · community · preview), `ownOrg`, `isTrialUser` (the OS rule: on `main`, not its admin, nowhere else), `createOrganizationUrl` and `loginReturnUrl` (the $0 checkout told to come back here), `onboardingFlow` (the LMS's resolver), `firstRunTarget` |
| `__tests__/house-journeys.test.ts` | Every branch of those rules |
| `components/house/organization-preview.tsx` | The visitor's preview: logo and name from the public metadata, Join, Create your own organization, Back |
| `components/house/upgrade-modal.tsx` | The SDK `UpgradePackageModal`, opened by `setOpenPricingModal(true)` — a trial-gated click, or a 402 with a pricing table; mounted once. **Upgrade for free** goes straight to the $0 checkout (`checkoutUrl`), which returns to `config.appUrl()` |
| `lib/iblai/sample-seam.ts` | `withSample(baseQuery, respond)`: on the community organization a read answers from the app's sample and anything else opens the upgrade dialog — nothing reaches the platform |
| `components/house/sample-notice.tsx` | The line above every page on the sample, with Create your own organization |
| `components/house/credit-badge.tsx` | The SDK `CreditBalance` under its own `isPlatformNavbarCreditBalanceVisible` rule, for the top bar |
| `components/house/first-run-gate.tsx` | Sends an admin to the setup flow once per session until completed, a member to the form until answered; the onboarding route, the community organization and a failed read pass through |
| `components/house/onboarding-page.tsx` | The SDK `OnboardingWizard` inside the shell, the LMS's placement: the member form by default, the setup flow for an admin's first run or `?flow=admin`, the app's own last step |
| `e2e/journeys/house.journey.spec.ts` | Checkpoints H1–H11 |
| `messages/house-journeys.{en,es,fr,zh}.json` | The `houseJourneys` namespace, all four locales |

Already in the SDK and in every house-shell app: the sidebar footer's trial-gated cluster
(`showTrialGatedAdminMenu`), the account dialog's Billing tab and its Management › Onboarding
tab (the form editor; its copied link is `<origin>/platform/<org>/onboarding/<agent-id>` once
`onboardingBasePath` is the platform path, see Customize).

## When to use / when not

| Use it for | Not for |
|---|---|
| An app the user explicitly calls an ibl.ai official app | Any other app — vibe-starter's `/setup` and empty states are the default; `/iblai-vibe-ops-init` |
| The OS's experience for `main` users, a preview of another organization, the SDK setup flow | A consumer questionnaire funnel — `/iblai-vibe-onboard` |
| The platform-credits Stripe path (plan, credits, billing) | Charging your own users — `/iblai-vibe-pricing`, `/iblai-vibe-monetization-app-paywall` |

## Prerequisites

- A multi-organization app on the house shell: `/platform/[tenantKey]` routes, the SDK
  `PlatformSidebar` and `PlatformAccountSheet`, providers with `requestedTenant` (the
  `/iblai-vibe-auth` "Going multi-org" moves), next-intl with `messages/{en,es,fr,zh}.json`.
- `config.authUrl()`, `config.dmUrl()`, `config.mainTenantKey()`, `config.appName()`,
  `config.iblPlatform()` (the app's `app=` id on the auth page; `"mentor"` when absent) and
  `config.appUrl()` — where the $0 checkout returns: `NEXT_PUBLIC_APP_URL`, else the page's
  origin (vibe-starter's); an official app defaults it to its hosted origin
  (`https://<app>.iblai.me`).
- `@iblai/iblai-js` 2.59.0 or later: `UpgradePackageModal`'s `checkoutUrl` arrived there.
- The providers' `handleTenantSwitch` hands the SDK's own tenant to the switch and
  `onTenantMismatch` goes to `/` (`/iblai-vibe-auth`, Going multi-org, move 2). The $0
  checkout leaves the user holding `main` and their new organization, and the SDK moves such
  a user to the new one; a handler that re-authenticates into anything else leaves the
  loading screen up.
- The credit badge shows only on an organization with `show_paywall` (an ibl.ai operator sets
  it) and, for the community organization, to a user in no other organization.

## Step 1: Copy the assets

```bash
cp -a <skills-dir>/iblai-vibe-house-journeys/assets/lib <skills-dir>/iblai-vibe-house-journeys/assets/components <skills-dir>/iblai-vibe-house-journeys/assets/__tests__ .
cp <skills-dir>/iblai-vibe-house-journeys/assets/e2e/journeys/house.journey.spec.ts e2e/journeys/
mkdir -p 'app/platform/[tenantKey]/onboarding/[[...agentId]]'
echo 'export { OnboardingPage as default } from "@/components/house/onboarding-page";' > 'app/platform/[tenantKey]/onboarding/[[...agentId]]/page.tsx'
```

The route file is that one line: the page lives in `components/house/` so it compiles in any
app and the route stays yours. If the installed skills carry no `assets/` (some installers
strip them), the same bodies are in
[`references/app-files.md`](references/app-files.md).

## Step 2: Merge the messages

Add the `houseJourneys` object from `assets/messages/house-journeys.<locale>.json` to each
`messages/<locale>.json` — all four or none; typographic `’` as in the partials.

## Step 3: The app edits

Eight edits, shown here for the SIS's file names; the CRM and the wallet differ only in paths.
[`references/app-edits.md`](references/app-edits.md) has each in full.

1. **The providers** — a route organization the user does not belong to is previewed, never
   joined from a link (the SDK joins any `requestedTenant` it does not find in `tenants`).
   The membership list is read first: what the sign-in stored, else one fetch — a cold load
   right after sign-in has none yet:

   ```diff
   +  const storedTenants = useMemo(() => (mounted ? readTenants() : []), [mounted]);
   +  const needFetch = mounted && !!routeTenant && storedTenants.length === 0;
   +  const [fetchUserTenants] = useLazyGetUserTenantsQuery();
   +  const [fetched, setFetched] = useState<OrgEntry[] | null>(null);
   +  useEffect(() => {
   +    if (!needFetch || fetched) return;
   +    fetchUserTenants().unwrap()
   +      .then((list) => { /* keep it in localStorage; */ setFetched(list); })
   +      .catch(() => setFetched([]));
   +  }, [needFetch, fetched, fetchUserTenants]);
   +  const tenants = needFetch ? fetched : storedTenants;
   …
   -  if (!isInitialized || !mounted) return LOADING;
   -  const requestedTenant = routeTenant || storedTenant;
   +  if (!isInitialized || !mounted || tenants === null) return LOADING;
   +  const requestedTenant = decideEntry({ routeOrg: routeTenant, stored: storedTenant, tenants }).org;
   ```

2. **The landing organization** — a user whose only organization is the community one lands
   on it instead of a notice: in `pickLandingTenant`, `?? (tenants.length ? main : null)`
   where it returned `?? null`.
3. **The platform layout** — the notice for `/platform/main` goes; the preview renders
   instead of the shell; the dialog is mounted once; the sample notice sits above a trial
   user's page; the gate wraps the page:

   ```diff
   -  if (tenantKey === config.mainTenantKey()) return <NoSchoolNotice />;
   +  const entry = decideEntry({ routeOrg: tenantKey, stored: readStoredTenantKey(), tenants });
   +  if (entry.kind === "preview" && entry.preview) {
   +    return <OrganizationPreview org={entry.preview} app={config.iblPlatform()} />;
   +  }
   …
   +      <UpgradeModal org={tenantKey} app={config.iblPlatform()} />
   …
   +                        {isTrialUser(tenantKey, tenants) ? <SampleNotice /> : null}
   -                          {children}
   +                          <FirstRunGate org={tenantKey} isAdmin={isAdmin}>
   +                            {children}
   +                          </FirstRunGate>
   ```

4. **The sidebar** — the footer's trial-gated cluster, and every click on it upgrades:

   ```diff
   +  const trial = isTrialUser(tenantKey, tenants);
      const onFooterAction = (id: PlatformSidebarFooterActionId) => {
        if (isMobile) setOpenMobile(false);
   +    if (trial) {
   +      dispatch(setOpenPricingModal(true));
   +      return;
   +    }
   …
        isLiveAdmin,
   +    showTrialGatedAdminMenu: trial,
   ```

5. **The top bar** — `<CreditBadge org={tenantKey} isLiveAdmin={isAdmin && adminMode} className="hidden md:flex" />`
   before the Admin switch.
6. **The ledger** — `e2e/coverage.json` gains the `house` journey (H1–H8, `sourceFiles`: the
   onboarding page and the platform home), `COVERAGE.md` its row.
7. **The e2e seed** — the admin account's first visit now opens the setup flow, so the seed in
   `e2e/auth.setup.ts` walks it once (organization name, a sector, Continue past the invite
   step, Complete) before it opens anything else; the second run finds it completed.
8. **The base query** — every RTK Query slice of the app goes through the sample's seam
   (Step 4): `baseQuery: withSample(rawBaseQuery, sampleResponse)`.

A 402 from the SDK chat already lands admins in Billing through
`navigateToAdminBilling` (`openTab("billing")` on the account dialog); an app without a chat
adds `402` to `initializeDataLayer`'s handler map the same way.

## Step 4: The sample on the community organization

A trial user sees the app on sample data that never reaches the platform — the OS's
experience, so a visitor learns the app before creating an organization. The seam is the
app's base query, so no page knows:

1. **The data** — `lib/<app>/sample/data.ts`: one small, fixed, fictional dataset in the
   shapes your API returns (no real people; dates relative to today so it never ages).
2. **The answers** — `lib/<app>/sample/respond.ts`: `sampleResponse(method, url, body)` returns
   the body your API would answer for each read the app makes, and `undefined` for anything
   else (a write, an unknown record, an endpoint the sample does not cover).
3. **The seam** — wrap the base query every slice uses:
   `baseQuery: withSample(rawBaseQuery, sampleResponse)`. On the community organization a read
   answers from the sample; anything else opens the upgrade dialog and fails with
   `status: "SAMPLE"` (show nothing for it: the dialog is the answer).
4. **The notice** — `<SampleNotice />` above the page for a trial user (Step 3, edit 3).

Pages render the sample like any organization's data. The trial user is not an admin:
decide per app whether its admin pages show read-only on the sample or stay hidden. Data
the app reads through the SDK's own components (the profile, the notifications) stays the
user's own.

## Step 5: The project notes

Add to the app's `AGENTS.md`, under what the app is: "House journeys (`/iblai-vibe-house-journeys`):
a `main`-only user gets the trial-gated shell on read-only sample data and the upgrade dialog; a visitor on another
organization gets the preview (Join, Create your own); an admin's first run is the SDK setup
flow at `/platform/<org>/onboarding?flow=admin`, a member's the organization's form. Because
this is an ibl.ai official app."

## Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready, and give every page,
control and state this skill added its own checkpoint — one Playwright test titled
`<ID> · …` in `e2e/journeys/`, listed in `e2e/coverage.json`; `pnpm e2e:coverage` must pass:

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` (the rules' unit test and the ledger test).
2. `pnpm test:e2e` with the shipped journey: H1–H2 the community organization (the member
   session told it is in no other organization, in storage and by both membership lists:
   the shell, the cluster, the dialog), H9–H10 its sample (the notice opens the dialog;
   Upgrade for free is the $0 checkout returning to `config.appUrl()`), H3–H4 the preview of
   an unknown organization (Join's target is the auth page's join; Create's is the $0
   checkout with this app nested in `redirect_url`), H5–H6 the admin's first run (the setup
   flow end to end with the metadata answered by `page.route`; a completed one stays home),
   H7–H8 the member's (the form answered end to end; nothing configured says so), H11 the
   session a checkout returns to (still on `main` while the platform lists their own: the
   SDK's switch goes to `/login/complete` for it). Add the app's own sample checkpoints: a
   sample record opens on each list, and a write opens the dialog while no non-GET request
   leaves the page. Organization-wide state is served by `page.route`, never written —
   on the membership list too, where web-utils 2.18 reads an organization's metadata; a
   navigation the test only inspects is answered with a page, never a 204 (a click waits
   for a navigation to commit).
3. Touch test as `/iblai-vibe-ops-test` says, at desktop and phone width: the shell on
   `/platform/main` with a `main`-only account, the preview on `/platform/<an organization
   you are not in>`, `/platform/<org>/onboarding?flow=admin` as the admin, `/onboarding` as a
   member once a form exists (Management › Onboarding). Console clean.

Not proven by the journey, by design: the real join and the real $0 checkout (the platform's
side; the OS's own journeys cover them), and the badge on a real `main`-only session.

## Customize

```
get_component_info("OnboardingWizard")
get_component_info("UpgradePackageModal")
get_component_info("CreditBalance")
```

| Prop / option | Where | Description |
|---|---|---|
| `app` | `OrganizationPreview`, `UpgradeModal` | The app's `app=` id on the auth page (`config.iblPlatform()`); the login page nests `config.appUrl()` so the platform returns the user here |
| `NEXT_PUBLIC_APP_URL` | `config.appUrl()` | Where every $0 checkout returns; set it on a deployment that serves another host (a preview) |
| `checkoutUrl` | `UpgradePackageModal` (in `upgrade-modal.tsx`) | Where **Upgrade for free** goes instead of the platform's payment links: the direct $0 checkout |
| `respond`, `isSample` | `withSample` | The app's sample answers, and who sees them (default: the trial user on the community organization) |
| `brandName` | `OnboardingWizard` (in `onboarding-page.tsx`) | "Welcome to {brandName}" on the setup flow's first step — `config.appName()` |
| `sectors` | `OnboardingWizard` | The sector catalogue of step 2; defaults to the SDK's eight |
| `renderFinalStep` | `OnboardingWizard` | The last step is the app's: `AllSetStep` (setup flow) and `MeetAgentStep` (member form) in `onboarding-page.tsx` — replace them to hand over your own first task |
| `agentEmbed` | `OnboardingWizard` | Omitted on purpose: the member flow's last step names the agent and continues into the app. An app with an agent host may pass `{ mentorUrl, authUrl, lmsUrl }` and drop `renderFinalStep` to embed the agent |
| `onboardingBasePath` | `PlatformAccountSheet` | `` `${origin}/platform/${org}` `` so Management › Onboarding's copied link opens this app's `/onboarding/<agent-id>` |
| `?flow=admin` / `?flow=user` | `/platform/<org>/onboarding` | Which flow an admin sees; a member always gets the form |
| `isLiveAdmin` | `CreditBadge` | Admin AND Admin mode; the badge hides when an admin views as a member |
| `house_setup_sent` | `sessionStorage` | The organization an admin was sent to setup for this session; clear it to be sent again |

Copy is in the `houseJourneys` namespace of `messages/<locale>.json`; the SDK's own strings
(the wizard's steps, the dialog, the badge) are the SDK's, in its four locales.

## Platform data

| Hook / call | Purpose |
|---|---|
| `useTenantMetadata({ org })` (`web-utils`) | The organization's public metadata: its name for the preview, `user_onboarding_form` and `user_onboarding_submission` for the gate and the page |
| `useGetUserPlatformMetadataQuery({ tenantKey })` (`data-layer`) | The admin's own `onboarding.completed` for the organization — what the SDK setup flow writes |
| `GET …/dm/api/service/stripe/checkout/redirect/credits-free-plan/?redirect_url=&cancel_url=&email=` | ibl.ai's $0 sign-up — the dialog's Upgrade for free and the preview's Create; the platform merges `platform_key`, `email` and the sign-in token into `redirect_url` and the login page hands back to the app |
| `GET <auth>/join?tenant=<org>&redirect-to=` | The auth page's join: joins a signed-in user when the organization allows it, otherwise its own notice |
| `useStripeUpgrade` (inside the SDK dialog and badge) | The pricing-page session on the community organization, then Stripe |

REST reference: [feature](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/users/iblai-api-feature/SKILL.md),
[billing](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/billing/iblai-api-billing/SKILL.md),
[org](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/organizations/iblai-api-org/SKILL.md).

## Related skills

- `/iblai-vibe-ops-init` — every other app's first run (`/setup`, the empty states)
- `/iblai-vibe-auth` — "Going multi-org": the route organization and the switcher this skill assumes
- `/iblai-vibe-credit`, `/iblai-vibe-billing` — the badge and the Billing tab on their own
- `/iblai-vibe-admin` — the Management dialog, where the member form is authored
- `/iblai-vibe-monetization-app-paywall` — pay to enter on the organization's own Stripe account
- `/iblai-vibe-onboard` — a consumer questionnaire funnel, a different product