# iblai-windows-msix

> Build and distribute a Tauri app as a Windows MSIX package for sideloading (test) or the Microsoft Store (release). Use when the user mentions MSIX, Windows packaging, Microsoft Store / Partner Center submission, sideloading, AppxManifest, or signing a Windows desktop build. For the general desktop/mobile build flow, see iblai-ops-build.

# Build Windows MSIX

Build and distribute your Tauri app as a Windows MSIX package for
sideloading (test) or Microsoft Store (release).

---

## Test Build (Sideloading)

For local development and testing on your own machine.

### Prerequisites

1. **Enable Developer Mode** (one-time):
   `Settings > Update & Security > For developers > Developer Mode: ON`

2. Rust toolchain installed (`rustc --version`)
3. Dependencies installed (`pnpm install`)

### Steps

```powershell
# 1. Create and trust a dev certificate (one-time)
pnpm tauri:setup:cert
# Output:
#   Thumbprint: ABC123DEF456...
#   (save this thumbprint)

# 2. Build the Tauri app
pnpm tauri:build

# 3. Package as MSIX and sign with the dev cert
.\src-tauri\build-msix.ps1 -SkipTauriBuild -CertThumbprint "ABC123DEF456..."

# 4. Install the MSIX
Add-AppxPackage -Path src-tauri\msix-output\*.msix
# Or double-click the .msix file in Explorer
```

### Build for arm64

```powershell
# Build the Tauri app for arm64
pnpm exec tauri build --target aarch64-pc-windows-msvc

# Package as arm64 MSIX
.\src-tauri\build-msix.ps1 -SkipTauriBuild -Architecture arm64 -CertThumbprint "ABC123..."
```

### Uninstall

```powershell
# Find the package
Get-AppxPackage -Name "com.your.app.*"

# Remove it
Get-AppxPackage -Name "com.your.app.*" | Remove-AppxPackage
```

---

## Release Build (Microsoft Store)

For submitting to the Microsoft Store via Partner Center.

### Prerequisites

1. [Partner Center](https://partner.microsoft.com/) developer account
2. App reservation in Partner Center (creates the app identity)
3. From Partner Center, note these values:
   - **Identity Name** (e.g., `CompanyName.AppName`)
   - **Publisher** (e.g., `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`)
   - **Publisher Display Name**

### Steps

#### 1. Update `src-tauri/AppxManifest.xml` with Store identity

Replace the dev identity values with the ones from Partner Center:

```xml
<Identity
  Name="CompanyName.AppName"
  Publisher="CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
  Version="1.0.0.0"
  ProcessorArchitecture="x64" />

<Properties>
  <DisplayName>Your App Name</DisplayName>
  <PublisherDisplayName>Your Company</PublisherDisplayName>
  ...
</Properties>
```

#### 2. Build MSIX for both architectures

```powershell
# Build x64
pnpm exec tauri build --target x86_64-pc-windows-msvc
.\src-tauri\build-msix.ps1 -SkipTauriBuild -Architecture x64

# Build arm64
pnpm exec tauri build --target aarch64-pc-windows-msvc
.\src-tauri\build-msix.ps1 -SkipTauriBuild -Architecture arm64
```

Both MSIX files are written to `src-tauri/msix-output/`.

#### 3. Submit to Partner Center

Upload both `.msix` files (x64 + arm64) to Partner Center. The Store
handles signing and bundling automatically — you do **not** need to
sign or create an `.msixbundle` yourself for Store submission.

#### 4. For signed distribution outside the Store

If distributing outside the Store (e.g., enterprise deployment), sign
with a trusted code-signing certificate:

```powershell
.\src-tauri\build-msix.ps1 -SkipTauriBuild -CertThumbprint "PRODUCTION_CERT_THUMB"
```

---

## CI/CD

Generate a GitHub Actions workflow that builds MSIX for both x64 and
arm64, creates an `.msixbundle`, and optionally signs it:

```bash
iblai builds ci-workflow --windows-msix
```

This creates `.github/workflows/tauri-build-windows-msix.yml` with:
- x64 build on `windows-latest`
- arm64 build on `windows-11-arm`
- Bundle job that combines both into `.msixbundle`
- Optional signing via `MSIX_CERT_PFX` + `MSIX_CERT_PASSWORD` secrets

---

## Troubleshooting

### "publisher is not in unsigned namespace"

The MSIX publisher identity doesn't match a trusted certificate.

```powershell
# Fix: set up the dev certificate and enable Developer Mode
pnpm tauri:setup:cert
# Then sign: .\src-tauri\build-msix.ps1 -SkipTauriBuild -CertThumbprint "THUMB"
```

### "certificate chain terminates at a root certificate which is not trusted"

The certificate was imported to the wrong store.

```powershell
# Remove the stale certificate
Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*-dev" } | Remove-Item
Get-ChildItem Cert:\CurrentUser\TrustedPeople | Where-Object { $_.Subject -like "*-dev" } | Remove-Item
Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Subject -like "*-dev" } | Remove-Item
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*-dev" } | Remove-Item

# Re-create with the correct setup
pnpm tauri:setup:cert
```

### "makeappx.exe not found"

Windows 10 SDK is not installed. Install it from:
https://developer.microsoft.com/windows/downloads/windows-sdk/

Or install via Visual Studio Installer → "Desktop development with C++"
workload (includes the Windows SDK).

### MSIX installs but app shows blank window

The frontend wasn't built before packaging. Ensure `pnpm tauri:build`
completes successfully before running `build-msix.ps1 -SkipTauriBuild`.
Check that `out/index.html` exists after the build.

### Remove a stale test certificate

```powershell
$Subject = "CN=your-app-name-dev"
Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $Subject } | Remove-Item
Get-ChildItem Cert:\CurrentUser\TrustedPeople | Where-Object { $_.Subject -eq $Subject } | Remove-Item
```