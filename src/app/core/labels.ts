import { ActionType, ComboRoute, RouteVerification } from './models';

/** Readable summary of a route's opening conditions (card names supplied by the caller). */
export function conditionLines(route: ComboRoute, name: (cardId: number) => string): string[] {
  const c = route.conditions;
  const quote = (id: number) => `「${name(id)}」`;
  return [
    ...c.handAllOf.map((cl) => (cl.anyOf.length === 1 ? `起手：${quote(cl.anyOf[0])}×${cl.count}` : `起手：${cl.anyOf.map(quote).join('或')}共 ${cl.count} 張`)),
    ...(c.unallocatedHandMin ? [`另需 ${c.unallocatedHandMin} 張任意手牌作為代價`] : []),
    ...(c.mustRemainInMain ?? []).map((r) => `主牌組需仍有${quote(r.cardId)}×${r.count}`),
    ...(c.mustExistInExtra ?? []).map((r) => `額外牌組需有${quote(r.cardId)}×${r.count}`),
    ...(c.forbiddenInHand ?? []).map((id) => `起手不可有${quote(id)}`),
  ];
}

export function setupLine(route: ComboRoute): string {
  const s = route.conditions.setup;
  return [
    s.turnOrder === 'first' ? '先攻' : s.turnOrder === 'second' ? '後攻' : '先後攻皆可',
    s.emptyBoard ? '雙方空場' : '',
    s.normalSummonAvailable ? '需通常召喚權' : '',
    s.noInterruption ? '假設無干擾' : '',
  ]
    .filter(Boolean)
    .join('・');
}

export const ACTION_LABEL: Record<ActionType, string> = {
  'normal-summon': '通常召喚',
  'special-summon': '特殊召喚',
  'link-summon': '連結召喚',
  'synchro-summon': '同步召喚',
  'xyz-summon': '超量召喚',
  'fusion-summon': '融合召喚',
  'ritual-summon': '儀式召喚',
  activate: '發動',
  set: '蓋放',
  search: '檢索',
  'send-to-gy': '送去墓地',
  banish: '除外',
  'add-to-hand': '加入手牌',
  'select-material': '選擇素材',
  other: '其他',
};

export const VERIFICATION_LABEL: Record<RouteVerification, string> = {
  draft: '草稿',
  unverified: '未驗證',
  verified: '已驗證',
  invalidated: '已失效',
};
