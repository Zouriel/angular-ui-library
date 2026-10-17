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

function fakeApi(canIntervene: boolean) {
  const calls: unknown[][] = [];
  const api = {
    instance: async () => stuck(),
    instanceDefinition: async () => def,
    me: async () => ({ type: 'user', id: 'u', name: 'U', roles: [], can: { edit: false, publish: false, settings: false, intervene: canIntervene, audit: false } }),
    schema: async () => ({ specVersion: 1, steps: [], registry: { specVersion: 1, entities: [], actions: [{ key: 'bank.pay', label: 'Pay', inputs: [], outputs: [{ key: 'reference', label: 'Payment reference', type: 'text' }] }] } }),
    retry: async (...a: unknown[]) => { calls.push(['retry', ...a]); return stuck({ status: 'running', error: null, tokens: [] }); },
    skip: async (...a: unknown[]) => { calls.push(['skip', ...a]); return stuck({ status: 'running', error: null, tokens: [] }); },
    cancel: async (...a: unknown[]) => { calls.push(['cancel', ...a]); return stuck({ status: 'cancelled', tokens: [] }); },
  } as unknown as UiWorkflowApi;
  return { api, calls };
}

async function render(canIntervene: boolean) {
  const { api, calls } = fakeApi(canIntervene);
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
});
