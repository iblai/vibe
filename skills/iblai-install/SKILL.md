---
name: iblai-install
description: Install the iblai CLI (build from source or npx)
globs:
alwaysApply: false
---

# /iblai-install

Install the iblai CLI for scaffolding and managing ibl.ai apps.

## Quick Check

```bash
iblai --version
```

If this works, you're all set -- skip to the skill you need.

## Option 1: npx (When Published)

```bash
npx @iblai/cli --version
```

This downloads and runs the CLI without a global install.
Use `npx @iblai/cli` as a prefix for any command:

```bash
npx @iblai/cli startapp agent
npx @iblai/cli add auth
npx @iblai/cli config show
```

## Option 2: Build from Source

### macOS / Linux

Requires: Python 3.11+, pip, git, make

```bash
git clone https://github.com/iblai/iblai-app-cli.git
cd iblai-app-cli
make -C .iblai install
```

Verify:

```bash
iblai --version
```

If the command is not found, add `~/.local/bin` to your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

To make this permanent:

```bash
# bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

Then return to your project:

```bash
cd -   # back to your project directory
```

### Windows

Requires: Python 3.11+, pip, git

```powershell
git clone https://github.com/iblai/iblai-app-cli.git
cd iblai-app-cli
pip install -e .iblai/
```

Verify:

```powershell
iblai --version
```

If the command is not found, ensure Python Scripts is in your PATH.
It is typically at `%APPDATA%\Python\Python311\Scripts\` or
`%LOCALAPPDATA%\Programs\Python\Python311\Scripts\`.

```powershell
# Check where pip installs scripts
python -m site --user-site
# The Scripts directory is a sibling of the site-packages directory shown
```

Then return to your project:

```powershell
cd -
```

## Which Option to Use

| Method | When to use |
|--------|------------|
| `npx @iblai/cli` | Easiest, no install needed. Requires npm package to be published. |
| Build from source | Always works. Gives you the latest version from GitHub. |

If `npx @iblai/cli` returns "not found" or an error, use the build-from-source method.
