# Jinja2 Template System

How the template system works in iblai-app-cli.

---

## Directory Layout

```
.iblai/iblai/templates/
├── base/                   # Base template files (non-agent)
│   ├── package.json.j2
│   ├── next.config.ts.j2
│   ├── .env.example.j2
│   ├── providers/index.tsx.j2
│   ├── store/index.ts.j2
│   ├── lib/config.ts.j2
│   ├── lib/iblai/auth-utils.ts.j2
│   ├── lib/iblai/config.ts.j2
│   ├── components/ui/button.tsx.j2
│   ├── components/ui/sonner.tsx.j2
│   └── app/(app)/{layout,page}.tsx.j2
├── agent/                  # Agent-specific overrides (4 files)
│   ├── package.json.j2
│   ├── components.json.j2
│   ├── lib/config.ts.j2
│   ├── .env.example.j2
│   └── app/(app)/page.tsx.j2
├── shared/                 # Shared between base and agent
│   ├── CLAUDE.md.j2
│   ├── .mcp.json.j2
│   ├── .gitignore.j2
│   ├── eslint.config.mjs.j2
│   ├── tsconfig.json.j2
│   ├── tailwind.config.ts.j2
│   ├── postcss.config.ts.j2
│   ├── components.json.j2
│   ├── declarations.d.ts          # static (not template)
│   ├── app/layout.tsx.j2
│   ├── app/globals.css             # static
│   ├── app/(auth)/sso-login-complete/page.tsx.j2
│   ├── components/app-shell.tsx.j2
│   ├── hooks/use-user.ts.j2
│   ├── lib/utils.ts.j2
│   ├── lib/hooks.ts.j2
│   ├── providers/store-provider.tsx.j2
│   ├── public/env.js.j2
│   └── e2e/...                     # Playwright config + tests
├── add/                    # Used by `iblai add` generators
│   ├── auth/               # 7 template files
│   ├── chat/               # 1 template
│   ├── profile/            # 1 template
│   └── notifications/      # 1 template
├── tauri/                  # Used by AddBuildsGenerator
│   ├── src-tauri/          # tauri.conf.json.j2, Cargo.toml.j2, etc.
│   └── workflows/          # CI workflow templates
├── skills/                 # 13 Claude skill .md files + .png screenshots
└── opencode-skills/        # 13 OpenCode skill directories (SKILL.md + .png)
```

## FileSystemLoader Search Order

Each generator has its own Jinja2 `Environment` with specific search paths:

**BaseAppGenerator** (base_app.py):
```python
FileSystemLoader([
    templates/base/,      # base-specific files
    templates/shared/,    # shared files
    templates/add/,       # add command templates (fallback)
])
```

**AgentAppGenerator** (agent.py):
```python
# First: calls super().generate() which uses BaseAppGenerator's loader

# Then: overlays with agent-specific loader:
FileSystemLoader([
    templates/agent/,     # agent overrides (highest priority)
    templates/base/,      # base fallback
    templates/shared/,    # shared fallback
    templates/add/,       # add templates fallback
])
```

When a template name like `package.json.j2` is requested, Jinja2 searches directories in order and uses the **first match**. This is how agent overrides work — `agent/package.json.j2` takes priority over `base/package.json.j2`.

## Jinja2 Settings

```python
Environment(
    loader=FileSystemLoader([...]),
    trim_blocks=True,      # Remove newline after block tags
    lstrip_blocks=True,    # Strip leading whitespace before block tags
)
```

These settings mean `{% if tauri %}` doesn't leave blank lines in the output.

## Context Variables

Templates receive a context dict from `get_context()`:

```python
# BaseAppGenerator.get_context()
{
    "app_name": "my-app",
    "platform_key": "acme",
    "tauri": True,
}

# AgentAppGenerator.get_context() adds:
{
    "mentor_id": "abc-123",
    "has_mentor_id": True,
}
```

### Using in templates

```jinja
{{ app_name }}                          {# string interpolation #}
{% if tauri %}                          {# conditional block #}
  output: "export",
{% endif %}
{% if has_mentor_id %}                  {# agent-only content #}
  NEXT_PUBLIC_DEFAULT_AGENT_ID={{ mentor_id }}
{% endif %}
{{ app_name | replace('-', '_') }}      {# Jinja2 filter #}
```

### `{% raw %}` blocks

For templates that contain literal `{{ }}` syntax (like GitHub Actions workflow templates that use `${{ github.ref }}`):

```jinja
{% raw %}
  ${{ matrix.os }}
{% endraw %}
```

## Rendering and Writing

```python
# BaseAppGenerator methods:

def _render(self, template_path: str) -> str:
    """Render a template with the current context."""
    return self.env.get_template(template_path).render(self.get_context())

def _write(self, rel_path: str, content: str) -> None:
    """Write rendered content to the output directory."""
    path = self.output_dir / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

def _copy_static(self, template_path: str, output_rel: str) -> None:
    """Copy a non-template file (e.g., globals.css) as-is."""
    # Searches base/ then shared/ for the source file
```

## Adding a New Template File

1. **Create the `.j2` file** in the appropriate directory:
   - `templates/shared/` — if used by both base and agent
   - `templates/base/` — if base-only
   - `templates/agent/` — if agent-only (overrides base)

2. **Add to the generator's `generate()` method**:
   ```python
   self._write("path/to/output.tsx", self._render("path/to/template.tsx.j2"))
   ```

3. **Add context variables** if the template needs new data:
   - Add to `BaseGenerator.__init__()` to store the value
   - Add to `get_context()` to pass it to templates

4. **Add a test** that verifies the file exists after generation:
   ```python
   def test_generates_new_file(self, generated_dir):
       assert (generated_dir / "path/to/output.tsx").exists()
   ```

## Skills and Screenshots

Skills are **not** rendered as Jinja2 templates — they are **copied as-is**:

```python
# In BaseAppGenerator.generate():
# Copy ALL files from templates/skills/ (both .md and .png)
for f in skills_src.iterdir():
    shutil.copy2(f, skills_dest / f.name)
```

OpenCode skills follow the same pattern but with a directory-per-skill structure:
```
templates/opencode-skills/
├── iblai-setup/
│   └── SKILL.md
├── iblai-add-profile-page/
│   ├── SKILL.md
│   └── profile-page.png
```
