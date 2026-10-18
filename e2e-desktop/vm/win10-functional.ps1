# Windows 10 VM: the installed app end to end through UI Automation (desktop session, scheduled task). Each step records
# a check in C:\ygo-out\functional-result.json. Covers DK2–DK8, DK10, DK12, DK14–DK20, DK22, DK25, P0.5, P0.13, P0.16.
# Inputs in C:\ygo-in: the installer, uia-lib.ps1, edge-deck.txt, combo.json, v1-backup.json, hand-shot.png, hand-ids.json.
$ErrorActionPreference = 'Continue'
. C:\ygo-in\uia-lib.ps1
$out = 'C:\ygo-out'
$log = Join-Path $out 'functional-log.txt'
$result = [ordered]@{ startedAt = (Get-Date).ToString('o'); checks = [ordered]@{} }
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) $m" | Out-File -Append -Encoding utf8 $log }
function Save { $result.finishedAt = (Get-Date).ToString('o'); $result | ConvertTo-Json -Depth 8 | Out-File -Encoding utf8 (Join-Path $out 'functional-result.json') }
function Check([string]$id, [bool]$ok, $detail) {
  $result.checks[$id] = [ordered]@{ ok = $ok; detail = $detail }
  if (-not $ok) { try { Shot (Join-Path $out ("fail-{0}.png" -f ($id -replace '[^A-Za-z0-9]+', '_'))) } catch { } }
  Log ("{0} {1}: {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' })), $id, ($detail | ConvertTo-Json -Compress -Depth 4))
  Save
}
function Step([string]$name, [scriptblock]$body) {
  Log "== $name"
  try { & $body } catch { Check "$name (error)" $false "$($_.Exception.Message)"; try { Shot (Join-Path $out "err-$($name -replace '\W','_').png") } catch { } }
}

$setup = (Get-ChildItem 'C:\ygo-in' -Filter '*-setup.exe' | Select-Object -First 1).FullName
$dir = Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant'
$dataDir = Join-Path $env:LOCALAPPDATA 'com.ygocomboassistant.desktop'
$docs = [Environment]::GetFolderPath('MyDocuments')
$backupDir = Join-Path $docs 'YGO Combo 助手\backups'
$deckName = 'Win10 Edge'
$deckRenamed = 'Win10 Edge 改'

# Network audit (DK14): sample the app's and the bundled service's TCP connections for the whole run.
$sampler = Start-Job -ScriptBlock {
  $seen = @{}
  while ($true) {
    $ids = @(Get-Process ygo-combo-assistant, ygo-bridge -ErrorAction SilentlyContinue | ForEach-Object Id)
    foreach ($id in $ids) {
      foreach ($c in @(Get-NetTCPConnection -OwningProcess $id -ErrorAction SilentlyContinue)) {
        if ($c.RemoteAddress -notmatch '^(127\.|::1|0\.0\.0\.0|::$)') { $seen["$((Get-Process -Id $id -ErrorAction SilentlyContinue).ProcessName) $($c.RemoteAddress):$($c.RemotePort)"] = 1 }
      }
    }
    $seen.Keys | Set-Content 'C:\ygo-out\connections.txt'
    Start-Sleep 2
  }
}

try {
  Log 'start'
  # Test VM only: no "allow this PC to be discoverable" flyout after network changes (it swallows clicks).
  New-Item 'HKLM:\System\CurrentControlSet\Control\Network\NewNetworkWindowOff' -Force -ErrorAction SilentlyContinue | Out-Null
  $os = Get-CimInstance Win32_OperatingSystem
  $result.os = "$($os.Caption) $($os.Version) build $($os.BuildNumber)"
  $result.installerSha256 = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()

  Step 'install' {
    if (-not (Test-Path (Join-Path $dir 'ygo-combo-assistant.exe'))) { Start-Process $setup -ArgumentList '/S' -Wait }
    Check 'DK1 installed' (Test-Path (Join-Path $dir 'ygo-combo-assistant.exe')) $dir
  }

  Step 'DK2 / DK3' {
    $w = StartApp 'start'
    Check 'DK2 start-menu shortcut starts the app' ([bool]$w) $w.Current.Name
    $app = Get-Process ygo-combo-assistant | Select-Object -First 1
    $consoles = @(Get-CimInstance Win32_Process -Filter "Name='conhost.exe'" | Where-Object { $p = $_.ParentProcessId; @(Get-Process ygo-combo-assistant, ygo-bridge -ErrorAction SilentlyContinue | ForEach-Object Id) -contains $p })
    $bridgeWindows = @(Get-Process ygo-bridge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })
    Check 'DK3 no console window' ($consoles.Count -eq 0 -and $bridgeWindows.Count -eq 0) @{ conhost = $consoles.Count; bridgeWindows = $bridgeWindows.Count }
    Start-Process (Join-Path ([Environment]::GetFolderPath('Desktop')) 'YGO Combo Assistant.lnk')
    Start-Sleep 6
    $procs = @(Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue)
    Check 'DK3 second launch keeps one instance' ($procs.Count -eq 1 -and $procs[0].Id -eq $app.Id) @{ count = $procs.Count }
  }

  $w = AppWindow
  Step 'DK5 card data sync' {
    Nav $w '設定'
    $null = ClickName $w '下載／更新完整卡片資料' 'Button'
    $null = WaitFor $w '^正在下載完整卡片資料' 20
    $null = WaitGone $w '^正在下載完整卡片資料' 300
    $synced = WaitFor $w '^已同步 \d+ 張卡片|^卡片資料已是最新版本' 10
    Check 'DK5 sync' ([bool]$synced) $(if ($synced) { $synced.Current.Name } else { (Names $w | Where-Object { $_ -match '失敗|無法' } | Select-Object -First 2) })
  }

  Step 'DK4 import / create' {
    Nav $w '牌組'
    $null = SetText $w '^牌組代碼或 YDK 內容' (Get-Content 'C:\ygo-in\edge-deck.txt' -Raw -Encoding UTF8)
    $null = ClickName $w '^解析$' 'Button'
    $ok = WaitFor $w '^牌表檢核通過' 60
    $null = SetText $w '^新牌組名稱' $deckName
    $null = ClickName $w '^確認匯入$' 'Button'
    $done = WaitFor $w "已匯入「$deckName」" 30
    Check 'DK4 import official deck list' ([bool]($ok -and $done)) $(if ($done) { $done.Current.Name } else { '(not imported)' })
    $null = SetText $w '^牌組名稱$' 'Win10 空白'
    $null = ClickName $w '^建立$' 'Button'
    Check 'DK4 create blank deck' ([bool](WaitFor $w '^Win10 空白$' 15)) 'Win10 空白'
  }

  Step 'DK4 / DK5 / P0.16 editor' {
    $null = Click (FindInRow $w "^$deckName$" '^編輯$' 'Hyperlink')
    $null = WaitFor $w '^儲存$' 20 'Button'
    $null = SetText $w '^卡名（英文／繁中／俗稱）或卡片 ID' 'maliss'
    $hits = WaitFor $w '符合 1\d 張' 20
    $null = SetText $w '^卡名（英文／繁中／俗稱）或卡片 ID' '32061192'
    $one = WaitFor $w '符合 1 張' 20
    Check 'DK5 local search by name and ID' ([bool]($hits -and $one)) @{ name = $(if ($hits) { $hits.Current.Name }); id = $(if ($one) { $one.Current.Name }) }

    # A real click, as a user does: the WebView only lets a focused page that got real user input write the clipboard.
    $null = RealClick (WaitFor $w '^複製 ydke:// 代碼$' 10 'Button')
    $copied = WaitFor $w '^已複製 ydke:// 代碼' 10
    $copyMessage = @(Names $w | Where-Object { $_ -match '剪貼簿|已複製' } | Select-Object -First 2)
    $clip = ''
    for ($i = 0; $i -lt 20 -and $clip -notlike 'ydke://*'; $i++) {
      Start-Sleep -Milliseconds 500
      try { $clip = [System.Windows.Forms.Clipboard]::GetText() } catch { }
      if ($clip -notlike 'ydke://*') { try { $clip = [string](Get-Clipboard -Raw) } catch { } }
    }
    $script:ydke = $clip
    Check 'P0.16 clipboard' ([bool]($copied -and $clip -like 'ydke://*')) @{ prefix = $clip.Substring(0, [Math]::Min(12, $clip.Length)); appMessage = $copyMessage }

    $null = ClickName $w '^下載此牌組卡圖$' 'Button'
    $imgs = WaitFor $w '^已下載 \d+ 張卡圖' 240
    Check 'DK6 card images downloaded' ([bool]$imgs) $(if ($imgs) { $imgs.Current.Name })

    $null = SetText $w '^牌組名稱$' $deckRenamed
    $null = ClickName $w '^儲存$' 'Button'
    $saved = WaitFor $w '^已儲存（版本 \d+）' 15
    Check 'DK4 edit and save' ([bool]$saved) $(if ($saved) { $saved.Current.Name })

    $exportPath = Join-Path $out 'deck-export.json'
    $null = ClickName $w '^下載牌組 JSON 備份$' 'Button'
    $answer = AnswerFileDialog $exportPath
    Start-Sleep 2
    $exported = (Test-Path $exportPath) -and ((Get-Content $exportPath -Raw -Encoding UTF8) -match [regex]::Escape($deckRenamed))
    Check 'DK4 export through the Save dialog' $exported @{ dialog = $answer; file = (Test-Path $exportPath) }
  }

  Step 'DK4 ydke import' {
    Nav $w '牌組'
    if ($script:ydke) {
      $null = SetText $w '^牌組代碼或 YDK 內容' $script:ydke
      $null = ClickName $w '^解析$' 'Button'
      $ok = WaitFor $w '^牌表檢核通過' 30
      $null = SetText $w '^新牌組名稱' 'Win10 ydke'
      $null = ClickName $w '^確認匯入$' 'Button'
      $done = WaitFor $w '已匯入「Win10 ydke」' 30
      Check 'DK4 import ydke://' ([bool]($ok -and $done)) $(if ($done) { $done.Current.Name })
    } else { Check 'DK4 import ydke://' $false 'no ydke code from the clipboard step' }
  }

  Step 'DK7 combo' {
    Nav $w 'Combo 管理'
    $null = SetText $w '^JSON 內容' (Get-Content 'C:\ygo-in\combo.json' -Raw -Encoding UTF8)
    $null = ClickName $w '^檢查$' 'Button'
    $fetch = WaitFor $w '^從 YGOPRODeck 下載缺少的' 8 'Button'
    if ($fetch) { $null = Click $fetch }
    $null = ClickName $w '^確認匯入$' 'Button' 30
    $imported = WaitFor $w '已匯入 1 條' 20
    $null = ClickName $w '^查看$' 'Hyperlink'
    $null = ClickName $w '^逐步教學$' 'Button'
    $s1 = WaitFor $w '第 1 / 3 步' 15
    $null = ClickName $w '^下一步$' 'Button'
    $s2 = WaitFor $w '第 2 / 3 步' 10
    $null = ClickName $w '圖像流程' 'Button'
    Start-Sleep 1
    $flow = [bool](Find $w '跳至終場|終場' '')
    $null = ClickName $w '^逐步教學$' 'Button'
    $kept = WaitFor $w '第 2 / 3 步' 10
    Check 'DK7 combo imported, both modes, shared step' ([bool]($imported -and $s1 -and $s2 -and $kept)) @{ imported = [bool]$imported; step1 = [bool]$s1; step2 = [bool]$s2; flowView = $flow; stepKept = [bool]$kept }
    Shot (Join-Path $out '07-combo.png')
  }

  Step 'DK8 hand query and screenshot recognition' {
    Nav $w '牌組'
    $null = Click (FindInRow $w "^$deckRenamed$" '^起手查詢$' 'Hyperlink')
    $null = ClickName $w '^開啟截圖辨識$' 'Button'
    $refs = WaitFor $w '^下載辨識用卡圖（YGOPRODeck）$' 8 'Button'
    if ($refs) { $null = Click $refs; $null = WaitFor $w '已下載 \d+ 張辨識用卡圖' 240 }
    $pick = WaitFor $w '選擇截圖檔' 10
    $null = RealClick $pick
    # A light-dismiss flyout (e.g. Windows' network prompt) can swallow the first click: click again if needed.
    for ($i = 0; $i -lt 2 -and -not (FindFileDialog); $i++) { Start-Sleep 3; if (-not (FindFileDialog)) { $null = RealClick (WaitFor $w '選擇截圖檔' 5) } }
    $answer = AnswerFileDialog 'C:\ygo-in\hand-shot.png'
    $null = ClickName $w '^使用預設位置$' 'Button' 20
    $null = ClickName $w '^開始辨識$' 'Button'
    $null = WaitFor $w '^確認手牌並查詢$' 60 'Button'
    Start-Sleep 3
    Shot (Join-Path $out '08-recognition.png')
    $null = ClickName $w '^確認手牌並查詢$' 'Button'
    $head = WaitFor $w '起手（5 / 5 張）' 20
    # The hand that was actually taken over from the recognition: one "remove card N" control per hand card.
    $hand = @(Names $w | Where-Object { $_ -match '^移除第 \d 張：' } | ForEach-Object { $_ -replace '^移除第 \d 張：', '' })
    $expected = @('Maliss <P> Dormouse', 'Maliss <P> White Rabbit', 'Maliss in Underground', 'Maliss <C> GWC-06', 'Maliss <P> Chessy Cat')
    $matched = @($expected | Where-Object { $hand -contains $_ })
    Check 'DK8 screenshot recognition (5 real card arts)' ($answer -eq 'ok' -and $matched.Count -eq 5) @{ dialog = $answer; hand = $hand }
    $answerText = WaitFor $w '沒有收錄符合目前起手的固定展開|符合起手條件|不符合' 20
    Check 'DK8 opening-hand query' ([bool]($head -and $answerText -and -not (Find $w '無法展開' ''))) $(if ($answerText) { $answerText.Current.Name })
    $null = ClickName $w '^隨機抽 5 張$' 'Button'
    Check 'DK8 random hand' ([bool](WaitFor $w '起手（5 / 5 張）' 10)) 'drawn'
  }

  Step 'DK10 / DK19 backups' {
    Nav $w '設定'
    $null = ClickName $w '^立即備份$' 'Button'
    $made = WaitFor $w '^已建立備份：|^沒有資料需要備份' 20
    $files = @(Get-ChildItem $backupDir -Filter 'ygo-backup-*.json' -ErrorAction SilentlyContinue)
    Check 'DK10 backup now' ($files.Count -gt 0) @{ message = $(if ($made) { $made.Current.Name }); files = $files.Count }
    $null = ClickName $w '^從此備份還原…$' 'Button'
    $preview = WaitFor $w '還原預覽（尚未寫入）' 20
    $null = ClickName $w '^確認還原$' 'Button'
    $restored = WaitFor $w '還原完成' 20
    Check 'DK10 restore from an automatic backup' ([bool]($preview -and $restored)) $(if ($restored) { $restored.Current.Name })
    $null = RealClick (WaitFor $w '從備份檔還原…' 10)
    $answer = AnswerFileDialog 'C:\ygo-in\v1-backup.json'
    $preview = WaitFor $w '還原預覽（尚未寫入）' 20
    $null = ClickName $w '^確認還原$' 'Button'
    $restored = WaitFor $w '還原完成' 20
    Nav $w '牌組'
    $v1 = WaitFor $w '^V1 匯入牌組 Win10$' 15
    Check 'DK19 V1 browser backup imports' ([bool]($preview -and $restored -and $v1)) @{ dialog = $answer; deck = [bool]$v1 }
  }

  Step 'DK12 / DK22 bundled service' {
    Nav $w '設定'
    $null = ClickName $w '^重新整理$' 'Button'
    Start-Sleep 3
    $b1 = Get-Process ygo-bridge -ErrorAction SilentlyContinue | Select-Object -First 1
    $port = if ($b1) { (Get-NetTCPConnection -State Listen -OwningProcess $b1.Id -ErrorAction SilentlyContinue | Select-Object -First 1).LocalPort }
    $codes = @{}
    foreach ($case in @(@{ n = 'no secret'; h = @{} }, @{ n = 'wrong secret'; h = @{ 'x-ygo-bridge-token' = ('x' * 40) } })) {
      try { $r = Invoke-WebRequest "http://127.0.0.1:$port/status" -Headers $case.h -UseBasicParsing -TimeoutSec 5; $codes[$case.n] = [int]$r.StatusCode } catch { $codes[$case.n] = [int]$_.Exception.Response.StatusCode }
    }
    $listen = @(Get-NetTCPConnection -State Listen -OwningProcess $b1.Id -ErrorAction SilentlyContinue | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort)" })
    Check 'DK22 service refuses requests without the secret; loopback only' (($codes.Values | Where-Object { $_ -ne 401 -and $_ -ne 403 }).Count -eq 0 -and ($listen | Where-Object { $_ -notmatch '^127\.0\.0\.1:' }).Count -eq 0) @{ codes = $codes; listen = $listen }
    Stop-Process -Id $b1.Id -Force
    Start-Sleep 2
    $null = ClickName $w '^重新整理$' 'Button'
    $b2 = $null
    for ($i = 0; $i -lt 60 -and -not $b2; $i++) { Start-Sleep 1; $b2 = Get-Process ygo-bridge -ErrorAction SilentlyContinue | Where-Object Id -ne $b1.Id | Select-Object -First 1 }
    Start-Sleep 3
    Check 'DK12 crashed service restarts on refresh' ([bool]$b2 -and -not (Find $w '本機 ChatGPT 服務目前沒有回應' '')) @{ old = $b1.Id; new = $(if ($b2) { $b2.Id }) }
  }

  Step 'DK15 / P0.5 close and reopen' {
    CloseApp
    $left = @(Get-Process ygo-combo-assistant, ygo-bridge -ErrorAction SilentlyContinue).Count
    Check 'P0.5 / DK11 nothing left after closing' ($left -eq 0) @{ left = $left }
    $script:w = StartApp
    Nav $script:w '牌組'
    Check 'DK15 data still there after reopening' ([bool](WaitFor $script:w "^$deckRenamed$" 15)) $deckRenamed
  }
  $w = AppWindow

  Step 'DK20 offline' {
    Get-NetAdapter | Disable-NetAdapter -Confirm:$false
    Start-Sleep 3
    Nav $w '牌組'
    $null = Click (FindInRow $w "^$deckRenamed$" '^編輯$' 'Hyperlink')
    $names = WaitFor $w 'Maliss <P> Dormouse' 15
    Nav $w '設定'
    $cache = WaitFor $w '^\d+ 張$' 5
    Nav $w 'Combo 管理'
    $null = ClickName $w '^查看$' 'Hyperlink'
    $null = ClickName $w '^逐步教學$' 'Button'
    $step = WaitFor $w '第 1 / 3 步' 10
    Nav $w '設定'
    $before = Names $w
    $t0 = Get-Date
    $null = ClickName $w '下載／更新完整卡片資料' 'Button'
    $null = WaitFor $w '^正在下載完整卡片資料' 10
    $null = WaitGone $w '^正在下載完整卡片資料' 90
    $secs = [int]((Get-Date) - $t0).TotalSeconds
    Start-Sleep 1
    # The action's own message: texts that were not on the page before (the static help text also says 失敗).
    $reason = @(NewTexts $before $w | Where-Object { $_ -notmatch '^正在下載' } | Select-Object -First 3)
    $failed = @($reason | Where-Object { $_ -match '無法|離線|失敗|錯誤|連線' }).Count -gt 0 -and -not (@($reason | Where-Object { $_ -match '^已同步' }).Count)
    Get-NetAdapter | Enable-NetAdapter -Confirm:$false
    Start-Sleep 5
    Check 'DK20 offline: stored deck, card names, combo work; online action fails fast with a reason' ([bool]($names -and $step -and $failed -and $secs -lt 60)) @{ cardNames = [bool]$names; combo = [bool]$step; reason = $reason; seconds = $secs }
  }

  Step 'DK25 / P0.13 force kill' {
    Get-Process ygo-combo-assistant | Stop-Process -Force
    $gone = $false
    for ($i = 0; $i -lt 15 -and -not $gone; $i++) { Start-Sleep 1; $gone = -not (Get-Process ygo-bridge -ErrorAction SilentlyContinue) }
    $w2 = StartApp
    Check 'DK25 no service left after End task; starts again' ($gone -and [bool]$w2) @{ serviceGone = $gone }
    CloseApp
  }

  Step 'DK16 upgrade' {
    $p = Start-Process $setup -ArgumentList '/S' -Wait -PassThru
    $w3 = StartApp
    Nav $w3 '牌組'
    Check 'DK16 install over the existing app keeps the data' ($p.ExitCode -eq 0 -and [bool](WaitFor $w3 "^$deckRenamed$" 15)) @{ exit = $p.ExitCode }
    CloseApp
  }

  Step 'DK18 restore after the data folder is deleted' {
    Remove-Item $dataDir -Recurse -Force
    $w4 = StartApp
    Nav $w4 '牌組'
    $empty = -not (WaitFor $w4 "^$deckRenamed$" 5)
    Nav $w4 '設定'
    $null = ClickName $w4 '^從此備份還原…$' 'Button'
    $null = WaitFor $w4 '還原預覽（尚未寫入）' 20
    $null = ClickName $w4 '^確認還原$' 'Button'
    $restored = WaitFor $w4 '還原完成' 20
    Nav $w4 '牌組'
    Check 'DK18 data folder deleted → restored from the automatic backup' ([bool]($empty -and $restored -and (WaitFor $w4 "^$deckRenamed$" 15))) @{ emptyAfterDelete = $empty }
    CloseApp
  }

  Step 'DK17 uninstall and reinstall' {
    $p = Start-Process (Join-Path $dir 'uninstall.exe') -ArgumentList '/S', "_?=$dir" -Wait -PassThru
    $removed = -not (Test-Path (Join-Path $dir 'ygo-combo-assistant.exe'))
    $kept = Test-Path $dataDir
    $p2 = Start-Process $setup -ArgumentList '/S' -Wait -PassThru
    $w5 = StartApp
    Nav $w5 '牌組'
    Check 'DK17 uninstall keeps data; reinstall shows it' ($removed -and $kept -and [bool](WaitFor $w5 "^$deckRenamed$" 15)) @{ removed = $removed; dataKept = $kept }
    CloseApp
  }

  # DK14: every outside address the app or its service talked to must belong to an approved host.
  # Plain strings: Get-Content attaches provider properties that ConvertTo-Json would expand without end.
  $result.connections = [string[]]@(Get-Content 'C:\ygo-out\connections.txt' -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
  $approved = @{}
  foreach ($h in 'db.ygoprodeck.com', 'images.ygoprodeck.com', 'auth.openai.com', 'api.openai.com') {
    foreach ($ip in @(Resolve-DnsName $h -ErrorAction SilentlyContinue | Where-Object IPAddress | ForEach-Object IPAddress)) { $approved[$ip] = $h }
  }
  $unknown = @($result.connections | Where-Object { $ip = ($_ -split ' ')[1] -replace ':\d+$', '' -replace '^\[|\]$', ''; -not $approved.ContainsKey($ip) })
  Check 'DK14 only approved hosts contacted' ($unknown.Count -eq 0 -and $result.connections.Count -gt 0) @{ connections = $result.connections; matched = @($result.connections | ForEach-Object { $ip = ($_ -split ' ')[1] -replace ':\d+$', ''; "$_ = $($approved[$ip])" }); unknown = $unknown }
  $result.ok = $true
} catch {
  $result.ok = $false
  $result.error = "$($_.Exception.Message)"
  Log "error: $($_.Exception.Message)"
} finally {
  Stop-Job $sampler -ErrorAction SilentlyContinue
  $fails = @($result.checks.Keys | Where-Object { -not $result.checks[$_].ok })
  $result.summary = "$(@($result.checks.Keys).Count - $fails.Count) / $(@($result.checks.Keys).Count) checks passed"
  Save
  Log "done: $($result.summary)"
  'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
}
