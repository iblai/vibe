# Fix Playbook

Rules and strategies for Phase 2 — applying fixes from AUDIT.md safely.

The fundamental constraint: **the codebase must remain in a working, deployable state after every individual fix.** Never batch multiple risky fixes. Never change business logic. Never assume you know better than the original author about what the code should do — only harden how it does it.

---

## Safety Tier Definitions

### Tier 1: Safe (No Behavioral Change Possible)

These fixes cannot alter runtime behavior by definition. Apply them without characterization tests.

| Fix type | Examples |
|----------|----------|
| Remove dead code | Unused functions, unreachable branches, commented-out code |
| Remove unused imports | `import _ from 'lodash'` when `_` is never used |
| Remove unused variables | Assigned but never read |
| Formatting normalization | Consistent indentation, trailing commas, semicolons (match project style) |
| Rename for clarity | `d` → `deliveryDate`, `cb` → `onPaymentComplete` |
| Extract magic numbers | `if (retries > 3)` → `if (retries > MAX_RETRIES)` with `const MAX_RETRIES = 3` |
| Add type annotations | Adding return types, parameter types (typed languages only) |
| Add documentation | JSDoc, docstrings, inline "why" comments |
| Remove debug artifacts | `console.log`, `print()`, `debugger`, `binding.pry` in production code |
| Fix linter warnings | Issues flagged by the project's own linter config |

**Verification**: Run existing tests after Tier 1 batch. If tests pass, done. If no tests exist, manual spot-check that the application starts.

### Tier 2: Medium Risk (Behavioral Preservation Required)

These fixes add new behavior (validation, error handling, logging) or restructure existing behavior (extracting duplicates). They must not change the happy-path output — only improve behavior on error/edge cases.

| Fix type | Examples |
|----------|----------|
| Add input validation | Rejecting previously-unvalidated bad input at API boundaries |
| Add error handling | Wrapping unhandled operations in try/catch with proper logging and error propagation |
| Extract duplicated code | Moving shared logic to a utility function, updating all call sites |
| Replace hardcoded values | Moving URLs, ports, timeouts to config/env vars with the same default values |
| Add logging | Structured logging on critical operations (auth, mutations, errors) |
| Fix resource leaks | Adding try/finally to ensure cleanup of file handles, connections, etc. |
| Add null checks | Guarding against null/undefined before property access |
| Replace unsafe patterns | `eval()` → parsed alternative, `exec()` → `execFile()` with args |

**MANDATORY: Characterization test protocol for Tier 2 fixes**

Before applying ANY Tier 2 fix:

1. **Write a characterization test** that captures the current behavior of the affected code path.
   - The test should call the function/endpoint with representative inputs and assert on the current output.
   - For error handling fixes: test that the current error path does what it currently does (even if that's "return undefined").
   - The test doesn't need to be elegant. It just needs to pin the current behavior.

2. **Run the test. It must pass.** If it doesn't, your test is wrong — fix the test, not the code.

3. **Apply the fix.**

4. **Run the test again.**
   - If the fix is purely additive (new validation that rejects bad input), the existing characterization test should still pass (it uses good input). Add a new test for the bad input case.
   - If the fix changes error behavior (from silent failure to thrown error), update the characterization test to expect the new behavior. Document why in the test.

5. **Run the full test suite.** Nothing else should break.

**If you can't write a characterization test** (e.g., the code has side effects you can't mock, or requires infrastructure you can't access), mark the fix as `NEEDS_HUMAN_REVIEW` and move on.

### Tier 3: High Risk (Requires Human Approval)

These fixes change how existing functionality works. They may alter APIs, data flows, or architectural boundaries. **Do not apply these automatically.**

| Fix type | Examples |
|----------|----------|
| Restructure API contracts | Changing request/response shapes, URL paths, error codes |
| Refactor auth/authz flow | Adding middleware, changing permission models |
| Change data access patterns | N+1 → batch query, sync → async, cache layer addition |
| Modify state management | Changing how state flows through the application |
| Extract modules / split files | Moving code across file boundaries |
| Replace dependencies | Swapping one library for another |
| Change error contracts | Changing what errors functions throw/return to their callers |

**Protocol for Tier 3:**
1. Document the finding in AUDIT.md as `NEEDS_HUMAN_REVIEW`.
2. When the user reaches Phase 2, present each Tier 3 finding individually.
3. Explain: what the current code does, what the proposed change is, what could break.
4. Only proceed if the user explicitly approves.
5. Write characterization tests before AND after.
6. If the change is large, consider the strangler fig approach (see below).

---

## Fix Ordering Algorithm

Process AUDIT.md findings in this order:

```
1. All Tier 1 + CRITICAL findings (shouldn't be many — critical dead code is rare, but critical secrets removal is Tier 1)
2. All Tier 1 + HIGH findings
3. All Tier 1 + MEDIUM findings
4. All Tier 1 + LOW/INFO findings
   ── Run full test suite. Checkpoint. ──
5. Tier 2 + CRITICAL findings (one at a time: test → fix → test)
6. Tier 2 + HIGH findings (one at a time)
7. Tier 2 + MEDIUM findings (one at a time)
   ── Run full test suite. Checkpoint. ──
8. Tier 3 findings (present to user for approval, one at a time)
```

**Rationale**: Tier 1 fixes are batched by severity because they're safe. Tier 2 fixes are applied individually because each one needs its own characterization test cycle. Tier 3 fixes need human approval each.

**Leaf-first ordering**: Within the same tier and severity, fix leaf modules (utilities, helpers, models) before core modules (controllers, services, main app). This reduces blast radius and sometimes resolves upstream findings organically.

---

## Mechanical Transformation Preference

When applying a fix, prefer mechanical transformations over generative rewrites:

**Mechanical (prefer):**
- Find-and-replace for renames
- Cut-and-paste + import statement for extractions
- Wrapping existing code in try/catch (preserving the original code inside)
- Adding validation checks before existing logic (not rewriting the logic)
- Adding `const CONFIG_NAME = existingValue` and replacing the literal

**Generative (avoid when possible):**
- Rewriting a function from scratch
- "Improving" code that works correctly but isn't elegant
- Refactoring multiple files simultaneously
- Adding new abstraction layers

**The 20-line rule**: If your fix involves rewriting more than ~20 contiguous lines of code, pause. You're likely changing business logic or introducing new behavior. Break the fix into smaller mechanical steps, or reclassify it as Tier 3.

---

## Strangler Fig Pattern for Large Fixes

When a Tier 3 fix requires substantial rework of a module:

1. **Create the new implementation alongside the old one.**
   - New file, new function name, same interface.
   - Write tests for the new implementation.

2. **Add a routing layer that delegates to the new implementation.**
   - Feature flag, environment variable, or simple conditional.
   - Default to the OLD implementation.

3. **Switch one call site at a time.**
   - Update one caller to use the new implementation.
   - Test that specific flow end-to-end.
   - Repeat for each call site.

4. **Remove the old implementation** only when all callers have been migrated and verified.

This keeps the application deployable at every step and allows rollback by flipping the routing.

---

## What to Do When You're Unsure

| Situation | Action |
|-----------|--------|
| Unsure if behavior is intentional | Mark `NEEDS_CLARIFICATION`, describe the concern, move on |
| Fix seems simple but you can't write a test | Mark `NEEDS_HUMAN_REVIEW`, explain why testing isn't possible |
| Fix works but you broke an unrelated test | Revert the fix. Investigate the coupling. Possibly reclassify as Tier 3 |
| You discover a new issue while fixing another | Add it to AUDIT.md as a new finding. Don't fix it in the current change. |
| The project has no tests at all | Still apply Tier 1 fixes. For Tier 2, write characterization tests (they become the project's first tests). For Tier 3, manual verification only with user approval. |
| The fix requires installing a new dependency | Ask the user first. Never install dependencies silently. |
| The "fix" would make the code significantly more complex | The fix is worse than the disease. Mark as `WONT_FIX` with explanation. |

---

## Commenting Convention for Fixes

When you apply a fix, add a brief comment explaining **why** (not what — the diff shows that):

```javascript
// [HARDENED] SEC-003: Parameterized to prevent SQL injection
const results = await db.query('SELECT * FROM users WHERE name LIKE ?', [`%${name}%`]);

// [HARDENED] ERR-001: Previously returned undefined on failure, causing silent charge drops
throw new PaymentProcessingError(`Payment failed for order ${orderId}`, { cause: error });

// [HARDENED] CONF-002: Extracted from hardcoded value (was: 'https://api.example.com/v1')
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.example.com/v1';
```

The `[HARDENED]` prefix + finding ID makes it easy to cross-reference with AUDIT.md and grep for all hardening changes later.

---

## Post-Fix Checklist

After all fixes are applied:

1. **Run the full test suite.** All pre-existing tests must pass.
2. **Run linters** (if configured). No new warnings introduced.
3. **Verify the app starts.** `npm start`, `python manage.py runserver`, `go run main.go`, etc.
4. **Update AUDIT.md summary table** with final counts per status.
5. **List all characterization tests added** — the user may want to keep them, convert them to proper tests, or remove them.
6. **List all `NEEDS_CLARIFICATION` items** — these are unresolved questions for the user.
7. **List all `NEEDS_HUMAN_REVIEW` items** — these are Tier 3 fixes the user should consider.
