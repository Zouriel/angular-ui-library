import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiWfDefinitionSummary, UiWfMe, UiWfPermissionChange, UiWorkflowApi } from './api';
import { createStep } from './definition';
import { UiWorkflowPermissions, permissionRows } from './permissions';
import type { UiWfStep, UiWorkflowDefinition } from './schema';

const approval = { ...createStep('approval'), id: 'ap', title: 'Finance sign-off', assignees: [{ role: 'finance' }] } as UiWfStep;
const task = { ...createStep('task'), id: 'tk', assignees: [] } as UiWfStep;

const lifecycle: UiWorkflowDefinition = {
  specVersion: 1, id: 'wf_l', key: 'review', kind: 'lifecycle', title: 'Scholarship review', entity: 'application',
  lifecycle: {
    field: 'status', mode: 'enforce',
    states: [
      { id: 'd', key: 'Draft', label: 'Draft', category: 'initial' },
      { id: 's', key: 'Submitted', label: 'Submitted', category: 'active' },
      { id: 'a', key: 'Approved', label: 'Approved', category: 'terminal' },
    ],
    transitions: [
      { id: 't1', key: 'submit', label: 'Submit', from: ['d'], to: 's', who: [{ initiator: true }] },
      { id: 't2', key: 'approve', label: 'Approve', from: ['s'], to: 'a', who: [{ role: 'head' }], steps: [approval] },
      { id: 't3', key: 'expire', label: 'Expire', from: ['s'], to: 'd', auto: { after: 'P30D' } },
    ],
    reset: { label: 'Start over', who: [{ role: 'head' }] },
  },
} as unknown as UiWorkflowDefinition;

const automation: UiWorkflowDefinition = {
  specVersion: 1, id: 'wf_a', key: 'pay', kind: 'automation', title: 'Pay', entity: 'application',
  trigger: { type: 'manual', label: 'Pay now', who: [{ role: 'finance' }] }, steps: [task],
} as unknown as UiWorkflowDefinition;

describe('permissionRows', () => {
  it('lists moves, the reset, the start button and people steps, skipping automatic moves', () => {
    const rows = permissionRows(lifecycle);
    expect(rows.map((r) => [r.node, r.kind, r.label, r.detail])).toEqual([
      ['t1', 'transition', 'Submit', 'Draft → Submitted'],
      ['t2', 'transition', 'Approve', 'Submitted → Approved'],
      ['reset', 'reset', 'Start over', 'Back to Draft'],
      ['ap', 'step', 'Finance sign-off', 'Approval'],
    ]);
    expect(permissionRows(automation).map((r) => [r.node, r.label, r.who])).toEqual([
      ['trigger', '“Pay now” button', [{ role: 'finance' }]],
      ['tk', 'Task', []],
    ]);
  });
});

function summary(def: UiWorkflowDefinition, version = 1): UiWfDefinitionSummary {
  return { id: def.id, key: def.key, kind: def.kind, title: def.title, entity: def.entity ?? null, status: 'published', version, hasDraftChanges: false, updatedAt: '', updatedBy: null, runningInstances: 0 };
}

function fakeApi(canPublish: boolean) {
  const calls: { id: string; changes: UiWfPermissionChange[]; note?: string }[] = [];
  const api = {
    definitions: async () => [summary(lifecycle), summary(automation)],
    definition: async (id: string) => {
      const def = id === lifecycle.id ? lifecycle : automation;
      return { summary: summary(def), draft: def, published: def, versions: [], problems: [] };
    },
    schema: async () => ({ specVersion: 1, registry: { entities: [], roles: [{ key: 'head', label: 'Head of office' }, { key: 'finance', label: 'Finance' }] }, steps: [] }),
    me: async (): Promise<UiWfMe> => ({ type: 'user', id: 'u', name: 'U', roles: [], can: { edit: canPublish, publish: canPublish, settings: false, intervene: false, audit: false } }),
    updatePermissions: async (id: string, changes: UiWfPermissionChange[], note?: string) => {
      calls.push({ id, changes, note });
      await new Promise((r) => setTimeout(r, 5));
      return summary(lifecycle, 2);
    },
  } as unknown as UiWorkflowApi;
  return { api, calls };
}

async function render(canPublish: boolean) {
  const { api, calls } = fakeApi(canPublish);
  const f = TestBed.createComponent(UiWorkflowPermissions);
  f.componentRef.setInput('api', api);
  f.detectChanges();
  const cmp = f.componentInstance as unknown as Record<string, any>;
  // Loading is plain promises, which whenStable doesn't wait for in a zoneless test.
  for (let i = 0; i < 50 && (cmp['loading']() || !cmp['workflows']().length); i++) await new Promise((r) => setTimeout(r, 2));
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, el, calls, cmp };
}

describe('UiWorkflowPermissions', () => {
  it('shows each published workflow with its rows', async () => {
    const { el } = await render(true);
    const titles = [...el.querySelectorAll('h3')].map((h) => h.textContent?.trim());
    expect(titles).toEqual(['Pay', 'Scholarship review']);
    expect(el.querySelectorAll('.row')).toHaveLength(6);
    expect(el.querySelectorAll('ui-wf-assignees')).toHaveLength(6);
  });

  it('saves only the changed rows, once, with the note, and says which version is in use', async () => {
    const { f, el, calls, cmp } = await render(true);
    const w = cmp['workflows']().find((x: { summary: { id: string } }) => x.summary.id === 'wf_l');
    const submit = w.rows[0];
    cmp['edit'](w, submit, [{ role: 'head' }]);
    cmp['setNote'](w, 'Only the head submits for now');
    f.detectChanges();
    expect(el.querySelector('.row.changed .label')?.textContent).toBe('Submit');
    const saveBtn = [...el.querySelectorAll('ui-button')].find((b) => b.textContent?.includes('Save 1 change'))!.querySelector('button')!;
    saveBtn.click();
    saveBtn.click(); // a double click saves once
    for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 5)); await f.whenStable(); f.detectChanges(); }
    expect(calls).toEqual([{ id: 'wf_l', changes: [{ node: 't1', who: [{ role: 'head' }] }], note: 'Only the head submits for now' }]);
    expect(el.textContent).toContain('Saved: version 2 is now in use.');
    expect(el.querySelector('.row.changed')).toBeNull();
  });

  it('setting a row back to what is published is not a change', async () => {
    const { f, el, cmp } = await render(true);
    const w = cmp['workflows']()[1];
    cmp['edit'](w, w.rows[0], []);
    cmp['edit'](w, w.rows[0], w.rows[0].who);
    f.detectChanges();
    expect(el.textContent).not.toContain('Save');
  });

  it('people who may not publish see who may do what, without editors', async () => {
    const { el } = await render(false);
    expect(el.querySelectorAll('ui-wf-assignees')).toHaveLength(0);
    expect(el.textContent).toContain('changing it needs the right to publish');
    expect([...el.querySelectorAll('.read')].map((r) => r.textContent?.trim())).toContain('Head of office');
  });

  it('search narrows to matching workflows and rows', async () => {
    const { f, el, cmp } = await render(true);
    cmp['query'].set('start over');
    f.detectChanges();
    expect([...el.querySelectorAll('.row .label')].map((x) => x.textContent)).toEqual(['Start over']);
  });
});
