# AWS architecture — single-server and multi-server

How a self-hosted ibl.ai platform is laid out on AWS. Two supported topologies:
**single-server** (everything on one EC2 box — the default the infra CLI provisions)
and **multi-server** (app nodes split from data nodes, with DB replicas). Both are
stood up by [`iblai-infra-cli`](infra-cli.md) — Terraform builds the AWS resources,
Ansible installs the platform.

> Source repo: [github.com/iblai/iblai-infra-cli](https://github.com/iblai/iblai-infra-cli).
> The diagrams in the source docs render as Mermaid on GitHub; the same facts are
> captured as tables/lists below. To regenerate an image from a Mermaid source:
> `npx @mermaid-js/mermaid-cli -i architecture.md -o architecture.png`.

## Single-server topology

Request path: **Internet → Route53 → ALB → EC2 (Docker) → LLM/S3**.

| Layer | Detail |
| --- | --- |
| **Route53** | One hosted zone, **19 subdomain A-records** pointing at the ALB. |
| **VPC** | `10.0.0.0/16`. |
| **Public subnet 1 (AZ-a)** | Application Load Balancer: HTTP `:80` → HTTPS redirect; HTTPS `:443` → target group; TLS 1.2+ policy. |
| **Public subnet 2 (AZ-b)** | Second ALB node (ALB spans two AZs). |
| **EC2** | `t3.2xlarge`, Ubuntu 22.04, 50 GB gp3 encrypted root volume. Runs all containers. |
| **S3** | Three buckets: Backups, DM Media, DM Static (**public read**). EC2 reads/writes S3. |

**Security groups**

- **ALB SG** — HTTP/HTTPS inbound from `0.0.0.0/0`.
- **EC2 SG** — SSH from the VPN IP only; HTTP from the ALB SG only.

**ACM certificates** (two certs, both terminated at the ALB):

- **Cert 1** covers: `api.data`, `learn`, `studio.learn`, `apps.learn`,
  `preview.learn`, `asgi.data`, `llm.data`, `agent.data`, `api`, `web.data`,
  `base.manager`.
- **Cert 2** covers: `auth`, `mentorai`, `skillsai`, `monitor`, `flowise`,
  `platform`, `prometheus`, `studio.learn`, `meilisearch.learn`.

## Multi-server topology

Same edge (Route53 → ALB, HTTPS `:443` TLS 1.2+, two certs, same three S3 buckets),
but compute is split into **application nodes** and **data nodes**, each its own EC2
box in the `10.0.0.0/16` VPC. The ALB load-balances across the app nodes.

| Node | Contents |
| --- | --- |
| **App node 1** (EC2, Ubuntu 22.04) | Docker: reverse proxy, `iblai-edx-pro` (LMS + CMS + workers), `iblai-dm-pro` (Web + ASGI + Celery), `iblai-web-frontend` (Auth + Agent + Skills). |
| **App node 2** (EC2, Ubuntu 22.04) | Identical stack — the ALB fans requests across both. |
| **Data node 1** (EC2) | MySQL **primary**, PostgreSQL **primary**, Redis, MongoDB, Elasticsearch. |
| **Data node 2** (EC2) | MySQL **replica**, PostgreSQL **replica**, Redis **replica** (replicated from data node 1). |

App nodes talk to data node 1; data node 1 replicates to data node 2. App nodes
read/write S3.

**Security groups (multi-server)**

- **ALB SG** — public HTTP/HTTPS.
- **App SG** — HTTP from the ALB SG; SSH from the VPN.
- **Data SG** — database ports from the App SG **only** (data nodes are never
  exposed to the ALB or the internet).

## Provisioning & setup flow

The infra CLI runs the whole build in three phases (see [`infra-cli.md`](infra-cli.md)
for the commands):

1. **CLI wizard** (`iblai infra provision`): AWS credentials → project & compute
   config → network & SSH → domain & certificates → review & confirm.
2. **Terraform** (AWS infrastructure), in order: VPC + subnets → security groups →
   EC2 → Application Load Balancer → S3 buckets → ACM certificates → Route53 DNS
   records → HTTPS listener.
3. **Ansible** (platform setup): setup prompts → SSH verify → Ansible runner → the
   9-role playbook below.

## The 9 Ansible roles and their containers

The setup playbook runs 9 sequential roles. This is the authoritative container
inventory for a node (richer than the single-server diagram, which simplifies it):

| Role | Purpose | Containers launched |
| --- | --- | --- |
| 1. Docker Engine | Install Docker + compose | — |
| 2. AWS CLI Setup | Install AWS CLI v2 (ECR + S3) | — |
| 3. Python Virtual Env | pyenv + Python 3.11.8 | — |
| 4. iblai-cli-ops | Clone + install the ops CLI (private repo) | — |
| 5. Platform Config | Base config + proxy | Reverse Proxy |
| 6. iblai-dm-pro | Data Manager service | Web Server, ASGI Server, Celery Worker, Celery Beat, PostgreSQL, Redis |
| 7. iblai-edx-pro | Open edX service | LMS, CMS, LMS Worker, CMS Worker, MySQL, Redis, MongoDB, Elasticsearch, Forum, Notes, Meilisearch, Caddy, SMTP Relay, Permissions |
| 8. iblai-web-frontend | The SPAs | Auth SPA, Agent SPA, Skills SPA |
| 9. Final Steps | Auth wiring | OAuth2 Server, OIDC Provider |

See [`infra-cli.md`](infra-cli.md) for exactly what each role configures and the
full "what gets created" breakdown, and [`ami-pipeline.md`](ami-pipeline.md) for the
AMI-baked variant used in staging.
