import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiWfAuditEntry, UiWfRecord, UiWorkflowApi } from './api';
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
});
