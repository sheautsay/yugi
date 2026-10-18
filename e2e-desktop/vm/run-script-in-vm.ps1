# Copies files into the Windows 10 VM and runs one script in the logged-on desktop session (scheduled task with an
# interactive principal), waits for C:\ygo-out\DONE and copies C:\ygo-out back. Does not restore any checkpoint.
param(
  [Parameter(Mandatory = $true)][string]$Script,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string[]]$Files = @(),
  [string]$Arguments = '',
  [string]$VmRoot = 'C:\Users\mark.tsai\VMs',
  [string]$VmName = 'YGO-Win10-22H2',
  [int]$TimeoutMinutes = 30
)
$ErrorActionPreference = 'Stop'
$OutDir = [IO.Path]::GetFullPath($OutDir)
$cred = Get-Content (Join-Path $VmRoot 'win10-test-credentials.txt')
$user = ((($cred -match '^user=')[0]).Substring(5))
$pw = ConvertTo-SecureString ((($cred -match '^password=')[0]).Substring(9)) -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ("YGO-WIN10\$user", $pw)
$s = New-PSSession -VMName $VmName -Credential $c
Invoke-Command -Session $s -ScriptBlock {
  foreach ($d in 'C:\ygo-in', 'C:\ygo-out') { if (-not (Test-Path $d)) { New-Item -ItemType Directory $d | Out-Null } }
  Remove-Item 'C:\ygo-out\*' -Recurse -Force -ErrorAction SilentlyContinue
}
foreach ($f in @($Script) + $Files) { Copy-Item -ToSession $s -Path $f -Destination 'C:\ygo-in\' -Force }
$name = Split-Path $Script -Leaf
Invoke-Command -Session $s -ArgumentList $user, $name, $Arguments -ScriptBlock {
  param($user, $name, $arguments)
  $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File C:\ygo-in\$name $arguments"
  $p = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
  $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)
  Register-ScheduledTask -TaskName 'ygo-script' -Action $a -Principal $p -Settings $set -Force | Out-Null
  for ($try = 0; $try -lt 5; $try++) {
    Start-Sleep 3
    Start-ScheduledTask -TaskName 'ygo-script'
    Start-Sleep 5
    if ((Get-ScheduledTaskInfo -TaskName 'ygo-script').LastTaskResult -ne 0x41303) { break }
  }
}
$end = (Get-Date).AddMinutes($TimeoutMinutes)
while ((Get-Date) -lt $end -and -not (Invoke-Command -Session $s -ScriptBlock { Test-Path 'C:\ygo-out\DONE' })) { Start-Sleep 10 }
New-Item -ItemType Directory -Force $OutDir | Out-Null
Copy-Item -FromSession $s -Path 'C:\ygo-out\*' -Destination $OutDir -Recurse -Force
Invoke-Command -Session $s -ScriptBlock { Unregister-ScheduledTask -TaskName 'ygo-script' -Confirm:$false }
Remove-PSSession $s
"copied results to $OutDir"
