## What changed

<!-- One paragraph. Which tier does it touch (0/1 = the core app; 2 = agent tabs; 3–5 = vertical / ops / security)? -->

## User test

- [ ] I ran the **20-minute test** (docs/user-first-plan.md §6) or `scripts/test-skills-agent.sh` against a scratch vibe-starter, and attached the screenshot of what the user sees.
- [ ] New or moved skills are in the right `skills/<folder>/`, listed in `scripts/skill-categories.json`, and `node scripts/build-catalogue.mjs` was run (CONTRIBUTING.md)
- [ ] Every skill I touched still has a screenshot of what it mounts (Tier 0/1) and stays ≤ 400 lines (≤ 500 for ★ families).

## Checks

- [ ] `bash scripts/validate-skills.sh`
- [ ] `node scripts/build-adapters.mjs` (adapters committed)
- [ ] `node scripts/check-sdk-pins.mjs` · `node scripts/check-links.mjs` · `node scripts/check-skill-tables.mjs` · `node scripts/check-skill-kinds.mjs`
- [ ] `api` skills: every endpoint verified against the live schema / backend `urls.py` (docs/api-skills.md); no UI language
- [ ] `node scripts/test-skills-render.mjs --skills <touched>` (and `--build` when vibe-starter changed)
- [ ] No token, org key, or email in code, docs, screenshots, or this PR
