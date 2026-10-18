# UI Automation helpers for driving the INSTALLED app inside the test VM (dot-sourced by win10-functional.ps1).
# What a screen reader sees: no Node, no DevTools port. The VM is a clean test machine, so a file dialog can be
# found by its window class regardless of which process (app or WebView2) shows it.
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
if (-not ('YgoVm.Win32' -as [type])) {
  Add-Type -Namespace YgoVm -Name Win32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, string l);
'@
}
if (-not ('YgoVm.Input' -as [type])) {
  Add-Type -Namespace YgoVm -Name Input -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
[DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")] public static extern IntPtr GetText(IntPtr h, int msg, IntPtr w, System.Text.StringBuilder l);
'@
}
# Physical pixels for screenshots and element bounds at 125 % / 150 % scaling (otherwise only part of the screen).
[void][YgoVm.Input]::SetProcessDPIAware()
$script:A = [System.Windows.Automation.AutomationElement]
$script:Scope = [System.Windows.Automation.TreeScope]

function Shot([string]$path) {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
function AppWindow {
  $p = Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $p) { return $null }
  $script:A::RootElement.FindFirst($script:Scope::Children, (New-Object System.Windows.Automation.PropertyCondition($script:A::ProcessIdProperty, $p.Id)))
}
function WaitWindow([int]$seconds = 90) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) { $w = AppWindow; if ($w) { return $w }; Start-Sleep 1 }
  throw 'the app window did not appear'
}
function Names($win) { @($win.FindAll($script:Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name } | Where-Object { $_ }) }
function Find($win, [string]$pattern, [string]$type = '') {
  foreach ($e in $win.FindAll($script:Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
    $c = $e.Current
    if ($c.Name -match $pattern -and (-not $type -or $c.ControlType.ProgrammaticName -eq "ControlType.$type")) { return $e }
  }
  $null
}
function WaitFor($win, [string]$pattern, [int]$seconds, [string]$type = '') {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) { $e = Find $win $pattern $type; if ($e) { return $e }; Start-Sleep 1 }
  $null
}
function WaitGone($win, [string]$pattern, [int]$seconds) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) { if (-not (Find $win $pattern '')) { return $true }; Start-Sleep 1 }
  $false
}
function Click($e) {
  if (-not $e) { return $false }
  try { $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return $true } catch { }
  try { $e.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Toggle(); return $true } catch { }
  try { $e.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).DoDefaultAction(); return $true } catch { }
  $false
}
function ClickName($win, [string]$pattern, [string]$type = '', [int]$wait = 15) { Click (WaitFor $win $pattern $wait $type) }
# A real mouse click at the element: a browser opens a file chooser only for genuine user input, not for an
# accessibility "invoke".
function RealClick($e) {
  if (-not $e) { return $false }
  try { $e.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern).ScrollIntoView() } catch { }
  try { $e.SetFocus() } catch { }
  Start-Sleep -Milliseconds 400
  $w = AppWindow
  if ($w) { [YgoVm.Win32]::SetForegroundWindow([IntPtr]$w.Current.NativeWindowHandle) | Out-Null }
  Start-Sleep -Milliseconds 300
  $r = $e.Current.BoundingRectangle
  $x = [int]($r.X + $r.Width / 2); $y = [int]($r.Y + $r.Height / 2)
  [YgoVm.Input]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 150
  [YgoVm.Input]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero) # left down
  Start-Sleep -Milliseconds 80
  [YgoVm.Input]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero) # left up
  $true
}
# A control inside the list row that shows $rowText (every deck row has the same buttons).
function FindInRow($win, [string]$rowText, [string]$pattern, [string]$type = '', [int]$wait = 15) {
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $end = (Get-Date).AddSeconds($wait)
  while ((Get-Date) -lt $end) {
    $label = Find $win $rowText ''
    $node = $label
    for ($up = 0; $node -and $up -lt 8; $up++) {
      $node = $walker.GetParent($node)
      if (-not $node) { break }
      $hit = Find $node $pattern $type
      if ($hit) { return $hit }
    }
    Start-Sleep 1
  }
  $null
}
function Count($win, [string]$pattern) { @(Names $win | Where-Object { $_ -match $pattern }).Count }
function SetText($win, [string]$pattern, [string]$text, [int]$wait = 15) {
  $box = WaitFor $win $pattern $wait 'Edit'
  if (-not $box) { return $false }
  $box.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($text)
  Start-Sleep -Milliseconds 500
  $true
}
function Nav($win, [string]$name) { $null = ClickName $win "^$name$" 'Hyperlink'; Start-Sleep 2 }
function Collapse($e) { try { $e.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand() } catch { $null = Click $e } }

# A file dialog is owned by the app window, and UI Automation lists an owned window under its owner — so look there
# first, then among the top-level windows.
function FindFileDialog {
  $isDialog = New-Object System.Windows.Automation.PropertyCondition($script:A::ClassNameProperty, '#32770')
  $w = AppWindow
  if ($w) { $d = $w.FindFirst($script:Scope::Descendants, $isDialog); if ($d) { return $d } }
  $script:A::RootElement.FindFirst($script:Scope::Children, $isDialog)
}
# Cancels a dialog left open (a modal dialog would block closing the app).
function CancelDialogs {
  for ($i = 0; $i -lt 3; $i++) {
    $d = FindFileDialog
    if (-not $d) { return }
    [YgoVm.Win32]::PostMessage([IntPtr]$d.Current.NativeWindowHandle, 0x0111, [IntPtr]2, [IntPtr]::Zero) | Out-Null
    Start-Sleep 1
  }
}
# Answers a Windows Open/Save dialog: file name by WM_SETTEXT (no IME), then IDOK (what the Open/Save button sends).
function AnswerFileDialog([string]$path, [int]$seconds = 30) {
  $dlg = $null
  $end = (Get-Date).AddSeconds($seconds)
  while (-not $dlg -and (Get-Date) -lt $end) { $dlg = FindFileDialog; if (-not $dlg) { Start-Sleep -Milliseconds 300 } }
  if (-not $dlg) { return 'no dialog' }
  [YgoVm.Win32]::SetForegroundWindow([IntPtr]$dlg.Current.NativeWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 500
  $box = $null
  foreach ($id in '1148', '1001') {
    $box = $dlg.FindFirst($script:Scope::Descendants, (New-Object System.Windows.Automation.AndCondition(
      (New-Object System.Windows.Automation.PropertyCondition($script:A::AutomationIdProperty, $id)),
      (New-Object System.Windows.Automation.PropertyCondition($script:A::ClassNameProperty, 'Edit')))))
    if ($box) { break }
  }
  if (-not $box) { return 'no file-name box' }
  # The dialog may still fill in its default name after it appears, and the Windows 10 Save dialog ignores a raw
  # WM_SETTEXT (no change notification). So: set through UI Automation's value pattern (proper notifications), read it
  # back, retry until it sticks, then press the dialog's own OK/Save button.
  $h = [IntPtr]$box.Current.NativeWindowHandle
  $value = ''
  for ($try = 0; $try -lt 6 -and $value -ne $path; $try++) {
    Start-Sleep -Milliseconds 700
    try { $box.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($path) } catch { }
    [YgoVm.Win32]::SendMessage($h, 0x000C, [IntPtr]::Zero, $path) | Out-Null
    Start-Sleep -Milliseconds 300
    $sb = New-Object System.Text.StringBuilder 1024
    [YgoVm.Input]::GetText($h, 0x000D, [IntPtr]1024, $sb) | Out-Null
    $value = $sb.ToString()
  }
  if ($value -ne $path) { return "file name not accepted: $value" }
  # The Windows 10 Save dialog keeps its own default name until the box receives real keyboard input. Typing the whole
  # path opens the path auto-complete, which swallows keys, so: real keystrokes that leave the text unchanged
  # (End, space, Backspace), then check it again.
  try { $box.SetFocus() } catch { }
  [YgoVm.Win32]::SetForegroundWindow([IntPtr]$dlg.Current.NativeWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait('{END}')
  [System.Windows.Forms.SendKeys]::SendWait(' ')
  Start-Sleep -Milliseconds 150
  [System.Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')
  Start-Sleep -Milliseconds 400
  $sb = New-Object System.Text.StringBuilder 1024
  [YgoVm.Input]::GetText($h, 0x000D, [IntPtr]1024, $sb) | Out-Null
  if ($sb.ToString() -ne $path) { return "typed file name differs: $($sb.ToString())" }
  $ok = $dlg.FindFirst($script:Scope::Descendants, (New-Object System.Windows.Automation.AndCondition(
    (New-Object System.Windows.Automation.PropertyCondition($script:A::AutomationIdProperty, '1')),
    (New-Object System.Windows.Automation.PropertyCondition($script:A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)))))
  if (-not ($ok -and (Click $ok))) { [YgoVm.Win32]::PostMessage([IntPtr]$dlg.Current.NativeWindowHandle, 0x0111, [IntPtr]1, [IntPtr]::Zero) | Out-Null }
  $end = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $end) { if (-not (FindFileDialog)) { return 'ok' }; Start-Sleep -Milliseconds 300 }
  'dialog did not close'
}
# Texts that appeared after an action (the action's own message), ignoring what was already on the page.
function NewTexts([string[]]$before, $win) { @(Names $win | Where-Object { $before -notcontains $_ }) }

function StartApp([string]$how = 'desktop') {
  $lnk = if ($how -eq 'start') { Join-Path ([Environment]::GetFolderPath('Programs')) 'YGO Combo Assistant.lnk' } else { Join-Path ([Environment]::GetFolderPath('Desktop')) 'YGO Combo Assistant.lnk' }
  Start-Process $lnk
  $w = WaitWindow
  $null = WaitFor $w '^首頁$' 60
  Start-Sleep 2
  $w
}
function CloseApp {
  CancelDialogs
  $w = AppWindow
  if ($w) { try { $w.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close() } catch { } }
  for ($i = 0; $i -lt 30 -and (Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }
  Start-Sleep 2
}
