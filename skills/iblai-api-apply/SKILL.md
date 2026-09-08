---
name: iblai-api-apply
description: Platform application gate — turn membership into an apply/review process. Applicant apply/renew/submit flows (drafts, file uploads, fees, withdrawal), reviewer pipeline (list, stats, detail, per-student decisions, notes, waivers, admin override submit, blocks), post-acceptance placement tests and course assignments, student account provisioning (invite/link), and application form authoring (schema, decision templates, fees, renewal windows). Use when wiring up an admissions/enrollment application flow, working the review pipeline, deciding applications, or managing application forms.
metadata:
  kind: api
---

# iblai-api-apply

Operate an organization's **application gate**: when applications are on, a user
cannot join the org directly — they fill out a form the org configured, submit
it, and staff review and decide it. Approval grants membership. Covers the
applicant surface (create/renew a draft, save answers, upload files, pay or
waive the fee, submit, withdraw), the reviewer surface (pipeline, per-student
decisions, notes, waivers, fee management, blocks, placement tests, course
assignments, account provisioning), and form management (schema, config,
decision templates, renewal windows).

Applications support the **family** shape: one adult applies on behalf of one
or more students. Each student in the application gets an individual record (a
*candidate*) with its own review status and decision — one child can be
accepted while a sibling is waitlisted. A form with no student section is a
plain self-apply form; the applicant is the candidate. A user's application
record is called a *submission* in the API payloads; the two words refer to
the same thing.

Three kinds of caller hit these endpoints:

- **Applicant** — a signed-in user. Creates and submits an application (for
  themselves or their students), watches its status, pays or has waived the
  application fee, and can renew next year.
- **Reviewer / admin** — an org admin. Works the pipeline, decides per student
  or per family, keeps internal notes, manages the fee, waives requirements,
  assigns placement tests and courses after acceptance.
- **Form manager** — an org admin. Authors the form(s), the decision message
  templates, the fee, and the renewal window.

## Auth & conventions

- **Base URL:** `https://api.iblai.app/dm` — these are Data Manager (DM)
  endpoints, so the **`/dm` prefix is required**; the
  `/api/catalog/applications/...` paths below are appended to it (e.g.
  `https://api.iblai.app/dm/api/catalog/applications/platform/status`).
  (The same contract is also exposed edX-proxied under
  `/api/ibl/catalog/applications/...`; through this gateway use the direct
  `/dm` form.) Trailing slashes are accepted but optional on every route.
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Org scope:** every request is scoped to one org. Pass `platform_key`
  (= `$IBLAI_ORG`) as a query param on GETs and in the body on writes;
  `platform_org` (the org code) is accepted as an alternative. Reviewer
  endpoints that address a specific application by id resolve the org from
  the application itself, but list/stats/detail reads still take
  `platform_key` for the permission check.
- **Authentication semantics:** all endpoints require authentication;
  anonymous requests get `401`. Reviewer and form-manager endpoints (`manage`
  paths) additionally enforce admin/role permissions and return `403` when
  the caller lacks them. Applicant endpoints operate only on the caller's own
  applications — someone else's application id is a `404`, not a `403` (no
  existence leak).
- **Pagination:** only the reviewer pipeline list is paginated, with the
  standard envelope `{ "count", "next", "previous", "results": [...] }` and
  `page` / `page_size` params. Every other list returns a plain
  `{ "results": [...] }` with no paging.
- **Errors:** business errors return a stable machine code:
  `{ "error": "<machine_code>" }` — key off `error`. Validation failures on
  submit are richer (see *Answers and validation errors* below). Throttled
  writes return `429`.
- **Timestamps** are ISO 8601. **Money** is a decimal string (`"50.00"`) plus
  a `currency` code.
- `<id>` in paths is a submission id unless stated otherwise.
- DELETE / destructive / outward-facing calls say "Confirm with the user
  first."
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Modes and flows

Before anything else, ask the status endpoint what mode the org is in:

- `open` — the user can join directly (existing self-link flow; no
  application).
- `application` — the user must apply. This is the scope of this skill.
- `invite_only` — the user cannot self-join; they need an invitation.

**Multiple forms.** An org may run several application forms at once
(separate schools sharing an org, or tracks like elementary vs high school).
Exactly one is the *default*. The status endpoint lists all of them;
`form_id` on status/form/create/renew targets a specific one, and omitting it
means the default. All application rules are per form: a family may have
applications open on two different forms, never two on the same form, and a
denial cooldown on one form does not touch another.

**The apply flow, end to end:**

1. Fetch status. If mode is `application` and there is no open application,
   the caller can apply (pick a form first when the org runs several).
2. Fetch the form definition and render/walk it.
3. Create a draft, save answers as the user progresses, upload any files.
4. If the form has a fee, it must be settled before submit (the status and
   application payloads carry the fee state). Submit is blocked until the fee
   is paid or waived (`402 fee_required`); the draft is never lost.
5. Submit. On validation failure, map errors onto fields. On success the
   application is in `submitted`.
6. Poll or re-fetch to reflect status changes. If more info is requested, the
   application becomes editable again; edit and resubmit. Decisions arrive
   per student, each with its own message.

**The renewal flow (returning families).** Instead of a plain create, call
renew. The new draft comes back pre-filled from the family's most recent
approved application on that form, with the person's current profile values
winning where fresher. Signatures, required consents, file uploads, and any
field the org flags as re-ask (`fresh_on_renewal`) come back empty on
purpose; they are re-asked, not lost. Adding a new student is just adding
another entry in the students section. The form's `config.renewal` block
(surfaced by the status endpoint) carries the org's priority window and
deadline for display. When the org enforces the window, a brand-new family
creating a draft inside it gets `409 renewal_priority_window`.

## The form schema (rendering contract)

The org authors a form as JSON. Clients render it into inputs and submit
answers keyed by section and field. The backend re-validates on submit; that
check is authoritative, so any client-side validation is for responsiveness
only.

### Shape

```json
{
  "title": "Join Example Academy",
  "description": "Tell us about yourself and who you are applying for.",
  "sections": [
    {
      "key": "about_you",
      "title": "About you",
      "description": "",
      "repeatable": false,
      "sensitive": false,
      "visible_if": null,
      "fields": [
        {
          "key": "full_name",
          "type": "text",
          "label": "Full name",
          "required": true,
          "help_text": "",
          "placeholder": "",
          "validators": [
            { "check": "max_length", "value": 200, "error": "Keep it under 200 characters." }
          ],
          "visible_if": null
        }
      ]
    },
    {
      "key": "students",
      "title": "Students",
      "repeatable": true,
      "candidate": true,
      "min_items": 1,
      "item_label": "student",
      "fields": [
        { "key": "name", "type": "text", "label": "Student name", "required": true,
          "maps_to": { "key": "name" } },
        { "key": "grade", "type": "select", "label": "Grade", "required": true,
          "options": [ { "value": "6", "label": "6th" } ], "maps_to": { "key": "grade" } }
      ]
    }
  ],
  "resources": [
    { "label": "Community handbook", "url": "https://example.org/handbook" }
  ]
}
```

Answers are addressed as `section_key.field_key`.

**Candidate sections.** At most one section carries `"candidate": true`; its
entries are the students being applied for. Each entry becomes a candidate
with its own review status and decision. Entries carry a server-owned `_id`
(minted on save); keep it intact when editing so the per-student records stay
linked across resubmits and renewals.

### Field types

| Type | Input | Answer value |
|---|---|---|
| `text` | single-line text | string |
| `textarea` | multi-line text | string |
| `email` | email | string |
| `phone` | phone | string |
| `number` | numeric | number |
| `date` | date | ISO date string `YYYY-MM-DD` |
| `boolean` | checkbox / acknowledgment toggle | boolean. If `must_be_true` is set, it must be checked to submit (required consent). |
| `select` | dropdown or radio group (see `ui`) | one option `value` |
| `multi_select` | multi-select / checkbox list | list of option `value`s |
| `file` | file upload | attachment id, or list of ids (see *File fields*) |
| `signature` | typed-signature capture | `{ "name": str, "signature": str, "signed_at": ISO datetime }` |
| `info` | static display block, no input | none (nothing submitted) |

Field properties: `label`, `required`, `help_text`, `placeholder`, `default`,
`options` (for select types, each `{ "value", "label" }`), `validators`,
`visible_if`, `ui` (renderer hints, e.g. render a select as radios),
`content` and `content_version` (for `info` blocks, markdown to display; used
for handbook text, with the version recorded on the snapshot), `file_config`
(for `file` fields), plus three that do not change rendering:

- `maps_to` (`{ "key": ..., "transform": ... }`, or a list of them) — where
  the answer is carried onto the person's account/profile after acceptance.
  The `{ "key": "email" }` designation is also what account invitations are
  sent to. Mapped candidate answers additionally power the reviewer
  pipeline's `candidate.<key>` filters.
- `fresh_on_renewal` (bool) — re-asked empty on a renewal instead of
  pre-filled.
- `sensitive` (bool, on a field or a whole section) — masked from reviewers
  who lack sensitive-data access (see the reviewer detail endpoint).

### Conditional visibility and repeatable sections

**`visible_if`** appears on a field or a section. When present, the element
applies only when the condition holds:

```json
{ "field": "about_you.referral_source", "operator": "equals", "value": "referral" }
```

Operators: `equals`, `not_equals`, `in` (value is a list), `gte`, `lte`. A
bare field key (no section prefix) inside a repeatable section refers to the
same entry. A section-level condition always uses the dotted `section.field`
form. Hidden fields are not required and their answers are dropped
server-side.

**Repeatable sections** (`"repeatable": true`) capture a list of entries
using the same fields. Honor `min_items` / `max_items`; `item_label` names
one entry (e.g. "student") for "add another" affordances. Each entry is an
object; the server-owned `_id` per entry is preserved on save and links file
uploads and candidate records to a specific entry.

### Answers and validation errors

Answers submitted (and returned) look like:

```json
{
  "about_you": { "full_name": "Jordan Smith", "referral_source": "referral" },
  "students": [
    { "_id": "m1", "name": "Casey Smith", "birth_date": "2015-04-02", "grade": "6" }
  ],
  "documents": { "transcript": 7 },
  "agreements": {
    "accept_policies": true,
    "signature": { "name": "Jordan Smith", "signature": "Jordan Smith", "signed_at": "2026-07-03T14:00:00Z" }
  }
}
```

Drafts may be partial and invalid. On **submit**, if validation fails, the
response is `400`:

```json
{
  "error": "validation_failed",
  "errors": [
    { "section": "about_you", "field": "full_name", "index": null, "error": "This field is required.", "code": "required" },
    { "section": "students", "field": "birth_date", "index": 1, "error": "Enter a date (YYYY-MM-DD).", "code": "" }
  ]
}
```

`index` is the repeatable-entry position (`null` for non-repeatable
sections). `code` distinguishes the two kinds of problem: `"required"` means
the answer is missing (the only kind staff can waive), and an empty code
means the answer is present but invalid. Map errors directly onto the
corresponding answers.

`validators` on a field (checked server-side; mirroring them client-side
gives instant feedback): `min_length`, `max_length`, `pattern`, `min`,
`max`, `min_items`, `max_items`, each with its own `error` string.

### File fields

A `file` field carries `file_config`: `allowed_extensions`, `max_size_mb`,
`max_files`. Uploads are a separate call (see *Upload attachment*): upload
the file, get back an attachment id, and store that id (or list of ids) as
the field's answer, with `item_id` tying an upload to a specific repeatable
entry. Uploads are only allowed while the application is editable.

## Status model

Application statuses: `draft`, `submitted`, `under_review`,
`needs_more_info`, `interview_required`, `waitlisted`, `approved`, `denied`,
`withdrawn`.

Per-student (candidate) statuses: `pending`, `under_review`,
`needs_more_info`, `interview_required`, `waitlisted`, `accepted`,
`declined`.

**Decisions are per student; the family status is derived.** A transition
without `candidate_id` fans out to every student it legally applies to. The
application's own status then rolls up from the students: any student needing
info means `needs_more_info`; else any needing an interview means
`interview_required`; else any still being worked means `under_review`; once
all are settled, `approved` if anyone was accepted, else `waitlisted` if
anyone is waitlisted, else `denied`. So "one child accepted, one declined" is
an approved application with per-student outcomes inside it; the per-student
truth lives in `candidates`.

- **The family can edit** only in `draft` and `needs_more_info`.
  Resubmitting after an info request puts the affected students back in
  review.
- **The family can withdraw** from any undecided status.
- **Only the family's own submit (or the admin override submit) leaves
  `draft`.** Reviewers cannot move a draft through the pipeline, though they
  can view it, waive requirements on it, and manage its fee.
- **Fee gate:** submit returns `402` until the fee is paid or waived. The
  application never gets lost; it stays a draft.
- `accept` / `decline` are reachable from any active or waitlisted student
  state; `request_info`, `require_interview`, `start_review` move between the
  working states. The transition endpoint enforces all of this; a disallowed
  action returns `409` (two reviewers can race on the same application).

Everything that changes a status writes an audit event (`status_events` on
the reviewer detail), including the family's own submit and withdraw, with
actor and note.

## Reads

### Applicant

- **GET** `/api/catalog/applications/platform/status` — the gate state; the
  one call to drive the initial routing decision. Params: `platform_key`
  (required unless `platform_org` is given), `platform_org` (optional
  alternative), `form_id` (optional; omitted resolves the default form).
  Returns:

  ```json
  {
    "mode": "application",
    "is_member": false,
    "forms": [
      { "id": 4, "name": "high-school", "title": "High School Application", "is_default": true },
      { "id": 9, "name": "elementary", "title": "Elementary Application", "is_default": false }
    ],
    "form": { "id": 4, "version": 3, "title": "High School Application" },
    "submission": { "id": 12, "status": "needs_more_info", "form_id": 4, "modified": "2026-07-03T16:00:00Z" },
    "fee": { "required": true, "amount_owed": "50.00", "amount_paid": "0.00", "currency": "usd", "status": "pending" },
    "renewal": { "priority_window_start": "2026-01-05T00:00:00Z", "priority_window_end": "2026-02-01T00:00:00Z", "deadline": "2026-06-01T00:00:00Z" }
  }
  ```

  `mode` is `application | open | invite_only`. `forms` lists every active
  form (empty outside application mode). `form` is the resolved one: the
  named `form_id`, else the default — it is `null` when the org has several
  forms, no default, and no `form_id` was given; a `form_id` from `forms` is
  then required. `submission` is the caller's open application on this org
  (or their most recent one), with its own `form_id`; `fee` is that
  submission's fee state. `renewal` echoes the resolved form's renewal config
  for display (dates are informational unless the org enforces the window).
- **GET** `/api/catalog/applications/platform/form` — fetch a form
  definition. Params: `platform_key` (required unless `platform_org` given),
  `form_id` (optional; omitted resolves the default). Returns `200` with the
  form object carrying `schema` and `version` (internal `config` omitted);
  `400 no_active_form` when nothing resolves.
- **GET** `/api/catalog/applications/platform` — list the caller's own
  applications. Params: `platform_key` (required), `status` (optional filter
  by application status). Returns `{ "results": [ <submission> ] }`, newest
  first, full submission objects (shape below). Not paginated.
- **GET** `/api/catalog/applications/platform/<id>` — read one of the
  caller's own applications, any status. `404` for anything that isn't the
  caller's own (including another user's application id — no existence
  leak).

**The submission object (applicant view)** — returned by list, detail,
create, renew, update, submit, and withdraw:

```json
{
  "id": 12,
  "platform_key": "example",
  "status": "submitted",
  "form_id": 4,
  "form_version": 3,
  "form_schema": { "...": "snapshot of the schema this application is on" },
  "responses": { "...": "the answers object" },
  "attachments": [ { "id": 7, "field": "documents.transcript", "item_id": null, "filename": "transcript.pdf", "content_type": "application/pdf", "size": 182034, "created": "..." } ],
  "candidates": [
    { "id": 31, "item_id": "m1", "details": { "name": "Casey Smith", "grade": "6" }, "status": "accepted", "decision_message": "Welcome, Casey!", "decided_at": "...", "decision_sent_at": "...", "removed": false, "created": "...", "modified": "..." }
  ],
  "fee": { "required": true, "amount_owed": "50.00", "amount_paid": "50.00", "currency": "usd", "status": "paid" },
  "waivers": [ { "section": "documents", "field": "transcript" } ],
  "placements": [ { "id": 44, "candidate_id": 31, "mentor_unique_id": "<agent id>", "mentor_label": "Math Placement Agent", "label": "Math", "session_id": "", "status": "assigned", "created": "...", "modified": "..." } ],
  "course_assignments": [ { "id": 9, "candidate_id": 31, "course_id": "course-v1:...", "started": "...", "expired": null, "active": true, "created": "...", "modified": "..." } ],
  "renewed_from": 8,
  "submitted_at": "...",
  "decided_at": "...",
  "decision_message": "",
  "created": "...",
  "modified": "..."
}
```

- `candidates` holds the per-student outcomes: each student's status and
  decision message. `decision_sent_at` is when the decision email naming
  this student was handed off; `null` means no notice has gone out.
- `waivers` are requirements the org excused; waived items no longer block
  submission. The family payload names only the excused item (`section`,
  `field`); who excused it and why appear on the reviewer detail only.
- `fee.status` is `pending | paid | waived | refunded | credited`.
- `placements` and `course_assignments` are the family's view of what
  happens after acceptance (empty until then): each child's placement-test
  status, the agent to start the test conversation with
  (`mentor_unique_id`), and each child's assigned courses with dates.
  Removed course assignments disappear from this list.
- The review-side internals (the agent's raw `result`, staff `override` and
  `note`, invitation linkage) are absent here by design; they appear only on
  the reviewer detail.

### Reviewer (permission-gated)

- **GET** `/api/catalog/applications/platform/manage` — pipeline list.
  Params: `platform_key` (required), `status` (optional, one application
  status), `search` (optional; matches applicant username/email and student
  names), `candidate.<key>=<value>` (optional; filters on any mapped
  candidate detail, e.g. `candidate.grade=6` — the keys are the schema's
  `maps_to` destinations, stamped per student at submit), `sort` (optional:
  `id`, `status`, `created`, `modified`, `submitted_at`; `-` prefix for
  descending; default `-created`; anything else is `400 invalid_sort`),
  `page` / `page_size`. Returns the paginated envelope of light rows, enough
  to work the pipeline without detail calls:

  ```json
  {
    "id": 12,
    "status": "under_review",
    "form_id": 4,
    "user": { "id": 5, "username": "jordan", "email": "jordan@example.org" },
    "candidate_count": 2,
    "candidates": [ { "id": 31, "status": "accepted", "name": "Casey Smith", "enrollment_phase": "enrolled" }, { "id": 32, "status": "under_review", "name": "Sam Smith", "enrollment_phase": null } ],
    "submitted_at": "...",
    "created": "...",
    "modified": "..."
  }
  ```

  Full answers, events, and notes load on detail. Drafts are visible here
  too, for the "family called in, open their draft" flow.
  `enrollment_phase` is `enrolled` once every active course assignment of an
  accepted student has produced an enrollment, `enrollment_in_progress` for
  any other accepted student, and `null` before acceptance.
- **GET** `/api/catalog/applications/platform/manage/stats` — pipeline
  stats. Param: `platform_key` (required). Returns
  `{ "counts": { "submitted": 10, "under_review": 5, ... }, "post_approval": { "enrolled": 12, "enrollment_in_progress": 3, "parent_account": 2 } }`.
  `counts` has one key per application status that has at least one
  application; `post_approval` buckets the accepted students: fully
  enrolled, still in progress, and students operating under the parent's
  account (no email designated).
- **GET** `/api/catalog/applications/platform/manage/<id>?platform_key=...`
  — application detail: the applicant-view submission object plus
  reviewer-only material:
  - `user` — `{ id, username, email, name }`, the applicant.
  - `candidates[*].label` — display name for each student; `details` carries
    the mapped answers.
  - `candidates[*].identity` — how the student resolves to an account:
    `linked` (has their own linked account), `invited` (account invitation
    outstanding), `invite_missing` (email designated but no active
    invitation; fix with the candidate invite endpoint), `account_unlinked`
    (an org member with that email exists but is not linked; fix with the
    candidate link endpoint), `parent_account` (no email designated; the
    student operates under the parent's account).
  - `candidates[*].enrollment_phase` — `enrolled` /
    `enrollment_in_progress` for accepted students (as in the pipeline
    list), `null` otherwise.
  - `placements`, `course_assignments` — full staff views (see the
    placement / course-assignment writes for the object shapes).
  - `status_events` — the full audit trail,
    `[ { "id", "candidate_id", "from_status", "to_status", "actor", "note", "created" } ]`
    (`candidate_id` null for family-level events).
  - `notes` — internal notes,
    `[ { "id", "kind", "body", "author", "created", "modified" } ]`.
  - `blocking_items` — for an editable application, the same submit
    checklist the family faces: validation errors annotated with
    `waived: true/false`. Staff waive from this list. Empty once submitted.
  - `sensitive_masked` — keys (`section` or `section.field`) whose content
    was removed from `responses` because the caller lacks sensitive-data
    access. Callers with access get everything and an empty list.
- **GET** `/api/catalog/applications/platform/manage/<id>/fee` — the
  application charge and its history:
  `{ "id", "charge_type", "amount_owed", "amount_paid", "currency", "status", "events": [ { "event_type", "amount", "method", "funding_source", "actor", "note", "created" } ] }`,
  or `{ "required": false }` when the form has no fee.
- **GET** `/api/catalog/applications/platform/manage/<id>/notes` — internal
  notes, `{ "results": [ <note> ] }`. Param: `kind` (optional; filter by
  `general` or `interview`). Never shown to applicants.
- **GET** `/api/catalog/applications/platform/manage/<id>/attachments/<attachment_id>/download`
  — download an uploaded file: `302` redirect to a time-limited URL on cloud
  storage. Use the attachment ids from the detail payload.
- **GET** `/api/catalog/applications/platform/manage/blocks?platform_key=...`
  — the ban list:
  `{ "results": [ { "id", "user": { "id", "username", "email" }, "reason", "created_by", "created" } ] }`.
  Blocks are created via decline-with-block on the transition endpoint, not
  here. A blocked user is never told they are blocked; their create attempts
  return the neutral `cannot_apply`.
- **GET** `/api/catalog/applications/platform/manage/<id>/placements` —
  placements for an application, `{ "results": [ <placement> ] }`.
- **GET** `/api/catalog/applications/platform/manage/<id>/course-assignments`
  — course assignments for an application, `{ "results": [ <assignment> ] }`.

### Form management (permission-gated)

- **GET** `/api/catalog/applications/platform/forms/manage?platform_key=...`
  — every form of the org, `{ "results": [ <form> ] }`, `is_default`
  flagged.
- **GET** `/api/catalog/applications/platform/forms/manage/<form_id>` — one
  form's detail (schema, config, name, enabled, version, default flag).

## Writes

### Applicant

- **POST** `/api/catalog/applications/platform` — create a draft. Body:
  `platform_key` (required), `form_id` (optional; omitted targets the
  default form), `responses` (optional; the answers object keyed by section
  per the form schema — may be partial and invalid while drafting). Returns
  `201` with the submission object, `status: "draft"`, `form_schema`
  snapshotted from the form. Errors: `400 no_active_form`;
  `400 form_not_found` (a `form_id` that is not one of the org's active
  forms); `409 already_member` (self-apply forms only; family forms accept
  existing members, and a form can opt members back in);
  `409 open_submission_exists` (already one open application on this form);
  `409 reapply_cooldown` (a recent denial on this form is still cooling
  down); `409 renewal_priority_window` (window enforced and this user has no
  prior approval on the form); `409 cannot_apply` (neutral refusal; the
  reason is intentionally not disclosed); `429`.
- **POST** `/api/catalog/applications/platform/renew` — start a renewal
  draft. Body: `platform_key` (required), `form_id` (optional), `responses`
  (optional; used only when the caller has no prior approved application —
  the plain-create fallback; with a prior, the pre-fill replaces it).
  Returns `201` with a draft pre-filled from the caller's most recent
  approved application on that form (see *Modes and flows* for which fields
  come back empty), linked to it via `renewed_from`. With no prior approval
  it behaves exactly like create. Errors: same codes as create.
- **PATCH** `/api/catalog/applications/platform/<id>` — update own
  application answers. Body: `responses` (required) — the **full** answers
  object, keyed by section per the form schema; it replaces the stored
  answers (send the whole object, not a delta). Returns `200` with the
  updated submission; `404`; `409 not_editable` (only `draft` and
  `needs_more_info` are editable).
- **POST** `/api/catalog/applications/platform/<id>/submit` — submit. Body:
  `responses` (optional; replaces the stored answers before validating).
  Returns `200` with the submission object, `status: "submitted"`,
  `submitted_at` set. Errors: `400 validation_failed` with the structured
  error list (requirements the org waived are skipped);
  `402 fee_required` (fee still unpaid and unwaived; the draft is
  preserved); `409 not_editable`; `429`. If the form's schema changed since
  the draft began, the snapshot and `form_version` refresh to the version
  actually validated against. On success the per-student candidate records
  are created or refreshed from the answers.
- **POST** `/api/catalog/applications/platform/<id>/attachments` — upload a
  file (multipart). Body: `field` (required; the answer path of the file
  field, e.g. `documents.transcript`), `item_id` (optional; the `_id` of the
  repeatable entry the file belongs to), `file` (required; checked against
  the field's `file_config` — extensions, size, file count). Returns `201`
  with the attachment object. Errors: `400 invalid_field` (not a file field
  of this form); `400 file_required`; `400 extension_not_allowed`;
  `400 file_too_large`; `409 field_file_limit` (`max_files` for that field
  reached); `409 too_many_attachments` (per-application cap);
  `409 not_editable`; `429`.
- **DELETE** `/api/catalog/applications/platform/<id>/attachments/<attachment_id>`
  — remove an uploaded file. Returns `204`; `404`; `409 not_editable`.
  Confirm with the user first.
- **POST** `/api/catalog/applications/platform/<id>/withdraw` — withdraw the
  application. Returns `200` with the submission, `status: "withdrawn"`;
  `409 not_withdrawable` (already decided or withdrawn). Confirm with the
  user first.

### Reviewer (permission-gated)

- **POST** `/api/catalog/applications/platform/manage/<id>/transition` —
  decide / move an application. Body:
  - `action` (required) —
    `start_review | request_info | require_interview | waitlist | accept | decline`.
  - `candidate_id` (optional) — scope the action to one student; without it,
    the action applies to every student it is legal for (family-wide
    decision).
  - `message` (optional) — applicant-visible text stored as the decision
    message; if omitted on `accept`/`decline`/`waitlist`/`request_info` and
    the form has a matching template, the rendered template is used.
  - `note` (optional) — internal note on the audit event.
  - `block` (optional bool, `decline` only) — also bar the family from
    reapplying until unblocked.

  Returns `200` with the updated reviewer detail. Errors:
  `400 invalid_action`; `404 candidate_not_found`;
  `409 illegal_transition` (nothing the action could legally apply to);
  `409 no_candidates` (a draft; there is nothing to review yet).

  The family status is a rollup of the students (see *Status model*). On the
  rollup reaching `approved`, membership and account provisioning fire
  before the response returns. `accept`, `decline`, and `waitlist` also
  email the applicant one notice per call naming every student decided in
  that call, with each student's decision message; the email template is
  per-org and editable, and each candidate's `decision_sent_at` records the
  handoff. Decisions are outward-facing — confirm with the user first.
- **POST** `/api/catalog/applications/platform/manage/<id>/fee` — act on the
  application fee. Body: `action` (required:
  `record_payment | waive | refund | credit`), `amount` (optional decimal
  for payment/refund/credit), `method` (optional payment method label, e.g.
  `check`), `funding_source` (optional funding source label recorded on the
  payment event), `note` (optional free text stored on the charge event).
  Returns `200` with the updated charge and events; `409 no_fee` (the form
  has no fee). `record_payment` is for out-of-band money (check, in
  person); `waive` is what unblocks submit without payment.
- **POST | DELETE** `/api/catalog/applications/platform/manage/<id>/waivers`
  — waive / reinstate a required item. Body: `section` (required),
  `field` (required), `reason` (optional, POST only; free-text reason stored
  on the waiver — who and when are recorded automatically). Returns `200`
  (POST; waiver recorded, idempotent per (section, field)) or `204` (DELETE;
  requirement reinstated). Errors: `400 unknown_field` (a field not in the
  form); `404` (DELETE; not waived); `409 not_editable` (only while the
  application is editable). POST excuses the absence of that required answer
  wherever it is missing on this application; the family's submit then
  passes without it. Waivers never excuse present-but-invalid answers — and
  the fee is waived through the fee endpoint, not here. Waivers show up in
  the submission `waivers` list and as `waived: true` rows in
  `blocking_items`; family and staff look at the same checklist. (A client
  can also skip per-item waivers entirely — the admin override submit below
  covers the stuck-application flow on its own.)
- **POST** `/api/catalog/applications/platform/manage/<id>/submit` — submit
  with exceptions (admin override). Body: `note` (optional; recorded as the
  reason on each waiver it creates). Returns `200` — the application is
  submitted and everything bypassed lands as waiver rows plus an audit event
  naming them. Errors: `400` with the usual error list if any **present**
  answer is invalid (exceptions excuse absence, never malformed content);
  `409 not_editable`. Runs the normal submit machinery: validates, freezes
  the schema snapshot, creates the per-student records, keeps whatever
  signatures were given. Every required item still missing is waived, and an
  unpaid fee gate is bypassed **without forgiving the charge** (it stays
  payable or waivable via the fee endpoint). Typical use: a family is stuck
  on a requirement they cannot meet — staff open the detail (which shows
  `blocking_items`), then either waive the specific items and let the family
  submit, or finish it in one call here. Confirm with the user first.
- **POST** `/api/catalog/applications/platform/manage/<id>/notes` — add an
  internal note. Body: `body` (required), `kind` (optional; `general`
  (default) or `interview`). Returns `201` with the note.
- **PATCH | DELETE** `/api/catalog/applications/platform/manage/<id>/notes/<note_id>`
  — edit (`body` required; `kind` is fixed at creation) or soft-delete a
  note. Returns `200` (PATCH) / `204` (DELETE). Confirm deletes with the
  user first.
- **DELETE** `/api/catalog/applications/platform/manage/blocks/<block_id>?platform_key=...`
  — unblock a family: `204`; they may apply again (a cooldown may still
  apply). Blocks are created via decline-with-block on the transition
  endpoint, not here. Confirm with the user first.

### Placements and course assignments (after acceptance)

Both live on the reviewer surface and only apply to **accepted** students.

- **POST** `/api/catalog/applications/platform/manage/<id>/placements` —
  assign placement tests, one or many in a single call:

  ```json
  { "placements": [
    { "candidate_id": 31, "mentor_unique_id": "<agent id>", "mentor_label": "Math Placement Agent", "label": "Math" },
    { "candidate_id": 32, "mentor_unique_id": "<agent id>", "label": "Math" }
  ] }
  ```

  Per item: `candidate_id` (required; candidate id from the application
  detail), `mentor_unique_id` (required; the placement agent's unique id
  from the mentor APIs — staff pick which agent runs the test, there is no
  automatic routing), `label` (optional; what the placement covers, e.g.
  "Math" vs "Language Arts"), `mentor_label` (optional display name for the
  agent), `session_id` (optional; the mentor conversation id of the test),
  `note` (optional free text). Returns `200` with per-item `results`: each
  item is either the created placement object or
  `{ "candidate_id", "error": "candidate_not_found" | "candidate_not_accepted" }`
  — bulk is **not** all-or-nothing.

  Placement object:
  `{ "id", "candidate_id", "mentor_unique_id", "mentor_label", "label", "session_id", "status", "result", "override", "override_at", "note", "created", "modified" }`.
  `status` walks `not_assigned`, `assigned`, `started`, `completed`,
  `reviewed`, `confirmed` (not enforced in order). `result` is the agent's
  recommendation (free-form JSON); `override` is staff's correction when
  they disagree. A student can have several placements (one per subject, or
  a re-test; the newest row is current).
- **PATCH** `/api/catalog/applications/platform/manage/<id>/placements/<placement_id>`
  — update a placement. Body (any subset, at least one): `status` (one of
  the six lifecycle states), `result` (the agent's recommendation),
  `override` (staff correction; who and when are stamped automatically),
  `session_id`, `note`. Returns `200` with the updated placement.
- **POST** `/api/catalog/applications/platform/manage/<id>/course-assignments`
  — assign courses, one or many:

  ```json
  { "assignments": [
    { "candidate_id": 31, "course_id": "course-v1:...", "started": "2026-08-15T00:00:00Z", "expired": "2027-06-15T00:00:00Z", "placement_id": 44 }
  ] }
  ```

  Per item: `candidate_id` (required), `course_id` (required;
  `course-v1:...` — must belong to the same org), `started` (optional
  enrollment start datetime, carried onto the enrollment — future-dated
  access), `expired` (optional enrollment expiry datetime, carried onto the
  enrollment), `placement_id` (optional; the placement that justified the
  choice). Returns `200` with per-item results as with placements. Item
  errors: `candidate_not_found`, `candidate_not_accepted`,
  `course_platform_mismatch`, `already_assigned` (same student and course
  while an assignment is active), `invitation_error`.

  Each successful item issues a course invitation that the existing
  enrollment pipeline redeems: immediately if the student already has an
  account, or when they redeem their account invitation. A student with no
  account and no designated email is assigned through the parent's account
  (the parent is that student's designated identity), so no student is
  refused for lacking an identity. Assignment object:
  `{ "id", "candidate_id", "course_id", "placement_id", "invitation_id", "started", "expired", "active", "created", "modified" }`.
- **DELETE** `/api/catalog/applications/platform/manage/<id>/course-assignments/<assignment_id>`
  — remove a course assignment: `204`; the assignment is deactivated and its
  invitation cancelled if the student has not yet enrolled through it. It
  never un-enrolls a student who already enrolled — that stays a separate
  admin action on the catalog's enrollment endpoints (`/iblai-api-catalog`).
  After removal the student/course pair is free to reassign. Confirm with
  the user first.

### Candidate account provisioning

- **POST** `/api/catalog/applications/platform/manage/<id>/candidates/<candidate_id>/invite`
  — re-send a student's account invitation (no body). Covers the
  `invite_missing` identity state: re-runs the settlement provisioning for
  one student. Returns `200` with the updated reviewer candidate object; if
  an org account with the student's designated email already exists, the
  student is linked to it directly instead of re-invited. Errors:
  `404 candidate_not_found`; `409 candidate_not_accepted` (only accepted
  students are provisioned); `409 already_linked` (the student already has a
  linked account); `400 no_designated_email` (parent-account student; there
  is no address to invite). Outward-facing (sends an email) — confirm with
  the user first.
- **POST** `/api/catalog/applications/platform/manage/<id>/candidates/<candidate_id>/link`
  — manually link a student to an existing account. Body: `user_id` or
  `email` (one required; the existing account to link). Covers the
  `account_unlinked` identity state (the family signed up outside the
  invitation): grants org membership if missing, links the student, writes
  an audit event, and fills the profile from mapped answers
  (fill-if-empty). Returns `200` with the updated reviewer candidate
  object. Errors: `404 candidate_not_found`, `404 user_not_found`,
  `409 candidate_not_accepted`, `409 already_linked`, `400` (neither
  `user_id` nor `email` given).

### Form management (permission-gated)

- **POST** `/api/catalog/applications/platform/forms/manage` — create a
  form. Body: `platform_key` (required), `schema` (required; the JSON form
  definition, validated on save), `name` (optional internal handle; defaults
  to the schema title), `config` (optional behavior settings, reference
  below), `enabled` (optional, default `false`; whether applicants can use
  the form — **enabling turns the application gate on**), `is_default`
  (optional; make this form the org's default, demoting the current
  default). Returns `201` with the form object, `version: 1`; `400` with a
  structured error list for a bad `schema` or `config` (same shape as
  submit validation errors). An org may hold any number of forms; the first
  one automatically becomes the default, and `is_default` (on create or
  update) moves the flag.
- **PATCH** `/api/catalog/applications/platform/forms/manage/<form_id>` —
  update a form. Body: `platform_key` plus any subset of `name`, `schema`
  (replacement form definition; a change bumps `version`), `config`,
  `enabled`, `is_default`. Returns `200` with the form object. A `schema`
  change bumps `version`; in-flight drafts keep their snapshot and
  revalidate against the current version at submit. `enabled: false`
  retires a form from applicants without touching existing applications.
  **There is no delete; disable instead.**

#### Form `config` reference

```json
{
  "reapply_cooldown_days": 30,
  "allow_member_reapply": false,
  "approved_user_group_id": null,
  "decision_templates": {
    "approve": { "message": "Congratulations {candidate_name}, welcome to {platform_name}." },
    "deny": { "message": "..." },
    "waitlist": { "message": "..." },
    "request_info": { "message": "..." }
  },
  "fee": { "required": true, "basis": "per_application", "amount": 50, "currency": "usd" },
  "renewal": {
    "priority_window_start": "2026-01-05T00:00:00Z",
    "priority_window_end": "2026-02-01T00:00:00Z",
    "deadline": "2026-06-01T00:00:00Z",
    "enforce_priority_window": false
  }
}
```

- `reapply_cooldown_days` — how long after a denial before the same family
  can reapply to this form.
- `allow_member_reapply` — lets existing members apply on a **self-apply**
  form (family forms always accept members; returning parents renew and add
  siblings).
- `approved_user_group_id` — a group accepted people are added to.
- `decision_templates` — per-decision applicant-visible messages, used when
  the reviewer supplies none. Placeholders (validated on save):
  `{applicant_name}`, `{applicant_username}`, `{applicant_email}`,
  `{candidate_name}` (the specific student), `{platform_name}`,
  `{submitted_date}`, `{date}`; `{{` renders a literal brace.
- `fee` — `basis` is `per_application` or `per_candidate` (amount times the
  number of students). Surfaced pre-submit; the gate is enforced by submit
  and managed by the fee endpoint.
- `renewal` — window and deadline for display; `enforce_priority_window:
  true` additionally blocks brand-new families from creating drafts inside
  the window. The deadline is displayed, never enforced.

## Example

Check the gate state for an org (the first call of any application flow):

```bash
curl -G \
  "https://api.iblai.app/dm/api/catalog/applications/platform/status" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  --data-urlencode "platform_key=$IBLAI_ORG"
```

## Notes

- **Which endpoints serve which surface.** Applicant flow: status first,
  then form → create/renew draft → PATCH answers (full-replacement
  autosave; drafts accept partial and invalid answers) → upload files
  (upload first, store the returned id as the answer; check `file_config`
  before uploading; pass `item_id` for per-student documents) → settle the
  fee (the `fee` object on status/submission payloads; a `402` on submit
  means it is still owed) → submit (map `section`/`field`/`index` errors
  onto answers; items in `waivers` are excused, not missing) → track status
  (family status plus one row per student from `candidates`, each with its
  `decision_message`; there are no push notifications — poll or re-fetch)
  → renew next cycle (dates from `renewal` on status). Reviewer flow: stats
  for the counters, pipeline list for the queue (filter by `status`, search,
  `candidate.<key>`), detail for the workspace (answers rendered against the
  snapshot `form_schema`, respecting `sensitive_masked`; audit trail; notes;
  fee; `blocking_items` with waive actions while a draft; override submit),
  transition for decisions (per-student via `candidate_id`, family-wide
  without it; message falls back to the form's template; `block` on
  decline), placements and course assignments after acceptance, blocks list
  for the ban list. Form manager: forms manage CRUD with `config`
  (templates, fee, cooldown, renewal window, default-form flag) — validated
  on save with the same structured error shape.
- **Decision emails are live.** Accept/decline/waitlist notices go to the
  applicant automatically — one email per decision call naming every student
  decided in that call — and each candidate carries `decision_sent_at`.
  There is no separate submission-confirmation email; the submit response
  covers it.
- **Where the decision email is configured — two separate things, in two
  places.** The per-student wording is the form's `decision_templates`
  (config reference above); it renders into each candidate's
  `decision_message`, which the email embeds, and a reviewer-typed message
  on the transition overrides the template for that student. The email
  wrapper (subject, body, from-address, channels, on/off) is the
  notification type `PLATFORM_APPLICATION_DECISION`, managed on the
  per-org notification-template API rather than an application-gate
  endpoint: `GET /api/notification/v1/platforms/<platform_key>/templates/`
  lists them, `.../templates/PLATFORM_APPLICATION_DECISION/` reads and
  edits one, and `/toggle/`, `/reset/`, `/test/` handle enable,
  revert-to-default, and a test send (see `/iblai-api-notification`). An org
  with no row of its own inherits the default.
- **Online fee payment is not wired yet.** The fee is recorded and gated,
  and staff record out-of-band payments, waive, refund, or credit — but
  there is no payment-processor checkout, so nothing exists for a "pay now"
  action to call. It arrives with the billing work. Family billing beyond
  the application fee (payment plans, funding sources, invoices, balances)
  is a separate later scope.
- **Snapshot semantics.** Each application carries `form_schema`, the
  schema snapshot it was created (and later validated) against, plus
  `form_version`. Render submitted answers against the snapshot, not the
  live form — the live form may have changed since.
- **Race behavior.** Two reviewers can act on the same application
  concurrently; the transition endpoint enforces legality and the loser
  gets `409 illegal_transition`.
- **Verified against** `iblai/iblai-dm-pro` (the application gate shipped in
  `4.306.0`, PR iblai/iblai-dm-pro#2886): every route above is registered in
  the `dl_catalog_invitations` URLconf and the contract has been exercised
  end to end against a live instance.
