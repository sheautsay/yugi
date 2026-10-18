# Host side: runs real-cg4.ps1 (real ChatGPT account; user-authorized) in the Windows 10 VM's desktop session with the
# latest installer, on the VM's current state (no checkpoint restore), and copies the results to docs\validation\win10-vm\cg4.
param([string]$Arguments = '-Relogin -Cancel -NetworkCut -Dk13', [string]$OutDir = 'docs\validation\win10-vm\cg4')
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$setup = Join-Path $root 'src-tauri\target\release\bundle\nsis\YGO Combo Assistant_0.1.0_x64-setup.exe'
& (Join-Path $PSScriptRoot 'run-script-in-vm.ps1') -Script (Join-Path $PSScriptRoot 'real-cg4.ps1') -OutDir (Join-Path $root $OutDir) -TimeoutMinutes 150 -Arguments $Arguments -Files @(
  $setup, (Join-Path $PSScriptRoot 'uia-lib.ps1'), (Join-Path $PSScriptRoot 'data\edge-deck.txt'))
