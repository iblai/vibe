# iblai-vibe-ops-upgrade

> Upgrade the @iblai/iblai-js SDK and refresh every ibl.ai skill (both families — iblai-vibe-* and iblai-api-*) to the latest release, then summarize what changed. Use when asked to "upgrade iblai", "get the latest SDK", "update ibl.ai", "refresh the skills", when the installed skills are older than two weeks, or when a skill misbehaves in a way a newer release may fix.

# /iblai-vibe-ops-upgrade

Upgrade the ibl.ai toolchain in the current project to the latest versions.
Two things:

1. The `@iblai/iblai-js` SDK in the project's `package.json`
2. Every ibl.ai skill — both families, `iblai-vibe-*` and `iblai-api-*`, come
   from this one repo (re-runs `npx skills add iblai/vibe --all`)

Installed skills are a **copy**: they never update themselves. This repo
changes often (daily SDK bumps; skills corrected as endpoints and components
move), so run this whenever the installed copy is older than the latest
release.

Use when asked to "upgrade iblai", "get the latest SDK", "update ibl.ai",
or "refresh the skills".

## Key commands

| What | Command |
|------|---------|
| SDK version | `pnpm list @iblai/iblai-js` |
| Skills source | `npx skills add iblai/vibe --all` |

---

## Step 0: How stale is the installed copy?

```bash
SKILLS_DIR=$(ls -d .claude/skills .agents/skills .cursor/rules 2>/dev/null | head -1)
LOCAL=$(stat -f %m "$SKILLS_DIR/iblai-vibe/SKILL.md" 2>/dev/null || stat -c %Y "$SKILLS_DIR/iblai-vibe/SKILL.md" 2>/dev/null || echo 0)
LATEST=$(curl -s https://api.github.com/repos/iblai/vibe/releases/latest | python3 -c 'import json,sys,datetime; d=json.load(sys.stdin); print(d.get("tag_name",""), d.get("published_at",""))')
echo "installed: $(date -r "$LOCAL" 2>/dev/null || date -d @"$LOCAL")  · latest release: $LATEST"
```

If the release is newer than the installed copy, or the copy is older than
14 days, continue; otherwise tell the user they are current and stop.

## Step 1: Detect current SDK

```bash
OLD_SDK=$(node -p "require('./package.json').dependencies['@iblai/iblai-js'] || ''" 2>/dev/null || echo "")
echo "Current SDK (package.json): ${OLD_SDK:-not-installed}"
```

---

## Step 2: Upgrade the SDK

Skip this step if there is no `package.json` in the current directory, or if
`@iblai/iblai-js` is not a dependency.

```bash
if [ -f package.json ] && [ -n "$OLD_SDK" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm update @iblai/iblai-js@latest
  elif command -v npm >/dev/null 2>&1; then
    npm install @iblai/iblai-js@latest
  fi
  NEW_SDK=$(node -p "require('./package.json').dependencies['@iblai/iblai-js']")
  echo "SDK: $OLD_SDK → $NEW_SDK"
fi
```

Run a quick sanity check afterward:

```bash
pnpm typecheck 2>/dev/null || npx tsc --noEmit 2>/dev/null || true
```

If typecheck fails with new errors, surface them to the user — the SDK
may have introduced breaking changes. Compare against the installed
package's README (`node_modules/@iblai/iblai-js/README.md`) and the
[npm version history](https://www.npmjs.com/package/@iblai/iblai-js?activeTab=versions)
to see what changed.

---

## Step 3: Refresh skills

Re-run the installer to pull the latest skills — both families, the Cursor /
Codex adapters, and any new skills added since. Pass `--all` so it runs
non-interactively and refreshes every skill in the pack.

```bash
npx skills add iblai/vibe --all
```

---

## Step 4: Show What's New

Fetch the last few entries from the vibe CHANGELOG and summarize as
3-7 bullets grouped by theme. Focus on user-facing changes, skip
internal refactors.

```bash
curl -sL https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/CHANGELOG.md | head -80
```

Format the report:

```
ibl.ai upgrade complete!

SDK:    {OLD_SDK} → {NEW_SDK}
Skills: refreshed from iblai/vibe@<latest tag> (iblai-vibe-* + iblai-api-*)

What's new:
- [bullet 1]
- [bullet 2]
- ...
```

If any step was skipped (no `package.json`, SDK not a dependency, etc.),
note that explicitly in the summary.

---

## When to run

- After a new ibl.ai release is announced
- Before starting work on a project you haven't touched in a while
- When a skill misbehaves in a way that might be fixed upstream
- Periodically (monthly) to stay current on security patches

## Reference

- SDK package: https://www.npmjs.com/package/@iblai/iblai-js
- Vibe skills: https://github.com/iblai/vibe