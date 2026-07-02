# Changelog

All notable changes to the [vibe](https://github.com/iblai/vibe) toolkit.

## [Unreleased]

## [1.4.0] - 2026-06-02

### Added
- **iblai-vibe-local-llm** skill — contract for on-device LLM inference in a Tauri desktop build: the Tauri command + event names, the `localLLMProps` hook shape the SDK reads, Rust command signatures, and Cargo deps for an Ollama backend (with an optional Foundry Local path for Windows NPUs). Includes field notes from a production integration — static export vs. `devUrl` for server-rendered apps, downloading via the daemon `/api/pull` stream, and the Linux root-install caveat
- **iblai-vibe-rbac** — `references/default-roles.py` enumerating the platform's default roles and their permissions, plus an account-management-policies screenshot
- "Built with iblai/vibe" showcase in `README.md` (os.ibl.ai, video.ibl.ai, course.ibl.ai)

### Changed
- **iblai-vibe-rbac** — streamlined the skill doc, moving inline role detail into the new `references/default-roles.py`

## [1.3.0] - 2026-05-27
### Added
- **iblai-vibe-rbac** skill that lists default roles on the platform and their permissions

## [1.2.0] - 2026-05-25

### Added
- **iblai-vibe-agent-chat** skill — full in-process agent chat surface (message stream, canvas, voice, suggested prompts) using the Chat SDK component; replaces the deprecated `iblai-chat`
- **iblai-vibe-agent-chat-sidebar** skill — SDK `AppSidebar` shell with sessions, projects dropdown, agent switcher, and footer actions
- **iblai-vibe-agent-audit** skill — agent Audit tab (events, filtering, export)
- **iblai-vibe-agent-mcp** skill — agent MCP servers tab (connect, manage, scope)
- **iblai-vibe-agent-privacy** skill — agent Privacy tab (PII detection and filtering with redact / mask / block actions)
- **iblai-vibe-agent-sandbox** skill — agent Sandbox tab (test environment for agent configuration changes)
- **iblai-vibe-course-access** skill — edX course-content pages with outline sidebar, tab strip, breadcrumb, embedded learning MFE iframe, previous/next navigation, timed-exam guard, and tenant-based access control
- **iblai-vibe-course-create** skill — drive the ibl.ai Course Creation API end-to-end: create tasks, generate outlines, draft unit content, review/edit structure, and publish courses to OpenEdX
- **iblai-vibe-credit** skill — credit balance widget (plan badge, credit count, auto-recharge, upgrade prompt)
- **iblai-vibe-design** skill — design, audit, polish, and iterate frontend UI; 23 sub-commands; falls back to `BRAND.md` when the project has no design system
- **iblai-vibe-monetization** skill — paywall integration, Stripe pricing-page session, upgrade-package modal, billing surfaces
- **iblai-vibe-ops-upgrade** skill — upgrade the `iblai` CLI, the `@iblai/iblai-js` SDK in the current project, and the vibe skills to the latest versions in one step
- **iblai-vibe-project** skill — in-process Projects landing page (chat input + files + instructions + assigned agents); renamed from `iblai-projects`
- **iblai-vibe-readme** skill — generate a project README with clone-then-`make` CLI install instructions and a Vercel deploy section
- **iblai-vibe-security-cloud-audit** skill — AWS / GCP / Azure misconfiguration and IAM auditing
- **iblai-vibe-security-dependency-audit** skill — third-party dependency vulnerability and supply-chain audit
- **iblai-vibe-security-disk-forensics** skill — disk image analysis, evidence recovery, timeline reconstruction
- **iblai-vibe-security-incident-triage** skill — security-incident triage following NIST SP 800-61
- **iblai-vibe-security-osint-recon** skill — open-source intelligence gathering and correlation
- **iblai-vibe-security-owasp-audit** skill — source-code security audit against OWASP Top 10 (2021)
- **iblai-vibe-security-prompt-injection** skill — test LLM applications for prompt-injection vulnerabilities
- **iblai-vibe-security-recon** skill — authorized attack-surface enumeration for pentests, bug bounty, CTF
- "Built with iblai/vibe" section in `README.md` highlighting videoAI and recruitAI
- API documentation in `iblai-vibe-agent-memory`, `iblai-vibe-analytics`, and `iblai-vibe-notification` skills

### Changed
- **Marketing skills split out** — the 43 marketing skills (CRO, copywriting, SEO, paid ads, lifecycle email, growth, etc.) plus the `tools/` directory (62 platform CLIs + 80 integration guides) now live in the companion [iblai/vibe-marketing](https://github.com/iblai/vibe-marketing) repo. Install side-by-side with vibe via `npx skills add iblai/vibe-marketing`
- **iblai-vibe-component** — added a "Detect Existing Design Style" section so the skill respects existing tokens / shadcn-space / v0 templates instead of reapplying default brand styling
- **iblai-vibe-ops-test** — full rewrite covering Vitest unit tests, Playwright E2E, and a 95% coverage threshold (Statements / Branches / Functions / Lines) enforced via `pnpm test:coverage`
- **iblai-vibe-readme** — install instructions consolidated on the `clone` + `make` flow; added a Vercel domain tip
- **iblai-vibe-auth** — accepts vibe-starter as an alternate entry point and asks the user's platform / token after cloning, so first-time users skip the manual scaffolding
- **iblai-vibe-navbar** — visual refresh; analytics is no longer included by default and is wired only when the project opts in
- **`.npmrc`** — supply-chain hardening: pin `minimum-release-age` to block recent-publication attacks
- Standardized skill naming: `iblai-projects` → `iblai-vibe-project` (singular form matches the rest of the skill set)

### Fixed
- **iblai-vibe-agent-chat** — documents known issues + workarounds (StrictMode `isMounted` race, voice-prompt timing) and removes lingering references to the deprecated `iblai-chat`
- **iblai-vibe-credit** — credit balance widget mounts in the navbar correctly (tenant context now resolves before the SDK call fires)
- **iblai-vibe-ops-init** — typo fix in the init message
- **iblai-vibe-readme** — removed references to retired LMS endpoints

### Removed
- **iblai-chat** skill — deprecated; replaced by `iblai-vibe-agent-chat` (the chat surface now lives on the in-process agent-chat skill so it can share state with the agent customize / settings flow)

## [1.1.0] - 2026-04-16

### Added
- **iblai-vibe-navbar** skill — responsive navbar with ibl.ai logo, Home/Profile/Account links with icons, notification bell, and profile dropdown; creates all linked pages (profile, account, notifications) automatically
- **iblai-marketing-landing** skill — build a high-converting landing page using a 12-section conversion framework
- **iblai-vibe-ops-deploy** skill — deploy to Vercel (or other platforms)
- **iblai-vibe-ops-init** skill — update project CLAUDE.md with ibl.ai platform guidance
- **iblai-vibe-agent-search** skill — agent search/browse page (starred, featured, custom, default agents)
- **iblai-vibe-agent-setting** skill — agent Settings tab (name, visibility, copy, delete) built on `AgentSettingsProvider`
- **iblai-vibe-agent-access** skill — agent Access tab (RBAC for editor and chat roles)
- **iblai-vibe-agent-api** skill — agent API tab (API key management)
- **iblai-vibe-agent-dataset** skill — agent Datasets tab (searchable dataset table with upload and pagination slots)
- **iblai-vibe-agent-disclaimer** skill — agent Disclaimers tab (user agreement and advisory)
- **iblai-vibe-agent-embed** skill — agent Embed tab (embed code, custom styling, shareable links)
- **iblai-vibe-agent-history** skill — agent History tab (conversation history with filters and export)
- **iblai-vibe-agent-llm** skill — agent LLM tab (model provider selection)
- **iblai-vibe-agent-memory** skill — agent Memory tab (enable/disable memory and manage memories)
- **iblai-vibe-agent-prompt** skill — agent Prompts tab (system prompts and suggested prompts)
- **iblai-vibe-agent-safety** skill — agent Safety tab (moderation prompts and flagged content)
- **iblai-vibe-agent-tool** skill — agent Tools tab (enable/disable agent tools)
- Screenshots for all 12 agent tab skills and agent-search

### Changed
- **iblai-vibe-auth** now asks "Do you want a navbar?" during setup (Step 2) and runs `/iblai-vibe-navbar` automatically if yes
- **iblai-vibe-profile** updated with full Profile Content API documentation (Basic, Social, Education, Experience, Resume, Security tabs), RTK Query hooks, custom career API slice, AI Profile Memory API, chat privacy settings, and MediaBox integration
- **iblai-vibe-profile**, **iblai-vibe-notification**, **iblai-vibe-account** skills now reference `/iblai-vibe-navbar` for navbar setup
- Component hierarchy standardized across all skills: ibl.ai SDK first, then shadcn/ui, then custom
- Navbar uses BRAND.md colors (brand blue `#0058cc`) instead of amber for active states
- Navbar logo served locally from `public/images/` instead of external URL
- Profile REST API endpoints documented with "read before write" warning and curl examples
- Tab skills use the `iblai-vibe-agent-<name>` convention (folders, images, frontmatter, headers, cross-references) with singular names (`dataset`, `disclaimer`, `prompt`, `setting`, `tool`)
- Skill images renamed to `iblai-vibe-agent-<name>.png` convention
- SDK component references use `Agent`-prefixed names (`AgentSettingsTab`, `AgentAccessTab`, etc.)

## [1.0.0] - 2026-04-08

### Added
- **iblai-vibe-auth** skill — add ibl.ai SSO authentication to vanilla Next.js apps
- **iblai-chat** skill — add AI chat widget
- **iblai-vibe-profile** skill — profile dropdown and settings page
- **iblai-vibe-account** skill — account and organization settings
- **iblai-vibe-analytics** skill — analytics dashboard with full tabbed layout (Overview, Users, Topics, Financial, Transcripts, Reports)
- **iblai-vibe-notification** skill — notification bell and center page
- **iblai-vibe-invite** skill — user invitation dialogs
- **iblai-vibe-workflow** skill — workflow builder components
- **iblai-vibe-component** skill — component and feature reference
- **iblai-vibe-ops-build** skill — build and run on desktop and mobile (iOS, Android, macOS, Surface) via Tauri v2
- **iblai-marketing-screenshot** skill — capture app store screenshots for web (Playwright), iOS (Simulator), and Android (Emulator)
- **iblai-vibe-onboard** skill — questionnaire-style onboarding flow designer with 14 screen archetypes, 5-phase process, and Apple-inspired visual guidelines
- **iblai-vibe-ops-test** skill — build and touch testing validation
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
- Screenshots for iblai-vibe-invite, iblai-vibe-workflow, and iblai-vibe-onboard skills
