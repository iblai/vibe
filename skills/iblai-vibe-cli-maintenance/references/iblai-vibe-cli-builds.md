# iblai builds — Tauri v2 Desktop/Mobile Commands

How the `iblai builds` command group wraps `@tauri-apps/cli` with prerequisite checking and passthrough architecture.

---

## Architecture (`commands/builds.py`)

### BuildsGroup — Custom Click Group

```python
class BuildsGroup(click.Group):
    """Passes unrecognised subcommands to @tauri-apps/cli."""

    def parse_args(self, ctx, args):
        # If first arg is not a known command (init, ci-workflow),
        # stash everything for passthrough
        if args and args[0] not in self.commands and args[0] not in ("--help", "-h"):
            ctx.obj["passthrough_args"] = tuple(args)
            args = []
        return super().parse_args(ctx, args)

    def invoke(self, ctx):
        if ctx.obj.get("passthrough_args"):
            _passthrough(pt)  # checks prerequisites, runs tauri
        else:
            return super().invoke(ctx)
```

**iblai-managed commands** (handled by Click):
- `iblai builds init` — calls `AddBuildsGenerator`
- `iblai builds ci-workflow` — generates GitHub Actions workflows

**Everything else** is passed through to `@tauri-apps/cli`:
- `iblai builds dev` → `pnpm exec tauri dev`
- `iblai builds build --debug` → `pnpm exec tauri build --debug`
- `iblai builds ios init` → `pnpm exec tauri ios init`

### Exec Prefix Detection

```python
def _detect_exec_prefix() -> List[str]:
    cwd = Path.cwd()
    if (cwd / "pnpm-lock.yaml").exists():
        return ["pnpm", "exec"]
    if (cwd / "bun.lock").exists() or (cwd / "bun.lockb").exists():
        return ["bunx"]
    return ["npx"]
```

### Prerequisite Checking

Every passthrough command runs:
1. `_require_rust()` — checks `rustc` + `cargo` in PATH, prints rustup.rs install instructions if missing
2. `_require_tauri_cli()` — runs `<exec> tauri --version`, prints "run pnpm install" if missing

## AddBuildsGenerator (`generators/add_builds.py`)

### What it generates

**src-tauri/ files** (from `templates/tauri/`):
- `tauri.conf.json` — Tauri v2 config with `beforeBuildCommand`, `beforeDevCommand`, `devUrl`, `frontendDist`
- `Cargo.toml` — package name (underscores), `[[bin]]` name (hyphens), tauri deps
- `build.rs` — `tauri_build::build()`
- `src/main.rs` — desktop entry, references lib crate by package name (underscores)
- `src/lib.rs` — `pub fn run()` with `tauri::Builder`
- `capabilities/default.json` — IPC permissions, ibl.ai remote URLs
- `AppxManifest.xml` — MSIX manifest with auto-patched Publisher for signing
- `build-msix.ps1` — PowerShell MSIX build script with cert auto-matching
- `setup-test-cert.ps1` — Self-signed certificate for MSIX sideloading

**Placeholder icons** (pure Python, no PIL):
- `_create_png(width, height)` — solid blue (#3B82F6) RGB PNG via struct + zlib
- `_create_ico(png_data)` — ICO container wrapping a PNG
- `_create_icns(png_data)` — ICNS container wrapping a PNG
- Generates: 32x32, 128x128, 128x128@2x, icon.png, icon.ico, icon.icns, plus 6 MSIX icons

**Patching** (for `iblai add builds` on existing projects):
- `next.config.ts` — removes `@tauri-apps/api` stubs, adds `output: "export"`
- `package.json` — adds `@tauri-apps/api`, `@tauri-apps/cli`, tauri scripts

### CI Workflow Generation

```python
gen.generate_ci_workflows(
    desktop=True,       # macOS + Linux + Windows (NSIS/MSI)
    ios=True,           # iOS on macos-latest
    windows_msix=True,  # Windows MSIX x64 + arm64 + bundle
)
```

### Bundle Identifier Format

```
com.{{ app_name | replace('-', '.') | replace('_', '.') }}.application
```

No underscores (invalid in bundle IDs), `.application` suffix (avoids macOS `.app` conflict).

### Cargo Naming Convention

- **Package name** (crate): `{{ app_name | replace('-', '_') }}` — underscores (Rust requirement)
- **Binary name** (`[[bin]]`): `{{ app_name }}` — hyphens (user-facing)
- **main.rs reference**: `{{ crate_name }}::run()` — uses package name (underscores)
