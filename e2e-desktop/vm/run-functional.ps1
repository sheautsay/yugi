# Host side: restore the clean Windows 10 checkpoint, then run win10-functional.ps1 in the VM's desktop session with the
# latest installer and the test data, and copy the results to docs\validation\win10-vm\functional.
param(
  [string]$VmName = 'YGO-Win10-22H2',
  [string]$VmRoot = 'C:\Users\mark.tsai\VMs',
  [string]$OutDir = 'docs\validation\win10-vm\functional'
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$setup = Join-Path $root 'src-tauri\target\release\bundle\nsis\YGO Combo Assistant_0.1.0_x64-setup.exe'
$cred = Get-Content (Join-Path $VmRoot 'win10-test-credentials.txt')
$user = ((($cred -match '^user=')[0]).Substring(5))
$pw = ConvertTo-SecureString ((($cred -match '^password=')[0]).Substring(9)) -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ("YGO-WIN10\$user", $pw)

Stop-VM -Name $VmName -TurnOff -Force -ErrorAction SilentlyContinue
Restore-VMSnapshot -VMName $VmName -Name 'clean-no-webview2' -Confirm:$false
Connect-VMNetworkAdapter -VMName $VmName -SwitchName 'Default Switch'
Start-VM -Name $VmName
$end = (Get-Date).AddMinutes(15)
do {
  Start-Sleep 10
  $ready = try { Invoke-Command -VMName $VmName -Credential $c -ErrorAction Stop -ScriptBlock { [bool](Get-Process explorer -ErrorAction SilentlyContinue) } } catch { $false }
} until ($ready -or (Get-Date) -gt $end)
if (-not $ready) { throw 'the VM desktop did not come up' }

$data = Join-Path $PSScriptRoot 'data'
& (Join-Path $PSScriptRoot 'run-script-in-vm.ps1') -Script (Join-Path $PSScriptRoot 'win10-functional.ps1') -OutDir (Join-Path $root $OutDir) -TimeoutMinutes 60 -Files @(
  $setup, (Join-Path $PSScriptRoot 'uia-lib.ps1'),
  (Join-Path $data 'edge-deck.txt'), (Join-Path $data 'combo.json'), (Join-Path $data 'v1-backup.json'),
  (Join-Path $data 'hand-shot.png'), (Join-Path $data 'hand-ids.json'))
