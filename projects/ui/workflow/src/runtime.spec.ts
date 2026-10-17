import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { UI_FB_SCHEMA_VERSION, type UiFormDefinition } from '@zouriel/ui/form-builder';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiWfAuditEntry, UiWfRecord, UiWfTask, UiWorkflowApi } from './api';
import { createWorkflow } from './definition';
import { UiWorkflowAudit, WfDecideDialog, WfRecordActions, WfRunView, WfTaskInbox, wfFormAnswers, wfSkipValue } from './runtime';
import { wfRemarksCounter } from './runtime-shared';

// jsdom has no ResizeObserver; the remarks box sizes itself with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

/** A form whose one answer is already filled in (a default nobody touches). */
const prefilled: UiFormDefinition = {
  schemaVersion: UI_FB_SCHEMA_VERSION, id: 'f1', title: 'Questions',
  pages: [{ id: 'p1', elements: [{ kind: 'field', id: 'e1', type: 'text', key: 'reason', label: 'Reason', defaultValue: 'Late documents' }] }],
};

function task(extra: Partial<UiWfTask> = {}): UiWfTask {
  return {
    id: 't1', instanceId: 'i1', kind: 'approval', title: 'Check it', instructions: null, definitionKey: 'k', entity: null, entityId: null, entityTitle: null,
    status: 'open', assignees: ['u'], assigneeNames: ['U'], rule: null, outcomes: [{ key: 'approved', label: 'Approve', tone: 'success' }, { key: 'rejected', label: 'Reject', tone: 'danger' }],
    decisions: [], form: null, requireComment: null, allowDelegation: false, outcome: null, dueAt: new Date(Date.now() + 86_400_000).toISOString(), overdue: false,
    escalationLevel: 0, createdAt: new Date().toISOString(), completedAt: null, canDecide: true, ...extra,
  } as unknown as UiWfTask;
}

function record(extra: Partial<UiWfRecord> = {}): UiWfRecord {
  return {
    entity: 'application', id: '1', title: 'A', lifecycle: 'review', lifecycleTitle: 'Review', state: 'Draft', stateLabel: 'Draft', stateTone: null, status: 'active',
    stateEnteredAt: new Date().toISOString(), transitions: [], tasks: [], instances: [], manual: [], states: [], ...extra,
  };
}

async function settle(f: ComponentFixture<unknown>, rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) { await new Promise((r) => setTimeout(r)); f.detectChanges(); await f.whenStable(); }
}

/** A button in an open dialog (dialogs render on the overlay layer, outside the component). */
function layerButton(label: string): HTMLButtonElement {
  const b = [...document.body.querySelectorAll('.ui-layer ui-button')].find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`No “${label}” button in the dialog`);
  return b.querySelector('button')!;
}
const layerText = () => document.body.textContent ?? '';

afterEach(() => vi.restoreAllMocks());

describe('wfFormAnswers / wfSkipValue / wfRemarksCounter', () => {
  it('reads every answer from the submission and refuses picked files that have nowhere to go', () => {
    expect(wfFormAnswers({ formId: 'f', revision: null, data: { a: 1 }, submittedAt: '', files: {} })).toEqual({ data: { a: 1 } });
    expect('error' in wfFormAnswers({ formId: 'f', revision: null, data: {}, submittedAt: '', files: { doc: [new File(['x'], 'x.txt')] } })).toBe(true);
  });

  it('turns a skipped step\'s results into their registry types', () => {
    expect(wfSkipValue('number', ' 42 ')).toBe(42);
    expect(wfSkipValue('number', 'abc')).toBeUndefined();
    expect(wfSkipValue('currency', 12.5)).toBe(12.5);
    expect(wfSkipValue('boolean', false)).toBe(false);
    expect(wfSkipValue('boolean', 'true')).toBe(true);
    expect(wfSkipValue('text', '  ok ')).toBe('ok');
    expect(wfSkipValue('text', '  ')).toBeUndefined();
    expect(wfSkipValue('date', null)).toBeUndefined();
  });

  it('shows the remarks counter only near the 2000-character limit', () => {
    expect(wfRemarksCounter('x'.repeat(100))).toBe('');
    expect(wfRemarksCounter('x'.repeat(1850))).toBe('1,850 / 2,000');
  });
});

describe('WfDecideDialog', () => {
  async function open(t: UiWfTask, api: Partial<UiWorkflowApi>) {
    const f = TestBed.createComponent(WfDecideDialog);
    f.componentRef.setInput('api', api as UiWorkflowApi);
    f.componentRef.setInput('task', t);
    f.detectChanges();
    await settle(f);
    return f;
  }

  it('sends the form\'s answers even when nobody touched them (a default value)', async () => {
    const calls: unknown[][] = [];
    const f = await open(task({ form: prefilled }), { decide: async (...a: unknown[]) => { calls.push(a); return task(); } });
    layerButton('Approve').click();
    await settle(f);
    expect(calls).toEqual([['t1', 'approved', undefined, { reason: 'Late documents' }]]);
  });

  it('asks for remarks a negative outcome requires, and sends them trimmed', async () => {
    const calls: unknown[][] = [];
    const f = await open(task({ requireComment: 'reject' }), { decide: async (...a: unknown[]) => { calls.push(a); return task(); } });
    layerButton('Reject').click();
    await settle(f);
    expect(calls).toEqual([]);
    expect(layerText()).toContain('Add remarks to explain “Reject”.');
    const box = document.querySelector('.ui-layer textarea') as HTMLTextAreaElement;
    // Longer than the engine takes: refused here, with the counter showing why.
    box.value = 'x'.repeat(2001);
    box.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(layerText()).toContain('2,001 / 2,000');
    layerButton('Reject').click();
    await settle(f);
    expect(calls).toEqual([]);
    expect(layerText()).toContain('Remarks can be at most 2,000 characters.');
    box.value = '  Missing transcript ';
    box.dispatchEvent(new Event('input'));
    f.detectChanges();
    layerButton('Reject').click();
    await settle(f);
    expect(calls).toEqual([['t1', 'rejected', 'Missing transcript', {}]]);
  });

  it('sends a decision once, however often it is clicked while on its way', async () => {
    let calls = 0;
    let finish!: () => void;
    const f = await open(task(), { decide: () => { calls++; return new Promise<UiWfTask>((r) => (finish = () => r(task()))); } });
    layerButton('Approve').click();
    layerButton('Approve').click();
    f.detectChanges();
    layerButton('Approve').click();
    finish();
    await settle(f);
    expect(calls).toBe(1);
  });

  it('Close, Escape, the backdrop and the cross wait while a decision is on its way', async () => {
    let finish!: () => void;
    const f = await open(task(), { decide: () => new Promise<UiWfTask>((r) => (finish = () => r(task()))) });
    let closed = 0;
    f.componentInstance.closed.subscribe(() => closed++);
    layerButton('Approve').click();
    f.detectChanges();
    expect(layerButton('Close').disabled).toBe(true);
    layerButton('Close').click();
    (document.querySelector('.ui-layer .panel-wrap') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    (document.querySelector('.ui-layer .backdrop') as HTMLElement).click();
    (document.querySelector('.ui-layer .hd .x') as HTMLButtonElement).click();
    await settle(f);
    expect(closed).toBe(0);
    expect(document.querySelector('.ui-layer [role="dialog"]')).not.toBeNull();
    finish();
    await settle(f);
    // Once it has landed, closing works again.
    (document.querySelector('.ui-layer .hd .x') as HTMLButtonElement).click();
    await settle(f);
    expect(closed).toBe(1);
  });

  it('its footer spans the dialog: Close at the left, the outcomes at the right, wrapping when narrow', async () => {
    await open(task(), { decide: async () => task() });
    const foot = document.querySelector('.ui-layer footer.ft div[modal-footer].foot') as HTMLElement;
    expect(foot).not.toBeNull();
    expect(foot.firstElementChild?.textContent?.trim()).toBe('Close');
    expect(foot.lastElementChild?.classList.contains('outcomes')).toBe(true);
    const css = (WfDecideDialog as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(css).toMatch(/\.foot\S*\s*\{[^}]*width:\s*100%[^}]*\}/);
    expect(css).toMatch(/\.foot\S*\s*\{[^}]*justify-content:\s*space-between/);
    expect(css).toMatch(/\.foot\S*\s+\.outcomes\S*\s*\{[^}]*flex-wrap:\s*wrap[^}]*margin-left:\s*auto/);
  });

  it('hands the task to someone found in the directory, leaving out people already on it', async () => {
    const handed: unknown[][] = [];
    const f = await open(task({ allowDelegation: true }), {
      searchUsers: async () => [{ id: 'u', name: 'Already on it' }, { id: 'sam', name: 'Sam', email: 'sam@x.org' }],
      delegate: async (...a: unknown[]) => { handed.push(a); return task(); },
    } as Partial<UiWorkflowApi>);
    const cmp = f.componentInstance as unknown as { searchPeople(q: string): void; people(): { value: string; label: string }[]; delegateTo: { set(v: string): void }; delegate(): Promise<void> };
    cmp.searchPeople('');
    await settle(f);
    expect(cmp.people()).toEqual([{ value: 'sam', label: 'Sam (sam@x.org)' }]);
    cmp.delegateTo.set('sam');
    await cmp.delegate();
    expect(handed).toEqual([['t1', 'sam']]);
  });

  it('stops a pending people search when it is destroyed', async () => {
    let searched = 0;
    const f = await open(task({ allowDelegation: true }), { searchUsers: async () => { searched++; return []; } } as Partial<UiWorkflowApi>);
    (f.componentInstance as unknown as { searchPeople(q: string): void }).searchPeople('sa');
    f.destroy();
    await new Promise((r) => setTimeout(r, 300));
    expect(searched).toBe(0);
  });
});

describe('WfRecordActions', () => {
  async function render(r: UiWfRecord, api: Partial<UiWorkflowApi>, entityId = '1') {
    const f = TestBed.createComponent(WfRecordActions);
    f.componentRef.setInput('api', api as UiWorkflowApi);
    f.componentRef.setInput('record', r);
    f.componentRef.setInput('entity', 'application');
    f.componentRef.setInput('entityId', entityId);
    f.detectChanges();
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement };
  }
  const click = (el: HTMLElement, label: string) =>
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === label) as HTMLElement).querySelector('button')!.click();

  it('a move with a form sends the answers nobody touched', async () => {
    const calls: unknown[][] = [];
    const t = { key: 'withdraw', label: 'Withdraw', to: 'Draft', toLabel: 'Draft', tone: 'primary', confirm: null, form: prefilled };
    const { f, el } = await render(record({ transitions: [t as never] }), { applyTransition: async (...a: unknown[]) => { calls.push(a); return record(); } });
    click(el, 'Withdraw');
    await settle(f);
    layerButton('Withdraw').click();
    await settle(f);
    expect(calls).toEqual([['application', '1', 'withdraw', { reason: 'Late documents' }, undefined]]);
  });

  it('a manual start with a form sends its prefilled answers', async () => {
    const calls: unknown[][] = [];
    const { f, el } = await render(record({ manual: [{ key: 'remind', label: 'Remind', form: prefilled }] }), { startManual: async (...a: unknown[]) => { calls.push(a); return {} as never; } });
    click(el, 'Remind');
    await settle(f);
    layerButton('Remind').click();
    await settle(f);
    expect(calls).toEqual([['remind', 'application', '1', { reason: 'Late documents' }]]);
  });

  it('never sends an old record\'s move against a new id while the host is switching', async () => {
    const calls: unknown[][] = [];
    const t = { key: 'submit', label: 'Submit', to: 'Review', toLabel: 'Review', tone: 'primary', confirm: null, form: null };
    const { f, el } = await render(record({ transitions: [t as never] }), { applyTransition: async (...a: unknown[]) => { calls.push(a); return record(); } }, '2');
    click(el, 'Submit');
    await settle(f);
    expect(calls).toEqual([]);
  });

  it('forgets an error when it is shown another record', async () => {
    const t = { key: 'submit', label: 'Submit', to: 'Review', toLabel: 'Review', tone: 'primary', confirm: null, form: null };
    const { f, el } = await render(record({ transitions: [t as never] }), { applyTransition: async () => { throw new Error('nope'); } });
    click(el, 'Submit');
    await settle(f);
    expect(el.querySelector('.wf-error')).not.toBeNull();
    f.componentRef.setInput('record', record({ id: '2' }));
    f.componentRef.setInput('entityId', '2');
    await settle(f);
    expect(el.querySelector('.wf-error')).toBeNull();
  });
});

describe('WfRunView skip and cancel dialogs', () => {
  const run = {
    id: 'r1', definitionId: 'd', definitionKey: 'pay', title: 'Pay', version: 1, kind: 'automation', parentId: null, reason: null, entity: null, entityId: null, entityTitle: null,
    status: 'incident', state: null, stateLabel: null, error: 'Bank API: 503', errorStepId: 's1', initiatorId: null, initiatorName: null, startedAt: new Date().toISOString(),
    updatedAt: '', endedAt: null, trigger: null, steps: [], tokens: [], outputs: null, variables: null, tasks: null,
  };
  const def = { ...createWorkflow('automation', 'Pay'), steps: [{ id: 's1', type: 'action', action: 'pay', input: {} }] };
  const outputs = [{ key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'ref', label: 'Reference', type: 'text' }];

  async function render(skip: (...a: unknown[]) => unknown) {
    const f = TestBed.createComponent(WfRunView);
    f.componentRef.setInput('api', {
      instance: async () => run, instanceDefinition: async () => def, skip, cancel: async () => run,
      schema: async () => ({ registry: { entities: [], actions: [{ key: 'pay', label: 'Pay', inputs: [], outputs }] }, steps: [] }),
    } as unknown as UiWorkflowApi);
    f.componentRef.setInput('instanceId', 'r1');
    f.componentRef.setInput('canIntervene', true);
    f.detectChanges();
    await settle(f);
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('asks each result in its own type, requires the required ones and sends numbers as numbers', async () => {
    const calls: unknown[][] = [];
    const { f, el } = await render(async (...a: unknown[]) => { calls.push(a); return run; });
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Skip the step') as HTMLElement).querySelector('button')!.click();
    await settle(f);
    // The footer is projected into the dialog's footer (not left in its body).
    expect(document.querySelector('.ui-layer footer.ft div[modal-footer]')).not.toBeNull();
    expect(document.querySelector('.ui-layer ui-number-input')).not.toBeNull();
    layerButton('Skip the step').click();
    await settle(f);
    expect(calls).toEqual([]);
    expect(layerText()).toContain('Give Amount');
    (f.componentInstance as unknown as { setSkipValue(k: string, v: unknown): void }).setSkipValue('amount', 250);
    f.detectChanges();
    layerButton('Skip the step').click();
    await settle(f);
    expect(calls).toEqual([['r1', { amount: 250 }, undefined]]);
  });

  it('projects the cancel dialog\'s buttons into its footer', async () => {
    const { f, el } = await render(async () => run);
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Cancel the run') as HTMLElement).querySelector('button')!.click();
    await settle(f);
    expect(document.querySelector('.ui-layer footer.ft div[modal-footer]')).not.toBeNull();
  });
});

describe('WfTaskInbox', () => {
  function t(id: string, status = 'open', extra: Partial<UiWfTask> = {}): UiWfTask {
    return task({ id, title: `Task ${id}`, status: status as never, outcome: status === 'open' ? null : 'approved', ...extra });
  }

  async function render(list: (q: { status?: string[]; take?: number; scope?: string }) => Promise<{ items: UiWfTask[]; total: number }>, inputs: Record<string, unknown> = {}) {
    const f = TestBed.createComponent(WfTaskInbox);
    f.componentRef.setInput('api', { tasks: list, decide: async () => t('a', 'completed') } as unknown as UiWorkflowApi);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('says it is loading until the first page arrives, then what is empty for whom', async () => {
    let answer!: (v: { items: UiWfTask[]; total: number }) => void;
    const { f, el } = await render(() => new Promise((r) => (answer = r)));
    f.detectChanges();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Loading…');
    answer({ items: [], total: 0 });
    await settle(f);
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Nothing is waiting for you.');
    const all = await render(async () => ({ items: [], total: 0 }), { scope: 'all' });
    await settle(all.f);
    expect(all.el.querySelector('.empty')?.textContent?.trim()).toBe('No open tasks.');
  });

  it('shows more when there are more, and switches to finished tasks', async () => {
    const asked: { status?: string[]; take?: number }[] = [];
    const open = Array.from({ length: 30 }, (_, i) => t(`o${i}`));
    const { f, el } = await render(async (q) => {
      asked.push(q);
      return q.status?.includes('open') ? { items: open.slice(0, q.take), total: open.length } : { items: [t('d1', 'completed')], total: 1 };
    }, { pageSize: 10 });
    await settle(f);
    expect(el.querySelectorAll('.row').length).toBe(10);
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Show more') as HTMLElement).querySelector('button')!.click();
    await settle(f);
    expect(el.querySelectorAll('.row').length).toBe(20);
    expect(asked.at(-1)?.take).toBe(20);
    (f.componentInstance as unknown as { status: { set(v: string): void } }).status.set('done');
    await settle(f);
    expect(asked.at(-1)?.status).toEqual(['completed', 'timedOut', 'cancelled']);
    expect(el.querySelector('.row .wf-chip')?.textContent?.trim()).toBe('Approve');
  });

  it('opens a task\'s decision from its row', async () => {
    const { f, el } = await render(async () => ({ items: [t('a')], total: 1 }));
    await settle(f);
    (el.querySelector('.row') as HTMLButtonElement).click();
    await settle(f);
    expect(layerText()).toContain('Task a');
  });
});

describe('UiWorkflowAudit', () => {
  let n = 0;
  const entry = (seq: number): UiWfAuditEntry => ({
    seq, id: `a${seq}`, at: new Date().toISOString(), tenant: null, actorType: 'user', actorId: 'ali', actorName: 'Ali', category: 'lifecycle', action: 'transitioned',
    subjectType: 'record', subjectId: '1', entity: 'application', entityId: '1', instanceId: 'i1', definitionId: 'd1', before: null, after: null, data: null,
    correlationId: 'c', causationId: null, prevHash: '', hash: `h${++n}`,
  });

  async function render(inputs: Record<string, unknown> = {}, extra: Partial<UiWorkflowApi> = {}) {
    const queries: Record<string, unknown>[] = [];
    const exports: Record<string, unknown>[] = [];
    let answer: ((v: UiWfAuditEntry[]) => void) | null = null;
    const f = TestBed.createComponent(UiWorkflowAudit);
    f.componentRef.setInput('api', {
      definitions: async () => [],
      audit: (q: Record<string, unknown>) => {
        queries.push(q);
        const before = q['before'] as number | undefined;
        const start = before ? before - 1 : 4;
        return Promise.resolve(Array.from({ length: Math.min(2, start) }, (_, i) => entry(start - i)));
      },
      exportAudit: async (q: Record<string, unknown>) => { exports.push(q); return new Blob(['x']); },
      verifyAudit: async () => ({ valid: true, checked: 4, brokenAtSeq: null, problem: null }),
      ...extra,
    } as unknown as UiWorkflowApi);
    f.componentRef.setInput('pageSize', 2);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement, queries, exports, hold: (fn: (v: UiWfAuditEntry[]) => void) => (answer = fn), answer: () => answer };
  }
  const button = (el: HTMLElement, label: string) =>
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === label) as HTMLElement | undefined)?.querySelector('button');

  it('says it is loading before the first page, not that there are no entries', async () => {
    const { f, el } = await render({}, { audit: () => new Promise(() => undefined) } as Partial<UiWorkflowApi>);
    f.detectChanges();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('Loading…');
  });

  it('pages back with older entries, filtered by kind', async () => {
    const { f, el, queries } = await render();
    await settle(f);
    expect([...el.querySelectorAll('.seq')].map((s) => s.textContent)).toEqual(['#4', '#3']);
    button(el, 'Older entries')!.click();
    await settle(f);
    expect([...el.querySelectorAll('.seq')].map((s) => s.textContent)).toEqual(['#4', '#3', '#2', '#1']);
    expect(queries.at(-1)?.['before']).toBe(3);
    (f.componentInstance as unknown as { category: { set(v: string): void } }).category.set('task');
    await settle(f);
    expect(queries.at(-1)?.['category']).toBe('task');
    expect(queries.at(-1)?.['before']).toBeUndefined();
  });

  it('checks the chain and says so', async () => {
    const { f, el } = await render();
    await settle(f);
    button(el, 'Check integrity')!.click();
    await settle(f);
    expect(el.textContent).toContain('The chain is intact: 4 entries checked.');
  });

  it('exports the record\'s entries, and offers no export for one run (the export has no run filter)', async () => {
    URL.createObjectURL ??= () => 'blob:x';
    URL.revokeObjectURL ??= () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const rec = await render({ entity: 'application', entityId: '1' });
    await settle(rec.f);
    button(rec.el, 'CSV')!.click();
    await settle(rec.f);
    expect(rec.exports).toEqual([{ category: undefined, entity: 'application', entityId: '1', format: 'csv' }]);

    const one = await render({ instanceId: 'i1' });
    await settle(one.f);
    expect(button(one.el, 'CSV')).toBeUndefined();
    expect(one.el.textContent).toContain('an export can’t be limited to one run');
  });

  it('drops a typed record filter that is still waiting when it is destroyed', async () => {
    const { f } = await render();
    await settle(f);
    const cmp = f.componentInstance as unknown as { typeRecord(v: string): void; recordFilter(): string };
    cmp.typeRecord('42');
    f.destroy();
    await new Promise((r) => setTimeout(r, 400));
    expect(cmp.recordFilter()).toBe('');
  });
});
