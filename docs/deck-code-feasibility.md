# Master Duel 遊戲內牌組代碼 — 可行性報告（PoC-DeckCode）

- 初版：2026-10-08（結論 BLOCKED：缺使用者提供的代碼範例）
- 本版：2026-10-09，使用者提供代碼 `2962ut6`
- **結論**：
  - **程式自動查詢官方網站並匯入：NO-GO**（技術上可行，但 KONAMI 使用條款不允許，且無正式 API）
  - **使用者自行開啟官方頁、複製牌表貼回本程式：GO**（已依 CR-003 與 `docs/acceptance-v1-rev3.md` G21 實作）

## 1. 查證方式

- 只讀取公開網頁，未登入、未使用任何帳號憑證或私人 Cookie、未呼叫遊戲用戶端介面、未繞過網站防護。
- 研究期間對 `www.db.yugioh-card.com` 共約 8 次一般 HTTP 請求（GET／一次表單 POST），之後不再自動存取。

## 2. 證據（2026-10-09）

| 項目 | 結果 |
|---|---|
| 查詢介面 | 官方公開 Deck Search 表單有 `deck_code` 欄位（`/yugiohdb/deck_search.action`，`ope=1`）；牌組類型 `3` = Master Duel |
| `2962ut6` | 搜尋結果恰 1 副：`member_deck.action?cgid=31565760642c57f185605bc43c1667b5&dno=523` |
| 牌組內容 | 名稱「烙印 Shuyin」、類型 Master Duel；主牌 60（怪獸 24／魔法 31／陷阱 5）、額外 15、備牌 0（頁面合計與逐列加總一致） |
| 是否為「60 烙印」 | 名稱不是字面「60 烙印」，但為 60 張主牌的烙印（Branded）牌組 |
| 每列資料 | 卡名、官方卡片編號 `cid`、張數（例：Fallen of Albaz `cid 15245` ×3） |
| 對應卡片 ID | 48 種 `cid` 經 YGOPRODeck `misc_info.konami_id` 全部唯一對應，英文名稱 100% 一致 |
| 登入／Cookie | 不需要；但牌組頁必須使用搜尋結果附帶的一次性 `ytkn` 參數，分享網址本身會導回首頁 |
| 錯誤／未公開／已刪除 | 搜尋結果皆為 0 筆；官方只列「公開」牌組，三者無法區分 |
| CORS | 無 `Access-Control-Allow-Origin`，瀏覽器內程式無法直接呼叫，須另設代理 |
| 防護 | Imperva Incapsula 防機器人機制（`_Incapsula_Resource`、`incap_ses` Cookie） |
| robots.txt | 404（不存在） |
| 正式 API | 未發現 |

## 3. 使用條款（Yu-Gi-Oh! Neuron Terms of Use）

https://legal.konami.com/games/neuron/terms/tou/en/

- 第 4 條：未經 KONAMI 事先書面同意，不得使用 robot、spider、site search/retrieval application 或其他手動／自動裝置擷取、索引、scrape、data mine 服務內容；不得系統性下載儲存內容建立資料庫。
- 第 3 條：授權限於個人、非商業用途。
- 因此「輸入代碼 → 程式向官方網站查詢並解析網頁」屬於需要書面同意的擷取程式，**未取得同意前不實作**。

## 4. 採用的替代方案（G21）

1. 使用者輸入代碼 → 程式只產生官方搜尋網址，在新分頁開啟（程式本身不發出請求）。
2. 使用者在官方頁（英文）點進牌組，從 Monster Cards 選到最後一個表格並複製。
3. 貼回本程式：自動辨識官方牌表格式、核對各區合計、以本機卡片資料庫把英文卡名對應為卡片 ID、預覽後確認匯入。

其他替代：由第三方網站或使用者自行安裝的擴充功能匯出 ydke:// 或 YDK，再用既有匯入。

## 5. 限制

- 需使用者手動開啟與複製，無法一鍵匯入。
- 官方頁須為英文；其他語系卡名無法對應本機的英文卡片資料庫。
- 官方改版頁面時，複製文字格式可能改變。
- 若日後取得 KONAMI 書面同意，可另行評估自動查詢（需代理、處理一次性參數與防護機制）。
