import { banquetCards, banquetDeck } from '../../testing/ftk/banquet-deck.sample';
import { C, HAND, mv, oneDrawPlan, plan, st, twoDrawPlan, when } from '../../testing/ftk/banquet-plans.sample';
import { checkFtkRoute, isFtkRoute, listProbability, nodeOdds, remainingPool, branchFor, trapActivationIssues, walkLife } from './ftk-check';
import { ComboRoute, ComboStep } from './models';
import { ID } from '../../testing/ftk/banquet-deck.sample';

const deck = banquetDeck();
const cards = banquetCards();
const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
const check = (route: ComboRoute) => checkFtkRoute(route, deck, { cards, name });
const messages = (c: ReturnType<typeof check>) => c.problems.map((p) => p.message);

describe('FTK route check (B7)', () => {
  it('a complete one-draw plan passes, and its chance is exactly 1 in 35 (one Contract among the 35 cards not in the hand)', () => {
    const c = check(oneDrawPlan());
    expect(messages(c)).toEqual([]);
    expect(c.passed).toBe(true);
    expect(c.leaves.map((l) => [l.labels.join(), l.success])).toEqual([['抽到 Contract with Don Thousand', true], ['否則', false]]);
    expect(c.probability).toEqual({ ok: true, p: expect.closeTo(1 / 35, 12) });
  });

  it('adds the chances over a tree: a second draw in the "otherwise" branch gives 1/35 + 34/35 × 1/34 = 2/35', () => {
    const c = check(twoDrawPlan());
    expect(messages(c)).toEqual([]);
    expect(c.leaves.filter((l) => l.success)).toHaveLength(2);
    expect(c.probability).toEqual({ ok: true, p: expect.closeTo(2 / 35, 12) });
  });

  it('a random step may not name the card that turns up (a draw with a card move is refused)', () => {
    const route = oneDrawPlan();
    const draw = route.steps[1];
    draw.moves = mv([[C.contract, 'deck', 'hand']]);
    expect(messages(check(route)).join('\n')).toContain('不能寫出抽到的卡');
  });

  it('a branch condition needs a card that is still in the remaining deck', () => {
    // all 3 Chicken Games: 1 in hand, so at most 2 left; asking for 3 copies at once cannot happen
    const route = oneDrawPlan();
    route.steps[1].branches![0].when = when([[C.chicken, 3]]);
    route.steps[1].random = { count: 3, to: 'hand' };
    const text = messages(check(route)).join('\n');
    expect(text).toMatch(/不在牌組/);
  });

  it('the condition needs no more cards than are drawn', () => {
    const route = oneDrawPlan();
    route.steps[1].branches![0].when = when([[C.contract]], [[C.trick]]) as never;
    expect(messages(check(route)).join('\n')).toContain('只翻／抽 1 張');
  });

  it('a branch marked success whose damage is not enough is not a success (8000 needed, Contract only takes 1000)', () => {
    const c = check(oneDrawPlan({ target: 8000 }));
    expect(c.passed).toBe(false);
    expect(messages(c).join('\n')).toMatch(/標為成功，但依規則表計算對手 LP 還剩 7000/);
    expect(c.leaves.find((l) => l.labels[0].startsWith('抽到'))!.success).toBe(false);
    expect(c.probability).toEqual({ ok: true, p: 0 });
  });

  it('a branch marked fail that really kills only gets a note, and the local result is used', () => {
    const c = check(oneDrawPlan({ claim: 'fail' }));
    expect(c.warnings.map((w) => w.message).join('\n')).toContain('標為失敗');
    expect(c.leaves[0].success).toBe(true);
  });

  it('every branch is replayed by the normal data check: using a card that is not in the hand is found', () => {
    const route = oneDrawPlan();
    route.steps[1].branches![0].steps = [st('activate', '發動 Reasoning', [C.reasoning], { moves: mv([[C.reasoning, 'hand', 'field']]) })];
    expect(messages(check(route)).join('\n')).toMatch(/不在手牌/);
  });

  it('a condition with several alternatives must work for each of them', () => {
    const route = oneDrawPlan();
    // continues with Contract only; the plan also says "or Reasoning" — Reasoning is not what the next step uses
    route.steps[1].branches![0].when = when([[C.contract, C.reasoning]]);
    const text = messages(check(route)).join('\n');
    expect(text).toMatch(/Contract|不在手牌|Reasoning/);
  });

  it('a step list with branches ends at the branching step and needs an "otherwise" branch (structure rules live in validateCombo)', () => {
    expect(isFtkRoute(oneDrawPlan())).toBe(true);
    expect(isFtkRoute(plan('plain', HAND, [st('activate', 'x', [C.chicken])], { schemaVersion: 1 }))).toBe(false);
  });

  it('a route with no hand information cannot get a chance', () => {
    const route = oneDrawPlan();
    route.conditions.handAllOf = [{ anyOf: [C.chicken, C.banquet], count: 1 }];
    const c = check(route);
    expect(c.probability.ok).toBe(false);
  });

  it('the chance follows the deck: the remaining pool excludes the hand, and nodeOdds / branchFor read a draw', () => {
    const route = oneDrawPlan();
    const c = check(route);
    const pool = remainingPool(deck, HAND);
    expect(pool.get(C.chicken)).toBe(2);
    expect([...pool.values()].reduce((a, b) => a + b, 0)).toBe(35);
    const draw = route.steps[1];
    const odds = nodeOdds(route, draw, c.leaves, pool, []);
    expect(odds[0].mass).toBeCloseTo(1 / 35, 12);
    expect(odds[0].success).toBe(1);
    expect(odds[1].mass).toBeCloseTo(34 / 35, 12);
    expect(odds[1].success).toBe(0);
    expect(branchFor(draw, [C.contract])!.label).toContain('Contract');
    expect(branchFor(draw, [C.trick])!.label).toBe('否則');
    // after the Contract has turned up elsewhere, no draw can hit it any more
    const noContract = remainingPool(deck, [...HAND, C.contract]);
    expect(listProbability(route, route.steps, c.leaves, noContract)).toBe(0);
  });
});

describe('damage and Life Points come from the rule table (B7)', () => {
  const banquet = (n: number): ComboStep => st('activate', 'Banquet of Millions', [C.banquet], { effectRef: `${C.banquet}#1`, moves: [...mv([[C.banquet, 'field', 'gy']]), ...Array.from({ length: n }, () => ({ cardId: ID['Number 1: Numeron Gate Ekam'], from: 'extra' as const, to: 'banished' as const }))] });
  const dynamite = (claimed?: number): ComboStep => st('activate', 'D.D. Dynamite', [C.dynamite], { effectRef: `${C.dynamite}#1`, ...(claimed !== undefined ? { claimedDamage: claimed } : {}) });
  const life = (steps: ComboStep[], opponentExtraDeck = 15) => walkLife(steps, { cards, info: { targetDamage: 8000, opponentExtraDeck }, gyBefore: () => [] });

  it('Banquet banishes as many of the opponent\'s Extra Deck cards as you banished, and each Dynamite takes 300 per card', () => {
    const r = life([banquet(15), dynamite(), dynamite()]);
    expect(r.opponentBanished).toBe(15);
    expect(r.damage).toBe(9000);
    expect(r.opponentLp).toBe(-1000);
  });

  it('the number written by the author is ignored (and a different one is pointed out)', () => {
    const r = life([banquet(15), dynamite(99999)]);
    expect(r.damage).toBe(4500);
    expect(r.issues.map((i) => i.message).join()).toContain('作者寫的傷害 99999 與本機依規則表計算的 4500 不同');
  });

  it('the opponent can only lose as many cards as their Extra Deck holds', () => {
    const r = life([banquet(15), dynamite(), dynamite()], 10);
    expect(r.opponentBanished).toBe(10);
    expect(r.damage).toBe(6000); // 2 × 300 × 10: not enough for 8000
    expect(r.opponentLp).toBe(2000);
  });

  it('a Dynamite before any card is banished deals nothing', () => {
    expect(life([dynamite()]).damage).toBe(0);
  });

  it('recovery moves the target away: Chicken Game gives the opponent 1000 LP (and costs you 1000), Contract takes 1000 from both', () => {
    const gain = st('activate', 'Chicken Game：對手回復 1000', [C.chicken], { effectRef: `${C.chicken}#3` });
    const contract = st('activate', 'Contract', [C.contract], { effectRef: `${C.contract}#1` });
    const r = life([gain, contract, banquet(15), dynamite()]);
    expect(r.recovered).toBe(1000);
    expect(r.selfLp).toBe(8000 - 1000 - 1000);
    // 8000 + 1000 recovered − 1000 (Contract) − 4500 (Dynamite)
    expect(r.opponentLp).toBe(8000 + 1000 - 1000 - 4500);
    expect(r.damage).toBe(5500);
  });

  it('paying half your LP and running out of LP are noticed', () => {
    const half = st('activate', 'Transaction Rollback', [ID['Transaction Rollback']], { effectRef: `${ID['Transaction Rollback']}#1` });
    expect(life([half, half, half]).selfLp).toBe(1000);
    const pay = st('activate', 'Chicken Game', [C.chicken], { effectRef: `${C.chicken}#1` });
    const r = life(Array.from({ length: 8 }, () => pay));
    expect(r.issues.some((i) => i.message.includes('歸零'))).toBe(true);
  });

  it('an effect that is not in the rule table is reported and counted as nothing', () => {
    const r = life([st('activate', 'x', [C.mallet], { effectRef: `${C.mallet}#1` })]);
    expect(r.issues[0]).toMatchObject({ kind: 'warn' });
    expect(r.damage).toBe(0);
  });

  it('a Trap Set this turn cannot be activated without an effect that allows it; Trap Trick / Trap Holic allow the card they Set', () => {
    const set = st('set', '蓋放 D.D. Dynamite', [C.dynamite], { moves: mv([[C.dynamite, 'hand', 'field']]) });
    const activate = st('activate', '發動 D.D. Dynamite', [C.dynamite], { effectRef: `${C.dynamite}#1` });
    expect(trapActivationIssues([set, activate], cards, name)).toHaveLength(1);
    expect(trapActivationIssues([set, activate], cards, name)[0].message).toContain('這回合蓋放的陷阱');
    const trick = st('activate', '陷阱戲法：蓋放 D.D. Dynamite 並允許發動', [C.trick], { effectRef: `${C.trick}#1`, moves: mv([[C.dynamite, 'deck', 'field']]) });
    expect(trapActivationIssues([trick, activate], cards, name)).toEqual([]);
    // the permission is for one copy only
    expect(trapActivationIssues([trick, activate, activate], cards, name)).toEqual([]); // the second Dynamite was never Set
    expect(trapActivationIssues([trick, set, activate, activate], cards, name)).toHaveLength(1);
  });

  it('Trap Holic only allows the Set card while 3 or more Traps are in the Graveyard', () => {
    const holic = st('activate', '陷阱愛好者', [C.holic], { effectRef: `${C.holic}#1`, moves: mv([[C.dynamite, 'deck', 'field']]) });
    const trap = (id: number) => ({ cardId: id, count: 1 });
    const few = walkLife([holic], { cards, info: { targetDamage: 8000, opponentExtraDeck: 15 }, gyBefore: () => [trap(C.evenly), trap(C.marrella)] });
    expect(few.issues[0].message).toContain('墓地有 3 張以上陷阱');
    const enough = walkLife([holic], { cards, info: { targetDamage: 8000, opponentExtraDeck: 15 }, gyBefore: () => [trap(C.evenly), trap(C.marrella), trap(C.trick)] });
    expect(enough.issues).toEqual([]);
  });
});
