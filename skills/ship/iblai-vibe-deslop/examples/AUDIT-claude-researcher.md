# Code Hardening Audit — claude-researcher

**Generated**: 2026-02-13
**Codebase**: /home/karan/Documents/projects/claude-researcher
**Stack**: Python 3.11+ (async/await, aiosqlite, FastAPI, Pydantic), Next.js 14 (TypeScript, Tailwind CSS)
**Total findings**: 52 (Critical: 4, High: 11, Medium: 16, Low: 14, Info: 7)

## Executive Summary

This is a sophisticated multi-agent research system that works well for its intended local-development use case, but has significant hardening gaps that would need attention before any networked or multi-user deployment. The architecture is sound — the 3-tier agent hierarchy, hybrid retrieval, knowledge graph, and verification pipeline are well-designed.

The most serious issues are: (1) **insecure pickle deserialization** in two files that could enable arbitrary code execution, (2) **a test endpoint exposed in production** that allows arbitrary event injection, (3) **race conditions on shared mutable state** in the manager's model-switching callbacks, and (4) **resource leaks** in the knowledge graph store where SQLite connections leak on exceptions. There are also pervasive patterns of broad `except Exception` blocks that silently swallow errors, unbounded caches that will grow without limit in long-running sessions, and ~20 unused `Optional` imports from a partial migration to modern `X | None` syntax.

The codebase is not production-ready for networked deployment (no auth, hardcoded localhost URLs, open CORS), but for its intended use as a local CLI tool with a local web UI, these are acceptable with documentation. The Python backend is generally well-structured; the UI is clean TypeScript that compiles without errors.

### Top Critical Issues
1. SEC-001 — Insecure pickle deserialization in BM25 index allows arbitrary code execution
2. SEC-002 — Insecure pickle deserialization in KG store allows arbitrary code execution
3. SEC-003 — Test event emission endpoint exposed in production without auth guard
4. ERR-001 — SQLite connections leak on exceptions in knowledge graph store (9 methods)

### Fix Effort Estimate
- Tier 1 (safe, mechanical): ~21 findings
- Tier 2 (needs characterization tests): ~22 findings
- Tier 3 (needs human review): ~9 findings

---

## Codebase Overview

### Stack
- **Backend**: Python 3.11+, asyncio, FastAPI, aiosqlite, Pydantic v2, Claude Agent SDK
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, vis-network
- **Storage**: SQLite (3 databases: research.db, research_kg.db, research_memory.db), ChromaDB
- **Build**: hatchling (Python), npm (Node.js)
- **Linting**: ruff (configured in pyproject.toml, line-length=100, py311)

### File Counts
| Category | Files | Lines |
|----------|-------|-------|
| Python source (src/) | 44 | 20,216 |
| Python API (api/) | 16 | 2,570 |
| TypeScript UI (ui/) | 16 | 6,188 |
| Config/scripts | 8 | ~200 |
| **Total** | **84** | **~29,174** |

### Module Architecture
```
src/agents/     — Agent hierarchy (director, manager, intern, base, parallel)
src/retrieval/  — Hybrid search (BM25 + vector + reranker + dedup + query expansion)
src/knowledge/  — Knowledge graph (NetworkX + SQLite store + NER + credibility)
src/verification/ — CoVe + CRITIC + HHEM verification pipeline
src/reports/    — Deep report writer with dynamic section planning
src/storage/    — Main SQLite database layer
src/tools/      — Web search (Bright Data) + academic search (Semantic Scholar, arXiv)
src/memory/     — Hybrid buffer + compression memory
src/events/     — WebSocket event emission
src/interaction/ — User interaction (questions, message queue, CLI listener)
src/costs/      — Token/cost tracking
src/audit/      — Decision logging
api/            — FastAPI server + routes + WebSocket
ui/             — Next.js frontend
```

### Entry Points
- CLI: `src/main.py` → `researcher` command (Typer)
- API: `api/server.py` → FastAPI on :8080
- UI: `ui/app/page.tsx` → Next.js on :3000

### High-Coupling Modules
- `src/agents/manager.py` (1758 lines) — imports from 12+ modules, most connected
- `src/reports/writer.py` (1733 lines) — heavy dependency on models, retrieval
- `src/knowledge/graph.py` (1405 lines) — imports store, models, NER, credibility
- `src/storage/database.py` (991 lines) — imported by agents, API layer
- `src/agents/intern.py` (885 lines) — uses tools, retrieval, verification

### Linter Output
- ruff: 10 findings (3 line-length E501 in api/db.py, 6 line-length in api/kg.py, 1 import sort I001 in api/kg.py)
- TypeScript: Compiles cleanly (`tsc --noEmit` passes)

---

## Findings

### [CRITICAL] SEC-001: Insecure pickle deserialization in BM25 index
- **File**: src/retrieval/bm25.py (lines 383-400)
- **Category**: Security
- **Tier**: 2
- **Description**: The `load()` method uses `pickle.load()` to deserialize BM25 index data from disk. Pickle deserialization can execute arbitrary code. If an attacker can write to the persist path (shared filesystem, compromised directory), they achieve remote code execution.
- **Evidence**: `with open(path, "rb") as f: state = pickle.load(f)`
- **Fix**: Replace pickle with a safe serialization format (JSON for the document/score data, or numpy save/load for arrays). If pickle is required for performance, validate file integrity with HMAC before loading.
- **Status**: OPEN

### [CRITICAL] SEC-002: Insecure pickle deserialization in KG store
- **File**: src/knowledge/store.py (line 295)
- **Category**: Security
- **Tier**: 2
- **Description**: `pickle.loads()` is called on embedding blob data read from SQLite. If the database is tampered with, this enables arbitrary code execution.
- **Evidence**: `embedding=pickle.loads(embedding_blob) if embedding_blob else None`
- **Fix**: Replace with `np.frombuffer()` / `np.tobytes()` for numpy arrays, or `json.dumps(list(arr))` for JSON serialization.
- **Status**: OPEN

### [CRITICAL] SEC-003: Test endpoint exposed in production
- **File**: api/server.py (lines 106-130)
- **Category**: Security
- **Tier**: 1
- **Description**: `POST /api/test/emit/{session_id}` allows anyone to emit arbitrary events to any session's WebSocket subscribers. No authentication, no debug flag guard. This enables spoofing research progress events.
- **Evidence**: `@app.post("/api/test/emit/{session_id}") async def test_emit_event(...)`
- **Fix**: Guard behind `CLAUDE_RESEARCHER_DEBUG` env var check, or remove entirely and keep only in `test_live_events.py`.
- **Status**: OPEN

### [CRITICAL] ERR-001: SQLite connections leak on exceptions in KG store
- **File**: src/knowledge/store.py (lines 175-453, 9 methods)
- **Category**: Error Handling / Resource Leak
- **Tier**: 2
- **Description**: Every method opens `sqlite3.connect()` but calls `conn.close()` only in the happy path. If `cursor.execute()`, `json.loads()`, or `json.dumps()` raises, the connection leaks. Affects: `add_entity`, `add_relation`, `add_contradiction`, `get_entity`, `query_by_entity_type`, `_get_entity_relations_sql`, `get_unresolved_contradictions`, `get_stats`, `clear`.
- **Evidence**: `conn = sqlite3.connect(self.db_path); cursor = conn.cursor(); ... conn.close()  # Never reached on exception`
- **Fix**: Use `with sqlite3.connect(...) as conn:` context manager or `try/finally` blocks.
- **Status**: OPEN

### [HIGH] BUG-001: Race condition on shared model state in manager callbacks
- **File**: src/agents/manager.py (lines 147-210)
- **Category**: Correctness / Race Condition
- **Tier**: 2
- **Description**: `_kg_llm_callback`, `_memory_llm_callback`, and `_verification_llm_callback` temporarily mutate `self.config.model` to switch models, then restore it in `finally`. If called concurrently (during parallel intern execution), they race on the shared config, causing one callback to use the wrong model.
- **Evidence**: `original_model = self.config.model; self.config.model = "sonnet"; try: ... finally: self.config.model = original_model`
- **Fix**: Pass model as a parameter to `call_claude()` instead of mutating shared state, or use an `asyncio.Lock`.
- **Status**: OPEN

### [HIGH] BUG-002: Race condition on shared database connection
- **File**: src/storage/database.py (lines 113-300)
- **Category**: Correctness / Race Condition
- **Tier**: 3
- **Description**: `_connection_lock` protects `connect()` and `close()`, but all other methods access `self._connection` without the lock. Concurrent coroutines can cause `OperationalError` on SQLite or data corruption. aiosqlite does not serialize concurrent operations on the same connection.
- **Evidence**: `async def create_session(...): await self._connection.execute(...); await self._connection.commit()  # No lock`
- **Fix**: Acquire the lock around all connection operations, or use separate connections per operation with WAL mode.
- **Status**: OPEN

### [HIGH] BUG-003: Null dereference if database not connected
- **File**: src/storage/database.py (24 methods)
- **Category**: Correctness / Null Dereference
- **Tier**: 2
- **Description**: Every method accessing `self._connection` assumes it is not `None`. If called before `connect()` or after `close()`, raises `AttributeError: 'NoneType' has no attribute 'execute'`.
- **Evidence**: `cursor = await self._connection.execute(...)  # self._connection could be None`
- **Fix**: Add a property that raises `RuntimeError("Database not connected")` if `_connection is None`, use it in all methods.
- **Status**: OPEN

### [HIGH] BUG-004: Embedding cache zip misalignment corrupts cache
- **File**: src/retrieval/embeddings.py (lines 204-208)
- **Category**: Correctness / Data Corruption
- **Tier**: 2
- **Description**: In `embed_documents`, when caching batch results, `zip(uncached_indices, documents, new_embeddings)` uses `documents` (full list) instead of the uncached subset. If some documents are cached, indices mismatch causes wrong embeddings to be cached for wrong texts.
- **Evidence**: `for idx, doc, emb in zip(uncached_indices, documents, new_embeddings): cache_key = self._cache_key(doc, is_query=False)`
- **Fix**: Replace `documents` with `[documents[i] for i in uncached_indices]` in the zip.
- **Status**: OPEN

### [HIGH] BUG-005: Empty query in find_by_source returns meaningless results
- **File**: src/retrieval/findings.py (lines 355-359)
- **Category**: Correctness / Logic
- **Tier**: 2
- **Description**: `find_by_source` passes empty string `""` as query to hybrid search. BM25 returns nothing for empty tokens, semantic search generates meaningless similarity scores. Results are effectively random.
- **Evidence**: `results = self._retriever.search(query="", k=limit, filter={"source_url": source_url})`
- **Fix**: Use the source URL as the query, or implement a dedicated `get_by_filter` method.
- **Status**: OPEN

### [HIGH] BUG-006: Missing required session_id in Finding reconstruction
- **File**: src/retrieval/findings.py (lines 283-300)
- **Category**: Correctness / Validation Error
- **Tier**: 2
- **Description**: `_reconstruct_finding` creates a `Finding` without the required `session_id` field. Pydantic will raise `ValidationError` at runtime whenever a finding is not in the cache.
- **Evidence**: `return Finding(content=..., finding_type=..., confidence=..., source_url=...)  # session_id missing`
- **Fix**: Add `session_id=metadata.get("session_id", "")` to the constructor.
- **Status**: OPEN

### [HIGH] BUG-007: Hardcoded "research findings" query biases session retrieval
- **File**: src/retrieval/findings.py (lines 386-391)
- **Category**: Correctness / Logic
- **Tier**: 2
- **Description**: `get_session_findings` uses hardcoded query `"research findings"` for all session retrievals. This biases ranking toward findings semantically matching "research findings" — findings about other topics may be ranked low or excluded.
- **Evidence**: `results = self._retriever.search(query="research findings", k=limit, filter={"session_id": session_id})`
- **Fix**: Implement a dedicated metadata-only filter method, or use the session's goal as the query.
- **Status**: OPEN

### [HIGH] BUG-008: Type bug — session_id reset to integer 0 instead of string
- **File**: src/agents/manager.py (line 1671)
- **Category**: Correctness / Type
- **Tier**: 1
- **Description**: `self.session_id = 0` sets session_id to integer instead of string. All session_id usage expects `str` (7-char hex). String operations on `0` will raise TypeError.
- **Evidence**: `self.session_id = 0  # should be ""`
- **Fix**: Change to `self.session_id = ""`.
- **Status**: OPEN

### [HIGH] SEC-004: No authentication on API endpoints
- **File**: api/server.py (entire app)
- **Category**: Security / Missing Auth
- **Tier**: 3
- **Description**: No authentication/authorization on any endpoint. Combined with `allow_origins=["*"]` CORS, any website can make requests. DELETE session, start/stop/pause research, event emission — all open.
- **Evidence**: `app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])`
- **Fix**: For local-only use, document the limitation. For networked deployment, add API key auth middleware.
- **Status**: NEEDS_CLARIFICATION

### [HIGH] CONF-001: Hardcoded WebSocket URL prevents deployment
- **File**: ui/lib/websocket.ts (line 35)
- **Category**: Configuration / Deployment
- **Tier**: 2
- **Description**: WebSocket URL hardcoded to `ws://localhost:8080`. UI will never work outside local development.
- **Evidence**: `const url = \`ws://localhost:8080/ws/${this.sessionId}\`;`
- **Fix**: Derive from `window.location` or `NEXT_PUBLIC_API_HOST` env var.
- **Status**: OPEN

### [HIGH] PERF-001: Synchronous SQLite blocks event loop in KG store
- **File**: src/knowledge/store.py (all methods)
- **Category**: Performance / Correctness
- **Tier**: 3
- **Description**: All KG database operations use synchronous `sqlite3.connect()`. Called from async methods in `graph.py`, every DB call blocks the event loop. With parallel interns, this serializes all KG operations.
- **Evidence**: `conn = sqlite3.connect(self.db_path)  # Blocking in async context`
- **Fix**: Migrate to `aiosqlite` or wrap in `asyncio.to_thread()`.
- **Status**: OPEN

### [MEDIUM] BUG-009: call_claude returns None not in type signature
- **File**: src/agents/base.py (lines 407-411)
- **Category**: Correctness / Type Safety
- **Tier**: 2
- **Description**: When `call_claude` with `output_format` throws, it returns `None`. Return type is `str | dict | list` (no `None`). Callers don't guard against `None`.
- **Evidence**: `if output_format: return None  # None not in return type`
- **Fix**: Add `None` to return type and ensure all callers handle it, or re-raise the exception.
- **Status**: OPEN

### [MEDIUM] BUG-010: UUID collision risk in knowledge graph IDs
- **File**: src/knowledge/graph.py (lines 1148-1150)
- **Category**: Correctness / Collision
- **Tier**: 1
- **Description**: `_generate_id()` truncates UUID4 to 8 chars (32 bits). Birthday paradox gives 50% collision chance at ~65K entities. KG store uses `INSERT OR REPLACE`, so collisions silently overwrite.
- **Evidence**: `return str(uuid.uuid4())[:8]`
- **Fix**: Use full UUID or at least 16 characters.
- **Status**: OPEN

### [MEDIUM] BUG-011: Session ID collision with no retry
- **File**: src/storage/database.py (line 24)
- **Category**: Correctness / Collision
- **Tier**: 2
- **Description**: `_generate_session_id()` produces 7 hex chars (~268M possibilities). No uniqueness check. Collision causes `IntegrityError` on INSERT.
- **Evidence**: `return secrets.token_hex(4)[:7]`
- **Fix**: Add retry loop catching `IntegrityError` and regenerating.
- **Status**: OPEN

### [MEDIUM] ERR-002: Migration errors silently swallowed
- **File**: src/storage/database.py (lines 277-283)
- **Category**: Error Handling
- **Tier**: 2
- **Description**: Migration `ALTER TABLE` uses bare `except Exception: pass`. Intended to catch "column exists" but also swallows disk full, database locked, etc.
- **Evidence**: `except Exception: pass  # Column already exists`
- **Fix**: Catch specific `aiosqlite.OperationalError` and check error message. Log unexpected exceptions.
- **Status**: OPEN

### [MEDIUM] ERR-003: Broad exception swallowing in query expansion
- **File**: src/retrieval/query_expansion.py (lines 238, 342, 433)
- **Category**: Error Handling
- **Tier**: 2
- **Description**: Multiple `except Exception:` blocks silently swallow all errors and return fallback values. LLM API errors, network failures, and programming bugs all treated identically with no logging.
- **Evidence**: `except Exception: return [ExpandedQuery(query=f"{query} {year} latest..."...)]`
- **Fix**: Log the exception at minimum. Catch specific exceptions separately.
- **Status**: OPEN

### [MEDIUM] PERF-002: Unbounded finding cache grows without limit
- **File**: src/retrieval/findings.py (line 82)
- **Category**: Performance / Memory Leak
- **Tier**: 2
- **Description**: `_finding_cache` dict never evicts entries. In long-running sessions, grows without limit.
- **Evidence**: `self._finding_cache: dict[str, Finding] = {}`
- **Fix**: Use `functools.lru_cache` or `cachetools.LRUCache` with configurable max size.
- **Status**: OPEN

### [MEDIUM] PERF-003: Unbounded embedding cache grows without limit
- **File**: src/retrieval/embeddings.py (line 62)
- **Category**: Performance / Memory Leak
- **Tier**: 2
- **Description**: `_embedding_cache` is unbounded. Each 1024-dim embedding is ~4KB. 10K docs = ~40MB. No eviction.
- **Evidence**: `self._embedding_cache: dict[str, np.ndarray] = {}`
- **Fix**: Add LRU eviction with configurable size limit.
- **Status**: OPEN

### [MEDIUM] PERF-004: N+1 database connections in memory search
- **File**: src/retrieval/memory_integration.py (lines 225-245)
- **Category**: Performance
- **Tier**: 2
- **Description**: `_get_memory_by_id` opens a new `aiosqlite.connect()` for every search result. During `search_semantic`, creates and closes 10+ connections per search.
- **Evidence**: `async with aiosqlite.connect(self._db_path) as conn:  # New connection per call`
- **Fix**: Maintain persistent connection or batch IDs into single query.
- **Status**: OPEN

### [MEDIUM] PERF-005: Embeddings generated one at a time instead of batched
- **File**: src/retrieval/vectorstore.py (lines 131-177)
- **Category**: Performance
- **Tier**: 2
- **Description**: `add()` generates embeddings one at a time in a loop, defeating the embedding service's batching capability.
- **Evidence**: `emb = self.embedding_service.embed_document(doc.content)  # One at a time in loop`
- **Fix**: Collect un-embedded documents and call `embed_documents()` in single batch.
- **Status**: OPEN

### [MEDIUM] DRY-001: Duplicated verification update logic in manager
- **File**: src/agents/manager.py (lines 976-1040, 1138-1211)
- **Category**: Code Duplication
- **Tier**: 2
- **Description**: Verification update logic in `_critique_report` is near-identical to logic in `_synthesize_report`. ~65 lines duplicated with minor variations.
- **Fix**: Extract shared verification update into a helper method.
- **Status**: OPEN

### [MEDIUM] DRY-002: Duplicated SQL branches in update_finding_verification
- **File**: src/storage/database.py (lines 534-571)
- **Category**: Code Duplication
- **Tier**: 1
- **Description**: Two nearly identical SQL UPDATE branches differ only in whether `confidence` is included. Duplicates SQL string and parameter list.
- **Fix**: Build SQL dynamically, conditionally adding `confidence = ?`.
- **Status**: OPEN

### [MEDIUM] SEC-005: MD5 used for document ID generation (4 files)
- **File**: src/retrieval/bm25.py:175, vectorstore.py:39, deduplication.py:142, embeddings.py:113
- **Category**: Security / Weak Hashing
- **Tier**: 1
- **Description**: MD5 used for document ID hashing across 4 files. MD5 collisions are trivially producible. Collisions cause silent data loss (dedup/overwrite).
- **Evidence**: `hashlib.md5(t.encode()).hexdigest()[:16]`
- **Fix**: Replace with `hashlib.sha256(...)` across all 4 files.
- **Status**: OPEN

### [MEDIUM] VAL-001: Unvalidated limit/offset on API endpoints
- **File**: api/routes/findings.py, sessions.py, events.py, agents.py
- **Category**: Input Validation
- **Tier**: 2
- **Description**: `limit` parameters have no upper bound. Client can pass `limit=999999999` to force loading enormous result sets into memory.
- **Evidence**: `limit: int = 200, offset: int = 0  # No upper bound`
- **Fix**: Add `Query(ge=1, le=1000)` validation from FastAPI.
- **Status**: OPEN

### [MEDIUM] ERR-004: Singleton EventEmitter with dangling class-level asyncio.Lock
- **File**: api/events.py (lines 58-63)
- **Category**: Correctness / Concurrency
- **Tier**: 1
- **Description**: `_lock = asyncio.Lock()` created at class definition time as class variable. If imported before event loop exists, can cause `RuntimeError` in some asyncio environments. The lock is never used (instance uses `_subscribers_lock` instead).
- **Evidence**: `class EventEmitter: _lock = asyncio.Lock()`
- **Fix**: Remove the unused class-level `_lock`.
- **Status**: OPEN

### [MEDIUM] LOGIC-001: Greedy regex for JSON extraction in report writer
- **File**: src/reports/writer.py (lines 493, 737)
- **Category**: Logic / Fragility
- **Tier**: 1
- **Description**: `r"\[.*\]"` with `re.DOTALL` is greedy — matches from first `[` to last `]` in entire response. If LLM includes extra brackets, regex captures beyond intended JSON.
- **Evidence**: `match = re.search(r"\[.*\]", themes_response, re.DOTALL)`
- **Fix**: Use non-greedy `r"\[[\s\S]*?\]"` or proper bracket-counting JSON extraction.
- **Status**: OPEN

### [MEDIUM] LOGIC-002: State mutation in DeepReportWriter prevents concurrent use
- **File**: src/reports/writer.py (lines 1284-1293)
- **Category**: Logic / Thread Safety
- **Tier**: 1
- **Description**: `_source_index` and `_source_details` set as instance attributes during `generate_dynamic_report`. Two concurrent reports on same instance would clobber each other. `_source_details` is written but never read (dead code).
- **Evidence**: `self._source_index: dict[str, int] = {}`
- **Fix**: Pass `source_index` through call chain. Remove unused `_source_details`.
- **Status**: OPEN

### [LOW] DEAD-001: Unused `Optional` imports across ~20 files
- **File**: Multiple (base.py, manager.py, intern.py, director.py, database.py, hybrid.py, bm25.py, vectorstore.py, findings.py, embeddings.py, query_expansion.py, reranker.py, memory_integration.py, deduplication.py, store.py, fast_ner.py, models.py, query.py, graph.py, metrics.py, pipeline.py, config.py, interaction/models.py, findings model)
- **Category**: Dead Code
- **Tier**: 1
- **Description**: `Optional` imported from `typing` but never used. Codebase uses `X | None` syntax throughout. Partial migration artifact.
- **Fix**: Remove `Optional` from all imports. Run `ruff check --fix` with I rule.
- **Status**: OPEN

### [LOW] DEAD-002: Unused imports across retrieval modules
- **File**: Multiple retrieval files
- **Category**: Dead Code
- **Tier**: 1
- **Description**: Various unused imports: `datetime` in hybrid.py, `np` in hybrid.py, `uuid` in vectorstore.py, `Path` in findings.py, `Any` in query_expansion.py, `lru_cache`/`Path` in embeddings.py, dead globals `_model`/`_model_name` in embeddings.py.
- **Fix**: Remove all unused imports and dead globals.
- **Status**: OPEN

### [LOW] DEAD-003: console.log debug statements in UI
- **File**: ui/lib/websocket.ts (6), ui/components/ActivityFeed.tsx (1), ui/app/session/[id]/page.tsx (2), ui/app/test-websocket/page.tsx (1)
- **Category**: Dead Code / Debug Artifacts
- **Tier**: 1
- **Description**: 10 `console.log` statements left from development. Noisy in browser console during normal use.
- **Evidence**: `console.log("Received event:", event);`
- **Fix**: Remove or replace with conditional debug logging.
- **Status**: OPEN

### [LOW] DEAD-004: Unused `_source_details` in report writer
- **File**: src/reports/writer.py (line 1285)
- **Category**: Dead Code
- **Tier**: 1
- **Description**: `self._source_details: dict[str, dict] = {}` is written to but never read anywhere.
- **Fix**: Remove the attribute and all writes to it.
- **Status**: OPEN

### [LOW] DEAD-005: Local json re-import inside method
- **File**: src/reports/writer.py (line 490)
- **Category**: Dead Code / Redundancy
- **Tier**: 1
- **Description**: `import json` at line 490 redundant with top-level import at line 3.
- **Fix**: Remove the local import.
- **Status**: OPEN

### [LOW] DEAD-006: json imported inside methods in database.py
- **File**: src/storage/database.py (lines 584, 704, 873)
- **Category**: Consistency
- **Tier**: 1
- **Description**: `import json` done inside methods instead of at top of file. Inconsistent with rest of codebase.
- **Fix**: Move to top-level import.
- **Status**: OPEN

### [LOW] CONF-002: Hardcoded localhost URLs across multiple files
- **File**: ui/lib/websocket.ts:35, ui/app/test-websocket/page.tsx:17, ui/next.config.ts:10,14, src/events/__init__.py:34, api/server.py:214-216
- **Category**: Configuration
- **Tier**: 1
- **Description**: `localhost:8080` and `localhost:3000` hardcoded in multiple places. Only `src/events/__init__.py` uses env var fallback.
- **Fix**: Use env vars with localhost defaults consistently.
- **Status**: OPEN

### [LOW] CONF-003: Hardcoded temporal keywords in report writer
- **File**: src/reports/writer.py (lines 1012-1035)
- **Category**: Configuration / Staleness
- **Tier**: 1
- **Description**: Year range 2020-2026 hardcoded for timeline generation. Will become stale.
- **Evidence**: `temporal_keywords = ["2020", "2021", ..., "2026", ...]`
- **Fix**: Generate dynamically with `datetime.now().year`.
- **Status**: OPEN

### [LOW] TYPE-001: `as any` usage in graph page (10 instances)
- **File**: ui/app/session/[id]/graph/page.tsx (lines 252, 265, 282, 303, 329, 340, 443, 444, 457, 532, 544, 613)
- **Category**: Type Safety
- **Tier**: 1
- **Description**: 10+ `as any` type assertions bypassing TypeScript safety. Mostly for vis-network library interop.
- **Fix**: Create proper type definitions for vis-network data structures.
- **Status**: OPEN

### [LOW] TYPE-002: `filter` parameter shadows Python built-in
- **File**: src/retrieval/hybrid.py:184, vectorstore.py:207,260,315
- **Category**: Naming
- **Tier**: 1
- **Description**: `filter` parameter name shadows the Python built-in `filter()` function in multiple methods.
- **Fix**: Rename to `metadata_filter` or `where`.
- **Status**: OPEN

### [LOW] PERF-006: Linear search in reranked result matching
- **File**: src/retrieval/hybrid.py (lines 274-276)
- **Category**: Performance
- **Tier**: 1
- **Description**: `next(r for r in candidates ...)` inside loop is O(n*m) for matching reranked docs to originals.
- **Fix**: Pre-build dict mapping `document.id -> result` for O(1) lookup.
- **Status**: OPEN

### [LOW] PERF-007: Negative scores possible in FTS fallback
- **File**: src/retrieval/memory_integration.py (line 168)
- **Category**: Logic
- **Tier**: 1
- **Description**: Score approximation `1.0 - (i * 0.05)` goes negative for >20 results.
- **Evidence**: `score=1.0 - (i * 0.05)`
- **Fix**: Use `max(0.0, 1.0 - (i * 0.05))`.
- **Status**: OPEN

### [LOW] ERR-005: Fire-and-forget tasks cause "Task was destroyed" warnings
- **File**: src/agents/base.py (lines 514-525)
- **Category**: Error Handling
- **Tier**: 1
- **Description**: `_log` creates fire-and-forget tasks via `loop.create_task()` that are never tracked. On shutdown, Python emits "Task was destroyed but it is pending" warnings.
- **Fix**: Store tasks in a set with `done_callback` to remove them, or use `asyncio.TaskGroup`.
- **Status**: OPEN

### [LOW] CONF-004: Import sort issue in api/kg.py
- **File**: api/kg.py (lines 6-12)
- **Category**: Formatting
- **Tier**: 1
- **Description**: Import block is unsorted per ruff I001 rule.
- **Fix**: Run `ruff check --fix api/kg.py`.
- **Status**: OPEN

### [INFO] DEAD-007: `hasattr` checks for nonexistent Pydantic fields
- **File**: src/retrieval/findings.py (lines 102, 117, 299)
- **Category**: Dead Code / Logic
- **Tier**: 1
- **Description**: `hasattr(finding, 'supporting_quote')` and `hasattr(finding, 'source_title')` always return False — these fields don't exist on `Finding` model. The code branches are dead.
- **Fix**: Remove the dead `hasattr` checks, or add the fields to the `Finding` model if needed.
- **Status**: OPEN

### [INFO] PERF-008: BM25 index saved after every add
- **File**: src/retrieval/bm25.py (lines 146-151)
- **Category**: Performance
- **Tier**: 1
- **Description**: After every `add()` call, statistics are recalculated and full index is pickled to disk. For batch additions, this is redundant.
- **Fix**: Add `auto_save=False` parameter or defer persistence.
- **Status**: OPEN

### [INFO] PERF-009: reindex_all loads entire table into memory
- **File**: src/retrieval/memory_integration.py (lines 316-323)
- **Category**: Performance
- **Tier**: 1
- **Description**: `reindex_all` fetches ALL rows from `memories` table at once. Could OOM on large databases.
- **Fix**: Process in batches with LIMIT/OFFSET.
- **Status**: OPEN

### [INFO] LOGIC-003: MinHashLSH removal leaves ghost entries
- **File**: src/retrieval/deduplication.py (lines 268-295)
- **Category**: Logic
- **Tier**: 1
- **Description**: `remove()` deletes from tracking structures but leaves ghost entry in LSH index, increasing query time.
- **Fix**: Use `datasketch.MinHashLSH.remove()` method, or rebuild index after removal.
- **Status**: OPEN

### [INFO] LOG-001: print() used instead of structured logging (99 instances)
- **File**: src/ (12 files, 99 total print() calls)
- **Category**: Logging
- **Tier**: 3
- **Description**: CLI uses `print()` and Rich `console.print()` throughout. Acceptable for CLI tool but prevents structured log collection.
- **Fix**: For a CLI tool this is fine. Only flag if API server logging needs improvement.
- **Status**: NEEDS_CLARIFICATION

### [INFO] TEST-001: No formal test suite
- **File**: N/A
- **Category**: Testing
- **Tier**: 3
- **Description**: No test directory, no pytest configuration, no unit tests. Only `test_live_events.py` which is a manual integration script.
- **Fix**: Add tests for critical paths (finding extraction, verification pipeline, database operations).
- **Status**: NEEDS_CLARIFICATION

### [INFO] DEP-001: `trust_remote_code=True` in HHEM model loading
- **File**: src/verification/hhem.py (line 34)
- **Category**: Security / Dependencies
- **Tier**: 1
- **Description**: `AutoModelForSequenceClassification.from_pretrained("vectara/hallucination_evaluation_model", trust_remote_code=True)` executes arbitrary code from the HuggingFace model repo.
- **Evidence**: `trust_remote_code=True`
- **Fix**: Pin the model revision and audit the remote code, or find a model that doesn't require `trust_remote_code`.
- **Status**: OPEN

---

## Summary

| Severity | Open | Fixed | Clarification Needed | Human Review |
|----------|------|-------|---------------------|--------------|
| CRITICAL | 4    | 0     | 0                   | 0            |
| HIGH     | 10   | 0     | 1                   | 0            |
| MEDIUM   | 16   | 0     | 0                   | 0            |
| LOW      | 14   | 0     | 0                   | 0            |
| INFO     | 5    | 0     | 2                   | 0            |
