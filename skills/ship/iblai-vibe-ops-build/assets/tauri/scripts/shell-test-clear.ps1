# Forget the shell's web state on Windows — WebView2's user data folder, which
# holds cookies, localStorage and caches — so the next touch test starts
# signed out. -Dry only lists.
#   powershell -ExecutionPolicy Bypass -File scripts\shell-test-clear.ps1 [-Dry]
param([switch]$Dry)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$conf = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
$Ident = [string]$conf.identifier
if (-not $Ident) { throw "no identifier in src-tauri/tauri.conf.json" }
$BinName = (Select-String -Path src-tauri/Cargo.toml -Pattern '^name *= *"([^"]+)"' | Select-Object -First 1).Matches[0].Groups[1].Value
if (Get-Process -Name $BinName -ErrorAction SilentlyContinue) { throw "close the app first ($BinName is running)" }
# Tauri hands app_local_data_dir() to WebView2 as its user data folder.
$store = Join-Path $env:LOCALAPPDATA "$Ident\EBWebView"
if (-not (Test-Path $store)) { Write-Host "nothing to clear for $Ident"; exit 0 }
if ($Dry) { Write-Host "would remove $store"; exit 0 }
Remove-Item -Recurse -Force $store
Write-Host "removed $store"
