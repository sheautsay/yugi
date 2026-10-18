# Runs INSIDE the VM's desktop session (scheduled task): does the installed app's WebView2 open a DevTools port when
# started with the test-only WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS? Writes C:\ygo-out\cdp-probe.txt.
$out = 'C:\ygo-out\cdp-probe.txt'
$exe = Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant\ygo-combo-assistant.exe'
if (-not (Test-Path $exe)) {
  Start-Process (Get-ChildItem 'C:\ygo-in' -Filter '*-setup.exe' | Select-Object -First 1).FullName -ArgumentList '/S' -Wait
}
$lines = @()
# Test VM only: the documented WebView2 policy key (per exe name) as an alternative to the environment variable.
$policy = 'HKCU:\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
foreach ($variant in @('env:--remote-debugging-port=9333', 'policy:--remote-debugging-port=9335')) {
  Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep 2
  $how, $variant = $variant -split ':', 2
  Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
  Remove-Item $policy -ErrorAction SilentlyContinue
  if ($how -eq 'env') { $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $variant }
  else { New-Item $policy -Force | Out-Null; New-ItemProperty $policy -Name 'ygo-combo-assistant.exe' -Value $variant -PropertyType String -Force | Out-Null }
  $lines += "method: $how"
  $p = Start-Process $exe -PassThru
  Start-Sleep 15
  $port = [int]($variant -replace '^--remote-debugging-port=(\d+).*$', '$1')
  $listen = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count
  $json = try { (Invoke-WebRequest "http://127.0.0.1:$port/json/version" -UseBasicParsing -TimeoutSec 5).Content } catch { "error: $($_.Exception.Message)" }
  $cmd = (Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' } | Select-Object -First 1).CommandLine
  $lines += "variant: $variant"
  $lines += "  listening: $listen"
  $lines += "  /json/version: $($json.Substring(0, [Math]::Min(200, $json.Length)))"
  $lines += "  browser process has remote-debugging arg: $($cmd -match 'remote-debugging')"
  $lines += "  browser process args (tail): $($cmd.Substring([Math]::Max(0, $cmd.Length - 500)))"
  $lines += "  env seen by app: " + [bool]((Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)") -ne $null)
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
Remove-Item $policy -ErrorAction SilentlyContinue
$lines | Out-File -Encoding utf8 $out
'done' | Out-File -Encoding utf8 'C:\ygo-out\DONE'
