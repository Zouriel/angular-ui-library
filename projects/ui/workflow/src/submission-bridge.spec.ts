import { describe, expect, it } from 'vitest';
import type { UiFormSubmission } from '@zouriel/ui/form-builder';
import type { UiWfApprovalStep, UiWfBranchStep, UiWfTaskStep, UiWorkflowDefinition } from './schema';
import { createStep, createWorkflow, formFields } from './definition';
import {
  wfAnswerAt, wfPickWorkflow, wfRouteSubmission, wfStartFromSubmission, wfSubmissionPayload, wfSubmissionRegistry, wfSubmissionTokens,
} from './submission-bridge';

function submission(values: Record<string, unknown>, extra: Partial<UiFormSubmission> = {}): UiFormSubmission {
  return {
    formId: 'leave', revision: 3, locale: 'dv', values, submittedAt: '2026-11-16T08:00:00Z', workflowId: 'wf-leave', serviceCode: 'HR-LEAVE',
    fields: [
      { path: 'days', key: 'days', label: 'Days', type: 'number' },
      { path: 'address.city', key: 'city', label: 'City', type: 'text' },
      { path: 'children[].age', key: 'age', label: 'Age', type: 'number' },
      { path: 'cert', key: 'cert', label: 'Certificate', type: 'file' },
    ],
    files: {},
    ...extra,
  };
}

function leaveWorkflow(threshold = 3): UiWorkflowDefinition {
  const def = createWorkflow('automation', 'Leave request', 'request');
  def.id = 'wf-leave';
  def.key = 'leave';
  def.trigger = { type: 'created' };
  const branch = createStep('branch') as UiWfBranchStep;
  branch.title = 'Long leave?';
  branch.paths[0].label = 'Over the limit';
  branch.paths[0].when = { match: 'all', conditions: [{ ref: 'entity.days', op: 'gt', value: { const: threshold } }] };
  const approval = createStep('approval') as UiWfApprovalStep;
  approval.title = 'Manager approval';
  approval.assignees = [{ managerOf: 'initiator' }];
  const task = createStep('task') as UiWfTaskStep;
  task.title = 'Pay out';
  task.assignees = [{ group: 'finance' }];
  approval.outcomes.approved = [task];
  branch.paths[0].steps = [approval];
  branch.otherwise!.label = 'Auto-approved';
  branch.otherwise!.steps = [createStep('notify')];
  def.steps = [branch];
  return def;
}

describe('wfSubmissionPayload', () => {
  it('carries the answers, locale, link and field list, without files', () => {
    const p = wfSubmissionPayload(submission({ days: 5 }, { files: { cert: [new File(['x'], 'a.pdf')] } }));
    expect(p).toEqual({
      formId: 'leave', revision: 3, locale: 'dv', submittedAt: '2026-11-16T08:00:00Z', workflowId: 'wf-leave', serviceCode: 'HR-LEAVE',
      values: { days: 5 }, fields: expect.any(Array),
    });
    expect(p.fields.map((f) => f.path)).toEqual(['days', 'address.city', 'children[].age', 'cert']);
    expect('files' in p).toBe(false);
    expect(() => JSON.stringify(p)).not.toThrow();
  });

  it('omits the link when the host set none', () => {
    const p = wfSubmissionPayload(submission({}, { workflowId: undefined, serviceCode: undefined }));
    expect('workflowId' in p).toBe(false);
    expect('serviceCode' in p).toBe(false);
  });
});

describe('wfPickWorkflow', () => {
  const a = leaveWorkflow();
  const b = { ...leaveWorkflow(), id: 'wf-permit', key: 'permit' };
  const list = [{ workflow: a, serviceCodes: ['HR-LEAVE'] }, { workflow: b, serviceCodes: ['PERMIT'], formIds: ['permit-form'] }];

  it('prefers workflowId (id or key), then serviceCode, then form id', () => {
    expect(wfPickWorkflow(list, { workflowId: 'wf-permit', serviceCode: 'HR-LEAVE', formId: 'x' })).toBe(b);
    expect(wfPickWorkflow(list, { workflowId: 'leave', formId: 'x' })).toBe(a);
    expect(wfPickWorkflow(list, { serviceCode: 'PERMIT', formId: 'x' })).toBe(b);
    expect(wfPickWorkflow(list, { formId: 'permit-form' })).toBe(b);
  });

  it('returns null rather than guessing', () => {
    expect(wfPickWorkflow(list, { workflowId: 'nope', serviceCode: 'PERMIT', formId: 'permit-form' })).toBeNull();
    expect(wfPickWorkflow(list, { formId: 'other' })).toBeNull();
    expect(wfPickWorkflow([a], { workflowId: 'wf-leave', formId: 'x' })).toBe(a);
  });
});

describe('wfRouteSubmission', () => {
  it('sends a long leave to the manager, then the finance queue', () => {
    const r = wfRouteSubmission(leaveWorkflow(), submission({ days: 5 }));
    expect(r.decisions).toEqual([{ stepId: expect.any(String), title: 'Long leave?', taken: 'Over the limit' }]);
    expect(r.steps.map((s) => s.title)).toEqual(['Long leave?', 'Manager approval', 'Pay out']);
    expect(r.approvals).toHaveLength(1);
    expect(r.approvals[0].assignees[0].label).toBe('the manager of initiator');
    expect(r.queues).toEqual(['finance']);
    expect(r.steps[2].path).toEqual(['Over the limit', 'Approved']);
    expect(r.result).toBe('completed');
  });

  it('auto-approves a short leave', () => {
    const r = wfRouteSubmission(leaveWorkflow(), submission({ days: 2 }));
    expect(r.decisions[0].taken).toBe('Auto-approved');
    expect(r.approvals).toEqual([]);
    expect(r.queues).toEqual([]);
  });

  it('changing the condition in the workflow changes the route for the same answers', () => {
    const s = submission({ days: 5 });
    expect(wfRouteSubmission(leaveWorkflow(3), s).queues).toEqual(['finance']);
    expect(wfRouteSubmission(leaveWorkflow(10), s).queues).toEqual([]);
  });

  it('follows a decision and reads nested answers and row values', () => {
    const def = leaveWorkflow();
    const approval = (def.steps![0] as UiWfBranchStep).paths[0].steps[0] as UiWfApprovalStep;
    expect(wfRouteSubmission(def, submission({ days: 5 }), { decisions: { [approval.id]: 'rejected' } }).queues).toEqual([]);
    expect(wfAnswerAt({ address: { city: 'Malé' } }, 'address.city')).toBe('Malé');
    expect(wfAnswerAt({ children: [{ age: 4 }, { age: 9 }] }, 'children[].age')).toEqual([4, 9]);
    const alt = leaveWorkflow();
    (alt.steps![0] as UiWfBranchStep).paths[0].when = { match: 'any', conditions: [{ ref: 'trigger.data.address.city', op: 'eq', value: { const: 'malé' } }] };
    expect(wfRouteSubmission(alt, submission({ days: 1, address: { city: 'Malé' } })).queues).toEqual(['finance']);
  });

  it('accepts a payload and a conditions on the link', () => {
    const alt = leaveWorkflow();
    (alt.steps![0] as UiWfBranchStep).paths[0].when = { match: 'all', conditions: [{ ref: 'trigger.serviceCode', op: 'eq', value: { const: 'HR-LEAVE' } }] };
    expect(wfRouteSubmission(alt, wfSubmissionPayload(submission({ days: 1 }))).queues).toEqual(['finance']);
  });
});

describe('wfStartFromSubmission', () => {
  it('starts the workflow with the answers', async () => {
    const calls: unknown[][] = [];
    const api = { startManual: async (...a: unknown[]) => { calls.push(a); return {} as never; } };
    await wfStartFromSubmission(api, leaveWorkflow(), submission({ days: 5 }));
    expect(calls).toEqual([['leave', null, null, { days: 5 }]]);
  });

  it('refuses files that have no upload address', () => {
    const api = { startManual: async () => ({}) as never };
    expect(() => wfStartFromSubmission(api, leaveWorkflow(), submission({}, { files: { cert: [new File(['x'], 'a.pdf')] } }))).toThrow(/files/);
  });
});

describe('field hints', () => {
  it('describes the answers as a record type for the builder and as tokens', () => {
    const { registry } = wfSubmissionRegistry(submission({}).fields, { roles: [{ key: 'manager', label: 'Manager' }] });
    const e = registry.entities[0];
    expect(e.key).toBe('request');
    expect(e.fields.map((f) => [f.key, f.type])).toEqual([['days', 'number'], ['address.city', 'text'], ['children[].age', 'number']]);
    expect(registry.roles).toHaveLength(1);
    expect(wfSubmissionTokens(submission({}).fields)[0]).toEqual({ path: 'input.days', label: 'Days', group: 'Form answers', type: 'number' });
  });
});

describe('formFields with localized labels', () => {
  it('resolves a label in the asked language, else the default', () => {
    const form = { defaultLocale: 'en', pages: [{ id: 'p', elements: [{ kind: 'field', key: 'days', label: { en: 'Days', dv: 'ދުވަސް' } }] }] } as never;
    expect(formFields(form)).toEqual([{ key: 'days', label: 'Days' }]);
    expect(formFields(form, 'dv')).toEqual([{ key: 'days', label: 'ދުވަސް' }]);
  });
});
