---
name: iblai-ops-upgrade
description: Upgrade the ibl.ai CLI, SDK, and vibe skills to the latest versions
globs:
alwaysApply: false
---

# /iblai-ops-upgrade

Upgrade the ibl.ai toolchain in the current project to the latest
versions. Covers three things:

1. The `iblai` CLI (`iblai-app-cli` on PyPI / `@iblai/cli` on npm)
2. The `@iblai/iblai-js` SDK in the project's `package.json`
3. The vibe skills (re-runs `npx skills add iblai/vibe`)

Use when asked to "upgrade iblai", "update the ibl.ai CLI", "get the
latest SDK", or "refresh the skills".

## Key commands

| What | Command |
|------|---------|
| CLI version | `iblai --version` |
| CLI info | `iblai info` |
| SDK version | `pnpm list @iblai/iblai-js` |
| Skills source | `npx skills add iblai/vibe --all` |

---

## Step 1: Detect current install

Capture the current state so we can show a before/after diff.

```bash
OLD_CLI=$(iblai --version 2>/dev/null | awk '{print $NF}' || echo "not-installed")
OLD_SDK=$(node -p "require('./package.json').dependencies['@iblai/iblai-js'] || ''" 2>/dev/null || echo "")
echo "Current CLI: $OLD_CLI"
echo "Current SDK (package.json): ${OLD_SDK:-not-installed}"
```

Detect how the CLI is installed (affects which upgrade command to run):

```bash
CLI_PATH=$(command -v iblai 2>/dev/null || true)
if [ -z "$CLI_PATH" ]; then
  INSTALL_METHOD="none"
elif echo "$CLI_PATH" | grep -q "pipx"; then
  INSTALL_METHOD="pipx"
elif pip show iblai-app-cli >/dev/null 2>&1; then
  INSTALL_METHOD="pip"
elif echo "$CLI_PATH" | grep -q "\.local/bin"; then
  INSTALL_METHOD="source"
else
  INSTALL_METHOD="npm"
fi
echo "Install method: $INSTALL_METHOD"
```

---

## Step 2: Upgrade the CLI

Run the command matching `$INSTALL_METHOD`:

```bash
case "$INSTALL_METHOD" in
  pipx)   pipx upgrade iblai-app-cli ;;
  pip)    pip install --upgrade iblai-app-cli ;;
  npm)    npm install -g @iblai/cli@latest ;;
  source)
    # Built from source via `make install` — pull and rebuild.
    REPO="$HOME/iblai-app-cli"
    if [ -d "$REPO/.git" ]; then
      (cd "$REPO" && git pull --ff-only && make -C .iblai install)
    else
      echo "Source install detected but $REPO not found. Reinstall:"
      echo "  git clone https://github.com/iblai/iblai-app-cli.git"
      echo "  cd iblai-app-cli && make -C .iblai install"
    fi
    ;;
  none)
    echo "iblai CLI not installed. See /iblai-auth for install instructions."
    exit 1
    ;;
esac
```

If the upgrade command fails, stop and report the error — do **not**
proceed to the SDK/skills steps.

Verify:

```bash
NEW_CLI=$(iblai --version | awk '{print $NF}')
echo "CLI: $OLD_CLI → $NEW_CLI"
```

---

## Step 3: Upgrade the SDK

Skip this step if there is no `package.json` in the current directory,
or if `@iblai/iblai-js` is not a dependency.

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
may have introduced breaking changes. Point them at the
[CHANGELOG](https://raw.githubusercontent.com/iblai/iblai-js/refs/heads/main/CHANGELOG.md)
for migration notes.

---

## Step 4: Refresh skills

Re-run the installer to pull the latest vibe skills. Pass `--all` so it
runs non-interactively and refreshes every skill in the pack.

```bash
npx skills add iblai/vibe --all
```

---

## Step 5: Show What's New

Fetch the last few entries from the vibe CHANGELOG and summarize as
3-7 bullets grouped by theme. Focus on user-facing changes, skip
internal refactors.

```bash
curl -sL https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/CHANGELOG.md | head -80
```

Format the report:

```
ibl.ai upgrade complete!

CLI:    {OLD_CLI} → {NEW_CLI}
SDK:    {OLD_SDK} → {NEW_SDK}
Skills: refreshed from iblai/vibe@main

What's new:
- [bullet 1]
- [bullet 2]
- ...
```

If any step was skipped (no `package.json`, CLI not installed, etc.),
note that explicitly in the summary.

---

## When to run

- After a new ibl.ai release is announced
- Before starting work on a project you haven't touched in a while
- When a skill or CLI command misbehaves in a way that might be fixed
  upstream
- Periodically (monthly) to stay current on security patches

## Reference

- CLI repo: https://github.com/iblai/iblai-app-cli
- SDK package: https://www.npmjs.com/package/@iblai/iblai-js
- Vibe skills: https://github.com/iblai/vibe
