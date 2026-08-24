# Changelog

All notable changes to the [vibe](https://github.com/iblai/vibe) toolkit.

## [Unreleased]

## [1.21.0] - 2026-08-24

### Added

- add test infra

## [1.20.1] - 2026-08-24

### Documentation

- refresh iblai-vibe-profile for the current Profile tabs

## [1.20.0] - 2026-08-24

### Added

- add iblai-vibe-history user chat history skill

## [1.19.0] - 2026-08-22

### Added

- add container and static-host targets

## [1.18.1] - 2026-08-21

### Fixed

- IBLAI_USERNAME identity chain (no users/platforms auto-detect), API-reported deploy URLs only, force-dynamic starter CSP + CSP_MODE passthrough, push_state-aware deploy poll

## [1.18.0] - 2026-08-21

### Added

- add iblai-vibe-memory tenant memory admin skill

## [1.17.1] - 2026-08-20

### Documentation

- document async LTI link creation and voice instructions

## [1.17.0] - 2026-08-20

### Added

- app-paywall skill — whole-app pay-to-enter on the tenant's own Stripe key.

## [1.16.0] - 2026-08-20

### Added

- deploy via ibl.ai hosting API, drop VERCEL_TOKEN

## [1.15.0] - 2026-08-19

### Added

- adding agent and tenant skill for billing

## [1.14.3] - 2026-08-18

### Fixed

- persist the token pair TenantProvider returns from re-auth
- hydration mismatch on every route

## [1.14.2] - 2026-08-18

### Fixed

- allow eval() in dev CSP; document distributed-mode footgun

## [1.14.1] - 2026-08-18

### Fixed

- vibe-starter no longer hangs after login when `NEXT_PUBLIC_API_BASE_URL`
  is unset (#155): the hosted URL defaults moved into `lib/iblai/config.ts`,
  so hosted iblai.app always routes through the consolidated API and can no
  longer silently fall back to the per-service hosts that reject Auth-SPA
  session tokens
- the template ships only `.env.example` / `iblai.env.example`; `.env.local`
  needs just `NEXT_PUBLIC_MAIN_TENANT_KEY` and the secret `IBLAI_API_KEY`,
  now exposed server-side via `config.apiKey()`
- config URL resolution is covered by unit tests
  (`__tests__/config.test.ts`)

## [1.14.0] - 2026-08-14

### Added

- add signed + notarized macOS/Windows desktop release builds
- add /iblai-vibe-ops-release for App Store & Play submission

## [1.13.0] - 2026-08-11

### Added

- adding skills for agent

## [1.12.0] - 2026-08-11

### Added

- adding results and overide for grader

## [1.11.1] - 2026-08-10

### Fixed

- remove vibe-starter asset info in README.md and fix vibe-starter structure

## [1.11.0] - 2026-08-10

### Added

- bundle vibe-starter as skill assets

## [1.10.1] - 2026-08-10

### Documentation

- delegate REST reference to the iblai/api companion

## [1.10.0] - 2026-08-04

### Added

- adding skill for grading

## [1.9.0] - 2026-08-04

### Added

- adding agent skill for human support

## [1.8.0] - 2026-07-27

### Added

- adding skill for lti

## [1.7.0] - 2026-07-27

### Added

- Adding skill for the evals
- adding skill for agent voice tab

## [1.6.0] - 2026-07-27

### Added

- add tenant-lock & in-app-purchase build-time flags to Tauri shell
- add openclaw post installation setup instruction
- add iblai-credential skill
- update openclaw skills
- add nemoclaw-sandbox skill
- add iblai-monetization-configure skill
- add iblai-monetization-analytics skill
- add iblai-monetization-subscriptions skill
- add iblai-monetization-checkout skill
- add iblai-monetization-onboard skill
- adding skill for the tasks tab for agent settings

### Fixed

- rename learner and mentor to user and agent respectively
- revert changelog renames
- update iblai-profile skill to match ibl.ai OS

### Changed

- turn iblai-monetization into family index + extract references

### Documentation

- dm-base + DM token + canonical URLs in configure skill
- dm-base + DM token + canonical URLs in analytics skill
- dm-base + DM token + canonical URLs in subscriptions skill
- dm-base + DM token + canonical URLs in checkout skill
- dm-base + DM token for onboard skill
- dm-base + DM token + canonical URLs in overview references

## [1.5.0] - 2026-06-10

### Added
- **iblai-app-cli migration** — the templates and commands from `iblai-app-cli` now live in this toolkit, completing the conversion
- **iblai-crm-overview** skill

### Changed
- **iblai-local-llm** — generalized so the skill is no longer tied to a single backend

### Documentation
- "Built with iblai/vibe" showcase in `README.md` — moved below "What is Vibe", split into three columns with a Repo column, and de-duplicated

## [1.4.0] - 2026-06-02

### Added
- **iblai-local-llm** skill — contract for on-device LLM inference in a Tauri desktop build: the Tauri command + event names, the `localLLMProps` hook shape the SDK reads, Rust command signatures, and Cargo deps for an Ollama backend (with an optional Foundry Local path for Windows NPUs). Includes field notes from a production integration — static export vs. `devUrl` for server-rendered apps, downloading via the daemon `/api/pull` stream, and the Linux root-install caveat
- **iblai-rbac** — `references/default-roles.py` enumerating the platform's default roles and their permissions, plus an account-management-policies screenshot
- "Built with iblai/vibe" showcase in `README.md` (os.ibl.ai, video.ibl.ai, course.ibl.ai)

### Changed
- **iblai-rbac** — streamlined the skill doc, moving inline role detail into the new `references/default-roles.py`

## [1.3.0] - 2026-05-27
### Added
- **iblai-rbac** skill that lists default roles on the platform and their permissions

## [1.2.0] - 2026-05-25

### Added
- **iblai-agent-chat** skill — full in-process agent chat surface (message stream, canvas, voice, suggested prompts) using the Chat SDK component; replaces the deprecated `iblai-chat`
- **iblai-agent-chat-sidebar** skill — SDK `AppSidebar` shell with sessions, projects dropdown, agent switcher, and footer actions
- **iblai-agent-audit** skill — agent Audit tab (events, filtering, export)
- **iblai-agent-mcp** skill — agent MCP servers tab (connect, manage, scope)
- **iblai-agent-privacy** skill — agent Privacy tab (PII detection and filtering with redact / mask / block actions)
- **iblai-agent-sandbox** skill — agent Sandbox tab (test environment for agent configuration changes)
- **iblai-course-access** skill — edX course-content pages with outline sidebar, tab strip, breadcrumb, embedded learning MFE iframe, previous/next navigation, timed-exam guard, and tenant-based access control
- **iblai-course-create** skill — drive the ibl.ai Course Creation API end-to-end: create tasks, generate outlines, draft unit content, review/edit structure, and publish courses to OpenEdX
- **iblai-credit** skill — credit balance widget (plan badge, credit count, auto-recharge, upgrade prompt)
- **iblai-design** skill — design, audit, polish, and iterate frontend UI; 23 sub-commands; falls back to `BRAND.md` when the project has no design system
- **iblai-monetization** skill — paywall integration, Stripe pricing-page session, upgrade-package modal, billing surfaces
- **iblai-ops-upgrade** skill — upgrade the `iblai` CLI, the `@iblai/iblai-js` SDK in the current project, and the vibe skills to the latest versions in one step
- **iblai-project** skill — in-process Projects landing page (chat input + files + instructions + assigned agents); renamed from `iblai-projects`
- **iblai-readme** skill — generate a project README with clone-then-`make` CLI install instructions and a Vercel deploy section
- **iblai-security-cloud-audit** skill — AWS / GCP / Azure misconfiguration and IAM auditing
- **iblai-security-dependency-audit** skill — third-party dependency vulnerability and supply-chain audit
- **iblai-security-disk-forensics** skill — disk image analysis, evidence recovery, timeline reconstruction
- **iblai-security-incident-triage** skill — security-incident triage following NIST SP 800-61
- **iblai-security-osint-recon** skill — open-source intelligence gathering and correlation
- **iblai-security-owasp-audit** skill — source-code security audit against OWASP Top 10 (2021)
- **iblai-security-prompt-injection** skill — test LLM applications for prompt-injection vulnerabilities
- **iblai-security-recon** skill — authorized attack-surface enumeration for pentests, bug bounty, CTF
- "Built with iblai/vibe" section in `README.md` highlighting videoAI and recruitAI
- API documentation in `iblai-agent-memory`, `iblai-analytics`, and `iblai-notification` skills

### Changed
- **Marketing skills split out** — the 43 marketing skills (CRO, copywriting, SEO, paid ads, lifecycle email, growth, etc.) plus the `tools/` directory (62 platform CLIs + 80 integration guides) now live in the companion [iblai/vibe-marketing](https://github.com/iblai/vibe-marketing) repo. Install side-by-side with vibe via `npx skills add iblai/vibe-marketing`
- **iblai-component** — added a "Detect Existing Design Style" section so the skill respects existing tokens / shadcn-space / v0 templates instead of reapplying default brand styling
- **iblai-ops-test** — full rewrite covering Vitest unit tests, Playwright E2E, and a 95% coverage threshold (Statements / Branches / Functions / Lines) enforced via `pnpm test:coverage`
- **iblai-readme** — install instructions consolidated on the `clone` + `make` flow; added a Vercel domain tip
- **iblai-auth** — accepts vibe-starter as an alternate entry point and asks the user's platform / token after cloning, so first-time users skip the manual scaffolding
- **iblai-navbar** — visual refresh; analytics is no longer included by default and is wired only when the project opts in
- **`.npmrc`** — supply-chain hardening: pin `minimum-release-age` to block recent-publication attacks
- Standardized skill naming: `iblai-projects` → `iblai-project` (singular form matches the rest of the skill set)

### Fixed
- **iblai-agent-chat** — documents known issues + workarounds (StrictMode `isMounted` race, voice-prompt timing) and removes lingering references to the deprecated `iblai-chat`
- **iblai-credit** — credit balance widget mounts in the navbar correctly (tenant context now resolves before the SDK call fires)
- **iblai-ops-init** — typo fix in the init message
- **iblai-readme** — removed references to retired LMS endpoints

### Removed
- **iblai-chat** skill — deprecated; replaced by `iblai-agent-chat` (the chat surface now lives on the in-process agent-chat skill so it can share state with the agent customize / settings flow)

## [1.1.0] - 2026-04-16

### Added
- **iblai-navbar** skill — responsive navbar with ibl.ai logo, Home/Profile/Account links with icons, notification bell, and profile dropdown; creates all linked pages (profile, account, notifications) automatically
- **iblai-marketing-landing** skill — build a high-converting landing page using a 12-section conversion framework
- **iblai-ops-deploy** skill — deploy to Vercel (or other platforms)
- **iblai-ops-init** skill — update project CLAUDE.md with ibl.ai platform guidance
- **iblai-agent-search** skill — agent search/browse page (starred, featured, custom, default agents)
- **iblai-agent-setting** skill — agent Settings tab (name, visibility, copy, delete) built on `AgentSettingsProvider`
- **iblai-agent-access** skill — agent Access tab (RBAC for editor and chat roles)
- **iblai-agent-api** skill — agent API tab (API key management)
- **iblai-agent-dataset** skill — agent Datasets tab (searchable dataset table with upload and pagination slots)
- **iblai-agent-disclaimer** skill — agent Disclaimers tab (user agreement and advisory)
- **iblai-agent-embed** skill — agent Embed tab (embed code, custom styling, shareable links)
- **iblai-agent-history** skill — agent History tab (conversation history with filters and export)
- **iblai-agent-llm** skill — agent LLM tab (model provider selection)
- **iblai-agent-memory** skill — agent Memory tab (enable/disable memory and manage memories)
- **iblai-agent-prompt** skill — agent Prompts tab (system prompts and suggested prompts)
- **iblai-agent-safety** skill — agent Safety tab (moderation prompts and flagged content)
- **iblai-agent-tool** skill — agent Tools tab (enable/disable agent tools)
- Screenshots for all 12 agent tab skills and agent-search

### Changed
- **iblai-auth** now asks "Do you want a navbar?" during setup (Step 2) and runs `/iblai-navbar` automatically if yes
- **iblai-profile** updated with full Profile Content API documentation (Basic, Social, Education, Experience, Resume, Security tabs), RTK Query hooks, custom career API slice, AI Profile Memory API, chat privacy settings, and MediaBox integration
- **iblai-profile**, **iblai-notification**, **iblai-account** skills now reference `/iblai-navbar` for navbar setup
- Component hierarchy standardized across all skills: ibl.ai SDK first, then shadcn/ui, then custom
- Navbar uses BRAND.md colors (brand blue `#0058cc`) instead of amber for active states
- Navbar logo served locally from `public/images/` instead of external URL
- Profile REST API endpoints documented with "read before write" warning and curl examples
- Tab skills use the `iblai-agent-<name>` convention (folders, images, frontmatter, headers, cross-references) with singular names (`dataset`, `disclaimer`, `prompt`, `setting`, `tool`)
- Skill images renamed to `iblai-agent-<name>.png` convention
- SDK component references use `Agent`-prefixed names (`AgentSettingsTab`, `AgentAccessTab`, etc.)

## [1.0.0] - 2026-04-08

### Added
- **iblai-auth** skill — add ibl.ai SSO authentication to vanilla Next.js apps
- **iblai-chat** skill — add AI chat widget
- **iblai-profile** skill — profile dropdown and settings page
- **iblai-account** skill — account and organization settings
- **iblai-analytics** skill — analytics dashboard with full tabbed layout (Overview, Users, Topics, Financial, Transcripts, Reports)
- **iblai-notification** skill — notification bell and center page
- **iblai-invite** skill — user invitation dialogs
- **iblai-workflow** skill — workflow builder components
- **iblai-component** skill — component and feature reference
- **iblai-ops-build** skill — build and run on desktop and mobile (iOS, Android, macOS, Surface) via Tauri v2
- **iblai-marketing-screenshot** skill — capture app store screenshots for web (Playwright), iOS (Simulator), and Android (Emulator)
- **iblai-onboard** skill — questionnaire-style onboarding flow designer with 14 screen archetypes, 5-phase process, and Apple-inspired visual guidelines
- **iblai-ops-test** skill — build and touch testing validation
- CLAUDE.md with architecture guidance, MCP tools, and commands reference
- BRAND.md with complete ibl.ai brand identity (colors, typography, spacing, shadows, component styles, Apple-inspired design language)
- README.md with quick start guide and feature documentation
- `iblai.env` template for platform configuration (DOMAIN, PLATFORM, TOKEN)
- `.mcp.json` with iblai, playwright, and shadcn MCP servers
- `npx skills add iblai/vibe` installation support
- Two app creation paths: `create-next-app` + manual setup, or `iblai startapp agent`
- Auth SPA customization support (AUTH_TITLE, AUTH_LOGO, AUTH_DISPLAY_TITLE)
- shadcn/ui components used by default in all skills
- Auto-start emulator after adding iOS or Android build
- Auto-update guidance in skills
- Dev server auto-start after task completion
- Screenshots for iblai-invite, iblai-workflow, and iblai-onboard skills
