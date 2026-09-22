# Ship anywhere

### ibl.ai hosting (recommended)

Deploy through the ibl.ai platform's hosting API (Vercel-backed) -- see
[`/iblai-vibe-ops-deploy`](../skills/ship/iblai-vibe-ops-deploy/SKILL.md). No Vercel
account or token: the skill zips your app, uploads it with your platform
API key, polls until the build is READY, and returns the live `*.vercel.app` URL
Vercel reports.


### Tauri (Desktop & Mobile)

Build native apps for macOS, Windows, Linux, iOS, and Android:

Add the Tauri shell (see [`/iblai-vibe-ops-build`](../skills/ship/iblai-vibe-ops-build/SKILL.md)), then:

```bash
pnpm exec tauri build           # Desktop build for current platform
pnpm exec tauri ios init        # iOS project setup
```

### Ship to the App Store & Google Play

Once the Tauri shell is in place, [`/iblai-vibe-ops-release`](../skills/ship/iblai-vibe-ops-release/SKILL.md)
generates a `Makefile` + [Fastlane](https://fastlane.tools) config that builds
**and submits** your app to both stores from one command. Tauri produces the
`.ipa` / `.aab`; Fastlane creates the app records and uploads the binaries.

Run the skill, then fill in `fastlane/.env` with your store credentials
(App Store Connect API key + Google Play service-account JSON -- see the skill's
[`references/credentials.md`](../skills/ship/iblai-vibe-ops-release/references/credentials.md)):

```bash
make doctor            # verify tooling + credentials are in place
make ios-create        # create the App Store Connect app record + bundle id
make ios-release       # build the .ipa and upload to TestFlight
make android-release   # build the .aab and upload to the Play internal track
make release-all       # ship to both stores
```

**Two platform constraints to know up front:**

- **Google Play** cannot create the app listing or accept the *first* upload via
  API -- create the app in the Play Console and push one `.aab` by hand once,
  then `make android-release` handles every release after that.
- **Apple** uploads run unattended with the API key, but creating the app record
  (`make ios-create`) may prompt for Apple-ID auth; the skill documents the
  app-specific-password fallback.

`make *-submit` pushes to TestFlight / the Play internal track -- promoting to
public App Store review or production stays a deliberate step in the consoles.
#### Signed desktop releases (macOS DMG + Windows NSIS)

`/iblai-vibe-ops-build` also ships **signed, distributable** desktop builds —
a **notarized** universal macOS `.dmg` (Intel + Apple Silicon) and **signed**
NSIS installers for Windows **x64 + arm64**. Run them two ways:

- **CI** — copy the `tauri-release-macos-dmg.yml` / `tauri-release-windows.yml`
  workflows into `.github/workflows/`, then push an `app-v*` tag. Each build is
  signed (macOS also notarized + stapled) and attached to that tag's GitHub
  Release. Great for producing macOS + Windows (+ arm64) from a single push.
- **Local (no CI)** — copy `desktop-release.mk` to your project root and build
  on your own machine:

  ```bash
  make -f desktop-release.mk macos-dmg      # signed + notarized universal DMG
  make -f desktop-release.mk windows-nsis   # signed NSIS installer (on Windows)
  ```

Credentials (Apple Developer ID cert + notarization password; optional Windows
cert) are the same for both paths — full setup in
[`references/signed-release.md`](../skills/ship/iblai-vibe-ops-build/references/signed-release.md).
For a Windows Store / sideload **MSIX** package instead, see
[`/iblai-vibe-windows-msix`](../skills/ship/iblai-vibe-windows-msix/SKILL.md).

