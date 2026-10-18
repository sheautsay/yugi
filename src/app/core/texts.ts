import type { Effort } from './ai/providers';

/**
 * User-visible wording that is shared between screens or needs to stay consistent (button names that other
 * messages refer to, disclaimers, labels). Change a term here and every screen follows.
 * Interface language is Traditional Chinese; card names and format names (ydke://, YDK) stay as they are.
 */
export const TEXT = {
  disclaimer: {
    /** Shown once on first launch (dismissible) and again under 設定 → 關於程式. */
    short: '獨立查詢工具：不連接遊戲、不讀取遊戲資料、不自動操作；固定展開皆假設無干擾。',
    aboutExtra: 'AI 路線只是候選，不代表規則合法或 Master Duel 實測通過。',
    dismiss: '知道了',
  },
  banList: {
    tip: '禁限表尚未進行當期核對，不作為阻擋條件；請自行確認牌組符合 Master Duel 當期規定。',
    label: '禁限提示',
  },
  nav: {
    needsDeck: '需要先建立或匯入牌組',
  },
  chatgpt: {
    signIn: '使用 ChatGPT 登入',
    account: 'ChatGPT 帳號',
    quota: '使用你的 ChatGPT 方案額度，不需要 API Key。',
  },
  ai: {
    candidateOnly: 'AI 路線只是候選，請在遊戲中實測。',
    provider: '模型服務',
    effort: '思考程度',
    oneShot: '單次分析（一次請求）',
    staged: '分階段分析（1～3 卡，多次請求）',
    moreInfo: '進一步說明',
    bulk: {
      button: '全部存成 Combo',
      skipped: (p: { alreadySaved: number; invalid: number; sameEndBoard: number }) => `略過：已存過 ${p.alreadySaved} 條、未通過檢查 ${p.invalid} 條、終場相同 ${p.sameEndBoard} 條`,
      confirm: (n: number, skipped: string) => `將把 ${n} 條候選路線存成固定 Combo（皆為「未驗證」）。\n${skipped}。\n確定要存嗎？`,
      nothing: (skipped: string) => `沒有可以存的新路線。${skipped}。`,
      done: (n: number, skipped: string) => `已存成 ${n} 條固定 Combo（皆為「未驗證」，需實測後才能標示已驗證）。${skipped}。`,
    },
  },
  settings: {
    nameFileIntro: '匯入你整理的中文名稱檔。',
    formatHelp: '檔案格式說明',
    advanced: '進階資訊',
  },
  battle: {
    nav: '實戰模式',
    title: '實戰模式',
    disabledTitle: '實戰模式尚未啟用',
    disabledBody: '實戰模式用來在對局中快速查出「這手牌能做什麼、哪個終場最強」。它預設關閉，請先到設定頁啟用。',
    openSettings: '前往設定',
    settingsHeading: '實戰模式',
    settingsLabel: '啟用實戰模式（實驗性）',
    settingsNote: '依手牌從已存的路線中列出終場最強的前幾名。不讀取遊戲資料、不自動操作；之後若加入截圖辨識，也只會在你按下快捷鍵時截取一次畫面，不儲存。KONAMI 的使用條款對第三方輔助工具沒有明確界線，是否使用由你自行判斷。',
    topNLabel: '結果顯示名次',
    noDeck: '還沒有牌組。請先到牌組頁匯入或建立牌組，並按「使用此牌組」。',
    draftDeck: '此牌組是草稿，不能用於實戰查詢，請先修正。',
    goal: '目標',
    topN: '顯示名次',
    handLine: '手牌',
    turn: { first: '先攻（5 張）', second: '後攻（6 張）' },
    hand: (n: number, size: number) => `手牌（${n} / ${size} 張）`,
    pickHint: '點下方卡片加入手牌；點手牌可移除。',
    needMore: (size: number) => `選滿 ${size} 張手牌後顯示結果。`,
    clear: '清除',
    draw: '隨機抽牌',
    paste: '貼上截圖辨識',
    closePaste: '關閉截圖辨識',
    resultsHeading: (shown: number) => `建議展開（前 ${shown} 名）`,
    noMatch: '這手牌沒有已收錄的展開。',
    noMatchHint: '可以回 AI 展開分析補充更多路線。',
    toAnalysis: '前往 AI 展開分析',
    noRoutes: '還沒有收錄任何 Combo。請先在 AI 展開分析按「全部存成 Combo」，或到 Combo 管理新增。',
    tested: '已實測',
    candidate: 'AI 候選',
    untested: '未實測',
    needs: '需要',
    interruptions: (n: number) => `有效干擾 ${n}（估算）`,
    handLeft: (n: number) => `剩餘手牌 ${n}`,
    sameEnd: (n: number) => `另有 ${n} 條相同終場`,
    estimateNote: '干擾數是靜態估算，不是規則引擎或實戰驗證；AI 路線只是候選，請在遊戲中實測。',
    back: '返回名次',
    stepOf: (k: number, n: number) => `第 ${k} / ${n} 步`,
    keys: '空白鍵／→ 下一步，← 上一步',
    prev: '上一步',
    next: '下一步',
    finalBoard: '最終終場',
    noSnapshot: '這條路線沒有卡片移動資料，無法畫出終場，只列文字終場。',
  },
  share: {
    button: '分享碼',
    heading: '分享碼（貼到聊天軟體，對方在「匯入 Combo」貼上即可）',
    copy: '複製',
    copied: '已複製分享碼。',
    copyFailed: '無法自動複製，請在上方文字框全選後手動複製。',
    close: '關閉',
    unsupported: '這個環境不支援分享碼。',
    importHint: '也可以直接貼上分享碼（YGOCOMBO1.…，一行一個）；會先完整檢查，確認後才寫入，匯入的路線一律是「未驗證」。',
  },
  decks: {
    add: '＋ 新增牌組',
  },
} as const;

/** Display names of the reasoning levels offered by the Claude API. */
export const EFFORT_LABEL: Record<Effort, string> = {
  low: '快速',
  medium: '標準',
  high: '深入',
  xhigh: '更深入',
  max: '最深入',
};
