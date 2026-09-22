# Installing skills + AGENTS.md into an OpenClaw agent

How to load this repo's skills into an [OpenClaw](https://openclaw.ai) agent
and swap in a custom `AGENTS.md`, from bash. For the sandbox hardening that
wraps the agent's Node runtime, see [`nemoclaw-sandbox.md`](nemoclaw-sandbox.md).

## Workspace layout

An OpenClaw agent reads a **workspace** — default `~/.openclaw/workspace`,
overridable via `agents.defaults.workspace` in `~/.openclaw/openclaw.json`
(multi-agent setups get one workspace each, e.g. `~/.openclaw/workspace-<name>`):

```
<workspace>/
├── AGENTS.md          # prompt files injected into the system prompt
├── SOUL.md            #   (AGENTS.md · SOUL.md · TOOLS.md)
├── TOOLS.md
└── skills/
    └── <skill>/SKILL.md
```

Skill **load order**, highest precedence first: `<workspace>/skills` →
`<workspace>/.agents/skills` → `~/.agents/skills` → `~/.openclaw/skills`
(shared / managed) → bundled → `skills.load.extraDirs`. A skill's name and
slash command come from its `SKILL.md` `name:` frontmatter (else the dir name).

## Install a whole directory of skills

`openclaw skills install <source>` installs **one** skill (with `SKILL.md` at
the source root) into the active workspace `skills/`. To install every skill
in this repo, clone it and loop over the skill directories:

```bash
git clone https://github.com/iblai/vibe.git
cd vibe

# one skill
openclaw skills install ./skills/iblai-vibe-agent-chat

# every skill in the directory
for d in skills/*/; do
  openclaw skills install "$d"
done
```

- `--global` installs into the shared `~/.openclaw/skills` (visible to every
  local agent) instead of a single workspace.
- `--as <slug>` overrides the slug (otherwise the `name:` frontmatter wins).
- From [ClawHub](https://clawhub.ai): `openclaw skills install @owner/<slug>`.
  The `git:owner/repo@ref` form expects a single skill with `SKILL.md` at the
  repo root, so it does **not** work for this multi-skill repo — use the loop.
- Update later: `openclaw skills update --all` (add `--global` for shared skills).

**No-CLI alternative** — `"nativeSkills": "auto"` auto-discovers workspace
skills, so you can also just copy them in:

```bash
cp -a skills/. ~/.openclaw/workspace/skills/
```

### Inside a NemoClaw sandbox

The workspace lives inside the sandbox. Run the same command through the
`nemoclaw` wrapper (or drop in and run it interactively):

```bash
nemoclaw <sandbox> exec --no-tty -- openclaw skills install ./skills/<name>
# interactive:
nemoclaw <sandbox> connect
```

## Replace the default AGENTS.md

`AGENTS.md` is a workspace prompt file OpenClaw injects into the system prompt
— there is no dedicated subcommand, you just replace the file at the workspace
root. This skill ships a canonical one at
[`../assets/openclaw/AGENTS.md`](../assets/openclaw/AGENTS.md):

```bash
# host / vanilla OpenClaw
cp assets/openclaw/AGENTS.md ~/.openclaw/workspace/AGENTS.md

# NemoClaw: write it into the sandbox workspace
nemoclaw <sandbox> connect        # then, inside: cp <file> ~/.openclaw/workspace/AGENTS.md
```

Point setups at this bundled `AGENTS.md` rather than forking a divergent copy;
when a durable workspace rule changes, update `assets/openclaw/AGENTS.md` here
so every setup inherits it.
