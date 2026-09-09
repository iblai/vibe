# The domain model most apps are built on

Three entities carry almost every custom app on the platform. Each row is the
same thing seen four ways: what it is, the SDK hook or component, the skill
with a screen (`ui`), and the headless skill (`api`). ★ marks the families
the platform team considers most important — they get the deepest skills.

## Users

| What | Data | SDK | `ui` skill | `api` skill |
|---|---|---|---|---|
| Identity | username, email, name, bio, image, language, social links | `useUserData`, `useUsername`, `Profile`, `UserProfileDropdown`, `useGetUserMetadataQuery` / `useUpdateUserMetadataEdxMutation` | `/iblai-vibe-profile` ★ | `/iblai-api-profile` ★ |
| Career | education, experience, résumé | `EducationTab`, `ExperienceTab`, `ResumeTab` | `/iblai-vibe-profile` | `/iblai-api-profile` |
| **Custom metadata** | one JSON object per user × org — preferences, flags, onboarding, app state | `useGetUserPlatformMetadataQuery`, `useUpdateUserPlatformMetadataMutation`; `useUserSettings()` in vibe-starter | `/iblai-vibe-user-metadata` ★ | `/iblai-api-profile-metadata` ★ |
| **Memories** | global memories (every agent), the user's two toggles (capture / recall) | `useGetGlobalMemoriesQuery` (+ create/update/delete), `useGetUserMemorySettingsQuery` / `useUpdateUserMemorySettingsMutation`; `Profile` Memory tab | `/iblai-vibe-memory-guide` ★, `/iblai-vibe-memory` | `/iblai-api-agent-memory` ★ |
| Membership and role | which orgs (`tenants[]`), `is_admin`, policies | `useUserTenants`, `useIsAdmin`, `isTenantAdmin()`, `checkRbacPermission` | `/iblai-vibe-admin`, `/iblai-vibe-rbac` | `/iblai-api-management`, `/iblai-api-rbac` |
| Conversations | own history and exports | `History` surface | `/iblai-vibe-history` | `/iblai-api-agent-history` |
| Analytics about a user | learning snapshot, time spent | `useGetLearnerDetailsQuery`, `useTimeTrackingMutation` | `/iblai-vibe-analytics` ★ | `/iblai-api-analytics` ★ |
| Notifications, purchases, spend status | inbox, subscriptions, cap zone | `NotificationDropdown`, `PurchasesTab`, `useGetSpendCapStatusQuery` | `/iblai-vibe-notification`, `/iblai-vibe-monetization-subscription` | `/iblai-api-notification`, `/iblai-api-billing`, `/iblai-api-spend-caps` |

## Agents

| What | Data | SDK | `ui` skill | `api` skill |
|---|---|---|---|---|
| Create | from a template → `unique_id` | server route (`/api/admin/agents` in vibe-starter) | `/iblai-vibe-agent-create` ★ | `/iblai-api-agent-create` |
| **Settings** | name, description, image, category, visibility (`viewable_by_tenant_admins` / `_students` / `viewable_by_anyone`), capability flags (anonymous, featured, LTI, attachments, voice, memory, multi-query RAG, forkable); fork; delete | `AgentSettingsProvider` + `AgentSettingsTab`; `useGetMentorSettingsQuery`, `useEditMentorMutation` (one multipart PUT of changed fields) | `/iblai-vibe-agent-setting` ★ (+ 23 tabs via `/iblai-vibe-agent`) | `/iblai-api-agent-setting` ★ |
| Behavior | prompts, LLM, tools, datasets (RAG), MCP connectors, skills, sandbox, voice | the matching `Agent*Tab` | `/iblai-vibe-agent-{prompt,llm,tool,dataset,mcp,skills,sandbox,voice}` | `/iblai-api-agent-{prompt,llm,tool,dataset,mcp,skill,sandbox}` |
| Guardrails | safety, privacy (PII), disclaimers | `AgentSafetyTab`, `AgentPrivacyTab`, `AgentDisclaimerTab` | `/iblai-vibe-agent-{safety,privacy,disclaimer}` | `/iblai-api-agent-{safety,privacy,disclaimer}` |
| **Memory** | per-user × agent memories by category (extraction prompts); shared agent knowledge | `AgentMemoryTab`; memory hooks | `/iblai-vibe-agent-memory` ★ | `/iblai-api-agent-memory` ★ |
| Access and reach | editor / chat / analytics roles; embed; API keys; LTI | `AgentAccessTab`, `AgentEmbedTab`, `AgentApiTab`, `AgentLtiTab` | `/iblai-vibe-agent-{access,embed,api,lti}` | `/iblai-api-agent-{access,embed}`, `/iblai-api-token` |
| Conversations | chat, sessions, history, support tickets | `Chat`, `AgentSearch`, history and support tabs | `/iblai-vibe-agent-chat`, `-search`, `-history`, `-support` | `/iblai-api-agent-session`, `-chat` (MCP), `-history`, `-support`, `/iblai-api-inference` |
| Quality and cost | evals, grader, audit log, spend cap | `AgentEvalsTab`, `AgentGraderTab`, `AgentAuditTab`, `AgentBillingTab` | `/iblai-vibe-agent-{evals,grader,audit,billing}` | `/iblai-api-agent-{eval,audit}`, `/iblai-api-spend-caps` |
| Analytics about an agent | usage, topics, transcripts, costs (`mentor_unique_id`) | `AnalyticsLayout` tabs with `mentorId` | `/iblai-vibe-analytics` ★ | `/iblai-api-analytics` ★ |

## Organizations

| What | Data | SDK | `ui` skill | `api` skill |
|---|---|---|---|---|
| Identity and branding | name, light/dark logo, support email, help center; the sign-in page's title/logo/copy (`auth_web_*`) | `Account` → `OrganizationTab`; `/iblai-vibe-auth` Step 2 | `/iblai-vibe-account`, `/iblai-vibe-auth` | `/iblai-api-org` |
| **Metadata** | one public JSON object: the OS's own settings (default agent, toggles, help URL) **and** your app's keys under `apps.<slug>`; PUT replaces — GET, merge, PUT | `useGetTenantMetadataQuery`, `useUpdateTenantMetadataMutation`, `useTenantMetadata`; `useOrgSettings()` in vibe-starter | `/iblai-vibe-org-metadata` | `/iblai-api-org` |
| People | users (Admin/User + policies), groups, roles, policies, teams, alerts, invitations, SCIM | `Account` → Management (`Admin`, `UsersTab`, `RolesTab`, `PoliciesTab`), `InviteUserDialog` | `/iblai-vibe-admin`, `/iblai-vibe-invite`, `/iblai-vibe-rbac` | `/iblai-api-management`, `-rbac`, `-invite`, `-scim` |
| Integrations | LLM provider keys, data-source credentials, Platform API Tokens | `Account` → Integrations | `/iblai-vibe-account`, `/iblai-vibe-credential` | `/iblai-api-integration`, `-token` |
| Money | plan, credits, auto-recharge; org / agent / user spend caps; item paywalls; app paywall | `CreditBalance`, `BillingTab`, spend-cap hooks, `MonetizationTab` | `/iblai-vibe-pricing` → `credit`, `billing`, `agent-billing`, `monetization*` | `/iblai-api-billing`, `-spend-caps` |
| Memory administration | any user's global memories and toggles; any agent's memories | `Account targetTab="memory"` | `/iblai-vibe-memory` | `/iblai-api-agent-memory` ★ |
| Analytics about the org | usage, users, topics, transcripts, costs, audit, reports | `AnalyticsLayout` (no `mentorId`) | `/iblai-vibe-analytics` ★, `/iblai-vibe-agent-audit` | `/iblai-api-analytics` ★ |
| Catalog and admissions | courses, programs, credentials, applications | course/application components | `/iblai-vibe-course-access`, `-course-create`, `-application` | `/iblai-api-catalog`, `-course-create`, `-credential`, `-apply`, … |
| Where it is administered today | os.ibl.ai → Admin mode → settings | — | `/iblai-vibe-admin` builds the same into your app | the `api` family |

## How it maps onto vibe-starter

| Entity | Route | Helper |
|---|---|---|
| The signed-in user | `/profile` (`Profile` + `AppPreferences`) | `useUserSettings()` — `lib/iblai/metadata.ts` |
| The app's agent | `/` (`Chat`), `/agents`, `/setup` (pick or create) | `config.defaultAgentId()` → org setting `defaultAgentId` |
| The org | `/admin/organization` (`OrganizationTab` + `OrgSettingsForm`), `/admin/users`, `/admin/billing`, `/admin/memory`, `/admin/analytics` | `useOrgSettings()`, `isTenantAdmin()`, `requireAdmin()` |

Read next: [auth-model.md](auth-model.md) for who can reach what, and
[skill-kinds.md](skill-kinds.md) for the `ui` / `api` split.
