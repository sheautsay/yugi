# Waits until the unattended Windows 10 install has finished and the test account answers over PowerShell Direct,
# then records the guest's version, removes the install media and takes the "clean" checkpoint (no WebView2, no dev tools).
param(
  [string]$VmRoot = 'C:\Users\mark.tsai\VMs',
  [string]$VmName = 'YGO-Win10-22H2',
  [int]$TimeoutMinutes = 90
)
$ErrorActionPreference = 'Stop'
$cred = Get-Content (Join-Path $VmRoot 'win10-test-credentials.txt')
$user = ((($cred -match '^user=')[0]).Substring(5))
$pw = ConvertTo-SecureString ((($cred -match '^password=')[0]).Substring(9)) -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ("YGO-WIN10\$user", $pw)
$end = (Get-Date).AddMinutes($TimeoutMinutes)
$info = $null
while (-not $info -and (Get-Date) -lt $end) {
  try {
    $info = Invoke-Command -VMName $VmName -Credential $c -ErrorAction Stop -ScriptBlock {
      $os = Get-CimInstance Win32_OperatingSystem
      $wv2 = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
      [ordered]@{
        os = "$($os.Caption) $($os.Version) build $($os.BuildNumber)"
        displayVersion = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').DisplayVersion
        explorer = [bool](Get-Process explorer -ErrorAction SilentlyContinue)
        webView2 = (Get-ItemProperty $wv2 -ErrorAction SilentlyContinue).pv
        devTools = @('node', 'npm', 'cargo', 'rustc', 'git') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue }
      }
    }
    if (-not $info.explorer) { $info = $null; Start-Sleep 30 } # wait for the auto-logon desktop
  } catch {
    Start-Sleep 30
  }
}
if (-not $info) { throw "the VM did not become ready within $TimeoutMinutes minutes" }
$info | ConvertTo-Json
Get-VMDvdDrive -VMName $VmName | Remove-VMDvdDrive
Checkpoint-VM -Name $VmName -SnapshotName 'clean-no-webview2'
"checkpoint 'clean-no-webview2' created"
