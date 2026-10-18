# Runs e2e-desktop/sandbox/sandbox-test.ps1 inside the Windows 10 VM, in the auto-logged-on desktop session
# (UI Automation needs a real desktop), and copies the results back.
# Cases (P0.10 on Windows 10): offline = no WebView2 + no network; online = no WebView2 + network;
#                              with-runtime = reinstall over the online case, where WebView2 is now present.
param(
  [Parameter(Mandatory = $true)][ValidateSet('offline', 'online', 'with-runtime')][string]$Case,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Setup = '',
  [string]$DeckList = '',
  [string]$ComboJson = '',
  [switch]$RedirectDocuments,
  [string]$VmRoot = 'C:\Users\mark.tsai\VMs',
  [string]$VmName = 'YGO-Win10-22H2',
  [int]$TimeoutMinutes = 25
)
$ErrorActionPreference = 'Stop'
# Resolved here: Windows PowerShell 5.1 leaves $PSScriptRoot empty while the param block is evaluated.
if (-not $Setup) { $Setup = (Resolve-Path (Join-Path $PSScriptRoot '..\..\src-tauri\target\release\bundle\nsis\YGO Combo Assistant_0.1.0_x64-setup.exe')).Path }
$OutDir = [IO.Path]::GetFullPath($OutDir)
$cred = Get-Content (Join-Path $VmRoot 'win10-test-credentials.txt')
$user = ((($cred -match '^user=')[0]).Substring(5))
$pw = ConvertTo-SecureString ((($cred -match '^password=')[0]).Substring(9)) -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ("YGO-WIN10\$user", $pw)

function Wait-Desktop {
  $end = (Get-Date).AddMinutes(15)
  while ((Get-Date) -lt $end) {
    try { if (Invoke-Command -VMName $VmName -Credential $c -ErrorAction Stop -ScriptBlock { [bool](Get-Process explorer -ErrorAction SilentlyContinue) }) { return } } catch { }
    Start-Sleep 10
  }
  throw 'the VM desktop did not come up'
}

if ($Case -ne 'with-runtime') {
  # Every run starts from the clean checkpoint (no WebView2, nothing installed).
  Stop-VM -Name $VmName -TurnOff -Force -ErrorAction SilentlyContinue
  Restore-VMSnapshot -VMName $VmName -Name 'clean-no-webview2' -Confirm:$false
}
if ((Get-VM -Name $VmName).State -ne 'Running') { Start-VM -Name $VmName }
Wait-Desktop

$s = New-PSSession -VMName $VmName -Credential $c
Invoke-Command -Session $s -ScriptBlock {
  foreach ($d in 'C:\ygo-in', 'C:\ygo-out') { if (Test-Path $d) { Remove-Item "$d\*" -Recurse -Force } else { New-Item -ItemType Directory $d | Out-Null } }
}
Copy-Item -ToSession $s -Path $Setup -Destination 'C:\ygo-in\'
Copy-Item -ToSession $s -Path "$PSScriptRoot\..\sandbox\sandbox-test.ps1" -Destination 'C:\ygo-in\'
if ($DeckList) { Copy-Item -ToSession $s -Path $DeckList -Destination 'C:\ygo-in\edge-deck.txt' }
if ($ComboJson) { Copy-Item -ToSession $s -Path $ComboJson -Destination 'C:\ygo-in\combo.json' }
if ($Case -eq 'with-runtime') {
  # Uninstall the app (data and WebView2 stay), so the next install is "WebView2 already present".
  Invoke-Command -Session $s -ScriptBlock {
    $dir = Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant'
    if (Test-Path "$dir\uninstall.exe") { Start-Process "$dir\uninstall.exe" -ArgumentList '/S', "_?=$dir" -Wait }
  }
}

if ($Case -eq 'offline') { Disconnect-VMNetworkAdapter -VMName $VmName }
try {
  $arg = if ($Case -eq 'offline') { ' -Offline' } else { '' }
  if ($RedirectDocuments) { $arg += ' -RedirectDocuments' }
  Invoke-Command -Session $s -ArgumentList $user, $arg -ScriptBlock {
    param($user, $arg)
    # Interactive logon type: runs in the logged-on desktop session, no stored password.
    $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\ygo-in\sandbox-test.ps1$arg"
    $p = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
    # The VM reports the laptop host's battery; by default a task does not start on battery power.
    $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName 'ygo-test' -Action $a -Principal $p -Settings $set -Force | Out-Null
    # A start issued right after registering can be ignored: confirm the task really ran, and retry.
    for ($try = 0; $try -lt 5; $try++) {
      Start-Sleep 3
      Start-ScheduledTask -TaskName 'ygo-test'
      Start-Sleep 5
      if ((Get-ScheduledTaskInfo -TaskName 'ygo-test').LastTaskResult -ne 0x41303) { break }
    }
    if ((Get-ScheduledTaskInfo -TaskName 'ygo-test').LastTaskResult -eq 0x41303) { throw 'the test task did not start in the VM' }
  }
  $end = (Get-Date).AddMinutes($TimeoutMinutes)
  while ((Get-Date) -lt $end -and -not (Invoke-Command -Session $s -ScriptBlock { Test-Path 'C:\ygo-out\DONE' })) { Start-Sleep 10 }
} finally {
  if ($Case -eq 'offline') { Connect-VMNetworkAdapter -VMName $VmName -SwitchName 'Default Switch' }
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
Copy-Item -FromSession $s -Path 'C:\ygo-out\*' -Destination $OutDir -Recurse -Force
Invoke-Command -Session $s -ScriptBlock { Unregister-ScheduledTask -TaskName 'ygo-test' -Confirm:$false }
Remove-PSSession $s
Get-Content (Join-Path $OutDir 'sandbox-log.txt')
