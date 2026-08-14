# iblai-vibe-ops-release

> Generate a Makefile + Fastlane config that builds and submits your Tauri app to the Apple App Store and Google Play. Use when the user mentions submitting/shipping/releasing to the App Store or Play Store, App Store Connect, Play Console, TestFlight, `.ipa`/`.aab` upload, Fastlane, creating an app record or bundle id, or wiring store credentials (App Store Connect API key, Play service account) into a Makefile. Builds on /iblai-vibe-ops-build (Tauri shell must exist first).

# /iblai-vibe-ops-release — Build & Submit to the App Stores

Generate a `Makefile` and a `fastlane/` config so a single command builds
your Tauri app and submits it to the **Apple App Store** (App Store Connect
/ TestFlight) and **Google Play**. Fastlane handles app-record / bundle-id
creation and the upload; Tauri (from
[`/iblai-vibe-ops-build`](../iblai-vibe-ops-build/SKILL.md)) still produces the
`.ipa` / `.aab`.

```
make ios-release        # build .ipa  -> upload to TestFlight
make android-release    # build .aab  -> upload to Play internal track
make release-all        # both
```

## Prerequisites

1. **Tauri shell already added** and the mobile projects initialized —
   [`/iblai-vibe-ops-build`](../iblai-vibe-ops-build/SKILL.md)
   (`pnpm exec tauri ios init`, `pnpm exec tauri android init`). This skill
   assumes `src-tauri/gen/apple` and `src-tauri/gen/android` exist.
2. **Fastlane** installed: `brew install fastlane` (macOS) or
   `gem install fastlane`. Verify with `fastlane --version`.
3. **Store accounts**: an Apple Developer Program membership ($99/yr) and a
   Google Play Developer account (one-time $25).
4. **Credentials** obtained and placed as described in
   [`references/credentials.md`](references/credentials.md) — the App Store
   Connect API key (`.p8`) and the Google Play service-account JSON.

## Two honest constraints (read before promising full automation)

These are platform limits, not skill limits — the Makefile is built around them:

- **Google Play cannot create the app or accept the *first* upload via the
  API.** You must create the app listing **once** in the Play Console and push
  the **first** `.aab` there by hand. After that, `make android-submit`
  (Fastlane `supply`) updates it on every release. `make android-create` only
  validates that your service account has access.
- **Apple app creation may require Apple-ID (session) auth.** Uploading a build
  works with the API key alone, but `produce` (creating the App Store Connect
  record + bundle id) sometimes needs an Apple-ID login with an
  app-specific password / 2FA. `make ios-create` tries the API key first;
  if Apple refuses, set `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` (see
  the credentials reference) or create the app once in App Store Connect.

## What this skill installs

Copy these into the project root (they are ready-to-use, values come from env
— no templating):

| File | Purpose |
|---|---|
| [`assets/Makefile`](assets/Makefile) | The build/submit targets (below) |
| [`assets/fastlane/Fastfile`](assets/fastlane/Fastfile) | Fastlane lanes for both platforms |
| [`assets/fastlane/Appfile`](assets/fastlane/Appfile) | Maps env vars → app identifiers |
| [`assets/fastlane/.env.example`](assets/fastlane/.env.example) | Credential template — copy to `fastlane/.env` and fill in |

### Install steps

```bash
# from the project root
cp <skill>/assets/Makefile ./Makefile
mkdir -p fastlane
cp <skill>/assets/fastlane/Fastfile   fastlane/Fastfile
cp <skill>/assets/fastlane/Appfile    fastlane/Appfile
cp <skill>/assets/fastlane/.env.example fastlane/.env      # then fill it in
```

Then **gitignore the secrets** (append if missing):

```gitignore
fastlane/.env
fastlane/*.p8
fastlane/*.json
fastlane/report.xml
```

Fill in `fastlane/.env` with the values from
[`references/credentials.md`](references/credentials.md), drop the `.p8` and
the Play service-account `.json` into `fastlane/`, then run `make doctor`.

## Makefile targets

| Target | What it does |
|---|---|
| `make help` | List all targets |
| `make doctor` | Check tools (fastlane, tauri, cargo) + that `fastlane/.env` and creds exist |
| `make bump VERSION=1.2.3` | Rewrite `version` in `src-tauri/tauri.conf.json` |
| **iOS** | |
| `make ios-create` | Fastlane `produce` — create the App Store Connect app record + bundle id |
| `make ios-build` | `tauri ios build --export-method app-store-connect` (signed store `.ipa`) |
| `make ios-submit` | Fastlane `pilot` — upload the newest `.ipa` to TestFlight |
| `make ios-release` | `ios-build` then `ios-submit` |
| **Android** | |
| `make android-create` | Validate the Play service-account access (see constraint above) |
| `make android-build` | `tauri android build --aab` (release App Bundle) |
| `make android-submit` | Fastlane `supply` — upload the newest `.aab` to the internal track |
| `make android-release` | `android-build` then `android-submit` |
| **Both** | |
| `make release-all` | `ios-release` + `android-release` |

The submit lanes locate the freshest artifact automatically
(`src-tauri/gen/apple/**/*.ipa`, `src-tauri/gen/android/**/*.aab`); override
with `IPA_PATH=` / `AAB_PATH=` if needed.

## Signing prerequisites (do once)

- **iOS** — `make ios-build` uses App-Store-Connect-API-key managed signing
  (the same `ASC_*` vars). If Xcode-managed signing is set up instead, open
  `src-tauri/gen/apple/*.xcodeproj` → Signing & Capabilities and set your Team.
- **Android** — a release `.aab` must be signed with a **release keystore**.
  Generate one and point Tauri at it:
  ```bash
  keytool -genkey -v -keystore ~/release.jks -keyalg RSA -keysize 2048 \
    -validity 10000 -alias upload
  ```
  Create `src-tauri/gen/android/keystore.properties`:
  ```properties
  storeFile=/absolute/path/to/release.jks
  storePassword=...
  keyAlias=upload
  keyPassword=...
  ```
  (gitignore `keystore.properties` and the `.jks`.) For Play App Signing, this
  is your **upload** key — Google re-signs with the app key it manages.

## Typical first run

```bash
make doctor            # confirm tooling + creds
make ios-create        # create the ASC app + bundle id
make ios-release       # build + upload to TestFlight

# Android — create the app + do the FIRST upload in Play Console by hand, then:
make android-release   # every subsequent release
```

## Promoting a build

`make *-submit` uploads to **TestFlight** (iOS) and the **internal** track
(Android, as a draft). Promoting to public App Store review / production is
left to the consoles (or extend the Fastfile with `deliver` /
`supply track_promote_to`). This keeps releases deliberate — see
[`references/credentials.md`](references/credentials.md) for the extension notes.

## Reference

- [`references/credentials.md`](references/credentials.md) — how to obtain and
  place every credential (App Store Connect API key, Play service account,
  Android keystore) and the required roles.
- [`/iblai-vibe-ops-build`](../iblai-vibe-ops-build/SKILL.md) — the Tauri shell
  and per-platform build commands this skill wraps.
- [`/iblai-vibe-ops-deploy`](../iblai-vibe-ops-deploy/SKILL.md) — web/Vercel deploy.