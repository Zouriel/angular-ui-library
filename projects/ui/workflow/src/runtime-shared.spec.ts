import { describe, expect, it } from 'vitest';
import { wfActorLabel, wfCommentRequired, wfDescribeHistory, wfRemarksLabel, wfStepTimedOut } from './runtime-shared';

describe('wfActorLabel', () => {
  const titles = (k: string) => ({ financeSignOff: 'Pay approved scholarships' } as Record<string, string>)[k];

  it('prefers the title over a name that is only the key', () => {
    expect(wfActorLabel({ actorType: 'workflow', actorId: 'financeSignOff', actorName: 'financeSignOff' }, titles)).toBe('Workflow: Pay approved scholarships');
  });

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

  it('says how many of the workflow\'s changes it took back', () => {
    const h = (undone: string[]) => ({ category: 'lifecycle', action: 'reset', before: '{"state":"Review"}', after: '{"state":"Draft"}',
      data: JSON.stringify({ label: 'Start over', input: {}, undone }) }) as never;
    expect(wfDescribeHistory(h(['Delete Document “Checklist”']), String)).toBe('Start over: Review → Draft, took back 1 thing the workflow did');
    expect(wfDescribeHistory(h(['a', 'b']), String)).toBe('Start over: Review → Draft, took back 2 things the workflow did');
    expect(wfDescribeHistory(h([]), String)).toBe('Start over: Review → Draft');
  });
});


describe('remarks', () => {
  const approval = { kind: 'approval' as const, requireComment: 'reject' as const, outcomes: [{ key: 'approved', label: 'Approve' }, { key: 'rejected', label: 'Reject' }] };
  const task = { kind: 'task' as const, requireComment: 'reject' as const, outcomes: [{ key: 'done', label: 'Done', tone: 'success' }, { key: 'decline', label: 'Decline', tone: 'danger' }, { key: 'cancel', label: 'Cancel', tone: 'danger' }] };

  it('are required for an approval\'s reject and a task\'s red outcomes when asked for on rejecting', () => {
    expect(wfCommentRequired(approval, 'rejected')).toBe(true);
    expect(wfCommentRequired(approval, 'approved')).toBe(false);
    expect(wfCommentRequired(task, 'decline')).toBe(true);
    expect(wfCommentRequired(task, 'done')).toBe(false);
    expect(wfCommentRequired({ ...task, requireComment: 'always' }, 'done')).toBe(true);
    expect(wfCommentRequired({ ...task, requireComment: 'never' }, 'decline')).toBe(false);
    expect(wfCommentRequired({ ...task, requireComment: null }, 'decline')).toBe(false);
  });

  it('label says what they are required for', () => {
    expect(wfRemarksLabel(approval)).toBe('Remarks (required to reject)');
    expect(wfRemarksLabel(task)).toBe('Remarks (required to choose Decline or Cancel)');
    expect(wfRemarksLabel({ ...task, outcomes: task.outcomes.slice(0, 2) })).toBe('Remarks (required to decline)');
    expect(wfRemarksLabel({ ...task, requireComment: 'always' })).toBe('Remarks (required)');
    expect(wfRemarksLabel({ ...task, requireComment: 'never' })).toBe('Remarks (optional)');
  });

  it('show in the history of a move and of a reset', () => {
    const h = (action: string, data: unknown) => ({ category: 'lifecycle', action, before: '{"state":"Review"}', after: '{"state":"Draft"}', data: JSON.stringify(data) }) as never;
    expect(wfDescribeHistory(h('transitioned', { label: 'Reject', comment: 'Missing transcript' }), String)).toBe('Reject: Review → Draft (“Missing transcript”)');
    expect(wfDescribeHistory(h('transitioned', { label: 'Reject' }), String)).toBe('Reject: Review → Draft');
    expect(wfDescribeHistory(h('reset', { label: 'Start over', input: { reason: 'Form reason' }, comment: 'Wrong programme' }), String)).toBe('Start over: Review → Draft (“Wrong programme”)');
  });
});
