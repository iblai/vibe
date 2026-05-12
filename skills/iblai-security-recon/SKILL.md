---
name: iblai-security-recon
description: "Perform structured reconnaissance and attack surface enumeration for authorized penetration tests, CTF challenges, and bug bounty programs. Use when the user mentions 'recon,' 'reconnaissance,' 'enumerate,' 'attack surface,' 'subdomain enumeration,' 'port scan,' 'fingerprint,' 'asset discovery,' or needs to map a target's external footprint."
globs:
alwaysApply: false
allowed-tools: Bash, Read, Write, WebSearch, WebFetch
---

# /iblai-security-recon

Run structured reconnaissance against an authorized target and produce
an actionable attack-surface map. For pentest engagements, bug bounty,
and CTF/lab targets only.

Do NOT scan before authorization is confirmed. Do NOT touch
out-of-scope hosts.

## Step 0: Authorization Check

Confirm before any command:

1. Written authorization for the target (pentest SOW, bug-bounty scope, CTF/lab environment).
2. The target is inside the declared scope.

If either is unclear, stop and ask. Never assume authorization. Refuse
mass scans of unrelated infrastructure.

## Step 1: Passive Recon

Gather data without sending packets at the target.

**DNS:**

- `dig any $ARGUMENTS` — A, AAAA, MX, TXT, NS, CNAME
- `dig axfr @ns-server $ARGUMENTS` — attempt zone transfer
- Certificate transparency for subdomains:
  ```
  curl -s "https://crt.sh/?q=%25.$ARGUMENTS&output=json" | jq -r '.[].name_value' | sort -u
  ```

**WHOIS / registration:** `whois $ARGUMENTS` for registrant, nameservers, and creation date.

**Search-engine dorking:** `site:`, `inurl:`, `filetype:`, `intitle:` queries surface exposed pages, documents, and admin panels.

**Technology fingerprinting:** Read public-facing pages for framework, CMS, server software, and JS library signatures.

**Public code repos:** Search GitHub/GitLab for the target's org name, domain, API keys, or internal paths.

**Historical data:** Wayback Machine for old endpoints, removed pages, and stale config files.

## Step 2: Active Recon

Only after explicit authorization for active probing.

**Port scanning:**

```bash
nmap -sC -sV -oN scan-results.txt $ARGUMENTS
```

Start with top 1000 ports. Expand to `-p-` when warranted. Use `-Pn`
if the host appears down but is in scope.

**Service enumeration:** Probe open ports for version banners and default configs.

**Web content discovery:**

- Directory bruting with gobuster, feroxbuster, or dirsearch
- Virtual host enumeration
- API endpoint discovery — check `/api/`, `/v1/`, `/graphql`, `/swagger.json`

**SSL/TLS analysis:** `testssl.sh` or `sslyze` for weak ciphers, expired certs, and misconfigurations.

## Step 3: Analysis

Correlate findings. Rank attack vectors by:

1. Severity of potential impact
2. Likelihood of exploitation
3. Exposure level (internet-facing vs. internal)

## Output Format

```markdown
# Recon Report
## Target: [target]
## Scope: [confirmed scope]
## Date: [date]

### Passive Findings
| Finding | Details | Relevance |
|---------|---------|-----------|

### Subdomains Discovered
- [list]

### Technologies Detected
- [list with versions where identified]

### Active Findings
| Port | Service | Version | Notes |
|------|---------|---------|-------|

### Attack Surface Summary
[Prioritized list of interesting findings with risk assessment]

### Recommended Next Steps
[Ordered list of what to investigate further]
```

## Boundaries

- Stay inside the defined scope — never scan adjacent or out-of-scope hosts.
- Rate-limit aggressive scans so you don't disrupt the target.
- Log every command for the engagement record.
- If you spot evidence of third-party compromise, alert the user immediately.
- Refuse requests targeting systems without explicit authorization.
- Refuse mass scanning of unrelated targets.

## References

- PTES (Penetration Testing Execution Standard)
- OWASP Testing Guide
- Bug Bounty Methodology (jhaddix/tbhm)
