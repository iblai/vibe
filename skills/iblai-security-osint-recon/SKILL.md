---
name: iblai-security-osint-recon
description: "Gather and correlate open source intelligence from public sources for authorized investigations, threat intelligence, and attack surface assessment. Use when the user mentions 'OSINT,' 'open source intelligence,' 'digital footprint,' 'public records,' 'threat intelligence,' 'investigate a domain,' or needs to research a target using publicly available data."
globs:
alwaysApply: false
allowed-tools: Bash, WebSearch, WebFetch, Read, Write
---

# /iblai-security-osint-recon

Collect, analyze, and correlate publicly available information from open
sources. For threat intel, authorized assessments, CTF, and defensive
research.

Do NOT use this for harassment, doxing, stalking, or unauthorized
surveillance. Refuse those requests outright.

## Step 0: Ethics Check

Confirm before collecting anything:

1. The investigation has a legitimate purpose (threat intel, authorized assessment, CTF, defensive research).
2. You are only touching publicly available information.
3. Findings will not be used to harass, dox, or aggregate private data beyond what the objective needs.

Refuse if any of those is shaky.

## Collection

### Domain and Infrastructure

Map the target's infrastructure:

```bash
whois <domain>                  # Registration data
dig any <domain>                # DNS records
```

Subdomain enumeration via certificate transparency:

```bash
curl -s "https://crt.sh/?q=%25.<domain>&output=json" | jq -r '.[].name_value' | sort -u
```

Other sources: SecurityTrails, DNSDumpster, ipinfo.io, bgp.he.net,
Wayback Machine, Shodan, Censys.

### Organization

- Company registrations, filings, SEC records (public companies)
- LinkedIn company page — headcount, roles, tech-stack hints
- Job postings — internal tooling, stack, pain points
- Press releases and news
- GitHub/GitLab org pages and public repos
- Patent filings

### Email and Username

- Email format patterns (e.g., first.last@domain.com)
- HaveIBeenPwned — check for breach exposure (check only, never distribute breach data)
- PGP key servers for email discovery
- Gravatar lookups for email-to-identity correlation

### Document and File

- Metadata from public documents: `exiftool <file>` reveals author, software, GPS, timestamps
- Google dorking: `site:<domain> filetype:pdf`, `site:<domain> filetype:xlsx`
- Pastebin and paste-site monitoring
- Public cloud storage with predictable names (S3, GCS buckets)

### Threat Intelligence

- CVE databases for the target's stack
- Exploit databases (exploit-db, searchsploit)
- Threat feeds and IOC databases (VirusTotal, MalwareBazaar, OTX)
- Abuse contact databases

## Analysis

- Cross-reference findings across sources.
- Validate every claim against at least two independent sources.
- Build a timeline when investigating an incident.
- Map relationships between entities (people, domains, IPs, organizations).
- Rate confidence honestly: **High** (multiple corroborating sources), **Medium** (single reliable source), **Low** (unverified).

## Output Format

```markdown
# OSINT Report
## Objective: [what we're investigating and why]
## Target: [entity/domain/person]
## Date: [date]

### Collection Summary
| Source | Findings | Confidence |
|--------|----------|------------|

### Key Findings

#### Finding 1: [Title]
- **Source:** [where this was found]
- **Details:** [what was discovered]
- **Confidence:** High / Medium / Low
- **Relevance:** [why this matters to the objective]

### Correlations
[How different findings connect to each other]

### Intelligence Gaps
[What we couldn't find or verify]

### Recommendations
[Next steps and actionable intelligence]
```

## Boundaries

- Public sources only.
- Never probe private or authenticated systems.
- Don't aggregate PII beyond what the objective requires.
- Attribute every finding to its source.
- Rate confidence honestly — do not overstate certainty.
- If a finding could cause harm if misused, flag the sensitivity.
- Refuse doxing, stalking, or unauthorized-surveillance requests.

## References

- OSINT Framework (osintframework.com)
- SANS OSINT resource list
- Bellingcat Online Investigation Toolkit
