#!/usr/bin/env python3
"""Vocabulary sweep for prose: organization (not tenant), agent (not mentor),
user (not learner). Only prose is touched — fenced code, inline code spans,
italic wire-name mentions (*mentor*), URLs, identifiers (camelCase, snake_case,
kebab paths) and <placeholders> are left exactly as they are, because those
are the names the platform actually uses on the wire.

    python3 scripts/sweep-terms.py [--dry] [paths…]   (default: the docs + skills)
"""
import re, sys, pathlib

COMPOUNDS = [
    (r"multi-tenancy", "multi-organization"), (r"multi-tenant", "multi-organization"),
    (r"single-tenant", "single-organization"), (r"per-tenant", "per-organization"),
    (r"cross-tenant", "cross-organization"), (r"tenant-scoped", "organization-scoped"),
    (r"tenant-wide", "organization-wide"), (r"tenant-locked", "organization-locked"),
    (r"tenant-level", "organization-level"), (r"tenant-specific", "organization-specific"),
    (r"learner-safe", "user-safe"), (r"per-learner", "per-user"), (r"mentor-scoped", "agent-scoped"),
    (r"per-mentor", "per-agent"), (r"multi-mentor", "multi-agent"),
]
WORDS = {
    "tenant": "organization", "tenants": "organizations", "Tenant": "Organization", "Tenants": "Organizations",
    "tenancy": "organizations", "Tenancy": "Organizations",
    "mentor": "agent", "mentors": "agents", "Mentor": "Agent", "Mentors": "Agents",
    "learner": "user", "learners": "users", "Learner": "User", "Learners": "Users",
}
WORD_RE = re.compile(r"(?<![\w/.\-_<>@#])(" + "|".join(sorted(WORDS, key=len, reverse=True)) + r")(?![\w/.\-_<>])")
# Segments to leave alone: fenced code, inline code, italic *wire-name*, URLs.
PROTECT = re.compile(r"(```[\s\S]*?```|`[^`\n]*`|\*[^*\n]{1,40}\*|https?://\S+)")

def sweep_text(text):
    out, n = [], 0
    for i, seg in enumerate(PROTECT.split(text)):
        if i % 2 == 1:           # protected
            out.append(seg); continue
        for pat, rep in COMPOUNDS:
            seg, k = re.subn(r"(?<![\w/.\-_])" + pat + r"(?![\w/.\-_])", rep, seg); n += k
        seg, k = WORD_RE.subn(lambda m: WORDS[m.group(1)], seg); n += k
        out.append(seg)
    # articles: "a organization" → "an organization", "an agent" stays; "a agent" → "an agent"
    joined = "".join(out)
    joined, k = re.subn(r"\b([Aa]) (organization|agent)\b", lambda m: ("an " if m.group(1) == "a" else "An ") + m.group(2), joined); n += k
    joined, k = re.subn(r"\b([Aa])n (user)\b", lambda m: ("a " if m.group(1) == "a" else "A ") + m.group(2), joined); n += k
    # a word the sweep would double up
    joined = joined.replace("agent (agent)", "agent").replace("agents (agents)", "agents").replace("organization (organization)", "organization")
    return joined, n

SKIP = ("CHANGELOG.md", "docs/api-skills-changelog.md", "docs/user-first-plan.md", "node_modules", "adapters/", ".skill-tests", "references/default-roles.py")

def main():
    dry = "--dry" in sys.argv
    paths = [a for a in sys.argv[1:] if not a.startswith("--")] or ["skills", "docs", "README.md", "CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md", "templates", "mcp", "tutorials"]
    files = []
    for p in paths:
        p = pathlib.Path(p)
        if p.is_file(): files.append(p)
        elif p.is_dir(): files += [f for f in p.rglob("*") if (f.suffix == ".md" or f.name.endswith(".md.j2")) and f.is_file()]  # markdown only — never code assets
    total, touched = 0, 0
    for f in files:
        if any(s in str(f) for s in SKIP): continue
        src = f.read_text(errors="ignore")
        new, n = sweep_text(src)
        if n and new != src:
            touched += 1; total += n
            if not dry: f.write_text(new)
            print(f"{n:4d}  {f}")
    print(f"{'[dry] ' if dry else ''}{touched} files, {total} replacements")

if __name__ == "__main__":
    main()
