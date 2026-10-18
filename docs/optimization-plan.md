# YGO Combo 助手：優化計畫

> 建立日期：2026-10-18｜對象版本：`main` @ `1c5d6c3`（與已安裝的桌面版 0.1.0 程式碼一致）
>
> 來源：實際啟動建置版逐頁操作與截圖、匯入測試牌組、GitNexus 圖譜與原始碼閱讀。
> 現況：TypeScript strict、單元測試 53 檔 / 599 個全數通過。程式碼底子好，主要問題在**使用者體驗**與**介面文字過多**。

## 執行原則

- 依下列 P1 → P5 順序進行，每個階段完成後各自 commit（可各開一個 PR）。
- 每一階段完成都必須通過：`npm run build`、`npm run test:ci`、`npm run test:bridge`；動到 UI 的階段需同步更新受影響的 e2e（`e2e/`、`e2e-desktop/`）中的文字斷言。
- **不要改變的行為**：資料只存在本機、不連接遊戲、ChatGPT bridge 的安全設計（每次啟動的密鑰、stdin 結束即關閉）、匯入前的完整驗證、「已驗證」只能由使用者實測後設定。
- 桌面版（Tauri）是主要產品；瀏覽器版至少要維持 `npm start` 可用。
- 介面語言為繁體中文；使用者看得到的文字不要中英夾雜（卡名、ydke://、YDK 等專有格式除外）。

---

## P1｜新手流程（影響最大）

### 1.1 首次啟動引導 / 缺卡片資料時直接給下載入口
**現況**：起手查詢與 AI 分析都需要完整卡片資料庫（約 24 MB），但新使用者先被導去匯入牌組；匯入後所有卡片「未識別」，牌組成為「草稿，不能用於正式查詢」。起手查詢頁提供的按鈕是「前往編輯牌組」，方向錯誤。

**要做**：
- 偵測本機卡片資料為 0 時，在首頁、牌組頁、起手查詢頁、AI 分析頁顯示同一個明顯的「下載卡片資料」行動區塊（直接觸發下載並顯示進度，不需要跳到設定頁）。
- 首頁的「快速開始」改為有序步驟：① 下載卡片資料 → ② 匯入牌組 → ③ 起手查詢，已完成的步驟打勾。
- 牌組因「卡片未識別」而是草稿時，修正按鈕優先為「下載卡片資料」；只有在資料已下載但仍有未知卡時才導向「編輯牌組」。

**相關檔案**：`src/app/features/home/home-page.*`、`src/app/features/opening-hand/hand-page.*`、`src/app/features/ai-analysis/analysis-page.*`、`src/app/features/decks/deck-list-page.*`、`src/app/core/card-data.service.ts`

**驗收**：全新資料（清空 IndexedDB）啟動後，不需閱讀任何說明文字，三次點擊內可以開始下載卡片資料。

### 1.2 不再整串顯示卡片 ID
**現況**：「33 種卡片尚未識別（ID：32061192、69272449、…）」整串出現在牌組卡片、匯入預覽、起手查詢頁、AI 分析頁，佔掉半個畫面。

**要做**：只顯示摘要（例如「33 張卡缺少資料」）＋修正按鈕；ID 清單收進可展開的「顯示詳細」。建議做成一個共用元件，供上述各處重用。

**相關檔案**：產生訊息的地方（搜尋「尚未識別」）——`src/app/core/deck.ts` 等，以及顯示它的頁面範本。

### 1.3 附範例牌組與範例 Combo
**現況**：核心功能是「找出已收錄的固定 Combo」，新使用者卻有 0 條 Combo。repo 中已有 Maliss 範例資料，但只在 `*.sample.ts` 測試檔裡。

**要做**：在 Combo 管理頁（以及空狀態）提供「載入範例（Maliss）」按鈕，匯入一副範例牌組與幾條範例路線，走既有的匯入驗證流程；範例路線狀態為「未驗證」。

### 1.4 預設首頁
`src/app/app.routes.ts` 的 `''` 目前 `redirectTo: 'decks'`；改為 `home`，讓首頁儀表板成為起點。

---

## P2｜介面文字瘦身

**原則**：每個區塊最多一句說明；細節收進「?」提示或可展開的「進一步說明」；免責聲明只顯示一次；技術資訊集中到「關於程式 → 進階資訊」。

| 位置 | 現在 | 改成 |
|---|---|---|
| AI 分析頁頂部 | 「規則引擎驗證尚未整合（BLOCKED）…」 | 一句「AI 路線只是候選，請在遊戲中實測」；刪除 BLOCKED（同時檢查 `src/app/core/labels.ts` 的 `engine-verified` 文案） |
| AI 分析頁 | 「牌組版本 1・指紋 fp1-…」 | 移除，或收進進階資訊 |
| AI 分析頁 | 「模型服務（Provider）」「思考程度（effort）low…max」「單次分析（一次請求，原本的方式）」 | 「模型服務」「思考程度：快速／標準／深入」等中文選項；去掉「原本的方式」 |
| 設定頁 | 中文名稱 / 卡片標註 JSON 欄位規格（cardId、translationSource、translationStatus…） | 只留一句「匯入你整理的中文名稱檔」＋「檔案格式說明」連結（可連到 `docs/user-guide.md`） |
| 設定頁 | 「本機資料庫版本 1」「YGOPRODeck API v7」等 | 移到「關於程式 → 進階資訊」 |
| 設定頁按鈕、錯誤訊息 | 「Continue with ChatGPT」 | 「使用 ChatGPT 登入」；同步改 `src/app/core/ai/analysis.service.ts`、`src/app/core/ai/chatgpt.ts` 中引用此按鈕名稱的訊息 |
| 側邊欄底部（`src/app/app.html`） | 每頁常駐的免責聲明 | 首次啟動顯示一次（可關閉、記住），之後只在「關於程式」 |
| 牌組頁 | 每次顯示「禁限表尚未進行當期核對…」 | 收成小提示圖示 |
| 牌組頁 | 已有牌組時，匯入表單（含 KONAMI 官網三步驟教學）仍整塊展開 | 「＋ 新增牌組」按鈕開啟對話框；官網教學預設收合 |
| 側邊欄 | 無牌組時「起手查詢」「AI 展開分析」連到 `/decks`，並多一行「先建立或匯入牌組」 | 無牌組時顯示為停用並附提示，移除多出來的小字 |

**建議先做**：把使用者看得到的字串集中（例如 `src/app/core/texts.ts` 或依功能分檔），再進行修改，之後統一用詞只需改一處。

**驗收**：AI 分析頁與設定頁範本的說明文字量各減少至少 40%；介面上不再出現 BLOCKED、指紋、Provider、effort、JSON 欄位名、`npm start`（瀏覽器版的開發提示可保留在開發者文件）。

---

## P3｜視覺 / 小問題

- AI 分析頁「模型」下拉選單寬度超出卡片邊界（`src/app/features/ai-analysis/analysis-page.css`）：限制 `max-width: 100%`。
- 窄螢幕（375px）頂部導覽文字被截斷（「AI 展開...」）：桌面版最小寬度 420，請在 420px 下確認可用即可。
- 匯入成功後畫面停在匯入表單位置：捲回頂部或捲到新牌組卡片，讓使用者看見結果。

---

## P4｜程式碼架構

1. **拆分 `src/app/core/ai/analysis.service.ts`（856 行）**：拆為設定（settings / limits / 用量）、執行（start / startStaged / cancel / 估算）、ChatGPT 帳號（refresh / signIn / signOut / welcome）、候選路線（save / recheck / delete）。對外 API 盡量不變，以免大量修改頁面。
2. **`AiProvider` 介面**：目前 `settings.provider === 'anthropic' ? … : settings.provider === 'chatgpt' ? … : …` 散落在約 10 處（例如 analysis.service.ts 約第 360、436、449、486、492、550 行）。定義一個介面（模型名稱、呼叫、成本估算、preflight 檢查），三個供應商各自實作。
3. **解開功能模組的循環相依**：`features/ai-analysis/analysis-page.ts` import `features/combo-viewer/combo-viewer`，`features/combo-viewer/combo-detail-page.ts` 又 import `features/ai-analysis/route-analysis-panel`。把 `ComboViewer` 與 `RouteAnalysisPanel` 移到 `src/app/shared/`（或 `shared/combo/`）。
4. **拆分 `analysis-page.html`（782 行）**：分成設定表單、執行狀態、分析紀錄、結果列表等子元件。
5. **AI 預設值**：瀏覽器版預設 provider 為 `anthropic`（需付費金鑰），桌面版只提供 `chatgpt`。讓預設值以 `AI_PROVIDERS` 的第一個為準；模型價格表集中在一處並註明更新日期。

**驗收**：所有既有測試通過且行為不變；`core/` 不 import `features/`；`features/*` 之間沒有互相 import。

---

## P5｜專案整理

- 加入 ESLint（`angular-eslint`）與 `npm run lint`；先修會報錯的規則，必要時暫時關閉風格類規則。
- README 補上桌面版：功能、`npm run desktop:build` 打包步驟、需要的工具（Rust、Node 24）。
- `docs/` 整理：驗收流程文件（`acceptance-*.md`、`*.sha256`、`validation/`、`g12-*`、`deck-code-feasibility.md`）移到 `docs/dev/`，並更新 README 中的連結；`user-guide.md` 留在 `docs/`，同步更新為新介面。注意 `.sha256` 檔是對文件內容的雜湊，移動時不要改內容。
- `src/app/core/**/*.sample.ts`（約 12,500 行測試資料，不會被打包）：除了 P1.3 需要的範例資料外，移到測試專用位置（例如 `src/testing/`），並更新 import。

---

## 不在本次範圍

- 規則引擎驗證、Master Duel 禁限表資料來源、繁中卡名資料來源。
- 版本號調整與桌面版重新打包發布（完成後由擁有者自行決定）。
