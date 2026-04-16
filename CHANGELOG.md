# Changelog

All notable changes to the [vibe](https://github.com/iblai/vibe) toolkit.

## [Unreleased]

### Added
- **iblai-agent-search** skill — agent search/browse page with starred, featured, custom, and default agents sections
- **iblai-agent-setting** skill — agent Settings tab (name, description, visibility, copy, delete) built on `AgentSettingsProvider`
- **iblai-agent-access** skill — agent Access tab (role-based access control for editor and chat roles)
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
- Tab skills renamed from `iblai-<name>-tab` to `iblai-agent-<name>` convention (folders, images, frontmatter, headers, cross-references)
- Singularized plural skill names: `datasets`→`dataset`, `disclaimers`→`disclaimer`, `prompts`→`prompt`, `settings`→`setting`, `tools`→`tool`
- Images renamed to `iblai-agent-<name>.png` convention
- SDK component references updated to use `Agent`-prefixed names (`AgentSettingsTab`, `AgentAccessTab`, etc.)

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
- **iblai-build** skill — build and run on desktop and mobile (iOS, Android, macOS, Surface) via Tauri v2
- **iblai-screenshot** skill — capture app store screenshots for web (Playwright), iOS (Simulator), and Android (Emulator)
- **iblai-onboard** skill — questionnaire-style onboarding flow designer with 14 screen archetypes, 5-phase process, and Apple-inspired visual guidelines
- **iblai-test** skill — build and touch testing validation
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
