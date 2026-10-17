import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiWfApiError, type UiWfAuditEntry, type UiWfRecord, type UiWorkflowApi } from './api';
import { UiWorkflowPanel, wfPanelPath, type UiWorkflowPanelLayout } from './panel';

const states = [
  { key: 'Draft', label: 'Draft', category: 'initial', tone: null },
  { key: 'Submitted', label: 'Submitted', category: 'active', tone: null },
  { key: 'Review', label: 'Under review', category: 'active', tone: null },
  { key: 'Approved', label: 'Approved', category: 'terminal', tone: 'success' },
  { key: 'Rejected', label: 'Rejected', category: 'terminal', tone: 'danger' },
];

function record(state: string, extra: Partial<UiWfRecord> = {}): UiWfRecord {
  return {
    entity: 'application', id: '1', title: 'A', lifecycle: 'review', lifecycleTitle: 'Review', state, stateLabel: states.find((s) => s.key === state)?.label ?? state,
    stateTone: null, status: 'active', stateEnteredAt: new Date().toISOString(), transitions: [], tasks: [], instances: [], manual: [], states, ...extra,
  };
}

let seq = 0;
function entry(action: string, after: string | null, before: string | null = null, data: Record<string, unknown> = {}, category = 'lifecycle'): UiWfAuditEntry {
  seq++;
  return {
    seq, id: `a${seq}`, at: new Date(2026, 9, 1, 9, seq).toISOString(), tenant: null, actorType: 'user', actorId: 'ali', actorName: 'Ali', category, action,
    subjectType: 'record', subjectId: '1', entity: 'application', entityId: '1', instanceId: 'i1', definitionId: 'd1',
    before: before ? JSON.stringify({ state: before }) : null, after: after ? JSON.stringify({ state: after }) : null, data: JSON.stringify(data),
    correlationId: 'c', causationId: null, prevHash: '', hash: '',
  };
}

const keys = (p: ReturnType<typeof wfPanelPath>) => p.steps.map((s) => s.key);

describe('wfPanelPath', () => {
  it('visited states first, then the ones not reached, in the lifecycle order', () => {
    const h = [entry('created', 'Draft'), entry('transitioned', 'Submitted', 'Draft', { label: 'Submit' })];
    const p = wfPanelPath(record('Submitted'), h);
    expect(keys(p)).toEqual(['Draft', 'Submitted', 'Review', 'Approved', 'Rejected']);
    expect(p.active).toBe(1);
  });

  it('puts each entry under the state it happened in, whatever order the history arrives in', () => {
    const created = entry('created', 'Draft');
    const moved = entry('transitioned', 'Submitted', 'Draft');
    const task = entry('created', null, null, { title: 'Check' }, 'task');
    const p = wfPanelPath(record('Submitted'), [moved, task, created]);
    expect(p.steps[0].entries.map((e) => e.id)).toEqual([created.id]);
    expect(p.steps[1].entries.map((e) => e.id)).toEqual([moved.id, task.id]);
  });

  it('a finished record shows only the path it took', () => {
    const h = [entry('created', 'Draft'), entry('transitioned', 'Submitted', 'Draft'), entry('transitioned', 'Rejected', 'Submitted')];
    const p = wfPanelPath(record('Rejected'), h);
    expect(keys(p)).toEqual(['Draft', 'Submitted', 'Rejected']);
    expect(p.active).toBe(2);
  });

  it('sent back: the record is active on the earlier state and the later one counts as not reached', () => {
    const h = [entry('created', 'Draft'), entry('transitioned', 'Submitted', 'Draft'), entry('transitioned', 'Draft', 'Submitted')];
    const p = wfPanelPath(record('Draft'), h);
    expect(keys(p).slice(0, 2)).toEqual(['Draft', 'Submitted']);
    expect(p.active).toBe(0);
    expect(p.steps[0].entries).toHaveLength(2);
  });

  it('a record without history yet starts at its current state', () => {
    const p = wfPanelPath(record('Draft'), []);
    expect(keys(p)).toEqual(['Draft', 'Submitted', 'Review', 'Approved', 'Rejected']);
    expect(p.active).toBe(0);
  });
});

function fakeApi(r: UiWfRecord, history: UiWfAuditEntry[]): UiWorkflowApi {
  return { record: async () => r, recordHistory: async () => history } as unknown as UiWorkflowApi;
}

@Component({
  imports: [UiWorkflowPanel],
  template: `<ui-workflow-panel entity="application" entityId="1" [layout]="layout()" [api]="api" [(open)]="open" />`,
})
class Host {
  layout = signal<UiWorkflowPanelLayout>('vertical');
  open = signal(false);
  api = fakeApi(record('Submitted'), [entry('created', 'Draft'), entry('transitioned', 'Submitted', 'Draft', { label: 'Submit' })]);
}

/** jsdom's PointerEvent drops pointerType, which the panel reads to tell a mouse from a finger. */
function pointer(type: string, pointerType: 'mouse' | 'touch'): Event {
  const e = new Event(type);
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  return e;
}

// jsdom has no ResizeObserver; the remarks box sizes itself with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

/** Lets a test hold an API call open and finish it later. */
function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  return { promise: new Promise<T>((r) => (resolve = r)), resolve };
}

describe('UiWorkflowPanel', () => {
  async function render(layout: UiWorkflowPanelLayout) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.layout.set(layout);
    fixture.detectChanges();
    // The fake API answers in a microtask; let it land, then render.
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('vertical: every state with its history, the current one marked', async () => {
    const { el } = await render('vertical');
    const steps = [...el.querySelectorAll('ui-stepper li.step')];
    expect(steps.map((s) => s.querySelector('.label')?.textContent?.trim())).toEqual(['Draft', 'Submitted', 'Under review', 'Approved', 'Rejected']);
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(steps[0].classList.contains('done')).toBe(true);
    expect(steps[1].textContent).toContain('Submit: Draft → Submitted');
    expect(steps[3].textContent).toContain('Not reached yet');
  });

  it('the current state offers this person\'s moves; with none it says so', async () => {
    const { el } = await render('vertical');
    expect(el.textContent).toContain('Nothing for you to do here right now.');
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.api = fakeApi(
      record('Submitted', { transitions: [{ key: 'start', label: 'Start review', to: 'Review', toLabel: 'Under review', tone: 'primary', confirm: null, form: null }] }),
      [entry('created', 'Draft'), entry('transitioned', 'Submitted', 'Draft')],
    );
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    const active = (fixture.nativeElement as HTMLElement).querySelector('li.step.active')!;
    expect(active.querySelector('ui-button')?.textContent?.trim()).toBe('Start review');
    expect(active.textContent).not.toContain('Nothing for you to do');
  });

  it('side drawer: a rail of dots; a mouse hover opens it, a finger does not', async () => {
    const { fixture, el } = await render('side-drawer');
    const rail = el.querySelector<HTMLButtonElement>('.rail')!;
    expect(rail.querySelectorAll('.step').length).toBe(5);
    expect(rail.getAttribute('aria-label')).toBe('Workflow: Submitted, step 2 of 5. Open');

    rail.dispatchEvent(pointer('pointerenter', 'touch'));
    expect(fixture.componentInstance.open()).toBe(false);

    rail.dispatchEvent(pointer('pointerenter', 'mouse'));
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('a tap or click on the rail opens the drawer, and again closes it', async () => {
    const { fixture, el } = await render('side-drawer');
    const rail = el.querySelector<HTMLButtonElement>('.rail')!;
    rail.click();
    expect(fixture.componentInstance.open()).toBe(true);
    fixture.detectChanges();
    expect(rail.getAttribute('aria-expanded')).toBe('true');
    rail.click();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('a hover-opened drawer closes when the pointer leaves, but not while it is inside', async () => {
    const { fixture, el } = await render('bottom-drawer');
    const rail = el.querySelector<HTMLButtonElement>('.rail')!;
    rail.dispatchEvent(pointer('pointerenter', 'mouse'));
    rail.dispatchEvent(pointer('pointerleave', 'mouse'));
    await new Promise((r) => setTimeout(r, 350));
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('offers the reset to those allowed: confirm first, then the engine starts the record over', async () => {
    const calls: unknown[] = [];
    const fixture = TestBed.createComponent(Host);
    const r = record('Review', { reset: { label: 'Start over', to: 'Draft', toLabel: 'Draft', confirm: 'Start this application over?', form: null } });
    fixture.componentInstance.api = {
      record: async () => r,
      recordHistory: async () => [entry('created', 'Draft'), entry('transitioned', 'Review', 'Draft')],
      resetRecord: async (...args: unknown[]) => { calls.push(args); return record('Draft'); },
    } as unknown as UiWorkflowApi;
    fixture.detectChanges();
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const btn = [...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Start over') as HTMLElement;
    expect(btn).toBeTruthy();
    expect(el.textContent).toContain('Back to “Draft”');
    btn.querySelector('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.textContent).toContain('Start this application over?');
    const confirm = [...document.body.querySelectorAll('ui-modal ui-button, .ui-layer ui-button')].find((b) => b.textContent?.trim() === 'Start over' && !el.contains(b)) as HTMLElement;
    confirm.querySelector('button')!.click();
    await new Promise((res) => setTimeout(res));
    expect(calls).toEqual([['application', '1', {}, undefined, undefined, undefined]]);
  });

  it('lists what the workflow did in the reset: ticked by default, changed-since unticked, messages locked, and sends the chosen ids', async () => {
    const calls: unknown[] = [];
    const fixture = TestBed.createComponent(Host);
    const reset = { label: 'Start over', to: 'Draft', toLabel: 'Draft', confirm: null, form: null };
    const item = (id: string, kind: string, title: string, undoable: boolean, selected: boolean, warning: string | null = null) =>
      ({ id, kind, title, detail: null, workflow: 'Application review', step: 'Assign', undoable, selected, warning });
    fixture.componentInstance.api = {
      record: async () => record('Review', { reset }),
      recordHistory: async () => [entry('created', 'Draft')],
      resetPreview: async () => ({ reset, items: [
        item('created:document:d9', 'created', 'Delete Document “Checklist”', true, true),
        item('field:programme:p1:budget', 'field', 'Budget of Programme “Engineering”: back to 50000', true, false, 'Changed again since the workflow set it to 60000; ticking it overwrites that.'),
        item('message:s3', 'message', 'Message to Ali', false, false, 'Already sent; it can\'t be taken back.'),
      ] }),
      resetRecord: async (...args: unknown[]) => { calls.push(args); return record('Draft'); },
    } as unknown as UiWorkflowApi;
    fixture.detectChanges();
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Start over') as HTMLElement).querySelector('button')!.click();
    fixture.detectChanges();
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    await fixture.whenStable();
    // ngModel writes the ticks a tick later.
    fixture.detectChanges();
    await fixture.whenStable();
    const rows = [...document.body.querySelectorAll('.undo-list li')] as HTMLElement[];
    expect(rows.map((r) => r.querySelector('.undo-title')!.textContent!.trim())).toEqual([
      'Delete Document “Checklist”', 'Budget of Programme “Engineering”: back to 50000', 'Message to Ali',
    ]);
    const boxes = rows.map((r) => r.querySelector('input[type=checkbox]') as HTMLInputElement);
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false]);
    expect(boxes[2].disabled).toBe(true);
    expect(rows[1].textContent).toContain('Changed again since');
    // Keep the new document, put the budget back.
    boxes[0].click();
    boxes[1].click();
    fixture.detectChanges();
    const confirm = [...document.body.querySelectorAll('ui-modal ui-button, .ui-layer ui-button')].find((b) => b.textContent?.trim() === 'Start over' && !el.contains(b)) as HTMLElement;
    confirm.querySelector('button')!.click();
    await new Promise((res) => setTimeout(res));
    expect(calls).toEqual([['application', '1', {}, ['field:programme:p1:budget'], undefined, undefined]]);
  });

  async function open(fixture: ReturnType<typeof TestBed.createComponent<Host>>, label: string): Promise<HTMLElement> {
    fixture.detectChanges();
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    ([...el.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === label) as HTMLElement).querySelector('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return el;
  }
  const dialogButton = (el: HTMLElement, label: string) =>
    ([...document.body.querySelectorAll('ui-modal ui-button, .ui-layer ui-button')].find((b) => b.textContent?.trim() === label && !el.contains(b)) as HTMLElement).querySelector('button')!;
  const remarks = () => document.body.querySelector('ui-modal textarea, .ui-layer textarea') as HTMLTextAreaElement | null;

  it('a red move asks for optional remarks and sends them; a required one refuses to go without', async () => {
    const calls: unknown[] = [];
    const fixture = TestBed.createComponent(Host);
    const reject = { key: 'reject', label: 'Reject', to: 'Draft', toLabel: 'Draft', tone: 'danger', confirm: null, form: null };
    let comment: string | undefined = undefined;
    fixture.componentInstance.api = {
      record: async () => record('Review', { transitions: [{ ...reject, comment } as never] }),
      recordHistory: async () => [entry('created', 'Draft')],
      applyTransition: async (...args: unknown[]) => { calls.push(args); return record('Draft'); },
    } as unknown as UiWorkflowApi;
    let el = await open(fixture, 'Reject');
    expect(document.body.textContent).toContain('Remarks (optional)');
    const box = remarks()!;
    box.value = '  Missing transcript ';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    dialogButton(el, 'Reject').click();
    await new Promise((res) => setTimeout(res));
    expect(calls).toEqual([['application', '1', 'reject', {}, 'Missing transcript']]);

    // Required: nothing is sent until there are remarks.
    calls.length = 0;
    comment = 'required' as never;
    const again = TestBed.createComponent(Host);
    again.componentInstance.api = fixture.componentInstance.api;
    el = await open(again, 'Reject');
    expect(document.body.textContent).toContain('Remarks (required)');
    dialogButton(el, 'Reject').click();
    await new Promise((res) => setTimeout(res));
    again.detectChanges();
    expect(calls).toEqual([]);
    expect(document.body.textContent).toContain('Add remarks to explain this.');
  });

  it('a move that is not red, has no form and no setting goes straight through', async () => {
    const calls: unknown[] = [];
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.api = {
      record: async () => record('Draft', { transitions: [{ key: 'submit', label: 'Submit', to: 'Review', toLabel: 'Review', tone: 'primary', confirm: null, form: null }] }),
      recordHistory: async () => [entry('created', 'Draft')],
      applyTransition: async (...args: unknown[]) => { calls.push(args); return record('Review'); },
    } as unknown as UiWorkflowApi;
    await open(fixture, 'Submit');
    await new Promise((res) => setTimeout(res));
    expect(calls).toEqual([['application', '1', 'submit', {}, undefined]]);
  });

  it('the reset can\'t be confirmed while its list is loading, and sends remarks with it', async () => {
    const calls: unknown[] = [];
    const preview = deferred<unknown>();
    const fixture = TestBed.createComponent(Host);
    const reset = { label: 'Start over', to: 'Draft', toLabel: 'Draft', confirm: null, form: null };
    fixture.componentInstance.api = {
      record: async () => record('Review', { reset }),
      recordHistory: async () => [entry('created', 'Draft')],
      resetPreview: () => preview.promise,
      resetRecord: async (...args: unknown[]) => { calls.push(args); return record('Draft'); },
    } as unknown as UiWorkflowApi;
    const el = await open(fixture, 'Start over');
    expect(document.body.textContent).toContain('Looking up what the workflow did');
    expect(dialogButton(el, 'Start over').disabled).toBe(true);
    preview.resolve({ reset, token: 'tk1', items: [{ id: 'created:document:d9', kind: 'created', title: 'Delete Document “Checklist”', detail: null, workflow: 'W', step: 'S', undoable: true, selected: true, warning: null }] });
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialogButton(el, 'Start over').disabled).toBe(false);
    const box = remarks()!;
    box.value = 'Wrong programme';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    dialogButton(el, 'Start over').click();
    await new Promise((res) => setTimeout(res));
    // The list's token goes back with it, so a list that changed since fails instead of overwriting.
    expect(calls).toEqual([['application', '1', {}, ['created:document:d9'], 'Wrong programme', 'tk1']]);
  });

  it('after a stale list the reset reads it again and keeps what the person unticked', async () => {
    let reads = 0;
    const calls: unknown[] = [];
    const fixture = TestBed.createComponent(Host);
    const reset = { label: 'Start over', to: 'Draft', toLabel: 'Draft', confirm: null, form: null };
    const item = (id: string, title: string) => ({ id, kind: 'field', title, detail: null, workflow: 'W', step: 'S', undoable: true, selected: true, warning: null });
    fixture.componentInstance.api = {
      record: async () => record('Review', { reset }),
      recordHistory: async () => [entry('created', 'Draft')],
      resetPreview: async () => ({ reset, items: ++reads === 1 ? [item('a', 'Keep me'), item('b', 'Take back')] : [item('a', 'Keep me'), item('b', 'Take back'), item('c', 'New one')] }),
      resetRecord: async (...args: unknown[]) => {
        calls.push(args);
        if (calls.length === 1) throw new UiWfApiError(409, 'resetChanged', 'What the workflow did has changed.');
        return record('Draft');
      },
    } as unknown as UiWorkflowApi;
    const el = await open(fixture, 'Start over');
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = () => [...document.body.querySelectorAll('.undo-list li')] as HTMLElement[];
    (rows()[0].querySelector('input[type=checkbox]') as HTMLInputElement).click();
    fixture.detectChanges();
    dialogButton(el, 'Start over').click();
    await new Promise((res) => setTimeout(res));
    await new Promise((res) => setTimeout(res));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rows().map((r) => (r.querySelector('input[type=checkbox]') as HTMLInputElement).checked)).toEqual([false, true, true]);
    expect(document.body.textContent).toContain('What the workflow did has changed.');
    dialogButton(el, 'Start over').click();
    await new Promise((res) => setTimeout(res));
    expect(calls.at(-1)).toEqual(['application', '1', {}, ['b', 'c'], undefined, undefined]);
  });
});
