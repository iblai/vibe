# Chat — resuming and starting sessions; host history list

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Resuming / starting sessions

`<Chat>` has **no `sessionId` prop** and does **not** read a `session`
URL param. Sessions live in `localStorage` via `useCachedSessionId()`
→ `{ [mentorId]: sessionId }`, read once at mount.

- **Resume** (e.g. host history link → `?session=<id>`): seed
  `cachedSessionId[mentorId] = id` before mount, gate render, key
  `<Chat>` on the id (Step 6).
- **New chat:** `delete cachedSessionId[mentorId]` + remount via a
  changing key nonce (`?new=<ts>`). Just navigating does **not** start a
  new chat — the SDK resumes the persisted session.
- **There is no host-readable "conversation loaded" signal.**
  `isLoadingChats` is internal to `useAdvancedChat`; `chatSliceShared`
  is not reset between sessions, so `selectSessionId` /
  `selectNumberOfActiveChatMessages` read **stale** on first render.
  For a "loading" overlay during resume, use a guaranteed-minimum +
  hard-capped **timer**, not a slice-derived condition.

### Host history list (`getChatHistory`)

Endpoint: `/api/ai-analytics/orgs/{org}/users/{user_id}/chat-history/`.
- `userId` → **URL path** `{user_id}` (required to form the URL; absent
  from the d.ts arg type but real).
- `filterUserId` → **`filter_user_id` query** — what actually restricts
  results. For an **org admin** the path alone returns org-wide; pass
  **both** `userId` and `filterUserId` (= signed-in username) to scope
  to the current user.
