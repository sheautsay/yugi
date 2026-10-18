# Host side: runs win10-extra.ps1 in the Windows 10 VM's desktop session (current state, no checkpoint restore).
param([string]$OutDir = 'docs\validation\win10-vm\extra')
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$setup = Join-Path $root 'src-tauri\target\release\bundle\nsis\YGO Combo Assistant_0.1.0_x64-setup.exe'
& (Join-Path $PSScriptRoot 'run-script-in-vm.ps1') -Script (Join-Path $PSScriptRoot 'win10-extra.ps1') -OutDir (Join-Path $root $OutDir) -TimeoutMinutes 40 -Files @(
  $setup, (Join-Path $PSScriptRoot 'uia-lib.ps1'), (Join-Path $PSScriptRoot 'data\edge-deck.txt'))
