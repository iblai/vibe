# Changelog

All notable changes to the [vibe](https://github.com/iblai/vibe) toolkit.

## [1.1.0] - 2026-04-16

### Added
- **iblai-navbar** skill — responsive navbar with ibl.ai logo, Home/Profile/Account links with icons, notification bell, and profile dropdown; creates all linked pages (profile, account, notifications) automatically
- **iblai-marketing-landing** skill — build a high-converting landing page using a 12-section conversion framework
- **iblai-ops-deploy** skill — deploy to Vercel (or other platforms)
- **iblai-ops-init** skill — update project CLAUDE.md with ibl.ai platform guidance
- **iblai-agent-search** skill — agent search/browse page (starred, featured, custom, default agents)
- **iblai-agent-settings** skill — agent Settings tab (name, visibility, copy, delete)
- **iblai-agent-access** skill — agent Access tab (RBAC for editor and chat roles)
- **iblai-agent-api** skill — agent API tab (API key management)
- **iblai-agent-datasets** skill — agent Datasets tab (searchable dataset table with upload)
- **iblai-agent-disclaimers** skill — agent Disclaimers tab (user agreement and advisory)
- **iblai-agent-embed** skill — agent Embed tab (embed code, custom styling, shareable links)
- **iblai-agent-history** skill — agent History tab (conversation history with filters and export)
- **iblai-agent-llm** skill — agent LLM tab (model provider selection)
- **iblai-agent-memory** skill — agent Memory tab (enable/disable memory and manage memories)
- **iblai-agent-prompts** skill — agent Prompts tab (system prompts and suggested prompts)
- **iblai-agent-safety** skill — agent Safety tab (moderation prompts and flagged content)
- **iblai-agent-tools** skill — agent Tools tab (enable/disable agent tools)

### Changed
- **iblai-auth** now asks "Do you want a navbar?" during setup (Step 2) and runs `/iblai-navbar` automatically if yes
- **iblai-profile** updated with full Profile Content API documentation (Basic, Social, Education, Experience, Resume, Security tabs), RTK Query hooks, custom career API slice, AI Profile Memory API, chat privacy settings, and MediaBox integration
- **iblai-profile**, **iblai-notification**, **iblai-account** skills now reference `/iblai-navbar` for navbar setup
- Component hierarchy standardized across all skills: ibl.ai SDK first, then shadcn/ui, then custom
- Navbar uses BRAND.md colors (brand blue `#0058cc`) instead of amber for active states
- Navbar logo served locally from `public/images/` instead of external URL
- Profile REST API endpoints documented with "read before write" warning and curl examples

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
