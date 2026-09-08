# Profile metadata — concepts, use cases & best practices

Doc-sourced background for the per-user metadata store. The endpoints, request bodies,
schema, and error table are the authoritative surface in `SKILL.md`; this file carries the
concepts, use-case patterns, and best practices that don't belong in the endpoint reference.

## What the store is for

A per-user, per-org key-value store. Each user holds an **independent** metadata object in
every org they belong to (keyed by `{username}` × `platform_key`), so the same account can
carry different state in each org — enabling context-aware apps. It targets four kinds of
data:

- **User preferences** — theme, language, notification settings.
- **Application settings** — UI state, feature toggles, onboarding progress.
- **Feature flags** — progressive rollout, A/B testing, beta-feature access.
- **Custom data** — any key-value pairs your app needs to persist per user.

For the org-wide counterpart (settings/metadata shared across an org, not per user) see
`/iblai-api-org`; for the signed-in user's profile identity see `/iblai-api-profile`.

## Use-case patterns

Each shows a concrete metadata shape; all are PATCH merges unless noted.

- **User preferences.** Store flat keys like `theme` and `fontSize`; the app reads them on
  load and applies them (`applyTheme(metadata.theme)`, `setFontSize(...)`).
- **Feature flags.** An org admin PATCHes *another* user (`&username=beta_tester`) a nested
  `features` object — e.g. `{ "newDashboard": true, "aiAssistant": true, "advancedReports": false }`.
  The app then gates UI on `metadata.features?.newDashboard`. This is an admin cross-user
  write — confirm first; permission model is in `SKILL.md`.
- **Onboarding progress.** Keep a nested `onboarding` object of step booleans
  (`welcomeComplete`, `profileComplete`, `firstTaskComplete`, `tourComplete`) plus a
  `lastStep` marker and a `lastStepTimestamp`; on next login, resume at the first incomplete
  step.
- **Multi-org settings.** The same user writes different `theme` / `notifications` /
  `language` to different orgs (e.g. `platform_key=corporate` light vs
  `platform_key=personal` dark). Per-org isolation keeps them separate with no extra work —
  this is the practical payoff of one object per user × org.

## Best practices

### PATCH vs PUT (intent)
- **PATCH** for incremental work: update specific keys, add new keys, remove keys via
  `delete_keys`, or build metadata up over time — untouched keys stay intact.
- **PUT** to replace wholesale: reset everything to defaults, migrate to a new schema, or
  guarantee no legacy keys remain (PUT drops every key you don't send). Destructive — confirm first.

### Structure & namespacing
The store enforces no schema or namespace — the convention is yours to keep.
- **Prefer flat keys.** One level of nesting is acceptable for logical grouping
  (`ui.{theme,fontSize}`, `notifications.{email,push}`); avoid deep nesting like
  `settings.user.preferences.ui.theme`.
- **Name keys consistently.** Pick one convention (e.g. snake_case `theme_preference`,
  `language_preference`, `notification_preference`) and stick to it; don't mix styles
  (`themePreference`, `lang`, `notifications-setting`).

### Performance
- **Cache** frequently read metadata in application state, and invalidate the cache after
  any write.
- **Batch** changes into a single PATCH (all changed keys at once) rather than one request
  per key.

### Security
- **Never store secrets.** No passwords, API keys, tokens, or PII (card numbers, etc.) —
  only non-sensitive preferences and app state.
- **Allowlist keys on the frontend.** Validate incoming keys against a known allowed set
  before writing and reject anything unexpected.

### Error handling
Fail gracefully: on a non-OK response or a network error, fall back to sensible defaults
(e.g. light theme, `en`, notifications on) instead of breaking the UI. Full status codes
are in the `SKILL.md` error notes.

## Migration strategy
To move to a new metadata schema: **GET** the current object, transform the old keys into
the new shape (supplying defaults for anything missing), then **PUT** the new object to
replace it wholesale. PUT is the right tool because it drops any key not included, so no
legacy keys survive the migration.

## Related skills
- **`/iblai-api-org`** — org-level metadata/settings (the org-wide counterpart to this
  per-user store).
- **`/iblai-api-profile`** — the signed-in user's profile identity (vs. this free-form
  per-user store).
- **`/iblai-api-rbac`** — roles and permissions (the doc's RBAC cross-link).
- **`/iblai-api-notification`** — send notifications to users (the doc's Notifications
  cross-link).
- **Chat metadata** — passing context alongside chat messages to an agent (the doc's
  Chat Metadata cross-link) lives with the agent chat/session skills, not this store.
