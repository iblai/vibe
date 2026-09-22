# AMI-based staging launch pipeline

An automated GitHub Actions pipeline that launches an isolated staging environment
from a pre-built **golden AMI**, runs the Playwright E2E suite against it, and tears
it down. Used for `stg1`–`stg4`. This is the CI counterpart to a
[Terraform/Ansible provision](infra-cli.md): most of the AWS infrastructure is
permanent and reused; only the EC2 instance is ephemeral.

## Pipeline at a glance

```
Build Playwright image (→ OCIR)  ┐  (parallel)
Launch EC2 from AMI + Service Update  ┘
        → Run Playwright tests (OCI Container Instances → mentorai.stgX.iblai.org)
        → Terminate EC2 (always)
```

## Permanent vs ephemeral infrastructure

Each staging env (`stg1`–`stg4`) keeps permanent AWS infrastructure, pre-provisioned
via Terraform and reused across every run. Only the EC2 instance is created and
destroyed per run.

| Resource | Persists between launches |
| --- | --- |
| VPC + subnets | Yes |
| ALB + target group (TLS termination) | Yes |
| ACM certificates (`*.stgX.iblai.org`) | Yes |
| Route53 records (DNS → ALB) | Yes |
| Security groups | Yes |
| S3 buckets (media + static) | Yes |
| **EC2 instance** (platform server) | **No — ephemeral** |

## Pre-built AMI contents

Each AMI is a snapshot of a fully configured staging box:

- **OS:** Ubuntu 22.04 with Docker, pyenv, Python 3.11.8, AWS CLI.
- **Platform CLI:** `iblai-cli-ops`, installed via `iblai-prod-images`.
- **Services (Docker containers):**
  - `iblai-dm-pro` — Django, PostgreSQL, Redis, Celery, Langfuse, ClickHouse, MinIO.
  - `iblai-edx-pro` — LMS, CMS, MySQL, MongoDB, Redis, Elasticsearch, MFE.
  - Auth SPA, Agent SPA, Skills SPA.
  - Nginx reverse proxy.
- **Data:** test orgs, users, RBAC, and analytics views pre-seeded.
- **Config:** S3 buckets, AWS credentials, TimescaleDB enabled.

## Pipeline steps

### 1. Build Playwright image

Builds a Docker image of the Playwright suite (from the `mentorai` repo) and pushes
it to Oracle Cloud Container Registry (OCIR). Runs on an `ubuntu-latest` runner.

- Image: `iad.ocir.io/idcwyla5j5cr/ibl-agent-playwright:{tag}`.
- Contents: Playwright browsers (Chromium, Firefox, WebKit), specs from
  `e2e/journeys/`, page objects, utilities, AWS CLI for S3 log upload.
- **Caching:** if an image with the same tag already exists, the build is skipped.

### 2. Launch EC2 from AMI

Provisions a fresh EC2 into the existing VPC/subnet/security group, via boto3 inside
the `iblai-infra-cli` tool:

1. `ec2:RunInstances` with the AMI ID, `t3.2xlarge`, 200 GB gp3 volume.
2. Wait for `running`.
3. Read the public IP.

**Security:** the workflow opens port 22 on the security group for the GitHub Actions
runner's IP, and **revokes it after completion — always, even on failure**.

### 3. Service update (Ansible)

`iblai infra service-update --host <IP>` runs `service_update_playbook.yml` (2 roles)
to bring every service up and current.

**Role `ibl_cli_ops`** — installs the latest `iblai-prod-images` from
`iblai/iblai-prod-images@main` (this pins all container image versions and bundles
`ibl-cli-ops`).

**Role `ibl_service_update`** — 14 steps:

1. Restore the Postgres data-dir ownership to uid `999` (fixes a chown from pre-tasks).
2. ECR login — authenticate Docker with AWS ECR using the server's existing AWS creds.
3. `ibl config save` — regenerate all compose files.
4. `ibl tutor config save` — render edX Tutor config.
5. `ibl edx start -d` — ensure edX is running.
6. Wait for LMS — curl `localhost:8600/heartbeat` (40 retries × 15s).
7. Ensure DM containers up — `docker compose up -d` in the background (idempotent, no
   recreate — avoids triggering `collectstatic`).
8. Wait for DM — curl `localhost:8400` (60 retries × 15s = 15 min max, for collectstatic).
9. DM migrations — `docker compose exec web ./manage.py migrate --noinput`.
10. Restart SPAs — `docker compose down; up -d` for auth, agent, skills (with an
    auto-restart for the Agent empty-reply behavior).
11. OAuth/OIDC — `ibl launch --ibl-oauth --ibl-oidc --ibl-edx-manager` + `ibl dm auth-setup`.
12. Sync edX users — `ibl edx sync-with-manager --users`.
13. Sync SSO credentials — read the `spa-sso` and `ibl_web` client IDs from the LMS
    database, write them to config, restart the Auth SPA.
14. Reload proxy + restart nginx.

### 4. Register in the ALB target group

Deregister **all** existing targets, then register the new EC2.

- **Why deregister first:** prevents split-brain routing where the ALB balances
  between an old instance (stale OAuth creds) and the new one.
- **Health check:** the ALB requires HTTP 200–399 on `/` before routing traffic.

### 5. Run Playwright tests (OCI)

Launches Docker containers on OCI Container Instances that run the suite against the
staging env at `mentorai.stgX.iblai.org` (via ALB → EC2).

- Browsers: chrome, firefox, safari, edge (configurable; default all 4 in parallel).
- Workers: 3 per browser. Max wait: 5400s (90 min). Retries: 2 per test.
- Dedicated test user per browser (avoids conflicts): `iblaiuserchromenew`,
  `iblaiuserfirefoxnew`, `iblaiusersafarinew`, `iblaiuseredgenew`.
- Results uploaded to S3 for resumption on later runs.

### 6. Terminate EC2

`aws ec2 terminate-instances --instance-ids <id>`. Runs under `if: always()` — even
when tests fail. VPC, ALB, Route53, and S3 persist for the next launch.

## Timing

| Step | Duration |
| --- | --- |
| Build Playwright image | 2–5 min (cached: instant) |
| Launch EC2 | ~20s |
| SSH ready | ~45s |
| Service update (Ansible) | 20–40 min (DM collectstatic dominates) |
| ALB health check | ~30s |
| Playwright tests (4 browsers) | 15–90 min |
| Terminate | instant |
| **Total** | **40–90 min** |

## Repository map

| Repo | Role |
| --- | --- |
| [`iblai-infra-cli`](https://github.com/iblai/iblai-infra-cli) | CLI with `service-update`, Ansible playbooks, Terraform templates |
| `iblai-web-ops` | Reusable GitHub Actions workflows (OCI test runner, Docker builds, domain locking) |
| `iblai-prod-images` | Container image version pins (DM, edX, SPAs) |
| `mentorai` | SPA source, Playwright tests, PR-validation workflows |

## Secrets & variables

**Variables** (on the `mentorai` repo, per env — repeat for STG2–STG4):

| Variable | Example |
| --- | --- |
| `STG1_AMI_ID` | `ami-02dff3992891505ba` |
| `STG1_SUBNET_ID` | `subnet-022ff062fe90b23b1` |
| `STG1_SG_ID` | `sg-0d56a7433d4b2a364` |
| `STG1_TG_ARN` | `arn:aws:elasticloadbalancing:...` |
| `STG1_KEY_PAIR` | `stg1-staging-key` |

**Secrets:**

| Secret | Purpose |
| --- | --- |
| `SERVICE_UPDATE_ACCESS_KEY` | AWS IAM key: EC2 launch/terminate + SG rule management |
| `SERVICE_UPDATE_SECRET_KEY` | AWS IAM secret |
| `STG1_SSH_KEY` – `STG4_SSH_KEY` | SSH private key per env |
| `GIT_TOKEN` | GitHub PAT for private-repo access |
| `SSH_PRIVATE_DEPLOY_OPS` | SSH key for OCI/deployment ops |
| OCI secrets | Oracle Cloud creds for container instances |
| S3 secrets | AWS creds for test-log storage |

**IAM policy for the `SERVICE_UPDATE` keys:**

```json
{
  "Statement": [
    {
      "Action": [
        "ec2:RunInstances", "ec2:DescribeInstances", "ec2:DescribeImages",
        "ec2:CreateTags", "ec2:TerminateInstances",
        "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress"
      ],
      "Resource": "*"
    },
    {
      "Action": [
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:DescribeTargetHealth"
      ],
      "Resource": "*"
    }
  ]
}
```

## Known behaviors

- **DM collectstatic (15–20 min cold boot):** the DM container entrypoint runs
  `collectstatic --noinput` before gunicorn — 15–20 min at 100% CPU on a fresh AMI
  boot. The service-update uses `docker compose up -d` (idempotent, no recreate) so it
  doesn't retrigger collectstatic.
- **Agent SPA empty reply:** the Agent SPA sometimes returns empty HTTP replies for
  60–90s after startup despite reporting "Ready". The service-update role detects this
  and auto-restarts the container (with `ignore_errors` so the pipeline continues).
- **ALB split-brain routing:** old EC2 instances left in the target group cause the
  ALB to balance between old and new instances with different OAuth creds →
  intermittent `409` auth errors. The pipeline deregisters all targets before
  registering the new instance.
- **OAuth credential sync:** `ibl config save` regenerates `auth.yml` but doesn't
  preserve SSO creds. The pipeline reads the `spa-sso` and `ibl_web` client creds
  straight from the LMS database and writes them to config before restarting the Auth
  SPA.

## Creating a new AMI

When the platform or test data changes:

1. Launch a staging env from an existing AMI.
2. Make changes (add orgs, users, config).
3. Verify all services healthy.
4. Create an AMI from the EC2 instance.
5. Update the `STGx_AMI_ID` variables on `mentorai` (and `skillsai`).

**AMI requirements:**

- All containers must be in a **startable** state (they need not be running — the
  service-update handles startup).
- S3 config baked in: `ENABLE_S3_BUCKET_STORAGE=True`, bucket names, region, credentials.
- Test orgs and users pre-seeded.
- The `iblai-cli-ops` virtualenv must exist (with pyenv).
