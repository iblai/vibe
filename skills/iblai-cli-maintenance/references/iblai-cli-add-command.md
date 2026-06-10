# iblai add — Integrating Features into Existing Projects

How the `iblai add` command group detects projects and generates feature files.

---

## Command Structure (`commands/add.py`)

```python
@click.group()
def add():
    """Add ibl.ai features to an existing Next.js project."""

@add.command()
def auth(): ...       # SSO authentication (7 files)

@add.command()
def chat(): ...       # AI chat widget (<mentor-ai>)

@add.command()
def profile(): ...    # User profile dropdown

@add.command()
def notifications(): ... # Notification bell

@add.command()
def mcp(): ...        # MCP server config + 13 Claude/OpenCode skills

@add.command()
def tauri(): ...      # Tauri v2 desktop shell
```

All subcommands call `_require_nextjs()` first, which uses the project detector.

## Project Detector (`project_detector.py`)

```python
project = detect_project(".")
# Returns NextJsProject or None

# NextJsProject has:
project.root          # Path — project root
project.framework     # "nextjs"
project.has_src_dir   # bool — src/ directory layout
project.app_dir       # Path — app/ or src/app/
project.lib_dir       # Path — lib/ or src/lib/
project.components_dir # Path — components/ or src/components/
project.has_typescript # bool
project.has_redux     # bool
project.has_iblai_sdk # bool — @iblai/iblai-js in deps
```

## Add Generator Pattern

Each `add_*.py` generator follows the same pattern:

```python
class AddAuthGenerator:
    def __init__(self, project: NextJsProject):
        self.project = project
        self.root = project.root

    def generate(self) -> List[str]:
        created = []

        # 1. Render Jinja2 templates from templates/add/auth/
        # 2. Write files to project (lib/iblai/, components/iblai/, etc.)
        # 3. Return list of created file paths

        return created
```

After generation, the command:
1. Installs dependencies via `package_manager.py`
2. Patches `next.config.ts` via `next_config_patcher.py`
3. Patches `globals.css` (SDK styles import)
4. Patches `.env.local` (environment variables)
5. Patches Redux store (add API slices)
6. Prints success panel with next steps

## Package Manager Detection (`package_manager.py`)

```python
from iblai.package_manager import detect_package_manager, install_packages

pm = detect_package_manager(".")  # returns "pnpm", "yarn", "npm", or "bun"
install_packages(".", ["@iblai/iblai-js", "@reduxjs/toolkit"])
```

Detection order: `pnpm-lock.yaml` → `yarn.lock` → `bun.lock`/`bun.lockb` → `package-lock.json` → fallback `npm`.

## Next Config Patcher (`next_config_patcher.py`)

Regex-based patching for existing `next.config.ts` (or `.ts`):

```python
from iblai.next_config_patcher import (
    find_next_config,          # locate next.config.{mjs,ts,js}
    patch_webpack_alias,       # add resolve.alias entries
    patch_globals_css,         # add @import for SDK styles
    patch_env_local,           # add env vars to .env.local
    patch_store,               # add reducers/middleware to Redux store
    patch_next_config_for_tauri,  # remove Tauri stubs, add output: "export"
)
```

Each function is **idempotent** — checks for markers before patching.

## Adding a New `iblai add <feature>` Subcommand

1. **Create generator** at `.iblai/iblai/generators/add_newfeature.py`:
   ```python
   class AddNewFeatureGenerator:
       def __init__(self, project):
           self.project = project
       def generate(self) -> List[str]:
           # render templates, write files
           return ["components/iblai/new-feature.tsx", ...]
   ```

2. **Create templates** at `.iblai/iblai/templates/add/newfeature/`:
   - `component.tsx.j2`, etc.

3. **Add command** to `commands/add.py`:
   ```python
   @add.command()
   def newfeature():
       """Add new feature to your Next.js project."""
       project = _require_nextjs()
       gen = AddNewFeatureGenerator(project)
       created = gen.generate()
       # install deps, patch config, print success
   ```

4. **Add tests** to `.iblai/tests/test_add_generators.py`

5. **Update skill count** in `.iblai/tests/test_add_generators.py` and `.iblai/tests/test_base_app_generator.py` if adding a skill

6. **Update CLAUDE.md template** (`templates/shared/CLAUDE.md.j2`) skills table
