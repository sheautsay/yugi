# Runs INSIDE Windows Sandbox (clean Windows 11, no Node/Rust/npm): P0.9 with the ChatGPT part. Installs the app, syncs
# the card data, imports the user's real deck list, then runs the same ChatGPT flow as the Windows 10 VM
# (win10-chatgpt.ps1: the USER signs in on the official page, exactly ONE analysis, then sign-out in the sandbox).
$ErrorActionPreference = 'Continue'
. C:\ygo-in\uia-lib.ps1
$out = 'C:\ygo-out'
$log = Join-Path $out 'sandbox-chatgpt-log.txt'
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) $m" | Out-File -Append -Encoding utf8 $log }
try {
  # Disposable sandbox only: skip Edge's first-run pages so the official sign-in page shows directly.
  New-Item 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Force | Out-Null
  Set-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -Name HideFirstRunExperience -Value 1 -Type DWord
  $setup = (Get-ChildItem 'C:\ygo-in' -Filter '*-setup.exe' | Select-Object -First 1).FullName
  $p = Start-Process $setup -ArgumentList '/S' -Wait -PassThru
  Log "installed exit=$($p.ExitCode); dev tools: $((@('node', 'npm', 'cargo', 'rustc', 'git') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue }) -join ',')"
  $w = StartApp
  Nav $w '設定'
  $null = ClickName $w '下載／更新完整卡片資料' 'Button'
  $null = WaitFor $w '^正在下載完整卡片資料' 15
  $null = WaitGone $w '^正在下載完整卡片資料' 300
  Nav $w '牌組'
  $null = SetText $w '^牌組代碼或 YDK 內容' (Get-Content 'C:\ygo-in\edge-deck.txt' -Raw -Encoding UTF8)
  $null = ClickName $w '^解析$' 'Button'
  $null = WaitFor $w '^牌表檢核通過' 60
  $null = SetText $w '^新牌組名稱' 'Edge 沙箱驗收'
  $null = ClickName $w '^確認匯入$' 'Button'
  $null = WaitFor $w '已匯入「Edge 沙箱驗收」' 30
  Log 'deck imported; starting the ChatGPT flow'
} catch {
  Log "setup error: $($_.Exception.Message)"
}
& C:\ygo-in\win10-chatgpt.ps1 -Deck 'Edge 沙箱驗收'
