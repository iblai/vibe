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

> **AI Assistant:** Do NOT ask the user for their tenant key. Use the
> placeholder `your-platform` when running the generator. The user can
> update it later in `.env.local` (`NEXT_PUBLIC_MAIN_TENANT_KEY`).
>
> If `.env.local` already has `NEXT_PUBLIC_MAIN_TENANT_KEY` set to a real
> value (not a placeholder like `your-tenant`, `your-platform`,
> `your-tenant-key`, `test-tenant`, `main`, or empty), keep that value.
>
> Run the generator:
> ```
> iblai add auth --platform your-platform
> ```

## Prerequisites

> **Already have auth?** If you used `iblai startapp agent`, auth is already
> set up -- skip this skill.
>
> **Want a complete app from scratch?** Run:
> `iblai startapp agent --platform your-platform`
> to get a full app with auth, chat, and everything pre-configured.
>
> **This skill** is for adding auth to a vanilla Next.js app
> (`npx create-next-app@latest my-app --yes`) or an existing project.

- Next.js 14+ with App Router (`app/` directory)
- Node.js 18+
- `iblai` CLI available (`iblai --version`)
- An ibl.ai account (register at https://mentorai.iblai.app)

### Installing the CLI

If `iblai` is not available:

**pip (recommended):**

```bash
pip install iblai-app-cli
```

**npx:**

```bash
npx @iblai/cli --version
# Use npx @iblai/cli as prefix: npx @iblai/cli add auth --platform your-tenant
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

> **AI Assistant:** Before running any `iblai` command, ensure the CLI is
> up to date. Run `iblai --version` to check the current version, then
> upgrade directly:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
>
> This is safe to run even if already at the latest version.

## Step 1: Check Environment

> **AI Assistant:** Before proceeding, check for a `.env.local` (or `.env`)
> in the project root. Look for `PLATFORM`, `DOMAIN`, and `TOKEN` variables.
> If the file does not exist or is missing these variables, tell the user:
> "You need a `.env.local` with your platform configuration. Download the
> template and fill in your values:
> `curl -o .env.local https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/.env.example`"
>
> If `PLATFORM` is set to a real value (not `your-platform`), use it with
> `--platform` below. Otherwise use the placeholder.

## Step 2: Run the Generator

```bash
cd your-nextjs-app

# Use the placeholder -- user can update later in .env.local
iblai add auth --platform your-platform

# Or via npx (when published)
npx @iblai/cli add auth --platform your-platform
```

The `--platform` argument sets `NEXT_PUBLIC_MAIN_TENANT_KEY` in `.env.local`.
Replace `your-platform` with your real tenant key when ready to connect to your organization.

The generator creates 7 files and patches `next.config`, `globals.css`, and `.env.local`.
It auto-detects `src/` directory layout and places files accordingly.

## Step 3: Install Dependencies

```bash
pnpm install
```

The generator adds these to `package.json`:

- `@iblai/iblai-js` -- SDK (auth, data layer, UI components)
- `@reduxjs/toolkit` + `react-redux` -- state management (SDK uses RTK Query)
- `sonner` -- toast notifications
- `lucide-react` -- icons


## Step 4: Wire Providers into Layout

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

**If you have existing providers** (e.g., custom contexts):

```tsx
import { IblaiProviders } from "@/providers/iblai-providers";
import { MyProvider } from "./my-provider";

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

## Step 5: Configure Environment

If you passed `--platform` in Step 1, the tenant key is already set in `.env.local`.
Verify with:

```bash
iblai config show
```

Otherwise, edit `.env.local` (created by the generator) or use the CLI:

```bash
iblai config set NEXT_PUBLIC_MAIN_TENANT_KEY your-tenant
```

The default API URLs point to `iblai.app` and are set automatically.
Register at https://mentorai.iblai.app for your own tenant key.

## Step 6: Import SDK Styles

Verify `app/globals.css` has the SDK imports (the generator patches this automatically):

```css
@import '@iblai/iblai-js/web-containers/styles';
@source "../node_modules/@iblai/iblai-js/dist/web-containers/source";
```

If these lines are missing, add them near the top of `globals.css`.

## Step 7: Verify

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

## What Was Patched

- **`next.config.ts`** -- webpack `resolve.alias` to deduplicate `@reduxjs/toolkit`,
  `turbopack: {}` for Next.js 16+, and Tauri stub aliases. Without the dedup,
  SDK components use a different `ReactReduxContext` and RTK Query hooks silently
  return `undefined` with zero HTTP requests.
- **`globals.css`** -- SDK base styles import.
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
the tenant resolution falls back to custom-domain detection which fails on
localhost, leaving the app in a broken state.

## Step 8: Customize Auth Interface (Recommended)

> **AI Assistant:** After auth is verified working, ask the user:
> "Would you like to customize your login page? (Recommended — you can set your
> brand title, logos, carousel images, and footer text.)"
>
> If the user says yes, ask the following questions **sequentially** (do not
> batch them — ask one at a time so the user can think through each):
>
> 1. **Title** — "What title should appear on the login page?" (e.g., "Smart Buildings Academy")
> 2. **Favicon** — "Provide a path or URL to your favicon image" (file path or URL)
> 3. **Display logo** — "Provide a path or URL to your main logo" (shown on the login form)
> 4. **Side panel logo** — "Provide a path or URL to the side panel logo" (shown on the carousel side)
> 5. **Display images** — "Provide paths or URLs for carousel images (1-5 images)" (shown on the login side panel)
> 6. **Display title** — "What headline text for the side panel?" (e.g., "Train Your Workforce. Elevate Performance")
> 7. **Display description** — "What description text below the headline?" (e.g., "Training built for scale, consistency, and real-world results.")
> 8. **Footer credit** — "What footer text? Use {{logo}} as placeholder for the ibl.ai logo" (default: "Powered by {{logo}}")
> 9. **Terms of use URL** — "URL to your terms of use page" (optional, press Enter to skip)
> 10. **Privacy policy URL** — "URL to your privacy policy page" (optional, press Enter to skip)
> 11. **Password-only login** — "Restrict login to password only (no SSO/social)?" (true/false, default: false)
>
> After collecting answers, you need:
> - The user's **platform key** (from `NEXT_PUBLIC_MAIN_TENANT_KEY` in `.env.local`)
> - The user's **API key** (from `IBLAI_API_KEY` in `.env.local`, or ask: "Provide your ibl.ai API key for the upload")
>
> **All API requests use this header:**
> ```
> Authorization: Api-Token <iblai-api-key>
> ```
>
> ### Upload images first
>
> For each image the user provided as a **local file path**, upload it via:
>
> ```bash
> curl -X POST "https://api.iblai.app/dm/api/core/platforms/{platform}/public-image-assets/" \
>   -H "Authorization: Api-Token {api-key}" \
>   -F "image=@{file_path}" \
>   -F "category={category}"
> ```
>
> Categories for each image type:
> | Image | Category |
> |-------|----------|
> | Favicon | `auth_spa_favicon` |
> | Display logo | `auth_spa_logo` |
> | Side panel logo | `auth_spa_slide_panel_logo` |
> | Display images (each) | `auth_spa_display_image` |
>
> The POST response returns a JSON object. Extract the `file` field — that is
> the URL to use in the metadata payload.
>
> If the user provided a **URL** (not a local file), use it directly in the
> metadata payload without uploading.
>
> ### PUT the metadata
>
> After all images are uploaded, assemble the payload and PUT to:
>
> ```
> PUT https://api.iblai.app/dm/api/core/orgs/{platform}/metadata/
> Authorization: Api-Token {api-key}
> Content-Type: application/json
> ```
>
> The payload has two identical keys — `auth_web_skillsai` and
> `auth_web_mentorai` — both containing the same configuration:
>
> ```json
> {
>   "auth_web_skillsai": {
>     "title": "User's Title",
>     "favicon": "https://...uploaded-or-provided-url...",
>     "display_logo": "https://...uploaded-or-provided-url...",
>     "footer_credit": "Powered by {{logo}}",
>     "display_images": [
>       { "alt": "", "image": "https://...url..." },
>       { "alt": "", "image": "https://...url..." }
>     ],
>     "terms_of_use_url": "https://example.com/terms",
>     "display_title_info": "Headline text",
>     "privacy_policy_url": "https://example.com/privacy",
>     "display_description_info": "Description text",
>     "display_slide_panel_logo": "https://...uploaded-or-provided-url...",
>     "authorize_only_password_login": false
>   },
>   "auth_web_mentorai": {
>     "title": "User's Title",
>     "favicon": "https://...uploaded-or-provided-url...",
>     "display_logo": "https://...uploaded-or-provided-url...",
>     "footer_credit": "Powered by {{logo}}",
>     "display_images": [
>       { "alt": "", "image": "https://...url..." },
>       { "alt": "", "image": "https://...url..." }
>     ],
>     "terms_of_use_url": "https://example.com/terms",
>     "display_title_info": "Headline text",
>     "privacy_policy_url": "https://example.com/privacy",
>     "display_description_info": "Description text",
>     "display_slide_panel_logo": "https://...uploaded-or-provided-url...",
>     "authorize_only_password_login": false
>   }
> }
> ```
>
> Omit optional fields (terms_of_use_url, privacy_policy_url) if the user
> skipped them. Set `authorize_only_password_login` to `false` if not specified.
>
> After a successful PUT (200), tell the user: "Your login page has been
> customized! Changes will appear on your next login at https://login.{domain}".

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
