# Windows 10 VM or Windows Sandbox, desktop session, the user's REAL ChatGPT account (user-authorized):
#   -Relogin    P0.8: sign in, sign out (the registration is kept), restart the app (new system-assigned port), sign in
#               again → the second sign-in reuses the registration (`signin.start {"registration":false}`) on another port.
#   -Cancel     P0.2 / CG4(b): one real one-shot analysis; samples "已收到 N 字元" while it streams, then presses 取消
#               (the request is cut off upstream; the partial request still uses plan usage).
#   -NetworkCut CG4(c): one real analysis; the network adapter is disabled while it streams → a clear failure message.
#   -Dk13       DK13: after the real sign-in, no token in the web storage files, backups or the event log (pattern scan;
#               the token file itself, chatgpt\auth.json, is the only place tokens may be and is never read).
# Finally signs out in the test machine (revokes its grant). The e-mail is never written; screenshots cover it.
param([switch]$Relogin, [switch]$Cancel, [switch]$NetworkCut, [switch]$Dk13, [string]$Model = 'gpt-6.1-sol', [string]$Deck = 'CG4 驗收', [int]$SignInMinutes = 45)
$ErrorActionPreference = 'Continue'
. C:\ygo-in\uia-lib.ps1
$out = 'C:\ygo-out'
$log = Join-Path $out 'cg4-log.txt'
$result = [ordered]@{ startedAt = (Get-Date).ToString('o'); checks = [ordered]@{} }
$events = Join-Path $env:APPDATA 'com.ygocomboassistant.desktop\chatgpt\bridge-events.log'
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) $m" | Out-File -Append -Encoding utf8 $log }
function Save { $result.finishedAt = (Get-Date).ToString('o'); $result | ConvertTo-Json -Depth 8 | Out-File -Encoding utf8 (Join-Path $out 'cg4-result.json') }
function Check([string]$id, [bool]$ok, $detail) { $result.checks[$id] = [ordered]@{ ok = $ok; detail = $detail }; Log ("{0} {1}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' })), $id); Save }
function Redact([string]$s) { $s -replace '[^\s@：:]+@[^\s@]+\.[A-Za-z]{2,}', '<email>' }
function EventLines { [string[]]@(Get-Content $events -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ }) }
function BridgePort { $b = Get-Process ygo-bridge -ErrorAction SilentlyContinue | Select-Object -First 1; if ($b) { (Get-NetTCPConnection -State Listen -OwningProcess $b.Id -ErrorAction SilentlyContinue | Select-Object -First 1).LocalPort } }
function Upstream { $b = Get-Process ygo-bridge -ErrorAction SilentlyContinue | Select-Object -First 1; if ($b) { @(Get-NetTCPConnection -State Established -OwningProcess $b.Id -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -notmatch '^(127\.|::1)' } | ForEach-Object { "$($_.RemoteAddress):$($_.RemotePort)" }) } else { @() } }
function SafeShot($win, [string]$name) {
  $path = Join-Path $out $name
  Shot $path
  try {
    $hits = @($win.FindAll($script:Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.Name -match '^(已登入|已連線)：|[^\s@]+@[^\s@]+\.[A-Za-z]{2,}' })
    if ($hits.Count) {
      $img = [System.Drawing.Image]::FromFile($path); $bmp = New-Object System.Drawing.Bitmap $img; $img.Dispose()
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      foreach ($h in $hits) { $r = $h.Current.BoundingRectangle; $g.FillRectangle([System.Drawing.Brushes]::Black, [int]$r.X, [int]$r.Y, [int][Math]::Max(1, $r.Width), [int][Math]::Max(1, $r.Height)) }
      $g.Dispose(); $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    }
  } catch { }
}
function Status($w) {
  $s = WaitFor $w '^(尚未登入|已連線|已登入，但|本機 ChatGPT 服務)' 30
  for ($i = 0; $i -lt 10 -and $s -and $s.Current.Name -match '尚未連線'; $i++) { $null = ClickName $w '^重新整理$' 'Button' 5; Start-Sleep 3; $s = Find $w '^(尚未登入|已連線|已登入，但|本機 ChatGPT 服務)' '' }
  $s
}
function SignIn($w, [string]$label) {
  Nav $w '設定'
  $s = Status $w
  $port = BridgePort
  if ($s -and $s.Current.Name -match '^已連線') { return [ordered]@{ label = $label; already = $true; port = $port } }
  $null = RealClick (WaitFor $w '^使用 ChatGPT 登入$' 15 'Button')
  Log "$label pressed 使用 ChatGPT 登入 on port $port; WAITING for the user to sign in"
  $end = (Get-Date).AddMinutes($SignInMinutes)
  $signed = $null
  while (-not $signed -and (Get-Date) -lt $end) { Start-Sleep 5; $signed = Find $w '^已連線：' '' }
  if (-not $signed) { throw "$label no sign-in within $SignInMinutes minutes" }
  Start-Sleep 3
  [ordered]@{ label = $label; port = $port; signedInAt = (Get-Date).ToString('o'); appInFront = ([IntPtr]$w.Current.NativeWindowHandle -eq [YgoVm.Input]::GetForegroundWindow()) }
}
function OpenAnalysis($w) {
  Nav $w '牌組'
  $null = Click (FindInRow $w "^$([regex]::Escape($Deck))$" '^AI 展開分析$' 'Hyperlink')
  $welcome = WaitFor $w '^知道了$' 10 'Button'
  if ($welcome) { $null = Click $welcome }
  $select = WaitFor $w '^模型（目前帳號可用）' 30 'ComboBox'
  if ($select) {
    try { $select.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand(); Start-Sleep 1 } catch { }
    $opts = $select.FindAll($script:Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($script:A::ControlTypeProperty, [System.Windows.Automation.ControlType]::ListItem)))
    $want = $opts | Where-Object { $_.Current.Name -match [regex]::Escape($Model) -or $_.Current.Name -match [regex]::Escape(($Model -replace '-', ' ')) } | Select-Object -First 1
    if ($want) { try { $want.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select() } catch { $null = Click $want } }
    try { $select.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Collapse() } catch { }
  }
  if (@(Names $w | Where-Object { $_ -match '目前無法開始分析' }).Count) { throw "cannot start: $((Names $w | Where-Object { $_ -match '牌表|模型|登入|上限' } | Select-Object -First 3) -join ' | ')" }
}
function ReceivedChars($w) { $s = Find $w '已收到 \d+ 字元' ''; if ($s -and $s.Current.Name -match '已收到 (\d+) 字元') { [int]$Matches[1] } else { -1 } }
# Starts one analysis and waits until the streamed text has grown at least $growth times (or $maxSeconds pass).
function StartAndStream($w, [int]$growth = 3, [int]$maxSeconds = 600) {
  $samples = New-Object System.Collections.ArrayList
  $script:before = Names $w
  $t0 = Get-Date
  $null = ClickName $w '^開始分析$' 'Button'
  $last = -1; $grew = 0
  while ($grew -lt $growth -and ((Get-Date) - $t0).TotalSeconds -lt $maxSeconds) {
    Start-Sleep -Milliseconds 700
    $n = ReceivedChars $w
    if ($n -ge 0) { $null = $samples.Add([ordered]@{ s = [Math]::Round(((Get-Date) - $t0).TotalSeconds, 1); chars = $n }) }
    if ($n -gt $last -and $last -ge 0 -and $n -gt 0) { $grew++ }
    if ($n -ge 0) { $last = $n }
    if (@(NewTexts $script:before $w | Where-Object { $_ -match '^分析完成：|分析失敗' }).Count) { break }
  }
  [ordered]@{ t0 = $t0; samples = @($samples | Select-Object -Last 40); grew = $grew; lastChars = $last }
}

try {
  $result.os = (Get-CimInstance Win32_OperatingSystem | ForEach-Object { "$($_.Caption) $($_.Version)" })
  $result.devTools = @('node', 'npm', 'cargo', 'rustc', 'git') | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue }
  $setup = (Get-ChildItem 'C:\ygo-in' -Filter '*-setup.exe' | Select-Object -First 1).FullName
  $result.installerSha256 = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
  if (-not (Test-Path (Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant\ygo-combo-assistant.exe'))) { $p = Start-Process $setup -ArgumentList '/S' -Wait -PassThru; $result.installExit = $p.ExitCode }
  $w = if (Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue) { AppWindow } else { StartApp }

  # A legal deck for the analysis: card data, then the user's real deck list through the app's import flow.
  Nav $w '設定'
  $null = ClickName $w '下載／更新完整卡片資料' 'Button'
  $null = WaitFor $w '^正在下載完整卡片資料' 15
  $null = WaitGone $w '^正在下載完整卡片資料' 300
  Nav $w '牌組'
  if (-not (Find $w "^$([regex]::Escape($Deck))$" '')) {
    $null = SetText $w '^牌組代碼或 YDK 內容' (Get-Content 'C:\ygo-in\edge-deck.txt' -Raw -Encoding UTF8)
    $null = ClickName $w '^解析$' 'Button'
    $null = WaitFor $w '^牌表檢核通過' 60
    $null = SetText $w '^新牌組名稱' $Deck
    $null = ClickName $w '^確認匯入$' 'Button'
    $null = WaitFor $w "已匯入「$Deck」" 30
  }
  $decksBefore = @(Names $w | Where-Object { $_ -match '^(CG4 驗收|Win10|V1 匯入)' })
  Save

  $first = SignIn $w 'sign-in 1'
  $result.signIn1 = $first
  SafeShot $w 'cg4-01-signed-in.png'
  Save

  if ($Relogin) {
    $null = ClickName $w '^登出 ChatGPT$' 'Button'
    $null = WaitFor $w '^已登出|^已在本機登出' 20
    CloseApp
    $w = StartApp
    $second = SignIn $w 'sign-in 2'
    $result.signIn2 = $second
    $starts = @(EventLines | Where-Object { $_ -match 'signin\.start' })
    $dones = @(EventLines | Where-Object { $_ -match 'signin\.done' })
    $lastStart = $starts | Select-Object -Last 1
    $ok = ($second.port -and $first.port -and $second.port -ne $first.port -and $lastStart -match '"registration":false' -and $dones.Count -ge 1 -and (Find $w '^已連線：' ''))
    Check 'P0.8 sign-in again on a new port reuses the registration' ([bool]$ok) @{ port1 = $first.port; port2 = $second.port; signinStart = $starts; signinDone = $dones.Count }
    SafeShot $w 'cg4-02-signed-in-again.png'
  }

  if ($Dk13) {
    $null = ClickName $w '^立即備份$' 'Button' 10
    Start-Sleep 3
    $pattern = 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.|"(refresh|access|id)_token"\s*:\s*"[^"]{8}|Bearer [A-Za-z0-9._-]{20}'
    $roots = @((Join-Path $env:LOCALAPPDATA 'com.ygocomboassistant.desktop'), (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'YGO Combo 助手'), (Join-Path $env:APPDATA 'com.ygocomboassistant.desktop'))
    $hits = @(); $scanned = 0
    foreach ($r in $roots) {
      foreach ($f in @(Get-ChildItem $r -Recurse -File -ErrorAction SilentlyContinue)) {
        if ($f.FullName -like '*\chatgpt\auth.json' -or $f.FullName -like '*\chatgpt\refresh.lock') { continue }
        if ($f.Length -gt 50MB) { continue }
        $scanned++
        try { $bytes = [IO.File]::ReadAllBytes($f.FullName) } catch { continue }
        $text = [Text.Encoding]::ASCII.GetString($bytes) + "`n" + [Text.Encoding]::Unicode.GetString($bytes)
        if ($text -match $pattern) { $hits += $f.FullName.Replace($env:USERPROFILE, '%USERPROFILE%') }
      }
    }
    # Known: WebView2's own component signatures (verified_contents.json, a JWS) are not app data.
    $real = @($hits | Where-Object { $_ -notmatch '\\_metadata\\verified_contents\.json$' })
    Check 'DK13 no token in web storage, backups or logs' ($real.Count -eq 0 -and $scanned -gt 0) @{ scannedFiles = $scanned; hits = $hits; tokenFileExcluded = 'chatgpt\auth.json' }
  }

  if ($Cancel) {
    OpenAnalysis $w
    $usage0 = @(Names $w | Where-Object { $_ -match '^今天已送出 \d+ 次' } | Select-Object -First 1)
    $run = StartAndStream $w 3 600
    $up1 = Upstream
    $tc = Get-Date
    $null = ClickName $w '^取消$' 'Button' 5
    $done = $false
    for ($i = 0; $i -lt 30 -and -not $done; $i++) { Start-Sleep 1; $done = @(NewTexts $script:before $w | Where-Object { $_ -match '已取消' }).Count -gt 0 }
    $secs = [Math]::Round(((Get-Date) - $tc).TotalSeconds, 1)
    Start-Sleep 5
    $up2 = Upstream
    $completed = @(NewTexts $script:before $w | Where-Object { $_ -match '^分析完成：' }).Count -gt 0
    $record = @(NewTexts $script:before $w | Where-Object { $_ -match '已取消|狀態' } | Select-Object -First 4)
    SafeShot $w 'cg4-03-cancelled.png'
    $grow = @($run.samples | ForEach-Object { $_.chars } | Select-Object -Unique)
    Check 'P0.2 progress grows while streaming' ($run.grew -ge 3 -and $grow.Count -ge 4) @{ samples = $run.samples; distinctValues = $grow.Count }
    Check 'CG4(b) real cancel stops the request; record says cancelled' ([bool]$done -and -not $completed) @{ secondsToCancelled = $secs; upstreamBefore = $up1; upstreamAfter = $up2; messages = $record; usageBefore = $usage0; usageAfter = @(Names $w | Where-Object { $_ -match '^今天已送出 \d+ 次' } | Select-Object -First 1); events = @(EventLines | Select-Object -Last 4) }
  }

  if ($NetworkCut) {
    OpenAnalysis $w
    $run = StartAndStream $w 2 600
    $tc = Get-Date
    Get-NetAdapter | Disable-NetAdapter -Confirm:$false
    # Only texts that appeared after the start count (the page's help text also mentions 失敗 and 連線).
    $failed = $false
    for ($i = 0; $i -lt 600 -and -not $failed; $i++) { Start-Sleep 1; $failed = @(NewTexts $script:before $w | Where-Object { $_ -match '分析失敗|已中止' }).Count -gt 0 }
    $secs = [Math]::Round(((Get-Date) - $tc).TotalSeconds, 1)
    Start-Sleep 3
    $messages = @(NewTexts $script:before $w | Where-Object { $_ -match '分析失敗|網路|連線|中止|狀態' } | Select-Object -First 5 | ForEach-Object { Redact $_ })
    SafeShot $w 'cg4-04-network-cut.png'
    Get-NetAdapter | Enable-NetAdapter -Confirm:$false
    Start-Sleep 8
    Nav $w '牌組'
    $decksAfter = @(Names $w | Where-Object { $_ -match '^(CG4 驗收|Win10|V1 匯入)' })
    $same = (($decksBefore -join '|') -eq ($decksAfter -join '|'))
    Check 'CG4(c) network cut mid-stream: clear failure, decks unchanged' ([bool]$failed -and $same) @{ secondsToMessage = $secs; streamedChars = $run.lastChars; messages = $messages; decksUnchanged = $same; events = @(EventLines | Select-Object -Last 4) }
  }

  Nav $w '設定'
  $null = ClickName $w '^登出 ChatGPT$' 'Button'
  $o = WaitFor $w '^已登出|^已在本機登出' 30
  $result.signOut = if ($o) { $o.Current.Name } else { '(no sign-out message)' }
  $s = Status $w
  $result.statusAfterSignOut = if ($s) { Redact $s.Current.Name }
  $result.eventLog = EventLines
  $result.ok = $true
} catch {
  $result.ok = $false
  $result.error = "$($_.Exception.Message)"
  Log "error: $($_.Exception.Message)"
  try { Get-NetAdapter | Enable-NetAdapter -Confirm:$false } catch { }
} finally {
  Save
  'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
}
