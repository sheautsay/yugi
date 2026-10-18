# Runs INSIDE the clean Windows 10 VM: reproduces "another Microsoft application is installing or updating" (0x80040707)
# by starting the official WebView2 offline installer first (it holds the install lock), then our installer right
# after it. Writes C:\ygo-out\webview2-busy.json. Inputs: C:\ygo-in\<setup>.exe, C:\ygo-in\MicrosoftEdgeWebView2RuntimeInstallerX64.exe
param([Parameter(Mandatory = $true)][string]$Setup)
$out = 'C:\ygo-out'
$wv = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$r = [ordered]@{ setup = $Setup; webView2Before = (Get-ItemProperty $wv -ErrorAction SilentlyContinue).pv }
$r.setupSha256 = (Get-FileHash (Join-Path 'C:\ygo-in' $Setup) -Algorithm SHA256).Hash.ToLower()
# Deterministic "busy" first attempt: Windows' IFEO debugger hook makes the installer's first call to the WebView2
# installer return 0x80040707 (see fake-webview2-busy.ps1); later calls run the real installer.
$ifeoKeys = @('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MicrosoftEdgeWebView2RuntimeInstaller.exe', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MicrosoftEdgeWebView2RuntimeInstaller.exe')
Remove-Item 'C:\ygo-out\fake-webview2-calls.txt', 'C:\ygo-out\fake-webview2.log' -ErrorAction SilentlyContinue
foreach ($k in $ifeoKeys) { New-Item $k -Force | Out-Null; Set-ItemProperty $k -Name Debugger -Value 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ygo-in\fake-webview2-busy.ps1' }
$t0 = Get-Date
$p = Start-Process (Join-Path 'C:\ygo-in' $Setup) -ArgumentList '/S' -PassThru
$p.WaitForExit()
$r.setupExitCode = $p.ExitCode
$r.setupSeconds = [int]((Get-Date) - $t0).TotalSeconds
$r.webView2InstallerCalls = if (Test-Path 'C:\ygo-out\fake-webview2-calls.txt') { [int](Get-Content 'C:\ygo-out\fake-webview2-calls.txt') } else { 0 }
$r.fakeLog = [string[]]@(Get-Content 'C:\ygo-out\fake-webview2.log' -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
foreach ($k in $ifeoKeys) { Remove-Item $k -Recurse -Force -ErrorAction SilentlyContinue }
$r.webView2After = (Get-ItemProperty $wv -ErrorAction SilentlyContinue).pv
$r.appInstalled = Test-Path (Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant\ygo-combo-assistant.exe')
$log = 'C:\ProgramData\Microsoft\EdgeUpdate\Log\MicrosoftEdgeUpdate.log'
$r.lockConflictsInLog = @(Get-Content $log -ErrorAction SilentlyContinue | Select-String '0x80040707' | ForEach-Object { $_.Line.Substring(0, [Math]::Min(120, $_.Line.Length)) } | Select-Object -Last 3)
$r | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 (Join-Path $out 'webview2-busy.json')
'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
