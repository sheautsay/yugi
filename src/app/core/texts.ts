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
