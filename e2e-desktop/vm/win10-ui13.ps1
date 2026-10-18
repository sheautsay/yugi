# Windows 10 VM, desktop session: UI13 at the CURRENT Windows display scaling. Maximizes the installed app, visits the
# main pages, takes a screenshot of each and records whether the page can scroll sideways (it must not).
# Usage (inside the VM): win10-ui13.ps1 -Label 150
param([Parameter(Mandatory = $true)][string]$Label)
$ErrorActionPreference = 'Continue'
. C:\ygo-in\uia-lib.ps1
$out = 'C:\ygo-out'
Add-Type -AssemblyName System.Windows.Forms
$dpi = (Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' -ErrorAction SilentlyContinue).AppliedDPI
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$result = [ordered]@{ label = $Label; appliedDpi = $dpi; scalePercent = [int]([double]$dpi / 96 * 100); screen = "$($screen.Width)x$($screen.Height)"; pages = [ordered]@{} }

function Scrollable($win) {
  # The page document's scroll pattern says whether it can scroll horizontally.
  $docs = $win.FindAll($script:Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($script:A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Document)))
  foreach ($d in $docs) {
    try { $sp = $d.GetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern); return [bool]$sp.Current.HorizontallyScrollable } catch { }
  }
  $null
}

try {
  if (-not (Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue)) { $w = StartApp } else { $w = AppWindow }
  try { $w.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).SetWindowVisualState([System.Windows.Automation.WindowVisualState]::Maximized) } catch { }
  Start-Sleep 2
  $pages = @(
    @{ n = 'home'; go = { Nav $w '首頁' } },
    @{ n = 'decks'; go = { Nav $w '牌組' } },
    @{ n = 'deck-edit'; go = { Nav $w '牌組'; $null = Click (WaitFor $w '^編輯$' 10 'Hyperlink'); Start-Sleep 2 } },
    @{ n = 'hand'; go = { Nav $w '起手查詢' } },
    @{ n = 'ai'; go = { Nav $w 'AI 展開分析' } },
    @{ n = 'combos'; go = { Nav $w 'Combo 管理' } },
    @{ n = 'settings'; go = { Nav $w '設定' } }
  )
  foreach ($p in $pages) {
    & $p.go
    Start-Sleep 2
    $file = Join-Path $out ("ui13-{0}-{1}.png" -f $Label, $p.n)
    Shot $file
    $result.pages[$p.n] = [ordered]@{ horizontallyScrollable = (Scrollable $w); screenshot = (Split-Path $file -Leaf) }
  }
  $result.ok = $true
} catch {
  $result.ok = $false
  $result.error = "$($_.Exception.Message)"
} finally {
  $result | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $out "ui13-$Label.json")
  'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
}
