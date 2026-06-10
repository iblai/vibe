# iblai startapp — Command and Generator System

How the `iblai startapp` command scaffolds new ibl.ai applications.

---

## CLI Command (`commands/startapp.py`)

Click command with these options:

```python
@click.command()
@click.argument("template", type=click.Choice(["agent"]))
@click.option("--platform", "-p", envvar="IBLAI_PLATFORM_KEY")
@click.option("--agent", "-a", envvar="IBLAI_AGENT_ID")
@click.option("--app-name", envvar="IBLAI_APP_NAME")
@click.option("--output", "-o", default=".", envvar="IBLAI_OUTPUT_DIR")
@click.option("--openai-key", envvar="OPENAI_API_KEY")
@click.option("--anthropic-key", envvar="ANTHROPIC_API_KEY")
@click.option("--ai-provider", type=Choice(["openai", "anthropic"]))
@click.option("--ai-model", envvar="IBLAI_AI_MODEL")
@click.option("--ai-temperature", type=float)
@click.option("--ai-max-tokens", type=int)
@click.option("--prompt", "-P", envvar="IBLAI_PROMPT")
@click.option("--env-file", type=Path)
@click.option("--stage", envvar="DEV_STAGE")
@click.option("--builds", is_flag=True, default=False)
```

### Interactive Prompt Flow

When values are not provided via flags/env:

1. Platform key (Text prompt, required)
2. Agent ID (Text prompt, required for agent template)
3. App name (Text prompt, default: `{platform}-agent-app`)
4. Tauri support (Confirm prompt, default: No)

Prompts are skipped when `--app-name` is provided (non-interactive mode).

### Configuration Priority

```
CLI flags > System env vars > .env.{DEV_STAGE} > .env > interactive prompts
```

`load_config()` in `config.py` loads `.env` files into `os.environ` before Click parses options.

## Generator Hierarchy

```
BaseGenerator (generators/base.py)
  - __init__: app_name, platform_key, output_dir, mentor_id, AI params, tauri
  - render_template(name, **extra_context): Jinja2 rendering
  - get_context(): {app_name, platform_key, mentor_id, has_mentor_id, tauri}
  - write_file(), copy_file(), create_directory_structure()
  - template_dir: resolves to iblai/templates/ (or sys._MEIPASS for PyInstaller)
  │
  └── BaseAppGenerator (generators/base_app.py)
        - Own Jinja2 Environment: FileSystemLoader [base/, shared/, add/]
        - get_context(): {app_name, platform_key, tauri}  # no mentor_id
        - generate(): creates ~28 files (providers, store, components, e2e, skills)
        - _render(template_path), _write(rel_path, content), _copy_static()
        │
        └── AgentAppGenerator (generators/agent.py)
              - generate(): calls super().generate(), then overlays 4 files
              - get_context(): adds mentor_id, has_mentor_id to super's context
              - Own agent_env: FileSystemLoader [agent/, base/, shared/, add/]
              - Overlaid files: page.tsx, config.ts, .env.example, package.json
              - ENHANCEABLE_FILES: files that --prompt AI can modify
```

## How startapp Routes to Generators

```python
# In startapp() function:
if template.lower() == "agent":
    generator = AgentAppGenerator(
        app_name=app_name,
        platform_key=platform,
        mentor_id=agent,
        output_dir=str(output_path),
        use_ai=use_ai,
        ai_provider=ai_provider,
        # ... AI params ...
        tauri=tauri,
    )
    generator.generate()

    if prompt and generator.ai_helper:
        generator.enhance_with_prompt()

    if tauri:
        from iblai.generators.add_builds import AddBuildsGenerator
        tauri_gen = AddBuildsGenerator(project_root=str(output_path), app_name=app_name)
        tauri_gen.generate()
```

## Adding a New Template Type

1. Create `iblai/generators/new_type.py`:
   ```python
   class NewTypeGenerator(BaseAppGenerator):
       def get_context(self):
           ctx = super().get_context()
           ctx["custom_var"] = self.some_value
           return ctx

       def generate(self):
           super().generate()  # generates base app
           # overlay custom files
           self._write("app/(app)/page.tsx", self._render("custom-page.tsx.j2"))
   ```

2. Create `iblai/templates/new_type/` directory with override templates

3. Add to `startapp.py`:
   - Import the generator
   - Add to `click.Choice(["agent", "new_type"])`
   - Add `elif template.lower() == "new_type":` block

4. Add tests in `tests/test_generators.py`

## Adding a New CLI Option

1. Add `@click.option("--new-opt", envvar="IBLAI_NEW_OPT")` decorator
2. Add parameter to the `startapp()` function signature
3. Pass to generator constructor: `new_opt=new_opt`
4. Add to `BaseGenerator.__init__()` if it affects template rendering
5. Add to `get_context()` if templates need it
6. Update `.env.example` template with the new env var
7. Add test for the new option
