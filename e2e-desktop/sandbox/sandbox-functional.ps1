# Runs INSIDE Windows Sandbox (clean Windows 11, no Node/Rust/npm, no WebView2): the same full functional suite as the
# Windows 10 VM (e2e-desktop/vm/win10-functional.ps1), so DK2–DK20/DK22/DK25 and the physically offline check (the
# sandbox's network adapter is disabled, as in the VM) also have clean Windows 11 evidence (DK23, P0.9, P0.14).
$ErrorActionPreference = 'Continue'
$out = 'C:\ygo-out'
$tools = @('node', 'npm', 'cargo', 'rustc', 'git') | ForEach-Object { [ordered]@{ tool = $_; found = [bool](Get-Command $_ -ErrorAction SilentlyContinue) } }
$wv = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
[ordered]@{ devTools = $tools; webView2Before = $(if ($wv) { $wv.pv } else { $null }) } | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 (Join-Path $out 'environment.json')
& C:\ygo-in\win10-functional.ps1
