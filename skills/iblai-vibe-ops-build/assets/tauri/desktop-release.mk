# Local signed desktop release builds — no CI required.
#
# Companion to /iblai-vibe-ops-build's GitHub workflows: same sign + notarize
# steps, run on your own Mac / Windows machine instead of a runner. Copy this
# file + desktop-signing.env.example to your project root.
#
#   make -f desktop-release.mk doctor
#   make -f desktop-release.mk macos-dmg          # signed + notarized universal DMG
#   make -f desktop-release.mk macos-dmg-unsigned # quick unsigned universal DMG
#   make -f desktop-release.mk windows-nsis       # signed NSIS installer
#
# Or `include desktop-release.mk` from an existing Makefile (e.g. the one from
# /iblai-vibe-ops-release) to get these targets alongside it.
#
# Credentials load from desktop-signing.env (copy desktop-signing.env.example
# and fill it in; gitignore it). Full setup: references/signed-release.md.

ENV_FILE ?= desktop-signing.env
-include $(ENV_FILE)
export

MACOS_DMG := src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
WIN_NSIS  := src-tauri/target/*/release/bundle/nsis/*-setup.exe

.DEFAULT_GOAL := help
.PHONY: help doctor macos-dmg macos-dmg-unsigned windows-nsis

help: ## List available targets
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

doctor: ## Check tooling + signing config
	@command -v pnpm  >/dev/null 2>&1 && echo "  ok  pnpm"  || echo "  MISSING pnpm"
	@command -v cargo >/dev/null 2>&1 && echo "  ok  cargo" || echo "  MISSING rust toolchain (rustup.rs)"
	@test -f $(ENV_FILE) && echo "  ok  $(ENV_FILE)" || echo "  MISSING $(ENV_FILE) (cp desktop-signing.env.example desktop-signing.env)"
	@test -n "$(APPLE_SIGNING_IDENTITY)" && echo "  ok  APPLE_SIGNING_IDENTITY set" || echo "  note (macOS) set APPLE_SIGNING_IDENTITY to sign + notarize"
	@rustup target list --installed 2>/dev/null | grep -q aarch64-apple-darwin \
		&& echo "  ok  macOS universal targets" \
		|| echo "  note (macOS) rustup target add aarch64-apple-darwin x86_64-apple-darwin"

# Tauri reads APPLE_* from the environment: signs the universal .app with the
# Developer ID identity, then notarizes + staples the DMG when APPLE_ID +
# APPLE_PASSWORD + APPLE_TEAM_ID are present. Leaving APPLE_CERTIFICATE empty
# uses a Developer ID identity already in your login keychain.
macos-dmg: ## Signed + notarized universal DMG (needs APPLE_* in the env file)
	@test -n "$(APPLE_SIGNING_IDENTITY)" || { echo "APPLE_SIGNING_IDENTITY not set — see references/signed-release.md"; exit 1; }
	pnpm exec tauri build --target universal-apple-darwin --bundles app,dmg
	@echo "Built (signed): $(MACOS_DMG)"

macos-dmg-unsigned: ## Universal DMG without signing (quick local build)
	pnpm exec tauri build --target universal-apple-darwin --bundles app,dmg
	@echo "Built (unsigned): $(MACOS_DMG)"

# Signs via signtool when bundle.windows.certificateThumbprint is set in
# tauri.conf.json. There is no env var Tauri reads for the thumbprint — set it
# in the config to the thumbprint of a cert in your CurrentUser store first
# (see references/signed-release.md). Run under a shell that has `make`
# (Git Bash / MSYS2 / WSL).
windows-nsis: ## Signed NSIS installer (needs certificateThumbprint set in tauri.conf.json)
	pnpm exec tauri build --bundles nsis
	@echo "Built: $(WIN_NSIS)"
