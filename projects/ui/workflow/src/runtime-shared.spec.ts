import { describe, expect, it } from 'vitest';
import { wfActorLabel, wfCommentRequired, wfDescribeHistory, wfParkedTimerName, wfReadableError, wfRemarksLabel, wfStepTimedOut, wfStoppedLabel, wfTimerParked } from './runtime-shared';

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

  it('a workflow nothing names reads "A workflow", never "unknown"', () => {
    expect(wfActorLabel({ actorType: 'workflow', actorId: '', actorName: null })).toBe('A workflow');
    expect(wfActorLabel({ actorType: 'workflow', actorId: null, actorName: '' })).toBe('A workflow');
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

describe('wfReadableError', () => {
  it('drops the engine\'s exception type, keeps everything else', () => {
    expect(wfReadableError('InvalidOperationException: Bank API: 503 Service Unavailable')).toBe('Bank API: 503 Service Unavailable');
    expect(wfReadableError('Bank API: 503')).toBe('Bank API: 503');
    expect(wfReadableError('The approver left: no one to ask')).toBe('The approver left: no one to ask');
    expect(wfReadableError(null)).toBe('');
  });

  it('names a parked timer by what it was for, and drops the exception type after its own prefix', () => {
    const tail = ' failed 10 times and was stopped: InvalidOperationException: The database refused writing application.status.';
    expect(wfReadableError('A timer (auto:tx)' + tail)).toBe('An automatic move failed 10 times and was stopped: The database refused writing application.status.');
    expect(wfReadableError('A timer (sla:s)' + tail)).toMatch(/^A time limit failed/);
    expect(wfReadableError('A timer (reminder)' + tail)).toMatch(/^A reminder failed/);
    expect(wfReadableError('A timer (escalation)' + tail)).toMatch(/^An escalation failed/);
    expect(wfReadableError('A timer (somethingNew)' + tail)).toMatch(/^A timer failed/);
    // Only an exception type right after a colon goes: words that merely end in "Exception" stay.
    expect(wfReadableError('Step failed: NoException: x')).toBe('Step failed: x');
    expect(wfReadableError('See MyException docs')).toBe('See MyException docs');
  });
});

describe('parked timers', () => {
  it('wfParkedTimerName: the timer an incident names, as a sentence object', () => {
    expect(wfParkedTimerName('A timer (auto:tx) failed 2 times and was stopped: x')).toBe('the automatic move');
    expect(wfParkedTimerName('A timer (sla:s) failed')).toBe('the time limit');
    expect(wfParkedTimerName('A timer (reminder) failed')).toBe('the reminder');
    expect(wfParkedTimerName('A timer (escalation) failed')).toBe('the escalation');
    expect(wfParkedTimerName(null)).toBe('the timer');
  });

  it('wfTimerParked: a record instance in incident, or a run in incident with no path stopped on a step', () => {
    const timer = 'A timer (reminder) failed 10 times and was stopped: mail down';
    expect(wfTimerParked({ status: 'incident', kind: 'record', tokens: null, error: 'anything' })).toBe(true);
    expect(wfTimerParked({ status: 'incident', kind: 'run', tokens: [{ id: 't', status: 'waiting', waiting: 'task', stepId: 'ap' }], error: timer })).toBe(true);
    // A stopped step (a path waits on the incident), or a step error without the parked-timer wording, is not a timer.
    expect(wfTimerParked({ status: 'incident', kind: 'run', tokens: [{ id: 't', status: 'waiting', waiting: 'incident', stepId: 'pay' }], error: timer })).toBe(false);
    expect(wfTimerParked({ status: 'incident', kind: 'automation', tokens: [], error: 'Bank API: 503' })).toBe(false);
    expect(wfTimerParked({ status: 'active', kind: 'record', tokens: null, error: null })).toBe(false);
  });

  it('wfStoppedLabel: "<workflow> · <record>", the record by title, else id', () => {
    expect(wfStoppedLabel({ title: 'Expiry', entityTitle: 'Grant a1', entityId: 'a1' })).toBe('Expiry · Grant a1');
    expect(wfStoppedLabel({ title: 'Expiry', entityTitle: null, entityId: 'a1' })).toBe('Expiry · a1');
    expect(wfStoppedLabel({ title: 'Nightly', entityTitle: null, entityId: null })).toBe('Nightly');
  });
});
