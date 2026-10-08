import { computed, signal } from '@angular/core';

/**
 * The single `currentStep` shared by the flow view (A) and the step-by-step view (B) of one
 * route (spec §6.2). Always within 1..N; 0 only when the route has no steps.
 */
export class StepNavigator {
  private readonly totalSteps = signal(0);
  private readonly step = signal(0);

  readonly total = this.totalSteps.asReadonly();
  readonly current = this.step.asReadonly();
  readonly atFirst = computed(() => this.step() <= 1);
  readonly atLast = computed(() => this.step() >= this.totalSteps());

  /** Switching to another route starts again at step 1. */
  reset(total: number): void {
    this.totalSteps.set(Math.max(0, Math.trunc(total)));
    this.step.set(this.totalSteps() > 0 ? 1 : 0);
  }

  goTo(step: number): void {
    if (this.totalSteps() === 0 || !Number.isFinite(step)) return;
    this.step.set(Math.min(this.totalSteps(), Math.max(1, Math.trunc(step))));
  }

  next(): void {
    this.goTo(this.step() + 1);
  }

  prev(): void {
    this.goTo(this.step() - 1);
  }

  last(): void {
    this.goTo(this.totalSteps());
  }
}
