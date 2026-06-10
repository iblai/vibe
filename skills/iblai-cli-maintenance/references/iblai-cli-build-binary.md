# Building the CLI as a Standalone Binary

How to build `iblai` as a single-file executable using PyInstaller.

---

## Quick Build

```bash
# Current platform
make binary

# Or directly
./.iblai/scripts/build-binary.sh          # Linux / macOS
pwsh .iblai/scripts/build-binary.ps1      # Windows

# Skip venv creation (CI)
IBLAI_VENV=0 bash .iblai/scripts/build-binary.sh
```

Output: `dist/iblai` (or `dist/iblai.exe` on Windows).

## Build Script Internals

### `.iblai/scripts/build-binary.sh`

```bash
pyinstaller \
  --onefile \
  --name iblai \
  --add-data ".iblai/iblai/templates:iblai/templates" \  # : separator on Unix
  --hidden-import=iblai \
  --hidden-import=iblai.config \
  --hidden-import=iblai.commands \
  --hidden-import=iblai.commands.startapp \
  --hidden-import=iblai.commands.add \
  --hidden-import=iblai.commands.builds \
  --hidden-import=iblai.generators \
  --hidden-import=iblai.generators.base \
  --hidden-import=iblai.generators.base_app \
  --hidden-import=iblai.generators.agent \
  --hidden-import=iblai.generators.add_auth \
  --hidden-import=iblai.generators.add_chat \
  --hidden-import=iblai.generators.add_profile \
  --hidden-import=iblai.generators.add_notifications \
  --hidden-import=iblai.generators.add_mcp \
  --hidden-import=iblai.generators.add_builds \
  --hidden-import=iblai.ai_helper \
  --hidden-import=iblai.project_detector \
  --hidden-import=iblai.package_manager \
  --hidden-import=iblai.next_config_patcher \
  --copy-metadata readchar \
  --copy-metadata rich \
  --copy-metadata inquirer \
  .iblai/iblai/cli.py
```

### Key flags

| Flag | Purpose |
|------|---------|
| `--onefile` | Single executable (not a directory) |
| `--add-data "src:dst"` | Bundle Jinja2 templates into the binary. `:` on Unix, `;` on Windows |
| `--hidden-import` | PyInstaller can't discover dynamic imports (Click lazy loading). Every submodule must be listed explicitly. |
| `--copy-metadata` | Some packages (rich, inquirer, readchar) check their own metadata at runtime |

### Template Directory Resolution (`generators/base.py`)

```python
if hasattr(sys, "_MEIPASS"):
    # PyInstaller frozen binary — templates are in the temp extraction dir
    self.template_dir = Path(sys._MEIPASS) / "iblai" / "templates"
else:
    # Development mode — templates are in the source tree
    self.template_dir = Path(__file__).parent.parent / "templates"
```

## Platform Matrix (5 targets)

| Target | GitHub Actions Runner | Notes |
|--------|----------------------|-------|
| `linux-x64` | `ubuntu-22.04` | |
| `linux-arm64` | `ubuntu-22.04-arm` | Native ARM runner |
| `darwin-arm64` | `macos-14` | Apple Silicon |
| `win32-x64` | `windows-latest` | Uses `build-binary.ps1` |
| `win32-arm64` | `windows-11-arm` | Native ARM runner |

## Adding a New Platform

1. Add matrix entry in `.github/workflows/build-binaries.yml`
2. Create `.iblai/npm/cli-{target}/package.json` with correct `os` and `cpu`
3. Create `.iblai/npm/cli-{target}/bin/.gitkeep`
4. Add to `.iblai/npm/cli/package.json` `optionalDependencies`
5. Add to `.iblai/npm/cli/bin/iblai.js` `PLATFORMS` map
6. Add to `.gitignore` (binary exclusion)
7. Add to `.github/workflows/release.yml` (copy + upload asset)
8. Add to `.github/workflows/publish-npm.yml` (download + publish)
9. Update `.iblai/tests/test_distribution.py`: `PLATFORM_DIRS`, `EXPECTED_OS_CPU`, expected workflow targets

## Adding a New Module

When you create a new Python module that's imported by the CLI, you must add it to the `--hidden-import` list in **both** build scripts:

1. `.iblai/scripts/build-binary.sh` — add `--hidden-import=iblai.new_module`
2. `.iblai/scripts/build-binary.ps1` — add `--hidden-import=iblai.new_module`

If you forget, the binary will crash with `ModuleNotFoundError` at runtime.

## Build Dependencies

See `docs/build-deps-*.md` for per-platform dependencies:
- `docs/build-deps-archlinux.md`
- `docs/build-deps-fedora.md`
- `docs/build-deps-ubuntu.md`
- `docs/build-deps-windows.md`
- `docs/build-deps-macos.md`
