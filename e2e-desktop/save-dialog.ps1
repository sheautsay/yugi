# Test helper: answers the Windows "Save As" dialog opened by the app under test.
# Sets the file name with WM_SETTEXT on the focused file-name box (typing would go through the IME on a
# Chinese-input system), checks it, clicks Save, and waits for the dialog to close.
# Exit codes: 0 saved, 1 no dialog, 2 file-name box not found, 3 text not accepted, 4 dialog did not close.
param([Parameter(Mandatory)][int]$AppPid, [Parameter(Mandatory)][string]$Path)

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace YgoTest -Name Win32 -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, string l);
[DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")] public static extern IntPtr GetText(IntPtr h, int msg, IntPtr w, System.Text.StringBuilder l);
'@
$A = [Windows.Automation.AutomationElement]
$scope = [Windows.Automation.TreeScope]::Descendants
$isDialog = New-Object Windows.Automation.AndCondition(
  (New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, '#32770')),
  (New-Object Windows.Automation.PropertyCondition($A::ProcessIdProperty, $AppPid)))

$dlg = $null
$deadline = (Get-Date).AddSeconds(30)
while (-not $dlg -and (Get-Date) -lt $deadline) {
  $dlg = $A::RootElement.FindFirst($scope, $isDialog)
  if (-not $dlg) { Start-Sleep -Milliseconds 300 }
}
if (-not $dlg) { exit 1 }

[YgoTest.Win32]::SetForegroundWindow([IntPtr]$dlg.Current.NativeWindowHandle) | Out-Null
Start-Sleep -Milliseconds 500
$box = $dlg.FindFirst($scope, (New-Object Windows.Automation.AndCondition(
  (New-Object Windows.Automation.PropertyCondition($A::AutomationIdProperty, '1001')),
  (New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, 'Edit')))))
if (-not $box) { $box = [Windows.Automation.AutomationElement]::FocusedElement }
if (-not $box -or $box.Current.ClassName -ne 'Edit') { exit 2 }

[YgoTest.Win32]::SendMessage([IntPtr]$box.Current.NativeWindowHandle, 0x000C, [IntPtr]::Zero, $Path) | Out-Null
$buffer = New-Object System.Text.StringBuilder 1024
[YgoTest.Win32]::GetText([IntPtr]$box.Current.NativeWindowHandle, 0x000D, [IntPtr]1024, $buffer) | Out-Null
$value = $buffer.ToString()
if ($value -ne $Path) { exit 3 }

# Press Save: WM_COMMAND with IDOK (1), exactly what the Save button sends.
[YgoTest.Win32]::PostMessage([IntPtr]$dlg.Current.NativeWindowHandle, 0x0111, [IntPtr]1, [IntPtr]::Zero) | Out-Null

$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline) {
  if (-not $A::RootElement.FindFirst($scope, $isDialog)) { exit 0 }
  Start-Sleep -Milliseconds 300
}
exit 4
