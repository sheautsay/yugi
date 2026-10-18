# Test VM only. Registered as the IFEO "Debugger" of MicrosoftEdgeWebView2RuntimeInstaller.exe, so Windows runs this
# instead of the installer, appending the original command line. The first call answers like a busy machine
# (0x80040707, "another Microsoft application is installing or updating"); the next call removes the intercept and
# runs the real installer.
$ifeoKeys = @('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MicrosoftEdgeWebView2RuntimeInstaller.exe', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MicrosoftEdgeWebView2RuntimeInstaller.exe')
$count = 'C:\ygo-out\fake-webview2-calls.txt'
$n = if (Test-Path $count) { [int](Get-Content $count) } else { 0 }
($n + 1) | Set-Content $count
"$(Get-Date -Format o) call $($n + 1): $($args -join ' ')" | Add-Content 'C:\ygo-out\fake-webview2.log'
if ($n -eq 0) { exit -2147219705 }
foreach ($k in $ifeoKeys) { Remove-Item $k -Recurse -Force -ErrorAction SilentlyContinue }
$exe = $args[0]
$rest = @($args | Select-Object -Skip 1)
$p = Start-Process $exe -ArgumentList $rest -Wait -PassThru
exit $p.ExitCode
