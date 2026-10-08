# YGO Combo 助手（V1）

《遊戲王 MASTER DUEL》固定展開的本機查詢與練習工具：匯入牌組（ydke:// / YDK）、選擇或辨識起手 5／6 張、找出符合條件的已收錄固定 Combo，並以「圖像流程」與「逐步教學」兩種模式觀看同一份步驟。資料只存在本機瀏覽器（IndexedDB），不連接遊戲。

```bash
npm install
```

```bash
npm start
```

開啟 <http://localhost:4200>。

## 文件

- [使用說明](docs/user-guide.md)
- [驗收基準（鎖定）](docs/acceptance-v1.md)、[rev1 新增驗收](docs/acceptance-v1-rev1.md)、[rev2 卡片資料庫驗收](docs/acceptance-v1-rev2.md)、[變更記錄](docs/acceptance-changes.md)
- [驗收證據](docs/validation/)
- [G12 碼莉絲實測檢核單](docs/g12-maliss-verification-checklist.md)
- [遊戲內牌組代碼可行性](docs/deck-code-feasibility.md)

## 技術

Angular 22（standalone、zoneless、TypeScript strict）、IndexedDB（idb）、Zod、Vitest、Playwright（系統 Edge）。卡片資料來自 YGOPRODeck API v7：完整卡片文字資料只在使用者按下同步時下載並存在本機；縮圖在卡片顯示時才下載並快取（可在設定關閉）。
