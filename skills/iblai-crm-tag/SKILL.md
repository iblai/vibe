---
name: iblai-crm-tag
description: Build the CRM tag manager — CRUD on /api/crm/tags/ with hex color picker, a reusable tag chip, attach/detach controls on Person/Organization/Deal detail pages, and tag filters on list views with OR semantics. Use when the user mentions CRM tags, labels, tagging, color chips, tag manager, attach tag, detach tag, filter by tag, or wants to add segmentation labels to people/orgs/deals. See /iblai-crm-overview for setup and RBAC, /iblai-crm-lead-flow for the person/org host pages, /iblai-crm-deal-flow for the deal host pages, /iblai-rbac for the CRM User role, and /iblai-auth for token wiring.
globs:
alwaysApply: false
---

# /iblai-crm-tag

Build the CRM tag surface — tag CRUD dialog, color chip, attach/detach
controls on Person, Organization, and Deal pages, plus a `?tags=` filter
on every CRM list view.

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

- Auth must be set up first (`/iblai-auth`) — provides the platform
  `Authorization: Token <token>` header used by every call below.
- MCP and skills must be set up: `iblai add mcp`.
- `iblai.env` populated with `PLATFORM`, `DOMAIN`, `TOKEN`. If missing,
  tell the user to download the template:
  `curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`
- The signed-in user must hold the **CRM User** role (or higher) on the
  Platform. CRM User unlocks `Ibl.CRM/Tags/list`, `read`, `action`,
  `write`, and `delete`. CRM Viewer can only see tags, not write or
  attach them. See `/iblai-rbac` for the role matrix and how to assign
  CRM roles to a user.
- At least one host surface should already exist so there is something
  to tag. Run `/iblai-crm-lead-flow` (people + organizations) or
  `/iblai-crm-deal-flow` (deals) first if you have not yet.

## What you'll build

1. A **tag manager dialog** — list, create, edit, and delete tags. Color
   input is validated client-side against `^#[0-9A-Fa-f]{6}$` before
   submit so the user sees errors immediately (the server applies the
   same regex).
2. A **tag chip** component — renders `{id, name, color}` with the hex
   color as background. Optional `x` button for detach.
3. **Attach / detach controls** on Person, Organization, and Deal detail
   pages. The contract is uniform: `POST /{host}/{id}/tags/` with
   `{tag_id}`, `DELETE /{host}/{id}/tags/{tag_id}/`.
4. A **tag filter** on Person, Organization, and Deal list views —
   `?tags=<id>&tags=<id2>` with **OR** semantics. Results are
   de-duplicated by the backend.

## Step 0: Check for CLI updates

```bash
iblai --version    # upgrade if outdated: pip install --upgrade iblai-app-cli OR npm i -g @iblai/cli@latest
```

## Step 1: Install shadcn primitives

```bash
npx shadcn@latest add dialog input form popover command badge button
```

`dialog` powers the tag manager and the delete-confirmation modal.
`popover` + `command` together make a searchable tag combobox for the
attach control. `badge` is the visual base for the tag chip. `input`
+ `form` cover the create/edit form. `button` covers actions.

## Step 2: Typed API client wrapper

Reuse the auth token wired in `/iblai-auth`. Create
`lib/iblai/crm-tags.ts` with one wrapper per route. Base URL is
`${NEXT_PUBLIC_API_BASE_URL}/api/crm`.

```typescript
// lib/iblai/crm-tags.ts
const BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/crm`;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export type Tag = {
  id: number;
  platform: number;
  name: string;
  color: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TagChip = Pick<Tag, "id" | "name" | "color">;

export type Assignment = { assignment_id: number; tag: TagChip };

function authHeaders(token: string) {
  return {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };
}

// Tag CRUD
export async function listTags(token: string, params: { name?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.name) qs.set("name", params.name);
  if (params.page) qs.set("page", String(params.page));
  const r = await fetch(`${BASE}/tags/?${qs}`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(`listTags ${r.status}`);
  return r.json() as Promise<{ count: number; results: Tag[]; next_page: number | null; previous_page: number | null }>;
}

export async function createTag(token: string, body: { name: string; color?: string; metadata?: Record<string, unknown> }) {
  if (body.color && !HEX.test(body.color)) {
    throw new Error("Color must match ^#[0-9A-Fa-f]{6}$");
  }
  const r = await fetch(`${BASE}/tags/`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) });
  if (!r.ok) throw await r.json();
  return r.json() as Promise<Tag>;
}

export async function patchTag(token: string, id: number, body: Partial<Pick<Tag, "name" | "color" | "metadata">>) {
  if (body.color && !HEX.test(body.color)) {
    throw new Error("Color must match ^#[0-9A-Fa-f]{6}$");
  }
  const r = await fetch(`${BASE}/tags/${id}/`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(body) });
  if (!r.ok) throw await r.json();
  return r.json() as Promise<Tag>;
}

export async function deleteTag(token: string, id: number) {
  const r = await fetch(`${BASE}/tags/${id}/`, { method: "DELETE", headers: authHeaders(token) });
  if (!r.ok && r.status !== 204) throw new Error(`deleteTag ${r.status}`);
}

// Uniform host attach / detach. `host` is "persons" | "organizations" | "deals".
export type Host = "persons" | "organizations" | "deals";

export async function attachTag(token: string, host: Host, hostId: string | number, tagId: number): Promise<Assignment> {
  const r = await fetch(`${BASE}/${host}/${hostId}/tags/`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ tag_id: tagId }),
  });
  // 201 = created; 409 = already attached, body still carries assignment_id + tag.
  if (r.status === 201 || r.status === 409) return r.json();
  throw await r.json();
}

export async function detachTag(token: string, host: Host, hostId: string | number, tagId: number) {
  const r = await fetch(`${BASE}/${host}/${hostId}/tags/${tagId}/`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  // 204 = removed; 404 = not attached (treat as no-op success).
  if (r.status !== 204 && r.status !== 404) throw new Error(`detachTag ${r.status}`);
}
```

See `references/tags-api.md` for full endpoint table, error shapes, and
filter semantics.

## Step 3: Tag manager dialog

Create `components/crm/tag-manager-dialog.tsx`. It is a single dialog
that lists all tags from `GET /tags/`, lets the user create a new tag,
edit an existing tag, or delete one.

Requirements:

- **Create form**: `name` (required, ≤ 64 chars, unique-per-Platform —
  server-enforced) and `color` (`<input type="color">` is fine; on
  submit, validate the value against `^#[0-9A-Fa-f]{6}$` before
  calling `createTag`). Surface the server's 400 errors verbatim —
  duplicate name, blank name, > 64 chars, bad hex.
- **Edit**: inline rename + recolor calls `patchTag`. Renames take
  effect immediately on every host chip — the chip renders from the
  Tag row, not from the assignment.
- **Delete**: opens a confirmation modal — see the destructive cascade
  callout below. Disable the delete button until the user types the
  tag name to confirm, or at minimum require a second click.

The dialog reads the token from the auth store wired by `/iblai-auth`.

## Step 4: Tag chip component

Create `components/crm/tag-chip.tsx`. Renders `{id, name, color}` as a
shadcn `Badge` with `style={{ backgroundColor: tag.color, color: '#fff' }}`.
Accept an optional `onDetach: () => void` prop — when supplied, render
a small `x` icon button inside the chip; otherwise render the chip as
read-only.

```tsx
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { TagChip as TTagChip } from "@/lib/iblai/crm-tags";

export function TagChip({ tag, onDetach }: { tag: TTagChip; onDetach?: () => void }) {
  return (
    <Badge style={{ backgroundColor: tag.color, color: "#fff" }} className="gap-1">
      {tag.name}
      {onDetach ? (
        <button onClick={onDetach} aria-label={`Detach ${tag.name}`} className="ml-1">
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </Badge>
  );
}
```

The `tags` array is **always present** on every Person, Organization,
and Deal list/detail response — empty array, never `null`. So your
renderer can iterate unconditionally.

## Step 5: Attach control on host detail pages

On Person, Organization, and Deal detail pages, add an "Add tag"
button that opens a shadcn `Popover` containing a `Command` combobox.
Populate the combobox with `listTags(token)` (search-as-you-type by
filtering client-side, or pass `name=` to the API for large libraries).

On select:

```typescript
const { assignment_id, tag } = await attachTag(token, host, hostId, selectedTagId);
// Optimistically add `tag` to the local host.tags array; assignment_id is for
// future detach reconciliation, not required for the chip itself.
```

Edge cases:

- **409 Conflict** — the tag is already attached. The response body
  still carries the existing `assignment_id` + `tag`, so you can
  reconcile local state without a re-fetch and **must not** show a red
  error toast. Treat 409 as a no-op success.
- **404 Not Found** — the tag id is not in this Platform. Show
  "Tag not found." The API never leaks existence across Platforms.

## Step 6: Detach control

Render the host's `tags` array as `TagChip` components with `onDetach`
wired to `detachTag(token, host, hostId, tag.id)`.

Edge case:

- **404 Not Found** on detach means the tag was not attached. Detach
  is **not** idempotent server-side — a retried DELETE returns 404,
  not 204. Client code should treat both as the same success state.
  The wrapper above already does this.

## Step 7: Tag filter on list views

Wire a multi-select tag picker into the Person, Organization, and Deal
list pages.

The list endpoints accept repeated or comma-separated `tags`:

```
GET /api/crm/persons/?tags=7&tags=12
GET /api/crm/persons/?tags=7,12
```

Both forms have **OR** semantics — a record matching any selected tag
appears once (the backend de-duplicates). The filter composes with
every other filter on the same endpoint, e.g.:

```
GET /api/crm/persons/?tags=7&lifecycle_stage=customer&owner=4
```

Implementation: bind the selected tag-ids to `URLSearchParams.append`
so a `tags` array becomes repeated params, then refetch the list.

## Destructive cascade callout

> **Deleting a tag silently removes it from every Person, Organization,
> and Deal it is attached to.** `DELETE /tags/{id}/` cascades — there
> is no preview, no soft-delete, and no undo.

Best practice [confirm before deleting a tag](../../../docs/developer/applications/crm.md#167-confirm-before-deleting-a-tag): gate the delete button behind a confirmation modal
that **names the tag explicitly** ("Delete tag *Enterprise*?"), states
the consequence ("This will remove the tag from N records across people,
organizations, and deals."), and requires an affirmative second action
(typing the tag name or clicking a destructive button), not a single
"OK". Optionally pre-fetch impact counts:

```
GET /api/crm/persons/?tags={id}&page_size=1   → response.count
GET /api/crm/organizations/?tags={id}&page_size=1
GET /api/crm/deals/?tags={id}&page_size=1
```

See `references/tags-api.md` for the full endpoint contract, error
shapes, and host attach/detach matrix.

## Verify

Run `/iblai-ops-test` before reporting done:

1. `pnpm build` — must pass with zero errors.
2. `pnpm dev` and visit the surface in the browser:
   - Open the tag manager. Try to create a tag with color `#FFF`
     (three digits) — the client should reject it before the request
     leaves; if you bypass the client check, the server returns
     `400 {"color": ["Color must be a hex string like \`#3F6BFF\`."]}`.
   - Create a valid tag (`name`: `Enterprise`, `color`: `#3F6BFF`).
   - On a Person detail page, attach the tag. Confirm the chip
     renders. Click attach a second time — UI must not flash an
     error (409 path).
   - On an Organization detail page, attach the same tag.
   - On a Deal detail page, attach the same tag.
   - Detach the tag from the Person — chip disappears.
   - On the Person list view, filter by the tag (`?tags=<id>`) and
     confirm only tagged people remain.
   - Trigger the delete-tag confirmation modal — confirm copy names
     the tag and warns about cascade.
3. Screenshot:
   ```bash
   npx playwright screenshot http://localhost:3000/crm/tags /tmp/tags.png
   ```

## Related skills

- `/iblai-crm-overview` — setup, RBAC
- `/iblai-crm-lead-flow` — attach tags to persons and organizations
- `/iblai-crm-deal-flow` — attach tags to deals; filter board by tag
- `/iblai-rbac` — CRM User role required for tag writes
- `/iblai-auth` — token wiring
