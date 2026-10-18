/** TEST DATA ONLY (B7). A route exactly as an earlier version wrote it: schemaVersion 1, none of the version 2 fields. */
import { ComboRoute } from '../../app/core/models';

export function testComboV1(): ComboRoute {
  return {
    schemaVersion: 1,
    id: 'old-route-1',
    version: 3,
    name: '舊版路線',
    archetype: 'Maliss',
    format: 'master-duel',
    description: '由舊版寫出的路線（沒有 B7 的欄位）',
    conditions: { handAllOf: [{ anyOf: [32061192], count: 1 }], mustRemainInMain: [{ cardId: 69272449, count: 1 }], setup: { turnOrder: 'first', emptyBoard: true, normalSummonAvailable: true, noInterruption: true } },
    steps: [
      { id: 'old-step-1', order: 1, actionType: 'normal-summon', actorCardIds: [32061192], title: '通常召喚', description: '通常召喚', moves: [{ cardId: 32061192, from: 'hand', to: 'field' }] },
      { id: 'old-step-2', order: 2, actionType: 'activate', actorCardIds: [32061192], title: '發動效果', description: '發動效果', effectRef: '32061192#1' },
    ],
    endBoard: [{ cardId: 32061192, zone: '場上', count: 1 }],
    verification: { status: 'unverified' },
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  };
}
