# The app edits, in full

The eight edits `/iblai-vibe-house-journeys` Step 3 makes to a house-shell app, shown on the
SIS's files (the CRM and the wallet differ only in paths). Each hunk is what the rehearsal
applied; copy them, then `pnpm typecheck && pnpm lint && pnpm test`.

## 1. `providers/iblai-providers.tsx` — preview, never a join from a link

The SDK's `TenantProvider` joins any `requestedTenant` it does not find in `tenants`. Ask it
for the user's own organization when the route names one they lack; the platform layout
previews the route organization instead.

The membership list is read before the SDK runs: what the sign-in stored, else one fetch
through the SDK's own query — a cold load right after sign-in has none in storage yet.

```diff
-import { initializeDataLayer, type TokenResponse } from "@iblai/iblai-js/data-layer";
+import {
+  initializeDataLayer,
+  useLazyGetUserTenantsQuery,
+  type TokenResponse,
+} from "@iblai/iblai-js/data-layer";
 …
 import { readStoredTenantKey, readUsername } from "@/lib/iblai/tenant";
+import { decideEntry, readTenants, type OrgEntry } from "@/lib/iblai/house-journeys";
 …
   const storedTenant = useMemo(() => (mounted ? readStoredTenantKey() : ""), [mounted]);
+
+  // The membership list, before the SDK can attempt a join from a link: what
+  // the sign-in stored, else one fetch (/iblai-vibe-house-journeys).
+  const storedTenants = useMemo(() => (mounted ? readTenants() : []), [mounted]);
+  const needFetch = mounted && !!routeTenant && storedTenants.length === 0;
+  const [fetchUserTenants] = useLazyGetUserTenantsQuery();
+  const [fetched, setFetched] = useState<OrgEntry[] | null>(null);
+  useEffect(() => {
+    if (!needFetch || fetched) return;
+    fetchUserTenants()
+      .unwrap()
+      .then((list) => {
+        const known = (Array.isArray(list) ? list : []) as OrgEntry[];
+        localStorage.setItem(LOCAL_STORAGE_KEYS.TENANTS, JSON.stringify(known));
+        setFetched(known);
+      })
+      .catch(() => setFetched([]));
+  }, [needFetch, fetched, fetchUserTenants]);
+  const tenants = needFetch ? fetched : storedTenants;
 …
   const LOADING = <LoadingScreen />;
-  if (!isInitialized || !mounted) return LOADING;
+  if (!isInitialized || !mounted || tenants === null) return LOADING;

-  const requestedTenant = routeTenant || storedTenant;
+  // A route platform the user does not belong to is previewed by the platform
+  // layout; the app runs on their own underneath, so the SDK never attempts a
+  // join from a link (/iblai-vibe-house-journeys).
+  const requestedTenant = decideEntry({ routeOrg: routeTenant, stored: storedTenant, tenants }).org;
```

`onAuthFailure` stays as it is: the once-only re-sign-in without an organization when a
remembered community organization refused the user, then the 403 page.

The switch, if the providers still carry vibe-starter's single-org handler: the $0 checkout
leaves the user holding `main` and their new organization, and the SDK moves such a user to
the new one through `handleTenantSwitch`. Hand it the SDK's own tenant (the app's wrapper
around the SDK switch in `lib/iblai/auth-utils.ts`), and send a route still naming another
organization home:

```diff
-          handleTenantSwitch={async () => {
-            const tenant = resolveAppTenant();
-            redirectToAuthSpa(undefined, tenant, false, true);
-          }}
+          handleTenantSwitch={async (tenant: string, saveRedirect: boolean) => {
+            await handleTenantSwitch(tenant, saveRedirect);
+          }}
+          onTenantMismatch={() => {
+            // A stale tab legitimately sees its old route during a switch window.
+            if (isTenantSwitchInProgress()) return;
+            window.location.href = "/";
+          }}
```

## 2. `lib/iblai/tenant.ts` — the landing organization

A user whose only organization is the community one lands on it (the trial-gated shell)
instead of a notice. `null` only when signed out.

```diff
  * Where to land when the URL names no platform: the remembered platform unless
  * it is the community one, else the first platform the user belongs to that is
- * not the community one, else null — the app never lands on `main`.
+ * not the community one, else the community one itself (the OS's trial-gated
+ * shell, /iblai-vibe-house-journeys); null only when signed out.
 …
   if (stored && stored !== main) return stored;
-  return tenants.find((t) => t.key && t.key !== main)?.key ?? null;
+  return tenants.find((t) => t.key && t.key !== main)?.key ?? (tenants.length ? main : null);
```

The unit test that expected `null` for a `main`-only user now expects `"main"`
(`__tests__/tenant.test.ts`, "lands a user whose only platform is the community one on it,
and is null when signed out").

## 3. `app/platform/[tenantKey]/layout.tsx` — the preview, the dialog, the gate

```diff
 import { LoadingScreen } from "@/components/loading-screen";
-import { NOTICE_PRIMARY, NOTICE_SECONDARY, NoticeCard } from "@/components/notice-card";
+import { FirstRunGate } from "@/components/house/first-run-gate";
+import { OrganizationPreview } from "@/components/house/organization-preview";
+import { SampleNotice } from "@/components/house/sample-notice";
+import { UpgradeModal } from "@/components/house/upgrade-modal";
 …
-import { handleLogout, handleTenantSwitch } from "@/lib/iblai/auth-utils";
-import { tenantDisplayName } from "@/lib/iblai/tenant";
+import { readStoredTenantKey } from "@/lib/iblai/tenant";
+import { decideEntry, isTrialUser } from "@/lib/iblai/house-journeys";
 …
 export default function TenantLayout({ children }: { children: ReactNode }) {
-  const { isAdmin, tenantKey } = useSession();
+  const { isAdmin, tenantKey, tenants } = useSession();
   const [sidebarOpen] = useState(readSidebarOpen);

   if (!tenantKey) return <LoadingScreen />;
-  if (tenantKey === config.mainTenantKey()) return <NoSchoolNotice />;
+  const entry = decideEntry({ routeOrg: tenantKey, stored: readStoredTenantKey(), tenants });
+  if (entry.kind === "preview" && entry.preview) {
+    return <OrganizationPreview org={entry.preview} app={config.iblPlatform()} />;
+  }
 …
       <LanguagePreferenceSync />
+      <UpgradeModal org={tenantKey} app={config.iblPlatform()} />
       <TooltipProvider>
 …
                         >
+                          {isTrialUser(tenantKey, tenants) ? <SampleNotice /> : null}
-                          {children}
+                          <FirstRunGate org={tenantKey} isAdmin={isAdmin}>
+                            {children}
+                          </FirstRunGate>
                         </main>
```

The `NoSchoolNotice` component and the imports only it used (`useTranslations`,
`NoticeCard`, `handleLogout`, `handleTenantSwitch`, `tenantDisplayName`) go. The community
organization renders the shell like any other, and a trial user's pages render the sample
under the notice (edit 8).

## 4. `components/sis/app-sidebar.tsx` — the trial-gated cluster

```diff
 import { useRouter } from "next/navigation";
+import { useDispatch } from "react-redux";
 …
+import { setOpenPricingModal } from "@iblai/iblai-js/web-utils";
 import { useAccountSheet } from "@/components/sis/account-sheet";
 …
 import { tenantDisplayName } from "@/lib/iblai/tenant";
+import { isTrialUser } from "@/lib/iblai/house-journeys";
 …
-  const { tenantKey, isAdmin, currentTenant, href, username } = useSession();
+  const { tenantKey, isAdmin, currentTenant, href, username, tenants } = useSession();
+  const dispatch = useDispatch();
+  // On the community platform the admin cluster is shown and every click upgrades.
+  const trial = isTrialUser(tenantKey, tenants);
 …
   const onFooterAction = (id: PlatformSidebarFooterActionId) => {
     if (isMobile) setOpenMobile(false);
+    if (trial) {
+      dispatch(setOpenPricingModal(true));
+      return;
+    }
 …
         isAdmin,
         isLiveAdmin,
+        showTrialGatedAdminMenu: trial,
         enableRbac: false,
```

## 5. `components/sis/top-bar.tsx` — the credit badge

```diff
 import { AdminModeSwitch } from "@/components/sis/admin-mode-switch";
+import { useAdminMode } from "@/components/sis/admin-mode";
+import { CreditBadge } from "@/components/house/credit-badge";
 …
   const { tenantKey, username, isAdmin, href } = useSession();
+  const { adminMode } = useAdminMode();
 …
+        <CreditBadge org={tenantKey} isLiveAdmin={isAdmin && adminMode} className="hidden md:flex" />
         <AdminModeSwitch className="hidden md:flex" />
```

## 6. The ledger

`e2e/coverage.json` gains the journey:

```json
{
  "id": "house",
  "spec": "journeys/house.journey.spec.ts",
  "sourceFiles": ["app/platform/[tenantKey]/onboarding/[[...agentId]]/page.tsx", "app/platform/[tenantKey]/page.tsx"],
  "checkpoints": [
    { "id": "H1", "name": "lands on the community organization inside the shell, with the admin cluster shown" },
    { "id": "H2", "name": "a trial-gated click opens the SDK upgrade dialog, and Escape closes it" },
    { "id": "H3", "name": "the organization is previewed, and Join goes to the auth page's join for it" },
    { "id": "H4", "name": "Create your own organization is ibl.ai's $0 sign-up with this app nested in the return address" },
    { "id": "H5", "name": "an admin who has not finished the setup flow is sent to it once: organization, sector, team, done" },
    { "id": "H6", "name": "an admin who finished it stays home" },
    { "id": "H7", "name": "a member is sent to the organization's form, answers it, sees the final step and lands home" },
    { "id": "H8", "name": "with nothing configured, /onboarding says so and Continue goes home" },
    { "id": "H9", "name": "the community organization runs on the sample, and its notice opens the upgrade dialog" },
    { "id": "H10", "name": "Upgrade for free opens this app's $0 checkout" },
    { "id": "H11", "name": "still on the community organization while the platform lists their own, the SDK moves them to it" }
  ]
}
```

`summary.totalCheckpoints` + 11, `summary.totalJourneys` + 1, and a `house` row in
`e2e/COVERAGE.md`: "the three first-run journeys: the community organization trial-gated on
the sample with the upgrade dialog, the preview of another organization (Join, Create your
own), the admin setup flow and the member form at `/onboarding`, and the session a checkout
returns to". The app's own sample checkpoints (a record opens, a write upgrades and sends
nothing) join the journey of the pages they visit.

## 7. `e2e/auth.setup.ts` — the admin's first run, once

The e2e admin's first visit now opens the setup flow; the seed walks it once so the SIS's
own journeys (which open Setup as the admin) keep working. Idempotent: the second run finds
`onboarding.completed` in the admin's platform metadata and the wizard is not shown.

```diff
   try {
+    // 0. The admin's first run is the SDK setup flow (/iblai-vibe-house-journeys):
+    // walk it once, so Setup opens instead of the wizard from here on.
+    await page.goto(`${APP_HOST}/`);
+    await page.waitForURL(/\/platform\/[^/?#]+/, { timeout: 60_000 });
+    const wizard = await page
+      .getByLabel("Organization name")
+      .waitFor({ state: "visible", timeout: 15_000 })
+      .then(() => true, () => false);
+    if (wizard) {
+      await page.getByLabel("Organization name").fill("E2E School");
+      await page.getByRole("button", { name: "Continue" }).click();
+      await page.getByRole("radio", { name: "Higher Education" }).click();
+      await page.getByRole("button", { name: "Continue" }).click();
+      await page.getByRole("button", { name: "Continue" }).click();
+      await page.getByRole("button", { name: "Complete" }).click();
+      await page.waitForURL((u) => !u.pathname.includes("/onboarding"), { timeout: 60_000 });
+    }
     // 1. Year and term.
     await open(page, "/setup?tab=terms", /^Setup\b/);
```

## 8. The base query — the sample's seam

Every slice the app defines goes through one base query; wrap it once:

```diff
+import { withSample } from "@/lib/iblai/sample-seam";
+import { sampleResponse } from "@/lib/<app>/sample/respond";
 …
 export const appApi = createApi({
   reducerPath: "appApi",
-  baseQuery: rawBaseQuery,
+  // On the community organization the sample answers; nothing reaches the platform.
+  baseQuery: withSample(rawBaseQuery, sampleResponse),
```

`sampleResponse` answers the app's own reads from `lib/<app>/sample/data.ts` and returns
`undefined` for the rest, which the seam turns into the upgrade dialog:

```text
// lib/<app>/sample/respond.ts
export function sampleResponse(method: string, url: string): unknown {
  if (method !== "GET") return undefined;
  const path = new URL(url, "https://sample.invalid").pathname;
  if (/\/things\/$/.test(path)) return { results: THINGS, count: THINGS.length };
  const one = path.match(/\/things\/([^/]+)\/$/);
  return one ? THINGS.find((t) => t.id === one[1]) : undefined;
}
```

An app with several base queries (the SIS has one per backend) wraps each. The SIS, the CRM
and recruit carry this seam inside their own base query; the wallet, which reads through
SDK hooks, swaps its data source instead (`isSampleWallet` → a read-only source whose every
action opens the dialog).

## The 402

The SDK chat's default `on402Error` sends an admin to `navigateToAdminBilling` — wire it to
the account dialog's Billing tab (`openTab("billing")` from the account-sheet provider). An
app without a chat adds the same for its own calls:

```diff
       initializeDataLayer(
         config.dmUrl(),
         config.lmsUrl(),
         config.legacyLmsUrl(),
         storageService,
-        { 401: () => redirectToAuthSpa(undefined, undefined, true) },
+        {
+          401: () => redirectToAuthSpa(undefined, undefined, true),
+          // Out of credits: an admin tops up in Billing; a member reads the platform's words.
+          402: () => (isTenantAdmin(routeTenant) ? openBilling() : toast.error(outOfCredits)),
+        },
```

where `openBilling` opens the account dialog on `billing` and `outOfCredits` is the
platform's message. Not applied by the rehearsal (the SIS has no credit-spending call of its
own); shown so the admin's Stripe path is complete where it matters.
