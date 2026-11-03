# iOS and Android projects — generate once, commit, build in CI

Moved out of `SKILL.md` to keep the skill scannable: the full procedure for the
native projects `tauri ios init` and `tauri android init` generate.

## The generated projects are committed

`src-tauri/gen/apple` (the Xcode project) and `src-tauri/gen/android` (the
Gradle project) are committed, each with the `.gitignore` the generator writes
for its build output (iOS: `xcuserdata/`, `build/`, `Externals/`; Android:
`build`, `.gradle`, `local.properties`, `key.properties`,
`keystore.properties`, `/.tauri`, `/tauri.settings.gradle`). Generating needs a
Mac with Xcode or the Android SDK and NDK; committing means CI and every
machine build one and the same project, and the hand edits a release needs (the
team, capabilities, the privacy manifest) survive. The CI workflows run `init`
only when the directory is missing. iblai/os tracks its iOS project the same way.

## Generate: `scripts/mobile-init.sh`, once per OS

Copy `assets/tauri/scripts/mobile-init.sh` into `scripts/`. It generates the
project for the machine it runs on — macOS → iOS, Linux → Android — and fails
loudly on a missing prerequisite instead of generating half a project:

```bash
bash scripts/mobile-init.sh
```

| OS | It needs | It does |
|---|---|---|
| macOS | Xcode from the App Store (`xcode-select -p` must point into `Xcode.app`; the command-line tools alone are not enough), `rustup`, `pnpm`, `xcodegen` (`brew install xcodegen`) | adds the `aarch64-apple-ios`, `aarch64-apple-ios-sim` and `x86_64-apple-ios` targets, runs `pnpm exec tauri ios init`, copies `src-tauri/PrivacyInfo.xcprivacy` into `gen/apple/<package>_iOS/` and runs `xcodegen generate` so the project bundles it |
| Linux | `rustup`, `pnpm`, JDK 17 and the Android SDK — Platform-Tools, Build-Tools, a platform and an NDK — exported as `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME` | adds the four Android targets, runs `pnpm exec tauri android init` |

Then **one build before the commit**: the deep-link plugin writes the URL
scheme into the project only while the CLI builds for that platform —
`CFBundleURLTypes` into `gen/apple/<package>_iOS/Info.plist`, the
`<intent-filter>` into `gen/android/app/src/main/AndroidManifest.xml` — never
on `cargo check`. A project committed without that build gets the edit as a
dirty diff on its first CI build.

```bash
xcrun simctl list devices                        # pick a simulator name
pnpm exec tauri ios dev "iPhone 16 Pro"          # writes CFBundleURLTypes
git add src-tauri/gen/apple

pnpm exec tauri android build --debug --apk      # writes the intent filter
git add src-tauri/gen/android
```

### Linux prerequisites for the Android project

Android Studio's SDK Manager installs everything: an SDK Platform (35),
Build-Tools, Platform-Tools, Command-line Tools and an NDK (side by side).
Headless, the command-line tools do the same:

```bash
sdkmanager --install "platform-tools" "platforms;android-35" "build-tools;35.0.0" "ndk;27.3.13750724"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk     # the Gradle plugin's JDK
export ANDROID_HOME=$HOME/Android/Sdk             # Android Studio's default; /opt/android-sdk for the AUR package
export NDK_HOME=$ANDROID_HOME/ndk/27.3.13750724
```

On Arch: `sudo pacman -S --needed jdk17-openjdk rustup` (the distro `rust`
package cannot add targets), then `android-studio` or
`android-sdk-cmdline-tools-latest` from the AUR (the latter installs under
`/opt/android-sdk`, writable for the `android-sdk` group).

## The privacy manifest

Tauri's iOS template ships no `PrivacyInfo.xcprivacy`, and App Store Connect
rejects an upload whose binary uses the file-timestamp APIs — a Rust binary
does — without one (ITMS-91053). The shell ships
`src-tauri/PrivacyInfo.xcprivacy` — no tracking, nothing collected, reason
`C617.1` — and the script puts it in the app folder, which `project.yml` lists
as a source, so `xcodegen generate` adds it to the target's resources. An app
that does more adds the matching reasons there (iblai/os adds `E174.1` for its
on-device model downloads). `project.yml` is the source of truth: a change made
only in the `.pbxproj` is lost on the next regeneration.

## The deep link is scheme-only

```json
"plugins": { "deep-link": { "mobile": [{ "scheme": ["my-app"] }] } }
```

The plugin emits one `<data …/>` per field of the entry, so a `host` narrows
the Android intent filter to `android:host="…"`, and a host-less
`my-app:///sso-login-complete` never matches it. Add a `host` only for
universal links, with an `apple-app-site-association` and an `assetlinks.json`
served on that host.

## Sign-in returns on two schemes

The auth app brings the webview back on **two** custom schemes: from the
system browser (Google, Apple) on the app's own `my-app://`, and from inside
the webview (email and password) on its own `iblai-mentor://`, which it
hard-codes. `src-tauri/src/lib.rs` rewrites both onto the app URL
(`sign_in_return`, run first in every `on_navigation`; the result loads from a
spawned thread — never call into a webview from inside its own handler) and
registers only `my-app` as a scheme. The redirect origins the organization
must allow: [`SKILL.md`](../SKILL.md), "Redirect origins for native shells".

## CI

| Workflow | Runner | Produces |
|---|---|---|
| `tauri-build-ios.yml` | macOS | an `.ipa` exported for App Store Connect (`APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`); `ios init` only without `gen/apple` |
| `tauri-build-android.yml` | `ubuntu-24.04`, which ships the SDK as `ANDROID_HOME`, an NDK as `ANDROID_NDK_HOME` (the CLI reads `NDK_HOME`; the workflow exports it) and JDK 17 | an **unsigned** `.aab` and `.apk`; `android init` only without `gen/android`; fails unless `libapp_lib.so` is 16 KB page-aligned, Google Play's requirement — `src-tauri/.cargo/config.toml` passes the linker flags |
| `tauri-check.yml` | `ubuntu-24.04` | nothing: `cargo fmt --check`, `cargo check` and `cargo test` with warnings denied on every change under `src-tauri/` |

The unsigned Android artifacts install nowhere and upload nowhere until an
upload keystore signs them —
[`/iblai-vibe-ops-release`](../../iblai-vibe-ops-release/SKILL.md), "Signing
prerequisites".

## Keep the npm packages and the crates on one minor

The Tauri CLI refuses `tauri build` when `@tauri-apps/api`,
`@tauri-apps/plugin-*` or `@tauri-apps/cli` differs from its crate in the
minor ("Found version mismatched Tauri packages"), while `cargo check` and
`cargo test` pass regardless. Bump them together; the SDK imports
`@tauri-apps/plugin-os`, so the app owns that version too.
