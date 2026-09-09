---
name: iblai-api-infrastructure
description: Deploy and self-host the ibl.ai platform infrastructure — AWS single/multi-server architecture, the golden-AMI staging launch pipeline, the iblai-infra-cli (Terraform + Ansible) provisioner, edX LMS SSO identity providers (Google/Microsoft/Apple/OpenID Connect), and standing up OpenClaw/NemoClaw agent-sandbox gateway servers. This is the ops/self-hosting reference (how the platform is deployed on infrastructure you control), not api.iblai.app REST calls. For the API side of claw instances, see /iblai-api-agent-sandbox.
metadata:
  kind: guide
---

# iblai-api-infrastructure

How the ibl.ai platform is **deployed and self-hosted** on infrastructure you control:
the AWS topology, the tooling that provisions it, the SSO wiring for the edX LMS, and
the agent-sandbox (claw) gateway servers that back live agent chat.

Unlike the other `iblai-api-*` skills, this one is **not** a REST reference — it doesn't
call `api.iblai.app`, and it needs no `IBLAI_ORG` / `IBLAI_API_KEY`. It documents server
provisioning, `ssh` / CLI / Terraform / Ansible workflows, and provider consoles. Access
to the ibl.ai Docker images and platform codebase requires a license — see
[ibl.ai/contact](https://ibl.ai/contact).

## When to use

- **Standing up the platform** on your own AWS account (or an existing server / bare
  metal) — start with [`references/infra-cli.md`](references/infra-cli.md), and see
  [`references/aws-architecture.md`](references/aws-architecture.md) for the resulting
  topology.
- **Launching or rebuilding staging environments** from pre-baked AMIs via CI —
  [`references/ami-pipeline.md`](references/ami-pipeline.md).
- **Adding Single Sign-On** (Google, Microsoft/Entra, Apple, or a generic OIDC provider)
  to the Open edX LMS — [`references/edx-sso.md`](references/edx-sso.md).
- **Deploying an agent-sandbox gateway** (OpenClaw on a VPS/Hetzner, or NVIDIA NemoClaw)
  and connecting it to the platform — [`references/claw-servers.md`](references/claw-servers.md).

For the **API side** — registering a claw instance, storing its device keypair, pushing
config, health checks, and setting an agent's model — use `/iblai-api-agent-sandbox`.
Deploy the server here, then wire it up there.

## Scope note

These guides reference server-level and provider-level surfaces (SSH, systemd, cloud
firewall consoles, the LMS Django admin) because that is the actual deployment mechanism
— this is the ops complement to the endpoint-focused REST skills, not a UI walkthrough of
`api.iblai.app`.

## Reference material

Everything is in `references/` — pick the file for the job. Each is self-contained enough
to deploy from:

- **[`references/aws-architecture.md`](references/aws-architecture.md)** — single-server
  and multi-server AWS topology (VPC, subnets, ALB, EC2, ACM certs and their exact
  subdomains, S3 buckets, security groups), the provision → Terraform → Ansible flow, and
  the 9 Ansible roles with their full container inventory.
- **[`references/infra-cli.md`](references/infra-cli.md)** — the `iblai-infra-cli`
  provisioner: prerequisites, install (uv/pip), `provision` / `setup` / `list` / `status`
  / `auth` / `destroy` commands, the 9 setup roles, what Terraform + Ansible create,
  authentication, and the `~/.iblai-infra` workspace.
- **[`references/ami-pipeline.md`](references/ami-pipeline.md)** — the GitHub Actions
  golden-AMI launch pipeline for `stg1`–`stg4`: permanent vs ephemeral infra, AMI
  contents, the 6 pipeline steps (incl. the 14-step Ansible service-update), timing,
  repo map, secrets/variables, the IAM policy, known cold-boot behaviors, and how to bake
  a new AMI.
- **[`references/edx-sso.md`](references/edx-sso.md)** — adding SSO IdPs to the edX LMS:
  the deployment-config vs Django-admin layers, the plugin gate, per-provider setup
  (Google, Microsoft, Apple's signed-JWT secret, generic OIDC with full claim/endpoint
  config), running multiple OIDC providers, org linking via `TRACKED_PROVIDERS` /
  `platform_key`, apply/restart, verification, and troubleshooting.
- **[`references/claw-servers.md`](references/claw-servers.md)** — deploying an
  OpenClaw or NemoClaw gateway end to end: architecture, prerequisites, install, the
  full `openclaw.json` config, Caddy + Let's Encrypt, firewall (cloud + UFW), validation,
  Ed25519 device-identity signing, connecting to the platform, multi-agent setups,
  updates, monitoring, the device re-pairing problem with its full solution catalog, and
  the OpenClaw + NemoClaw snags tables.
