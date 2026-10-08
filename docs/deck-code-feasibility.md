# Master Duel 遊戲內牌組代碼 — 可行性報告（PoC-DeckCode）

- 日期：2026-10-08
- 依據：rev1 R1、`docs/acceptance-v1-rev1.md` G13-1
- **結論：BLOCKED** — 尚未取得使用者提供的實際代碼範例與取得畫面，無法測試。

## 1. 已完成的公開資料查證（僅讀取公開網頁，未登入、未呼叫任何未公開 API）

| 查證項目 | 結果 |
|---|---|
| Master Duel 是否有可從外部解析的官方牌組代碼 | 未找到。公開資料顯示牌組匯入多經 KONAMI 官方卡片資料庫（需 Konami ID 登入）轉入遊戲 |
| 第三方匯入工具的運作方式 | 瀏覽器擴充（例如 Deck transfer for Master Duel、MasterDuelMeta Assistant）在使用者**已登入**的官方資料庫頁面上操作；屬使用者登入工作階段，不符合 F04「不讀取 Cookie／Token」限制 |
| 2.7.0 版（2026-04-30）更新內容 | 公開報導中未見遊戲內牌組代碼功能（報導內容不完整，不能完全排除） |
| 官方資料庫卡片編號 | 官方網址使用 Konami 卡片編號（非 passcode），若改走官方網址匯入需另做編號對應 |

參考來源：
- https://www.masterduelmeta.com/articles/articles/events/september-2024/deck-import
- https://chrome.google.com/webstore/detail/deck-transfer-for-yu-gi-o/lgcpomfflpfipndmldmgblhpbnnfidgk
- https://www.masterduelmeta.com/articles/news/april-30-2026/master-duel-update/
- https://yugipedia.com/wiki/Konami_index_number

## 2. 判定方式（取得範例後執行）

1. 確認代碼來源畫面與格式（長度、字元集、是否含校驗碼）。
2. 確認是否存在**不需登入**的公開解析方式；若只能在遊戲內或登入 Konami ID 後解析 → NO-GO。
3. 若有公開方式：驗證能取得完整卡片 ID、張數、區域，並列出授權、頻率、反機器人限制；新增網路來源前依規格 §9.8 提交設計差異並經使用者批准。

## 3. 目前 V1 行為

- 匯入框只接受 `ydke://` 與 YDK；其他格式一律顯示「遊戲內牌組代碼仍在研究中，請改用 ydke:// 或 YDK」，不產生任何牌組（G13-2，已由 unit／component／E2E 測試驗證）。

## 4. 解除 BLOCKED 所需

- 使用者提供 1 組以上遊戲內牌組代碼範例（可遮部分字元）及其在遊戲中的取得畫面。
