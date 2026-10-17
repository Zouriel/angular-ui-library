import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiWfInstance, UiWorkflowApi } from './api';
import { createStep, createWorkflow } from './definition';
import { WfRunView } from './runtime';
import type { UiWfStep, UiWorkflowDefinition } from './schema';

// jsdom has no ResizeObserver; the remarks box sizes itself with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const pay = { ...createStep('action'), id: 'pay', title: 'Create the payment', action: 'bank.pay', input: {} } as UiWfStep;
const mail = { ...createStep('notify'), id: 'mail', title: 'Email the student' } as UiWfStep;
const def: UiWorkflowDefinition = { ...createWorkflow('automation', 'Pay approved scholarships', 'application'), steps: [pay, mail] };

function stuck(extra: Partial<UiWfInstance> = {}): UiWfInstance {
  return {
    id: 'r1', definitionId: def.id, definitionKey: def.key, title: def.title, version: 1, kind: 'automation', parentId: null, reason: null,
    entity: 'application', entityId: '1', entityTitle: 'Bursary – Ali', status: 'incident', state: null, stateLabel: null,
    error: 'Bank API: 503 Service Unavailable', errorStepId: 'pay', initiatorId: null, initiatorName: null,
    startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), endedAt: null, trigger: null,
    steps: [{ id: 'sr1', nodeId: 'pay', type: 'action', title: null, attempt: 3, status: 'failed', input: null, output: null, error: 'Bank API: 503 Service Unavailable', startedAt: '', endedAt: null }],
    tokens: [{ id: 't1', status: 'waiting', waiting: 'incident', stepId: 'pay' }], outputs: null, variables: null, tasks: null, ...extra,
  };
}

function fakeApi(canIntervene: boolean, run: UiWfInstance = stuck(), definition: UiWorkflowDefinition = def) {
  const calls: unknown[][] = [];
  const api = {
    instance: async () => run,
    instanceDefinition: async () => definition,
    me: async () => ({ type: 'user', id: 'u', name: 'U', roles: [], can: { edit: false, publish: false, settings: false, intervene: canIntervene, audit: false } }),
    schema: async () => ({ specVersion: 1, steps: [], registry: { specVersion: 1, entities: [], actions: [{ key: 'bank.pay', label: 'Pay', inputs: [], outputs: [{ key: 'reference', label: 'Payment reference', type: 'text' }] }] } }),
    retry: async (...a: unknown[]) => { calls.push(['retry', ...a]); return stuck({ status: 'running', error: null, tokens: [] }); },
    skip: async (...a: unknown[]) => { calls.push(['skip', ...a]); return stuck({ status: 'running', error: null, tokens: [] }); },
    cancel: async (...a: unknown[]) => { calls.push(['cancel', ...a]); return stuck({ status: 'cancelled', tokens: [] }); },
  } as unknown as UiWorkflowApi;
  return { api, calls };
}

async function render(canIntervene: boolean, run?: UiWfInstance, definition?: UiWorkflowDefinition) {
  const { api, calls } = fakeApi(canIntervene, run, definition);
  const f = TestBed.createComponent(WfRunView);
  f.componentRef.setInput('api', api);
  f.componentRef.setInput('instanceId', 'r1');
  document.body.appendChild(f.nativeElement);
  for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r)); f.detectChanges(); await f.whenStable(); }
  return { f, el: f.nativeElement as HTMLElement, calls };
}
const button = (root: ParentNode, text: string) => [...root.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)?.querySelector('button') ?? null;
/** A button in the open dialog (not the same-named one in the run's own incident box). */
const dialogButton = (el: HTMLElement, text: string) =>
  [...document.body.querySelectorAll('ui-modal ui-button, .ui-layer ui-button')].find((b) => b.textContent?.trim() === text && !el.querySelector('.incident')?.contains(b))!.querySelector('button')!;
const settle = async (f: { detectChanges(): void; whenStable(): Promise<unknown> }) => { for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r)); f.detectChanges(); await f.whenStable(); } };

describe('WfRunView (inside the workflow panel and the tasks drawer)', () => {
  it('shows each step, why the run stopped, and the steps not reached', async () => {
    const { el } = await render(true);
    expect(el.textContent).toContain('Stopped: Bank API: 503 Service Unavailable');
    const rows = [...el.querySelectorAll('.steps li')];
    expect(rows.map((r) => r.querySelector('.name')?.textContent?.trim())).toEqual(['Create the payment', 'Email the student']);
    expect(rows[0].getAttribute('data-status')).toBe('failed');
    expect(rows[1].getAttribute('data-status')).toBe('notRun');
  });

  it('tries again for people who may intervene', async () => {
    const { f, el, calls } = await render(true);
    button(el, 'Try again')!.click();
    await settle(f);
    expect(calls).toEqual([['retry', 'r1', undefined]]);
  });

  it('skips the step with the results it would have produced, named as the app declares them', async () => {
    const { f, el, calls } = await render(true);
    button(el, 'Skip the step')!.click();
    await settle(f);
    expect(document.body.textContent).toContain('Skip “Create the payment”');
    expect(document.body.textContent).toContain('Payment reference');
    const input = document.body.querySelector('ui-modal input, .ui-layer input') as HTMLInputElement;
    input.value = ' BML-48213 ';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    dialogButton(el, 'Skip the step').click();
    await settle(f);
    expect(calls).toEqual([['skip', 'r1', { reference: 'BML-48213' }, undefined]]);
  });

  it('cancels only after a confirmation, with optional remarks', async () => {
    const { f, el, calls } = await render(true);
    button(el, 'Cancel the run')!.click();
    await settle(f);
    expect(calls).toEqual([]);
    const box = document.body.querySelector('ui-modal textarea, .ui-layer textarea') as HTMLTextAreaElement;
    box.value = 'Scholarship withdrawn';
    box.dispatchEvent(new Event('input'));
    f.detectChanges();
    dialogButton(el, 'Cancel the run').click();
    await settle(f);
    expect(calls).toEqual([['cancel', 'r1', 'Scholarship withdrawn']]);
  });

  it('people who may not intervene see why it stopped and who can fix it, without the buttons', async () => {
    const { el } = await render(false);
    expect(el.textContent).toContain('Stopped: Bank API');
    expect(button(el, 'Try again')).toBeNull();
    expect(el.textContent).toContain('Someone who looks after workflows can try it again or skip it.');
  });

  // A reminder's timer failed ten times and the engine parked it: the run is in incident with the error (spec §10),
  // while its task stays open (its path waits on the task, not on a stopped step).
  const parked = () => stuck({
    errorStepId: 'pay', error: 'A timer (reminder) failed 10 times and was stopped: InvalidOperationException: mail server down',
    steps: [{ id: 'sr1', nodeId: 'pay', type: 'action', title: null, attempt: 1, status: 'waiting', input: null, output: null, error: null, startedAt: '', endedAt: null }],
    tokens: [{ id: 't1', status: 'waiting', waiting: 'task', stepId: 'pay' }],
  });

  it('a run held by a parked timer shows as stopped with the readable error, and tries it again', async () => {
    const { f, el, calls } = await render(true, parked());
    expect(el.querySelector('.head .wf-chip')?.textContent?.trim()).toBe('Stopped');
    expect(el.querySelector('.incident[role="alert"]')?.textContent).toContain('Stopped: A reminder failed 10 times and was stopped: mail server down');
    expect(el.textContent).toContain('the task stays open');
    expect(button(el, 'Skip the step')).toBeNull();
    expect(button(el, 'Cancel the run')).not.toBeNull();
    button(el, 'Try again')!.click();
    await settle(f);
    expect(calls).toEqual([['retry', 'r1', undefined]]);
  });

  it('skipping a parked timer is confirmed, asks for no results, and drops it', async () => {
    const { f, el, calls } = await render(true, parked());
    button(el, 'Skip')!.click();
    await settle(f);
    expect(calls).toEqual([]);
    expect(document.body.textContent).toContain('Skip the reminder');
    expect(document.body.textContent).toContain('The task stays open');
    expect(document.body.querySelector('ui-modal input, .ui-layer input')).toBeNull();
    dialogButton(el, 'Skip it').click();
    await settle(f);
    expect(calls).toEqual([['skip', 'r1', undefined, undefined]]);
  });

  it('a lifecycle record instance in incident shows its error with Try again and Skip, no step list and no cancel', async () => {
    const lifecycle: UiWorkflowDefinition = {
      ...createWorkflow('lifecycle', 'Expiry', 'application'),
      lifecycle: { field: 'status', states: [{ id: 'd', key: 'draft', label: 'Draft', category: 'initial', onEnter: [mail] }], transitions: [] },
    } as UiWorkflowDefinition;
    const rec = stuck({
      kind: 'record', title: 'Expiry', state: 'draft', stateLabel: 'Draft', steps: [], tokens: [], errorStepId: 'tx',
      error: 'A timer (auto:tx) failed 2 times and was stopped: InvalidOperationException: The database refused writing application.status.',
    });
    const { f, el, calls } = await render(true, rec, lifecycle);
    expect(el.querySelector('.head')?.textContent).toContain('Draft');
    expect(el.querySelector('.incident')?.textContent).toContain('Stopped: An automatic move failed 2 times and was stopped: The database refused writing application.status.');
    expect(el.textContent).toContain('Moving the record by hand also clears this.');
    expect(el.querySelector('.steps')).toBeNull();
    expect(button(el, 'Cancel the run')).toBeNull();
    expect(button(el, 'Skip the step')).toBeNull();
    button(el, 'Skip')!.click();
    await settle(f);
    expect(document.body.textContent).toContain('Skip the automatic move');
    expect(document.body.textContent).toContain('the record stays where it is');
    dialogButton(el, 'Skip it').click();
    await settle(f);
    expect(calls).toEqual([['skip', 'r1', undefined, undefined]]);
  });

  it('people who may not intervene see why a parked timer stopped it and who can fix it, without buttons', async () => {
    const { el } = await render(false, parked());
    expect(el.textContent).toContain('Stopped: A reminder failed 10 times');
    expect(el.textContent).toContain('Someone who looks after workflows can try it again or skip it.');
    expect(button(el, 'Try again')).toBeNull();
    expect(button(el, 'Skip')).toBeNull();
  });

  it('a waiting run is not flagged, whatever its error field says', async () => {
    const { el } = await render(true, stuck({ status: 'waiting', error: 'old', errorStepId: null, tokens: [{ id: 't1', status: 'waiting', waiting: 'task', stepId: 'pay' }] }));
    expect(el.querySelector('.incident')).toBeNull();
    expect(el.querySelector('.head .wf-chip')?.textContent?.trim()).toBe('Waiting');
  });
});
