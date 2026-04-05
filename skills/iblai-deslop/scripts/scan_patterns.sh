#!/bin/bash
# scan_patterns.sh — Detect common antipatterns across a codebase
# Usage: bash scan_patterns.sh [directory]
#
# Scans for security issues, error handling gaps, config problems,
# and AI-specific code smells. Output is grouped by category.

DIR="${1:-.}"
echo "=== Pattern Scan: $DIR ==="
echo "Date: $(date -Iseconds)"
echo ""

# Exclude dirs
EXCL="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=__pycache__ --exclude-dir=venv --exclude-dir=.venv --exclude-dir=dist --exclude-dir=build --exclude-dir=vendor"

# ─── SECURITY ──────────────────────────────────────────────

echo "## SECURITY PATTERNS"
echo ""

echo "### Potential SQL injection (string concatenation in queries)"
grep -rn $EXCL \
    -e "SELECT.*+.*req\." \
    -e "INSERT.*+.*req\." \
    -e "UPDATE.*+.*req\." \
    -e "DELETE.*+.*req\." \
    -e 'f".*SELECT.*{' \
    -e 'f".*INSERT.*{' \
    -e 'f".*UPDATE.*{' \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" --include="*.php" \
    "$DIR" 2>/dev/null
echo ""

echo "### Potential command injection"
grep -rn $EXCL \
    -e "exec(" \
    -e "eval(" \
    -e "Function(" \
    -e "os\.system(" \
    -e "subprocess.*shell.*=.*True" \
    -e "child_process\.exec(" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" \
    "$DIR" 2>/dev/null | grep -v "test\|spec\|mock"
echo ""

echo "### Hardcoded secrets (high-confidence patterns)"
grep -rn $EXCL \
    -e "sk-[a-zA-Z0-9]\{20,\}" \
    -e "pk_live_" \
    -e "ghp_[a-zA-Z0-9]\{36\}" \
    -e "AKIA[A-Z0-9]\{16\}" \
    -e "xox[bpas]-" \
    -e "ya29\." \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" --include="*.env" --include="*.yml" --include="*.yaml" --include="*.json" \
    "$DIR" 2>/dev/null | grep -v "node_modules\|example\|placeholder\|test"
echo ""

echo "### Hardcoded passwords/keys (medium-confidence — verify manually)"
grep -rn $EXCL \
    -e 'password\s*=\s*["\x27][^"\x27]\{3,\}' \
    -e 'api_key\s*=\s*["\x27][^"\x27]\{3,\}' \
    -e 'apiKey\s*=\s*["\x27][^"\x27]\{3,\}' \
    -e 'secret\s*=\s*["\x27][^"\x27]\{3,\}' \
    -e 'token\s*=\s*["\x27][^"\x27]\{3,\}' \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" \
    "$DIR" 2>/dev/null | grep -v "test\|mock\|example\|placeholder\|TODO\|process\.env\|os\.environ\|config\.\|getenv"
echo ""

# ─── ERROR HANDLING ────────────────────────────────────────

echo "## ERROR HANDLING PATTERNS"
echo ""

echo "### Empty catch blocks (JS/TS)"
grep -rn $EXCL "catch\s*([^)]*)\s*{" --include="*.js" --include="*.ts" --include="*.tsx" "$DIR" 2>/dev/null -A1 | grep -B1 "^\s*}" | grep "catch"
echo ""

echo "### Bare except (Python)"
grep -rn $EXCL "except:\s*$\|except\s*Exception\s*:" --include="*.py" "$DIR" 2>/dev/null
echo ""

echo "### Swallowed errors (catch with only console.log)"
grep -rn $EXCL "catch" --include="*.js" --include="*.ts" --include="*.tsx" "$DIR" 2>/dev/null -A3 | grep -B2 "console\.log\|console\.error" | grep -v "throw\|reject\|return.*error\|return.*Error"
echo ""

echo "### Unhandled promise chains (missing .catch)"
grep -rn $EXCL "\.then(" --include="*.js" --include="*.ts" "$DIR" 2>/dev/null | grep -v "\.catch\|await\|test\|spec"
echo ""

# ─── CONFIGURATION ─────────────────────────────────────────

echo "## CONFIGURATION PATTERNS"
echo ""

echo "### Hardcoded URLs in source"
grep -rn $EXCL "https\?://[a-zA-Z0-9]" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" \
    "$DIR" 2>/dev/null | grep -v "test\|spec\|mock\|\.md\|comment\|localhost\|127\.0\.0\.1\|example\.com\|schema\.org\|w3\.org\|jsdelivr\|cdnjs\|unpkg\|googleapis"
echo ""

echo "### process.env / os.environ without fallback"
grep -rn $EXCL "process\.env\.\w\+" --include="*.js" --include="*.ts" "$DIR" 2>/dev/null | grep -v "||.*\|??\|process\.env\.NODE_ENV"
grep -rn $EXCL "os\.environ\[" --include="*.py" "$DIR" 2>/dev/null | grep -v "\.get(\|os\.getenv"
echo ""

echo "### Missing lock files"
for lockfile in "package-lock.json" "yarn.lock" "pnpm-lock.yaml" "Pipfile.lock" "poetry.lock" "Cargo.lock" "go.sum" "Gemfile.lock"; do
    if [ -f "$DIR/package.json" ] || [ -f "$DIR/requirements.txt" ] || [ -f "$DIR/Cargo.toml" ] || [ -f "$DIR/go.mod" ] || [ -f "$DIR/Gemfile" ]; then
        if [ ! -f "$DIR/$lockfile" ] && [ "$lockfile" != "package-lock.json" ] 2>/dev/null; then
            continue
        fi
        if [ -f "$DIR/package.json" ] && [ ! -f "$DIR/package-lock.json" ] && [ ! -f "$DIR/yarn.lock" ] && [ ! -f "$DIR/pnpm-lock.yaml" ]; then
            echo "  MISSING_LOCK: No JS lock file found (package-lock.json, yarn.lock, or pnpm-lock.yaml)"
            break
        fi
    fi
done
echo ""

# ─── AI-SPECIFIC SMELLS ───────────────────────────────────

echo "## AI-SPECIFIC CODE SMELLS"
echo ""

echo "### TODO/FIXME/HACK comments (may indicate incomplete AI-generated code)"
grep -rn $EXCL "TODO\|FIXME\|HACK\|XXX\|TEMP\|WORKAROUND\|PLACEHOLDER" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" \
    "$DIR" 2>/dev/null
echo ""

echo "### Placeholder/dummy data in non-test files"
grep -rn $EXCL "lorem\|placeholder\|dummy\|fake_\|mock_\|sample_data\|test_data" \
    --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" --include="*.java" --include="*.go" \
    "$DIR" 2>/dev/null | grep -v "test\|spec\|__test__\|__mock__\|fixture"
echo ""

echo "### TypeScript escape hatches"
grep -rn $EXCL "@ts-ignore\|@ts-nocheck\|@ts-expect-error\|as any\|: any" \
    --include="*.ts" --include="*.tsx" \
    "$DIR" 2>/dev/null
echo ""

echo "### Python type suppression"
grep -rn $EXCL "# type: ignore\|# noqa\|# pylint: disable" \
    --include="*.py" \
    "$DIR" 2>/dev/null
echo ""

# ─── PERFORMANCE ───────────────────────────────────────────

echo "## PERFORMANCE PATTERNS"
echo ""

echo "### Synchronous I/O in async codebases (JS/TS)"
grep -rn $EXCL "readFileSync\|writeFileSync\|execSync\|accessSync\|existsSync\|mkdirSync" \
    --include="*.js" --include="*.ts" \
    "$DIR" 2>/dev/null | grep -v "test\|spec\|config\|script\|build\|webpack\|vite\|rollup"
echo ""

echo "### Full lodash import (should use specific imports)"
grep -rn $EXCL "from ['\"]lodash['\"]$\|require(['\"]lodash['\"])" \
    --include="*.js" --include="*.ts" \
    "$DIR" 2>/dev/null
echo ""

# ─── SUMMARY ───────────────────────────────────────────────

echo ""
echo "## FILE STATISTICS"
echo ""

total_files=$(find "$DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" -o -name "*.rb" -o -name "*.java" -o -name "*.go" -o -name "*.php" \) 2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv | grep -v dist | grep -v build | wc -l)
total_lines=$(find "$DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" -o -name "*.rb" -o -name "*.java" -o -name "*.go" -o -name "*.php" \) 2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv | grep -v dist | grep -v build | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
test_files=$(find "$DIR" -type f \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" -o -name "*_test.*" \) 2>/dev/null | grep -v node_modules | wc -l)

echo "  Source files: $total_files"
echo "  Total lines: $total_lines"
echo "  Test files: $test_files"

if [ -f "$DIR/package.json" ]; then
    dep_count=$(node -e "const p=require('./$DIR/package.json'); console.log(Object.keys(p.dependencies||{}).length)" 2>/dev/null || echo "?")
    devdep_count=$(node -e "const p=require('./$DIR/package.json'); console.log(Object.keys(p.devDependencies||{}).length)" 2>/dev/null || echo "?")
    echo "  Dependencies: $dep_count (+ $devdep_count dev)"
fi

echo ""
echo "=== Pattern scan complete ==="
