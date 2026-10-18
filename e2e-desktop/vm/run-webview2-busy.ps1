# Host side: for each installer given, restore the clean checkpoint (no WebView2) and run webview2-busy.ps1 in the VM.
param([Parameter(Mandatory = $true)][string[]]$Setups, [string]$VmName = 'YGO-Win10-22H2', [string]$VmRoot = 'C:\Users\mark.tsai\VMs')
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$cred = Get-Content (Join-Path $VmRoot 'win10-test-credentials.txt')
$user = ((($cred -match '^user=')[0]).Substring(5))
$pw = ConvertTo-SecureString ((($cred -match '^password=')[0]).Substring(9)) -AsPlainText -Force
$c = New-Object System.Management.Automation.PSCredential ("YGO-WIN10\$user", $pw)
$wv2 = Get-ChildItem "$env:LOCALAPPDATA\tauri\x64" -Recurse -Filter 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe' | Select-Object -First 1
foreach ($setup in $Setups) {
  $name = Split-Path $setup -Leaf
  $label = (Get-FileHash $setup -Algorithm SHA256).Hash.Substring(0, 8).ToLower()
  Stop-VM -Name $VmName -TurnOff -Force -ErrorAction SilentlyContinue
  Restore-VMSnapshot -VMName $VmName -Name 'clean-no-webview2' -Confirm:$false
  Connect-VMNetworkAdapter -VMName $VmName -SwitchName 'Default Switch'
  Start-VM -Name $VmName
  $end = (Get-Date).AddMinutes(15)
  do { Start-Sleep 10; $ok = try { Invoke-Command -VMName $VmName -Credential $c -ErrorAction Stop -ScriptBlock { [bool](Get-Process explorer -ErrorAction SilentlyContinue) } } catch { $false } } until ($ok -or (Get-Date) -gt $end)
  & (Join-Path $PSScriptRoot 'run-script-in-vm.ps1') -Script (Join-Path $PSScriptRoot 'webview2-busy.ps1') -Arguments "-Setup `"$name`"" -OutDir (Join-Path $root "docs\validation\win10-vm\webview2-busy-$label") -TimeoutMinutes 20 -Files @($setup, (Join-Path $PSScriptRoot 'fake-webview2-busy.ps1'))
}
