import { Injectable } from '@angular/core';
import { TurnOrder } from '../../core/models';

export interface HandState {
  deckVersion: number;
  turnOrder: TurnOrder;
  hand: number[];
  /** Previous complete hands, most recent last. */
  history: number[][];
  seed: number | null;
}

/** Keeps each deck's opening hand while the user moves between pages (memory only). */
@Injectable({ providedIn: 'root' })
export class HandStateService {
  private readonly states = new Map<string, HandState>();

  get(deckId: string): HandState | undefined {
    const state = this.states.get(deckId);
    return state && structuredClone(state);
  }

  set(deckId: string, state: HandState): void {
    this.states.set(deckId, structuredClone(state));
  }
}
