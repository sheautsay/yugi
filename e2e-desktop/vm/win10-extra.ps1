# Windows 10 VM or Windows Sandbox (UI Automation, desktop session): the checks the host's Playwright suite makes that
# win10-functional.ps1 does not. P0.1: a reload on a deep page keeps the page. P0.3 / DK6: cached card images still show
# after a restart and with the network adapter disabled (an <img> is only rendered while its cached Blob loads; a
# missing image falls back to a text frame, and the pixels of the first image are checked too). P0.6: a request with an
# Origin header but no secret is refused.
$ErrorActionPreference = 'Continue'
. C:\ygo-in\uia-lib.ps1
$out = 'C:\ygo-out'
$log = Join-Path $out 'extra-log.txt'
$result = [ordered]@{ startedAt = (Get-Date).ToString('o'); checks = [ordered]@{} }
$deck = 'Extra 卡圖'
function Log($m) { "$((Get-Date).ToString('HH:mm:ss')) $m" | Out-File -Append -Encoding utf8 $log }
function Save { $result.finishedAt = (Get-Date).ToString('o'); $result | ConvertTo-Json -Depth 8 | Out-File -Encoding utf8 (Join-Path $out 'extra-result.json') }
function Check([string]$id, [bool]$ok, $detail) {
  $result.checks[$id] = [ordered]@{ ok = $ok; detail = $detail }
  if (-not $ok) { try { Shot (Join-Path $out ("fail-{0}.png" -f ($id -replace '[^A-Za-z0-9]+', '_'))) } catch { } }
  Log ("{0} {1}: {2}" -f ($(if ($ok) { 'PASS' } else { 'FAIL' })), $id, ($detail | ConvertTo-Json -Compress -Depth 4)); Save
}
function Images($w) { @($w.FindAll($script:Scope::Descendants, (New-Object System.Windows.Automation.PropertyCondition($script:A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Image))) | Where-Object { $r = $_.Current.BoundingRectangle; $_.Current.Name -and $r.Width -ge 40 -and $r.Height / [Math]::Max(1, $r.Width) -gt 1.3 -and $r.Height / [Math]::Max(1, $r.Width) -lt 1.6 }) } # card-shaped (59:86)
# Distinct colours in a grid over the image: a real card picture has many, an empty or broken box has very few.
function PixelColours($e, [string]$name) {
  $path = Join-Path $out $name
  Shot $path
  $r = $e.Current.BoundingRectangle
  $bmp = New-Object System.Drawing.Bitmap $path
  $seen = @{}
  for ($x = 0; $x -lt 12; $x++) { for ($y = 0; $y -lt 12; $y++) {
    $px = [int]($r.X + $r.Width * ($x + 0.5) / 12); $py = [int]($r.Y + $r.Height * ($y + 0.5) / 12)
    if ($px -ge 0 -and $py -ge 0 -and $px -lt $bmp.Width -and $py -lt $bmp.Height) { $c = $bmp.GetPixel($px, $py); $seen["$([int]($c.R/16))-$([int]($c.G/16))-$([int]($c.B/16))"] = 1 }
  } }
  $bmp.Dispose()
  $seen.Count
}
function OpenDeckEditor($w) {
  Nav $w '牌組'
  $null = Click (FindInRow $w "^$([regex]::Escape($deck))$" '^編輯$' 'Hyperlink')
  $null = WaitFor $w '^儲存$' 20 'Button'
  Start-Sleep 4
}

try {
  $result.os = (Get-CimInstance Win32_OperatingSystem | ForEach-Object { "$($_.Caption) $($_.Version)" })
  $setup = (Get-ChildItem 'C:\ygo-in' -Filter '*-setup.exe' | Select-Object -First 1).FullName
  $result.installerSha256 = (Get-FileHash $setup -Algorithm SHA256).Hash.ToLower()
  if (-not (Test-Path (Join-Path $env:LOCALAPPDATA 'YGO Combo Assistant\ygo-combo-assistant.exe'))) { $p = Start-Process $setup -ArgumentList '/S' -Wait -PassThru; $result.installExit = $p.ExitCode }
  $w = if (Get-Process ygo-combo-assistant -ErrorAction SilentlyContinue) { AppWindow } else { StartApp }

  # A deck with cached card images.
  Nav $w '設定'
  $null = ClickName $w '下載／更新完整卡片資料' 'Button'
  $null = WaitFor $w '^正在下載完整卡片資料' 15
  $null = WaitGone $w '^正在下載完整卡片資料' 300
  Nav $w '牌組'
  if (-not (Find $w "^$([regex]::Escape($deck))$" '')) {
    $null = SetText $w '^牌組代碼或 YDK 內容' (Get-Content 'C:\ygo-in\edge-deck.txt' -Raw -Encoding UTF8)
    $null = ClickName $w '^解析$' 'Button'
    $null = WaitFor $w '^牌表檢核通過' 60
    $null = SetText $w '^新牌組名稱' $deck
    $null = ClickName $w '^確認匯入$' 'Button'
    $null = WaitFor $w "已匯入「$deck」" 30
  }
  OpenDeckEditor $w
  $null = ClickName $w '^下載此牌組卡圖$' 'Button'
  $dl = WaitFor $w '^已下載 \d+ 張卡圖' 240
  Start-Sleep 3
  $imgs = Images $w
  $colours = if ($imgs.Count) { PixelColours $imgs[0] 'extra-01-images.png' } else { 0 }
  Check 'DK6 card images download and show' ([bool]$dl -and $imgs.Count -gt 0 -and $colours -ge 20) @{ message = $(if ($dl) { $dl.Current.Name }); images = $imgs.Count; firstImage = $(if ($imgs.Count) { $imgs[0].Current.Name }); colours = $colours }

  # P0.1: reload (F5) on a deep page comes back to the same page, not a blank window.
  Nav $w 'Combo 管理'
  $null = WaitFor $w '^JSON 內容' 15
  [void][YgoVm.Win32]::SetForegroundWindow([IntPtr]$w.Current.NativeWindowHandle)
  Start-Sleep 1
  [System.Windows.Forms.SendKeys]::SendWait('{F5}')
  Start-Sleep 6
  $w = AppWindow
  $back = WaitFor $w '^JSON 內容' 20
  $nav = Find $w '^設定$' 'Hyperlink'
  Shot (Join-Path $out 'extra-02-reloaded.png')
  Check 'P0.1 reload on a deep page keeps the page' ([bool]$back -and [bool]$nav) @{ page = [bool]$back; navigation = [bool]$nav }

  # P0.6: Origin without the secret is refused (the secret itself is never visible outside the app).
  Nav $w '設定'
  $null = ClickName $w '^重新整理$' 'Button'
  Start-Sleep 3
  $b = Get-Process ygo-bridge -ErrorAction SilentlyContinue | Select-Object -First 1
  $port = if ($b) { (Get-NetTCPConnection -State Listen -OwningProcess $b.Id -ErrorAction SilentlyContinue | Select-Object -First 1).LocalPort }
  $codes = [ordered]@{}
  foreach ($case in @(@{ n = 'Origin tauri.localhost, no secret'; h = @{ 'x-ygo-bridge' = '1'; Origin = 'http://tauri.localhost' } }, @{ n = 'Origin evil.example, wrong secret'; h = @{ 'x-ygo-bridge' = '1'; Origin = 'https://evil.example'; 'x-ygo-bridge-token' = ('x' * 64) } })) {
    try { $r = Invoke-WebRequest "http://127.0.0.1:$port/status" -Headers $case.h -UseBasicParsing -TimeoutSec 5; $codes[$case.n] = [int]$r.StatusCode } catch { $codes[$case.n] = [int]$_.Exception.Response.StatusCode }
  }
  Check 'P0.6 Origin without the secret is refused' ([bool]$port -and @($codes.Values | Where-Object { $_ -ne 401 -and $_ -ne 403 }).Count -eq 0) @{ port = $port; codes = $codes }

  # P0.3 / DK6: after a restart the cached images still show; then the same with the network adapter disabled.
  CloseApp
  $w = StartApp
  OpenDeckEditor $w
  $imgs = Images $w
  $colours = if ($imgs.Count) { PixelColours $imgs[0] 'extra-03-after-restart.png' } else { 0 }
  Check 'P0.3 cached images show after a restart' ($imgs.Count -gt 0 -and $colours -ge 20) @{ images = $imgs.Count; colours = $colours }
  CloseApp
  Get-NetAdapter | Disable-NetAdapter -Confirm:$false
  Start-Sleep 3
  $w = StartApp
  OpenDeckEditor $w
  $imgs = Images $w
  $colours = if ($imgs.Count) { PixelColours $imgs[0] 'extra-04-offline.png' } else { 0 }
  Get-NetAdapter | Enable-NetAdapter -Confirm:$false
  Start-Sleep 5
  Check 'DK6 / DK20 cached images show with the network adapter disabled' ($imgs.Count -gt 0 -and $colours -ge 20) @{ images = $imgs.Count; colours = $colours }
  CloseApp
  $result.ok = $true
} catch {
  $result.ok = $false
  $result.error = "$($_.Exception.Message)"
  Log "error: $($_.Exception.Message)"
  try { Get-NetAdapter | Enable-NetAdapter -Confirm:$false } catch { }
} finally {
  $fails = @($result.checks.Keys | Where-Object { -not $result.checks[$_].ok })
  $result.summary = "$(@($result.checks.Keys).Count - $fails.Count) / $(@($result.checks.Keys).Count) checks passed"
  Save
  Log "done: $($result.summary)"
  'done' | Out-File -Encoding utf8 (Join-Path $out 'DONE')
}
