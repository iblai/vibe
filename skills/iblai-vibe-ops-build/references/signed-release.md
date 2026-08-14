# Signed desktop release builds (macOS DMG + Windows NSIS)

The two release workflows in
[`assets/tauri/workflows/`](../assets/tauri/workflows/) build **distributable,
signed** desktop installers and attach them to a GitHub Release — separate from
the unsigned, build-only `tauri-build-desktop.yml` (which is fine for quick CI
checks and also covers Linux).

| Workflow | Output | Signing |
|---|---|---|
| `tauri-release-macos-dmg.yml` | Universal `.dmg` (Intel + Apple Silicon) | Developer ID + **notarized + stapled** — opens with no Gatekeeper warning |
| `tauri-release-windows.yml` | NSIS `-setup.exe` for **x64 + arm64** | Authenticode (stored `.pfx` or a runner-generated self-signed cert) |

Copy them into `.github/workflows/` alongside your project.

> **Don't want CI?** The signing steps aren't GitHub-specific — you can run the
> exact same `tauri build` + signing locally on your own Mac / Windows machine.
> See [Local builds (no CI)](#local-builds-no-ci) below. The credential setup in
> the rest of this doc applies to both paths — CI reads it from Actions
> secrets/variables, local reads it from `desktop-signing.env`.

## How they trigger

Both run on:

- **`app-v*` tag push** → build, sign, and **attach the installer to that tag's
  Release** (created as a fallback if it doesn't exist).
- **Manual "Run workflow"** (`workflow_dispatch`) → build-only, uploads a CI
  artifact, no Release.

Create a release by tagging:

```bash
git tag app-v1.2.3
git push origin app-v1.2.3
```

> The mentorai app automates this with a `tauri-autoversion` workflow that bumps
> `src-tauri/tauri.conf.json` and pushes the `app-v<X>` tag whenever `src-tauri/`
> changes on `main`. That's optional — tagging by hand or using
> `workflow_dispatch` works without it.

---

## Local builds (no CI)

For building on your own machine without GitHub, copy `assets/tauri/desktop-release.mk`
and `assets/tauri/desktop-signing.env.example` into your project root:

```bash
cp desktop-signing.env.example desktop-signing.env   # then fill in + gitignore it
make -f desktop-release.mk doctor          # check tooling + config
make -f desktop-release.mk macos-dmg       # signed + notarized universal DMG
make -f desktop-release.mk windows-nsis    # signed NSIS installer (run on Windows)
```

`desktop-release.mk` loads your credentials from `desktop-signing.env` and runs
the same `tauri build` the workflow does — Tauri reads the `APPLE_*` env vars and
signs + notarizes automatically. The credential values are identical to the CI
ones below; you just put them in `desktop-signing.env` instead of Actions
secrets. Caveats vs CI:

- **You build on the target OS you own.** A universal macOS DMG needs a Mac;
  the Windows installer needs Windows. CI gives you both (plus arm64) from any
  push — that's its main advantage over local.
- **macOS**: `rustup target add aarch64-apple-darwin x86_64-apple-darwin` first
  (for the universal binary).
- **Windows**: set `bundle.windows.certificateThumbprint` in `tauri.conf.json`
  to a cert in your CurrentUser store (there's no env var for it), and run `make`
  under Git Bash / MSYS2 / WSL.

---

## macOS — Developer ID signing + notarization

Requires a paid **Apple Developer Program** membership.

### 1. Export the Developer ID Application certificate

In Xcode (Settings → Accounts → Manage Certificates) or the
[Developer portal](https://developer.apple.com/account/resources/certificates),
create a **Developer ID Application** certificate. Then export it from
**Keychain Access** as a `.p12` (right-click the cert → Export, set a password),
and base64-encode it:

```bash
base64 -i DeveloperID_Application.p12 | pbcopy
```

### 2. Create an app-specific password for notarization

At [account.apple.com](https://account.apple.com) → Sign-In and Security →
App-Specific Passwords, generate one for notarization.

### 3. Set the secrets and variables

**Secrets** (Settings → Secrets and variables → Actions → *Secrets*):

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | base64 of the `.p12` (step 1) |
| `APPLE_CERTIFICATE_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | the app-specific password (step 2) |

**Variables** (same page → *Variables* — these are not secret):

| Variable | Value |
|---|---|
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Acme, LLC (TEAMID)` |
| `APPLE_TEAM_ID` | your 10-char team id, e.g. `TEAMID` |

`tauri-action` imports the cert into a temporary keychain, signs the universal
`.app`, builds the `.dmg`, then submits it to Apple's notary service and staples
the ticket — all from the `APPLE_*` env it reads. No extra config file is
needed. (If you want a hardened-runtime entitlements overlay, pass
`--config src-tauri/tauri.<name>.conf.json` in the workflow's `args`.)

---

## Windows — Authenticode signing (x64 + arm64)

The workflow signs with a stored certificate if you provide one, otherwise it
**generates a self-signed cert in the runner** so you get a signed installer
with zero setup. Self-signed installers still trip SmartScen­e/"unknown
publisher" until enough installs build reputation — for a trusted publisher, buy
an OV/EV code-signing cert and store it as the secrets below.

### Prerequisite: `certificateThumbprint: null` in `tauri.conf.json`

The signing step injects the resolved thumbprint into
`bundle.windows.certificateThumbprint`, so that field must exist as `null`:

```jsonc
"bundle": {
  "windows": {
    "certificateThumbprint": null,
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

The vibe's `tauri.conf.json` template already includes this. (`null` = unsigned
for local `pnpm exec tauri build`; only CI injects a real thumbprint.)

### Optional: a stored self-signed cert (stable publisher)

Generate a self-signed `.pfx` once and base64 it, so every build shares one
publisher/thumbprint instead of a fresh one per run:

```powershell
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject 'CN=Acme App, O=Acme' -CertStoreLocation Cert:\CurrentUser\My `
  -KeyExportPolicy Exportable -KeyAlgorithm RSA -KeyLength 2048 `
  -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(5)
$pw = ConvertTo-SecureString 'a-strong-password' -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath signing.pfx -Password $pw
[Convert]::ToBase64String([IO.File]::ReadAllBytes('signing.pfx')) | Set-Clipboard
```

Then set:

| Setting | Type | Value |
|---|---|---|
| `WINDOWS_CERTIFICATE` | secret | base64 of the `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | secret | the `.pfx` password |
| `WINDOWS_CERT_SUBJECT` | variable | subject for the *generated* cert if no `.pfx` is stored (optional) |

Leave `WINDOWS_CERTIFICATE` unset to use the auto-generated cert path.

### arm64 note

arm64 is cross-compiled on the x64 `windows-latest` runner — the GitHub-hosted
image already ships the MSVC ARM64 tools + Windows 11 SDK. Only **NSIS** builds
for both architectures (MSI/WiX has no arm64 target), so the workflow restricts
bundling to `--bundles nsis`.

---

## Compile-time app flags

Both workflows forward this shell's build-time flags to `tauri-action` from repo
variables (empty = the "off" default), so a signed release can also be
tenant-locked or IAP-enabled without editing the workflow:

| Variable | Effect |
|---|---|
| `IBL_ALLOW_IN_APP_PURCHASE` | `true` enables the in-app-purchase UI |
| `IBL_TENANT` | locks the build to one tenant key |

See the **Build-Time Flags** section of [`../SKILL.md`](../SKILL.md) for what
these do at runtime.
