# Starts the Windows 10 VM as soon as the host can reserve its startup memory (the user's own programs may hold the
# RAM; they are never closed by this script), then answers "Press any key to boot from CD or DVD".
param(
  [string]$VmName = 'YGO-Win10-22H2',
  [int]$RetrySeconds = 120,
  [int]$TimeoutMinutes = 240,
  [string]$Log = "$PSScriptRoot\..\..\docs\validation\win10-vm\start.log"
)
New-Item -ItemType Directory -Force (Split-Path $Log) | Out-Null
function Say($m) { "$((Get-Date).ToString('s')) $m" | Tee-Object -FilePath $Log -Append }
$end = (Get-Date).AddMinutes($TimeoutMinutes)
while ((Get-Date) -lt $end) {
  if ((Get-VM -Name $VmName).State -eq 'Running') { Say 'already running'; exit 0 }
  $freeGb = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 1)
  try {
    Start-VM -Name $VmName -ErrorAction Stop
    $kb = Get-CimInstance -Namespace root\virtualization\v2 -ClassName Msvm_ComputerSystem -Filter "ElementName='$VmName'" | Get-CimAssociatedInstance -ResultClassName Msvm_Keyboard
    for ($i = 0; $i -lt 30; $i++) { $null = Invoke-CimMethod -InputObject $kb -MethodName TypeKey -Arguments @{ keyCode = 13 }; Start-Sleep -Milliseconds 500 }
    Say "STARTED (host free memory before start: $freeGb GB); Windows Setup runs unattended"
    exit 0
  } catch {
    Say "not started (free $freeGb GB): $($_.Exception.Message.Split([Environment]::NewLine)[0])"
  }
  Start-Sleep $RetrySeconds
}
Say 'TIMEOUT: the VM could not get its memory'
exit 1
