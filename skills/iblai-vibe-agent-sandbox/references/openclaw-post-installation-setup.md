# OpenClaw post-installation setup

Once an OpenClaw agent is running, wire this repo's skills and operating
instructions into its workspace:

- **Install skills** — load this repo's skills into the OpenClaw agent
  (`openclaw skills install` over the workspace `skills/`). See
  [`openclaw-install.md`](openclaw-install.md).
- **Swap the workspace `AGENTS.md`** — every ibl.ai OpenClaw agent setup must
  use the canonical operating instructions at
  [`../assets/openclaw/AGENTS.md`](../assets/openclaw/AGENTS.md) as its root
  `AGENTS.md` (copy step in [`openclaw-install.md`](openclaw-install.md)). Point
  setups at this file rather than forking a divergent copy.
