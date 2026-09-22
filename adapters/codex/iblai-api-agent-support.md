# iblai-api-agent-support

> Manage an ibl.ai agent's human-support tickets via the platform API — list and filter the tickets users raised with an agent (by agent, requester, status, session), read a ticket's conversation thread, reply as the support team, change ticket status, and close or delete tickets. Use when triaging or responding to support requests escalated from agent chats.

# iblai-api-agent-support

Manage an agent's human-support tickets through the API: list and filter the
tickets users raised with an agent, read a ticket's reply thread, respond as
the support team, move tickets through their lifecycle, and close or delete
them. Use when triaging or responding to support requests escalated from
agent chats.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Prefix:** every route below hangs off
  `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}` (written `{u}`
  below). The path token is named `user_id` on the wire but takes the **username**.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.
- DELETE calls are destructive — confirm with the user first.

## Concepts

- **Tickets are opened by the agent, not by this API.** When a user asks an agent
  for human help mid-chat, the agent's human-support tool files a
  `HumanSupportTicket` — there is **no POST create endpoint** here. The requester
  fields (`username`, `email`, `full_name`, `user`) and the source `session` are
  resolved server-side from that chat; `subject` and `description` are authored by
  the agent (the `description` is often HTML or Markdown, not plain text).
- **Visibility:** org admins see every ticket in the org; other users see only the
  tickets they raised themselves.
- **Lifecycle:** `status` walks `open` → `in_progress` → `closed`. The dedicated
  `close/` endpoint both sets `status: closed` and stamps `resolved_at`.
- **Conversation thread:** each ticket has `TicketMessage` replies. `sender` is the
  numeric user id of the author — the requester's replies carry their `user` id,
  support-team replies carry the responder's id, and `null` marks a
  system-generated message.
- **Prerequisite:** the agent only offers escalation while its human-support tool
  is enabled — toggle it with **`/iblai-api-agent-tool`** (pull the exact slug
  from that skill's `available-tools/` read).

## Reads

### Tickets

- **GET** `{u}/support-tickets/?mentor_id={mentor}&status={open|in_progress|closed}&username={requester}&session={session}&page={n}&page_size={n}` — paged ticket list. Filters stack: `mentor_id` scopes to one agent, `username` to one requester, `session` to the chat session that raised the ticket.
- **GET** `{u}/support-tickets/{id}/` — one ticket.

### Messages

- **GET** `{u}/support-ticket-messages/?ticket={ticketId}&sender={userId}&page={n}&page_size={n}` — paged message list; pass `ticket` to load one ticket's conversation thread.
- **GET** `{u}/support-ticket-messages/{id}/` — one message.

## Writes

### Tickets

- **PUT** `{u}/support-tickets/{id}/` — replace a ticket's editable fields:
  ```json
  {
    "subject": "string (required, ≤255 chars)",
    "description": "string (required)",
    "status": "open | in_progress | closed"
  }
  ```
- **PATCH** `{u}/support-tickets/{id}/` — edit a subset (e.g. `{ "status": "in_progress" }`).
- **POST** `{u}/support-tickets/{id}/close/` — close a ticket (no body): sets `status: closed` and stamps `resolved_at`. Prefer this over patching `status` to `closed`.
- **DELETE** `{u}/support-tickets/{id}/` — delete a ticket (no body). Destructive — confirm with the user first.

### Messages

- **POST** `{u}/support-ticket-messages/` — reply on a ticket:
  ```json
  {
    "ticket": "integer (required, ticket id)",
    "message": "string (required)",
    "sender": "integer | null (optional; defaults to the caller)"
  }
  ```
- **PUT** `{u}/support-ticket-messages/{id}/` — replace a message (same fields as create).
- **PATCH** `{u}/support-ticket-messages/{id}/` — edit a subset (e.g. `{ "message": "string" }`).
- **DELETE** `{u}/support-ticket-messages/{id}/` — delete a message (no body). Destructive — confirm with the user first.

## Example

List one agent's open tickets, newest page first, then reply on ticket 42:

```bash
curl -s \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/support-tickets/?mentor_id=$MENTOR&status=open&page=1&page_size=10" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"

curl -X POST \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/support-ticket-messages/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ticket": 42, "message": "We are looking into this now."}'
```

## Notes

- List reads return a DRF page envelope — `{ "count": n, "next": url|null,
  "previous": url|null, "results": [...] }`; iterate `results`. DELETEs return `204`.
- There is no ticket-create endpoint — tickets only come from agent chats (see
  Concepts). To test the flow end-to-end, enable the human-support tool and ask
  the agent to escalate.
- `mentor_id` filters by the **agent's unique id**, not its name; `username`
  filters by the **requester**, independent of the `{username}` path token
  (the caller).
- `description` is agent-authored and frequently arrives as a full HTML document
  or Markdown — don't assume plain text when displaying or diffing it.
- Closing via `close/` is what stamps `resolved_at`; a plain `PATCH` to
  `status: closed` flips the status without the resolution timestamp.
- To load a conversation thread, filter messages by `ticket` and sort by
  `timestamp` ascending; match `sender` against the ticket's `user` to tell
  requester replies from support replies.

## Schema

**Ticket object** (`HumanSupportTicket`):

| field | mode | notes |
| --- | --- | --- |
| `id` | ro | integer |
| `username`, `email`, `full_name`, `user` | ro | requester identity; `user` is the numeric user id |
| `session` | ro | chat session the ticket was raised from |
| `subject` | rw | ≤255 chars |
| `description` | rw | agent-authored body; often HTML/Markdown |
| `status` | rw | `open` \| `in_progress` \| `closed` |
| `mentor_id` | ro | unique id of the agent the ticket belongs to |
| `created_at`, `updated_at` | ro | ISO 8601 |
| `resolved_at` | ro | ISO 8601 or null; stamped by `close/` |

**Message object** (`TicketMessage`): `id` (ro), `ticket` (ticket id), `sender`
(numeric user id or null for system messages), `message`, `timestamp` (ro, ISO 8601).