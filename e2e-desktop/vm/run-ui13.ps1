# Host side, UI13 on Windows 10: VM display 1920x1080, then Windows display scaling 100 % / 125 % / 150 % (the VM's
# own setting — never the host's). Each change signs the test user out; auto-logon signs it back in. Results:
# docs\validation\win10-vm\ui13\. The app must already be installed in the VM (it is after win10-functional.ps1).
param([string]$VmName = 'YGO-Win10-22H2', [string]$VmRoot = 'C:\Users\mark.tsai\VMs', [int[]]$Scales = @(100, 125, 150))
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$outDir = Join-Path $root 'docs\validation\win10-vm\ui13'
$cred = Get-Content (Join-Path $VmRoot 'win10-test-credentials.txt')
$user = ((($cred -match '^user=')[0]).Substring(5))
$pw = ConvertTo-SecureString ((($cred -match '^password=')[0]).Substring(9)) -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ("YGO-WIN10\$user", $pw)
function WaitDesktop {
  $end = (Get-Date).AddMinutes(10)
  do {
    Start-Sleep 10
    $ok = try { Invoke-Command -VMName $VmName -Credential $c -ErrorAction Stop -ScriptBlock { [bool](Get-Process explorer -ErrorAction SilentlyContinue) } } catch { $false }
  } until ($ok -or (Get-Date) -gt $end)
  if (-not $ok) { throw 'the VM desktop did not come back' }
  Start-Sleep 15
}

$video = Get-VMVideo -VMName $VmName
if ($video.HorizontalResolution -ne 1920) {
  Stop-VM -Name $VmName -Force
  Set-VMVideo -VMName $VmName -ResolutionType Single -HorizontalResolution 1920 -VerticalResolution 1080
  Start-VM -Name $VmName
  WaitDesktop
}
foreach ($scale in $Scales) {
  $logPixels = [int][math]::Round(96 * $scale / 100)
  Invoke-Command -VMName $VmName -Credential $c -ArgumentList $logPixels -ScriptBlock {
    param($lp)
    Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name LogPixels -Value $lp -Type DWord
    Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name Win8DpiScaling -Value 1 -Type DWord
    Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }
    Start-Sleep 3
  }
  # The new scaling applies at sign-in; auto-logon only happens at boot (not after a sign-out), so restart the VM —
  # with a clean shutdown through the integration services (a hard reset makes Windows report a failed boot).
  Stop-VM -Name $VmName -Force
  Start-VM -Name $VmName
  Start-Sleep 20
  WaitDesktop
  & (Join-Path $PSScriptRoot 'run-script-in-vm.ps1') -Script (Join-Path $PSScriptRoot 'win10-ui13.ps1') -Arguments "-Label $scale" -OutDir $outDir -TimeoutMinutes 15 -Files @((Join-Path $PSScriptRoot 'uia-lib.ps1'))
}
