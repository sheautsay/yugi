# Windows 10 VM, desktop session: CG6 (CG1–CG3 on Windows 10) with the user's REAL ChatGPT account.
# 1. opens the installed app at Settings and presses "Continue with ChatGPT" (the official page opens in the VM's
#    browser; the USER signs in there), 2. waits for the sign-in, 3. sends exactly ONE one-shot analysis on the real
#    deck (user-authorized), 4. signs out in the VM, which also revokes this test machine's grant.
# The account e-mail is never written to the results and is covered in screenshots. Tokens are never read.
param([string]$Model = 'gpt-6.1-sol', [string]$Deck = 'Win10 Edge 改', [int]$SignInMinutes = 45)
$ErrorActionPreference = 'Continue'
. C:\ygo-in\uia-lib.ps1
$out = 'C:\ygo-out'
$log = Join-Path $out 'chatgpt-log.txt'
$result = [ordered]@{ startedAt = (Get-Date).ToString('o') }
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) $m" | Out-File -Append -Encoding utf8 $log }
function Save { $result.finishedAt = (Get-Date).ToString('o'); $result | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $out 'chatgpt-result.json') }
function Redact([string]$s) { $s -replace '[^\s@：:]+@[^\s@]+\.[A-Za-z]{2,}', '<email>' }
function SafeShot($win, [string]$name) {
  # Screenshot with the account line covered.
  $path = Join-Path $out $name
  Shot $path
  try {
    # Every element that shows the account: the "已登入／已連線" label and any text that looks like an e-mail
    # (on the analysis page the address is its own element). Screenshots are reviewed by hand as well.
    $hits = @($win.FindAll($script:Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.Name -match '^(已登入|已連線)：|[^\s@]+@[^\s@]+\.[A-Za-z]{2,}' })
    if ($hits.Count) {
      $img = [System.Drawing.Image]::FromFile($path)
      $bmp = New-Object System.Drawing.Bitmap $img
      $img.Dispose()
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      foreach ($h in $hits) {
        $r = $h.Current.BoundingRectangle
        $g.FillRectangle([System.Drawing.Brushes]::Black, [int]$r.X, [int]$r.Y, [int][Math]::Max(1, $r.Width), [int][Math]::Max(1, $r.Height))
      }
      $g.Dispose()
      $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose()
    }
  } catch { }
}

try {
  $w = if (Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue) { AppWindow } else { StartApp }
  Nav $w '設定'
  $status = WaitFor $w '^(尚未登入|已連線|已登入，但|本機 ChatGPT 服務)' 30
  for ($i = 0; $i -lt 10 -and $status -and $status.Current.Name -match '尚未連線'; $i++) { $null = ClickName $w '^重新整理$' 'Button' 5; Start-Sleep 3; $status = Find $w '^(尚未登入|已連線|已登入，但|本機 ChatGPT 服務)' '' }
  $result.statusBefore = Redact $status.Current.Name
  if ($result.statusBefore -notmatch '^已連線') {
    $null = RealClick (WaitFor $w '^Continue with ChatGPT$' 15 'Button')
    Log 'pressed Continue with ChatGPT; WAITING for the user to sign in on the official page in the VM browser'
    $end = (Get-Date).AddMinutes($SignInMinutes)
    $signed = $null
    while (-not $signed -and (Get-Date) -lt $end) { Start-Sleep 5; $signed = Find $w '^已連線：' '' }
    if (-not $signed) { throw "no sign-in within $SignInMinutes minutes" }
    $result.signedInAt = (Get-Date).ToString('o')
    Start-Sleep 3
    # CG1: after the authorization the app comes back to the front by itself.
    $result.appInFront = ([IntPtr]$w.Current.NativeWindowHandle -eq [YgoVm.Input]::GetForegroundWindow())
  }
  $result.status = Redact (Find $w '^(已連線|已登入，但)' '').Current.Name
  Log "signed in: $($result.status)"
  SafeShot $w 'cg-01-signed-in.png'
  Save

  # The deck must be legal: make sure the card data is there (a backup restore brings decks back, not card data).
  Nav $w '設定'
  $null = ClickName $w '下載／更新完整卡片資料' 'Button'
  $null = WaitFor $w '^正在下載完整卡片資料' 15
  $null = WaitGone $w '^正在下載完整卡片資料' 300
  $result.cardData = @(Names $w | Where-Object { $_ -match '^已同步 \d+ 張卡片|^卡片資料已是最新版本' } | Select-Object -First 1)

  # Exactly one one-shot analysis on the real deck.
  Nav $w '牌組'
  $null = Click (FindInRow $w "^$([regex]::Escape($Deck))$" '^AI 展開分析$' 'Hyperlink')
  $welcome = WaitFor $w '^知道了$' 10 'Button'
  if ($welcome) { $null = Click $welcome }
  $select = WaitFor $w '^模型（目前帳號可用）' 30 'ComboBox'
  $result.models = @()
  if ($select) {
    try { $select.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand(); Start-Sleep 1 } catch { }
    $opts = $select.FindAll($script:Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($script:A::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem)))
    $result.models = @($opts | ForEach-Object { $_.Current.Name })
    $want = $opts | Where-Object { $_.Current.Name -match [regex]::Escape(($Model -replace '-', ' ')) -or $_.Current.Name -match [regex]::Escape($Model) } | Select-Object -First 1
    if (-not $want) { $want = $opts | Where-Object { $_.Current.Name -notmatch '請選擇' } | Select-Object -First 1 }
    try { $want.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { $null = Click $want }
    try { $select.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Collapse() } catch { }
    $result.modelChosen = $want.Current.Name
  }
  $before = @(Names $w | Where-Object { $_ -match '^今天已送出 \d+ 次' } | Select-Object -First 1)
  $result.usageBefore = $before
  $reasons = @(Names $w | Where-Object { $_ -match '目前無法開始分析' })
  if ($reasons.Count) { throw "cannot start: $((Names $w | Where-Object { $_ -match '牌表|模型|登入|上限' } | Select-Object -First 3) -join ' | ')" }
  $t0 = Get-Date
  $null = ClickName $w '^開始分析$' 'Button'
  Log 'analysis sent (one request)'
  $done = WaitFor $w '^分析完成：\d+ 條候選路線|分析失敗|已中止' 900
  $result.durationSeconds = [int]((Get-Date) - $t0).TotalSeconds
  $result.result = if ($done) { $done.Current.Name } else { '(no result within 15 minutes)' }
  $result.usageAfter = @(Names $w | Where-Object { $_ -match '^今天已送出 \d+ 次' } | Select-Object -First 1)
  $record = WaitFor $w '分析紀錄（牌組、資料版本' 5
  if ($record) { Collapse $record; Start-Sleep 1 }
  $result.runRecord = @(Names $w | Where-Object { $_ -match 'ChatGPT 帳號（方案用量）|store false|輸入 \d+|方案用量' } | Select-Object -First 6 | ForEach-Object { Redact $_ })
  $result.candidates = @(Names $w | Where-Object { $_ -match '^\d+\. ' } | Select-Object -First 6)
  SafeShot $w 'cg-02-analysis.png'
  Log "result: $($result.result)"
  Save

  # Leave no credentials on the test machine: sign out here (the service also revokes this machine's grant).
  Nav $w '設定'
  $null = ClickName $w '^登出 ChatGPT$' 'Button'
  $out2 = WaitFor $w '^已登出|^已在本機登出' 20
  $result.signOut = if ($out2) { $out2.Current.Name } else { '(no sign-out message)' }
  $events = Join-Path $env:APPDATA 'com.ygocomboassistant.desktop\chatgpt\bridge-events.log'
  $result.eventLog = [string[]]@(Get-Content $events -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
  $result.ok = $true
} catch {
  $result.ok = $false
  $result.error = "$($_.Exception.Message)"
  Log "error: $($_.Exception.Message)"
} finally {
  Save
  'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
}
