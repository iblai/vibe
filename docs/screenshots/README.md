# Screenshots

Pictures are how a builder decides in five seconds whether a skill gives them
what they want, and the only way to follow a click path in the ibl.ai OS.
Every Tier 0/1 skill has at least one; the journey set below illustrates
`docs/platform-lifecycle.md` and the README.

## Conventions

- **Format:** PNG, 1440×900 viewport, 1× DPR, light mode, no browser chrome.
  Under 400 KB each (`oxipng -o 4` or `pngquant --quality 70-90`).
- **Names:** `skills/<skill>/<skill>-<n>-<slug>.png` for a skill;
  `docs/screenshots/journey/<nn>-<slug>.png` for the journey.
- **Reference them** by raw GitHub URL inside a SKILL.md
  (`https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/<skill>/<file>.png`)
  and by relative path in README/docs.
- **Sanitize.** Use the demo org ("Acme Demo", `demo-admin@example.com`,
  `demo-member@example.com`). Never a real email, org key, agent UUID from a
  customer org, or any token — crop or blur. Re-capture when the SDK changes
  the surface.

## Journey manifest (`docs/screenshots/journey/`)

| File | Shows | Source |
|---|---|---|
| `00-join.png` | `ibl.ai/join` sign-up form | manual |
| `01-me-org-key.png` | `login.iblai.app/me` with an org block and its key | manual |
| `02-os-admin-toggle.png` | os.ibl.ai top bar, User/Admin toggle in Admin | manual |
| `02b-os-integrations-apis-add.png` | Integrations → APIs → Add API dialog (no key visible) | manual |
| `02c-os-billing-plan-credits.png` | Billing → Plan & Credits (Free plan) | manual |
| `02d-os-integrations-llms.png` | Integrations → LLMs with one masked key | manual |
| `03-starter-home-chat.png` | vibe-starter home chatting with the default agent — the README hero | `scripts/capture-screenshots.mjs` |
| `03b-starter-home-empty.png` | the "No agent yet" empty state | script |
| `04-starter-setup.png` | `/setup` pick-or-create agent | script |
| `05-starter-agents.png` | `/agents` | script |
| `06-starter-profile-preferences.png` | `/profile` with the app preferences card | script |
| `07-admin-users.png` | `/admin/users` (Users tab, Invite button) | script |
| `08-admin-analytics.png` | `/admin/analytics` overview | script |
| `09-admin-organization.png` | `/admin/organization` with the app settings form | script |
| `10-user-mode.png` | the same app in User mode (no admin links) | script |
| `11-login-custom.png` | the customized `login.iblai.app` page | manual |
| `12-deploy-ready.png` | terminal: READY + URL (masked) | manual |
| `13-macos.png`, `13-ios.png`, `13-android.png`, `13-windows.png` | native shells | reuse `skills/iblai-vibe-ops-build/*.png`; capture Windows |

Per-skill screenshots for the new skills: `iblai-vibe-user-metadata-1-preferences.png`,
`iblai-vibe-user-metadata-2-admin.png`, `iblai-vibe-org-metadata-1-settings.png`,
`iblai-vibe-admin-{1-user-mode,2-admin-mode,3-users}.png`,
`iblai-vibe-agent-create-1-dialog.png` — the script writes these too.

## Capturing the starter set

Needs a running starter (`pnpm dev` in a scaffolded app or in
`skills/iblai-vibe-ops-init/assets/vibe-starter` with a real `.env.local`) and
the Playwright credentials in `e2e/.env.development` (an **admin** of the demo
org). From the repo root:

```bash
node scripts/capture-screenshots.mjs --app http://localhost:3000 \
  --starter skills/iblai-vibe-ops-init/assets/vibe-starter
```

It reuses `e2e/auth.setup.ts` for the sign-in, walks the routes in both view
modes, and writes every file in the manifest. OS / `login.iblai.app` /
`ibl.ai/join` captures are manual (blur emails before committing).
