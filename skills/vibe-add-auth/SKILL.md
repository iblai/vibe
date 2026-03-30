---
name: vibe-add-auth
description: Add ibl.ai SSO authentication to a vanilla Next.js app
globs:
alwaysApply: false
---

# /vibe-add-auth

Add ibl.ai SSO authentication to a vanilla Next.js app. After completion,
unauthenticated users are redirected to login.iblai.app and returned with
a session -- no API tokens to manage.

## Prerequisites

- Next.js 14+ with App Router (`app/` directory)
- Node.js 18+
- `iblai` CLI available (`iblai --version`). If not available, run `/vibe-install-cli`
- An ibl.ai tenant key (use `iblai` for the free default tenant, or register at https://iblai.app)

## Step 1: Run the Generator

```bash
cd your-nextjs-app

# If iblai is installed globally
iblai add auth

# Or via npx (when published)
npx @iblai/cli add auth
```

The generator creates 7 files and patches `next.config`, `globals.css`, and `.env.local`.
It auto-detects `src/` directory layout and places files accordingly.

## Step 2: Install Dependencies

```bash
pnpm install
```

The generator adds these to `package.json`:

- `@iblai/iblai-js` -- SDK (auth, data layer, UI components)
- `@reduxjs/toolkit` + `react-redux` -- state management (SDK uses RTK Query)
- `sonner` -- toast notifications
- `lucide-react` -- icons
- `react-markdown` + `remark-gfm` -- markdown rendering

## Step 3: Wire Providers into Layout

Open `app/layout.tsx` and wrap `{children}` with the generated `IblaiProviders`.

**If you have no existing providers:**

```tsx
import { IblaiProviders } from "@/providers/iblai-providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IblaiProviders>{children}</IblaiProviders>
      </body>
    </html>
  );
}
```

**If you have existing providers** (e.g., ThemeProvider, custom contexts):

```tsx
import { IblaiProviders } from "@/providers/iblai-providers";
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IblaiProviders>
          <ThemeProvider attribute="class" defaultTheme="system">
            {children}
          </ThemeProvider>
        </IblaiProviders>
      </body>
    </html>
  );
}
```

`IblaiProviders` must be the **outermost** provider -- it contains Redux, Auth,
and Tenant providers that other components depend on. Place your own providers
inside it.

## Step 4: Configure Environment

Edit `.env.local` (created by the generator):

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.iblai.app
NEXT_PUBLIC_AUTH_URL=https://login.iblai.app
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.app
NEXT_PUBLIC_PLATFORM_BASE_DOMAIN=iblai.app
NEXT_PUBLIC_MAIN_TENANT_KEY=iblai
```

Replace `iblai` with your tenant key if you have one.
Register at https://iblai.app for a free tenant.

## Step 5: Import SDK Styles

Verify `app/globals.css` has the SDK imports (the generator patches this automatically):

```css
@import '@iblai/iblai-js/web-containers/styles';
@source "../node_modules/@iblai/iblai-js/dist/web-containers/source";
```

If these lines are missing, add them near the top of `globals.css`.

## Step 6: Verify

```bash
pnpm dev
```

1. Open http://localhost:3000
2. You should be redirected to https://login.iblai.app
3. Log in (or create a free account)
4. You'll be returned to your app with a fully authenticated session
5. Check browser localStorage -- you should see `axd_token`, `userData`, `tenants`

## What Was Generated

| File | Purpose |
|------|---------|
| `app/sso-login-complete/page.tsx` | SSO callback -- stores tokens from URL into localStorage |
| `lib/iblai/config.ts` | Environment variable accessors (API URLs, tenant key, auth URL) |
| `lib/iblai/storage-service.ts` | localStorage wrapper implementing the SDK's StorageService interface |
| `lib/iblai/auth-utils.ts` | `redirectToAuthSpa()`, `hasNonExpiredAuthToken()`, `handleLogout()` |
| `store/iblai-store.ts` | Redux store with `coreApiSlice`, `mentorReducer`, `mentorMiddleware` |
| `providers/iblai-providers.tsx` | Provider chain: ReduxProvider > AuthProvider > TenantProvider |
| `app/iblai-styles.css` | SDK style imports for Tailwind class scanning |

## What Was Patched

- **`next.config.mjs`** -- webpack `resolve.alias` to deduplicate `@reduxjs/toolkit`.
  Without this, SDK components use a different `ReactReduxContext` and RTK Query
  hooks silently return `undefined` with zero HTTP requests.
- **`globals.css`** -- `@import` for SDK base styles + `@source` for Tailwind
  class generation from SDK components.
- **`.env.local`** -- API URLs, auth URL, tenant key, WebSocket URL.

## Advanced: Route Groups

For production apps, consider moving the SSO callback outside the auth
providers using Next.js route groups:

```
app/
├── (auth)/
│   └── sso-login-complete/page.tsx   ← Outside providers (no AuthProvider wrapper)
└── (app)/
    ├── layout.tsx                     ← IblaiProviders wraps only this group
    └── page.tsx
```

This prevents the SSO callback deadlock where `AuthProvider` blocks rendering
before tokens are stored. The generator places the callback at
`app/sso-login-complete/` (flat, no route group) which works for simple apps.

For the route group pattern, see the reference implementation:
  https://github.com/iblai/iblai-app-cli/tree/main/examples/iblai-agent-app

## Troubleshooting

### "Unknown server error" with custom-domains on localhost

The SDK calls `/api/custom-domains?domain=localhost` as part of tenant detection.
This fails on localhost but is **harmless** -- the tenant is resolved from
`NEXT_PUBLIC_MAIN_TENANT_KEY` in `.env.local` instead. You can safely ignore
this console error during local development.

### SDK components show undefined / no API requests

`@reduxjs/toolkit` must be deduplicated in `next.config.mjs`. Without the
webpack alias, the SDK's components use a different `ReactReduxContext` than
your app's `StoreProvider`, so RTK Query hooks silently return `undefined`.

Verify your next.config has:
```javascript
config.resolve.alias['@reduxjs/toolkit'] = rtkDir;
```

### Auth redirect loops

The SSO callback page (`app/sso-login-complete/page.tsx`) must NOT be wrapped
by `AuthProvider`. If it is, `AuthProvider` detects "no tokens" and redirects
to login before the callback can store the tokens -- creating an infinite loop.

If this happens, use the route group pattern described above to separate the
SSO callback from the authenticated routes.

### Blank screen after login

Check that `.env.local` has `NEXT_PUBLIC_MAIN_TENANT_KEY` set. Without it,
the tenant resolution falls back to custom-domain detection which fails on
localhost, leaving the app in a broken state.

## Next Steps

After auth is set up, add more features:

```bash
iblai add chat           # AI chat widget
iblai add profile        # User profile + settings page
iblai add account        # Organization/account settings
iblai add analytics      # Analytics dashboard
iblai add notifications  # Notification bell + center page
```

For the complete reference implementation with all features:
  https://github.com/iblai/iblai-app-cli/tree/main/examples/iblai-agent-app
