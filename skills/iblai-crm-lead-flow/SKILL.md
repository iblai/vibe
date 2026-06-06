---
name: iblai-crm-lead-flow
description: Build the CRM top-of-funnel surface — lead-capture form, contacts table with lifecycle filter, organization records, and the three person onboarding actions (link existing Platform user, invite by email, merge duplicates). Use when the user mentions CRM leads, contacts, people, persons, organizations, lead capture, contact intake, link to user, invite by email, merge duplicates, or lifecycle stage. See /iblai-crm-overview for shared setup and RBAC, /iblai-crm-deal-flow to open a deal once a person exists, /iblai-crm-activity for the timeline, /iblai-crm-tag for tag chips, /iblai-crm-notification for the events this flow fires, /iblai-rbac for CRM Inviter/User/Manager roles, and /iblai-auth for token wiring.
globs:
alwaysApply: false
---

# /iblai-crm-lead-flow

Build the people-and-organizations surface of the CRM: capture leads, list
contacts, view person detail, manage organizations, and run the three
onboarding actions (link, invite, merge).

Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
They ship with their own styling. Keep the components as-is.
Do NOT implement dark mode unless the user explicitly asks for it.

When building custom UI around SDK components, use the ibl.ai brand:
- **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
- **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
- **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
- Follow the component hierarchy: use ibl.ai SDK components
  (`@iblai/iblai-js`) first, then shadcn/ui for everything else
  (`npx shadcn@latest add <component>`). Do NOT write custom components
  when an ibl.ai or shadcn equivalent exists. Both share the same
  Tailwind theme and render in ibl.ai brand colors automatically.
- Follow [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md) for
  colors, typography, spacing, and component styles.

You MUST run `/iblai-ops-test` before telling the user the work is ready.

After all work is complete, start a dev server (`pnpm dev`) so the user
can see the result at http://localhost:3000.

`iblai.env` is NOT a `.env.local` replacement — it only holds the 3
shorthand variables (`DOMAIN`, `PLATFORM`, `TOKEN`). Next.js still reads
its runtime env vars from `.env.local`.

Use `pnpm` as the default package manager. Fall back to `npm` if pnpm
is not installed. The generated app should live in the current directory,
not in a subdirectory.

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth must be set up first (`/iblai-auth`) — this skill reuses the
  token that `/iblai-auth` wired into `.env.local`. Do not introduce
  a new auth layer.
- MCP and skills must be set up: `iblai add mcp`
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing,
  tell the user to download the template:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- Caller must hold the **CRM User** role for person and organization
  CRUD. Add the **CRM Inviter** role on top if you need
  `POST /persons/{id}/invite/`. See `/iblai-rbac` for the full matrix.

## What you'll build

- A **lead-capture form** that POSTs to `/api/crm/persons/` with
  `name`, `primary_email`, `lifecycle_stage`, optional `organization`,
  and free-form `metadata`.
- A **contacts table** at `/crm/contacts` with a lifecycle-stage
  filter, owner filter, and tag filter, backed by
  `GET /api/crm/persons/` and the standard
  `{count, next_page, previous_page, results}` envelope.
- A **person detail panel** that loads `GET /api/crm/persons/{id}/`
  and exposes three onboarding action buttons: **Link to user**,
  **Invite by email**, **Merge duplicates**.
- An **organizations table + form** at `/crm/organizations` for
  `GET`/`POST /api/crm/organizations/`.
- An **action-result toast** layer so the silent-refusal footgun on
  `link-user/` is surfaced loudly.

Reference tables for every endpoint live in:

- `references/persons-api.md`
- `references/organizations-api.md`
- `references/onboarding-flows.md`

## Step 1: Install shadcn primitives

The contacts table, lead form, detail panel, and the link/invite/merge
dialogs use only shadcn primitives. Install once:

```bash
npx shadcn@latest add form table dialog select badge input textarea
```

Do not write custom replacements for these — they share the ibl.ai
Tailwind theme automatically.

## Step 2: Add a typed CRM API client

Reuse the auth token that `/iblai-auth` wrote into `.env.local`
(`NEXT_PUBLIC_API_BASE_URL`, and the user token read from localStorage
under the same key `/iblai-auth` uses). Do NOT introduce a new
token-management layer.

Create `lib/iblai/crm-client.ts`:

```ts
const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/crm`;

function token() {
  // /iblai-auth stores the access token in localStorage. Reuse it.
  return typeof window !== "undefined"
    ? localStorage.getItem("ibl_access_token") ?? ""
    : "";
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(res.statusText), { status: res.status, body });
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export type Page<T> = {
  count: number;
  next_page: number | null;
  previous_page: number | null;
  results: T[];
};

export type LifecycleStage =
  | "lead"
  | "qualified"
  | "opportunity"
  | "customer"
  | "churned";

export type Person = {
  id: string;
  platform: number | string;
  name: string;
  primary_email: string | null;
  emails: { label: string; email: string }[];
  contact_numbers: { label: string; number: string }[];
  job_title: string;
  organization: string | null;
  owner: number | null;
  platform_user: number | null;
  lifecycle_stage: LifecycleStage;
  unique_id: string;
  active: boolean;
  tags: { id: number; name: string; color: string }[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  platform: number | string;
  name: string;
  address: Record<string, unknown>;
  owner: number | null;
  tags: { id: number; name: string; color: string }[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const crm = {
  // Persons
  listPersons: (q: URLSearchParams) =>
    call<Page<Person>>(`/persons/?${q.toString()}`),
  getPerson: (id: string) => call<Person>(`/persons/${id}/`),
  createPerson: (body: Partial<Person>) =>
    call<Person>(`/persons/`, { method: "POST", body: JSON.stringify(body) }),
  patchPerson: (id: string, body: Partial<Person>) =>
    call<Person>(`/persons/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePerson: (id: string) =>
    call<void>(`/persons/${id}/`, { method: "DELETE" }),
  linkUser: (id: string, user_id: number) =>
    call<Person>(`/persons/${id}/link-user/`, {
      method: "POST",
      body: JSON.stringify({ user_id }),
    }),
  invite: (
    id: string,
    body: {
      is_admin?: boolean;
      is_staff?: boolean;
      enrollment_config?: Record<string, unknown>;
      redirect_to?: string;
    },
  ) =>
    call<{
      person_id: string;
      invitation_id: number;
      invitation_email: string;
      platform_key: string;
      auto_accept: boolean;
      active: boolean;
      redirect_to: string | null;
      created: string | null;
    }>(`/persons/${id}/invite/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  merge: (primary_id: string, duplicate_ids: string[]) =>
    call<{
      primary_id: string;
      merged_ids: string[];
      reparented: { deals: number; activities: number; tags: number };
    }>(`/persons/merge/`, {
      method: "POST",
      body: JSON.stringify({ primary_id, duplicate_ids }),
    }),

  // Organizations
  listOrgs: (q: URLSearchParams) =>
    call<Page<Organization>>(`/organizations/?${q.toString()}`),
  getOrg: (id: string) => call<Organization>(`/organizations/${id}/`),
  createOrg: (body: Partial<Organization>) =>
    call<Organization>(`/organizations/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
```

All examples in the references send `Authorization: Token …` — this
client does the same.

## Step 3: Lead-capture form

Page route: `app/crm/leads/new/page.tsx`. Fields:

- `name` — required, text input.
- `primary_email` — recommended; auto-link binds on Platform signup.
- `lifecycle_stage` — `Select` defaulting to `lead`
  (`lead | qualified | opportunity | customer | churned`).
- `organization` — `Select` populated from
  `crm.listOrgs(new URLSearchParams())`.
- `metadata` — `textarea`, parsed as JSON before submit.

Submit calls `crm.createPerson({...})`. On `201` redirect to
`/crm/contacts/{id}`. Handle:

- `400` with a `unique_id` array → show the server message under the
  `unique_id` field (duplicate import key).
- `403` → "You need the CRM User role to create contacts" (cross-ref
  `/iblai-rbac`).

Full field table: [`POST /persons/` in the Persons API reference](references/persons-api.md#post-persons).

## Step 4: Contacts table

Page route: `app/crm/contacts/page.tsx`. Fetch via
`crm.listPersons(query)` where `query` is built from URL search params:

- `lifecycle_stage` — `Select` with the five stages plus "All".
- `owner` — numeric input or owner picker.
- `tags` — multi-select; emit `?tags=1&tags=2` (OR semantics, results
  de-duplicated server-side).
- `page` / `page_size` — pagination, max `page_size=100`.

Render rows in a shadcn `Table`. Columns: name, primary_email,
lifecycle stage (`Badge`), owner, tags (chip per item). Wire pagination
off the `{count, next_page, previous_page, results}` envelope — do not
assume cursor pagination.

Each row links to `/crm/contacts/{id}`.

## Step 5: Person detail panel + onboarding actions

Page route: `app/crm/contacts/[id]/page.tsx`. Load via
`crm.getPerson(id)`. Display name, email, lifecycle stage,
organization, owner, `platform_user` (when set), tags, metadata, and
the three action buttons described below.

### 5a. Link to existing Platform user

Dialog with a single `user_id` numeric input. On submit:

```ts
const linked = await crm.linkUser(person.id, Number(userId));

// SILENT-REFUSAL FOOTGUN: a 200 response whose platform_user
// does NOT equal the requested user_id means the person was already
// bound to a different user and the existing binding was preserved.
// You MUST assert equality client-side before claiming success.
if (linked.platform_user !== Number(userId)) {
  toast.error(
    `This person is already linked to user ${linked.platform_user}. ` +
      `The existing binding was preserved.`,
  );
} else {
  toast.success("Linked to Platform user.");
}
```

Status codes to handle: `400` (missing/wrong `user_id`), `403` (target
user has no active `UserPlatformLink` — surface "issue an invitation
instead"), `404` (person or user does not exist). Full table:
[the Link flow in the onboarding reference](references/onboarding-flows.md#1-link-an-existing-platform-user).

### 5b. Invite by email

Dialog with `is_admin` and `is_staff` checkboxes, optional
`enrollment_config` (textarea, JSON), and optional `redirect_to` URL.
Requires the person to have a `primary_email`.

Status codes:

| Code | Meaning |
|------|---------|
| `201` | Invitation queued. Show success toast. |
| `400` | Person has no `primary_email`. Disable the button when null. |
| `403` | Caller missing `Ibl.CRM/Invite/action` (CRM Inviter role). |
| `404` | Person not found. |
| `409` | Active invitation already exists. Body contains `invitation_id` — treat as "already done", offer a "resend" affordance. |
| `422` | Person already linked to a Platform user. Hide the button when `platform_user` is set. |

Full body and field list: [the Invite flow in the onboarding reference](references/onboarding-flows.md#2-invite-by-email).

### 5c. Merge duplicates

Dialog with a multi-select of duplicate person rows to merge into the
current (primary) person. Submit:

```ts
const result = await crm.merge(primaryId, duplicateIds);
// result.reparented = { deals, activities, tags }
toast.success(
  `Merged ${result.merged_ids.length} duplicates. ` +
    `Reparented ${result.reparented.deals} deals, ` +
    `${result.reparented.activities} activities, ` +
    `${result.reparented.tags} tag assignments.`,
);
```

Status codes: `400` (primary in `duplicate_ids`, empty
`duplicate_ids`, cross-Platform duplicate), `403`, `404`. Duplicates
are **soft-deleted** (`active=false`); their rows are still
retrievable by id, so list views must filter on `active=true`.

## Step 6: Organizations table + form

Page route: `app/crm/organizations/page.tsx`. Use
`crm.listOrgs(query)` with `?name=<substring>&owner=<id>&tags=…`.
Render in a shadcn `Table` with name, owner, tags, created_at.

Create form at `app/crm/organizations/new/page.tsx`:

- `name` — required, must be unique within the Platform
  (case-sensitive, trimmed). Handle `400 {"name": ["… already exists …"]}`
  by surfacing the message inline.
- `address` — free-form JSON `textarea` (the recommended shape
  `{street, city, state, zip, country}` is a hint, not enforced).
- `owner` — optional numeric.
- `metadata` — free-form JSON.

Deleting an organization sets `Person.organization` and
`Deal.organization` to `null` on every referencing row — there is no
cascade-delete. Tag assignments on the organization are removed. Full
shape: `references/organizations-api.md`.

## Auto-link signal

You do not need to call any endpoint for this — but you must build for
it. When a Platform user is created (signup, invitation acceptance,
admin) and their email matches a Person's `primary_email`
(case-insensitive) on a Platform they belong to, the system
asynchronously sets `platform_user`, flips `active` from `true` to
`false`, and fires a `CRM_PERSON_LINKED_TO_USER` notification.

Two UI consequences:

- A `GET /persons/{id}/` issued seconds after signup may still show
  `active: true` and `platform_user: null`. Build polling or a
  notification-driven refresh into any view that surfaces this state.
- A row can disappear from an "active people" list between page loads
  with no operator action in between. Tolerate the transition; do not
  crash on missing rows.

The notification fires regardless of whether your CRM UI is open.
Cross-ref `/iblai-crm-notification` for recipient routing and how to
subscribe an inbox.

## Verify

Run `/iblai-ops-test` before reporting done.

```bash
pnpm build         # must pass with zero errors
pnpm typecheck
pnpm dev &
npx playwright screenshot http://localhost:3000/crm/leads/new       /tmp/crm-lead.png
npx playwright screenshot http://localhost:3000/crm/contacts        /tmp/crm-contacts.png
npx playwright screenshot http://localhost:3000/crm/organizations   /tmp/crm-orgs.png
```

Smoke checklist:

- [ ] Create a Person via the lead form → row appears in contacts table.
- [ ] Filter the contacts table by `lifecycle_stage=qualified`.
- [ ] Open the detail panel; click **Link to user** with a known
      `user_id` and confirm `platform_user === user_id`.
- [ ] Repeat **Link to user** with the same `user_id` on a person
      already bound elsewhere — confirm the silent-refusal toast fires
      (response is 200, but `platform_user` differs).
- [ ] **Invite by email** a person with a `primary_email`; the second
      attempt returns 409 with the same `invitation_id`.
- [ ] **Merge** two duplicates into a primary; confirm
      `reparented.{deals,activities,tags}` counts are returned.
- [ ] Create an Organization; deleting it does not cascade-delete
      Persons that referenced it.

## Related skills

- `/iblai-crm-overview` — setup, RBAC, seeded defaults, links to every sibling skill.
- `/iblai-crm-deal-flow` — once a person exists, open a deal on the kanban.
- `/iblai-crm-activity` — log timeline events (calls, meetings, notes, tasks) on a person.
- `/iblai-crm-tag` — tag CRUD and chip components for people and organizations.
- `/iblai-crm-notification` — `CRM_PERSON_CREATED` and `CRM_PERSON_LINKED_TO_USER` fire from this flow.
- `/iblai-rbac` — CRM Inviter / CRM User / CRM Manager roles and the action-definitions endpoint.
- `/iblai-auth` — token wiring this skill reuses.
