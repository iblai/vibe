# iblai-api-agent-sandbox — Claw integration concepts

Doc-sourced concepts, architecture, response shapes, and walkthroughs complementing the
verified endpoints in **`/iblai-api-agent-sandbox`**. See the skill's **Reads** / **Writes**
for the canonical endpoint list; this file is the explanatory material behind them.

> Source: the platform-integration guide from [github.com/iblai/iblai-claw-setup](https://github.com/iblai/iblai-claw-setup).

## What "connecting" gives you

A **Claw** instance is a sandboxed agent workspace (an OpenClaw / IronClaw / NemoClaw
server you run) that the platform drives over REST. Once connected, the instance is
reachable from **all ibl.ai applications** — Agent AI chat, Skills AI, and any custom
REST integration — because it is driven by the same platform API that powers the UI.
You register the server, bind agents to it, configure each agent's identity and skills,
and push configuration; the platform pushes config, agent identities, skills, and model
providers **from the platform to your server**.

**Connecting a self-hosted server** uses the open-source **`iblai-claw-setup`** tooling
([github.com/iblai/iblai-claw-setup](https://github.com/iblai/iblai-claw-setup)) — it handles
the configuration and authentication that integrate a local claw deployment with the platform's
cloud services (clone it and follow its README). The endpoints in this skill are the **platform
side** of that link; standing up the box itself is **server-provisioning** (see **Not covered
here** for the `/iblai-api-infrastructure` pointer).

## Paths, auth, and endpoint mapping

- **Host / prefix / auth (normalized for this repo):** every call in this guide goes to
  `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/…` with header
  `Authorization: Api-Token $IBLAI_API_KEY`. `{org}` is your **org key** (`$IBLAI_ORG`).
- The upstream guide writes these as `https://platform.ibl.ai/api/ai-agent/orgs/<org>/…`
  with `Authorization: Token …`. The `/api/ai-agent/…` base is an **accept-only alias**
  for the `/dm` **mentor** app — the same routes. Use the `/dm/api/ai-mentor` form.
- Responses are JSON. List endpoints are org-scoped under `/orgs/{org}/` and paginate
  with `limit` + `offset`.
- **Two similarly-named resources** in the upstream guide map to this skill's clearer names:

  | Upstream guide route | This skill's endpoint | Resource |
  |---|---|---|
  | `claw/agent-configs/` (has `agent` in body, integer id) | `mentors/{mentor}/claw-config/` | agent↔instance **binding** |
  | `agent-configs/<id>/` (integer id) | `mentors/{mentor}/agent-config/` | agent **workspace** config |
  | `agent-skills/`, `agent-skill-resources/`, `agent-skill-assignments/` | see **`/iblai-api-agent-skill`** | skills CRUD |

  Prefer this skill's mentor-scoped endpoints. Skills CRUD is **not** duplicated here —
  it lives in `/iblai-api-agent-skill`; this file only covers how skills fit the push flow.

## Integration flow (end to end)

```
1. Register instance     POST  claw/instances/
2. Test connectivity     POST  claw/instances/{id}/test-connectivity/
3. Add model providers   POST  claw/model-providers/
4. Push providers        POST  claw/instances/{id}/push-providers/
5. Bind agent            POST  mentors/{mentor}/claw-config/         (guide: claw/agent-configs/)
6. Configure agent       PATCH mentors/{mentor}/agent-config/        (guide: agent-configs/{id}/)
7. Create skills         POST  agent-skills/ + agent-skill-resources/  → /iblai-api-agent-skill
8. Assign skills         POST  agent-skill-assignments/                → /iblai-api-agent-skill
9. Push config           POST  mentors/{mentor}/claw-config/push-config/ (guide: claw/agent-configs/{id}/push-config/)
```

## Part 1 — register the server

### Register the instance

`POST …/orgs/{org}/claw/instances/`

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name for this instance. |
| `claw_type` | string | Instance type — e.g. `openclaw` (also `ironclaw`, `nemoclaw`). |
| `server_url` | string | HTTPS URL of your claw server. |
| `gateway_token` | string | **Write-only.** The gateway token from server setup. |
| `auth_headers` | object | **Write-only.** Optional proxy auth headers (`{"string": "string"}` pairs). |
| `connection_params` | object | **Write-only.** Variant-specific auth (e.g. OpenClaw device identity — below). |

**Device identity (required for OpenClaw).** The platform needs an Ed25519 keypair for
device-identity signing. Without it, config push fails with **`missing scope: operator.read`**.
Generate a keypair and include it in `connection_params`:

```json
{ "device_identity": { "private_key_pem": "-----BEGIN PRIVATE KEY-----\n<base64>\n-----END PRIVATE KEY-----\n" } }
```

Save the `id` from the response — later steps need it. Response (201 Created):

```json
{
  "id": 1,
  "name": "My OpenClaw Instance",
  "claw_type": "openclaw",
  "provision_mode": "self_hosted",
  "server_url": "https://your-domain.example.com",
  "deployment_backend": null,
  "status": "active",
  "deploy_state": "ready",
  "platform_key": "your-org",
  "last_health_check": null,
  "last_health_status": null,
  "claw_version": null,
  "created_at": "2026-03-18T10:00:00Z",
  "updated_at": "2026-03-18T10:00:00Z"
}
```

The write-only fields (`gateway_token`, `auth_headers`, `connection_params`) are **never**
returned in responses.

- **Instance `status` values:** `active`, `inactive`, `error`.
- **`deploy_state` values:** `pending`, `deploying`, `ready`, `teardown`, `failed`.

### Test connectivity

`POST …/claw/instances/{id}/test-connectivity/` → 200:

```json
{
  "checks": [
    {"name": "tls_reachable", "passed": true, "detail": "200 OK"},
    {"name": "health_check", "passed": true, "detail": "healthy"}
  ],
  "all_passed": true
}
```

- If `tls_reachable` fails: check your domain DNS and reverse-proxy (Caddy) config.
- If `health_check` fails: check the OpenClaw gateway is running
  (`systemctl --user status openclaw-gateway` on the server).

### Other instance operations

| Endpoint | Method | Description |
|---|---|---|
| `claw/instances/` | GET | List instances. Filters: `status`, `search`. |
| `claw/instances/{id}/` | GET | Retrieve instance details. |
| `claw/instances/{id}/` | PATCH | Update (writable: `name`, `claw_type`, `server_url`, `gateway_token`, `auth_headers`, `connection_params`, `deployment_backend`). |
| `claw/instances/{id}/` | DELETE | Delete instance. |
| `claw/instances/{id}/health-check/` | POST | Run health check; updates `last_health_check` / `last_health_status`. |
| `claw/instances/{id}/push-providers/` | POST | Push all enabled model providers to the instance. |
| `claw/instances/{id}/security-audit/` | POST | Run security audit (OpenClaw only). |
| `claw/instances/{id}/refresh-version/` | POST | Detect `claw_version` from the instance handshake. |

## Part 2 — configure and call from the platform

Once registered, everything is managed through the platform API, so every ibl.ai app can
use the instance. Configuration, agent identities, skills, and model providers are all
pushed from the platform to your server.

### Set up a model provider (optional)

To use a different LLM provider (e.g. OpenRouter) instead of the default Anthropic:

`POST …/orgs/{org}/claw/model-providers/`

```json
{
  "server": 1,
  "name": "openrouter",
  "base_url": "https://openrouter.ai/api/v1",
  "api_type": "openai-completions",
  "credential_name": "openrouter",
  "credential_key": "key",
  "model_catalog": [
    {"id": "anthropic/claude-sonnet-4-6", "name": "Claude Sonnet"},
    {"id": "meta-llama/llama-3.2-3b-instruct:free", "name": "Llama 3.2 (free)"}
  ],
  "enabled": true,
  "models_mode": "merge"
}
```

| Field | Type | Description |
|---|---|---|
| `server` | integer | Claw instance ID. |
| `name` | string | Provider name. |
| `base_url` | string | Provider API base URL. |
| `api_type` | string | `openai-completions`, `anthropic-messages`, or a provider-specific type. |
| `credential_name` | string | References an LLMCredential **by name** on the platform. |
| `credential_key` | string | JSON key **within** the credential value that holds the API key. |
| `model_catalog` | array | `{"id": "model-id", "name": "display name"}` entries. |
| `models_mode` | string | `merge` (adds to built-in models) or `replace` (only configured providers). |

Then push: `POST …/claw/instances/{id}/push-providers/` → 202 `{"queued": true, "message": "Provider push queued."}`.
The `credential_resolved` field in provider responses indicates whether an LLMCredential
with the given `credential_name` actually exists on the platform.

### Bind an agent to the instance

`POST …/orgs/{org}/mentors/{mentor}/claw-config/` (upstream: `claw/agent-configs/` with an
`agent` field). Binding **auto-creates** an agent config if one doesn't exist. Response
(201 Created):

```json
{
  "id": 1,
  "agent": "6f29a5eb-c657-4a76-8a19-4ea58175d008",
  "server": 1,
  "server_name": "My OpenClaw Instance",
  "agent_config": {},
  "enabled": true,
  "auto_push": false,
  "last_config_push": null,
  "last_config_push_status": null,
  "last_push_warnings": []
}
```

Set `auto_push: true` on the binding to push automatically whenever the config changes;
otherwise push explicitly (below).

### Configure the agent + push

Workspace files and the instance-config patch live on `mentors/{mentor}/agent-config/` —
see **[`workspace-files.md`](workspace-files.md)** for the full field→file map, the
`config` patch, and the blocked-path deny-list.

**Push config:** `POST …/mentors/{mentor}/claw-config/push-config/` → 202
`{"queued": true, "message": "Config push queued."}`. A successful push **sets the
workspace files** (IDENTITY.md, SOUL.md, …) and **applies config patches** on the
instance. **The gateway restarts itself after a config patch.**

### Device pairing

The first time the platform pushes config, the instance may require **device-pairing
approval**. Two sides:

- **Platform side:** `POST …/claw/instances/{id}/request-pairing/` queues a pending
  pairing request (it expires in ~5 minutes).
- **Server side:** approve it on the box —
  ```bash
  openclaw devices list
  openclaw devices approve <requestId>
  ```

Done **once per platform connection**. If pairing is lost after a claw update, re-pair the
same way (see the upstream server-setup "Device Re-Pairing" section).

## Prebuilt agent configs (`iblai/claws`)

You don't have to author every workspace file from scratch. **`claws`**
([github.com/iblai/claws](https://github.com/iblai/claws), open source) is a curated library of
**ready-to-deploy agent configurations organized by industry vertical** — each pre-set with
appropriate **system prompts, tool selections, and behavioral parameters** for its vertical.
These map onto the `agent-config` workspace fields this skill pushes: system prompts →
`identity` / `soul`, tool selections → `tools` + skill assignments, behavioral parameters →
`config`. Prebuilt configs target **OpenClaw** instances.

```bash
git clone https://github.com/iblai/claws.git
cd claws   # browse the verticals directory, pick an agent for your use case
```

Deploy a chosen agent to your OpenClaw instance — e.g. adapt its files into a
`PATCH mentors/{mentor}/agent-config/` and `push-config` (see the walkthrough below).

## Skills in the push flow

Skills are reusable capabilities assigned to agents; when config is pushed, **enabled skill
assignments are sent to the instance as `skills.entries`**. Shape of the pieces
(**full CRUD lives in `/iblai-api-agent-skill`** — not repeated here):

- **Skill** — `name`, unique `slug`, `instruction` (the SKILL.md body / agent runbook),
  `metadata` (SKILL.md frontmatter: requirements, env vars), `enabled`.
- **Resources** — attached files by `file_type`: `script` and `reference` carry text in a
  `content` field; `asset` is a binary uploaded as a multipart `file` field.
- **Assignments** — bind `agent` ↔ `skill` with `enabled`. An agent can be assigned to the
  same skill only once. Only **enabled** assignments are pushed on config push.

## Complete walkthrough (register → chat)

Normalized to `Api-Token` + `/dm/api/ai-mentor`; `$MENTOR` is the agent's unique id.

```bash
# 1. Register the instance — save the returned integer "id" (e.g. 1)
curl -X POST "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/claw/instances/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Production OpenClaw","claw_type":"openclaw","server_url":"https://claw.mycompany.com","gateway_token":"abc123..."}'

# 2. Test connectivity — both checks should pass
curl -X POST "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/claw/instances/1/test-connectivity/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"

# 3. Bind the agent to instance 1
curl -X POST "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/mentors/$MENTOR/claw-config/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" -H "Content-Type: application/json" \
  -d '{"server":1,"enabled":true}'

# 4. Configure the agent (workspace files + config patch)
curl -X PATCH "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/mentors/$MENTOR/agent-config/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "identity":"Name: Study Buddy\nVibe: Friendly and patient tutor",
    "soul":"Always encourage the student. Never give answers directly. Be concise.",
    "model":"anthropic/claude-sonnet-4-6",
    "config":{"heartbeat":{"every":"30m"},"session":{"dmScope":"per-channel-peer"}}
  }'

# 5. Push config → {"queued": true, "message": "Config push queued."}
curl -X POST "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/mentors/$MENTOR/claw-config/push-config/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"

# 6. Approve device pairing (first time only) — on the claw server
ssh root@claw.mycompany.com
openclaw devices list
openclaw devices approve <requestId>

# 7. Chat — open the agent in any ibl.ai app and send a message.
#    Responses stream from your instance through the platform to the user.
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Config push fails: `missing scope: operator.read` | OpenClaw instance registered without a device-identity keypair. Add an Ed25519 key under `connection_params.device_identity` (PATCH the instance) and retry. |
| `test-connectivity` → `tls_reachable` fails | Domain DNS or reverse-proxy (Caddy) misconfigured for `server_url`. |
| `test-connectivity` → `health_check` fails | Gateway not running: `systemctl --user status openclaw-gateway` on the server. |
| Push fails with a pairing error | Approve the pending device on the server (`openclaw devices approve <id>`); pending requests expire in ~5 min. Once per platform connection. |
| Pairing lost after a claw update | Re-pair (upstream server-setup "Device Re-Pairing"). |

## Not covered here

The **VPS provisioning runbook** (installing claw on a server, Caddy/systemd, generating
the gateway token and device keypair) is **server-provisioning** material — captured by
**`/iblai-api-infrastructure`** (upstream: the **server-setup** guide in
[github.com/iblai/iblai-claw-setup](https://github.com/iblai/iblai-claw-setup)) — not part of
this platform-API skill. This file only covers the server-side commands the platform flow
references (`openclaw devices …`, `systemctl … openclaw-gateway`).
