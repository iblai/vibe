# The desktop shell on Windows, built from src-tauri\ with this app's own
# values. -Smoke is the headless gate: the guard and both sign-in returns
# against a local page. The default is the touch test: the app against the
# deployed URL, a checklist, the guard's log judged at the end. Both run the
# debug build — the one that keeps a console; the release exe prints nothing.
# Prerequisites: /iblai-vibe-ops-build (Rust, WebView2, Node, pnpm).
#
#   powershell -ExecutionPolicy Bypass -File scripts\shell-test.ps1 -Check
#   powershell -ExecutionPolicy Bypass -File scripts\shell-test.ps1 -Smoke
#   powershell -ExecutionPolicy Bypass -File scripts\shell-test.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\shell-test.ps1 -Url https://...
param([switch]$Check, [switch]$Smoke, [string]$Url)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$conf = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
$dist = [string]$conf.build.frontendDist
if ($dist -notmatch '^https?://') { throw "src-tauri/tauri.conf.json: build.frontendDist must be the deployed URL, not $dist" }
$AppOrigin = ([Uri]$dist).GetLeftPart([UriPartial]::Authority)
$Scheme = $conf.plugins.'deep-link'.mobile[0].scheme[0]
$Ident = $conf.identifier
$BinName = (Select-String -Path src-tauri/Cargo.toml -Pattern '^name *= *"([^"]+)"' | Select-Object -First 1).Matches[0].Groups[1].Value
Write-Host "app=$AppOrigin scheme=$Scheme id=$Ident binary=$BinName.exe"
if ($Check) { exit 0 }

if ($Smoke) { $Url = "http://127.0.0.1:8765" } elseif (-not $Url) { $Url = $AppOrigin }
$Out = "src-tauri/target/shell-test"
New-Item -ItemType Directory -Force $Out | Out-Null
$Log = "$Out/app.log"
$Err = "$Out/app.err"
# The debug build keeps the console subsystem, so the guard's log is readable.
pnpm exec tauri build --debug --no-bundle -c ('{"build":{"frontendDist":"' + $Url + '"}}')
if ($LASTEXITCODE -ne 0) { throw "tauri build failed" }
$Bin = "src-tauri/target/debug/$BinName.exe"
if (-not (Test-Path $Bin)) { throw "no binary at $Bin" }

if ($Smoke) {
  $site = "$Out/site"
  Remove-Item -Recurse -Force $site -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $site | Out-Null
  # Guard page: an iframe the suffix list allows (served here), one it blocks,
  # then after 3 s a sign-in return on the auth app's scheme; its page returns
  # on this app's scheme, whose page redirects to a host the guard blocks. The
  # return pages have no extension (the auth contract's paths): the test server
  # maps "" to text/html (scripts/shell-test-server.mjs).
  Set-Content -Path "$site/index.html" -Value @"
<!doctype html><html><body><h1>guard test</h1>
<iframe src="http://localhost:8765/ok.html" width="300" height="80"></iframe>
<iframe src="https://example.com/" width="300" height="80"></iframe>
<script>setTimeout(function () { location.href = "iblai-mentor:///sso-login-complete?data=x&redirect-path=/"; }, 3000);</script>
</body></html>
"@
  Set-Content -Path "$site/ok.html" -Value '<!doctype html><p>allowed iframe</p>'
  Set-Content -Path "$site/sso-login-complete" -Value @"
<!doctype html><p>auth-app scheme return landed</p>
<script>setTimeout(function () { location.href = "${Scheme}:///sso-login?data=y"; }, 1500);</script>
"@
  Set-Content -Path "$site/sso-login" -Value @'
<!doctype html><p>app scheme return landed</p>
<script>setTimeout(function () { location.href = "https://example.org/"; }, 1500);</script>
'@
  $SrvLog = "$Out/server.log"
  $srv = Start-Process node -ArgumentList @("scripts/shell-test-server.mjs", $site) -RedirectStandardOutput $SrvLog -RedirectStandardError "$Out/server.err" -NoNewWindow -PassThru
  Start-Sleep 1
  if ($srv.HasExited) { throw "the test server did not start (is port 8765 busy?)" }
  try {
    Write-Host "== headless run (up to 90 s): $Bin against $Url"
    $app = Start-Process $Bin -RedirectStandardOutput $Log -RedirectStandardError $Err -NoNewWindow -PassThru
    $t = 0
    while ($t -lt 90 -and -not $app.HasExited -and -not (Select-String -Quiet -Path $Log -Pattern 'blocked navigation: https://example.org/' -ErrorAction SilentlyContinue)) {
      Start-Sleep 1
      $t++
    }
    if (-not $app.HasExited) { Stop-Process -Id $app.Id -Force }
    Write-Host "stopped after ${t}s"
  } finally {
    Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue
  }
  $ok = $true
  function Chk([string]$name, [bool]$pass) { if ($pass) { Write-Host "ok:   $name" } else { Write-Host "FAIL: $name"; $script:ok = $false } }
  function Has([string]$file, [string]$pattern) { [bool](Select-String -Quiet -Path $file -SimpleMatch -Pattern $pattern -ErrorAction SilentlyContinue) }
  $both = "$Out/app.both.log"
  Get-Content $Log, $Err -ErrorAction SilentlyContinue | Set-Content $both
  Chk "the page was requested"                 (Has $SrvLog 'GET / ')
  Chk "the allowed iframe was served"          (Has $SrvLog 'GET /ok.html')
  Chk "the foreign iframe was blocked"         (Has $both 'blocked navigation: https://example.com/')
  Chk "the iblai-mentor return landed"         (Has $SrvLog 'GET /sso-login-complete?data=x&redirect-path=/')
  Chk "the $Scheme return landed"              (Has $SrvLog 'GET /sso-login?data=y')
  Chk "the final redirect was blocked"         (Has $both 'blocked navigation: https://example.org/')
  Chk "nothing of the app's own origin was blocked" (-not ((Has $both 'blocked navigation: null') -or (Has $both 'blocked navigation: http://127.0.0.1') -or (Has $both 'blocked navigation: http://localhost')))
  if ($ok) {
    Write-Host "PASS: the app, the allowed iframe and both sign-in returns were served; the foreign iframe and the redirect were blocked"
    exit 0
  }
  Write-Host "== $SrvLog"; Get-Content $SrvLog
  Write-Host "== $both"; Get-Content $both
  Write-Error "FAIL: the shell did not behave as expected (logs above)"
  exit 1
}

Write-Host @"

Touch test against $Url — sign in on a throwaway platform, never main. Close the window when done.
  1. the window shows the app, not white
  2. password sign-in → signed in, on your platform's home
  3. Log Out → the auth app; Google sign-in → the popup opens, closes, signed in
  4. links that open a new tab (help, the learning platform, downloads): note system browser / nothing / this window
  5. a download: was a file saved?
  6. the upgrade dialog → Stripe checkout loads → cancel returns here
  7. narrow the window to a phone width: the layout holds
  8. right-click → Inspect → Console: no errors, no "not allowed"; on the auth page the URL carries scheme=$Scheme
"@
& $Bin 2>&1 | Tee-Object -FilePath $Log | Out-Host

Write-Host ""
Write-Host "== blocked origins"
$blocked = Select-String -Path $Log -Pattern 'blocked navigation: .*' | ForEach-Object { $_.Matches[0].Value }
if ($blocked) { $blocked | Group-Object | ForEach-Object { Write-Host ("{0,7} {1}" -f $_.Count, $_.Name) } } else { Write-Host "nothing blocked" }
$hostRe = [regex]::Escape($Url)
if ($blocked -match "blocked navigation: (null|$hostRe|https?://([^/]+\.)?(iblai\.app|iblai\.org|stripe\.com|localhost|127\.0\.0\.1))(:[0-9]+)?/") {
  Write-Error "FAIL: the guard blocked the app or the platform (a blob:, data: or about: URL shows as the app origin or null) — log: $Log"
  exit 1
}
Write-Host "PASS: nothing of the app or the platform was blocked — log: $Log"
