import { describe, expect, it } from 'vitest';
import { wfActorLabel, wfDescribeHistory, wfStepTimedOut } from './runtime-shared';

describe('wfActorLabel', () => {
  const titles = (k: string) => ({ financeSignOff: 'Pay approved scholarships' } as Record<string, string>)[k];

  it('names a workflow by its title, never its key', () => {
    expect(wfActorLabel({ actorType: 'workflow', actorId: 'financeSignOff', actorName: null }, titles)).toBe('Workflow: Pay approved scholarships');
  });

  it('falls back to a readable key when the title is unknown', () => {
    expect(wfActorLabel({ actorType: 'workflow', actorId: 'scholarshipReview', actorName: null })).toBe('Workflow: Scholarship review');
  });

  it('people by name; the engine as System', () => {
    expect(wfActorLabel({ actorType: 'user', actorId: 'hana', actorName: 'Hana Yusuf' })).toBe('Hana Yusuf');
    expect(wfActorLabel({ actorType: 'system', actorId: null, actorName: null })).toBe('System');
  });
});

describe('wfStepTimedOut', () => {
  it('an approval or task whose outcome is timedOut, or a wait that timed out', () => {
    expect(wfStepTimedOut({ outcome: 'timedOut' })).toBe(true);
    expect(wfStepTimedOut({ timedOut: true })).toBe(true);
    expect(wfStepTimedOut({ outcome: 'approved' })).toBe(false);
    expect(wfStepTimedOut(null)).toBe(false);
  });
});

describe('wfDescribeHistory: reset', () => {
  it('reads as the reset\'s label, the move and the reason', () => {
    const h = { category: 'lifecycle', action: 'reset', before: '{"state":"UnderReview"}', after: '{"state":"Draft"}', data: '{"label":"Start over","input":{"reason":"Wrong programme"}}' } as never;
    const label = (k: unknown) => ({ UnderReview: 'Under review', Draft: 'Draft' } as Record<string, string>)[String(k)] ?? String(k);
    expect(wfDescribeHistory(h, label)).toBe('Start over: Under review → Draft (“Wrong programme”)');
  });
});

