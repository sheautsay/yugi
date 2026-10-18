import { analysisLevel } from '../analysis-level';
import { deckFingerprint } from '../deck';
import { checkRoute } from '../route-check';
import { AnalysisGoal } from './analysis-goal';
import { parseAiOutput, toCandidate } from './analysis-output';
import { STATUS_LABEL, evaluateRoute, handText, interruptionText, rankCandidates, targetCoverage } from './evaluate';
import { malissCards, malissDeck } from './maliss-deck.sample';
import { C, routeAllied, routeAlliedTooFewMaterials, routeFirewall, routeFirewallIntoAllied, routeMalissOnly, routeOcgReference, sampleAnswer } from './maliss-routes.sample';
import { buildPrompt } from './prompt';

// CR-006 evidence: the user's real deck after the change. The same six HAND-WRITTEN routes were run
// through the pipeline before the change (docs/validation/rev6-G34-G40-2026-10-09.md §5). Prints a
// report and pins the facts that changed. No model is called.
describe('rev6 comparison on the real deck (after)', () => {
  const deck = malissDeck();
  const cards = malissCards();
  const name = (id: number) => cards.get(id)?.nameEn ?? `ID ${id}`;
  const routes = [routeMalissOnly(), routeAllied(), routeFirewall(), routeFirewallIntoAllied(), routeAlliedTooFewMaterials(), routeOcgReference()];
  const parsed = parseAiOutput(JSON.stringify(sampleAnswer(routes)));
  if (!parsed.ok) throw new Error(parsed.error);
  const ctx = { runId: 'r', deck, deckFingerprint: deckFingerprint(deck), cardDataVersion: 'test', provider: 'anthropic' as const, model: 'm', promptVersion: 'v', cards, now: '2026-10-09T00:00:00.000Z' };
  const candidates = parsed.output.routes.map((r) => toCandidate(r, ctx).route);
  const checks = candidates.map((r) => checkRoute(r, deck, { cards, name }));
  const evaluations = candidates.map((r, i) => evaluateRoute(r, deck, cards, checks[i], name));

  it('pins what changed and prints the report', () => {
    const out: string[] = [];
    const p = buildPrompt(deck, cards, { single: true, multi: true, extenders: true, maxRoutes: 5, candidates: 6 }, { kind: 'targets', preferredExtraIds: [C.allied, C.firewall] });
    const lines = p.user.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    const links = lines.filter((l) => l.deck === 'extra');
    out.push(`PROMPT lines=${lines.length} main=${lines.filter((l) => l.deck === 'main').reduce((s, l) => s + l.copies, 0)} extra=${links.reduce((s, l) => s + l.copies, 0)} withText=${lines.filter((l) => l.text).length} linksWithArrows=${links.filter((l) => l.arrows?.length).length}/15 withEffectRefs=${lines.filter((l) => l.effects).length}`);
    out.push(`PROMPT goalLine=${!!p.user.split('\n').find((l) => l.startsWith('Analysis goal'))} preferredLine=${!!p.user.split('\n').find((l) => l.startsWith('Preferred'))} generic=${p.system.includes('generic')} returnLine=${p.user.split('\n').find((l) => l.startsWith('Analysis scope'))}`);
    expect(links.filter((l) => l.arrows?.length)).toHaveLength(15);

    candidates.forEach((r, i) => {
      const e = evaluations[i];
      const c = checks[i];
      const extra = e.extraUsed.map((u) => `${name(u.cardId)}(${u.onFinalBoard ? '終場' : '中途'})`).join(', ');
      const inter = e.interruptions.map((x) => `${name(x.cardId)}:${STATUS_LABEL[x.status]}`).join(', ') || '-';
      const rules = c.problems.filter((x) => x.message.startsWith('規則檢查')).map((x) => `#${x.step} ${x.message}`);
      out.push(
        [
          `ROUTE ${i + 1} ${r.name}`,
          `  level=${analysisLevel(r, deck, { cards, name })} problems=${c.problems.length} ruleViolations=${rules.length}`,
          ...rules.map((x) => `    ${x}`),
          `  start=${e.startKind} final=${e.finalMonsters.map(name).join(' + ') || '-'} backs=${e.finalBacks.map(name).join(' + ') || '-'}`,
          `  extraUsed=${extra || '-'} | ACT=${e.finalMonsters.includes(C.allied) ? '終場' : e.extraUsed.some((u) => u.cardId === C.allied) ? '中途' : '未使用'} FW=${e.finalMonsters.includes(C.firewall) ? '終場' : e.extraUsed.some((u) => u.cardId === C.firewall) ? '中途' : '未使用'}`,
          `  interruptions ( ${interruptionText(e)} ) [${inter}]`,
          `  remaining hand=${handText(e.hand)} deck=${c.final.deckCount} extra=${c.final.extraCount} gy=${c.final.gy.map((g) => name(g.cardId)).join(', ') || '-'} banished=${c.final.banished.map((g) => name(g.cardId)).join(', ') || '-'}`,
          `  notVerified=${c.rules?.unverified.length ?? 0}${c.rules?.unverified.length ? ' :: ' + c.rules.unverified.map((u) => u.message).join(' / ') : ''}`,
        ].join('\n'),
      );
    });

    const items = evaluations.map((evaluation, index) => ({ index, evaluation }));
    for (const goal of [
      { kind: 'interruptions', preferredExtraIds: [] },
      { kind: 'targets', preferredExtraIds: [C.allied] },
      { kind: 'targets', preferredExtraIds: [C.firewall] },
      { kind: 'resources', preferredExtraIds: [] },
      { kind: 'diverse', preferredExtraIds: [] },
    ] as AnalysisGoal[]) {
      out.push(`RANK ${goal.kind}${goal.preferredExtraIds.length ? `(${goal.preferredExtraIds.map(name).join(',')})` : ''}: ${rankCandidates(items, goal).map((x) => `${x.index + 1}${x.sameEndBoardAs !== undefined ? `(=${x.sameEndBoardAs + 1})` : ''}`).join(' > ')}`);
    }
    for (const t of targetCoverage(items, [C.allied, C.firewall, C.transcode, C.accesscode])) out.push(`COVERAGE ${name(t.cardId)}: ${t.message}`);
    console.log(out.join('\n'));

    // Before the change all of routes 1–5 were "data-checked" and nothing told them apart (§5).
    expect(candidates.map((r) => analysisLevel(r, deck, { cards, name }))).toEqual(['data-checked', 'data-checked', 'data-checked', 'data-checked', 'ai-candidate', 'ai-candidate']);
    expect(evaluations.slice(0, 4).map((e) => e.effective)).toEqual([0, 1, 1, 1]);
  });
});
