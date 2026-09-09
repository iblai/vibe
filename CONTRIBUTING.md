# Contributing a skill

Whether you work at ibl.ai or not, adding a skill is the same seven steps. A
skill is one folder with a `SKILL.md`; the repo's scripts do the cataloguing
for you once the folder is in the right place and the frontmatter is right.

## 1. Decide what it is

| Question | Answer → |
|---|---|
| Does it mount a **visual component** in a Next.js app? | `kind: ui`, name `iblai-vibe-<thing>` |
| Does it drive the platform **over REST with no screen**? | `kind: api`, name `iblai-api-<thing>` |
| Does it only **route or explain** (an index, a decision page)? | `kind: guide` |
| Does it **build, test, deploy, or polish**? | `kind: ops`, name `iblai-vibe-ops-<thing>` (or a clear verb) |
| Authorized-use security work? | `kind: security`, name `iblai-vibe-security-<thing>` |

Full definitions and the "same data, two doors" rule: [docs/skill-kinds.md](docs/skill-kinds.md).
One skill = one capability. If you are documenting both a component and its
REST twin, that is two skills, one of each kind, that link to each other.

## 2. Put it in the right folder

`skills/<folder>/<skill-name>/SKILL.md`. Pick by what a builder is doing when
they need it, not by which team owns it:

| Folder | Contains |
|---|---|
| `start/` | The first conversation, connecting an organization, sign-in, the starter, the REST bridge, upgrading |
| `agents/` | Chatting with, browsing, creating, and configuring agents — every settings tab, `ui` and `api` alike |
| `users/` | Profiles, per-user data, memories, roles and admins, invitations, notifications, onboarding |
| `organizations/` | Organization settings and metadata, branding, integrations and tokens, CRM |
| `billing/` | Credits, spend caps, charging users |
| `analytics/` | Usage, users, topics, transcripts, costs, reports |
| `content/` | Courses, catalog, credentials, admissions, other LMSs |
| `ship/` | Test, deploy, native builds, stores, icons, polish, self-hosting |
| `security/` | Authorized-use security skills |

The folder list lives in `scripts/skill-categories.json`; add your skill name
there under its folder (the scripts read it to order the catalogue). Never nest
deeper than `skills/<folder>/<skill-name>/`.

## 3. Write it from the template

- `ui` skills: copy [`templates/skill-template-feature.md`](templates/skill-template-feature.md).
  Sections in that order; a screenshot near the top; every code fence
  compilable as written (the render gate typechecks it); a **Verify** block;
  a **Platform data** table linking the `api` twin.
- `api` skills: follow [docs/api-skills.md](docs/api-skills.md) — `## Auth &
  conventions` → `## Reads` → `## Writes` → `## Example` → `## Notes`; every
  endpoint verified against the live schema / backend `urls.py`; no UI language.
- `guide` / `ops` / `security`: [`templates/skill-template.md`](templates/skill-template.md).

Frontmatter:

```yaml
---
name: iblai-vibe-thing            # must equal the folder name
description: >-                   # 200–1024 chars: what the user gets, then the trigger phrases
  Add … to your Next.js app. Use when the user mentions 'x', 'y', or wants z.
  For … see /iblai-vibe-sibling; for the REST contract see /iblai-api-thing.
globs:
alwaysApply: false
metadata:
  kind: ui                        # ui | api | guide | ops | security
---
```

Rules that keep skills usable: ≤ 500 lines (Tier 0/1: ≤ 400) — move bulk into
`references/`; the one-line pointer to `docs/skill-setup.md` instead of the
brand/conventions boilerplate; prose says **organization / org key**,
**agent**, **user** — the words `tenant`, `mentor`, `learner` appear only as
verbatim wire names in backticks; never a real token, org key, or email in
text or screenshots.

## 4. Ship code with it (when it creates files)

Put templates in `assets/` (Jinja `.j2`, `{{ platform_key }}` etc.) and map them
to app paths in `test.json` so the render gate typechecks them against the
pinned SDK:

```json
{ "overlay": { "assets/thing.tsx.j2": "app/(app)/thing/page.tsx" } }
```

If the starter should ship it, put the file in
`skills/start/iblai-vibe-ops-init/assets/vibe-starter/` and copy it into your
skill's `assets/` — the starter is the source of truth.

## 5. Add a screenshot

`skills/<folder>/<name>/<name>-<n>-<slug>.png`, 1440×900, light, sanitized demo
org, < 400 KB; reference it by raw GitHub URL. Conventions and the capture
script: [docs/screenshots/README.md](docs/screenshots/README.md). No screenshot
yet? `python3 scripts/placeholder-screenshot.py <path>` writes a labelled
placeholder so links resolve.

## 6. Run the checks

```bash
bash scripts/validate-skills.sh          # frontmatter, length, off-spec dirs
node scripts/check-skill-kinds.mjs       # metadata.kind present and consistent with the name
node scripts/build-catalogue.mjs         # regenerates docs/catalogue.md from frontmatter
node scripts/check-skill-tables.mjs      # every skill is in CLAUDE.md and docs/catalogue.md
node scripts/check-sdk-pins.mjs          # no @iblai version drifts from vibe-starter
node scripts/check-links.mjs             # every github.com/iblai link resolves
node scripts/build-adapters.mjs          # Cursor + Codex adapters (commit adapters/)
node scripts/test-skills-render.mjs --skills <your-skill>   # code typechecks against the SDK
```

`ui` skills also get a line in `CLAUDE.md`'s catalogue (the tier table) and, if
they belong in the core, a row in [docs/domain-model.md](docs/domain-model.md).
Everything else is generated.

## 7. Open the PR

Conventional commit subject (`feat(skills): add iblai-vibe-thing` → a minor
release; `fix:`/`docs:` → patch). Fill in the PR template — it asks for the
user test and the checks above. CI runs the deterministic tiers on every PR;
add the `run-tests` label to also run the agent tier on your skill
([TESTING.md](TESTING.md)).

## Changing an existing skill

Same checks. If you rename or move a skill: `git mv`, update
`scripts/skill-categories.json`, rebuild adapters and the catalogue, and grep
for the old path (`skills/<old>/`) — screenshots and cross-links use it.
Never hand-edit `CHANGELOG.md`; the release workflow writes it from your
commit subjects.
