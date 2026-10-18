import { isLinkCard, pointedSlots } from '../card-rules';
import { CardCount, CardRecord, ComboRoute, DeckRecord, FieldSlot, LinkMarker } from '../models';
import { RouteCheckResult, checkRoute } from '../route-check';
import { RouteEvaluation, evaluateRoute } from './evaluate';

// CR-008 G51: the end board as a picture of the STATE after the last step — the same simulation the
// data check runs, nothing drawn by a model. A snapshot answers "what is where", not "is it legal".

export interface BoardCell {
  cardId: number;
  slot: FieldSlot;
  isLink: boolean;
  /** The arrows printed on the card (Link Monsters only). */
  arrows: LinkMarker[];
  /** Zones the arrows point to (zones that exist on the board). */
  pointsTo: FieldSlot[];
  /** Zones of the Link Monsters that point to each other with this one (co-linked). */
  coLinked: FieldSlot[];
}

export interface BoardLink {
  from: FieldSlot;
  to: FieldSlot;
  /** The monster in `to` points back at `from`. */
  mutual: boolean;
}

export interface BoardSnapshot {
  /** Order of the last step this snapshot is the state after. */
  step: number;
  /** [EMZ-L, EMZ-R] */
  emz: Array<BoardCell | null>;
  /** M1 … M5 */
  mmz: Array<BoardCell | null>;
  /** S1 … S5 */
  spellTrap: Array<BoardCell | null>;
  fieldZone: BoardCell | null;
  /** Cards on the field the route gave no zone for. */
  unplaced: number[];
  gy: CardCount[];
  banished: CardCount[];
  /** Cards the route lists that are still in hand (the rest of the opening hand is not tracked, G41). */
  hand: CardCount[];
  deckCount: number;
  extraCount: number;
  /** Every monster had a zone throughout the route. */
  layoutKnown: boolean;
  links: BoardLink[];
  evaluation: Pick<RouteEvaluation, 'effective' | 'verified' | 'conditional' | 'interruptions' | 'followUp' | 'hand'>;
}

const EMZ: FieldSlot[] = ['EMZ-L', 'EMZ-R'];
const MMZ: FieldSlot[] = ['M1', 'M2', 'M3', 'M4', 'M5'];
const SZ: FieldSlot[] = ['S1', 'S2', 'S3', 'S4', 'S5'];

/** The board after the last step of `route`, or null when the route has no card moves to build it from. */
export function endSnapshot(route: ComboRoute, deck: Pick<DeckRecord, 'main' | 'extra'>, cards: ReadonlyMap<number, CardRecord>, check: RouteCheckResult = checkRoute(route, deck, { cards })): BoardSnapshot | null {
  if (!route.steps.some((s) => s.moves?.length)) return null;
  const last = check.rules?.steps.at(-1);
  if (!last) return null;

  const monsters = last.board.monsters;
  const unplaced: number[] = [];
  const cellOf = (cardId: number, slot: FieldSlot): BoardCell => {
    const card = cards.get(cardId);
    const link = isLinkCard(card) && !!card?.linkMarkers?.length;
    return { cardId, slot, isLink: link, arrows: link ? [...card!.linkMarkers!] : [], pointsTo: link ? pointedSlots(slot, card!.linkMarkers) : [], coLinked: [] };
  };

  const cells = new Map<FieldSlot, BoardCell>();
  for (const m of monsters) m.slot ? cells.set(m.slot, cellOf(m.cardId, m.slot)) : unplaced.push(m.cardId);
  const fieldBacks = last.board.backs;
  for (const b of fieldBacks) b.slot ? cells.set(b.slot, cellOf(b.cardId, b.slot)) : unplaced.push(b.cardId);

  // Co-linked: two Link Monsters that point at each other.
  const monsterCells = [...cells.values()].filter((c) => MMZ.includes(c.slot) || EMZ.includes(c.slot));
  const links: BoardLink[] = [];
  for (const c of monsterCells) {
    for (const to of c.pointsTo) {
      const other = monsterCells.find((x) => x.slot === to);
      if (!other) continue;
      const mutual = other.isLink && other.pointsTo.includes(c.slot);
      links.push({ from: c.slot, to, mutual });
      if (mutual) c.coLinked.push(to);
    }
  }

  const at = (slots: FieldSlot[]) => slots.map((s) => cells.get(s) ?? null);
  const e = evaluateRoute(route, deck, cards, check);
  return {
    step: last.order,
    emz: at(EMZ),
    mmz: at(MMZ),
    spellTrap: at(SZ),
    fieldZone: cells.get('FZ') ?? null,
    unplaced,
    gy: check.final.gy,
    banished: check.final.banished,
    hand: check.final.hand,
    deckCount: check.final.deckCount,
    extraCount: check.final.extraCount,
    layoutKnown: !!check.rules?.board.layoutKnown,
    links,
    evaluation: { effective: e.effective, verified: e.verified, conditional: e.conditional, interruptions: e.interruptions, followUp: e.followUp, hand: e.hand },
  };
}
