# Templates & notification types

The notification-type catalog, template-inheritance semantics, and variable/HTML
rules that complement the template endpoints in `SKILL.md`
(`/iblai-api-notification`). Paths under
`https://api.iblai.app/dm/api/notification/v1/`; `{platform_key}` = `$IBLAI_ORG`,
`{type}` = a type key from the catalog below.

## Inheritance

Every type ships a default template; the org has **no own record** until it
customizes — reads return the default with `is_inherited: true`.

- The **first `PATCH`** clones the default into an org-owned copy, then applies the
  edit; later `PATCH`es update that copy.
- **`reset/`** deletes the copy → back to the inherited default. Preserves the
  toggle state; loses all content edits.
- **Toggle** (enabled/disabled, via `templates/{type}/toggle/`) is a separate
  record from content — see the delivery-gate note in `guide.md`.
- **System-managed types** (`HUMAN_SUPPORT_NOTIFICATION`, `POLICY_ASSIGNMENT`,
  `PROACTIVE_LEARNER_NOTIFICATION`) expose only their config fields;
  `message_body`, `short_message_body`, `email_html_template` are read-only. Their
  config is under *System-managed config* below.

## Notification-type catalog

Category is informational. **Global** and **user** variables (next section) are
available in every template on top of the type-specific ones listed here.

| Type | Category | Trigger | Type-specific variables |
|---|---|---|---|
| `USER_NOTIF_USER_REGISTRATION` | User | Account created | `welcome_message`, `next_steps` |
| `APP_REGISTRATION` | User | Registered via linked app | `app_name`, `welcome_message`, `benefits`, `closing_message` |
| `USER_NOTIF_COURSE_ENROLLMENT` | Learning | Enrolled in course | `course_name` |
| `USER_NOTIF_COURSE_COMPLETION` | Learning | Completed course | `course_name`, `completion_date`, `certificate_url` |
| `USER_NOTIF_CREDENTIALS` | Learning | Credential issued | `item_name`, `credential_url`, `credential_path` |
| `USER_NOTIF_LEARNER_PROGRESS` | Learning | Periodic progress digest | `courses_taken`, `videos_watched_count`, `total_time_spent`, `credentials` |
| `USER_NOTIF_USER_INACTIVITY` | Engagement | Inactive for configured period | `days_inactive`, `last_activity_date` |
| `PLATFORM_INVITATION` | Invitation | Admin platform invite | `redirect_to` |
| `COURSE_INVITATION` | Invitation | Admin course invite | `course_name` |
| `PROGRAM_INVITATION` | Invitation | Admin program invite | `program_name` |
| `COURSE_LICENSE_ASSIGNMENT` | License | Course license → user | `course_name` |
| `COURSE_LICENSE_GROUP_ASSIGNMENT` | License | Course license → group | — |
| `PROGRAM_LICENSE_ASSIGNMENT` | License | Program license → user | `program_name` |
| `PROGRAM_LICENSE_GROUP_ASSIGNMENT` | License | Program license → group | — |
| `USER_LICENSE_ASSIGNMENT` | License | Platform license → user | `welcome_message`, `benefits`, `closing_message` |
| `USER_LICENSE_GROUP_ASSIGNMENT` | License | Platform license → group | — |
| `ROLE_CHANGE` | Admin | Platform role changed | `role`, `demoted` |
| `ADMIN_NOTIF_COURSE_ENROLLMENT` | Admin | User enrolls (alerts admins) | `course_name`, `student_name`, `student_email` |
| `REPORT_COMPLETED` | Admin | Async report finished | `report_name`, `report_status`, `download_url` |
| `POLICY_ASSIGNMENT` | RBAC | Policy assigned/removed | → System-managed |
| `HUMAN_SUPPORT_NOTIFICATION` | Support | Support ticket opened | → System-managed |
| `PROACTIVE_LEARNER_NOTIFICATION` | AI | Scheduled | → System-managed |
| `CUSTOM_NOTIFICATION` | Custom | Code-driven, custom targeting | — |

`REPORT_COMPLETED.report_status` is one of `completed` / `error` / `cancelled`;
`download_url` is present only for `completed` reports.

## Template variables & syntax

Django template syntax. The renderer auto-loads the `notification_template_tags`
library, so its tags need no `{% load %}` — and a `{% load X %}` of any other
library is rejected ("Unauthorized template tag library").

- **Global** (every template): `site_name`, `site_url`, `site_logo_url`,
  `logo_url`, `platform_name`, `support_email`, `privacy_url`, `terms_url`,
  `current_year`, `base_domain`, `skills_url`, `unsubscribe_url`.
- **User:** `username`, `login_url`, `login_path`.
- **Type-specific:** see the catalog above.

**Email HTML sanitization.** `email_html_template` is cleaned with `bleach`
before render:

- **Tags:** `a abbr b blockquote br code div em h1`–`h6` `hr i img li ol p pre
  span strong sub sup table tbody td th thead tr u ul main footer`.
- **Attributes:** any element — `style class id`; `a` — `href title target`;
  `img` — `src alt width height`; `td`/`th` — `colspan rowspan align valign`.
- **URL protocols:** `http https mailto`.
- **Stripped:** `script iframe form object`, event handlers (`onclick`…),
  `javascript:` URLs.

`test/` renders to the calling admin's own email; omit `context` and defaults
(`username`, `site_name`, `course_name`, `platform_key`) are injected, else your
keys override. Common errors: template syntax (e.g. unclosed `{% if %}`),
unauthorized `{% load %}`, or missing `NotificationTemplate/write`.

## System-managed config

These three types are driven by config in the template's `metadata` (edited via
the template `PATCH` fields named below), not by body text. Each requires its
feature flag; when unmet or disabled, the trigger exits silently. Their
`message_body`, `short_message_body`, and `email_html_template` are **read-only**,
but `message_title` and `email_subject` stay editable — the **Template variables**
listed per type render there (and, for policy, in each per-role `subject`).

### Human support — ticket routing

Alerts recipients when a learner opens a human-support ticket from an AI agent
session (`status == "open"`). Requires AI features. Config:

- `recipient_mode` (default `platform_admins_and_mentor_owner`): also
  `platform_admins_only`, `mentor_owner_only`, `custom`.
- `custom_recipients` (required for `custom`) — list of targets; invalid ones are
  silently dropped:

| target `type` | field | Resolves to |
|---|---|---|
| `user` | `id` (int) | the user, if actively linked to the org |
| `user_group` | `id` (int) | active group members |
| `rbac_policy` | `policy_name` (str) | everyone assigned the policy (direct + via groups) |

**Template variables:** `ticket_subject`, `ticket_description`, `ticket_status`
(always `open`), `user_name`, `user_email`, `mentor_name`, `mentor_unique_id`,
`platform_key`, `session_id` (chat-session UUID), `chat_link` (transcript URL),
`template_content` (optional custom content, rendered when provided).

### Policy assignment

Notifies the affected user on RBAC role assign/remove. Requires RBAC. Config under
`policy_config`:

- `notify_on_assignment` / `notify_on_removal` (bool, default true) — global
  toggles.
- `enabled_policies` (default `[]`) — per-role: `role_name` (exact), `enabled`,
  `notify_on_assignment`, `notify_on_removal`, `subject` (supports variables).
  Empty list ⇒ globals apply to all roles; non-empty ⇒ only listed roles notify.

**Template variables:** `role_name`, `assigned` (`True` granted / `False` revoked),
`resources` (list of affected resources).

### Proactive learner (AI)

Emails AI-generated recommendations on a schedule — per configured agent, per
learner. Requires AI features. Config under `periodic_config`:

| Field | Default | Values |
|---|---|---|
| `frequency` | `WEEKLY` | `DAILY` (1d), `WEEKLY` (7d), `MONTHLY` (30d), `CUSTOM` |
| `custom_interval_days` | `7` | 1–365 (used when `CUSTOM`) |
| `report_period_days` | `7` | 1–365 |
| `execution_time` | `09:00` | `HH:MM` (24h) |
| `timezone` | `UTC` | standard tz names |
| `learner_scope` | `ACTIVE_LEARNERS` | `ACTIVE_LEARNERS` (active within `report_period_days`) or `ALL_LEARNERS` |
| `is_active` | `false` | — |
| `agents` | `[]` | agent configs (below); empty ⇒ all org agents |

Agent config: `unique_id` (req, agent UUID), `prompt` (opt; supports
`student_name`, `student_email`, `username`, `platform_key`), `name` (opt).
**Template variables:** `student_name`, `student_email`, `username`, `mentor_name`,
`mentor_unique_id`, `platform_key`, `ai_recommendation`.
**Dedupe:** the full context (incl. `ai_recommendation`) is hashed; an exact prior
match for the same student + template is skipped — different recommendations both
send. After each run `periodic_config` gains `last_execution_date`,
`next_execution_date`, and `execution_history` (last 10 runs).
