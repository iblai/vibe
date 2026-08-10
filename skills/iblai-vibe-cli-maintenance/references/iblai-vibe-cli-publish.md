# Publishing Releases — GitHub, npm, PyPI

How the release and publish workflows distribute the CLI.

---

## Release Flow Overview

```
1. Bump version in source files
2. Commit and tag: git tag v0.2.0
3. Push tag: git push origin v0.2.0
4. CI runs automatically:
   ├── build-binaries.yml — builds 5 platform binaries
   ├── release.yml — creates GitHub release with binaries
   └── publish-pypi.yml — publishes to PyPI
5. npm publish (manual):
   └── Trigger publish-npm.yml via workflow_dispatch with run_id
```

## Workflows

### `build-binaries.yml`

- **Triggers**: `v*` tag push, `workflow_dispatch`, `workflow_call`
- **Builds**: 5 PyInstaller binaries (linux-x64, linux-arm64, darwin-arm64, win32-x64, win32-arm64)
- **Uploads**: Each binary as a GitHub Actions artifact (`iblai-{target}`)
- **Scripts**: `.iblai/scripts/build-binary.sh` (Unix), `.iblai/scripts/build-binary.ps1` (Windows)

### `release.yml`

- **Triggers**: `v*` tag push
- **Calls**: `build-binaries.yml` (reusable workflow)
- **Creates**: GitHub Release via `softprops/action-gh-release@v2`
- **Assets**: 5 binaries renamed as `iblai-{target}` / `iblai-{target}.exe`
- **Also calls**: `publish-pypi.yml` (automatic)

### `publish-pypi.yml`

- **Triggers**: `workflow_call` (from release.yml) or `workflow_dispatch`
- **Builds**: `python -m build` (sdist + wheel)
- **Verifies**: `twine check dist/*`
- **Publishes**: `twine upload dist/*` with `PYPI_TOKEN` secret

### `publish-npm.yml`

- **Triggers**: `workflow_dispatch` only (manual)
- **Input**: `run_id` — the Build Binaries workflow run to download artifacts from
- **Checkout**: `release` branch (not `main` — avoids intermediate versions)
- **Downloads**: All 5 binary artifacts into `.iblai/npm/cli-{target}/bin/`
- **Publishes**: 6 npm packages in order:
  1. `@iblai/cli-linux-x64`
  2. `@iblai/cli-linux-arm64`
  3. `@iblai/cli-darwin-arm64`
  4. `@iblai/cli-win32-x64`
  5. `@iblai/cli-win32-arm64`
  6. `@iblai/cli` (wrapper — depends on platform packages)

## Version Locations

When bumping version, update these files:

| File | Field |
|------|-------|
| `pyproject.toml` | `version = "0.2.0"` |
| `.iblai/iblai/__init__.py` | `__version__ = "0.2.0"` |
| `.iblai/npm/cli/package.json` | `"version": "0.2.0"` |
| `.iblai/npm/cli-linux-x64/package.json` | `"version": "0.2.0"` |
| `.iblai/npm/cli-linux-arm64/package.json` | `"version": "0.2.0"` |
| `.iblai/npm/cli-darwin-arm64/package.json` | `"version": "0.2.0"` |
| `.iblai/npm/cli-win32-x64/package.json` | `"version": "0.2.0"` |
| `.iblai/npm/cli-win32-arm64/package.json` | `"version": "0.2.0"` |
| `.iblai/npm/cli/package.json` `optionalDependencies` | Each platform version |

## npm Package Structure

```
@iblai/cli                    # Wrapper — bin/iblai.js launcher
├── optionalDependencies:
│   ├── @iblai/cli-linux-x64
│   ├── @iblai/cli-linux-arm64
│   ├── @iblai/cli-darwin-arm64
│   ├── @iblai/cli-win32-x64
│   └── @iblai/cli-win32-arm64
└── bin/iblai.js              # Resolves platform package, execFileSync the binary
```

Each platform package has `os` and `cpu` fields so npm only installs the matching one:
```json
{ "os": ["linux"], "cpu": ["x64"] }
```

## Required Secrets

| Secret | Used by | Purpose |
|--------|---------|---------|
| `PYPI_TOKEN` | `publish-pypi.yml` | PyPI API token |
| `NPM_TOKEN` | `publish-npm.yml` | npm registry token |

## The `release` Branch

npm publish checks out the `release` branch — not `main`. This prevents publishing intermediate commits. The flow is:

1. Develop on feature branches, merge to `main`
2. When ready to release: merge `main` → `release`
3. Tag on `release`: `git tag v0.2.0 && git push origin v0.2.0`
4. CI creates GitHub release + publishes to PyPI
5. Manually trigger npm publish via workflow_dispatch
