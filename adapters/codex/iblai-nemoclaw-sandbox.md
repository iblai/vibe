# iblai-nemoclaw-sandbox

> Operating contract for an agent running inside a NemoClaw / NVIDIA OpenShell sandbox. Use when the user mentions 'nemoclaw', 'OpenShell sandbox', running commands via 'bash -ic', routing output to '/sandbox/command-logs', the 'NODE_OPTIONS preload', or the '.nemoclaw-preload.js' guard loader. It wires a single --require entry point so every Node process (node, npx, pnpm) loads the sandbox guards fail-closed, plus a nemoclaw_run helper that persists all command output to /sandbox/command-logs because sandbox stdout is not durable.

# /iblai-nemoclaw-sandbox — Operating contract inside a NemoClaw sandbox

This skill defines how an agent runs commands inside an
[NVIDIA NemoClaw](https://github.com/NVIDIA/NemoClaw) /
[OpenShell](https://github.com/NVIDIA/OpenShell) sandbox, where the
environment (NODE_OPTIONS, PATH, proxy vars) lives in `/sandbox/.bashrc`
and stdout is **not durable**. It installs two assets and three rules.

## Authorization Check

This is defensive sandbox hardening for an agent you operate. Before
installing, confirm you are configuring a sandbox you own/administer. The
guard files in `/tmp` are supplied by the NemoClaw lifecycle — this skill
only wires them in; it does not author or weaken them.

## The three rules

1. **Run every command through an interactive shell.** Use
   `bash -ic '<command>'` so `/sandbox/.bashrc` is sourced and the command
   sees `NODE_OPTIONS`, `PATH`, proxy vars, and the `nemoclaw_run` helper.
   A plain non-interactive shell does **not** source `.bashrc` and will run
   unguarded / unconfigured.
2. **Persist all output to `/sandbox/command-logs`.** Sandbox stdout does
   not survive, so never rely on it. Wrap commands with `nemoclaw_run`,
   which tees stdout+stderr to a timestamped log and prints only the log
   path and exit code. Read the log file for the actual output.
3. **Node tooling loads guards through one preload, fail-closed.**
   `NODE_OPTIONS` carries **exactly one** `--require`
   (`/sandbox/.nemoclaw-preload.js`). That module loads every guard. The
   three `*-guard` files (seccomp, network, Slack) are **fail-closed** — if
   one can't load, Node refuses to start.

## Running commands (the contract)

Canonical form the agent uses for **every** command:

```bash
bash -ic 'nemoclaw_run "<command>"'
```

It prints one line to stdout:

```
logged-to=/sandbox/command-logs/20260627T120000-12345-6789.log exit=0
```

Then read the referenced log file for the command's real output (use the
`Read` tool on that path, or `bash -ic 'nemoclaw_run "cat <log>"'`). Examples:

```bash
bash -ic 'nemoclaw_run "npx pnpm install"'
bash -ic 'nemoclaw_run "node build.js"'
bash -ic 'nemoclaw_run "pytest -q"'
```

Why `bash -ic` **and** a Node preload, not one or the other: `bash -ic`
makes interactive-shell config (incl. `NODE_OPTIONS`) reach the command,
but tools like `npx pnpm` can't consume guard logic expressed as shell —
they need it as JS that `--require` runs before the main module. The
preload is that JS, and it is the single source of truth for the guards.

## Files this skill installs

| Path | Source asset | Purpose |
|---|---|---|
| `/sandbox/.nemoclaw-preload.js` | [`assets/.nemoclaw-preload.js`](assets/.nemoclaw-preload.js) | The single `--require` module; loads all guards |
| `/sandbox/.bashrc` (appended) | [`assets/bashrc-snippet.sh`](assets/bashrc-snippet.sh) | Sets the one-require `NODE_OPTIONS` + defines `nemoclaw_run` |
| `/sandbox/command-logs/` | created on demand | Durable per-command logs (+ `nemoclaw-preload.log`) |
| `/tmp/nemoclaw-*.js` | **provided by NemoClaw** | The 6 guard/shim files the preload requires |

## The preload load policy

`NODE_OPTIONS="--require /sandbox/.nemoclaw-preload.js"` — one entry only.
pnpm / npx misbehave with multiple `--require` flags, so the preload pulls
in the guards itself with ordinary `require()` calls (those are not extra
`--require` flags):

| Order | Module (`/tmp/`) | Policy | On load failure |
|---|---|---|---|
| 1 | `nemoclaw-sandbox-safety-net.js` | best-effort | warn to log, continue |
| 2 | `nemoclaw-http-proxy-fix.js` | best-effort | warn to log, continue |
| 3 | `nemoclaw-nemotron-inference-fix.js` | best-effort | warn to log, continue |
| 4 | `nemoclaw-seccomp-guard.js` | **fail-closed** | log fatal, `exit 78` |
| 5 | `nemoclaw-ciao-network-guard.js` | **fail-closed** | log fatal, `exit 78` |
| 6 | `nemoclaw-slack-channel-guard.js` | **fail-closed** | log fatal, `exit 78` |

**Fail-closed consequence:** if a `*-guard` file is missing (e.g. `/tmp`
was cleared), **every** Node process — including `node --version` — exits
`78` until the NemoClaw lifecycle re-materializes the guards. That is the
intended behaviour: no Node runs without seccomp / network / Slack policy
active. Failures are recorded in `/sandbox/command-logs/nemoclaw-preload.log`.

## Install

Run inside the sandbox (paths assume `HOME=/sandbox`):

```bash
# 1. Place the single preload module
cp assets/.nemoclaw-preload.js /sandbox/.nemoclaw-preload.js

# 2. Wire NODE_OPTIONS + nemoclaw_run into ~/.bashrc (idempotent: skip if present)
grep -q 'nemoclaw sandbox' /sandbox/.bashrc || cat assets/bashrc-snippet.sh >> /sandbox/.bashrc

# 3. Ensure the durable log dir exists
mkdir -p /sandbox/command-logs

# 4. Confirm the guards are present (supplied by NemoClaw); without them,
#    fail-closed will (intentionally) stop Node from starting.
ls -1 /tmp/nemoclaw-*.js
```

## Verify

```bash
# A) One require only — must print a single --require
bash -ic 'echo "$NODE_OPTIONS"'

# B) Guards present -> Node runs and the helper logs
bash -ic 'nemoclaw_run "node -e \"console.log(1+1)\""'
# expect: logged-to=… exit=0   (the log contains: 2)

# C) Fail-closed -> a missing guard stops Node with exit 78
bash -ic 'NEMOCLAW_GUARD_DIR=/nonexistent node -e "process.stdout.write(\"ran\")"; echo "exit=$?"'
# expect: exit=78 and a [fatal] line in /sandbox/command-logs/nemoclaw-preload.log

# D) Best-effort -> a missing *-fix shim does NOT stop Node
#    (only the *-guard files are fail-closed)
```

## Boundaries

- **Do not add a second `--require`** to `NODE_OPTIONS`. Keep it to the one
  preload; add guards by editing the preload's module list instead.
- **Do not downgrade a `*-guard` to best-effort** to "fix" Node refusing to
  start — instead make sure the guard files exist in `/tmp`.
- **Do not bypass `nemoclaw_run`** and depend on raw stdout; it won't persist.
- The preload classifies the three `*-guard` files as fail-closed and the
  three `*-fix`/safety-net files as best-effort. If a different file becomes
  security-critical, move it into the `critical:true` set in the preload.

## References

- [NVIDIA NemoClaw](https://github.com/NVIDIA/NemoClaw) — sandboxed-agent reference stack
- [NemoClaw docs](https://docs.nvidia.com/nemoclaw/latest/) — security controls & lifecycle
- [Node `NODE_OPTIONS` / `--require`](https://nodejs.org/api/cli.html#node_optionsoptions)
- `sysexits.h` `EX_CONFIG` (78) — configuration error exit code