---
name: iblai-auth
description: Add ibl.ai SSO authentication to a vanilla Next.js app
globs:
alwaysApply: false
---

# /iblai-auth

Add ibl.ai SSO authentication to a vanilla Next.js app. After completion,
unauthenticated users are redirected to login.iblai.app and returned with
a session -- no API tokens to manage.

Do NOT ask the user for their platform key. The CLI
reads `PLATFORM` from `iblai.env` automatically. If `iblai.env` exists
with a real `PLATFORM` value, just run `iblai add auth` (no flag needed).
Otherwise use the placeholder:
```
iblai add auth --platform your-platform
```

If `.env.local` already has `NEXT_PUBLIC_MAIN_TENANT_KEY` set to a real
value (not a placeholder like `your-main-platform`, `your-tenant`, `your-platform`,
`your-tenant-key`, `test-tenant`, `main`, or empty), keep that value.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

Project names MUST be all lowercase — npm rejects package names with
capital letters. If the user gives a name like `MyApp`, convert it to
`my-app` before passing to `create-next-app`, `iblai startapp`, or
`--app-name`. Allowed: lowercase letters, digits, `-`, `_`.

When building a navbar or header, do NOT display the platform name.
Use the ibl.ai logo instead.

Follow the component hierarchy: use ibl.ai SDK components
(`@iblai/iblai-js`) first, then shadcn/ui for everything else
(`npx shadcn@latest add <component>`). Do NOT write custom components
when an ibl.ai or shadcn equivalent exists. Both share the same
Tailwind theme and render in ibl.ai brand colors automatically.

Follow [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md) for
colors, typography, spacing, and component styles.

## Prerequisites

 **Already have auth?** If you used `iblai startapp agent`, auth is already
 set up -- skip this skill.

 **Want a complete app from scratch?** Create in a temp directory and copy back:
 ```
 iblai startapp agent -o iblai-init
 cp -a iblai-init/<app-name>/. . && rm -rf iblai-init
 rm -rf node_modules && pnpm install
 cp .env.example .env.local
 pnpm dev
 ```
 If `iblai.env` has `PLATFORM`, the CLI reads it automatically.
 Otherwise pass `--platform your-platform`.

 **This skill** is for adding auth to a vanilla Next.js app
 or an existing project.

- Next.js 14+ with App Router (`app/` directory)
- Node.js 18+
- `iblai` CLI available (`iblai --version`)
### Installing the CLI

If `iblai` is not available:

**pip (recommended):**

```bash
pip install iblai-app-cli
```

**npx:**

```bash
npx @iblai/cli --version
# Use npx @iblai/cli as prefix: npx @iblai/cli add auth --platform your-main-platform
```

**Build from source -- macOS / Linux** (Python 3.11+, pip, git, make):

```bash
git clone https://github.com/iblai/iblai-app-cli.git
cd iblai-app-cli
make -C .iblai install
cd -   # back to your project
```

If `iblai` is not found after install, add `~/.local/bin` to your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

To make permanent, add the line to `~/.bashrc` or `~/.zshrc`.

**Build from source -- Windows** (Python 3.11+, pip, git):

```powershell
git clone https://github.com/iblai/iblai-app-cli.git
cd iblai-app-cli
pip install -e .iblai/
cd -
```

If `iblai` is not found, ensure Python Scripts is in your PATH.
Typically at `%APPDATA%\Python\Python311\Scripts\`.

## Step 0: Check for CLI Updates

Before running any `iblai` command, ensure the CLI is
up to date. Run `iblai --version` to check the current version, then
upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Step 1: Check Environment

Before proceeding, check for a `iblai.env`
in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
If the file does not exist or is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

If `PLATFORM` is set to a real value (not `your-platform` or `your-main-platform`), the CLI
will read it automatically — no `--platform` flag needed in Step 3.
Otherwise use the placeholder.

## Step 2: Customize Auth Interface

STOP here. You MUST ask the user these questions before
proceeding to Step 3. Do NOT skip this step.

### Fetch platform name

First, read `PLATFORM` and `TOKEN` from `iblai.env`, then fetch the
platform metadata to get the platform name:

```bash
curl -s "https://api.{domain}/dm/api/core/orgs/{platform}/metadata/" \
  -H "Authorization: Api-Token {token}"
```

Use the `platform_name` field from the response as the auth **title**.

### Ask the user

Ask these two questions together:

1. **"Briefly describe what your app does"**
2. **"Do you want a navbar with logo, page links, notification bell, and profile dropdown?"**

If the user says yes to the navbar, run `/iblai-navbar` after Step 8
(Replace Default Home Page).

If the user skips or doesn't want to answer, use the platform name as
`AUTH_DISPLAY_TITLE` and leave `AUTH_DISPLAY_DESCRIPTION` empty. If the
user provides a description, generate a headline and tagline from it.

Use `https://ibl.ai/images/iblai-logo.png` as the default logo (favicon,
display logo, and side panel logo).

Remaining fields use fixed defaults:

- **Footer credit** — Always `"Powered by {{logo}}"` (the `{{logo}}` placeholder renders the ibl.ai logo)
- **Privacy policy URL** — Always `"https://ibl.ai/privacy-policy"`
- **Terms of use URL** — Always `"https://ibl.ai/terms-of-use"`
- **Display images** — Leave empty (`[]`)
- **Password-only login** — Default `false`

### Save to `iblai.env`

After generating the fields, append them to `iblai.env` so the user can
review and edit before the API call:

```bash
# Auth interface (edit before proceeding)
AUTH_TITLE=<platform_name from API>
AUTH_LOGO=https://ibl.ai/images/iblai-logo.png
AUTH_DISPLAY_TITLE=<platform_name from API>
AUTH_DISPLAY_DESCRIPTION=
AUTH_FOOTER_CREDIT=Powered by {{logo}}
AUTH_PRIVACY_POLICY_URL=https://ibl.ai/privacy-policy
AUTH_TERMS_OF_USE_URL=https://ibl.ai/terms-of-use
AUTH_PASSWORD_ONLY=false
```

Tell the user: "I've saved the generated auth settings to `iblai.env`.
Review them and edit if needed, then let me know to continue."

STOP and wait for the user to confirm before proceeding with the API calls.
Re-read `iblai.env` to pick up any edits the user made.

After confirmation, use `PLATFORM` and `TOKEN` from `iblai.env` for all
API calls. All API requests use this header:
```
Authorization: Api-Token <token>
```

### Upload images first

If `AUTH_LOGO` is a **local file path**, upload it via:

```bash
curl -X POST "https://api.{domain}/dm/api/core/platforms/{platform}/public-image-assets/" \
  -H "Authorization: Api-Token {token}" \
  -F "image=@{file_path}" \
  -F "category={category}"
```

Upload the logo three times with different categories. If `AUTH_LOGO` is
already a URL (like the default), use it directly in the metadata payload
without uploading.
| Image | Category |
|-------|----------|
| Favicon | `auth_spa_favicon` |
| Display logo | `auth_spa_logo` |
| Side panel logo | `auth_spa_slide_panel_logo` |
| Display images (each) | `auth_spa_display_image` |

The POST response returns a JSON object. Extract the `file` field — that is
the URL to use in the metadata payload.

If the user provided a **URL** (not a local file), use it directly in the
metadata payload without uploading.

### PUT the metadata

After all images are uploaded, assemble the payload and PUT to:

```
PUT https://api.{domain}/dm/api/core/orgs/{platform}/metadata/
Authorization: Api-Token {token}
Content-Type: application/json
```

The payload has two identical keys — `auth_web_skillsai` and
`auth_web_mentorai` — both containing the same configuration:

```json
{
  "auth_web_skillsai": {
    "title": "User's Title",
    "favicon": "https://...uploaded-logo-url...",
    "display_logo": "https://...uploaded-logo-url...",
    "footer_credit": "Powered by {{logo}}",
    "display_images": [],
    "terms_of_use_url": "https://ibl.ai/terms-of-use",
    "display_title_info": "Generated headline",
    "privacy_policy_url": "https://ibl.ai/privacy-policy",
    "display_description_info": "Generated description",
    "display_slide_panel_logo": "https://...uploaded-logo-url...",
    "authorize_only_password_login": false
  },
  "auth_web_mentorai": {
    "title": "User's Title",
    "favicon": "https://...uploaded-logo-url...",
    "display_logo": "https://...uploaded-logo-url...",
    "footer_credit": "Powered by {{logo}}",
    "display_images": [],
    "terms_of_use_url": "https://ibl.ai/terms-of-use",
    "display_title_info": "Generated headline",
    "privacy_policy_url": "https://ibl.ai/privacy-policy",
    "display_description_info": "Generated description",
    "display_slide_panel_logo": "https://...uploaded-logo-url...",
    "authorize_only_password_login": false
  }
}
```

Always use ibl.ai's privacy policy and terms of use URLs. Generate the
headline and description from the user's app description. Set
`authorize_only_password_login` to `false`.

After a successful PUT (200), tell the user: "Your login page has been
customized! Changes will appear on your next login at https://login.{domain}".

## Step 3: Run the Generator

```bash
cd your-nextjs-app

# If iblai.env has PLATFORM, the CLI reads it automatically
iblai add auth

# Or pass explicitly (overrides iblai.env)
iblai add auth --platform your-platform

# Or via npx (when published)
npx @iblai/cli add auth --platform your-platform
```

The platform key sets `NEXT_PUBLIC_MAIN_TENANT_KEY` in `.env.local`.
The CLI reads `PLATFORM` from `iblai.env` automatically. Pass `--platform`
only if you want to override it or don't have an `iblai.env`.

The generator creates 7 files and patches `next.config`, `globals.css`, and `.env.local`.
It auto-detects `src/` directory layout and places files accordingly.

## Step 4: Install Dependencies and Add Test Script

```bash
pnpm install
```

The generator adds these to `package.json`:

- `@iblai/iblai-js` -- SDK (auth, data layer, UI components)
- `@reduxjs/toolkit` + `react-redux` -- state management (SDK uses RTK Query)
- `sonner` -- toast notifications
- `lucide-react` -- icons

If `package.json` does not already have a `"test"` script (or it still has the
default `create-next-app` placeholder), add vitest:

```bash
pnpm add -D vitest
```

Then set the test script in `package.json`:

```json
"scripts": {
  "test": "vitest run"
}
```

## Step 5: Wire Providers into Layout

Open `app/layout.tsx` and wrap `{children}` with the generated `IblaiProviders`.
Add `viewport-fit=cover` to the metadata so mobile builds (iOS/Android) respect
safe area insets and don't overlap with the status bar.

**If you have no existing providers:**

```tsx
import type { Metadata, Viewport } from "next";
import { IblaiProviders } from "@/providers/iblai-providers";

export const metadata: Metadata = {
  title: "My App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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

**If you have existing providers** (e.g., custom contexts):

```tsx
import type { Metadata, Viewport } from "next";
import { IblaiProviders } from "@/providers/iblai-providers";
import { MyProvider } from "./my-provider";

export const metadata: Metadata = {
  title: "My App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IblaiProviders>
          <MyProvider>
            {children}
          </MyProvider>
        </IblaiProviders>
      </body>
    </html>
  );
}
```

`IblaiProviders` must be the **outermost** provider -- it contains Redux, Auth,
and Tenant providers that other components depend on. Place your own providers
inside it.

## Step 6: Configure Environment

If the CLI read `PLATFORM` from `iblai.env` or you passed `--platform`, the platform key is already set in `.env.local`.
Verify with:

```bash
iblai config show
```

Otherwise, edit `.env.local` (created by the generator) or use the CLI:

```bash
iblai config set NEXT_PUBLIC_MAIN_TENANT_KEY your-main-platform
```

The default API URLs point to `iblai.app` and are set automatically.

## Step 7: Import SDK Styles

Verify `app/globals.css` has the SDK imports (the generator patches this automatically):

```css
@import '@iblai/iblai-js/web-containers/styles';
@source "../node_modules/@iblai/iblai-js/dist/web-containers/source";
```

If these lines are missing, add them near the top of `globals.css`.

## Step 8: Replace Default Home Page

After adding auth, check if `app/page.tsx` still has the default Next.js
content (look for `next/image`, `vercel.svg`, `Vercel`, or
`Get started by editing`). If it does, replace it with the ibl.ai home page:

```bash
iblai add homepage
```

If the user has already customized their home page, skip this step.

## Step 9: Navbar

If the user said yes to the navbar question in Step 2, run `/iblai-navbar`
now before starting the dev server.

## Step 10: Start Dev Server

Start the dev server so the user can see the result:

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
| `lib/iblai/config.ts` | Environment variable accessors (API URLs, platform key, auth URL) |
| `lib/iblai/storage-service.ts` | localStorage wrapper implementing the SDK's StorageService interface |
| `lib/iblai/auth-utils.ts` | `redirectToAuthSpa()`, `hasNonExpiredAuthToken()`, `handleLogout()` |
| `store/iblai-store.ts` | Redux store with `coreApiSlice`, `mentorReducer`, `mentorMiddleware` |
| `providers/iblai-providers.tsx` | Provider chain: ReduxProvider > AuthProvider > TenantProvider |

## What Was Patched

- **`next.config.ts`** -- webpack `resolve.alias` to deduplicate `@reduxjs/toolkit`,
  `turbopack: {}` for Next.js 16+. Without the dedup,
  SDK components use a different `ReactReduxContext` and RTK Query hooks silently
  return `undefined` with zero HTTP requests.
- **`globals.css`** -- SDK base styles import.
- **`.env.local`** -- API URLs, auth URL, platform key, WebSocket URL.

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

The SDK calls `/api/custom-domains?domain=localhost` as part of platform detection.
This fails on localhost but is **harmless** -- the platform is resolved from
`NEXT_PUBLIC_MAIN_TENANT_KEY` in `.env.local` instead. You can safely ignore
this console error during local development.

### SDK components show undefined / no API requests

`@reduxjs/toolkit` must be deduplicated in `next.config.ts`. Without the
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
the platform resolution falls back to custom-domain detection which fails on
localhost, leaving the app in a broken state.

## Next Steps


After auth is set up, add more features:

```bash
iblai add chat           # AI chat widget (requires agent ID)
```

Other features are built using skills -- ask your AI assistant to use:

| Skill | What It Adds |
|-------|-------------|
| `/iblai-chat` | AI chat widget |
| `/iblai-profile` | User profile dropdown + settings page |
| `/iblai-account` | Account/organization settings page |
| `/iblai-analytics` | Analytics dashboard page |
| `/iblai-notification` | Notification bell + center page |

For the complete reference implementation with all features:
  https://github.com/iblai/iblai-app-cli/tree/main/examples/iblai-agent-app

**Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
