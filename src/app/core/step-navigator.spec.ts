import { StepNavigator } from './step-navigator';

describe('StepNavigator — G7 shared currentStep', () => {
  it('starts at step 1 and never leaves 1..N (N8)', () => {
    const nav = new StepNavigator();
    nav.reset(3);
    expect(nav.current()).toBe(1);
    nav.prev();
    expect(nav.current()).toBe(1);
    nav.next();
    nav.next();
    nav.next();
    nav.next();
    expect(nav.current()).toBe(3);
    expect(nav.atLast()).toBe(true);
    nav.goTo(99);
    expect(nav.current()).toBe(3);
    nav.goTo(-5);
    expect(nav.current()).toBe(1);
    nav.goTo(2.7);
    expect(nav.current()).toBe(2);
    nav.goTo(Number.NaN);
    expect(nav.current()).toBe(2);
  });

  it('jumping to the end goes to step N', () => {
    const nav = new StepNavigator();
    nav.reset(16);
    nav.last();
    expect(nav.current()).toBe(16);
  });

  it('a new route resets to step 1', () => {
    const nav = new StepNavigator();
    nav.reset(10);
    nav.goTo(7);
    nav.reset(4);
    expect(nav.current()).toBe(1);
    expect(nav.total()).toBe(4);
  });

  it('a route without steps has no current step and ignores navigation', () => {
    const nav = new StepNavigator();
    nav.reset(0);
    expect([nav.current(), nav.total()]).toEqual([0, 0]);
    nav.next();
    nav.goTo(1);
    nav.last();
    expect(nav.current()).toBe(0);
  });
});
