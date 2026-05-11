---
name: iblai-component
description: Add an iblai component or feature to your app
globs:
alwaysApply: false
---

# /iblai-component

Overview of all ibl.ai components and how to create a new app.

Before adding a component or creating a new app, check
for a `iblai.env` in the project root. Look for `PLATFORM`,
`DOMAIN`, and `TOKEN` variables. If the file does not exist or is missing
these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables. Next.js still reads runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

When building a navbar or header, do NOT display the tenant/platform name.
Use the ibl.ai logo instead.

[BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
is the **default** for colors, typography, spacing, and component styles —
but if the project already has its own design system (downloaded from
v0, a custom theme, a partner-branded shell, etc.), **follow that
instead**. See "Detect Existing Design Style" below.

## Detect Existing Design Style

Before applying any of the layout / navbar / spacing patterns later in
this skill, check whether the project already has a design system in
place. If it does, **the project's tokens win** — don't override them
with ibl.ai brand defaults.

### Signals that a design system is already present

| Signal | Where to look | What it means |
|--------|---------------|----------------|
| `components.json` exists with shadcn-style entries | repo root | Project uses shadcn/ui (often via v0). Match its `style` (e.g. `new-york`), `baseColor`, and `cssVariables` settings. |
| `components/ui/` is populated | `components/ui/*.tsx` | shadcn primitives already installed. Reuse them; don't add raw HTML or a different UI lib for the same primitives. |
| Custom CSS variables beyond shadcn defaults | `app/globals.css`, `styles/globals.css`, `app/(*)/layout.tsx` | E.g. `--primary`, `--accent`, `--brand-*`, `--surface-*`, custom radius / shadow tokens. These define the project palette — bind components to these vars, not to ibl.ai brand hex codes. |
| `tailwind.config.{ts,mjs,js}` extends colors / fonts | repo root | `theme.extend.colors`, `theme.extend.fontFamily`, etc. carry intent. Match them. |
| Tailwind v4 inline theme in CSS | `@theme { ... }` block in `globals.css` | Same as above for Tailwind v4. |
| Custom font loaded via `next/font` | `app/layout.tsx` | Don't replace it. Wrap SDK components inside elements that inherit the font. |
| Existing app shell components | `components/{navbar,sidebar,header,footer,app-shell}.tsx` | The project already has its layout. Plug SDK content INTO that shell, don't add a second navbar/sidebar. |
| `BRAND.md` / `DESIGN.md` / `design-tokens.*` files | repo root, `docs/`, `lib/` | The project documents its own visual language. Read it before generating anything. |
| Build output came from v0 | comments like `// v0 generated`, `from "v0"`, or `app/page.tsx` containing v0-style scaffolds | Treat the existing components as the source of truth for style. |

### What "follow it" means concretely

When the project has its own design system:

1. **Use the project's CSS variables** for color, radius, shadow, and
   spacing wherever you'd otherwise reach for an ibl.ai brand hex. If
   the project defines `--primary`, bind to that — not `#0058cc`.
2. **Reuse existing shadcn primitives** in `components/ui/`. Don't
   install a duplicate (e.g. a second `<Button>` from a different
   library) and don't restyle the existing one.
3. **Plug SDK components into the existing shell**, don't replace it.
   If the project has `components/navbar.tsx`, add the SDK
   `<NotificationDropdown>` and `<UserProfileDropdown>` inside it;
   don't write a new navbar.
4. **Wrap SDK components in the project's card pattern**, not the
   ibl.ai default white card. If the project uses
   `bg-card border border-border rounded-xl` everywhere, mirror that
   when wrapping `<Profile>`, `<Account>`, `<AnalyticsLayout>`, etc.
5. **Match the project's container widths and spacing scale**. If
   pages use `max-w-screen-xl mx-auto px-6`, don't introduce
   `md:w-[75vw]`.
6. **Don't add the ibl.ai logo** unless the project's navbar uses a
   logo at all. If the project has a custom wordmark or no logo,
   match it.
7. **Don't override SDK component internals.** SDK components ship
   their own styling — your job is to bind the *surrounding container*
   to the project's tokens, not to restyle the SDK's internals.

### When to fall back to the ibl.ai defaults below

If you find none of the signals above, the project has no design
system yet — use the patterns in **Layout & Page Patterns** as the
starting point. Those defaults are derived from
[`iblai/vibe-starter`](https://github.com/iblai/vibe-starter) and the
reference apps in [`iblai/vibe`](https://github.com/iblai/vibe).

### Tell the user what you detected

Before generating, surface what you found in one line so the user can
correct you:

> Detected: shadcn-new-york + custom `--primary` (`oklch(0.55 0.18 250)`),
> existing `components/navbar.tsx`. I'll bind SDK components to your
> tokens and plug them into the existing navbar instead of creating a
> new one.

If you find nothing:

> No existing design system detected. I'll use the ibl.ai defaults
> from `BRAND.md`.

## Creating a New App

### Vanilla Next.js + ibl.ai Features

Start with a standard Next.js app and add features as needed:

The CLI reads `PLATFORM` from `iblai.env` automatically. Pass `--platform`
only if you want to override it or don't have an `iblai.env`.

```bash
npx create-next-app@latest iblai-init --yes
cp -a iblai-init/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
iblai add auth
iblai add chat
pnpm dev
```

### Full ibl.ai Agent App

Scaffold a complete app with auth, chat, and everything pre-configured.
Always create in a temp directory and copy back to the current directory:

```bash
iblai startapp agent -o iblai-init
cp -a iblai-init/<app-name>/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
cp .env.example .env.local
pnpm dev
```

### Non-Interactive (CI/CD)

```bash
iblai startapp agent --yes --platform acme --agent my-id --app-name my-app -o iblai-init
cp -a iblai-init/my-app/. . && rm -rf iblai-init
rm -rf node_modules && pnpm install
cp .env.example .env.local
```

### AI-Enhanced Scaffolding

Set your API key as an environment variable (never pass secrets as CLI arguments):

```bash
export ANTHROPIC_API_KEY=<your-key>
iblai startapp agent \
  --prompt "kids learning assistant with bright colors"
```

## Available Components

| Command | What It Adds | Skill |
|---------|-------------|-------|
| `iblai add mcp` | MCP servers + skills (run first) | |
| `iblai add auth` | SSO authentication | `/iblai-auth` |
| `iblai add chat` | AI chat widget (requires agent ID) | `/iblai-chat` |
| `iblai add profile` | User profile dropdown | `/iblai-profile` |
| `iblai add account` | Account/organization settings | `/iblai-account` |
| `iblai add analytics` | Analytics dashboard | `/iblai-analytics` |
| `iblai add notification` | Notification bell | `/iblai-notification` |
| | User invitation dialogs | `/iblai-invite` |
| | Workflow builder components | `/iblai-workflow` |
| `iblai add builds` | Tauri v2 desktop/mobile shell | |

## Layout & Page Patterns

> **Use these only when the project has no existing design system** (see
> the detection step above). When the project already defines its own
> tokens, navbar, page widths, or card styling, mirror those instead of
> the patterns below.

### Page background

The page background should be `var(--sidebar-bg, #fafbfc)` (light gray).
Set in `globals.css`:

```css
@layer base {
  body {
    background-color: var(--sidebar-bg, #fafbfc);
  }
}
```

### SDK component wrappers

SDK components (`Profile`, `Account`, `AnalyticsLayout`) have no outer
background. Wrap them in a white container so they render as cards:

```tsx
<div className="mx-auto w-full flex-1 overflow-auto px-4 py-8 md:w-[75vw] md:px-0">
  <div className="rounded-lg border border-[var(--border-color)] bg-white overflow-hidden">
    <SdkComponent ... />
  </div>
</div>
```

### Responsive width

Use `w-full px-4` on mobile, `md:w-[75vw] md:px-0` on desktop for all
page content and the navbar inner container. This keeps everything aligned.

### Navbar pattern

Use a sticky top navbar with frosted glass effect, ibl.ai logo on the left,
nav links next to it, and profile dropdown on the right:

```tsx
<header className="sticky top-0 z-50 flex-shrink-0 border-b border-[var(--border-color)] bg-white/80 backdrop-blur-xl backdrop-saturate-150">
  <div className="mx-auto flex h-14 w-full items-center px-4 md:w-[75vw] md:px-0">
    {/* Mobile hamburger (Sheet) */}
    {/* Logo */}
    {/* Desktop nav links with bottom-border active state */}
    {/* Profile dropdown ml-auto */}
  </div>
</header>
```

Key navbar details:
- **Active link**: `border-b-2 border-[var(--primary-color)] text-[var(--primary-color)]`
- **Inactive link**: `border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]`
- **Mobile**: Use shadcn `Sheet` with `side="left"` for a slide-out drawer.
  Note: shadcn Sheet uses `@base-ui/react/dialog`, NOT Radix. The `asChild`
  prop is NOT available on `SheetTrigger`.

### Footer pattern

```tsx
<footer className="flex-shrink-0 border-t border-[var(--border-color)]">
  <div className="mx-auto flex h-11 w-full items-center justify-between px-4 text-xs text-[var(--text-muted)] md:w-[75vw] md:px-0">
    <p>&copy; {new Date().getFullYear()} ibl.ai</p>
    <div className="flex items-center gap-5">
      {/* Docs, Privacy, Terms links */}
    </div>
  </div>
</footer>
```

## Component Gallery

All components below are from `@iblai/iblai-js/web-containers`. Use MCP tools
(`get_component_info`, `get_hook_info`) for full props and usage examples.

> Auto-generated from `@iblai/web-containers` type declarations. Re-generate with: `iblai update-gallery <path>`

### Authentication & SSO

| Export | Import | Description |
|--------|--------|-------------|
| `DEFAULT_SSO_STORAGE_KEYS` | sso | Default localStorage key constants for SSO |
| `LoginButton` | root | Auth login button -- redirects to `authUrl` with redirect options |
| `SignupButton` | root | Signup button -- opens signup flow, optionally in new tab |
| `SsoLogin` | next | SSO callback handler -- stores tokens from URL into localStorage and redirects |

```typescript
import { DEFAULT_SSO_STORAGE_KEYS } from "@iblai/iblai-js/web-containers/sso";
import { LoginButton, SignupButton } from "@iblai/iblai-js/web-containers";
import { SsoLogin } from "@iblai/iblai-js/web-containers/next";
```

### User Profile & Account

| Export | Import | Description |
|--------|--------|-------------|
| `Account` | next | Account/org settings with tabs (Organization, Management, Integrations, Advanced, Billing) |
| `CompanyDialog` | root | Company selection dialog |
| `EducationDialog` | root | Dialog for adding/editing education |
| `EducationTab` | root | Education background management |
| `ExperienceDialog` | root | Dialog for adding/editing experience |
| `ExperienceTab` | root | Professional experience management |
| `InstitutionDialog` | root | Institution selection dialog |
| `InviteUserDialog` | root | Dialog to invite users to a platform |
| `InvitedUsersDialog` | root | Dialog showing pending invitations |
| `LocalLLMTab` | root | Local LLM model management (Tauri desktop) |
| `OrganizationTab` | next | Organization settings tab |
| `Profile` | root | Full inline profile management (use for `/profile` page) |
| `ResumeTab` | root | Resume upload and display |
| `UserProfileDropdown` | next | Avatar dropdown with profile, organization, platform switcher, logout |
| `UserProfileModal` | next | Profile editing modal/dialog (use for overlay, NOT for a page) |

```typescript
import { Account, OrganizationTab, UserProfileDropdown, UserProfileModal } from "@iblai/iblai-js/web-containers/next";
import { Profile, CompanyDialog, EducationDialog, EducationTab, ExperienceDialog, ExperienceTab, InstitutionDialog, ... } from "@iblai/iblai-js/web-containers";
```

> **`Profile` vs `UserProfileModal`**: `Profile` renders inline (full page).
> `UserProfileModal` renders as a dialog overlay. Use `Profile` for a
> dedicated `/profile` route. Use `UserProfileModal` for a quick-edit overlay.

### Platform & Organization

| Export | Import | Description |
|--------|--------|-------------|
| `TenantSwitcher` | root | Switch between platforms/organizations with RBAC support |

```typescript
import { TenantSwitcher } from "@iblai/iblai-js/web-containers";
```

### Analytics

| Export | Import | Description |
|--------|--------|-------------|
| `AccessTimeHeatmap` | root | Access time heatmap visualization |
| `AnalyticsCourseDetail` | root | Single course detail view |
| `AnalyticsCourses` | root | Course analytics listing |
| `AnalyticsFinancialStats` | root | Financial/billing statistics |
| `AnalyticsLayout` | root | Layout wrapper for analytics pages with built-in tab navigation |
| `AnalyticsOverview` | root | Overview dashboard with key metrics |
| `AnalyticsProgramDetail` | root | Single program detail view |
| `AnalyticsPrograms` | root | Program analytics listing |
| `AnalyticsReportDownload` | root | Download analytics reports |
| `AnalyticsReports` | root | Report listing and management |
| `AnalyticsSettingsProvider` | root | Context provider for analytics settings (required wrapper) |
| `AnalyticsTopicsStats` | root | Topic/conversation statistics |
| `AnalyticsTranscriptsStats` | root | Transcript browsing and search |
| `AnalyticsUsersStats` | root | User activity statistics |
| `ChartCardWrapper` | root | Wrapper for chart visualizations |
| `ChartFiltersProvider` | root | Context provider for chart filter state |
| `CustomDateRangePicker` | root | Custom date range selector |
| `EmptyStats` | root | Empty state placeholder for stats |
| `GroupsFilterDropdown` | root | Filter analytics by user groups |
| `StatCard` | root | Single statistic card |
| `TimeFilter` | root | Time range filter dropdown |

```typescript
import { AnalyticsLayout, AnalyticsSettingsProvider, AnalyticsOverview, AnalyticsCourses, AnalyticsPrograms, AnalyticsFinancialStats, AnalyticsUsersStats, AnalyticsTopicsStats, AnalyticsTranscriptsStats, AnalyticsReports } from "@iblai/iblai-js/web-containers";
```

> **`AnalyticsFinancialStats`** does NOT accept a `basePath` prop.
> All other analytics sub-page components do.

### Notifications

| Export | Import | Description |
|--------|--------|-------------|
| `AlertsTab` | root | Alert management tab |
| `EditAlertDialog` | root | Dialog to create/edit alerts |
| `NotificationDisplay` | root | Full notification center with Inbox and Alerts tabs |
| `NotificationDropdown` | root | Bell icon with unread badge -- compact navbar widget |
| `SendNotificationDialog` | root | Dialog to compose and send notifications (admin) |

```typescript
import { AlertsTab, EditAlertDialog, NotificationDisplay, NotificationDropdown, SendNotificationDialog } from "@iblai/iblai-js/web-containers";
```

### Mentor UI (App Shell)

| Export | Import | Description |
|--------|--------|-------------|
| `AppSidebar` | next | Collapsible sidebar with menu items, projects, pinned/recent messages |
| `ConversationStarters` | next | Guided prompt cards for starting conversations |
| `NavBar` | next | Top navigation bar with user menu, mentor dropdown, new chat action |

```typescript
import { AppSidebar, ConversationStarters, NavBar } from "@iblai/iblai-js/web-containers/next";
```

### Workflows

| Export | Import | Description |
|--------|--------|-------------|
| `ConnectorManagementDialog` | root | Connector setup and management |
| `CreateWorkflowModal` | root | Create new workflow modal |
| `DeleteWorkflowModal` | root | Delete workflow confirmation |
| `ToolDialogs` | root | Tool configuration dialogs |
| `WorkflowSidebar` | root | Workflow node type browser sidebar |

```typescript
import { ConnectorManagementDialog, CreateWorkflowModal, DeleteWorkflowModal, ToolDialogs, WorkflowSidebar } from "@iblai/iblai-js/web-containers";
```

### Content & Display

| Export | Import | Description |
|--------|--------|-------------|
| `CopyButtonIcon` | root | Copy-to-clipboard button icon |
| `Loader` | root | Loading overlay component |
| `Markdown` | root | Markdown renderer with syntax highlighting and copy buttons |
| `RichTextEditor` | root | Tiptap-based rich text editor (HTML or Markdown output) |
| `SearchableMultiSelect` | root | Multi-select dropdown with search filtering |
| `Spinner` | root | Loading spinner (sm, md, lg) |
| `TimeTrackingProvider` | root | Provider for automatic time tracking |
| `TopBanner` | root | Dismissible top banner notification bar |
| `Version` | root | App version display footer |

```typescript
import { CopyButtonIcon, Loader, Markdown, RichTextEditor, SearchableMultiSelect, Spinner, ... } from "@iblai/iblai-js/web-containers";
```

### Error Handling

| Export | Import | Description |
|--------|--------|-------------|
| `ClientErrorPage` | next | Client-side error boundary page |
| `ErrorPage` | next | Error page with code, message, support link, home button |

```typescript
import { ClientErrorPage, ErrorPage } from "@iblai/iblai-js/web-containers/next";
```

### Hooks & Utilities

| Export | Import | Description |
|--------|--------|-------------|
| `TAURI_COMMANDS` | root | Tauri IPC command name constants |
| `TAURI_EVENTS` | root | Tauri event name constants |

```typescript
import { TAURI_COMMANDS, TAURI_EVENTS } from "@iblai/iblai-js/web-containers";
```

### UI Primitives (Shadcn/Radix)

These are bundled with the SDK and share the ibl.ai Tailwind theme. Available
when you need lower-level building blocks inside SDK component customizations:

`AlertDialog`, `Avatar`, `Badge`, `Button`, `Calendar`, `Card`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`, `Chart`, `Checkbox`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `Pagination`, `Popover`, `Progress`, `RadioGroup`, `Select`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`, `Sonner`, `Switch`, `Table`, `Tabs`, `Textarea`, `Toast`, `Toaster`, `Toggle`, `Tooltip`

> **Note:** For your own UI, install shadcn/ui directly (`npx shadcn@latest add ...`)
> rather than importing these from the SDK. The SDK exports are for internal use
> and SDK component customization.

## Component Priority

1. **ibl.ai components first** -- always use the native component when one exists
2. **shadcn/ui for everything else** -- forms, tables, modals, date pickers, etc.:
   ```bash
   npx shadcn@latest add button dialog table form
   ```
3. **shadcnspace blocks** -- pre-built page sections:
   ```bash
   npx shadcn@latest add @shadcn-space/hero-01
   ```

ibl.ai and shadcn components share the same Tailwind theme and are visually seamless.

## SDK Styling Notes

- SDK components use Tailwind classes internally (`bg-white`, `bg-gray-50`,
  `bg-[#f5f7fb]`). Do NOT override these globally.
- To make SDK components look correct on a gray page background, wrap them
  in a `bg-white rounded-lg border border-[var(--border-color)] overflow-hidden` container.
- The `AnalyticsLayout` hardcodes `bg-[#f5f7fb]` for its background. If you
  need white, add a targeted CSS override in `globals.css`:
  ```css
  .bg-\[\#f5f7fb\] {
    background-color: #ffffff !important;
  }
  ```
- shadcn Sheet uses `@base-ui/react/dialog`, NOT Radix. The `asChild` prop
  is NOT available on `SheetTrigger`.

## CLI Updates

Before running any `iblai` command, ensure the CLI is
up to date. Run `iblai --version` to check the current version, then
upgrade directly:
- pip: `pip install --upgrade iblai-app-cli`
- npm: `npm install -g @iblai/cli@latest`

This is safe to run even if already at the latest version.

## Requirements

- Next.js App Router project (app/ directory)
- Node.js 18+
- `iblai` CLI available (`iblai --version`). See `/iblai-auth` prerequisites for installation.
- Run `iblai add mcp` first to set up MCP servers and skills
- If you started with `npx create-next-app@latest`, run `iblai add auth` first -- other components depend on the auth providers
- If you used `iblai startapp agent`, auth is already set up
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
