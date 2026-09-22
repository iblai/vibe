# Audit File Format

`AUDIT.md` is the single output artifact of Phase 1. It must be:
- Human-scannable: engineers can skim the executive summary and drill into specific findings
- Machine-parseable: Phase 2 (fix) reads this file to determine what to fix and in what order
- Cross-referenceable: every finding has a unique ID used during the fix phase

## File Structure

```markdown
# Code Hardening Audit — [Project Name]

**Generated**: [timestamp]
**Codebase**: [path]
**Stack**: [detected stack summary]
**Total findings**: [count] (Critical: N, High: N, Medium: N, Low: N, Info: N)

## Executive Summary

[2-4 paragraph overall assessment. Is this codebase production-ready? What are the
biggest risks? What's the estimated effort to fix? Be direct — don't pad with
qualifications.]

### Top Critical Issues
1. [Finding ID] — [one-line description]
2. [Finding ID] — [one-line description]
3. ...

### Fix Effort Estimate
- Tier 1 (safe, mechanical): ~N findings, estimated [time]
- Tier 2 (needs characterization tests): ~N findings, estimated [time]
- Tier 3 (needs human review): ~N findings

---

## Codebase Overview

[Output from Pass 0 — stack, architecture, entry points, dependency map summary,
linter output]

---

## Findings

### [CRITICAL] SEC-001: SQL injection in user search endpoint
- **File**: src/routes/users.js (lines 45-52)
- **Category**: Security
- **Tier**: 2
- **Description**: User search query is built with string concatenation. The `name`
  parameter from `req.query` is interpolated directly into the SQL string without
  parameterization. An attacker can inject arbitrary SQL via the search field.
- **Evidence**: `const query = "SELECT * FROM users WHERE name LIKE '%" + name + "%'"`
- **Fix**: Replace with parameterized query using the DB driver's placeholder syntax.
- **Status**: OPEN

### [HIGH] ERR-001: Empty catch block in payment processing
- **File**: src/services/payment.js (lines 112-118)
- **Category**: Error Handling
- **Tier**: 2
- **Description**: The catch block in `processPayment()` logs to console but returns
  `undefined`, causing the caller to treat a failed payment as a non-result rather
  than an error. In production this would silently drop payment failures.
- **Evidence**: `catch(e) { console.log(e) }`
- **Fix**: Re-throw as a typed PaymentError or return an explicit error result.
  Requires characterization test to verify callers handle the new error path.
- **Status**: OPEN

### [MEDIUM] DRY-001: Duplicated email validation across 3 files
- **File**: src/routes/auth.js (line 23), src/routes/profile.js (line 67),
  src/services/invite.js (line 14)
- **Category**: Code Duplication
- **Tier**: 1
- **Description**: The same email regex pattern is defined independently in three
  files. Two of the three implementations differ slightly (one allows `+` aliases,
  the others don't), creating inconsistent validation behavior.
- **Evidence**: Three separate `const emailRegex = /.../ ` declarations
- **Fix**: Extract to a shared `validators/email.js` module and import everywhere.
  Decide which regex is correct (probably the one allowing `+` aliases).
- **Status**: OPEN

---

## Summary

| Severity | Open | Fixed | Clarification Needed | Human Review |
|----------|------|-------|---------------------|--------------|
| CRITICAL | N    | 0     | 0                   | 0            |
| HIGH     | N    | 0     | 0                   | 0            |
| MEDIUM   | N    | 0     | 0                   | 0            |
| LOW      | N    | 0     | 0                   | 0            |
| INFO     | N    | 0     | 0                   | 0            |
```

---

## Finding ID Conventions

Use a category prefix + sequential number:

| Prefix | Category |
|--------|----------|
| SEC    | Security Vulnerabilities (cat 1) |
| BUG    | Correctness Bugs (cat 2) |
| ERR    | Error Handling & Resilience (cat 3) |
| LOGIC  | Business Logic Fragility (cat 4) |
| PERF   | Performance Antipatterns (cat 5) |
| TYPE   | Type Safety (cat 6) |
| VAL    | Input Validation (cat 7) |
| DRY    | Code Duplication (cat 8) |
| DEAD   | Dead Code & Cleanup (cat 9) |
| CONF   | Configuration & Secrets (cat 10) |
| NAME   | Naming & Documentation (cat 11) |
| ARCH   | Architecture & Design (cat 12) |
| LOG    | Logging & Observability (cat 13) |
| DEP    | Dependency Management (cat 14) |
| TEST   | Testing Gaps (cat 15) |

## Finding Status Values

| Status | Meaning |
|--------|---------|
| `OPEN` | Not yet addressed |
| `FIXED` | Fix applied and verified |
| `SKIPPED` | User chose to skip this finding |
| `NEEDS_CLARIFICATION` | Unclear if this is intentional behavior — needs user input |
| `NEEDS_HUMAN_REVIEW` | Tier 3 fix — too risky for automated application |
| `WONT_FIX` | User explicitly decided not to fix |

## Severity Classification Rules

Apply these consistently:

**CRITICAL** — Assign when:
- Exploitable security vulnerability (injection, auth bypass, RCE)
- Data loss or corruption risk in normal operation
- Application crash in a core user flow
- Hardcoded production secrets in source

**HIGH** — Assign when:
- Logic error that would cause incorrect behavior in production
- Missing auth/authz on a sensitive endpoint
- Resource leak that would degrade over time (memory, connections, file handles)
- Silent failure in a critical path (payments, data persistence)

**MEDIUM** — Assign when:
- Missing input validation on non-critical endpoints
- Performance issue that degrades UX but doesn't crash
- Significant code smell that increases maintenance cost
- Missing error handling on I/O that could cause intermittent failures

**LOW** — Assign when:
- Minor code quality issue (naming, documentation gaps)
- Small DRY violation with no divergence risk
- Unused imports or variables
- Minor inconsistencies in patterns

**INFO** — Assign when:
- Suggestion for improvement that isn't a problem per se
- Style preference that differs from project convention
- "Nice to have" optimization
- Test coverage suggestion

## Rules for Evidence

Every finding **must** include concrete evidence — the actual code that's problematic. This serves three purposes:
1. Human reviewer can verify the finding is real (not a false positive)
2. The fix phase knows exactly where to make changes
3. The finding is self-contained — no need to go read the file to understand it

Evidence should be the shortest code snippet that demonstrates the issue. One to five lines typically. Do not include surrounding context unless it's necessary to understand the problem.

## Rules for Fix Recommendations

Every finding **must** include a specific fix recommendation. General advice like "add error handling" is not sufficient. The recommendation should describe the specific change — what to add, remove, or replace. It doesn't need to include exact code (that's the fix phase's job), but it must be specific enough that someone reading it knows exactly what needs to change.

Bad: "Fix the SQL injection."
Good: "Replace string concatenation with parameterized query. Use `db.query('SELECT * FROM users WHERE name LIKE ?', ['%' + name + '%'])`."

Bad: "Improve error handling."
Good: "Replace the empty catch block with: log the error with context (payment ID, amount), re-throw as a PaymentProcessingError so the caller's try/catch can handle it explicitly."
