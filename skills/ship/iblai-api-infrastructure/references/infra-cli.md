# iblai-infra-cli — provision & configure the platform

`iblai-infra-cli` is the interactive CLI that **deploys the ibl.ai platform on your
own infrastructure**. It does end-to-end AWS infrastructure creation with **Terraform**
plus full application setup with **Ansible** — and it can also bootstrap an existing
server on any cloud or bare metal, no Terraform involved.

- **Repo:** [github.com/iblai/iblai-infra-cli](https://github.com/iblai/iblai-infra-cli)
- **Stack:** Python 3.11+ · Terraform · Ansible · proprietary license.
- **Who it's for:** platform engineers doing self-hosted or sovereign deployments.
  Access to the ibl.ai Docker images and platform codebase requires a license — see
  [ibl.ai/contact](https://ibl.ai/contact).

In the five-repo family this is the **deployment layer**: it stands up the backend
that the `iblai-api-*` skills operate headlessly over REST,
[`iblai/vibe`](https://github.com/iblai/vibe) builds apps on, and
[`iblai/os`](https://github.com/iblai/os) + [`iblai/lms`](https://github.com/iblai/lms)
ship as complete sample apps.

## Prerequisites

- **Python 3.11+**.
- **[uv](https://docs.astral.sh/uv/)** (recommended) or pip.
- **[Terraform](https://developer.hashicorp.com/terraform/install)** installed and on
  PATH (called as a subprocess — install it separately).
- **AWS account** with EC2, ELB, S3, ACM, Route53, IAM, and STS permissions.
- **SSH access** to the target EC2 (key generated or provided during provisioning).

Installed automatically as Python deps: **ansible-core** (≥ 2.15, used by
`iblai infra setup`) and **boto3**.

## Install

Using uv (recommended):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # if you don't have uv
git clone https://github.com/iblai/iblai-infra-cli.git
cd iblai-infra-cli
uv venv
source .venv/bin/activate
uv pip install .
```

Using pip: `pip install .`

Verify the install and its toolchain:

```bash
iblai --version
ansible-playbook --version
terraform --version
```

Run `iblai infra` any time to see all commands and a getting-started guide.

## 1. Check IAM permissions

Before provisioning, verify your AWS credentials:

```bash
iblai infra permissions            # print the required IAM policy JSON
iblai infra permissions --check    # dry-run verification against active credentials
```

## 2. Provision infrastructure

```bash
iblai infra provision
```

An interactive wizard walks through: **AWS credentials** (profile, access keys, or
environment variables) → **project & compute** (name, environment, instance type,
volume size) → **network & SSH** (VPC CIDR, VPN IP, key setup) → **domain &
certificates** (base domain, Route53, ACM/upload/none) → a full review before it
applies. Terraform then runs with real-time progress, showing each resource as it's
created. (See [`aws-architecture.md`](aws-architecture.md) for the resulting topology.)

## 3. Set up the platform

```bash
iblai infra setup            # set up an EXISTING server (any provider, bare metal)
iblai infra setup <name>     # set up a Terraform-provisioned environment by name
```

Both paths run the **same Ansible playbook**. With a project name, inputs (IP, domain,
SSH key, AWS credentials) auto-populate from Terraform state; without one, the CLI
prompts interactively — **no Terraform required**. The setup wizard prompts for the
target host IP + SSH key path, base domain + environment, Docker image tags per
service, whether to enable AI features, an optional OpenAI API key, super-admin
credentials, and the GitHub PAT + AWS credentials for the VM.

The playbook runs **9 sequential roles**:

| Role | What it does |
| --- | --- |
| `docker` | Installs Docker Engine, docker compose, and apache2-utils |
| `awscli` | Installs AWS CLI v2 (for ECR and S3 access) |
| `python` | Installs pyenv and Python 3.11.8 |
| `ibl_cli_ops` | Clones and installs `iblai-cli-ops` in a virtualenv (private repo — requires access) |
| `ibl_platform` | Base domain, environment, image tags, CORS, RBAC, unified API gateway, service defaults |
| `ibl_dm` | Launches `iblai-dm-pro` (PostgreSQL + pgvector, Redis, Django, Celery, Langfuse, Minio) |
| `ibl_edx` | Launches `iblai-edx-pro` (LMS, CMS, MySQL, MongoDB, Redis, Elasticsearch, MFE) |
| `ibl_spa` | Creates OAuth2 apps; configures + launches the Auth, Mentor AI, and Skills AI SPAs |
| `final_steps` | Reloads proxy; OAuth/OIDC setup; syncs edX with DM; creates super admins; seeds CSRF domains, flows, LLM registry, agents, and RBAC data |

## 4. Manage environments

```bash
iblai infra list              # list all managed environments
iblai infra status <name>     # show infrastructure details and outputs
iblai infra auth              # switch AWS credentials
iblai infra destroy <name>    # tear down infra, or remove a bootstrap project
```

## What gets created

**AWS infrastructure (Terraform):**

- VPC with 2 public subnets across AZs (`10.0.0.0/16`).
- EC2 (Ubuntu 22.04) with an encrypted EBS volume (AES-256).
- Application Load Balancer with TLS 1.2/1.3 termination.
- ACM certificates (RSA 2048-bit, DNS-validated, auto-renewed).
- Security groups (SSH restricted to the VPN CIDR; HTTP/HTTPS from the ALB only).
- 3 S3 buckets with server-side encryption (backups, media, static).
- Route53 hosted zone with 19 subdomain A-records.

**Platform services (Ansible):**

- **iblai-edx-pro** — LMS, CMS, workers, MySQL 8.0, Redis, MongoDB, Elasticsearch,
  Forum, Notes, Meilisearch, SMTP relay, Caddy.
- **iblai-dm-pro** — Django web, ASGI, Celery worker/beat, PostgreSQL 16, Redis, Flowise AI.
- **iblai-web-frontend** — the platform SPAs (Auth, Mentor AI, Skills AI).
- **Monitoring** — Prometheus, Grafana, AlertManager, metric exporters.
- **Nginx** reverse proxy.

## Authentication

The CLI **always lets you choose** how to authenticate — it never silently
auto-detects credentials, and walks you through the choice interactively on first use.
Supported:

- AWS profiles from `~/.aws/config` and `~/.aws/credentials` (type to filter).
- Environment variables (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`).
- Manual entry with masked input.

Your session is saved and reused across commands until you switch credentials or it
expires (`iblai infra auth` to switch).

## Workspace

All Terraform state, SSH keys, and project config live at:

```
~/.iblai-infra/projects/<project-name>/
```

## Related

- [`aws-architecture.md`](aws-architecture.md) — the single- and multi-server topology
  the CLI produces.
- [`ami-pipeline.md`](ami-pipeline.md) — the AMI build/launch pipeline that reuses the
  `service-update` command and Ansible roles for staging.
