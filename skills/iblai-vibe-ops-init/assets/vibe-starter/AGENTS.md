# CLAUDE.md

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

This project is built on the ibl.ai platform using the `@iblai/iblai-js` SDK.

## Component Priority

When adding UI features, follow this priority order:

1. **ibl.ai components** (`@iblai/iblai-js`) -- always use these first
2. **shadcn/ui** (`npx shadcn@latest add`) -- for everything else
3. **Custom/third-party** -- only when no ibl.ai or shadcn component exists

### When the user asks to add...

| Feature | Use this | NOT this |
|---------|----------|----------|
| Profile page / dropdown | `/iblai-vibe-profile` skill + `Profile`, `UserProfileDropdown` from SDK | Custom profile form |
| Account / org settings | `/iblai-vibe-account` skill + `Account` from SDK | Custom settings page |
| Analytics dashboard | `/iblai-vibe-analytics` skill + `AnalyticsOverview`, `AnalyticsLayout` from SDK | Chart library from scratch |
| Notifications | `/iblai-vibe-notification` skill + `NotificationDropdown` from SDK | Custom notification system |
| Chat / AI assistant | `/iblai-vibe-agent-chat` skill + `Chat` from SDK | Custom chat UI |
| Auth / login | `/iblai-vibe-auth` skill + `AuthProvider`, `SsoLogin` from SDK | Custom auth flow |
| Invite users | `/iblai-vibe-invite` skill + `InviteUserDialog` from SDK | Custom invite form |
| Workflow builder | `/iblai-vibe-workflow` skill + workflow components from SDK | Custom node editor |
| Course content | `/iblai-vibe-course-access` skill + `CourseContentLayout`, `CourseContentTabPage` from SDK | Custom course player |
| Create / publish courses | `/iblai-vibe-course-create` skill (Course Creation API) | Manually authoring OLX in edX Studio |
| Onboarding flow | `/iblai-vibe-onboard` skill | Custom onboarding from scratch |
| Buttons, forms, modals, tables | shadcn/ui (`npx shadcn@latest add button dialog table`) | Raw HTML or other UI libraries |
| Page sections / blocks | shadcn/ui blocks (`npx shadcn@latest add @shadcn-space/hero-01`) | Custom layout from scratch |

### Key rule

Do NOT build custom components when an ibl.ai SDK component exists.
Do NOT use raw HTML or third-party UI libraries when shadcn/ui has an equivalent.
ibl.ai and shadcn share the same Tailwind theme -- they render in brand colors automatically.

## SDK Imports

```typescript
// Data layer
import { initializeDataLayer, mentorReducer } from "@iblai/iblai-js/data-layer";

// Auth & utilities
import { AuthProvider, TenantProvider, useChatV2 } from "@iblai/iblai-js/web-utils";

// Framework-agnostic components
import { Profile, AnalyticsLayout, NotificationDropdown } from "@iblai/iblai-js/web-containers";

// Next.js-specific components
import { SsoLogin, UserProfileDropdown, Account } from "@iblai/iblai-js/web-containers/next";
```

## Adding Features

Use skills to add features. Each skill creates the files and guides you
through the wiring:

```
/iblai-vibe-auth          # SSO authentication (run first)
/iblai-vibe-agent-chat    # In-process agent chat surface
/iblai-vibe-profile       # Profile dropdown + settings page
/iblai-vibe-account       # Account/org settings page
/iblai-vibe-analytics     # Analytics dashboard
/iblai-vibe-course-access # Course content pages (edX learner UI)
/iblai-vibe-course-create # Generate and publish courses via Course Creation API
/iblai-vibe-notification  # Notification bell
/iblai-vibe-invite        # User invitation dialogs
/iblai-vibe-workflow      # Workflow builder
/iblai-vibe-onboard       # Onboarding questionnaire flow
/iblai-vibe-ops-build     # Desktop/mobile builds (Tauri v2)
/iblai-vibe-ops-test      # Test before showing work
/iblai-vibe-ops-upgrade   # Upgrade CLI, SDK, and skills to latest
/iblai-vibe-component     # Browse all available components
```

All features require auth first (`/iblai-vibe-auth` or `iblai add auth`).

## Environment

Platform configuration lives in `iblai.env` (`DOMAIN`, `PLATFORM`, `TOKEN`,
and optionally `VERCEL_TOKEN` for mobile dev builds). The `NEXT_PUBLIC_*`
env vars in `.env.local` are derived from it (by the CLI or your AI
assistant). Treat `iblai.env` as the source of truth for platform config --
update it there and re-derive rather than hand-editing `.env.local`.

`VERCEL_TOKEN` in `iblai.env` enables `iblai deploy vercel` — builds,
deploys to Vercel, disables auth protection, and updates `devUrl` in
`tauri.conf.json` automatically. If missing when the user wants to deploy,
ask once for their token (https://vercel.com/account/tokens).

## Brand

- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Style**: shadcn/ui new-york variant, system sans-serif, Lucide icons
- SDK components ship with their own styles -- do NOT override them

## Layout Patterns

- **Page background**: `var(--sidebar-bg, #fafbfc)`
- **SDK wrappers**: Wrap SDK components in `bg-white rounded-lg border border-[var(--border-color)] overflow-hidden`
- **Responsive width**: `w-full px-4` mobile, `md:w-[75vw] md:px-0` desktop
- **Mobile safe area**: `globals.css` must have `padding-top: env(safe-area-inset-top)` (and bottom/left/right) on body, and `app/layout.tsx` metadata must include `viewport: "width=device-width, initial-scale=1, viewport-fit=cover"` -- prevents content from overlapping the iOS notch / Android status bar
- **Package manager**: Use `pnpm` (fall back to `npm`)
- **Project names**: Lowercase only — npm rejects capital letters in package names. Convert any name the user gives (e.g. `MyApp` → `my-app`) before passing to `create-next-app`, `iblai startapp`, or `--app-name`.

## Commands

```bash
pnpm dev             # Dev server
pnpm build           # Production build
iblai config show    # View configuration
iblai add <feature>  # Add a feature
```
