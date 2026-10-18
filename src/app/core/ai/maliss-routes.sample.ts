/**
 * TEST DATA ONLY (CR-006). Routes for the user's real Maliss deck, written BY HAND from the card texts
 * in the shape a model returns (schema v2). They are NOT model output and were NOT tested in Master
 * Duel; they only exercise the data check, the partial rule check and the end-board evaluation.
 * No imports, so the E2E tests can use them too. Excluded from the app build (`*.sample.ts`).
 */

export const C = {
  dormouse: 32061192,
  whiteRabbit: 69272449,
  chessyCat: 96676583,
  marchHare: 20938824,
  underground: 68337209,
  gwc06: 20726052,
  mtp07: 94722358,
  tb11: 57111661,
  whiteBinder: 95454996,
  heartsCrypter: 21848500,
  backup: 30118811,
  wizard: 3723262,
  linkDecoder: 30342076,
  linguriboh: 24842059,
  almiraj: 60303245,
  wicckid: 52698008,
  splashMage: 59859086,
  transcode: 46947713,
  firewall: 5043010,
  accesscode: 86066372,
  allied: 39138610,
  littleKnight: 29301450,
  cherubini: 58699500,
  goldSarc: 75500286,
  eldam: 54143349,
  fuwalos: 42141493,
  ash: 14558127,
  impermanence: 10045474,
  maxx: 23434538,
  // OCG reference route only — NOT in the user's deck.
  redRansom: 68059897,
  mirror: 93453053,
  gGolem: 61668670,
  heatsoul: 61245672,
} as const;

type Zone = 'deck' | 'hand' | 'extra' | 'field' | 'gy' | 'banished' | 'overlay';
export interface SampleMove {
  cardId: number;
  from: Zone;
  to: Zone;
  slot: string;
}
export interface SampleStep {
  actionType: string;
  title: string;
  description: string;
  actorCardIds: number[];
  targetCardIds: number[];
  materialCardIds: number[];
  cost: string;
  effect: string;
  result: string;
  uncertainty: string;
  effectRef: string;
  moves: SampleMove[];
  /** CR-008: non-empty = the "model" could not work this step out. */
  unresolved?: string;
}

export const mv = (cardId: number, from: Zone, to: Zone, slot = ''): SampleMove => ({ cardId, from, to, slot });

export function st(actionType: string, title: string, actors: number[], moves: SampleMove[], o: { ref?: string; targets?: number[]; materials?: number[]; cost?: string } = {}): SampleStep {
  return {
    actionType,
    title,
    description: `${title}（手寫測試路線）`,
    actorCardIds: actors,
    targetCardIds: o.targets ?? [],
    materialCardIds: o.materials ?? [],
    cost: o.cost ?? '',
    effect: '',
    result: '',
    uncertainty: '',
    effectRef: o.ref ?? '',
    moves,
  };
}

const { dormouse: D, whiteRabbit: WR, chessyCat: CC, tb11: TB, whiteBinder: WB, splashMage: SM } = C;

/**
 * Shared opening (one card: Maliss <P> Dormouse). After step 11: White Binder in M1, Dormouse in
 * M2, Chessy Cat in M4 (summoned by TB-11: cannot activate its effects this turn); TB-11 in the GY.
 */
export function opening(): SampleStep[] {
  return [
    st('normal-summon', '通常召喚 Dormouse', [D], [mv(D, 'hand', 'field', 'M3')]),
    st('activate', 'Dormouse 除外 White Rabbit', [D], [mv(WR, 'deck', 'banished')], { ref: `${D}#1`, targets: [WR] }),
    st('special-summon', 'White Rabbit 從除外特召', [WR], [mv(WR, 'banished', 'field', 'M2')], { ref: `${WR}#2`, cost: '支付 300 LP' }),
    st('activate', 'White Rabbit 蓋放 TB-11', [WR], [mv(TB, 'deck', 'field', 'S1')], { ref: `${WR}#1`, targets: [TB] }),
    st('link-summon', '連結召喚 Splash Mage', [SM], [mv(D, 'field', 'gy', 'M3'), mv(WR, 'field', 'gy', 'M2'), mv(SM, 'extra', 'field', 'EMZ-L')], { materials: [D, WR] }),
    st('special-summon', 'Splash Mage 特召 Dormouse', [SM], [mv(D, 'gy', 'field', 'M3')], { ref: `${SM}#1`, targets: [D] }),
    st('link-summon', '連結召喚 White Binder', [WB], [mv(SM, 'field', 'gy', 'EMZ-L'), mv(D, 'field', 'gy', 'M3'), mv(WB, 'extra', 'field', 'EMZ-L')], { materials: [SM, D] }),
    st('activate', 'White Binder 除外墓地 3 張', [WB], [mv(D, 'gy', 'banished'), mv(WR, 'gy', 'banished'), mv(SM, 'gy', 'banished')], { ref: `${WB}#1`, targets: [D, WR, SM] }),
    st('special-summon', 'Dormouse 從除外特召', [D], [mv(D, 'banished', 'field', 'M2')], { ref: `${D}#2`, cost: '支付 300 LP' }),
    st('activate', '發動 TB-11 特召 Chessy Cat', [TB], [mv(WB, 'field', 'banished', 'EMZ-L'), mv(TB, 'field', 'gy', 'S1'), mv(CC, 'deck', 'field', 'M4')], { ref: `${TB}#1`, targets: [CC], cost: '除外 White Binder' }),
    st('special-summon', 'White Binder 從除外特召', [WB], [mv(WB, 'banished', 'field', 'M1')], { ref: `${WB}#3`, cost: '支付 900 LP（抽 1 張隨機，不列入路線）' }),
  ];
}

export interface SampleRoute {
  name: string;
  handCardIds: number[];
  starterCardIds: number[];
  requiredInMain: Array<{ cardId: number; count: number }>;
  requiredInExtra: Array<{ cardId: number; count: number }>;
  preconditions: string[];
  steps: SampleStep[];
  endBoard: Array<{ cardId: number; zone: Zone; count: number; note: string }>;
  pros: string[];
  cons: string[];
  /** CR-008 (schema v3) role fields; absent = the older answer shape. */
  alternativeStarters?: Array<{ cardId: number; instead: number[]; note: string }>;
  extenderCardIds?: number[];
  avoidInHand?: number[];
}

function route(name: string, steps: SampleStep[], endBoard: number[], extra: number[]): SampleRoute {
  return {
    name,
    handCardIds: [D],
    starterCardIds: [D],
    requiredInMain: [
      { cardId: WR, count: 1 },
      { cardId: TB, count: 1 },
      { cardId: CC, count: 1 },
    ],
    requiredInExtra: extra.map((cardId) => ({ cardId, count: 1 })),
    preconditions: ['先攻、雙方空場、無干擾（手寫測試路線）'],
    steps,
    endBoard: endBoard.map((cardId) => ({ cardId, zone: 'field', count: 1, note: '' })),
    pros: [],
    cons: [],
  };
}

/** Ends on White Binder + Hearts Crypter (the Maliss-only end board the user reported). */
export function routeMalissOnly(): SampleRoute {
  return route(
    'Dormouse → White Binder＋Hearts Crypter',
    [
      ...opening(),
      st('activate', 'White Binder 蓋放 GWC-06', [WB], [mv(C.gwc06, 'deck', 'field', 'S1')], { ref: `${WB}#2`, targets: [C.gwc06] }),
      st('activate', '發動 GWC-06 特召 White Rabbit', [C.gwc06], [mv(CC, 'field', 'banished', 'M4'), mv(C.gwc06, 'field', 'gy', 'S1'), mv(WR, 'banished', 'field', 'M4')], { ref: `${C.gwc06}#1`, targets: [WR], cost: '除外 Chessy Cat' }),
      st('special-summon', 'Chessy Cat 從除外特召', [CC], [mv(CC, 'banished', 'field', 'M5')], { ref: `${CC}#2`, cost: '支付 300 LP' }),
      st('link-summon', '連結召喚 Hearts Crypter', [C.heartsCrypter], [mv(D, 'field', 'gy', 'M2'), mv(WR, 'field', 'gy', 'M4'), mv(CC, 'field', 'gy', 'M5'), mv(C.heartsCrypter, 'extra', 'field', 'EMZ-L')], {
        materials: [D, WR, CC],
      }),
    ],
    [WB, C.heartsCrypter],
    [SM, WB, C.heartsCrypter],
  );
}

/** Ends on Allied Code Talker @Ignister (EMZ-L) pointing to White Binder (M1). */
export function routeAllied(): SampleRoute {
  return route(
    'Dormouse → Allied Code Talker＋White Binder',
    [
      ...opening(),
      st('link-summon', '連結召喚 Allied Code Talker', [C.allied], [mv(WB, 'field', 'gy', 'M1'), mv(D, 'field', 'gy', 'M2'), mv(CC, 'field', 'gy', 'M4'), mv(C.allied, 'extra', 'field', 'EMZ-L')], {
        materials: [WB, D, CC],
      }),
      st('special-summon', 'Allied Code Talker 特召 White Binder', [C.allied], [mv(WB, 'gy', 'field', 'M1')], { ref: `${C.allied}#1`, targets: [WB] }),
    ],
    [C.allied, WB],
    [SM, WB, C.allied],
  );
}

/** Ends on Firewall Dragon (EMZ-L) co-linked with White Binder (M2). */
export function routeFirewall(): SampleRoute {
  return route(
    'Dormouse → Firewall Dragon＋White Binder',
    [
      ...opening(),
      st('activate', 'White Binder 蓋放 GWC-06', [WB], [mv(C.gwc06, 'deck', 'field', 'S1')], { ref: `${WB}#2`, targets: [C.gwc06] }),
      st('link-summon', '連結召喚 Firewall Dragon', [C.firewall], [mv(WB, 'field', 'gy', 'M1'), mv(CC, 'field', 'gy', 'M4'), mv(C.firewall, 'extra', 'field', 'EMZ-L')], { materials: [WB, CC] }),
      st('activate', '發動 GWC-06 特召 White Binder', [C.gwc06], [mv(D, 'field', 'banished', 'M2'), mv(C.gwc06, 'field', 'gy', 'S1'), mv(WB, 'gy', 'field', 'M2')], { ref: `${C.gwc06}#1`, targets: [WB], cost: '除外 Dormouse' }),
    ],
    [C.firewall, WB],
    [SM, WB, C.firewall],
  );
}

/** Firewall Dragon only as a stepping stone: ends on Allied Code Talker + White Binder. */
export function routeFirewallIntoAllied(): SampleRoute {
  return route(
    'Dormouse → Firewall Dragon → Allied Code Talker',
    [
      ...opening(),
      st('link-summon', '連結召喚 Firewall Dragon', [C.firewall], [mv(WB, 'field', 'gy', 'M1'), mv(D, 'field', 'gy', 'M2'), mv(C.firewall, 'extra', 'field', 'EMZ-L')], { materials: [WB, D] }),
      st('link-summon', '連結召喚 Allied Code Talker', [C.allied], [mv(C.firewall, 'field', 'gy', 'EMZ-L'), mv(CC, 'field', 'gy', 'M4'), mv(C.allied, 'extra', 'field', 'EMZ-L')], {
        materials: [C.firewall, CC],
      }),
      st('special-summon', 'Allied Code Talker 特召 White Binder', [C.allied], [mv(WB, 'gy', 'field', 'M1')], { ref: `${C.allied}#1`, targets: [WB] }),
    ],
    [C.allied, WB],
    [SM, WB, C.firewall, C.allied],
  );
}

/** N27: Allied Code Talker from two non-Link monsters (Link-5 needs 5). Data-consistent, rule-breaking. */
export function routeAlliedTooFewMaterials(): SampleRoute {
  return route(
    'Dormouse → Allied Code Talker（素材不足）',
    [
      ...opening(),
      st('link-summon', '連結召喚 Allied Code Talker', [C.allied], [mv(D, 'field', 'gy', 'M2'), mv(CC, 'field', 'gy', 'M4'), mv(C.allied, 'extra', 'field', 'EMZ-L')], { materials: [D, CC] }),
    ],
    [C.allied, WB],
    [SM, WB, C.allied],
  );
}

/** N28: the OCG 2025.07 reference line starts like this, but needs cards the user's deck does not have. */
export function routeOcgReference(): SampleRoute {
  const steps = opening().slice(0, 6);
  steps.push(
    st('link-summon', '連結召喚 Red Ransom', [C.redRansom], [mv(SM, 'field', 'gy', 'EMZ-L'), mv(D, 'field', 'gy', 'M3'), mv(C.redRansom, 'extra', 'field', 'EMZ-L')], { materials: [SM, D] }),
    st('search', 'Red Ransom 檢索 Maliss in the Mirror', [C.redRansom], [mv(C.mirror, 'deck', 'hand')], { targets: [C.mirror] }),
  );
  return {
    ...route('OCG 參考路線（Red Ransom 版）', steps, [C.allied, C.heatsoul], [SM, C.redRansom, C.allied, C.gGolem, C.heatsoul]),
    endBoard: [
      { cardId: C.allied, zone: 'field', count: 1, note: '' },
      { cardId: C.heatsoul, zone: 'field', count: 1, note: '' },
    ],
  };
}

// ---- CR-008: 1–3 card routes (HAND-WRITTEN test data, same caveats as above) --------------------------

/** Adds the schema-v3 role fields. The cards the route fetches from its Deck must not be in hand. */
export function withRoles(r: SampleRoute, o: { alternativeStarters?: SampleRoute['alternativeStarters']; extenderCardIds?: number[]; avoidInHand?: number[] } = {}): SampleRoute {
  return { ...r, alternativeStarters: o.alternativeStarters ?? [], extenderCardIds: o.extenderCardIds ?? [], avoidInHand: o.avoidInHand ?? [WR, TB, CC] };
}

const setTrap = (n: number, slot: string) => st('set', `蓋放 Infinite Impermanence（第 ${n} 張）`, [C.impermanence], [mv(C.impermanence, 'hand', 'field', slot)]);

/** Two required cards: Dormouse + Infinite Impermanence. Same monsters as `routeAllied`, plus one Set Trap. */
export function routeAlliedPlusTrap(): SampleRoute {
  const base = routeAllied();
  return { ...base, name: 'Dormouse＋Infinite Impermanence → Allied Code Talker＋White Binder＋蓋放陷阱', handCardIds: [D, C.impermanence], steps: [...base.steps, setTrap(1, 'S2')] };
}

/** Three required cards: Dormouse + two Infinite Impermanence (both Set). */
export function routeAlliedPlusTwoTraps(): SampleRoute {
  const base = routeAllied();
  return { ...base, name: 'Dormouse＋Infinite Impermanence×2 → Allied Code Talker＋White Binder＋蓋放 2 張陷阱', handCardIds: [D, C.impermanence, C.impermanence], steps: [...base.steps, setTrap(1, 'S2'), setTrap(2, 'S3')] };
}

/**
 * Two required cards where the second one adds a REAL interruption: Dormouse + Maliss <C> MTP-07.
 * `routeMalissOnly` plus Setting MTP-07 from the hand (it is a Normal Trap that can be activated
 * on the opponent's turn; with Maliss Link Monsters on the board it banishes a card).
 */
export function routeMalissPlusMtp(): SampleRoute {
  const base = routeMalissOnly();
  return { ...base, name: 'Dormouse＋MTP-07 → White Binder＋Hearts Crypter＋蓋放 MTP-07', handCardIds: [D, C.mtp07], steps: [...base.steps, st('set', '蓋放 Maliss <C> MTP-07', [C.mtp07], [mv(C.mtp07, 'hand', 'field', 'S2')])] };
}

/** Three required cards: the previous route plus Maliss in Underground (a Field Spell) from the hand. */
export function routeMalissPlusMtpUnderground(): SampleRoute {
  const base = routeMalissPlusMtp();
  return {
    ...base,
    name: 'Dormouse＋MTP-07＋Maliss in Underground → White Binder＋Hearts Crypter＋MTP-07＋場地',
    handCardIds: [D, C.mtp07, C.underground],
    steps: [...base.steps, st('activate', '發動 Maliss in Underground（除外牌組的 March Hare）', [C.underground], [mv(C.underground, 'hand', 'field', 'FZ'), mv(C.marchHare, 'deck', 'banished')], { ref: `${C.underground}#1`, targets: [C.marchHare] })],
  };
}

/** N37: a third "required" card (Ash Blossom & Joyous Spring) that no step uses. */
export function routeAlliedWithIdleThirdCard(): SampleRoute {
  return { ...routeAlliedPlusTrap(), name: 'Dormouse＋Infinite Impermanence＋Ash Blossom（Ash 沒有參與）', handCardIds: [D, C.impermanence, C.ash] };
}

export interface SampleCombo {
  cardIds: number[];
  priority: number;
  reason: string;
  targetExtraIds: number[];
  target: string;
}

export const combo = (cardIds: number[], priority: number, targetExtraIds: number[] = [], reason = '測試用組合（手寫，不是模型輸出）'): SampleCombo => ({ cardIds, priority, reason, targetExtraIds, target: targetExtraIds.length ? '以額外牌組怪獸為終場' : '' });

/** A MOCKED phase-A answer: roles (AI candidate labels) and candidate starter combinations. */
export function samplePlan(combos: SampleCombo[]): Record<string, unknown> {
  return {
    summary: '手寫測試的階段 A 回應（不是模型輸出）',
    roles: [
      { cardId: D, roles: ['starter', 'combo-piece'], note: '測試標籤' },
      { cardId: C.impermanence, roles: ['hand-trap', 'other'], note: '測試標籤' },
      { cardId: C.ash, roles: ['hand-trap'], note: '測試標籤' },
      { cardId: C.backup, roles: ['extender', 'searcher'], note: '測試標籤' },
    ],
    combos,
  };
}

/** A model answer (schema v2) holding the given routes; `explored` lists lines the "model" mentions. */
export function sampleAnswer(routes: SampleRoute[], o: { summary?: string; explored?: unknown[] } = {}): Record<string, unknown> {
  return {
    summary: o.summary ?? '手寫測試回應（不是模型輸出）',
    starters: [{ cardIds: [D], kind: 'single', description: 'Dormouse 單卡起手（測試）' }],
    extenders: [],
    routes,
    explored: o.explored ?? [],
  };
}
