# CLAUDE.md

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

This project is built on the ibl.ai platform using the `@iblai/iblai-js` SDK.
It was scaffolded from **vibe-starter** and already has: SSO sign-in, a home
page that chats with the app's agent, an agents browser, profile with app
preferences, an admin area (users, analytics, billing, memory, organization)
that only org admins see, typed per-user and per-org settings on the
platform, and a first-run `/setup`.

## Start here — what the user says → what to do

| The user says… | Do this |
|---|---|
| "chat", "the agent", "assistant" | Already on `/`. No agent yet? An admin runs `/setup` (pick or create). Customize with `/iblai-vibe-agent-chat`. |
| "create an agent", "another agent" | `/iblai-vibe-agent-create` → then `/iblai-vibe-agent-setting` and the tabs in `/iblai-vibe-agent` |
| "users", "admins", "roles", "invite", "who can" | `/iblai-vibe-admin` (User/Admin mode, `/admin/users`), `/iblai-vibe-invite`, `/iblai-vibe-rbac` |
| "remember the user's…", "preferences", "onboarding progress", "custom user fields" | `/iblai-vibe-user-metadata` (`useUserSettings` in `lib/iblai/metadata.ts`) — never localStorage, never your own DB |
| "organization setting", "white-label", "app-wide config" | `/iblai-vibe-org-metadata` (`useOrgSettings`, GET-merge-PUT) + `/iblai-vibe-account` |
| "profile", "avatar", "résumé" | `/iblai-vibe-profile` (already on `/profile`) |
| "remember", "memory", "personalize" | `/iblai-vibe-memory-guide` → `/iblai-vibe-memory`, `/iblai-vibe-agent-memory` |
| "analytics", "usage", "costs", "transcripts", "audit" | `/iblai-vibe-analytics` (already on `/admin/analytics`), `/iblai-vibe-agent-audit` |
| "charge", "pricing", "paywall", "credits", "spend limit" | `/iblai-vibe-pricing` → the rail it picks |
| "notifications" | `/iblai-vibe-notification` (already on `/notifications`) |
| "deploy", "URL", "share it" | `/iblai-vibe-ops-deploy` |
| "iOS", "Android", "Mac", "Windows", "App Store" | `/iblai-vibe-ops-build`, `/iblai-vibe-ops-release` |
| anything with no component | `/iblai-vibe-api` — server route + `Api-Token`, and the matching `iblai/api` skill |
| "tests", "before you show me" | `/iblai-vibe-ops-test` — `pnpm build`, `pnpm test`, screenshot |

Rules that never change: SDK components → shadcn/ui → custom, in that order;
`pnpm install --ignore-scripts`; lowercase project names; ask for a real
agent UUID, never invent one; never print a token; run `/iblai-vibe-ops-test`
before saying "done".

## Component Priority

1. **ibl.ai components** (`@iblai/iblai-js`) — always first
2. **shadcn/ui** (`pnpm dlx shadcn@latest add <name>`) — everything else
3. **Custom/third-party** — only when neither exists

Do NOT build custom components when an SDK component exists. Do NOT restyle
SDK components — wrap the *container*, never the internals. ibl.ai and
shadcn share one Tailwind theme and render in brand colors automatically.

## Map of this app

| Where | What |
|---|---|
| `app/(app)/page.tsx` | Home: SDK `<Chat>` with the app's agent (`?agent=` → env → org setting); `?session=` restores, `?new=` starts fresh; the `key` is the only legitimate remount. Empty state when no agent. |
| `app/(app)/agents/page.tsx` | SDK `AgentSearch`; clicking a card opens it on `/` |
| `app/(app)/profile/page.tsx` | SDK `Profile` + `AppPreferences` (per-user settings) |
| `app/(app)/account/page.tsx`, `notifications/` | SDK `Account`, `NotificationDisplay` |
| `app/(app)/admin/**` | Admin mode only: users (+ invites), analytics tabs, billing, memory, organization (+ `OrgSettingsForm`) |
| `app/setup/` | First-run: name the app, pick/create the agent → org metadata. Admins only; no navbar. |
| `app/api/admin/**` | Server routes: `requireAdmin` (forwarded session token → `token/verify/`) then `Api-Token` calls |
| `lib/iblai/config.ts` | Env accessors; `apiKey()` is server-only |
| `lib/iblai/tenant.ts` | `resolveAppTenant()`, `readTenants()`, `isTenantAdmin()` (not the SDK's `useIsAdmin`) |
| `lib/iblai/admin-mode.tsx` | `AdminModeProvider` / `useAdminMode` — the User/Admin view |
| `lib/iblai/metadata.ts` (+ `metadata-core.ts`) | `useUserSettings`, `useOrgSettings` — namespaced under `apps.<slug>`; org writes GET-merge-PUT |
| `lib/iblai/platform.ts` | `platformFetch`, `verifyCaller`, `requireAdmin`, `platformFailure` |
| `lib/iblai/admin-client.ts` | browser `adminFetch()` for `/api/admin/*` |
| `providers/iblai-providers.tsx`, `store/iblai-store.ts` | SDK providers (+ service worker, toaster, Radix guard); the store's slice keys are fixed by the SDK — keep them |
| `e2e/` | Playwright: auth, member, admin journeys; `COVERAGE.md` + `coverage.json` |

## Invariants (and why)

- The org comes from `NEXT_PUBLIC_MAIN_TENANT_KEY` (`resolveAppTenant()`); a
  placeholder or `main` renders an alert, never a login loop.
- `IBLAI_API_KEY` is server-only: never `NEXT_PUBLIC_`, never read outside
  `lib/iblai/platform.ts` / `app/api/**`. Every admin route calls
  `requireAdmin` first.
- `<Chat>` never remounts except through its `key`; `reactStrictMode` stays
  `false` (SDK voice bug). Keep `public/sw.js` — `ServiceWorkerProvider` registers it.
- Org metadata is a public read and PUT replaces it: write only through
  `useOrgSettings` / `mergeAppNamespace`; never a secret.
- Admin UI gates on `useAdminMode().adminMode`; admin *writes* gate on the server.
- No `output: 'export'` — the admin routes need a server.

## SDK Imports

```typescript
import { initializeDataLayer, mentorReducer } from "@iblai/iblai-js/data-layer";
import { AuthProvider, TenantProvider, useChatV2 } from "@iblai/iblai-js/web-utils";
import { Profile, AnalyticsLayout, NotificationDropdown } from "@iblai/iblai-js/web-containers";
import { SsoLogin, UserProfileDropdown, Account, Chat, AgentSearch } from "@iblai/iblai-js/web-containers/next";
```

## Environment

`iblai.env` (gitignored) holds the platform shorthand: `DOMAIN`, `PLATFORM`,
`TOKEN`, optional `IBLAI_USERNAME`. `.env.local` (gitignored) is what Next.js
reads: `NEXT_PUBLIC_MAIN_TENANT_KEY` (= `PLATFORM`), `IBLAI_API_KEY`
(= `TOKEN`), optional `NEXT_PUBLIC_DEFAULT_AGENT_ID`, `NEXT_PUBLIC_APP_NAME`,
`NEXT_PUBLIC_SUPPORT_EMAIL`. The API/auth/websocket URLs default to hosted
iblai.app in `lib/iblai/config.ts`; override only when self-hosting
(`NEXT_PUBLIC_PLATFORM_BASE_DOMAIN`, `NEXT_PUBLIC_API_BASE_URL`, the sign-in
URL). When the host exports `IBLAI_API_KEY` / `IBLAI_PLATFORM_KEY` /
`IBLAI_USERNAME` (the ibl.ai desktop app does), use those and never ask.

Every origin the app runs on (localhost, the deployed URL, a Tauri scheme)
must be in the org's allowed redirect origins or sign-in never returns.

## Brand

- **Primary** `#0058cc`, **Gradient** `linear-gradient(135deg, #00b0ef, #0058cc)`, button `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- shadcn/ui new-york variant, system sans-serif, Lucide icons; SDK components ship their own styles — do NOT override them

## Layout Patterns

- Page background `var(--sidebar-bg, #fafbfc)`; member pages wrap SDK components in `bg-white rounded-lg border border-[var(--border-color)] overflow-hidden`, `w-full px-4` / `md:w-[75vw] md:px-0`.
- Admin pages host SDK panels the OS way: full width, `flex-1 min-h-0`, the component's own background.
- Mobile safe area: `globals.css` `env(safe-area-inset-*)` on body; `viewport-fit=cover` in `app/layout.tsx`.

## Commands

```bash
pnpm dev             # Dev server (localhost:3000)
pnpm build           # Production build
pnpm typecheck       # Type-check
pnpm test            # Vitest
pnpm test:e2e        # Playwright (needs e2e/.env.development)
```
