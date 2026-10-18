# Runs INSIDE Windows Sandbox (a clean Windows with no Node, Rust or npm): P0.9 / DK23 / DK1 / P0.10 evidence.
# Mapped folders (see sandbox.wsb): C:\ygo-in (read-only: the installer), C:\ygo-out (results).
# The app is driven through Windows UI Automation (what a screen reader sees): no Node and no DevTools port needed.
# Also used in the Windows 10 VM; -Offline (no network: P0.10 "no Runtime, offline") skips the online card sync and import.
# -RedirectDocuments moves the user's Documents folder the way OneDrive folder backup does (P0.11).
param([switch]$Offline, [switch]$RedirectDocuments)
$ErrorActionPreference = 'Continue'
$out = 'C:\ygo-out'
$log = Join-Path $out 'sandbox-log.txt'
$result = [ordered]@{ startedAt = (Get-Date).ToString('o') }
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) $m" | Out-File -Append -Encoding utf8 $log }
function Save { $result.finishedAt = (Get-Date).ToString('o'); $result | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $out 'sandbox-result.json') }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing
$A = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]

function Shot($name) {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
  $bmp.Save((Join-Path $out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
function AppWindow($procId) {
  $A::RootElement.FindFirst($Scope::Children, (New-Object System.Windows.Automation.PropertyCondition($A::ProcessIdProperty, $procId)))
}
function Names($win) {
  @($win.FindAll($Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name } | Where-Object { $_ })
}
function Find($win, [string]$pattern, [string]$type) {
  foreach ($e in $win.FindAll($Scope::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
    $c = $e.Current
    if ($c.Name -match $pattern -and (-not $type -or $c.ControlType.ProgrammaticName -eq "ControlType.$type")) { return $e }
  }
  $null
}
function Click($e) {
  try { $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return $true } catch { }
  try { $e.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).DoDefaultAction(); return $true } catch { }
  $false
}
function WaitFor($win, [string]$pattern, [int]$seconds, [string]$type) {
  $end = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $end) { $e = Find $win $pattern $type; if ($e) { return $e }; Start-Sleep 1 }
  $null
}

try {
  Log 'start'
  $os = Get-CimInstance Win32_OperatingSystem
  $result.os = "$($os.Caption) $($os.Version) build $($os.BuildNumber)"
  $result.user = $env:USERNAME
  # P0.9 / DK23: no developer tools on this machine.
  $result.devTools = [ordered]@{}
  foreach ($t in 'node', 'npm', 'npx', 'cargo', 'rustc', 'ng', 'git') { $result.devTools[$t] = [bool](Get-Command $t -ErrorAction SilentlyContinue) }
  $wv2Key = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  $wv2User = 'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  $result.webView2Before = [ordered]@{ machine = (Get-ItemProperty $wv2Key -ErrorAction SilentlyContinue).pv; user = (Get-ItemProperty $wv2User -ErrorAction SilentlyContinue).pv }
  if ($RedirectDocuments) {
    # Same registry change OneDrive's "back up Documents" makes: the known folder now lives under OneDrive.
    $target = Join-Path $env:USERPROFILE 'OneDrive\文件'
    New-Item -ItemType Directory -Force $target | Out-Null
    $usf = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders'
    Set-ItemProperty $usf -Name 'Personal' -Value $target
    Set-ItemProperty $usf -Name '{F42EE2D3-909F-4907-8871-4C22FC0BF756}' -Value $target
    $result.redirectedDocuments = [ordered]@{ target = $target; windowsReports = [Environment]::GetFolderPath('MyDocuments') }
  }
  Save

  $setup = Get-ChildItem 'C:\ygo-in' -Filter '*-setup.exe' | Select-Object -First 1
  $result.installer = $setup.Name
  $result.installerSha256 = (Get-FileHash $setup.FullName -Algorithm SHA256).Hash.ToLower()
  $t0 = Get-Date
  $p = Start-Process $setup.FullName -ArgumentList '/S' -Wait -PassThru
  $result.install = [ordered]@{ exitCode = $p.ExitCode; seconds = [int]((Get-Date) - $t0).TotalSeconds }
  $dir = Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant'
  $exe = Join-Path $dir 'ygo-combo-assistant.exe'
  $result.install.dir = $dir
  $result.install.exe = Test-Path $exe
  $result.install.bridge = Test-Path (Join-Path $dir 'ygo-bridge.exe')
  $desktopLnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'YGO Combo Assistant.lnk'
  $result.install.desktopShortcut = Test-Path $desktopLnk
  $result.install.startShortcut = Test-Path (Join-Path ([Environment]::GetFolderPath('Programs')) 'YGO Combo Assistant.lnk')
  $result.install.shortcutTarget = (New-Object -ComObject WScript.Shell).CreateShortcut($desktopLnk).TargetPath
  $result.install.uninstallEntry = [bool](Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | Where-Object { (Get-ItemProperty $_.PSPath).DisplayName -eq 'YGO Combo Assistant' })
  $result.webView2After = [ordered]@{ machine = (Get-ItemProperty $wv2Key -ErrorAction SilentlyContinue).pv; user = (Get-ItemProperty $wv2User -ErrorAction SilentlyContinue).pv }
  Log "installed: $($result.install | ConvertTo-Json -Compress)"
  Save

  # Launch through the desktop shortcut, like the user.
  Start-Process $desktopLnk
  $win = $null
  for ($i = 0; $i -lt 90 -and -not $win; $i++) {
    Start-Sleep 1
    $proc = Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc) { $win = AppWindow $proc.Id }
  }
  if (-not $win) { throw 'the app window did not appear within 90 s' }
  $result.app = [ordered]@{ windowTitle = $win.Current.Name }
  $homeEl = WaitFor $win '^首頁$' 60 'Text'
  if (-not $homeEl) { $homeEl = WaitFor $win '^首頁$' 5 '' }
  Start-Sleep 3
  $result.app.homeVisible = [bool]$homeEl
  $result.app.navLinks = @($win.FindAll($Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Hyperlink))) | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -First 12)
  Shot '01-home'
  Log "home: $($result.app.homeVisible) nav: $($result.app.navLinks -join ' / ')"
  Save

  # The bundled ChatGPT service runs without Node on this machine: the settings page reaches it.
  $settings = Find $win '^設定$' 'Hyperlink'
  $result.app.openedSettings = if ($settings) { Click $settings } else { $false }
  Start-Sleep 3
  $status = $null
  for ($i = 0; $i -lt 20; $i++) {
    $status = Find $win '^(尚未登入|已連線|已登入，但|本機 ChatGPT 服務尚未連線)' ''
    if ($status -and $status.Current.Name -notmatch '尚未連線') { break }
    $refresh = Find $win '^重新整理$' 'Button'
    if ($refresh) { $null = Click $refresh }
    Start-Sleep 3
  }
  $result.app.chatgptStatus = if ($status) { $status.Current.Name } else { '(not found)' }
  $bridge = Get-Process ygo-bridge -ErrorAction SilentlyContinue | Select-Object -First 1
  $result.app.bridgeProcess = [bool]$bridge
  if ($bridge) { $result.app.bridgeListeners = @(Get-NetTCPConnection -State Listen -OwningProcess $bridge.Id -ErrorAction SilentlyContinue | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort)" }) }
  Shot '02-settings'
  Log "chatgpt: $($result.app.chatgptStatus) bridge: $($result.app.bridgeProcess) $($result.app.bridgeListeners -join ',')"
  Save

  # Backup to the Documents folder Windows reports.
  $backup = Find $win '^立即備份$' 'Button'
  $result.app.backupClicked = if ($backup) { Click $backup } else { $false }
  # This PowerShell process caches the Documents path from before the redirect; the app (started later) reads the new one.
  $docs = if ($RedirectDocuments) { $result.redirectedDocuments.target } else { [Environment]::GetFolderPath('MyDocuments') }
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    $result.app.backupFiles = @(Get-ChildItem (Join-Path $docs 'YGO Combo 助手\backups') -Filter 'ygo-backup-*.json' -ErrorAction SilentlyContinue | ForEach-Object Name)
    if ($result.app.backupFiles.Count) { break }
  }
  $backupMsg = Find $win '^已建立備份|^備份失敗|^沒有資料需要備份' ''
  $result.app.backupMessage = if ($backupMsg) { $backupMsg.Current.Name } else { '' }
  Log "backup files: $($result.app.backupFiles -join ',')"

  if ($Offline) {
    $result.app.offline = 'no network: online card sync and deck import skipped'
  } else {
  # Card data needs the internet the first time (D5): one sync through the app's own HTTP client.
  $sync = Find $win '下載／更新完整卡片資料' 'Button'
  $result.app.syncClicked = if ($sync) { Click $sync } else { $false }
  # Wait for the progress line to go away, then read the result (success wording is fixed; a failure shows its reason).
  $null = WaitFor $win '^正在下載完整卡片資料' 20 ''
  $end = (Get-Date).AddSeconds(300)
  while ((Get-Date) -lt $end -and (Find $win '^正在下載完整卡片資料' '')) { Start-Sleep 2 }
  Start-Sleep 2
  $synced = Find $win '^已同步 \d+ 張卡片|^卡片資料已是最新版本' ''
  $result.app.cardSync = if ($synced) { $synced.Current.Name } else { 'NOT SUCCESSFUL; status texts: ' + ((Names $win | Where-Object { $_ -match '失敗|無法|錯誤|逾時' } | Select-Object -First 3) -join ' | ') }
  Shot '03-after-sync'
  Log "sync: $($result.app.cardSync)"
  Save

  # Import the user's real deck list through the 牌組 page (resolved with the synced card data), then back up.
  $decks = Find $win '^牌組$' 'Hyperlink'
  if ($decks) { $null = Click $decks }
  $box = WaitFor $win '^牌組代碼或 YDK 內容' 20 'Edit'
  if ($box) {
    $text = Get-Content 'C:\ygo-in\edge-deck.txt' -Raw -Encoding UTF8
    $box.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($text)
    Start-Sleep 1
    $parse = Find $win '^解析$' 'Button'
    if ($parse) { $null = Click $parse }
    $ok = WaitFor $win '^牌表檢核通過' 60 ''
    $result.app.afterParseTexts = @(Names $win | Where-Object { $_ -match '主牌|檢核|錯誤|無法|找不到|未識別|不認得|請先|失敗|張' } | Select-Object -First 12)
    $counts = Find $win '主牌 \d+ 張／額外 \d+ 張／備牌 \d+ 張' ''
    $result.app.importParsed = if ($counts) { $counts.Current.Name } else { '(no counts)' }
    $result.app.importLegal = [bool]$ok
    $name = Find $win '^新牌組名稱' 'Edit'
    if ($name) { $name.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('Edge 沙箱驗收'); Start-Sleep 1 }
    $result.app.nameFieldFound = [bool]$name
    $confirm = Find $win '^確認匯入$' 'Button'
    $result.app.confirmEnabled = if ($confirm) { $confirm.Current.IsEnabled } else { $null }
    if ($ok -and $confirm) { $result.app.confirmClicked = Click $confirm }
    $done = WaitFor $win '已匯入「' 30 ''
    $result.app.imported = if ($done) { $done.Current.Name } else { '(not imported)' }
  } else {
    $result.app.imported = '(import box not found)'
  }
  Shot '04-imported'
  Log "import: $($result.app.importParsed) / $($result.app.imported)"
  $settings = Find $win '^設定$' 'Hyperlink'
  if ($settings) { $null = Click $settings }
  $backup = WaitFor $win '^立即備份$' 20 'Button'
  if ($backup) { $null = Click $backup }
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    $files = @(Get-ChildItem (Join-Path $docs 'YGO Combo 助手\backups') -Filter 'ygo-backup-*.json' -ErrorAction SilentlyContinue)
    if ($files.Count) { break }
  }
  $result.app.backupAfterImport = @($files | ForEach-Object Name)
  if ($files.Count) {
    $json = Get-Content $files[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    $result.app.backupDecks = @($json.decks | ForEach-Object name)
    $result.app.backupHasSecret = (Get-Content $files[0].FullName -Raw) -match 'refresh_token|access_token|id_token|x-ygo-bridge-token|sk-[A-Za-z0-9]{10}'
  }
  $backupMsg = Find $win '^已建立備份|^備份失敗|^沒有資料需要備份' ''
  $result.app.backupMessage2 = if ($backupMsg) { $backupMsg.Current.Name } else { '' }
  $result.app.documentsFolder = $docs
  Log "backup: $($result.app.backupAfterImport -join ',') $($result.app.backupMessage2)"
  Save
  }

  # The settings page shows the backup folder Windows reports (P0.11 with a redirected Documents folder).
  $settings = Find $win '^設定$' 'Hyperlink'
  if ($settings) { $null = Click $settings; Start-Sleep 3 }
  $shown = Find $win 'YGO Combo 助手\\backups' ''
  $result.app.backupFolderShown = if ($shown) { $shown.Current.Name } else { '(not found)' }

  # P0.16: an external link opens in the system browser (only the approved official site).
  $decks = Find $win '^牌組$' 'Hyperlink'
  if ($decks) { $null = Click $decks; Start-Sleep 3 }
  $code = WaitFor $win '^Master Duel 牌組代碼' 15 'Edit'
  if ($code) {
    $code.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('2962ut6')
    Start-Sleep 1
    $open = Find $win '^在官方網站開啟$' 'Button'
    $result.app.externalClicked = if ($open) { Click $open } else { $false }
    $browser = $null
    for ($i = 0; $i -lt 20 -and -not $browser; $i++) {
      Start-Sleep 1
      $browser = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'db\.yugioh-card\.com' } | Select-Object -First 1
    }
    $result.app.externalBrowser = if ($browser) { ($browser.CommandLine -replace '^.*?(https?://\S+).*$', '$1') } else { '(no browser process with the official URL)' }
    $msg = Find $win '^已在(系統瀏覽器|新分頁)開啟官方牌組搜尋' ''
    $result.app.externalMessage = if ($msg) { $msg.Current.Name } else { '(no message)' }
    Shot '05-external-link'
  }

  # A target="_blank" link inside the app (the combo's source) must reach the system browser too: the WebView alone drops it.
  if (Test-Path 'C:\ygo-in\combo.json') {
    $combos = Find $win '^Combo 管理$' 'Hyperlink'
    if ($combos) { $null = Click $combos; Start-Sleep 3 }
    $json = WaitFor $win '^JSON 內容' 15 'Edit'
    if ($json) {
      $json.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue((Get-Content 'C:\ygo-in\combo.json' -Raw -Encoding UTF8))
      Start-Sleep 1
      $check = Find $win '^檢查$' 'Button'
      if ($check) { $null = Click $check }
      # A card outside the synced Master Duel pool: the app offers to fetch it from YGOPRODeck and check again.
      $fetchMissing = WaitFor $win '^從 YGOPRODeck 下載缺少的' 8 'Button'
      if ($fetchMissing) { $result.app.comboFetchedMissingCards = Click $fetchMissing }
      $confirmCombo = WaitFor $win '^確認匯入$' 30 'Button'
      if ($confirmCombo) { $null = Click $confirmCombo }
      $imported = WaitFor $win '已匯入 1 條' 20 ''
      $result.app.comboImported = if ($imported) { $imported.Current.Name } else { '(not imported)' }
      $row = WaitFor $win '^查看$' 15 'Hyperlink' # the only combo in this clean install
      if ($row) { $null = Click $row; Start-Sleep 3 }
      $summary = WaitFor $win '^來源與驗證資訊' 15 ''
      if ($summary) {
        try { $summary.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand() } catch { $null = Click $summary }
        Start-Sleep 1
      }
      $source = WaitFor $win '^開啟來源' 10 'Hyperlink'
      $result.app.sourceLinkText = if ($source) { $source.Current.Name } else { '(no source link)' }
      if ($source) {
        # Close the browser opened by the previous step: a second launch only hands the URL to the running browser and
        # exits at once, so a fresh browser process carrying the URL is the reliable signal.
        Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep 2
        $before = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'youtube\.com' }).Count
        $result.app.sourceClicked = Click $source
        $yt = $null
        for ($i = 0; $i -lt 100 -and -not $yt; $i++) {
          Start-Sleep -Milliseconds 200
          $yt = Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'youtube\.com' } | Select-Object -First 1
        }
        $result.app.sourceLinkBrowser = if ($yt) { ($yt.CommandLine -replace '^.*?(https?://\S+).*$', '$1') } else { '(no browser process with the source URL)' }
        $result.app.sourceLinkBrowserBefore = $before
      }
      Shot '06-combo-source'
    }
    Log "combo: $($result.app.comboImported); source link: $($result.app.sourceLinkText) -> $($result.app.sourceLinkBrowser)"
  }
  Log "backup folder shown: $($result.app.backupFolderShown); external: $($result.app.externalBrowser)"
  Save

  # Close like a user (the window's close button) and confirm nothing is left running.
  $proc = Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue | Select-Object -First 1
  try { $win.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close() } catch { $null = $proc.CloseMainWindow() }
  for ($i = 0; $i -lt 20 -and (Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }
  Start-Sleep 3
  $result.afterClose = [ordered]@{ app = [bool](Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue); bridge = [bool](Get-Process ygo-bridge -ErrorAction SilentlyContinue) }

  # DK17 / D1: uninstall with the default options removes the program and its shortcuts and keeps the user's data.
  $dataDir = Join-Path $env:LOCALAPPDATA 'com.ygocomboassistant.desktop'
  $p = Start-Process (Join-Path $dir 'uninstall.exe') -ArgumentList '/S', "_?=$dir" -Wait -PassThru
  Start-Sleep 2
  $result.uninstall = [ordered]@{
    exitCode = $p.ExitCode
    programRemoved = -not (Test-Path $exe)
    desktopShortcutRemoved = -not (Test-Path $desktopLnk)
    startShortcutRemoved = -not (Test-Path (Join-Path ([Environment]::GetFolderPath('Programs')) 'YGO Combo Assistant.lnk'))
    uninstallEntryRemoved = -not [bool](Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' | Where-Object { (Get-ItemProperty $_.PSPath).DisplayName -eq 'YGO Combo Assistant' })
    userDataKept = Test-Path $dataDir
    backupsKept = @(Get-ChildItem (Join-Path $docs 'YGO Combo 助手\backups') -Filter 'ygo-backup-*.json' -ErrorAction SilentlyContinue).Count
  }
  Log "uninstall: $($result.uninstall | ConvertTo-Json -Compress)"
  $result.ok = $true
} catch {
  $result.ok = $false
  $result.error = "$($_.Exception.Message)"
  Log "error: $($_.Exception.Message)"
  try { Shot '99-error' } catch { }
} finally {
  Save
  Log 'done'
  'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
  if ($env:USERNAME -eq 'WDAGUtilityAccount') {
    Start-Sleep 3
    Stop-Computer -Force # the disposable sandbox closes itself cleanly (never in the Windows 10 VM)
  }
}
