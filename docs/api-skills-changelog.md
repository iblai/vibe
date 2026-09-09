# Changelog

Historical changelog of the `iblai-api-*` skills from the former `iblai/api` repository, preserved when it was merged into `iblai/vibe` (2026-09-08). Later changes appear in the repo-level `CHANGELOG.md`.

## [Unreleased]

### Added

- `iblai-api-agent-memory`: document the shared **agent knowledge** store (`MentorMemory`) — `GET`/`POST` `…/orgs/{org}/mentors/{mentor}/agent-memories/` and `PATCH`/`DELETE` `…/agent-memories/{memoryId}/` — org+agent-scoped, non-categorized memories injected into every user's chat with the agent.
- `iblai-api-analytics`: document the extended per-turn context now returned by the transcript detail endpoint (`GET /api/analytics/messages/details/`) — each AI turn in `messages[]` carries `documents`, `tool_calls`, `metadata`, and `request_context` alongside `human`/`ai`.

### Documentation

- `iblai-api-analytics`: note that the transcript list (`GET /api/analytics/messages/`) `search` now matches the learner's **email** (in addition to username and the first user message) and that each list row carries the learner's `email`.

## [0.2.8] - 2026-09-08

### Documentation

- document per-turn context + email on transcripts (#36)

## [0.2.7] - 2026-09-07

### Documentation

- document RBAC-scoped token modes and endpoints (#37)

## [0.2.6] - 2026-09-01

### Documentation

- document custom_metadata tagging at ingestion
- document hard document_filter alongside soft metadata

## [0.2.5] - 2026-08-29

### Documentation

- add shared agent knowledge (MentorMemory) endpoints

## [0.2.4] - 2026-08-26

### Documentation

- document edX user-role catalog and bulk sync

## [0.2.3] - 2026-08-25

### Documentation

- note tenant-admin cross-user access on memsearch-settings

## [0.2.2] - 2026-07-28

### Documentation

- add platform screenshots to the voice-agent walkthrough

## [0.2.1] - 2026-07-28

### Documentation

- add tutorials/ with an end-to-end voice-agent walkthrough

## [0.2.0] - 2026-07-27

### Added

- adding skill for the support
- fold all developer docs into skills — per-skill references/ + infrastructure & ecosystem skills (lossless)
- merge remaining developer docs into skills (code-verified) + references/ split
- add iblai-api-inference and merge developer docs into the skills
- fold MCP configuration into iblai-api-agent-mcp, drop the separate skill
- add iblai-api-apply skill — the platform application gate (code-verified)
- added skill for mcp configuration
- 8 new DM skills (code-verified) + repo-wide format standardization (#9)

### Fixed

- made sure everything merged / created is complete
- bring iblai-api-mcp-configuration onto repo conventions (code-verified)
- rename learner and mentor to user and agent respectively
- revert mcp name change
- add CRM schema

### Documentation

- list iblai-api-mcp-configuration in the README skill index
- document org key + secret as a no-browser auth path
- add "Updating the skills" section to README
- simplify login onboarding to two clear paths
- normalize IBL.ai -> ibl.ai in agent-chat server README; align license to MIT
