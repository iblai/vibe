# Person Onboarding — Link / Invite / Merge

Condensed from the [Person Onboarding section of the CRM doc](../../../../docs/developer/applications/crm.md#8-person-onboarding-link-invite-merge). People in the CRM start as records — rows
holding emails, lifecycle stage, ownership, tags — that are not yet
real Platform accounts. They become first-class Platform users in one
of three explicit ways (link, invite, merge), plus one implicit signal
(auto-link). All examples send `Authorization: Token <token>`.

## Decision tree

Pick the right endpoint before you call anything.

```
Is there already a Platform user for this person?
├── Yes, user_id is known         → POST /persons/{id}/link-user/
├── No, but the person has email  → POST /persons/{id}/invite/
└── Duplicate person rows         → POST /persons/merge/
```

The three branches are **not interchangeable**:

| Branch | Precondition | What it produces |
|--------|--------------|------------------|
| Link   | Target Platform user already exists with an active membership | Person bound immediately (`platform_user` set, `active=false`) |
| Invite | Person has a `primary_email` | Platform invitation row; user is created **only** when the invitee accepts |
| Merge  | Two or more person rows for the same human | Deals / activities / tags re-parented onto a primary; duplicates soft-deleted |

---

## 1. Link an existing Platform user

`POST /api/crm/persons/{id}/link-user/`

**Request**

```json
{ "user_id": 1184 }
```

**Response** `200 OK` — full Person object. On success:
`platform_user` is set to the requested `user_id` and `active` flips
to `false`. Once bound, the Platform user is the source of truth and
the person row becomes historical sales context.

### Silent-refusal footgun

The link service refuses to rebind a person that is already bound to a
**different** Platform user. There is no error response — the call
returns **200 OK** with the existing binding untouched. Clients
**MUST** verify equality:

```ts
const linked = await crm.linkUser(personId, requestedUserId);
if (linked.platform_user !== requestedUserId) {
  // Refusal: this person is already linked to someone else.
  // Surface "already linked to user X" — DO NOT claim success.
}
```

Silent rebinds would erase a prior link without trace, so they are
forbidden by design.

### Status codes

| Code | When |
|------|------|
| `200` | Linked **OR** silent refusal — compare `platform_user` to your request. |
| `400` | `user_id` missing or wrong type. |
| `403` | Target user has no active `UserPlatformLink` to this Platform — *"issue an invitation instead."* |
| `404` | Person not found in this Platform, or `user_id` does not exist. |

**RBAC:** `Ibl.CRM/Persons/write`. The target user must additionally
have an active membership in the same Platform.

---

## 2. Invite by email

`POST /api/crm/persons/{id}/invite/`

Use this when the person is **not** yet a Platform user. The
invitation reuses the standard Platform invitation pipeline. On
acceptance a Platform user is created and the auto-link signal
(section 4) binds the person automatically.

**Request**

```json
{
  "is_admin": false,
  "is_staff": false,
  "redirect_to": "https://app.example.com/dashboard"
}
```

- `is_admin` / `is_staff` — privileges granted on acceptance. Both
  default to `false`.
- `redirect_to` — URL the invitee lands on after accepting. Omit for
  the Platform default. Max 255 chars.
- `enrollment_config` — optional object forwarded to the invitation
  for auto-enrollment in courses, programs, or pathways.

**Response** `201 Created`

```json
{
  "person_id": "<uuid>",
  "invitation_id": 9821,
  "invitation_email": "alice@example.com",
  "platform_key": "acme",
  "auto_accept": true,
  "active": true,
  "redirect_to": "https://app.example.com/dashboard",
  "created": "2026-06-04T09:24:01Z"
}
```

The response confirms the invitation row was created — it does **not**
guarantee the email landed; delivery happens out-of-band.

### Status codes

| Code | When |
|------|------|
| `201` | Invitation created and queued for delivery. |
| `400` | Person has no `primary_email` — cannot invite. Disable the button when `primary_email` is null. |
| `403` | Caller missing `Ibl.CRM/Invite/action`. |
| `404` | Person not found in this Platform. |
| `409` | Active invitation already exists for this email + Platform. **Informational, not a hard error** — the body carries the pre-existing `invitation_id`. Treat as "already done"; offer a "resend" affordance. |
| `422` | Person already linked to a Platform user (`platform_user` is set). Hide the button. |

**409 body shape**

```json
{
  "detail": "Active PlatformInvitation already exists for this email + platform.",
  "invitation_id": 9821,
  "person_id": "<uuid>",
  "platform_key": "acme"
}
```

**RBAC:** `Ibl.CRM/Invite/action` — a **separate bucket** from
person-write. A role that can fully edit and delete people but does
not carry `Ibl.CRM/Invite/action` cannot send invitations. This is
deliberate: invitations send email and grant Platform access, so the
privilege is split out. See `/iblai-rbac` for the CRM Inviter role.

---

## 3. Merge duplicates

`POST /api/crm/persons/merge/`

Duplicates appear when the same human shows up through two channels —
a CSV import plus a webform submission, two integrations pointing at
the same address, a marketing list collision. Merge re-parents related
records onto a chosen primary and marks the rest inactive.

**Request**

```json
{
  "primary_id": "<uuid>",
  "duplicate_ids": ["<uuid>", "<uuid>"]
}
```

**Response** `200 OK`

```json
{
  "primary_id": "<uuid>",
  "merged_ids": ["<uuid>", "<uuid>"],
  "reparented": { "deals": 7, "activities": 23, "tags": 4 }
}
```

### What re-parents

In a single transaction:

- **Deals** — every deal that pointed at a duplicate now points at the primary.
- **Activities** — calls, meetings, tasks, notes are re-attached to the primary.
- **Tag assignments** — moved across, with one wrinkle: if the primary already carries the same tag, the duplicate's assignment is **dropped silently** (the `(tag, person)` unique constraint forbids stacking). The `reparented.tags` count reflects every assignment **touched** — both moves and drops — not just successful moves. For exact post-merge counts, compare before/after listings.

### What happens to duplicates

Duplicates are **not deleted**. Each duplicate's `active` flag is set
to `false` and the row remains retrievable by id. This preserves audit
trail and lets you investigate later — but it also means a
`GET /persons/{duplicate_id}/` after a merge returns the inactive row,
not a 404. Filter on `active=true` if your UI should hide them.

### Status codes

| Code | When |
|------|------|
| `200` | Merge complete (or no-op rerun — counts are zero). |
| `400` | `primary_id` appears in `duplicate_ids`, `duplicate_ids` empty, or cross-Platform duplicate. |
| `403` | Caller missing `Ibl.CRM/Persons/write`. |
| `404` | Primary not found in this Platform. |

**RBAC:** `Ibl.CRM/Persons/write`. Cross-Platform merges are
explicitly forbidden — every id must resolve to a person on the
caller's Platform.

---

## 4. Auto-link signal (implicit)

There is a fourth, implicit path. When a Platform user is created —
through signup, invitation acceptance, or admin action — the system
asynchronously walks the CRM and binds any matching person records
automatically. This is what makes bulk-imported person rows
"come to life" as their invitees register.

### Matching rules

After a Platform user is created with an active membership for a
Platform, the system searches that Platform for person rows where:

- `primary_email` equals the new user's email (case-insensitive), **or** `platform_user` is already set to that user,
- `active` is `true`,
- the person belongs to a Platform the user is an active member of.

For every match: `platform_user` is set, `active` is flipped to
`false`, and a **`CRM_PERSON_LINKED_TO_USER`** notification is
dispatched. Cross-ref `/iblai-crm-notification`.

The match is gated by Platform membership — a new user with email
`alice@example.com` only auto-links to person rows on Platforms they
actually belong to. Cross-Platform leakage is not possible through
this path.

### Sequence

```
1. App                POST /persons/  { primary_email: "alice@x.com" }
2. CRM API            201 Person       (active: true, platform_user: null)
   ... later ...
3. alice@x.com signs up as a Platform user
4. Background worker  matches persons by primary_email
5. CRM API            sets platform_user, flips active → false
6. Notification       CRM_PERSON_LINKED_TO_USER dispatched
```

### State-transition callout — build for it

The auto-link runs in the background, so the response that created
the Platform user returns **before** the link completes. Two
consequences for clients:

- A `GET /persons/{id}/` issued moments after a signup may still show
  `active: true` and `platform_user: null`. A retry seconds later
  shows the linked state. Build polling or a notification-driven
  refresh into any UI that surfaces this.
- A person can flip from `active: true` to `active: false` between
  page loads with no operator action in between. UIs that render a
  list of "active people" must tolerate rows disappearing on the next
  fetch; never crash on the transition.

### Edge cases

- A user with no email is **skipped** — the system will not bulk-link every blank-`primary_email` person to a fresh emailless user.
- A user with no active Platform memberships is **skipped** — no Platforms to scan.
- A person already bound to a different Platform user is **left alone** (the silent-refusal rule from [Link an existing Platform user](../../../../docs/developer/applications/crm.md#81-link-an-existing-platform-user) applies here too).
- Re-running auto-link for the same user is a no-op once everything is bound; it is safe to retry on background-task failures.
