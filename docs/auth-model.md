# How sign-in and organizations work — and which architecture your app is

Every ibl.ai front end (the OS at os.ibl.ai, the LMS, vibe-starter, the
embeddable chat) signs users in the same way. Understanding the handful of
parameters involved is what lets you choose between the three app
architectures below — and it is the first question `/iblai-vibe-start` asks.

Vocabulary: **organization (org)** = a customer workspace; **org key** = its
id (`platform_key`/`tenant` on the wire); **member** = a signed-in user of the
org; **admin** = `is_admin` on the org. [glossary.md](glossary.md).

## 1. The sign-in round trip

```
your app ──► https://login.<domain>/login?app=<app>&redirect-to=<origin>&tenant=<org-key>[&logout=1]
             (the hosted Auth SPA: password, Google/Apple/SSO providers, sign-up)
your app ◄── <origin>/sso-login-complete?data=<json>&redirect-to=<path>
             `SsoLogin` stores the json into localStorage and navigates to <path>
```

| Parameter | Sent by | Meaning |
|---|---|---|
| `app` | the app | Which front end is asking — the Auth SPA picks the branding and the redirect rules for it. The OS sends `mentor`; vibe-starter sends `custom`; the branding for your app is set by `/iblai-vibe-auth` Step 2 (`auth_web_*` in the org's metadata). |
| `redirect-to` | the app | The **origin** to return to (`http://localhost:3000`, `https://my-app.vercel.app`, or a native scheme `my-app://`). Must be in the org's **allowed redirect origins**, or the SPA never returns. The in-app path to land on is kept by the app itself in `localStorage["redirect-to"]` (`saveRedirect`). |
| `tenant` | the app | The org to sign in to. Omitted → the user's default org. Present → the SPA authenticates *into that org* (joining it when self-join is open; otherwise "not a member"). |
| `logout=1` | the app | Log the current session out first (used by `handleLogout` and by 401 handling). `enforce_logout=1&email=` forces a fresh sign-in as a given address (the OS uses it for Stripe return links). |
| `data` | the SPA | JSON of everything the app stores: `axd_token` (+`_expires`), `dm_token` (+`_expires`), `edx_jwt_token`, `userData` (`user_nicename`, `user_email`, …), `tenants` (every org the user belongs to, each with `key`, `is_admin`, and flags such as `show_paywall`), `current_tenant`, `tenant`. |
| `redirect-to` / `redirect-path` | the SPA | Where to go after storing. The OS's `resolveRedirectPath` only honors same-origin paths (no `//`, no scheme) and resets to `/` when the path names a different org than the one just authenticated. |

What the SDK does with it afterwards:

- **`AuthProvider`** — on every route: is there a non-expired `axd_token` (the OS also requires an unexpired `edx_jwt_token`)? If not, `redirectToAuthSpa(...)`. A `middleware` map of `RegExp → async () => boolean` marks routes that do **not** need sign-in (`false` = public): `/sso-login*` always; in the OS also `/share/chat/*`, `/error/*`, `/version`, the Stripe callback, and — the important one — `/platform/<org>/<agent>` **when the agent allows anonymous access** (`allow_anonymous` or `mentor_visibility = viewable_by_anyone`, read from the agent's public settings). Anonymous users are `username = "anonymous"`; `useAccessingPublicRoute()` tells your UI.
- **`TenantProvider`** — given `currentTenant`/`requestedTenant`, checks `tenants[]` for membership. If the user is signed in but not a member of the requested org, it re-authenticates against it (`redirectToAuthSpa` with `tenant=`) and hands back a fresh org-scoped token pair through `saveUserTokens` — **persist it**, or the provider loops on "User still does not belong to tenant after re-auth" (vibe #155). `saveUserTenants`, `saveCurrentTenant`, `saveTenant` are the storage hooks; `handleTenantSwitch` clears storage and goes through the SPA with `tenant=<new>`, broadcasting to other tabs (`useTenantSwitchSync`, a shared switch lock).
- **Visiting** — a user of org A opening an agent in org B is a *visitor*: `visiting_tenant` in localStorage; the agent is reachable if its visibility allows; org-scoped calls may 401 (the OS skips the 401 redirect on shareable links).
- **401 from the API** → `redirectToAuthSpa(undefined, undefined, true)` (log out, sign in again). **402** → the credit/paywall flow.
- **Native (Tauri)** — mobile WebViews are refused by SSO providers, so the shell opens the SPA in the system browser and returns through `<scheme>://` → `/mobile-sso-login?data=…`; desktop uses `/api/auth-redirect?to=` as a same-origin hop. A build can be **tenant-locked** (`IBL_TENANT` at build time): anonymous users go straight into that org and a signed-in user of another org is switched (`useTenantLock`).
- **Cross-app sync** — the tokens are mirrored to base-domain cookies (`ibl_user_data`, `ibl_tenant`, `ibl_current_tenant`) so sibling apps notice a sign-in/sign-out; never done from inside an iframe.
- **Server side** — none of the above involves your server. A server route acts either *as the user* (the browser forwards `dm_token`; verify with `GET /dm/api/core/token/verify/`) or *as the org* (`IBLAI_API_KEY`, `Authorization: Api-Token`). [security-model.md](security-model.md).

## 2. Three architectures

| | **A · Single-org app** | **B · Multi-org app** | **C · Headless / server-to-server** |
|---|---|---|---|
| Who uses it | Members of **one** organization (yours or your customer's) | Users who belong to **several** orgs, or the public plus many customer orgs | Nobody signs in — a script, CI job, backend, or your own product's server |
| Sign-in | SSO, always with `tenant=<the org>`; a non-member is refused (or pays to join — the [vibe-agent](https://github.com/iblai/vibe-agent) model) | SSO without `tenant` for the default org; the org comes from the URL (`/platform/[org]/…`), a switcher, or the agent being visited; re-auth per org | None. One Platform API Token per org, or an org secret |
| Where the org key lives | `NEXT_PUBLIC_MAIN_TENANT_KEY` (`iblai.env` → `PLATFORM`), pinned; `main` refused | `NEXT_PUBLIC_MAIN_TENANT_KEY=main` (the community org) + the route param; `tenants[]` decides membership | `IBLAI_ORG` / `PLATFORM` per call |
| Anonymous / public | Optional: a public agent route left out of `AuthProvider`'s protection (`allow_anonymous`) | Same, per agent; the OS's `/platform/<org>/<agent>` rule | n/a (or a public agent hit over REST as `anonymous`) |
| Admin surfaces | The app's admin area (`/iblai-vibe-admin`) for that org's admins | Per org; the OS's Admin mode is the reference | The `iblai-api-*` skills |
| Credentials on the server | `IBLAI_API_KEY` for **that** org — the "server-to-server token an organization has" | One key per org you serve (a table of keys, or the caller's own token forwarded) | `IBLAI_API_KEY` (+ `IBLAI_ORG`) |
| What vibe gives you | **vibe-starter as shipped** (`resolveAppTenant()` pins the org; `/setup`, admin area, metadata helpers) | The OS pattern (§3); the same SDK providers with `requestedTenant` from the route and `TenantSwitcher`/`UserProfileDropdown showTenantSwitcher` | `/iblai-api-login` + the `api` family; `/iblai-vibe-api` when the server is inside a Next.js app |
| Redirect origins to register | localhost, the deployed URL, the mobile scheme | same | none |
| Pick it when | "An app for my organization / for each customer I deploy it to" — the common case | "One deployment, many organizations, users move between them" — you are building a platform like the OS | "No UI at all", or "my backend talks to ibl.ai on behalf of my users" |

Most custom apps are **A**. Ship **A** first even if **B** is the goal — every
piece carries over; only organization resolution changes.

## 3. Going multi-org — the OS pattern in five moves

1. **Put the org in the URL.** `app/platform/[tenantKey]/…` (the OS) or `app/[org]/…`. Resolve it with `useParams()`; keep `resolveAppTenant()` for the default.
2. **Feed it to the providers.** `TenantProvider currentTenant={fromStorage} requestedTenant={fromRoute}`; implement `saveUserTokens`, `saveUserTenants`, `saveCurrentTenant`, `saveTenant`, `handleTenantSwitch` (vibe-starter already does; the OS's `providers/index.tsx` is the full version).
3. **Let users switch.** `UserProfileDropdown showTenantSwitcher` or `TenantSwitcher`; on switch call `handleTenantSwitch(org)` from `@iblai/iblai-js/web-utils` — it clears storage and re-enters through the SPA with `tenant=`.
4. **Decide anonymous access per agent.** Add the OS's regex to `AuthProvider`'s `middleware`: for `/platform/<org>/<agent>` fetch the agent's public settings (`useLazyGetMentorPublicSettingsQuery`) and return `false` (public) when `allow_anonymous` or `mentor_visibility === "viewable_by_anyone"`.
5. **Guard the landing path.** After SSO, reset to `/` when the stored path names an org the user did not just authenticate into (`resolveRedirectPath` in the OS's `app/sso-login-complete/page.tsx`).

Read them in the source: `providers/index.tsx`, `lib/utils.ts`
(`redirectToAuthSpa`, `redirectToLogin`, `redirectToAuthSpaJoinTenant`,
`handleTenantSwitch`), `hooks/use-tenant-lock.ts`, `app/sso-login-complete/page.tsx`,
`app/mobile-sso-login/page.tsx`, `app/api/auth-redirect/route.ts` in
[iblai/os](https://github.com/iblai/os).

## 4. Where it lives in vibe-starter (architecture A)

| Concern | File |
|---|---|
| Redirect to the SPA (`app=custom`, `redirect-to`, `tenant`, `logout`), mobile scheme, logout | `lib/iblai/auth-utils.ts` |
| Org pinned from env; `main`/placeholders refused; `readTenants()`, `isTenantAdmin()` | `lib/iblai/tenant.ts` |
| Providers: data layer, `AuthProvider` (+ `PUBLIC_ROUTES`), `TenantProvider` (+ `saveUserTokens`), service worker | `providers/iblai-providers.tsx` |
| SSO landing (`SsoLogin`) | `app/sso-login-complete/page.tsx` |
| CSP (nonce, enforce in prod) | `middleware.ts` |
| Server: act as the user (`verifyCaller`) or as the org (`platformFetch`) | `lib/iblai/platform.ts` |

To open one agent to the public in architecture A: add its route to
`PUBLIC_ROUTES` in `providers/iblai-providers.tsx` returning `false`, render
`<Chat … username={null} userIsStudent>` on it, and mark the agent
`allow_anonymous` (Agent Settings, or `/iblai-api-agent-setting`). The OS's
per-agent middleware in §3 is the general form.
