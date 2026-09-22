# Standing up a claw server (OpenClaw / NemoClaw gateway)

A **claw server** hosts the live agent-chat runtime the platform streams through. You
stand up a gateway (OpenClaw or NemoClaw) on a VPS, front it with Caddy for TLS, then
register it with the platform as a **claw instance** and bind agents to it.

This guide is the **server-side** deployment. The **platform/API side** — registering
the instance, storing the device keypair, pushing config, health checks, and setting
the agent's model — is the **`/iblai-api-agent-sandbox`**
skill. Do the server build here, then wire it up there.

> Source repo: [github.com/iblai/iblai-claw-setup](https://github.com/iblai/iblai-claw-setup).

## OpenClaw vs NemoClaw

| | OpenClaw | NemoClaw |
| --- | --- | --- |
| What | Vanilla gateway, runs **directly on the host** | NVIDIA's turnkey distribution of OpenClaw — the gateway runs **inside a hardened OpenShell sandbox** with an NVIDIA inference plugin pre-installed |
| CLIs | `openclaw` | `nemoclaw` (orchestrator), `openshell` (sandbox + port forwards), `openclaw` (inside the sandbox, reached via `nemoclaw <sandbox> connect`) |
| Host reach | Gateway binds loopback `127.0.0.1:18789` | An `openshell` port-forward exposes the sandbox gateway to the host at `127.0.0.1:18789` |
| Min hardware | 2 vCPU / 4 GB RAM (Hetzner CX22, ~$4/€3.49 mo) | 4+ vCPU / 8 GB RAM (16 GB rec) / 20 GB disk (40 GB rec) |
| Origin allowlist | Editable live via `openclaw config set …` | **Baked at onboard time** from `CHAT_UI_URL` — must be set before onboarding |
| Provider(s) | Anthropic, OpenAI, etc. | NVIDIA NIM, Anthropic, OpenAI, etc. |

Both are lightweight — the LLM API call is the bottleneck, not local compute (a GPU is
**not** required for NemoClaw itself, only for local NIM inference). Use a US-East
location (e.g. Hetzner **Ashburn**) for US proximity. The firewall, Caddy reverse
proxy, device-identity signing, and platform integration are **identical** across both.

## Architecture

**OpenClaw** (gateway on host):

```
Student (browser) → ibl.ai platform (Django Channels / ASGI)
     → ClawLLMRunner → OpenClawClient (WSS + Ed25519 device identity signing)
     → Caddy (on host, TLS via Let's Encrypt) → reverse proxy to localhost:18789
     → OpenClaw Gateway (systemd user service, loopback only) → LLM provider (Anthropic, …)
```

**NemoClaw** adds the sandbox boundary — an `openshell` forward sits between Caddy and
the gateway, and the gateway runs inside the sandbox in front of the NVIDIA plugin:

```
… → Caddy (host, TLS) → reverse proxy to 127.0.0.1:18789
     → openshell forward (host ↔ sandbox)
     → OpenClaw Gateway (inside OpenShell sandbox) → NVIDIA NemoClaw plugin
     → LLM provider (NVIDIA NIM, Anthropic, OpenAI, …)
```

**Why Caddy runs on the host (not in Docker):** Caddy must connect to the gateway from
`127.0.0.1` so OpenClaw's **loopback auto-approval** for device identity applies. A
Dockerized Caddy would connect over the Docker bridge (`172.x.x.x`) and be treated as a
remote connection. (For NemoClaw the `openshell` forward already crosses the sandbox
boundary; wrapping Caddy in another container would break the loopback guarantee too.)

**Why device identity signing:** on vanilla OpenClaw the gateway requires an Ed25519
device identity in the WebSocket connect handshake. Without it, connections **succeed
but the gateway grants zero scopes** — effectively unauthenticated. This is the root
cause of the `missing scope: operator.read` failure. The platform backend signs each
connect with its own Ed25519 keypair. (moltworker didn't need this on Cloudflare because
loopback connections were auto-approved; vanilla OpenClaw does.)

## Prerequisites

- **A VPS or dedicated/GPU host** — sized per the table above.
- **A domain/subdomain** pointing to the server's **actual IP** (not an elastic IP —
  see Snags).
- **An LLM provider key** (Anthropic, NVIDIA NIM, OpenAI, …).
- **Ports 80 and 443 open** on the cloud firewall **before** installing Caddy.
- **Admin access** to the platform (to register the instance — see
  `/iblai-api-agent-sandbox`).
- **NemoClaw only:** Docker (or Colima / Docker Desktop on macOS, WSL2 on Windows) and
  Node.js 22.16+ / npm 10+.

### Critical: DNS and firewall must be ready first

Let's Encrypt ACME challenges fail if DNS points to an elastic IP that isn't routing to
the server, or if port 443 isn't open. **After 5 failed attempts, Let's Encrypt
rate-limits the domain for 1 hour.** Before Caddy's first start, all three must be true:

- DNS A record → the server's **real IP** — verify: `dig your-domain.example.com +short`.
- Port **80** open inbound from `0.0.0.0/0` (for the `http-01` ACME challenge).
- Port **443** open inbound (for the `tls-alpn-01` fallback and actual HTTPS traffic).

Don't toggle firewall rules while Caddy is retrying — each failed attempt counts against
the rate limit.

---

## Part 1a — Install OpenClaw

### 1. Node.js 22

```bash
ssh root@<server-ip>
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node --version   # v22.x.x
```

### 2. Install OpenClaw

```bash
npm install -g openclaw@latest
openclaw --version
```

### 3. Generate a gateway token

```bash
export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "$OPENCLAW_GATEWAY_TOKEN"
echo "export OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN" >> ~/.bashrc
```

**Save this token** — you need it when registering the claw instance with the platform.
Persist it to `~/.bashrc` immediately: a new SSH session running `openclaw devices list`
otherwise fails with `MissingEnvVarError: Missing env var "OPENCLAW_GATEWAY_TOKEN"`.

### 4. Write the full config

Writing the full config upfront skips the interactive onboarding wizard entirely.

```bash
mkdir -p ~/.openclaw
cat > ~/.openclaw/openclaw.json << 'CONF'
{
  "meta": { "lastTouchedVersion": "<your-installed-version>" },
  "wizard": {
    "lastRunVersion": "<your-installed-version>",
    "lastRunCommand": "onboard",
    "lastRunMode": "local"
  },
  "auth": {
    "profiles": {
      "anthropic:default": { "provider": "anthropic", "mode": "api_key" }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "anthropic/claude-sonnet-4-6" },
      "workspace": "/root/.openclaw/workspace"
    }
  },
  "commands": { "native": "auto", "nativeSkills": "auto", "restart": true, "ownerDisplay": "raw" },
  "session": { "dmScope": "per-channel-peer" },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "controlUi": { "allowedOrigins": ["https://your-domain.example.com"] },
    "auth": { "mode": "token", "token": "${OPENCLAW_GATEWAY_TOKEN}" },
    "tailscale": { "mode": "off", "resetOnExit": false }
  }
}
CONF
```

- Replace `<your-installed-version>` with `openclaw --version` output (e.g. `2026.3.13`).
- Replace `your-domain.example.com` in `controlUi.allowedOrigins` with your domain.
- `agents.defaults.model.primary` — change if needed. OpenClaw normalizes date-stamped
  IDs to short aliases (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`); use the short
  alias.
- The `wizard` + `meta` fields tell OpenClaw onboarding already ran, so
  `openclaw onboard` won't re-prompt.
- `session.dmScope: "per-channel-peer"` is a multi-user security best practice — each DM
  conversation gets its own session scope.

**Optional — model fallbacks** (prevents hard failures during a provider outage;
especially recommended for multi-agent setups where error probability scales with agent
count):

```json
"model": {
  "primary": "anthropic/claude-sonnet-4-6",
  "fallbacks": ["anthropic/claude-haiku-4-5", "openai/gpt-5"]
}
```

### 5. Set the provider API key

```bash
export ANTHROPIC_API_KEY=<your-key>
echo "export ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> ~/.bashrc
```

### 6. systemd service + start

```bash
mkdir -p /root/.openclaw/workspace
loginctl enable-linger root          # so the user service survives SSH logout
openclaw gateway --port 18789 &
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/   # expect 200
```

- **`loginctl enable-linger root` is mandatory.** OpenClaw installs a **user-level**
  systemd service; without lingering it dies when the last SSH session closes (see Snag
  #11). Verify: `loginctl show-user root 2>/dev/null | grep Linger` → `Linger=yes`.
- To have the systemd service auto-created, run `openclaw onboard --install-daemon` — it
  detects the existing config ("Use existing values"), skips most prompts, and installs
  the unit at `~/.config/systemd/user/openclaw-gateway.service` (this wizard also handles
  lingering).

---

## Part 1b — Install NemoClaw (instead of OpenClaw)

NemoClaw runs the gateway inside an OpenShell sandbox. Reference:
[NemoClaw Quickstart (NVIDIA)](https://docs.nvidia.com/nemoclaw/latest/get-started/quickstart.html).

### 1. Set `CHAT_UI_URL` BEFORE onboarding

NemoClaw **bakes the Control UI origin allowlist into the sandbox image at onboard
time** (default is `http://127.0.0.1:18789` only). A browser opening the dashboard as
`https://domain.example.com` is rejected unless that origin was baked in. Setting
`CHAT_UI_URL` after onboarding has **no effect** on the live sandbox — you'd have to
rebuild. So set it first:

```bash
ssh root@<server-ip>
export CHAT_UI_URL="https://domain.example.com"
echo "export CHAT_UI_URL=$CHAT_UI_URL" >> ~/.bashrc
```

Install Docker if missing:

```bash
apt-get update && apt-get install -y docker.io
systemctl enable --now docker
```

### 2. Run the installer

```bash
curl -fsSL https://www.nvidia.com/nemoclaw.sh | bash
```

Installs Node.js (if missing), the `nemoclaw` and `openshell` CLIs, and the sandbox
image, then launches the onboarding wizard. Reload the shell after:

```bash
source ~/.bashrc
nemoclaw --version
openshell --version
```

### 3. Complete onboarding

If the installer already ran the wizard, skip. Otherwise `nemoclaw onboard`. It prompts
for:

- **Sandbox name** — used as `<sandbox-name>` in every later command. Pick something
  stable (e.g. `simon`).
- **Inference provider** — Anthropic, NVIDIA NIM, or another.
- **API key** for that provider.
- **Security policy** — accept the default `standard` unless you have a reason not to.

On completion it prints the sandbox name, primary model, and gateway port (default
`18789`) — record these.

### 4. Read the gateway token

The token comes from the sandbox's OpenClaw config:

```bash
nemoclaw <sandbox-name> connect
# inside the sandbox:
openclaw config get gateway.auth.token
exit
```

If the wizard didn't generate one, `nemoclaw <sandbox-name> rebuild --yes` picks fresh
auth settings. **Save this token** — needed for platform registration and the browser
Control UI.

### 5. Verify the sandbox is running

```bash
nemoclaw <sandbox-name> status
openshell forward list
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/   # expect 200
```

If the forward list doesn't show `18789 → sandbox:18789`, start it manually:

```bash
openshell forward start --background 127.0.0.1:18789 <sandbox-name>
```

### 6. Persist the forward across reboots

The installer wires a systemd service for the sandbox, but the openshell forward is
**not** restored automatically if the sandbox is recreated. Add a unit:

```bash
cat > /etc/systemd/system/nemoclaw-forward.service << 'EOF'
[Unit]
Description=NemoClaw openshell port forward
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=root
ExecStart=/usr/local/bin/openshell forward start --background 127.0.0.1:18789 <sandbox-name>
ExecStop=/usr/local/bin/openshell forward stop 18789 <sandbox-name>

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now nemoclaw-forward.service   # verify: systemctl status nemoclaw-forward
```

Replace `<sandbox-name>` with your actual name.

---

## Part 2 — Caddy (reverse proxy + TLS)

Caddy runs **on the host** and proxies to `localhost:18789` (the OpenClaw gateway, or
the NemoClaw openshell forward).

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

Caddyfile (replace the hostname):

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
your-domain.example.com {
    handle /api/status {
        rewrite * /
        reverse_proxy localhost:18789
    }
    reverse_proxy localhost:18789
}
EOF

systemctl restart caddy
systemctl status caddy
```

- **The `/api/status` shim** rewrites the platform's health-check path to `/` (the
  OpenClaw Control UI page), which returns `200` when the gateway is up. Neither vanilla
  OpenClaw nor NemoClaw exposes a `/api/status` route — this shim keeps compatibility
  with the platform's connectivity checks (`ClawInstance.check_health()`).
- On restart Caddy automatically obtains a Let's Encrypt cert. If it doesn't:
  `journalctl -u caddy --no-pager -n 50`.

**Control UI origin allowlist.** OpenClaw only allows connections from the gateway's own
host (localhost) by default. If the Control UI shows *"origin not allowed …"*, add the
origin (the full config in Part 1a step 4 already includes it):

```bash
openclaw config set gateway.controlUi.allowedOrigins '["https://your-domain.example.com"]'
systemctl --user restart openclaw-gateway
```

For **NemoClaw** the allowlist is baked from `CHAT_UI_URL` at onboard time — see
[NemoClaw hostname access](#nemoclaw-hostname-access) below.

---

## Part 3 — Firewall

Set these in the cloud provider's firewall console (Hetzner, AWS, …):

| Direction | Protocol | Port | Source | Purpose |
| --- | --- | --- | --- | --- |
| Inbound | TCP | 22 | Management IPs | SSH |
| Inbound | TCP | 80 | `0.0.0.0/0` | ACME challenge (Let's Encrypt) |
| Inbound | TCP | 443 | `0.0.0.0/0` or allowlist | HTTPS (Caddy → gateway) |

- **NemoClaw:** do **not** expose port `18789` on the cloud firewall — all external
  traffic goes through Caddy on 443.
- **If restricting port 443 to specific IPs**, you must include: the **platform
  server's outbound IP** (find it with `curl -s ifconfig.me` from the platform server),
  **your own IP** (for Control UI browser access), and any **VPN egress IPs** your team
  uses. A user whose IP isn't allowlisted gets `ERR_CONNECTION_TIMED_OUT`; dev containers
  can't reach the server unless on a VPN with an allowlisted IP.

Host firewall (UFW) — both layers must allow traffic to reach Caddy:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## Part 4 — Validate

**Health check:**

```bash
curl -s -o /dev/null -w "%{http_code}" https://your-domain.example.com/api/status   # expect 200
```

**Control UI:** open `https://your-domain.example.com/?token=<gateway-token>`. First
access through Caddy shows **"pairing required"** — browser devices connecting through
the reverse proxy aren't auto-approved (only loopback is). Approve the browser device:

```bash
# OpenClaw (on the host):
openclaw devices list
openclaw devices approve <requestId>

# NemoClaw (inside the sandbox):
nemoclaw <sandbox-name> connect
openclaw devices list
openclaw devices approve <requestId>
```

Each browser profile gets a unique device ID — one-time per browser. **Do not** use
`dangerouslyDisableDeviceAuth`: the docs call it a "severe security downgrade" and it
only affects the Control UI, not programmatic WebSocket connections.

**Chat test:** in the Control UI, send a test message — you should get a response from
the configured model. Full stack confirmed: Browser → Caddy (TLS/Let's Encrypt) →
[openshell forward →] OpenClaw gateway [→ NemoClaw plugin] → provider.

### NemoClaw hostname access

By default the NemoClaw gateway only accepts browser origin `http://127.0.0.1:18789`;
opening `https://domain.example.com` yields *"origin not allowed (open the Control UI
from the gateway host or allow it in gateway.controlUi.allowedOrigins)"*. The fix is to
set `CHAT_UI_URL` **before** `nemoclaw onboard` (Part 1b) so the installer bakes that
origin in. If you already onboarded without it, rebuild (preserves state, re-bakes the
image parts):

```bash
export CHAT_UI_URL="https://domain.example.com"
echo "export CHAT_UI_URL=$CHAT_UI_URL" >> ~/.bashrc
nemoclaw <sandbox-name> rebuild --yes
```

Verify:

```bash
nemoclaw <sandbox-name> connect
openclaw config get gateway.controlUi.allowedOrigins   # should include https://domain.example.com
exit
```

**Diagnostics inside the sandbox:** run `nemoclaw <sandbox-name> connect` and use
`openclaw` / `openclaw config get` interactively. There is **no** `openshell exec
<sandbox> -- <cmd>` form. `/sandbox/.openclaw/openclaw.json` is root-owned and read-only
by design — never edit it directly; flow all config through `CHAT_UI_URL` +
`nemoclaw onboard` / `rebuild`.

---

## Part 5 — Connect to the platform

Register the instance and push config through the platform API —
**`/iblai-api-agent-sandbox`** documents the
endpoints (`POST claw/instances/`, `PATCH …/connection_params`, `push-config/`,
`health-check/`, model selection). The steps below give the server-side details those
endpoints need.

### 5.1 Register the claw instance

Via the API (preferred — see the sandbox skill), or directly in the DM Django admin →
**Claw instances → Add**:

| Field | Value |
| --- | --- |
| Platform | your org |
| Name | `<domain>-<provider>-<purpose>` — e.g. `prod-hetzner-primary`, `staging-hetzner-demo` |
| Server URL | `https://your-domain.example.com` |
| Gateway token | the token from Part 1a step 3 (or the NemoClaw token from 1b step 4) |
| Auth headers | `{}` |
| Status | `active` |

Run the **Health check** action → should return `healthy`.

### 5.2 Generate and store the device keypair

The platform backend needs an Ed25519 keypair for device-identity signing — without it,
config push fails with `missing scope: operator.read/write/admin`. Generate one:

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat

key = Ed25519PrivateKey.generate()
pem = key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode()
print(pem)
```

Store the private key, one of two ways:

- **Option A — per-server (recommended for single servers):** put it in the instance's
  `connection_params` JSON (via the sandbox-skill `PATCH …/connection_params`, or the
  Django admin record):

  ```json
  { "device_identity": { "private_key_pem": "-----BEGIN PRIVATE KEY-----\n<base64>\n-----END PRIVATE KEY-----\n" } }
  ```

- **Option B — global (recommended for multi-server):** set
  `OPENCLAW_DEVICE_PRIVATE_KEY_PEM` in the platform server's environment / Django
  settings. This is the fallback used when a server record has no key in its metadata.

**How it works.** `OpenClawClient.connect()` receives a `connect.challenge` from the
gateway, signs it with the Ed25519 key using the **`v2` payload format** —
`v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce` — and includes the
`device` object in the connect params. Fresh keypairs are auto-approved **on loopback**
(no manual `openclaw devices approve` for backend connections). Each connect signs fresh
(no session-token caching). The `v2` prefix is **required** — all signatures fail without
it. (This format was reverse-engineered from compiled gateway source —
`client-Bri_7bSd.js:693`, `gateway-cli-CHQJpgpN.js:19700-19760` — no official docs exist.)

### 5.3 Push config

Push via the API (`push-config/` in the sandbox skill), the Django admin **"Push
config"** action, or the shell:

```bash
docker exec web bash -c "cd /code/dl_manager && python manage.py shell -c \"
from ibl_ai_mentor.tasks import push_claw_config
push_claw_config.delay()
\""
```

A successful push sets `agents.files.set` (IDENTITY.md, SOUL.md), `config.get`, and
`config.patch` — the gateway restarts itself after `config.patch`. Verify in logs/Sentry
that it completed **without** `missing scope` errors.

For **NemoClaw**, pushed config applies to the OpenClaw instance **inside the sandbox**.
Inspect the effective config with `nemoclaw <sandbox-name> connect` + `openclaw config
get` — the host's `~/.openclaw/openclaw.json` is **not** the live config.

### 5.4 Test chat through the platform

1. Open the agent in any ibl.ai app (Agent AI, Skills AI, …).
2. Select the claw-backed agent.
3. Send a test message (e.g. "Hello, say hi in 5 words").
4. Verify: a "Connected." acknowledgment appears; the response streams token-by-token;
   it completes (EOS received); and it **persists on page refresh** (chat history saved).

Full production path: WebSocket connect → Django Channels consumer → `validate_session`
→ `authenticate` → `llm_runner_factory()` → `ClawLLMRunner` → `build_client_kwargs()` →
`OpenClawClient.connect()` (device signing) → `chat_stream()` → `_save_chat_history()` →
disconnect.

---

## Multi-agent setup (optional)

The default config creates a single agent (`main`). Add more on the same gateway:

```bash
openclaw agents add tutor-agent
openclaw agents add course-creator-agent
```

Each agent gets its own workspace (`~/.openclaw/workspace-<name>`) and agent directory
(`~/.openclaw/agents/<name>/agent`), and appears in `agents.list` in `openclaw.json`
(you can also edit the config directly). More agents = more concurrent LLM calls = higher
chance of provider rate limits/outages — consider model fallbacks (Part 1a step 4).

## Keeping the gateway updated

**OpenClaw:**

```bash
openclaw --version
openclaw update
systemctl --user restart openclaw-gateway
```

The gateway logs a notice on startup when an update is available.

**NemoClaw:**

```bash
nemoclaw --version
nemoclaw update
nemoclaw <sandbox-name> restart
```

Avoid `npm update -g openclaw` directly on NemoClaw — it manages the OpenClaw version
inside the sandbox, and a mismatched manual upgrade can desync the plugin.

**Caution:** updates may **wipe the paired devices list**, requiring re-pairing (see
below). Sandbox recreation on NemoClaw also **resets the openshell forward** — re-run the
`nemoclaw-forward.service` and re-approve the platform's device. Back up `~/.openclaw/`
before major upgrades.

## Monitoring and diagnostics

Tail logs (separate SSH sessions):

```bash
# OpenClaw gateway:
journalctl --user -u openclaw-gateway -f
# NemoClaw gateway:
nemoclaw <sandbox-name> logs --follow
openshell forward list
# Caddy (both):
journalctl -u caddy -f
```

Gateway log patterns:

| Pattern | Meaning |
| --- | --- |
| `protocol 3` | WebSocket handshake succeeded |
| `chat.send` | Chat request sent to the LLM provider |
| `error` / `ECONNREFUSED` | Provider API call failed (key issue, rate limit, outage) |
| `close 4008` | WebSocket proxy issue (should not happen on a plain VPS — was a moltworker/Cloudflare bug) |
| `missing scope` | Device-identity signing not working — check the keypair config |

Quick health checks (no restart needed):

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/          # gateway alive → 200
openclaw health --json                                                   # structured status (inside sandbox for NemoClaw)
openclaw devices list                                                    # connected devices
curl -s -o /dev/null -w "%{http_code}" https://your-domain.example.com/api/status   # Caddy+TLS → 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
  https://api.anthropic.com/v1/models                                    # provider key valid → 200
df -h / && free -h                                                       # disk / memory
```

Verbose logging (not for live use — remember to set back to `info`):

```bash
openclaw config set OPENCLAW_LOG_LEVEL debug
systemctl --user restart openclaw-gateway
# openclaw config set OPENCLAW_LOG_LEVEL info
```

NemoClaw sandbox TUI: `openshell term <sandbox-name>`, or `openclaw tui` from inside the
sandbox.

---

## Device re-pairing after gateway restarts / updates

### The problem

OpenClaw gateway updates (`npm install -g openclaw@latest`) or restarts — and NemoClaw
sandbox recreation — can **wipe the paired devices list**. The platform backend's device
identity is then no longer recognized, and **all agents** on that server fail with
`PAIRING_REQUIRED` / `NOT_PAIRED`. Users see *"The agent is starting up, please wait…"* →
*"The agent is currently unavailable. Please try again later."* This affects **all
agents** on the server (device identity is per claw instance, not per agent) — one
re-pairing fixes them all.

### Re-pair manually

1. **Trigger a connection attempt** — send any message to any agent linked to the
   affected server. This creates a pending pairing request on the gateway.
2. **SSH in and approve** (inside the sandbox for NemoClaw):

   ```bash
   openclaw devices list                 # look for the "Pending" section
   openclaw devices approve <requestId>  # use the requestId, NOT the device ID
   ```

3. **Retry the chat** — the next message connects. All agents on the server are fixed.

### Why loopback auto-approval doesn't cover this

The design intent: Caddy on the same host proxies to `localhost:18789`, so connections
arrive from `127.0.0.1` and auto-approve. But **Caddy adds `X-Forwarded-For` with the
remote client's IP**, and OpenClaw uses that to determine the "real" client IP. Since the
platform backend connects from a remote server, OpenClaw sees a non-loopback IP and
requires manual approval.

### Solution options (for a robust, non-fragile fix — directions to evaluate)

**A. OpenClaw upstream (preferred if feasible)**

- **A1. Persist paired devices across restarts and upgrades** — store them in
  `~/.openclaw/devices.json` (or equivalent), always load on startup, and migrate the
  file on schema change rather than discarding it. Fixes the root cause for all
  deployments; no platform/proxy changes. Requires OpenClaw to implement/fix
  persistence. *Action: check the OpenClaw issue tracker; file a feature/bug report if
  persistence is missing or broken.*
- **A2. Config-based trusted device registration** — a config list of pre-approved
  device IDs or public keys (e.g. `gateway.trustedDevices` / `gateway.trustedDevicePublicKeys`).
  Connections presenting a valid signature for a trusted device skip the pending-approval
  flow. Survives restarts/updates because it lives in config; the platform can store the
  public key at deploy time or via config push. Requires OpenClaw to add the feature.
- **A3. Admin API for device approval** — an authenticated endpoint (e.g.
  `POST /api/admin/devices/approve`) taking a pending `requestId` or a device public key +
  scopes, protected by the gateway token or a separate admin secret. Lets the platform
  automate re-pairing: on `NOT_PAIRED`, trigger a connect to create a pending request,
  then call the admin API to approve. Requires OpenClaw to add and maintain it.

**B. Platform-side automation (the ibl.ai backend)**

- **B1. Health check detects `NOT_PAIRED` and alerts** — a "deep" check does a full
  WebSocket connect (not just HTTP status); on `NOT_PAIRED`, set a distinct server state
  (e.g. `needs_pairing`) and notify admins (email, Sentry, dashboard). Fast detection; no
  silent outage — but doesn't fix the problem by itself.
- **B2. Admin action "Trigger re-pair"** — a Django admin action on `ClawInstance` that
  (1) triggers a one-off connect from the platform to create a pending request, and (2)
  shows the `requestId` so an admin runs `openclaw devices approve <requestId>` on the
  server. Single place to start the flow; still manual approval unless combined with A3.
- **B3. Fully automated re-pair via an agent on the OpenClaw host** — a small
  service/cron on the server that lists pending devices, identifies the platform's device
  (by ID stored in config/env), and approves it; the platform triggers it on `NOT_PAIRED`.
  No manual step after detection — but needs a secure channel to the host and maintenance.

**C. Infrastructure / deployment**

- **C1. Backup and restore `devices.json`** — back it up before an update and restore
  after the new gateway starts. Works with current behavior, no upstream changes — but
  fragile if the file format changes, and needs discipline in every update runbook.
- **C2. External persistence (e.g. R2 / S3)** — persist device state to an external
  store (like moltworker), for a single source of truth surviving restarts/redeploys.
  Depends on OpenClaw supporting it; more infra.

**D. Reverse-proxy behavior (Caddy)**

- **D1. Strip forwarded headers so OpenClaw sees loopback** — strip `X-Forwarded-For` and
  `X-Real-Ip` on the reverse proxy so the gateway sees `127.0.0.1` and auto-approves.
  No OpenClaw/platform code changes; self-healing after any restart/update. Tradeoff:
  OpenClaw no longer sees the real client IP, and it relies on the loopback logic staying
  stable and secure.

**Recommendation.** Pursue **A1** and/or **A2** upstream so pairing survives restarts and
updates by design (**A3** is a strong complement for automating re-pair without a host
agent). Short term, until an upstream/config solution exists, use **manual re-pair** plus
**B1** (detect and alert on `NOT_PAIRED`) to cut silent outage and make re-pairing a clear
operational step.

### Device identity scope

- Device identity is per **claw instance** (stored in
  `connection_params.device_identity.private_key_pem`).
- All agents linked to the same server share the same device.
- One re-pairing approval covers all agents on that server.
- Each server with a different keypair needs its own pairing.

---

## Snags reference

### OpenClaw

| # | Issue | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | Let's Encrypt ACME challenges fail | DNS pointed to an elastic IP not routing to the server; port 443 not open | Point DNS to the real server IP; open ports 80+443 before Caddy starts |
| 2 | Let's Encrypt rate limit (1 hour) | 5 failed ACME attempts | Wait for cooldown; don't toggle the firewall while Caddy retries |
| 3 | Control UI "origin not allowed" | OpenClaw only allows localhost origins by default | `openclaw config set gateway.controlUi.allowedOrigins '["https://…"]'` |
| 4 | Control UI "pairing required" | Browser device not auto-approved through the reverse proxy | `openclaw devices approve <requestId>` (one-time per browser) |
| 5 | Browser `ERR_CONNECTION_TIMED_OUT` | Cloud firewall restricting port 443; user IP not in the allowlist | Add the IP to the cloud firewall allowlist |
| 6 | `OPENCLAW_GATEWAY_TOKEN` not found in new SSH sessions | Token only exported in the original shell | Add `export OPENCLAW_GATEWAY_TOKEN=…` to `~/.bashrc` |
| 7 | Config push "missing scope: operator.read" | `OpenClawClient` omitted device identity from the connect handshake | Implement Ed25519 device signing (Part 5.2) |
| 8 | Dev container can't reach the server | Cloud firewall restricts port 443; dev IP not allowlisted | Connect via VPN with an allowlisted IP, or broaden the rule |
| 9 | Model ID mismatch | OpenClaw normalizes `claude-sonnet-4-20250514` → `claude-sonnet-4-6` | Use the short alias in agent config |
| 10 | `NOT_PAIRED` after gateway update | Update/restart wiped paired devices; Caddy forwards `X-Forwarded-For` so auto-approval fails | Manual re-pair (above); long-term see solution options |
| 11 | Gateway dies when the SSH session ends (healthy while SSH'd in, silently dies after disconnect) | `loginctl enable-linger root` skipped — systemd kills user services when the last session closes | Run `loginctl enable-linger root` (Part 1a step 6); verify `loginctl show-user root … \| grep Linger` = `Linger=yes` |

### NemoClaw

| # | Issue | Root cause | Fix |
| --- | --- | --- | --- |
| 1 | `origin not allowed …` | `CHAT_UI_URL` not exported before `nemoclaw onboard`; sandbox baked with the default allowlist only | Export `CHAT_UI_URL` and rebuild: `nemoclaw <sandbox> rebuild --yes` |
| 2 | `curl http://127.0.0.1:18789/` → connection refused | openshell forward not running (common after a sandbox recreate) | `openshell forward start --background 127.0.0.1:18789 <sandbox-name>` |
| 3 | Forward lost after reboot | systemd unit for the forward not installed | Install `nemoclaw-forward.service` (Part 1b step 6) |
| 4 | Host `~/.openclaw/openclaw.json` edits have no effect | That file is on the host; the live config is inside the sandbox (and read-only) | Inspect with `nemoclaw <sandbox> connect` + `openclaw config get`; change origins by re-exporting `CHAT_UI_URL` and `nemoclaw <sandbox> rebuild --yes` |
| 5 | `missing scope: operator.read` on config push | Device-identity signing not wired up (same as OpenClaw) | Provision the Ed25519 keypair (Part 5.2) |
| 6 | `NOT_PAIRED` after `nemoclaw update` | Sandbox recreated, paired devices wiped | Re-pair (above) |
| 7 | Let's Encrypt ACME fails on Caddy startup | DNS / firewall not ready | See Part 3 and the "DNS and firewall first" note |
