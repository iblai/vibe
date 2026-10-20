# iblai-vibe-agent-chat

> Add the in-process Chat SDK component (full agent surface — message stream, canvas, file attach, voice, prompts) to a Next.js app

# /iblai-vibe-agent-chat

> **First time here?** If `iblai.env` has no `ARCHITECTURE=`, run `/iblai-vibe-start` first (four questions; two minutes) — it decides single-org / multi-org / headless and who signs in, and every skill reads the answer.

Add the full ibl.ai agent chat surface — welcome screen, message stream
with per-message actions, composer (`+` menu, tool chips, file cards,
`/` skill picker), suggested prompts, canvas, voice input, voice call,
screen sharing — to your Next.js app. Uses the `Chat` React component
from `@iblai/iblai-js/web-containers/next`, which renders **in-process**
(not in an iframe) and shares the host app's Redux store, providers, and
auth session. This text describes the redesigned chat that ships from
`@iblai/iblai-js` 2.36.2.

![Welcome state](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-chat/iblai-vibe-agent-chat-1-welcome.png)
![Message sent (Thinking… while the agent starts, Stop Streaming on the send button)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-chat/iblai-vibe-agent-chat-2-message-sent.png)
![The + menu (Upload File, Camera, Memory)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-chat/iblai-vibe-agent-chat-5-attach-menu.png)
![A finished answer (Thought section, message actions, suggested follow-up prompts)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-chat/iblai-vibe-agent-chat-6-answer-actions.png)
![Canvas card in a response (Open Canvas, follow-up suggestions, Canvas chip on)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-chat/iblai-vibe-agent-chat-3-canvas-card.png)
![Canvas panel open beside the chat (editing toolbar, Export)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-chat/iblai-vibe-agent-chat-4-canvas-panel.png)

> **Template (legacy `<mentor-ai>` widget):** a full-screen `<mentor-ai>`
> web-component ChatWidget (distinct from the in-process `Chat` component
> this skill documents) — bundled as
> [`assets/chat-widget.tsx.j2`](assets/chat-widget.tsx.j2) +
> [`assets/iblai-web-mentor.d.ts`](assets/iblai-web-mentor.d.ts). See
> [`/iblai-vibe-scaffold`](../../start/iblai-vibe-scaffold/SKILL.md) for the `{{ }}` contract.

> **What you get:** the SDK's `Chat` component wired directly into your
> app (in-process, not an iframe). Full feature surface, intercept
> actions, shared auth/store with the rest of your app, themeable with
> your Tailwind config.

Do NOT add custom styles, colors, or CSS overrides to the SDK `Chat`
component. It ships with its own styling. Keep the component as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

> **This is a revised skill.** It folds in everything learned from a
> real brownfield integration (Next.js App Router, React 19, RTK, pnpm,
> sub-path `basePath`). Greenfield apps can mostly follow the happy
> path; brownfield apps must read the **Brownfield** and **Known
> issues** notes — most of the integration cost lives there, not in the
> happy path.

> **Common setup (brand, conventions, env files, verification):** see
> [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`) — the `Chat` component reads
  the axd token, username, and organizations from the providers tree.
- A working store, providers, and SSO callback route — i.e. an app that
  already passes `/iblai-vibe-auth` verification.
- An agent ID (a UUID) — the last path segment of an
  `https://os.ibl.ai/platform/<tenant>/<agent-uuid>` URL the user gave, or
  create an agent on [os.ibl.ai](https://os.ibl.ai) (or with
  `/iblai-api-agent-create`).
- **Minimum SDK versions.** The `Chat` component and its required hooks
  are only present in recent SDKs. Older-but-recent installs silently
  lack them. Require at least:

  | package | min version |
  |---|---|
  | `@iblai/iblai-js` | `^2.44.0` |
  | `@iblai/agent-ai` | `^2.10.0` |

  (v2 bundles `web-containers`, `web-utils`, and `data-layer` as
  `@iblai/iblai-js/*` subpaths — do not install the separate v1 packages.)

- **Pre-flight export check (do this before writing any code):**

  ```bash
  grep -qE "declare function Chat\b|type ChatConfig" \
    node_modules/@iblai/web-containers/dist/next/index.d.ts \
    && echo "Chat present" \
    || echo "MISSING — upgrade the SDK packages (see Step 3)"
  ```

  `@iblai/iblai-js/web-containers/next` re-exports `@iblai/web-containers/next`;
  the component physically lives in `@iblai/web-containers`. If the
  check fails, the rest of this skill cannot work — upgrade first.

> **Caveat: the SDK `.d.ts` is incomplete and sometimes misleading.**
> Several runtime props/args (e.g. `getChatHistory`'s `userId` path
> param) are absent from the type defs, and some documented slot props
> are typed but not implemented. When something doesn't match, verify
> against `node_modules/@iblai/web-containers/dist/next/index.esm.js`
> (the actual bundle), not just the types.

## What Gets Wired

| File | Change |
|------|--------|
| `package.json` | Adds SDK packages + peers (Step 3) |
| `providers/index.tsx` | Wraps tree in `<ServiceWorkerProvider>`; `skip={isSsoLoginRoute}` on `AuthProvider` / `TenantProvider` (Step 4) |
| `public/sw.js` | The SDK offline service worker — required by `ServiceWorkerProvider` (Step 4) |
| `next.config.*` | `Service-Worker-Allowed` header for sub-path mounts; `reactStrictMode:false` (Step 4, Known issues) |
| `store/index.ts` | Registers `chat`, `chatInput`, `chatSliceShared`, `files`, `rbac`, `subscription`, `topBanner` reducers (Step 5) |
| `app/agents/[mentorId]/chat-new/page.tsx` | New route rendering `<Chat>` with resume/new-chat handling (Step 6) |
| `components/radix-pointer-events-guard.tsx` | Host recovery for the SDK prompt-gallery teardown bug (Known issues) |

## Step 1: Check Environment

The API URLs default to hosted `iblai.app` in `lib/iblai/config.ts`, so
`.env.local` only needs:

```bash
NEXT_PUBLIC_MAIN_TENANT_KEY=your-platform
NEXT_PUBLIC_DEFAULT_AGENT_ID=<agent uuid>
```

Note: some host `config` helpers don't expose `supportEmail()`. If
yours doesn't, read `process.env.NEXT_PUBLIC_SUPPORT_EMAIL` directly in
`ChatConfig` (Step 6) — don't assume the helper has every field.

## Step 2: Get the Agent ID

If the user already gave an os.ibl.ai URL
(`https://os.ibl.ai/platform/<tenant>/<agent-uuid>`), the UUID is its last
path segment — use it, don’t ask. Otherwise ask the user for their
agent UUID. Write it directly to `.env.local` using the Edit tool —
do NOT echo it back in shell commands:

```
NEXT_PUBLIC_DEFAULT_AGENT_ID=<the-uuid>
```

If the user doesn't have one, direct them to create an agent on
https://os.ibl.ai (or run `/iblai-api-agent-create`).

## Step 3: Install Dependencies

```bash
pnpm add @iblai/data-layer @iblai/web-containers @iblai/web-utils \
         @iblai/agent-ai \
         react-paginate livekit-client \
         @livekit/components-react @livekit/components-styles \
         @tauri-apps/plugin-os @tauri-apps/api
```

Why each one:

| Package | Used by |
|---------|---------|
| `@iblai/data-layer`, `@iblai/web-containers`, `@iblai/web-utils` | Hoist SDK packages to top-level `node_modules` so the bundler resolves them from the host |
| `@iblai/agent-ai` | Voice/agent web component — **dynamically imported by `<Chat>`** (`import('@iblai/agent-ai')`). Easy to miss; its absence is a hard build error |
| `react-paginate` | Peer of `@iblai/web-containers` (agent search pagination) |
| `livekit-client`, `@livekit/components-react`, `@livekit/components-styles` | Voice call / screen-sharing |
| `@tauri-apps/plugin-os`, `@tauri-apps/api` | OS detection (Tauri desktop wrapper) |

> **All of these are build-time-required, even the runtime-guarded
> ones.** `<Chat>` statically/dynamically imports them; a missing
> package is a hard `Module not found` from Turbopack/Webpack, **not** a
> soft runtime fallback. Don't defer any of them "until needed".

If on a fresh upgrade you hit `Module not found: Can't resolve
'@iblai/...'` for a name you *did* install, the export may have moved
between subpaths — e.g. `AgentSearchResult` moved from
`@iblai/iblai-js/web-containers` to `@iblai/iblai-js/web-containers/next`.
Expect to fix a few import paths after an SDK bump; the
`/web-containers` vs `/web-containers/next` split is real (the chat
component lives under `/next`).

## Step 4: Wire the Providers + Service Worker

The `Chat` component uses `useAuthContext`, `useTenantContext`,
`useEmbedMode`, `useServiceWorker`, and several Redux hooks. The host
needs all of these.

### 4a. Providers

In `providers/index.tsx`:

1. Import `ServiceWorkerProvider` from `@iblai/iblai-js/web-utils`.
2. Wrap the existing `<AuthProvider>` tree in `<ServiceWorkerProvider>`.
3. Pass `skip={isSsoLoginRoute}` to **both** `<AuthProvider>` and
   `<TenantProvider>` so the `/sso-login-complete` callback page doesn't
   crash on missing context.
4. **Pass `basePath` if the app is mounted under a sub-path** (e.g.
   `NEXT_PUBLIC_BASE_PATH=/hq`):

```tsx
import {
  AuthProvider,
  TenantProvider,
  MentorProvider,
  ServiceWorkerProvider,
} from "@iblai/iblai-js/web-utils";

return (
  <ServiceWorkerProvider basePath={config.basePath() /* "" or "/hq" */}>
    <AuthProvider /* …, */ skip={isSsoLoginRoute}>
      <TenantProvider /* …, */ skip={isSsoLoginRoute}>
        <MentorProvider {...mentorProps}>{children}</MentorProvider>
      </TenantProvider>
    </AuthProvider>
  </ServiceWorkerProvider>
);
```

### 4b. Ship the service worker (required)

`ServiceWorkerProvider` calls
`navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: basePath || "/" })`.
**The host must provide `public/sw.js`** — the SDK does not ship a
copyable one. Without it, registration 404s (non-fatal but noisy, and
offline is disabled). Use the SDK's standard offline worker (generic;
cache-in-background, serve-from-cache only when Tauri+offline). A known
working `sw.js` is bundled with this skill — copy it to `public/sw.js`.

### 4c. `Service-Worker-Allowed` header (sub-path mounts only)

If the app is under a `basePath`, the script lives at `/hq/sw.js`,
whose default max scope is `/hq/`, but the provider registers with
`scope: "/hq"` → `SecurityError: scope ('/hq') is not under the max
scope allowed ('/hq/')`. Fix in `next.config`:

```js
async headers() {
  return [
    {
      source: '/sw.js', // Next prefixes basePath → matches /hq/sw.js
      headers: [{ key: 'Service-Worker-Allowed', value: basePath || '/' }],
    },
  ]
}
```

(No-op safe when there's no basePath: header value `/`.)

## Step 5: Register Store Reducers

In `store/index.ts`, register these reducers. **The SDK's selectors
hard-code these exact keys** (`state.chat`, `state.rbac`, …) — they are
non-negotiable:

```ts
import {
  coreApiSlice, mentorReducer, mentorMiddleware,
} from "@iblai/iblai-js/data-layer";
import {
  hostChatReducer,
  chatInputSliceReducer,
  chatSliceReducerShared,
  filesReducer,
  rbacReducer,
  subscriptionReducer,
  topBannerReducer,
} from "@iblai/iblai-js/web-utils";

reducer: {
  chat: hostChatReducer,
  chatInput: chatInputSliceReducer,
  chatSliceShared: chatSliceReducerShared, // used by useAdvancedChat; NOT in mentorReducer
  files: filesReducer,
  rbac: rbacReducer,
  subscription: subscriptionReducer,
  topBanner: topBannerReducer,
  [coreApiSlice.reducerPath]: coreApiSlice.reducer,
  ...mentorReducer,
}
```

> **Brownfield: store-key collisions.** A mature app very likely already
> has its own `chat` / `files` (or `rbac`/`subscription`/…) slices with
> different shapes. The SDK's keys are fixed, so **rename the host's
> slices**, not the SDK's. Find collisions first:
>
> ```bash
> grep -rn "state\.\(chat\|files\|rbac\|subscription\|topBanner\|chatInput\)\b" \
>   --include="*.ts" --include="*.tsx" app components lib hooks
> ```
>
> Rename each host slice (e.g. `chat → v0Chat`) and migrate **every
> selector** that reads it (slice `name` and action creators are
> key-agnostic — only `useSelector(s => s.<key>)` accesses change).
> `mentorReducer` is RTK Query API slices only; it does **not** shadow
> plain feature slices like `chat`/`files`.

The slice **keys matter** — don't rename them. `mentorMiddleware` is
still concatenated as before.

## Step 6: Create the Route

Create `app/agents/[mentorId]/chat-new/page.tsx`. This version handles
session resume, new-chat, the `useSearchParams` Suspense requirement,
and the mounting discipline (see notes after the code):

```tsx
"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Chat, type ChatConfig } from "@iblai/iblai-js/web-containers/next";
import {
  useUsername, useAxdToken, useUserTenants, useVisitingTenant,
  useIsAdmin, useCachedSessionId,
} from "@iblai/iblai-js/web-utils";
import { redirectToAuthSpa } from "@/lib/iblai/auth-utils";
import config from "@/lib/iblai/config";

export default function AgentChatPageWrapper() {
  // `useSearchParams()` requires a Suspense boundary in the App Router
  // (the SDK <Chat> tree uses it too).
  return (
    <Suspense fallback={null}>
      <AgentChatPage />
    </Suspense>
  );
}

function AgentChatPage() {
  const { mentorId } = useParams<{ mentorId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resume (`?session=<id>`) or new chat (`?new=<nonce>`). The SDK reads
  // its per-mentor cached-session map (`useCachedSessionId`,
  // localStorage `{ [mentorId]: sessionId }`) ONCE at <Chat> mount
  // (`isNewSession = cachedSessionId[mentorId] ? false : true`). So seed
  // (resume) or clear (new) BEFORE mount, gate the render until done,
  // and key <Chat> on session/new so switching remounts it.
  const restoreSessionId = searchParams.get("session") ?? undefined;
  const newParam = searchParams.get("new") ?? undefined;
  const [cachedSessionId, saveCachedSessionId] = useCachedSessionId();
  const [seededFor, setSeededFor] = useState<string | undefined>(
    restoreSessionId || newParam ? undefined : "none",
  );
  useEffect(() => {
    if (!mentorId) { setSeededFor("none"); return; }
    const map = { ...((cachedSessionId ?? {}) as Record<string, string>) };
    if (restoreSessionId) {
      if (map[mentorId] !== restoreSessionId) {
        saveCachedSessionId({ ...map, [mentorId]: restoreSessionId });
      }
      setSeededFor(restoreSessionId);
    } else if (newParam) {
      if (map[mentorId]) { delete map[mentorId]; saveCachedSessionId(map); }
      setSeededFor(`new:${newParam}`);
    } else {
      setSeededFor("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSessionId, newParam, mentorId]);
  const sessionReady = restoreSessionId
    ? seededFor === restoreSessionId
    : newParam
      ? seededFor === `new:${newParam}`
      : true;

  const [tenantKey, setTenantKey] = useState("");
  useEffect(() => {
    const appTenant = localStorage.getItem("app_tenant");
    const tenant = localStorage.getItem("tenant");
    let currentTenant = "";
    try {
      currentTenant =
        JSON.parse(localStorage.getItem("current_tenant") ?? "{}")?.key ?? "";
    } catch {}
    setTenantKey(appTenant || currentTenant || tenant || config.mainTenantKey());
  }, []);

  const username = useUsername();
  const axdToken = useAxdToken();
  const { userTenants } = useUserTenants();
  const { visitingTenant } = useVisitingTenant();
  const isAdmin = useIsAdmin();

  const chatConfig: ChatConfig = {
    baseWsUrl: () => config.baseWsUrl(),
    // Host config may not expose supportEmail — fall back to env.
    supportEmail: () =>
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@ibl.ai",
    authUrl: () => config.authUrl(),
    mainTenantKey: config.mainTenantKey(),
    navigateToAdminBilling: () =>
      router.push(`/agents/${mentorId}/settings?tab=billing`),
    navigateToExplore: () => router.push("/agents"),
    navigateToMentor: (id) => router.push(`/agents/${id}`),
  };

  if (!tenantKey || !sessionReady) return null;

  return (
    <div className="flex h-screen w-full flex-col">
      <Chat
        // Key on mentor+session+new so an intentional switch remounts
        // <Chat> and the SDK re-reads the cached session. Do NOT remount
        // it any other way (see "Mounting discipline").
        key={`${mentorId}:${restoreSessionId ?? ""}:${newParam ?? ""}`}
        isPreviewMode={false}
        mentorId={mentorId}
        tenantKey={tenantKey}
        config={chatConfig}
        // Wrap so the callback is `=> void` (host helpers are often
        // async / extra-arg; SDK type wants `(…) => void`).
        redirectToAuthSpa={(to, key, logout) =>
          void redirectToAuthSpa(to, key, logout)
        }
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
| `"use client"` + `dynamic = "force-dynamic"` | `Chat` is client-only; prevent static pre-render |
| `<Suspense>` wrapper | `useSearchParams()` requires a Suspense boundary in App Router |
| `useCachedSessionId` seeding + render gate | only way to resume / start-new (no `sessionId` prop, no URL handling — see "Resuming / starting sessions") |
| `key={mentor:session:new}` | the ONLY safe remount; switching session needs it |
| `void redirectToAuthSpa(...)` wrapper | SDK type is `(…) => void`; host helper is often `async` |
| env fallback for `supportEmail` | host `config` may not expose it |

## Mounting discipline

The SDK reads session/voice state **once at `<Chat>` mount** and has an
`isMounted` defect (see Known issues), so an unintended remount is
destructive (loses session, wedges voice). Rules:

- **Never** conditionally swap subtrees around `<Chat>`
  (`isMobile ? <A/> : <B/>` with `<Chat>` in both → remount on
  breakpoint resolve). Use one stable tree and change **layout via
  props** (e.g. `ResizablePanelGroup direction`), not subtree swaps.
- The **only** legitimate remount is an intentional session/new-chat
  `key` change (Step 6).
- `const el = (<Chat .../>)` reused in the same JSX position is fine
  (React reconciles — not a remount).

## Resuming / starting sessions

`<Chat>` has no `sessionId` prop and reads no URL param: sessions live in `localStorage` via `useCachedSessionId()` and are read once at mount — seed (resume) or clear (new) before mounting and key `<Chat>` on it, exactly as Step 6 does. Details, the missing "conversation loaded" signal, and the `getChatHistory` host list: [`references/sessions.md`](references/sessions.md).

## What the chat shows

Everything below is the SDK's own UI; none of it needs host code. The
agent's own settings and your `config.features` allow-list decide which
controls appear (a host flag can only hide a control, never force it on).

| Area | What the user sees |
|------|--------------------|
| Welcome screen | Gradient heading (the agent's name, or a time-of-day greeting with the user's first name when the agent's Welcome screen setting is "personal greeting"), the agent's welcome line, the disclaimer, and the centred composer. Starter prompts show under it as chips only when the host passes `showConversationStarters`, `config.features.suggestedPrompts` is not `false` and the agent's "Starter prompts" setting is not "none" (the agent's `guided_prompts_count`, 1-10, sets how many on desktop; phones show rows capped at 4); "Explore Agents" below the first screen needs `showExploreMentors` |
| Message list | Right-aligned user bubbles; the agent's bubble with name and time, a collapsible "Thought" section for reasoning, markdown with code blocks (Copy) and tables (copy / download), and "Thinking…" until the first token |
| Message actions | Under each finished reply: Copy and Read aloud for everyone; thumbs up / down, Retry, Report, Share and Download for signed-in users (Share and Download also for visitors with `showMessageActionsWhenLoggedOut`, both hidden under chat privacy; Report needs the agent's inappropriate-content setting; thumbs, Retry and Report are hidden when viewing a shared chat) |
| Suggested prompts | After a reply, up to three follow-up chips and a refresh button. Picking one sends it |
| Composer | `+` menu (Upload File, Camera, then Tools, Skills, Prompts, Memory, and a Model picker when the agent allows it), a Canvas pill that turns off with its x, tool chips (two shown, the rest fold into "+N"), screen share, voice input, voice call, and Send, which becomes Stop Streaming while the agent answers |
| Attachments | File cards above the input: uploading, processing, failed (with retry), too large, and long pastes that become a `.txt` card |
| `/` skill picker | Typing `/` in the input lists the agent's skills by name. It needs the per-agent `view_skill_assignments` grant in the `rbac` store, which `Chat` and vibe-starter's providers do not load, so in vibe-starter it stays empty unless you pass `slashSkills`; `slashSkillsEnabled={false}` turns it off |
| Canvas | An agent reply that creates a document shows a card with **Open Canvas**; the panel opens beside the chat with an editing toolbar and Export. Tables show as plain pipe text unless you pass GFM-aware `markdownToHtml` / `htmlToMarkdown` in `config` |
| Embed | With `embed` (or `?embed=true`) the chat drops its card border, widens the composer to about 680px, and shows up to four full-width suggested-prompt rows above the disclaimer; "Explore Agents" is never shown |
| Phones | The `+` menu becomes a bottom sheet and the composer pins to the bottom |

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `mentorId` | `string` | yes | Agent UUID |
| `tenantKey` | `string` | yes | Organization (platform) key |
| `config` | `ChatConfig` | yes | URLs + navigation callbacks |
| `redirectToAuthSpa` | `(redirectTo?, platformKey?, logout?) => void` | yes | Host-owned auth redirect (wrap async helpers to `=> void`) |
| `username` | `string \| null` | yes | Current user; `null` for anonymous |
| `userTenants` | `Tenant[]` | yes | From `useUserTenants` |
| `axdToken` | `string` | yes | AXD auth token |
| `userIsStudent` | `boolean` | yes | RBAC role hint |
| `visitingTenant` | `Tenant \| undefined` | no | Viewing another organization's agent |
| `isPreviewMode` | `boolean` | yes | `true` for admin preview |
| `mode` | `"default" \| "advanced"` | no | `"advanced"` enables builder UI |
| `isPublicRoute` | `boolean` | no | Unauthenticated share links |
| `hasBorder` | `boolean` | no | Card border around the chat. Default `true` |
| `isInCanvasView` | `boolean` | no | Set when the chat itself is rendered inside the canvas view |
| `embed` | `boolean` | no | Embedded (iframe widget) presentation. Defaults to the `?embed=true` query param |
| `labels` | `DeepPartial<ChatLabels>` | no | Override any user-visible string, keyed like the SDK catalogue (`chat.<component>.<key>`). Omitted strings use the catalogue for the active locale |
| `slots` | `ChatSlots` | no | `{ composerExtraControls?: ReactNode }` — extra controls rendered first in the composer's tool row. The only slot in 2.36.x |
| `showConversationStarters` | `boolean` | no | Show the welcome screen's starter prompts. Default `false` |
| `showExploreMentors` | `boolean` | no | Show "Explore Agents" on the welcome screen and the project agents list. Default `false`; the agent's own setting still applies |
| `slashSkillsEnabled` | `boolean` | no | `/` skill picker. On unless `false`, but it fetches only with `config.features.skills` and the per-agent `view_skill_assignments` grant already in the `rbac` store (nothing in `Chat` loads it); otherwise pass `slashSkills` |
| `slashSkills`, `slashSkillsLoading` | `EffectiveAgentSkill[]`, `boolean` | no | A host-supplied skill list for the `/` picker (`EffectiveAgentSkill` is exported from `@iblai/iblai-js/data-layer`), and its loading flag |
| `projectId` | `string` | no | Scope the chat to a project (a new chat renders the project landing page) |
| `redirectToAuthSpaJoinTenant` | `() => void` | no | Sends a signed-in user who is not a member of the organization to the auth app's join flow |

> The old slot overrides (`canvasView`, `disclaimerModal`,
> `advancedChatHeader`, `advancedChatBuilder`, `liveKitChat`,
> `liveKitScreenSharing`, `welcomeChat`, `promptGalleryModal`) do not
> exist. Host UI goes through `slots`, `labels` and `config`.

### `ChatConfig`

| Field | Type | Description |
|-------|------|-------------|
| `baseWsUrl` | `() => string` | WebSocket origin |
| `supportEmail` | `() => string` | Footer / error-toast email (env fallback if host config lacks it) |
| `authUrl` | `() => string` | Auth SPA origin |
| `mainTenantKey` | `string` | Default organization key |
| `navigateToAdminBilling` | `() => void` | Open the billing tab |
| `navigateToExplore` | `() => void` | "Browse All" agents link |
| `navigateToMentor` | `(id: string) => void` | Open an individual agent |
| `appSyncBanner?` | `{ badge, text, link, linkText } \| null` | Optional sync banner |
| `features?` | `ChatFeatures` | Allow-list: `voiceCall`, `dictation`, `screenShare`, `fileUpload`, `camera`, `canvas`, `memory`, `prompts`, `skills`, `suggestedPrompts`, `cowork`. All default `true`; `false` hides the control |
| `navigateToProject?` | `(projectId: string, mentorId: string) => void` | Open a project |
| `onUpgradeRequired?` | `(proceed, isAdminAction?) => unknown` | Paywall gate; run `proceed` when the user may continue. Without it every gated action runs |
| `on402Error?` | `(data) => void \| Promise<void>` | Credits exhausted. Defaults to the SDK's pricing modal / billing tab / top banner |
| `onSessionChange?` | `(sessionId: string) => void` | Called whenever the active session id changes |
| `freeTrialDialog?` | `{ component, isOpen, onClose } \| null` | Upgrade dialog the chat renders while `isOpen`; `null` renders none |
| `markdownComponent?` | `ComponentType<{ children?: string; className?: string }>` | Custom renderer for message bodies |
| `markdownToHtml?`, `htmlToMarkdown?` | `(s: string) => string` | Canvas converters; pass a richer pair (tables, math) so canvas output matches chat |
| `dmUrl?` | `() => string` | Data-manager URL for "Read aloud"; browser speech when absent |
| `allowedParentOrigins?`, `postMessageTargetOrigin?` | `string[]`, `string` | Origins allowed to message the chat (embedding page), and where it posts back. Default: same origin only |
| `streamingFocusManagement?` | `boolean` | Moves focus to Stop while streaming and to the last reply's Copy when done (WCAG 2.4.3). Default `true` |

Also optional: `onScreenShare`, `onVoiceCall`, `eventBus`, `browse`,
`suppressChatErrorToast`, `isOnline`, `enableSupportPhone`,
`defaultSupportPhoneNumber`, `maximumCharacterSizeToCopy`,
`exploreMentorsPublicFallback`, `showMessageActionsWhenLoggedOut`.

`ChatProps`, `ChatConfig`, `ChatFeatures`, `ChatLabels`, `ChatSlots` and
`ChatBrowseBridge` are exported as types from
`@iblai/iblai-js/web-containers/next`.

## Known issues & host workarounds

Two SDK defects were found against `web-containers@1.6.14`: voice "Processing…" hangs after any remount (`Chat`'s own dictation hook resets its ref on setup in 2.36.2, so the root cause is gone there, but the `useVoiceChat` exported by `@iblai/iblai-js/web-utils` (web-utils 2.8.0) still never sets its ref back to `true`; vibe-starter still sets `reactStrictMode: false` and never remounts `<Chat>` except through its key) and the prompt-gallery dialog can leave the app unclickable (not re-checked on 2.36.2; mount `RadixPointerEventsGuard` once at the root — vibe-starter ships it as `components/radix-pointer-events-guard.tsx`). Full analysis and the guard's source: [`references/known-issues.md`](references/known-issues.md).

## Step 7: Verify

1. `pnpm build` — must pass with zero errors. (Watch for
   `Module not found` on the Step 3 peers, esp. `@iblai/agent-ai`.)
2. `pnpm test` — host unit suite still green (esp. any slices you
   renamed in the Brownfield step).
3. `pnpm dev` — open the route, sign in, and walk:
   - agent name + greeting, "Ask anything" textarea, the `+` menu
     (Upload File / Camera / Memory), Canvas pill, screen share /
     voice input / voice call (screen share when the agent enables it),
     and Send;
   - send a message → "I Accept" the User Agreement → your bubble +
     "Thinking…" and a Stop Streaming button, then the reply with its
     action row (Copy, thumbs, Share, Download, Report, Read aloud, Retry;
     some depend on sign-in and agent settings) and follow-up prompt chips;
   - **voice**: record → transcription clears "Processing…" (if it
     hangs, the StrictMode workaround isn't applied or `<Chat>` is
     remounting);
   - **prompt gallery** (`+` menu → Prompts, when the agent has prompts): open then close → app still clickable (guard
     working);
   - **resume/new** (if wired): history link loads the conversation;
     "new chat" starts empty.

**Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)