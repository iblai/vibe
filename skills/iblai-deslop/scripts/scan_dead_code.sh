#!/bin/bash
# scan_dead_code.sh — Detect likely dead code in a codebase
# Usage: bash scan_dead_code.sh [directory]
#
# Outputs a list of potential dead code candidates. NOT definitive —
# dynamic imports, reflection, and framework magic can cause false positives.
# The LLM should review each candidate for false positives before flagging.

DIR="${1:-.}"
echo "=== Dead Code Scan: $DIR ==="
echo ""

# --- Unused exports (JS/TS) ---
echo "## Potentially unused exported functions (JS/TS)"
echo "# Functions defined with 'export' but not imported elsewhere"
echo ""

for f in $(find "$DIR" -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | grep -v node_modules | grep -v dist | grep -v build | grep -v ".d.ts"); do
    # Extract exported function/const names
    grep -oP '(?<=export (?:function|const|class|let|var|async function) )\w+' "$f" 2>/dev/null | while read -r name; do
        # Count references in other files (exclude the defining file itself)
        count=$(grep -rn --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" "$name" "$DIR" 2>/dev/null | grep -v node_modules | grep -v "$f" | wc -l)
        if [ "$count" -eq "0" ]; then
            echo "  UNUSED_EXPORT: $name in $f"
        fi
    done
done

echo ""

# --- Unused Python functions ---
echo "## Potentially unused functions (Python)"
echo ""

for f in $(find "$DIR" -name "*.py" 2>/dev/null | grep -v __pycache__ | grep -v venv | grep -v .venv | grep -v site-packages); do
    grep -oP '(?<=def )\w+' "$f" 2>/dev/null | while read -r name; do
        # Skip dunder methods, test functions, and private methods
        if [[ "$name" == __* ]] || [[ "$name" == test_* ]] || [[ "$name" == _* ]]; then
            continue
        fi
        count=$(grep -rn --include="*.py" "$name" "$DIR" 2>/dev/null | grep -v __pycache__ | grep -v venv | grep -v "$f:" | wc -l)
        if [ "$count" -eq "0" ]; then
            echo "  UNUSED_FUNC: $name in $f"
        fi
    done
done

echo ""

# --- Unused imports ---
echo "## Unused imports"
echo ""

# JS/TS: imported names not referenced later in the same file
for f in $(find "$DIR" -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" 2>/dev/null | grep -v node_modules | grep -v dist | grep -v build); do
    grep -oP "import\s+\{([^}]+)\}" "$f" 2>/dev/null | grep -oP '\w+' | while read -r name; do
        # Skip 'import' and 'from' keywords
        if [[ "$name" == "import" ]] || [[ "$name" == "from" ]]; then continue; fi
        count=$(grep -c "$name" "$f" 2>/dev/null)
        if [ "$count" -le "1" ]; then
            echo "  UNUSED_IMPORT: $name in $f"
        fi
    done
done

echo ""

# --- Commented-out code blocks ---
echo "## Large commented-out code blocks (>3 lines)"
echo ""

for f in $(find "$DIR" \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.go" -o -name "*.rb" \) 2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv); do
    # Count consecutive comment lines that look like code (contain = or ( or { or ;)
    awk '
    /^[[:space:]]*(\/\/|#).*[=({;]/ { count++; start=NR-count+1; next }
    { if (count >= 3) print "  COMMENTED_CODE: " FILENAME " lines " start "-" NR-1 " (" count " lines)"; count=0 }
    END { if (count >= 3) print "  COMMENTED_CODE: " FILENAME " lines " start "-" NR " (" count " lines)" }
    ' "$f" 2>/dev/null
done

echo ""

# --- Console/debug statements ---
echo "## Debug statements in non-test files"
echo ""

grep -rn "console\.log\|console\.debug\|console\.warn\|print(\|debugger\|binding\.pry\|pdb\.set_trace\|breakpoint()" \
    --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.py" --include="*.rb" \
    "$DIR" 2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv | grep -v test | grep -v spec | grep -v __test__ | \
    while read -r line; do
        echo "  DEBUG_STMT: $line"
    done

echo ""
echo "=== Scan complete ==="
