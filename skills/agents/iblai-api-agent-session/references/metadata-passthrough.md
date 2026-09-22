# Chat metadata pass-through

Explanatory companion to `/iblai-api-agent-session`. The endpoints, fields, and the
`metadata` → `client_context` model are authoritative in `SKILL.md` (`## Concepts`,
`## Reads`, `## Schema`); this file only adds what the endpoint reference doesn't — the
prompt-injection format, the per-transport wire notes (incl. the iframe channel), and
the caching semantics. Auth is unchanged: `Authorization: Api-Token $IBLAI_API_KEY`,
`{org}` = `$IBLAI_ORG`, `{user}` = `$IBLAI_USERNAME`.

> **Scope: this file is about the *soft* `metadata` field only.** `metadata` steers how the
> agent *reasons* (prompt context); it never restricts which documents RAG retrieves. If you
> want to *scope retrieval* to a subset of documents — e.g. answer only from California
> materials — that is the separate **hard** `document_filter` field, documented in
> `SKILL.md` (`## Concepts`, `## Schema`). The two are independent and can be sent together.
> A common mistake is putting a value like `stateCode` in `metadata` and expecting it to
> filter documents; it will not — soft `metadata` only augments the prompt (see
> "Soft vs. hard" below).

## The idea

`metadata` is free-form JSON (no schema) you attach to a chat turn to tell one deployed
agent *where/why* a message arrives — product, plan tier, page, region — without editing
its prompt or making the user restate context. Optional: omit it and the agent behaves as
before. It is persisted per session as `client_context` and surfaced on every read (the
session read, the history export, and analytics `summary.client_context` — see
`SKILL.md ## Reads`, don't re-fetch from here).

The keys are your app's own — support: `product`/`planTier`/`region`; training:
`department`/`courseId`/`employeeLevel`; commerce: `category`/`brand`/`priceRange` — no
schema is enforced.

## What the agent sees

The runner appends the metadata to the user's prompt as `key: value` lines wrapped in
markers, before the LLM runs:

```
How do I set up SSO?

<CONTEXT METADATA> Here is additional context metadata for this conversation:
product: Analytics
planTier: Enterprise
region: EU
</END CONTEXT METADATA>
```

The agent only *acts* on this if its **system prompt** tells it to. To make behavior track
the context, reference the keys explicitly, e.g. "When `planTier` is given, only suggest
features on that plan; when `region` is EU, note data-residency." Unlike `page_content`,
these markers are **not** stripped — they remain in saved chat history.

## Per transport

Same `metadata` field, same pipeline, every transport:

- **SSE / WebSocket** — a field in the `BaseConsumerPayload` body (`SKILL.md ## Writes`);
  identical shape at `POST …/api/agent/chat/` and `wss://asgi.data.iblai.app/ws/chat/`.
- **Embedded iframe** — the host page has no direct socket, so it hands context to the
  chat widget over `postMessage`; the widget forwards it into its WS payload:
  ```javascript
  iframe.contentWindow.postMessage({
    type: 'MENTOR:CONTEXT_UPDATE',         // verbatim protocol constant
    hostInfo: { title: document.title, href: location.href },
    pageContent: bodyText,                  // → page_content
    metadata: { productGroup: 'LICENSING' } // soft: prompt context, NOT a retrieval filter
  }, '*');
  ```
  Widget contract: listen for `type: 'MENTOR:CONTEXT_UPDATE'`, take `metadata`, include it
  on every `/ws/chat/` send. Note: `metadata` here is **soft** — to scope retrieval by e.g.
  `stateCode`, the widget must send a separate `document_filter` (hard) on the WS payload,
  not fold it into `metadata`.

## Session semantics

- **Send once** — cached on the session, reused for later turns that omit it.
- **Replace, not merge** — a new `metadata` object overwrites the cached one whole.
- **Null / omitted = no change** — the last value keeps applying.
- Cache is short-lived (~2h TTL) but also written to the session record, so it survives
  cache expiry; reads always reflect the persisted `client_context`.

## Storage & pipeline

The validated payload (`BaseConsumerPayload`) reaches the consumer
(`BaseLLMRunnerConsumer.process_text_data`), which caches *and* persists the metadata; the
runner (`LLMRunner.asetup_user_prompt`) then composes the prompt in order — greeting
instructions, then any `page_content`, then the metadata block — and the message is saved
with the markers intact. It lands in three places:

| Layer | Location | Role |
|-------|----------|------|
| Cache | Redis `session_{session_id}_metadata` | fast access during the live conversation (~2h TTL) |
| Session | `Session.metadata["client_context"]` | persistent store the reads and exports return |
| Per message | `ChatMessageHistoryExtra.metadata` | snapshot of the metadata as it stood at each message |

The session layer is what `client_context` reads back; the per-message layer additionally
records the metadata *as it was at that message*, so exported history reflects mid-session
changes. Beyond the reads in `SKILL.md`, the same value also surfaces as a `client_context`
column in the analytics reporting export (`get_chat_message_history`).

## One agent, many contexts

The point of session-level metadata: a single deployed agent serves every surface and the
caller sets the frame per session. The Analytics page on Enterprise sends
`{product:"Analytics", planTier:"Enterprise", region:"EU"}`, and "How do I set up SSO?"
gets Enterprise SSO steps with EU data-residency notes; the Payments page on Starter sends
`{product:"Payments", planTier:"Starter"}`, and the *same* agent explains Starter
integration and that SSO needs an upgrade. No per-surface agents, no prompt edits — just
the metadata plus a system prompt that reads it.

## Soft `metadata` vs. hard `document_filter`

These are two different fields with two different jobs. Sending one does not do the other's
work; you can send both on the same turn.

| | `metadata` (soft) | `document_filter` (hard) |
|---|---|---|
| Affects | the **prompt** the agent reads | which **documents** RAG may retrieve |
| Mechanism | `<CONTEXT METADATA>` block appended to the prompt | inclusive allow-list over docs' ingested `custom_metadata` |
| Persistence | session-sticky, saved as `client_context` | per-turn only, never persisted, never in the prompt |
| Value types | any JSON | scalars only (`str`/`int`/`float`/`bool`) |
| Restricts retrieval? | **no** | **yes** |

**Inclusive matching (the rule that makes generic material coexist with scoped material).**
`document_filter` keeps a document when, for **every** filter key, the document either
matches that key's value **or does not carry that key at all**; it drops a document only
when it carries the key with a *different* value. Multiple keys are AND'd. So a document
ingested **without** a given key is never excluded by a filter on that key.

**State-specific + generic in one retrieval (e.g. an Insurance Explainer).** Say California
students must get California materials for CA-specific questions *and* the generic Life &
Health materials for general questions:

1. Ingest generic materials with **no** `stateCode` in `custom_metadata`.
2. Ingest state materials with `stateCode = "CA"`, `"NY"`, etc.
3. On every turn send `document_filter: {"stateCode": "CA"}`.

Result: California docs (match) **and** generic docs (lack the key → included) are eligible;
other states (different value) are excluded — a single hard filter, no two-stage
orchestration. Pitfalls to avoid:

- Do **not** tag the generic materials with any `stateCode` — if they carry a state they'll
  be excluded by a different-state filter, and general questions will lose them.
- Do **not** use an empty value (`{"stateCode": ""}`) to mean "any state." Empty matches no
  stored value and keeps only untagged docs; if every doc is tagged you get an **empty
  candidate set**, and the agent may answer with no retrieved context. To search everything,
  send **no** `document_filter` at all.
- Matching is exact and case/type-sensitive: `"CA"` ≠ `"ca"`, and the integer `2026` ≠ the
  string `"2026"`. Keep the filter value identical to what you ingested.
- The filter only shrinks the candidate set; **top-k ranking still runs afterward**. If
  generic material is eligible but not surfacing next to many state docs, raise the agent's
  retrieval `k`.
