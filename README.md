# YGO Combo 助手

《遊戲王 MASTER DUEL》固定展開的本機查詢與練習工具：匯入牌組（ydke:// / YDK）、選擇或辨識起手 5／6 張、找出符合條件的已收錄固定 Combo，並以「圖像流程」與「逐步教學」兩種模式觀看同一份步驟；也可以請 AI 依牌表提出候選路線（未驗證，需自行在遊戲中實測）。資料只存在本機，不連接遊戲。

有兩種使用方式：

- **Windows 桌面版**（主要產品，Tauri 2）：安裝後即可使用，用你自己的 ChatGPT 帳號登入做 AI 分析，不需要 Node.js、不需要 API Key。
- **瀏覽器版**：用 `npm start` 在本機開發伺服器上執行，資料存在瀏覽器的 IndexedDB。

## 桌面版

### 功能

- 安裝程式（NSIS，目前使用者安裝），內含 WebView2 離線安裝包。
- AI 展開分析只提供「使用 ChatGPT 登入」：登入頁在系統瀏覽器完成，使用你的 ChatGPT 方案額度。本機的 ChatGPT 橋接服務（`scripts/chatgpt-bridge`）由 App 自動啟動，每次啟動使用新的密鑰，App 結束即關閉。
- 自動備份：資料有變更時每天最多備份一次，保留最近 10 份到你指定的資料夾。
- 外部連結一律用系統瀏覽器開啟（只限白名單網站）。

### 打包（`npm run desktop:build`）

只能在 **Windows x64** 上執行（橋接服務會被打包成內含 Node 的單一執行檔）。需要：

| 工具 | 版本 |
|---|---|
| Node.js | 24（Angular CLI 與 sidecar 目標版本） |
| Rust（含 MSVC 工具鏈） | 1.77 以上（`src-tauri/Cargo.toml`） |
| Visual Studio Build Tools | 含「使用 C++ 的桌面開發」 |

```bash
npm ci
npm run desktop:build
```

這個指令依序做：`desktop:sidecar`（建置 `src-tauri/binaries/ygo-bridge-*.exe`）→ `tauri build`（先跑 `npm run build`，再產生安裝程式）。安裝程式在 `src-tauri/target/release/bundle/nsis/`。版本號在 `src-tauri/tauri.conf.json`，發布前再調整。

相關測試：`npm run test:bridge`（橋接服務）、`npm run test:sidecar`（單一執行檔）、`npm run e2e:desktop`（需要已安裝的 Windows 版）。

## 瀏覽器版

需要 Node.js 24 與 npm。

```bash
npm install
npm start
```

開啟 <http://localhost:4200>。卡圖下載需要透過 `npm start` 啟動的本機伺服器（內含卡圖代理）；AI 分析若要用 ChatGPT 登入，請另開終端機執行 `npm run chatgpt-bridge`。

## 開發

| 命令 | 用途 |
|---|---|
| `npm run build` | production build |
| `npm run test:ci` | 單元與元件測試（Vitest） |
| `npm run test:bridge` | ChatGPT 橋接服務測試 |
| `npm run lint` | ESLint（angular-eslint） |
| `npm run e2e` | 端對端測試（系統 Edge；卡片來源為 mock） |
| `npm run e2e:real` | 連真實 YGOPRODeck 的端對端測試 |
| `npm run audit:g11` | 檢查 git remote 與網路／危險 API 使用 |

測試用的範例資料放在 `src/testing/`（不會被打包）。

## 文件

- [使用說明](docs/user-guide.md)
- 開發與驗收文件（在 [`docs/dev/`](docs/dev/)）：
  - [驗收基準（鎖定）](docs/dev/acceptance-v1.md)、[rev1 新增驗收](docs/dev/acceptance-v1-rev1.md)、[rev2 卡片資料庫驗收](docs/dev/acceptance-v1-rev2.md)、[rev3](docs/dev/acceptance-v1-rev3.md)、[變更記錄](docs/dev/acceptance-changes.md)
  - [驗收證據](docs/dev/validation/)
  - [G12 碼莉絲實測檢核單](docs/dev/g12-maliss-verification-checklist.md)
  - [遊戲內牌組代碼可行性](docs/dev/deck-code-feasibility.md)
- [優化計畫](docs/optimization-plan.md)

## 技術

Angular 22（standalone、zoneless、TypeScript strict）、Tauri 2（桌面殼）、IndexedDB（idb）、Zod、Vitest、Playwright。卡片資料來自 YGOPRODeck API v7：完整卡片文字資料只在使用者按下下載時取得並存在本機；縮圖在卡片顯示時才下載並快取（可在設定關閉）。
