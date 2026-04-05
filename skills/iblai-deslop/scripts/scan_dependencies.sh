#!/bin/bash
# scan_dependencies.sh — Map internal file dependencies in a codebase
# Usage: bash scan_dependencies.sh [directory]
#
# Builds a dependency graph showing which files import from which.
# Outputs: import relationships, most-connected files (audit priority),
# and potential circular dependency chains.

DIR="${1:-.}"
TMPFILE=$(mktemp)
echo "=== Dependency Map: $DIR ==="
echo ""

# ─── EXTRACT IMPORTS ───────────────────────────────────────

echo "## Import Relationships"
echo "# Format: IMPORTING_FILE -> IMPORTED_MODULE"
echo ""

# JS/TS imports
find "$DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" \) \
    2>/dev/null | grep -v node_modules | grep -v dist | grep -v build | while read -r f; do
    # ES6 imports: import ... from './...'
    grep -oP "from\s+['\"](\./[^'\"]+|\.\.\/[^'\"]+)['\"]" "$f" 2>/dev/null | \
        sed "s/from\s*['\"]//;s/['\"]//" | while read -r imp; do
            echo "$f -> $imp" >> "$TMPFILE"
            echo "  $f -> $imp"
        done
    # CommonJS requires: require('./...')
    grep -oP "require\(['\"](\./[^'\"]+|\.\.\/[^'\"]+)['\"]\)" "$f" 2>/dev/null | \
        sed "s/require(['\"]//;s/['\"]\)//" | while read -r imp; do
            echo "$f -> $imp" >> "$TMPFILE"
            echo "  $f -> $imp"
        done
done

# Python imports (relative)
find "$DIR" -type f -name "*.py" 2>/dev/null | grep -v __pycache__ | grep -v venv | grep -v .venv | while read -r f; do
    grep -oP "from\s+\.\S+\s+import|import\s+\.\S+" "$f" 2>/dev/null | while read -r imp; do
        echo "$f -> $imp" >> "$TMPFILE"
        echo "  $f -> $imp"
    done
done

# Go imports (internal packages)
if [ -f "$DIR/go.mod" ]; then
    MODULE=$(head -1 "$DIR/go.mod" | awk '{print $2}')
    find "$DIR" -type f -name "*.go" 2>/dev/null | grep -v vendor | while read -r f; do
        grep -oP "\"$MODULE/[^\"]+\"" "$f" 2>/dev/null | tr -d '"' | while read -r imp; do
            echo "$f -> $imp" >> "$TMPFILE"
            echo "  $f -> $imp"
        done
    done
fi

echo ""

# ─── CONNECTIVITY ANALYSIS ────────────────────────────────

echo "## Most-Connected Files (Audit Priority)"
echo "# Files with the most incoming + outgoing connections should be audited first"
echo ""

if [ -s "$TMPFILE" ]; then
    echo "### Top importers (most outgoing dependencies — high coupling risk)"
    awk -F' -> ' '{print $1}' "$TMPFILE" | sort | uniq -c | sort -rn | head -15 | while read -r count file; do
        echo "  $count imports: $file"
    done
    echo ""

    echo "### Most imported (most incoming dependencies — high blast radius)"
    awk -F' -> ' '{print $2}' "$TMPFILE" | sort | uniq -c | sort -rn | head -15 | while read -r count file; do
        echo "  $count dependents: $file"
    done
    echo ""

    # ─── CIRCULAR DEPENDENCY DETECTION ─────────────────────

    echo "## Potential Circular Dependencies"
    echo "# Direct circles: A imports B AND B imports A"
    echo ""

    awk -F' -> ' '{print $1 " " $2}' "$TMPFILE" | while read -r a b; do
        # Normalize paths for comparison
        if grep -q "^$b.*->.*$a" "$TMPFILE" 2>/dev/null; then
            echo "  CIRCULAR: $a <-> $b"
        fi
    done | sort -u
    echo ""
else
    echo "  No internal imports detected. The codebase may use a module system not covered by this scanner."
    echo ""
fi

# ─── ENTRY POINTS ─────────────────────────────────────────

echo "## Likely Entry Points"
echo "# Files that are imported by nothing (or by infrastructure only)"
echo ""

# Files that exist in source but never appear as import targets
find "$DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" \) \
    2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv | grep -v dist | grep -v build | grep -v test | grep -v spec | while read -r f; do
    basename_noext=$(basename "$f" | sed 's/\.[^.]*$//')
    imported=$(grep -c "$basename_noext" "$TMPFILE" 2>/dev/null)
    if [ "$imported" -eq "0" ]; then
        # Check if it looks like an entry point
        if echo "$f" | grep -qiE "index\.|main\.|app\.|server\.|cli\.|entry\.|__main__"; then
            echo "  ENTRY: $f"
        elif echo "$f" | grep -qiE "route\|handler\|controller\|endpoint\|api"; then
            echo "  ENTRY (route): $f"
        fi
    fi
done

echo ""

# ─── ORPHANED FILES ───────────────────────────────────────

echo "## Potentially Orphaned Files"
echo "# Source files that are never imported and don't look like entry points"
echo ""

find "$DIR" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" \) \
    2>/dev/null | grep -v node_modules | grep -v __pycache__ | grep -v venv | grep -v dist | grep -v build | grep -v test | grep -v spec | while read -r f; do
    basename_noext=$(basename "$f" | sed 's/\.[^.]*$//')
    imported=$(grep -c "$basename_noext" "$TMPFILE" 2>/dev/null)
    if [ "$imported" -eq "0" ]; then
        if ! echo "$f" | grep -qiE "index\.|main\.|app\.|server\.|cli\.|entry\.|__main__\|route\|handler\|controller\|endpoint\|api\|config\|setup\|migration\|seed"; then
            echo "  ORPHAN?: $f"
        fi
    fi
done

echo ""

# Cleanup
rm -f "$TMPFILE"
echo "=== Dependency scan complete ==="
