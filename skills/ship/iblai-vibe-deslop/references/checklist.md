# Audit Checklist

15 categories of issues to scan for, ordered by severity. Each category includes specific patterns to grep/search for and heuristics for the LLM to apply during semantic analysis.

Use this checklist during Passes 1-3. Not every item applies to every codebase — skip categories that are irrelevant to the detected stack (e.g., skip SQL-specific checks for a pure frontend app).

---

## Category 1: Security Vulnerabilities

**Pass**: 3 (Security)
**Severity default**: CRITICAL or HIGH

### Injection Flaws
- SQL built with string concatenation or template literals instead of parameterized queries
- User input passed directly to `eval()`, `exec()`, `Function()`, `child_process.exec()`, `os.system()`, `subprocess.shell=True`
- User input interpolated into HTML without encoding (XSS)
- User input used in file paths without sanitization (path traversal) — look for `../` bypass potential
- User input used in HTTP requests (SSRF) — look for `fetch(userInput)`, `requests.get(url)` where url is controllable
- User input in regex patterns (ReDoS) — look for `new RegExp(userInput)`

### Grep patterns
```bash
# SQL injection
grep -rn "SELECT.*\+.*\|INSERT.*\+.*\|UPDATE.*\+.*\|DELETE.*\+" --include="*.{js,ts,py,rb,java,go,php}"
grep -rn "f\".*SELECT\|f\".*INSERT\|f\".*UPDATE\|f\".*DELETE" --include="*.py"
grep -rn "\`.*SELECT.*\$\{" --include="*.{js,ts}"

# Command injection
grep -rn "exec(\|eval(\|Function(\|os\.system\|subprocess.*shell.*True\|child_process" --include="*.{js,ts,py,rb}"

# Path traversal
grep -rn "path\.join.*req\.\|readFile.*req\.\|readFileSync.*req\." --include="*.{js,ts}"
grep -rn "open(.*request\.\|os\.path\.join.*request\." --include="*.py"
```

### Authentication & Authorization
- Routes/endpoints without auth middleware when they should have it
- Authorization checks that only verify authentication (not role/permission)
- JWT tokens without expiration, without signature verification, or with `alg: none`
- Session tokens in URLs or local storage instead of httpOnly cookies
- Password stored in plaintext or with weak hashing (MD5, SHA1 without salt)
- Missing CSRF protection on state-changing operations
- Missing rate limiting on auth endpoints

### Secrets Management
- API keys, tokens, passwords hardcoded in source files
- `.env` files committed to version control (check `.gitignore`)
- Secrets logged to console or files
- Secrets in client-side code or frontend bundles

### Grep patterns
```bash
# Hardcoded secrets
grep -rn "password.*=.*['\"].\+['\"]" --include="*.{js,ts,py,rb,java,go,env}"
grep -rn "api_key\|apiKey\|API_KEY\|secret\|token\|credential" --include="*.{js,ts,py,rb,java,go}" | grep -v "test\|mock\|example\|placeholder\|TODO\|\.env"
grep -rn "sk-\|pk_live\|ghp_\|AKIA" --include="*.{js,ts,py,rb,java,go,env,yml,yaml,json}"
```

---

## Category 2: Correctness Bugs

**Pass**: 2 (Logic & Resilience)
**Severity default**: HIGH or MEDIUM

### What to look for
- Null/undefined dereference: accessing properties on values that could be null without checking
- Off-by-one errors: loop bounds, array indexing, pagination (page 1 vs page 0), string slicing
- Race conditions: shared mutable state without locks, time-of-check-to-time-of-use (TOCTOU)
- Resource leaks: opened files/connections/handles not closed in finally/defer/using blocks
- Incorrect API usage: calling deprecated APIs, wrong argument order, missing required params
- Type coercion bugs (JS): `==` instead of `===`, truthy/falsy surprises (`0`, `""`, `[]`)
- Integer overflow: unchecked arithmetic on user-controlled values
- Floating point comparison: `if (price === 0.1 + 0.2)` — use epsilon comparison or integer cents

### Hallucinated APIs (AI-specific)
- Library methods that don't exist in the version being used
- API call patterns that don't match the library's actual interface
- Made-up configuration options
- **Detection**: When an API call looks unusual, verify it exists in the project's dependency versions

---

## Category 3: Error Handling & Resilience

**Pass**: 2 (Logic & Resilience)
**Severity default**: HIGH or MEDIUM

### What to look for
- Empty catch blocks: `catch (e) {}` or `except: pass` — errors silently swallowed
- Generic catches: `catch (Exception e)` that mask specific failures
- Missing error handling on I/O operations: file reads, network calls, DB queries
- Missing async error handling: unhandled promise rejections, missing `.catch()`, missing try/catch around `await`
- Error messages that expose internals to users (stack traces, SQL errors, file paths)
- Missing retry/fallback for transient failures (network timeouts, rate limits, temporary unavailability)
- Missing cleanup in error paths: resources allocated before try that aren't freed in catch/finally
- Silent failures: functions that return null/undefined on error instead of throwing or returning an error type
- Missing error boundaries in React / error middleware in Express/Koa/etc.

### Grep patterns
```bash
# Empty catches
grep -rn "catch.*{" --include="*.{js,ts,java}" -A1 | grep -B1 "^\s*}"
grep -rn "except:\s*$\|except.*:\s*pass" --include="*.py"

# Unhandled promises
grep -rn "\.then(" --include="*.{js,ts}" | grep -v "\.catch\|await"

# console.log as "error handling"
grep -rn "catch.*console\.\(log\|warn\)" --include="*.{js,ts}" 
```

---

## Category 4: Business Logic Fragility

**Pass**: 2 (Logic & Resilience)
**Severity default**: MEDIUM (flag, don't assume bugs)

### What to look for
- Happy-path-only logic: no handling for empty results, zero quantities, missing optional fields
- Hardcoded business rules: magic numbers like `if (quantity > 100)` without named constants or config
- Missing boundary conditions: what happens at 0, 1, MAX_INT, empty string, empty array?
- Regex used for complex validation where a proper parser should be used (email validation, URL parsing, date parsing)
- State machines without explicit states: implicit state tracked via multiple booleans instead of a state enum
- Missing idempotency: operations that would cause duplicates if retried (double-charge, double-send)
- Missing pagination: queries that could return unbounded results
- Temporal assumptions: hardcoded timezones, missing timezone handling, date comparisons without timezone awareness

### AI-specific patterns to flag
- Regex patterns that are suspiciously complex but only handle a few test cases
- Validation logic that passes test data but would fail on real-world input formats
- Functions that return mocked/placeholder data alongside real logic (leftover stubs)
- TODO/FIXME/HACK comments that indicate incomplete implementation

### Grep patterns
```bash
# Suspicious regexes
grep -rn "new RegExp\|re\.compile\|/.*{[0-9].*}.*/" --include="*.{js,ts,py}"

# TODOs and hacks
grep -rn "TODO\|FIXME\|HACK\|XXX\|TEMP\|WORKAROUND" --include="*.{js,ts,py,rb,java,go}"

# Placeholder data
grep -rn "lorem\|placeholder\|dummy\|fake\|mock" --include="*.{js,ts,py}" | grep -v "test\|spec\|__test__\|__mock__"
```

---

## Category 5: Performance Antipatterns

**Pass**: 1 (Patterns) or 2 (Logic) depending on depth
**Severity default**: MEDIUM or LOW

### What to look for
- N+1 queries: database call inside a loop, API call inside a loop
- Blocking I/O on event loop: synchronous file/network operations in async contexts
- Missing pagination: `SELECT * FROM table` without LIMIT, `findAll()` without limit
- Memory leaks: event listeners added but never removed, growing caches without eviction, closures capturing large objects
- Redundant computation: same expensive operation called multiple times without memoization
- Missing indexing hints: queries filtering on non-indexed columns (if schema is visible)
- Large bundle / import waste: importing entire libraries for one function (`import _ from 'lodash'` vs `import get from 'lodash/get'`)
- Synchronous operations in hot paths: `JSON.parse(JSON.stringify())` for deep cloning, regex compilation inside loops

### Grep patterns
```bash
# N+1 patterns
grep -rn "for.*{" --include="*.{js,ts,py}" -A5 | grep "await\|\.query\|\.find\|\.get\|fetch("

# Sync I/O in async contexts
grep -rn "readFileSync\|writeFileSync\|execSync" --include="*.{js,ts}"

# Full library imports
grep -rn "import.*from ['\"]lodash['\"]$\|require(['\"]lodash['\"])$" --include="*.{js,ts}"
```

---

## Category 6: Type Safety

**Pass**: 1 (Patterns)
**Severity default**: MEDIUM or LOW

### What to look for (TypeScript/Flow/typed languages)
- `any` types: explicit `any` annotations, implicit `any` from missing annotations
- Type assertions without validation: `as SomeType` without runtime checks
- `!` (non-null assertion) used instead of proper null checks
- Missing return type annotations on public functions
- `@ts-ignore` / `@ts-nocheck` / `type: ignore` comments suppressing type errors

### What to look for (Python)
- Missing type hints on public function signatures
- `# type: ignore` comments
- `Any` used in type hints

### What to look for (dynamic languages)
- Missing JSDoc/docstring parameter types
- Implicit type coercions in comparisons and operations

### Grep patterns
```bash
# TypeScript any
grep -rn ": any\|as any\|<any>" --include="*.{ts,tsx}"

# TypeScript suppressions  
grep -rn "@ts-ignore\|@ts-nocheck\|@ts-expect-error" --include="*.{ts,tsx}"

# Python type ignore
grep -rn "# type: ignore\|# noqa" --include="*.py"
```

---

## Category 7: Input Validation

**Pass**: 3 (Security) — overlaps with Category 1
**Severity default**: HIGH or MEDIUM

### What to look for
- API endpoints accepting user input without validation (no schema validation, no type checking)
- Client-side-only validation without server-side mirror
- Inconsistent validation: field validated in one endpoint but not another
- Missing content-type checks on file uploads
- Missing size limits on request bodies, file uploads, query parameters
- Missing schema validation: using raw `req.body` instead of validated/parsed input

### Grep patterns
```bash
# Raw request body usage
grep -rn "req\.body\.\|req\.query\.\|req\.params\." --include="*.{js,ts}" | grep -v "validate\|schema\|zod\|joi\|yup\|ajv"

# Raw request in Python
grep -rn "request\.json\|request\.form\|request\.args" --include="*.py" | grep -v "validate\|schema\|pydantic\|marshmallow"
```

---

## Category 8: Code Duplication

**Pass**: 1 (Patterns)
**Severity default**: MEDIUM or LOW

### What to look for
- Copy-pasted logic blocks: near-identical functions or code blocks in different files
- Duplicated constants: same magic number or string literal defined in multiple places
- Similar data transformations repeated: map/filter/reduce chains that do the same thing
- Duplicated validation: same checks implemented independently in multiple places (divergence risk)
- Duplicated error handling patterns: same try/catch/log pattern repeated everywhere instead of a shared handler

### Detection heuristic
When you see a function that looks familiar from an earlier file, stop and search for it. Use grep to find similar patterns. If 3+ locations have similar logic (>5 lines), flag it.

---

## Category 9: Dead Code & Cleanup

**Pass**: 1 (Patterns)
**Severity default**: LOW or INFO

### What to look for
- Unused functions: defined but never called (check imports and dynamic usage)
- Unreachable code: code after return/throw/break/continue, dead branches in conditionals
- Commented-out code: large blocks of code in comments (not explanatory comments)
- Unused imports: imported modules/functions that are never referenced
- Unused dependencies: packages in package.json/requirements.txt not imported anywhere
- Unused variables: assigned but never read
- Orphaned files: files that exist but are not imported or referenced anywhere
- Console.log / print statements left from debugging

### Grep patterns
```bash
# Console/debug statements
grep -rn "console\.log\|console\.debug\|print(\|debugger\|binding\.pry" --include="*.{js,ts,py,rb}" | grep -v "test\|spec\|logger"

# Commented-out code (heuristic: multi-line comment blocks with code-like syntax)
grep -rn "^[[:space:]]*//" --include="*.{js,ts}" -A2 | grep -c "function\|const\|let\|var\|return\|if\|for"
```

---

## Category 10: Configuration & Secrets

**Pass**: 1 (Patterns) + 3 (Security)
**Severity default**: MEDIUM (config) or CRITICAL (secrets)

### What to look for
- Hardcoded URLs: API endpoints, database connection strings, webhook URLs
- Hardcoded ports, timeouts, retry counts, batch sizes
- Environment-specific values not in config/env: `if (process.env.NODE_ENV === 'production')` scattered everywhere
- Missing `.env.example`: if `.env` is in gitignore but there's no template for required variables
- Scattered configuration: config values spread across multiple files instead of centralized
- Missing default values for optional config: `process.env.TIMEOUT` used without fallback

### Grep patterns
```bash
# Hardcoded URLs
grep -rn "http://\|https://" --include="*.{js,ts,py,rb,java,go}" | grep -v "test\|spec\|mock\|node_modules\|comment\|\.md"

# Hardcoded ports
grep -rn "localhost:[0-9]\|:3000\|:8080\|:5432\|:27017\|:6379" --include="*.{js,ts,py,rb,java,go}" | grep -v "test\|\.env\|config"

# Missing env fallbacks
grep -rn "process\.env\.\|os\.environ\[" --include="*.{js,ts,py}" | grep -v "||.*\|or \|\.get("
```

---

## Category 11: Naming & Documentation

**Pass**: 1 (Patterns)
**Severity default**: LOW or INFO

### What to look for
- Single-letter or abbreviated variable names in non-trivial scope (not loop counters)
- Misleading names: boolean named `data`, array named `item`, function named `handle` without context
- Comments that describe "what" instead of "why" (`// increment i` above `i++`)
- Missing docstrings/JSDoc on exported/public functions
- Stale comments: comments that describe logic that has since been changed
- Inconsistent naming convention: camelCase mixed with snake_case in the same file/module

### Don't flag
- Short names in small scopes (loop variables, lambda parameters)
- Comments that explain complex algorithms or business rules
- Names that follow framework conventions even if they seem generic

---

## Category 12: Architecture & Design

**Pass**: 2 (Logic)
**Severity default**: MEDIUM or LOW

### What to look for
- God classes/modules: single file with 500+ lines doing multiple unrelated things
- Feature envy: function that uses more data from another module than its own
- Tight coupling: modules that directly import deep internals of other modules
- Missing separation of concerns: database queries in route handlers, business logic in UI components
- Circular dependencies: A imports B imports C imports A
- Leaky abstractions: internal implementation details exposed to consumers
- Missing interface boundaries: everything accessing everything else directly

### Do NOT recommend
- Premature microservice extraction
- Design patterns for their own sake (factory of factories, etc.)
- Rewriting to match a "better" architecture unless the current one causes concrete problems

---

## Category 13: Logging & Observability

**Pass**: 1 (Patterns) + 2 (Logic)
**Severity default**: LOW or MEDIUM

### What to look for
- Missing logging on critical operations: auth events, payment processing, data mutations, errors
- Logging sensitive data: passwords, tokens, PII in log output
- `console.log` used instead of structured logger in production code
- Missing request ID / correlation ID for tracing
- Missing health check endpoint (for web services)
- Missing structured logging format (JSON logs vs plain text in production)
- Logging too much (verbose debug logging in production paths) or too little (no logging at all)

---

## Category 14: Dependency Management

**Pass**: 1 (Patterns)
**Severity default**: MEDIUM or LOW

### What to look for
- Missing lock file: `package.json` without `package-lock.json` or `yarn.lock`
- Unused dependencies: packages in manifest not imported in source
- Heavy dependencies for simple operations: pulling in a large library for a single utility function
- Pinned to wildcard versions: `"*"` or `"latest"` in dependency versions
- Circular dependencies between internal modules
- Deprecated packages (check for deprecation notices in package metadata)

### Grep patterns
```bash
# Check for lock file existence
ls package-lock.json yarn.lock pnpm-lock.yaml Pipfile.lock poetry.lock 2>/dev/null

# Find unused deps (JS — heuristic)
for dep in $(node -e "Object.keys(require('./package.json').dependencies || {}).forEach(d => console.log(d))" 2>/dev/null); do
  count=$(grep -rn "\"$dep\"\|'$dep'\|from '$dep\|require('$dep" --include="*.{js,ts,tsx,jsx}" | grep -v node_modules | wc -l)
  if [ "$count" -eq "0" ]; then echo "UNUSED: $dep"; fi
done
```

---

## Category 15: Testing Gaps

**Pass**: 1 (Patterns)
**Severity default**: LOW or INFO

### What to look for
- Missing tests for critical paths identified in Pass 0 (auth, payments, core CRUD)
- Superficial assertions: `expect(result).toBeTruthy()` instead of checking specific values
- Tests that mirror implementation: testing the code does what it does, not what it should do
- Missing edge case tests: only happy-path test data
- Missing error case tests: no tests for failure scenarios
- Test isolation issues: tests that depend on execution order or shared mutable state
- Mocking too much: tests that mock everything and test nothing real
- No tests at all: detected if test directory is empty or missing

### Don't flag
- Missing 100% coverage — that's not the goal
- Missing tests for trivial utilities or generated code
- Missing integration/e2e tests if unit tests cover the logic (flag as INFO suggestion only)
