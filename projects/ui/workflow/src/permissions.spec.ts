import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiWfDefinitionSummary, UiWfMe, UiWfPermissionChange, UiWorkflowApi } from './api';
import { createStep } from './definition';
import { UiWorkflowPermissions, emptyWhoText, permissionRows, sameWho } from './permissions';
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
      { id: 't4', key: 'archive', label: 'Archive', from: ['a'], to: 'd', hidden: true, who: [{ role: 'head' }] },
    ],
    reset: { label: 'Start over', who: [{ role: 'head' }] },
  },
} as unknown as UiWorkflowDefinition;

const automation: UiWorkflowDefinition = {
  specVersion: 1, id: 'wf_a', key: 'pay', kind: 'automation', title: 'Pay', entity: 'application',
  trigger: { type: 'manual', label: 'Pay now', who: [{ role: 'finance' }] }, steps: [task],
} as unknown as UiWorkflowDefinition;

describe('permissionRows', () => {
  it('lists moves, the reset, the start button and people steps, skipping hidden moves but not automatic ones', () => {
    const rows = permissionRows(lifecycle);
    expect(rows.map((r) => [r.node, r.kind, r.label, r.detail])).toEqual([
      ['t1', 'transition', 'Submit', 'Draft → Submitted'],
      ['t2', 'transition', 'Approve', 'Submitted → Approved'],
      // The engine offers an automatic move to the people in its `who`; a hidden one never.
      ['t3', 'transition', 'Expire', 'Submitted → Draft'],
      ['reset', 'reset', 'Start over', 'Back to Draft'],
      ['ap', 'step', 'Finance sign-off', 'Approval'],
    ]);
    expect(permissionRows(automation).map((r) => [r.node, r.label, r.who])).toEqual([
      ['trigger', '“Pay now” button', [{ role: 'finance' }]],
      ['tk', 'Task', []],
    ]);
  });

  it('compares "who" lists as sets, ignoring order and key order', () => {
    expect(sameWho([{ role: 'a' }, { user: 'u' }], [{ user: 'u' }, { role: 'a' }])).toBe(true);
    expect(sameWho([{ managerOf: 'initiator' } as never], [{ managerOf: 'initiator' } as never])).toBe(true);
    expect(sameWho([{ role: 'a' }], [{ role: 'b' }])).toBe(false);
    expect(sameWho([{ role: 'a' }, { role: 'a' }], [{ role: 'a' }, { role: 'b' }])).toBe(false);
  });
});

function summary(def: UiWorkflowDefinition, version = 1): UiWfDefinitionSummary {
  return { id: def.id, key: def.key, kind: def.kind, title: def.title, entity: def.entity ?? null, status: 'published', version, hasDraftChanges: false, updatedAt: '', updatedBy: null, runningInstances: 0 };
}

interface FakeOptions {
  /** Fail `definition(id)` once this many calls have been made (to simulate a failed reload). */
  failDefinitionAfter?: number;
  /** The published version the server reports for every workflow (another admin can bump it). */
  version?: { value: number };
  users?: Record<string, string>;
  /** Overrides the lifecycle fixture. */
  lifecycleDef?: UiWorkflowDefinition;
  /** Extra fields of the engine's answer to a permissions change. */
  saved?: { changed?: boolean; draftSkipped?: string[]; recordsMoved?: number };
}

function fakeApi(canPublish: boolean, o: FakeOptions = {}) {
  const calls: { id: string; changes: UiWfPermissionChange[]; note?: string }[] = [];
  const version = o.version ?? { value: 1 };
  const lc = o.lifecycleDef ?? lifecycle;
  let definitionCalls = 0;
  const userCalls: string[] = [];
  const api = {
    definitions: async () => [summary(lc, version.value), summary(automation, version.value)],
    definition: async (id: string) => {
      definitionCalls++;
      if (o.failDefinitionAfter !== undefined && definitionCalls > o.failDefinitionAfter) throw new Error('offline');
      const def = id === lc.id ? lc : automation;
      return { summary: summary(def, version.value), draft: def, published: def, versions: [], problems: [] };
    },
    schema: async () => ({ specVersion: 1, registry: { entities: [], roles: [{ key: 'head', label: 'Head of office' }, { key: 'finance', label: 'Finance' }] }, steps: [] }),
    me: async (): Promise<UiWfMe> => ({ type: 'user', id: 'u', name: 'U', roles: [], can: { edit: canPublish, publish: canPublish, settings: false, intervene: false, audit: false } }),
    user: async (id: string) => { userCalls.push(id); return o.users?.[id] ? { id, name: o.users[id] } : null; },
    updatePermissions: async (id: string, changes: UiWfPermissionChange[], note?: string) => {
      calls.push({ id, changes, note });
      await new Promise((r) => setTimeout(r, 5));
      if (o.saved?.changed !== false) version.value++;
      return { ...summary(lc, version.value), ...o.saved };
    },
  } as unknown as UiWorkflowApi;
  return { api, calls, definitionCalls: () => definitionCalls, userCalls };
}

async function render(canPublish: boolean, o: FakeOptions = {}) {
  const fake = fakeApi(canPublish, o);
  const f = TestBed.createComponent(UiWorkflowPermissions);
  f.componentRef.setInput('api', fake.api);
  f.detectChanges();
  const cmp = f.componentInstance as unknown as Record<string, any>;
  // Loading is plain promises, which whenStable doesn't wait for in a zoneless test.
  for (let i = 0; i < 50 && (cmp['loading']() || !cmp['workflows']().length); i++) await new Promise((r) => setTimeout(r, 2));
  await settle(f);
  const el = f.nativeElement as HTMLElement;
  return { f, el, cmp, ...fake };
}

async function settle(f: { whenStable(): Promise<unknown>; detectChanges(): void }) {
  for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r, 5)); await f.whenStable(); f.detectChanges(); }
}

const wf = (cmp: Record<string, any>, id: string) => cmp['workflows']().find((x: { summary: { id: string } }) => x.summary.id === id);
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('ui-button')].find((b) => b.textContent?.includes(text))?.querySelector('button') ?? null;

describe('UiWorkflowPermissions', () => {
  it('shows each published workflow with its rows', async () => {
    const { el } = await render(true);
    const titles = [...el.querySelectorAll('h3')].map((h) => h.textContent?.trim());
    expect(titles).toEqual(['Pay', 'Scholarship review']);
    expect(el.querySelectorAll('.row')).toHaveLength(7);
    expect(el.querySelectorAll('ui-wf-assignees')).toHaveLength(7);
  });

  it('saves only the changed rows, once, with the note, and says which version is in use', async () => {
    const { f, el, calls, cmp } = await render(true);
    const w = cmp['workflows']().find((x: { summary: { id: string } }) => x.summary.id === 'wf_l');
    const submit = w.rows[0];
    cmp['edit'](w, submit, [{ role: 'head' }]);
    cmp['setNote'](w, 'Only the head submits for now');
    f.detectChanges();
    expect(el.querySelector('.row.changed .label')?.textContent).toBe('Submit');
    const saveBtn = button(el, 'Save 1 change')!;
    saveBtn.click();
    saveBtn.click(); // a double click saves once
    await settle(f);
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

  it('search keeps rows with unsaved edits, so every counted change stays visible', async () => {
    const { f, el, cmp } = await render(true);
    const w = wf(cmp, 'wf_l');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    cmp['query'].set('start over');
    f.detectChanges();
    expect([...el.querySelectorAll('.row .label')].map((x) => x.textContent)).toEqual(['Submit', 'Start over']);
    expect(el.textContent).toContain('Save 1 change');
  });

  it('reordering chips is not a change', async () => {
    const { f, el, cmp } = await render(true);
    const w = wf(cmp, 'wf_l');
    const r = { ...w.rows[0], who: [{ role: 'head' }, { initiator: true }] };
    cmp['workflows'].update((list: any[]) => list.map((x) => (x.summary.id === 'wf_l' ? { ...x, rows: [r, ...x.rows.slice(1)] } : x)));
    cmp['edit'](wf(cmp, 'wf_l'), r, [{ initiator: true }, { role: 'head' }]);
    f.detectChanges();
    expect(el.textContent).not.toContain('Save');
  });

  it('Undo drops the edits and the note', async () => {
    const { f, el, cmp } = await render(true);
    const w = wf(cmp, 'wf_l');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    cmp['setNote'](w, 'old reason');
    f.detectChanges();
    button(el, 'Undo')!.click();
    f.detectChanges();
    expect(cmp['notes']()['wf_l']).toBe('');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    f.detectChanges();
    expect(cmp['notes']()['wf_l'] ?? '').toBe('');
  });

  it('once saved, a failed reload keeps it saved: no error, no second publish, a note to reload', async () => {
    // Loading makes 2 definition calls, the pre-save check a 3rd; the reload after saving fails.
    const { f, el, calls, cmp } = await render(true, { failDefinitionAfter: 3 });
    const w = wf(cmp, 'wf_l');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    f.detectChanges();
    button(el, 'Save 1 change')!.click();
    await settle(f);
    expect(calls).toHaveLength(1);
    expect(el.textContent).not.toContain('Saving failed');
    expect(el.textContent).not.toContain('Save 1 change');
    expect(el.textContent).toContain('Saved: version 2 is now in use.');
    expect(el.textContent).toContain('reload to see the latest');
    // The row shows what was saved, as published.
    expect(wf(cmp, 'wf_l').rows[0].who).toEqual([{ role: 'head' }]);
    expect(wf(cmp, 'wf_l').summary.version).toBe(2);
    expect(el.querySelector('.row.changed')).toBeNull();
  });

  it('does not overwrite a version someone else published since the page loaded', async () => {
    const version = { value: 1 };
    const { f, el, calls, cmp } = await render(true, { version });
    const w = wf(cmp, 'wf_l');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    f.detectChanges();
    version.value = 5; // another admin published
    button(el, 'Save 1 change')!.click();
    await settle(f);
    expect(calls).toEqual([]);
    expect(el.textContent).toContain('Someone changed these permissions since you opened the page');
    button(el, 'Reload')!.click();
    await settle(f);
    expect(el.textContent).not.toContain('Someone changed these permissions');
    expect(wf(cmp, 'wf_l').summary.version).toBe(5);
    expect(el.textContent).not.toContain('Save 1 change');
  });

  it('will not save an approval or task with nobody to decide it, and says why', async () => {
    const { f, el, calls, cmp } = await render(true);
    const w = wf(cmp, 'wf_l');
    const ap = w.rows.find((r: { node: string }) => r.node === 'ap');
    cmp['edit'](w, ap, []);
    f.detectChanges();
    expect(el.textContent).toContain('Add someone to “Finance sign-off”');
    const save = button(el, 'Save 1 change')!;
    expect(save.disabled).toBe(true);
    await cmp['save'](w);
    expect(calls).toEqual([]);
  });

  it('says what an empty "who" means for each kind of row', async () => {
    const empty: UiWorkflowDefinition = {
      ...lifecycle,
      lifecycle: { ...lifecycle.lifecycle!, transitions: [{ ...lifecycle.lifecycle!.transitions[0], who: [] }], reset: { label: 'Start over', who: [] } },
    } as UiWorkflowDefinition;
    const auto = { ...automation, trigger: { type: 'manual', label: 'Pay now', who: [] } } as unknown as UiWorkflowDefinition;
    const { el } = await render(false, { lifecycleDef: empty });
    const read = [...el.querySelectorAll('.read')].map((r) => r.textContent?.trim());
    expect(read).toContain('Nobody by hand: only automatically, or from other workflows.');
    expect(read).toContain('Nobody.');
    expect(read).toContain('Nobody yet.'); // the task with no assignees
    expect(permissionRows(auto)[0].who).toEqual([]);
    expect(emptyWhoText('trigger')).toBe('Anyone who can see the record.');
    const { el: edit } = await render(true, { lifecycleDef: empty });
    const hints = [...edit.querySelectorAll('ui-wf-assignees .wf-hint')].map((h) => h.textContent?.trim());
    expect(hints).toContain('Nobody by hand: only automatically, or from other workflows.');
    expect(hints).toContain('Nobody.');
    expect(hints.some((h) => h?.startsWith('Nobody yet: add the people who decide.'))).toBe(true);
  });

  it('shows the start button with nobody chosen as open to anyone', async () => {
    const auto = { ...automation, trigger: { type: 'manual', label: 'Pay now', who: [] } } as unknown as UiWorkflowDefinition;
    const { f, cmp, el } = await render(false);
    cmp['workflows'].update((list: any[]) => list.map((x) => (x.summary.id === 'wf_a' ? { ...x, def: auto, rows: permissionRows(auto) } : x)));
    f.detectChanges();
    expect([...el.querySelectorAll('.read')].map((r) => r.textContent?.trim())).toContain('Anyone who can see the record.');
  });

  it('read-only rows name people, not user ids', async () => {
    const withUser = { ...lifecycle, lifecycle: { ...lifecycle.lifecycle!, reset: { label: 'Start over', who: [{ user: 'u7' }, { role: 'head' }] } } } as UiWorkflowDefinition;
    const { f, el, userCalls } = await render(false, { lifecycleDef: withUser, users: { u7: 'Ana Lee' } });
    await settle(f);
    expect([...el.querySelectorAll('.read')].map((r) => r.textContent?.trim())).toContain('Ana Lee and Head of office');
    expect(userCalls).toEqual(['u7']);
  });

  it('without an API it says so instead of claiming nothing is published', async () => {
    const f = TestBed.createComponent(UiWorkflowPermissions);
    f.detectChanges();
    await settle(f);
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No workflow API is connected');
    expect(text).not.toContain('No published workflow');
  });

  it('uses the library search field', async () => {
    const { el } = await render(true);
    expect(el.querySelector('ui-search-input input[type="search"]')?.getAttribute('aria-label')).toBe('Find a workflow or step');
  });

  it('says how many existing records follow the new version, and which moves the draft no longer has', async () => {
    const { f, el, cmp } = await render(true, { saved: { recordsMoved: 3, draftSkipped: ['t1'] } });
    const w = wf(cmp, 'wf_l');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    f.detectChanges();
    button(el, 'Save 1 change')!.click();
    await settle(f);
    expect(el.textContent).toContain('Saved: version 2 is now in use, and 3 existing records follow it.');
    expect(el.textContent).toContain('Your draft no longer has “Submit”, so the draft kept it as before.');
  });

  it('says so when the engine found nothing to change', async () => {
    const { f, el, cmp } = await render(true, { saved: { changed: false } });
    const w = wf(cmp, 'wf_l');
    cmp['edit'](w, w.rows[0], [{ role: 'head' }]);
    f.detectChanges();
    button(el, 'Save 1 change')!.click();
    await settle(f);
    expect(el.textContent).toContain('Nothing changed: version 1 stays in use.');
  });
});
