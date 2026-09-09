# Memory system — concepts

Non-endpoint background for [`/iblai-api-agent-memory`](../SKILL.md): how extraction and
injection actually behave, the enablement cascade, and symptom→fix. The memory model,
endpoints, settings, and field schemas live in `SKILL.md` — this only adds what a caller
can't infer from the endpoints themselves.

## Architecture

Four backend pieces (in the DM service, `iblai/iblai-dm-pro` (private backend repo))
implement the extraction (write) and injection (read) paths described below:

| Piece | Source | Role |
| --- | --- | --- |
| `MemoryExtractionService` | `services/memory_extraction.py` | Pulls memories from a conversation turn via one LLM call (write path). |
| `MemoryStore` | `services/memory_store.py` | Storage, deduplication, and semantic (PGVector) retrieval. |
| `MemoryContextService` | `services/memory_context.py` | Formats retrieved memories for prompt injection (read path). |
| `process_message_for_memory` | `tasks.py` | Celery task that runs extraction in the background. |

## Default categories

Agent memories file under categories (see `SKILL.md` → Concepts). Five ship by default and
**auto-seed on an agent's first extraction** — a brand-new agent's `memory-categories/` may
come back empty until then.

| Slug | Captures |
| --- | --- |
| `knowledge_gaps` | Topics the user struggles with. |
| `learning_goals` | What the user wants to achieve. |
| `preferences` | Learning style, pace, content preferences. |
| `progress_milestones` | Achievements and completed milestones. |
| `personal_context` | Personal info the user shared. |

## Extraction (the write path)

Capture is **not synchronous with chat**. After the agent replies, a background Celery task
(`process_message_for_memory`, queue `ai_agent`, 60s soft / 90s hard timeout) does the work —
so new memories lag the turn by seconds, and a killed worker silently drops that turn's capture.

- **One LLM call** does both jobs: it decides whether anything is worth storing (`has_memories`)
  *and* extracts it, keeping cost/latency low. It runs on a cheap small model (e.g.
  `gpt-4o-mini`), fed the user message, the agent reply, the category list, and a summary of
  existing memories. Output shape: `{ has_memories, global_memories[], mentor_memories{ slug: [...] } }`.
- Every candidate row passes **3-layer dedup** before it's written: (1) SHA-256 hash — drops
  exact duplicates; (2) PGVector cosine distance `< 0.15` — drops near-duplicates; (3) the
  existing-memory summary above steers the LLM off repeats. Dupes that still slip through are
  rare hash edge cases — delete them via the API.

## Injection (the read path)

On a new message, memory is injected **only if agent memory is on AND the user's
`use_memory_in_responses` is on** (see cascade). When it runs: embed the user's message,
semantic-search the top ~5 global + top ~5 agent memories by cosine distance, and prepend them
to the system prompt as markdown — roughly:

```markdown
## User Information
- The user is a software engineer with 5 years of experience

## Relevant Context from Previous Conversations
- [Knowledge Gaps] The user struggled with recursion
- [Preferences] Prefers Python examples over pseudocode
```

## Enablement cascade

Three switches gate memory top-down. A disabled level stops everything beneath it, whatever the
lower levels say:

1. **Org** — `enable_memsearch` (read via `memsearch-status`). Master switch; off = no memory
   for anyone in the org.
2. **Agent** — per-agent memory toggle; also where categories are managed. Off = no memory for
   this agent.
3. **User** — `memsearch-settings`: `auto_capture_enabled` gates extraction,
   `use_memory_in_responses` gates injection. Lets a user opt out of capture, recall, or both
   for privacy even when org + agent are on.

## Notes

- **Embeddings:** 1536-dim, OpenAI / Azure OpenAI, stored in PostgreSQL + PGVector, searched by
  cosine distance.
- **Deleting a category is a soft delete** — `DELETE …/memory-categories/{id}/` sets
  `is_active: false`. Existing memories in it survive; only *new* extraction for that category stops.

## Troubleshooting

| Symptom | Cause → fix |
| --- | --- |
| Memories not captured | A cascade level is off → enable org (`enable_memsearch`), agent memory, and user `auto_capture_enabled`. |
| Memories stored but ignored in replies | User `use_memory_in_responses` off → enable it. |
| No categories on a new agent | Not seeded yet → they appear after the first extraction. |
| Extraction lags or misses a turn | Celery/provider latency → check the `ai_agent` queue and the LLM provider. |
| Duplicate memories | Rare hash edge case → delete the duplicate via the API. |
