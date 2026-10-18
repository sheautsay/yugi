# Runs INSIDE Windows Sandbox (clean Windows 11): the real-account checks of e2e-desktop/vm/real-cg4.ps1 on Windows 11
# (P0.8 sign-in again on a new port, P0.2 / CG4 real cancel). The USER signs in on the official page (twice).
# Disposable sandbox only: skip Edge's first-run pages so the official sign-in page shows directly.
New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Force | Out-Null
Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Name HideFirstRunExperience -Value 1 -Type DWord
& C:\ygo-in\real-cg4.ps1 -Relogin -Cancel
