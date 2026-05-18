---
name: iblai-agent-chat
description: Add the in-process Chat SDK component (full agent surface — message stream, canvas, file attach, voice, prompts) to a Next.js app
globs:
alwaysApply: false
---

# /iblai-agent-chat

Add the full ibl.ai agent chat surface — message stream, conversation
starters, canvas, file attach, voice input, voice call, screen sharing,
prompt gallery — to your Next.js app. Uses the `Chat` React component
from `@iblai/iblai-js/web-containers/next`, which renders **in-process**
(not in an iframe) and shares the host app's Redux store, providers, and
auth session.

![Welcome state](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-chat/iblai-agent-chat-1-welcome.png)
![Message sent](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/iblai-agent-chat/iblai-agent-chat-2-message-sent.png)

> **When to use this vs `/iblai-chat`:**
> - `/iblai-chat` drops in a `<mentor-ai>` web component (iframe).
>   Fastest setup, isolated from host state, limited customization.
> - `/iblai-agent-chat` (this skill) wires the SDK's `Chat` component
>   directly into your app. More setup, but you get the full feature
>   surface, can intercept actions, share auth/store with the rest of
>   your app, and theme it with your Tailwind config.

Do NOT add custom styles, colors, or CSS overrides to the SDK `Chat`
component. It ships with its own styling. Keep the component as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

> **Common setup (brand, conventions, env files, verification):** see
> [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-auth`) — the `Chat` component reads
  the axd token, username, and tenants from the providers tree.
- A working store, providers, and SSO callback route — i.e. an app that
  already passes `/iblai-auth` verification.
- An agent/mentor ID (a UUID) — get one at https://mentorai.iblai.app.

## What Gets Wired

| File | Change |
|------|--------|
| `package.json` | Adds SDK packages as direct deps + peer dependencies (Step 3) |
| `providers/index.tsx` | Wraps tree in `<ServiceWorkerProvider>`; adds `skip={isSsoLoginRoute}` to `<TenantProvider>` (Step 4) |
| `store/index.ts` | Registers `chat`, `chatInput`, `rbac`, `subscription`, `topBanner` reducers (Step 5) |
| `app/agents/[mentorId]/chat-new/page.tsx` | New route rendering `<Chat>` with all props wired (Step 6) |

## Step 1: Check Environment

Confirm `.env.local` has the env vars the SDK reads at runtime:

```
NEXT_PUBLIC_BASE_WS_URL=wss://asgi.data.iblai.org
NEXT_PUBLIC_AUTH_URL=https://auth.iblai.org
NEXT_PUBLIC_DM_URL=https://api.iblai.org/dm
NEXT_PUBLIC_LMS_URL=https://api.iblai.org/lms
NEXT_PUBLIC_AXD_URL=https://api.iblai.org/dm
NEXT_PUBLIC_AGENT_URL=http://localhost:3000
NEXT_PUBLIC_MAIN_TENANT_KEY=<your-platform-key>
NEXT_PUBLIC_SUPPORT_EMAIL=support@ibl.ai
```

## Step 2: Get the Agent ID

Ask the user for their agent/mentor UUID. Write it directly to
`.env.local` using the Edit tool — do NOT echo it back in shell
commands:

```
NEXT_PUBLIC_DEFAULT_AGENT_ID=<the-uuid>
```

If the user doesn't have one, direct them to https://mentorai.iblai.app
to create an agent.

## Step 3: Install Dependencies

```bash
pnpm add @iblai/data-layer @iblai/web-containers @iblai/web-utils \
         react-paginate livekit-client \
         @livekit/components-react @livekit/components-styles \
         @tauri-apps/plugin-os @tauri-apps/api
```

Why each one:

| Package | Used by |
|---------|---------|
| `@iblai/data-layer`, `@iblai/web-containers`, `@iblai/web-utils` | Hoist SDK packages to the top-level `node_modules` so Webpack resolves them from the host (avoids deep-tree resolution failures with pnpm) |
| `react-paginate` | Optional peer of `@iblai/web-containers` (agent search pagination) |
| `livekit-client`, `@livekit/components-react`, `@livekit/components-styles` | Voice call and screen-sharing features in the chat surface |
| `@tauri-apps/plugin-os`, `@tauri-apps/api` | OS detection (Tauri desktop wrapper); optional peers of `@iblai/web-utils` |

## Step 4: Wire the Providers

The `Chat` component uses `useAuthContext`, `useTenantContext`,
`useEmbedMode`, `useServiceWorker`, and several Redux hooks. The host
needs all of these set up.

In `providers/index.tsx`:

1. Import `ServiceWorkerProvider` from `@iblai/iblai-js/web-utils`.
2. Wrap the existing `<AuthProvider>` tree in `<ServiceWorkerProvider>`.
3. Pass `skip={isSsoLoginRoute}` to **both** `<AuthProvider>` and
   `<TenantProvider>` so the `/sso-login-complete` callback page
   doesn't crash on missing context (the SSO callback page intentionally
   runs outside the auth/tenant flow).

```tsx
import {
  AuthProvider,
  TenantProvider,
  MentorProvider,
  ServiceWorkerProvider,
} from "@iblai/iblai-js/web-utils";

// ...inside Providers
return (
  <ServiceWorkerProvider>
    <AuthProvider
      redirectToAuthSpa={redirectToAuthSpa}
      hasNonExpiredAuthToken={hasNonExpiredAuthToken}
      username={username}
      pathname={pathname}
      middleware={new Map()}
      skip={isSsoLoginRoute}
    >
      <TenantProvider
        currentTenant={mainTenantKey}
        requestedTenant={(params.tenantKey as string) || mainTenantKey}
        handleTenantSwitch={handleTenantSwitch}
        saveCurrentTenant={saveCurrentTenant}
        saveUserTenants={saveUserTenants}
        skip={isSsoLoginRoute}
      >
        <MentorProvider {...mentorProps}>
          {children}
        </MentorProvider>
      </TenantProvider>
    </AuthProvider>
  </ServiceWorkerProvider>
);
```

## Step 5: Register Store Reducers

In `store/index.ts`, add five reducers alongside whatever the existing
auth/data-layer setup already registers:

```ts
import { configureStore } from "@reduxjs/toolkit";
import {
  coreApiSlice,
  mentorReducer,
  mentorMiddleware,
} from "@iblai/iblai-js/data-layer";
import {
  chatSliceReducerShared,
  chatInputSliceReducer,
  filesReducer,
  hostChatReducer,
  rbacReducer,
  subscriptionReducer,
  topBannerReducer,
} from "@iblai/iblai-js/web-utils";

export const makeStore = () =>
  configureStore({
    reducer: {
      chat: hostChatReducer,
      chatInput: chatInputSliceReducer,
      chatSliceShared: chatSliceReducerShared,
      files: filesReducer,
      rbac: rbacReducer,
      subscription: subscriptionReducer,
      topBanner: topBannerReducer,
      [coreApiSlice.reducerPath]: coreApiSlice.reducer,
      ...mentorReducer,
    },
    middleware: (gdm) =>
      gdm().concat(coreApiSlice.middleware, ...mentorMiddleware),
  });
```

The slice **keys matter** — the SDK's selectors hard-code paths like
`state.chat.enableChatActionsPopup` and `state.rbac.rbacPermissions`.
Don't rename them.

## Step 6: Create the Route

Create `app/agents/[mentorId]/chat-new/page.tsx`:

```tsx
"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chat, type ChatConfig } from "@iblai/iblai-js/web-containers/next";
import {
  useUsername,
  useAxdToken,
  useUserTenants,
  useVisitingTenant,
  useIsAdmin,
} from "@iblai/iblai-js/web-utils";
import { redirectToAuthSpa } from "@/lib/utils";
import { config } from "@/lib/config";

export default function AgentChatPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AgentChatPage />
    </Suspense>
  );
}

function AgentChatPage() {
  const { mentorId } = useParams<{ mentorId: string }>();
  const router = useRouter();
  const [tenantKey, setTenantKey] = useState("");

  useEffect(() => {
    const appTenant = localStorage.getItem("app_tenant");
    const tenant = localStorage.getItem("tenant");
    let currentTenant = "";
    try {
      currentTenant =
        JSON.parse(localStorage.getItem("current_tenant") ?? "{}")?.key ?? "";
    } catch {}
    setTenantKey(
      appTenant || currentTenant || tenant || config.mainTenantKey(),
    );
  }, []);

  const username = useUsername();
  const axdToken = useAxdToken();
  const { userTenants } = useUserTenants();
  const { visitingTenant } = useVisitingTenant();
  const isAdmin = useIsAdmin();

  const chatConfig: ChatConfig = {
    baseWsUrl: () => config.wsUrl(),
    supportEmail: () => config.supportEmail(),
    authUrl: () => config.authUrl(),
    mainTenantKey: config.mainTenantKey(),
    navigateToAdminBilling: () =>
      router.push(`/agents/${mentorId}/settings?tab=billing`),
    navigateToExplore: () => router.push("/agents"),
    navigateToMentor: (id) => router.push(`/agents/${id}`),
  };

  if (!tenantKey) return null;

  return (
    <div className="flex h-screen w-full flex-col">
      <Chat
        isPreviewMode={false}
        mentorId={mentorId}
        tenantKey={tenantKey}
        config={chatConfig}
        redirectToAuthSpa={redirectToAuthSpa}
        username={username ?? null}
        userTenants={userTenants ?? []}
        visitingTenant={visitingTenant}
        axdToken={axdToken ?? ""}
        userIsStudent={!isAdmin}
      />
    </div>
  );
}
```

**Why each piece:**

| Item | Why |
|------|-----|
| `"use client"` | `Chat` is a client component (uses hooks, WebSocket, localStorage). |
| `export const dynamic = "force-dynamic"` | Prevents Next.js from trying to statically pre-render this page. |
| `<Suspense fallback={null}>` | The `Chat` tree uses `useSearchParams()`, which requires a Suspense boundary in App Router. |
| `redirectToAuthSpa` from `@/lib/utils` | Host-owned redirect to the auth SPA. The SDK never owns navigation. |
| `config` from `@/lib/config` | Reads runtime env (`window.__ENV__`) so the same build runs across environments. |
| Read `tenantKey` from localStorage with `mainTenantKey` fallback | Matches what `/iblai-auth` writes after SSO completes. |

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `mentorId` | `string` | yes | Agent/mentor UUID |
| `tenantKey` | `string` | yes | Platform/tenant key |
| `config` | `ChatConfig` | yes | URLs + navigation callbacks (see below) |
| `redirectToAuthSpa` | `(redirectTo?, platformKey?, logout?) => void` | yes | Host-owned auth redirect |
| `username` | `string \| null` | yes | Current user; `null` for anonymous |
| `userTenants` | `Tenant[]` | yes | User's accessible tenants (from `useUserTenants`) |
| `axdToken` | `string` | yes | AXD auth token |
| `userIsStudent` | `boolean` | yes | RBAC role hint |
| `visitingTenant` | `Tenant \| undefined` | no | Set when viewing another tenant's mentor |
| `isPreviewMode` | `boolean` | yes | `true` for admin preview surfaces |
| `mode` | `"default" \| "advanced"` | no | `"advanced"` enables the builder UI |
| `isPublicRoute` | `boolean` | no | Set for unauthenticated share links |
| `canvasView` / `disclaimerModal` / `advancedChatHeader` / `advancedChatBuilder` / `liveKitChat` / `liveKitScreenSharing` / `welcomeChat` / `promptGalleryModal` | `React.ComponentType<...>` | no | Slot overrides — pass your own component to replace, omit to use the bundled defaults |
| `onSubscriptionGate` | `(action, isAdminAction?) => void` | no | Gate sends behind a billing/quota check |
| `on402Error` | `(data) => void` | no | Handle HTTP 402 from the chat backend |
| `canPerformAction` | `(resource) => boolean` | no | RBAC predicate forwarded to the input form |
| `renderDocumentSidebar` | `(sessionId) => ReactNode` | no | Document sidebar slot for mobile/tablet |
| `projectId` / `onExploreClick` / `onMentorClick` / `projectLandingPage` | mixed | no | Welcome-surface customization |

### `ChatConfig`

| Field | Type | Description |
|-------|------|-------------|
| `baseWsUrl` | `() => string` | WebSocket origin (`wss://asgi.data.iblai.org`) |
| `supportEmail` | `() => string` | Footer / error-toast support email |
| `authUrl` | `() => string` | Auth SPA origin |
| `mainTenantKey` | `string` | Default tenant key |
| `navigateToAdminBilling` | `() => void` | Open the billing tab |
| `navigateToExplore` | `() => void` | "Browse All" agents link |
| `navigateToMentor` | `(mentorUniqueId: string) => void` | Open an individual mentor |
| `appSyncBanner?` | `{ badge, text, link, linkText } \| null` | Optional sync-status banner |

## Step 7: Verify

Start the dev server and walk the flow:

1. `pnpm build` — must pass with zero errors.
2. `pnpm dev` — open
   `http://localhost:3000/agents/<NEXT_PUBLIC_DEFAULT_AGENT_ID>/chat-new`.
3. You'll be bounced to `auth.iblai.org/login`. Sign in (password or
   magic link). Auth redirects you to `/sso-login-complete`, which
   writes `axd_token`, `userData`, `current_tenant`, and `tenants` to
   localStorage and forwards you back into the app.
4. Navigate back to `/agents/<id>/chat-new`. The page should render:
   - the mentor's name and greeting at the top,
   - an "Ask anything" textarea,
   - action buttons: Attach file, Canvas, Screen Sharing, Voice input,
     Voice call, Send message,
   - conversation starters underneath.
5. Type a message and hit Send. On the first send you'll see a
   **User Agreement** modal — click "I Accept". The message bubble
   renders, the "is generating a response…" indicator appears, and
   guided prompts get fetched. Whether the agent's reply streams back
   successfully depends on the mentor's LLM configuration — if you see
   a "Sorry about that! An error occurred." toast, that's a server-side
   issue with the langflow runtime, not the client wiring.

## CLI Integration (proposal — not yet implemented)

This skill is a manual flow. A future `iblai add agent-chat` command
should:

1. **Install deps** — the nine packages from Step 3.
2. **Patch `providers/index.tsx`** — wrap with `ServiceWorkerProvider`,
   add `skip={isSsoLoginRoute}` to `TenantProvider`.
3. **Patch `store/index.ts`** — register `chat`, `chatInput`, `rbac`,
   `subscription`, `topBanner` slices alongside whatever already
   exists.
4. **Scaffold the route** — write
   `app/agents/[mentorId]/chat-new/page.tsx` parameterized on the
   host's existing `redirectToAuthSpa` and `config` helpers.
5. **Skip if already added** — detect existing slice keys / provider
   wraps and no-op rather than duplicate.

The generator should not regenerate `/iblai-chat` artifacts — the two
skills are independent and a host can install both (different routes).

**Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)
