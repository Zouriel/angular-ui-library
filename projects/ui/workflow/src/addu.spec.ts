import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiWfApiError, type UiWfAuditEntry, type UiWfRecord, type UiWorkflowApi } from './api';
import { createStep, createWorkflow, describeAssignees, insertStep } from './definition';
import { WfAssigneesEditor, WfCheckList } from './editors';
import { WfStateEditor, WfWorkflowEditor } from './inspector';
import { UiWorkflowPanel, type UiWorkflowPanelLayout } from './panel';
import { wfAuditActionLabel, wfDescribeHistory, wfErrorText } from './runtime-shared';
import type { UiWfAssignee, UiWfStep, UiWorkflowDefinition, UiWorkflowSchema } from './schema';
import { WfBuilderStore } from './store';
import { WfStepEditor } from './step-editors';

// jsdom has no ResizeObserver; text areas and the panel size themselves with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const registry: UiWorkflowSchema['registry'] = {
  specVersion: 1,
  entities: [{ key: 'application', label: 'Application', fields: [{ key: 'status', label: 'Status', type: 'enum', lifecycle: true, options: [{ value: 'a', label: 'A' }] }] }],
  roles: [{ key: 'head', label: 'Head of office' }, { key: 'clerk', label: 'Clerk' }],
  departments: [{ key: 'licensing', label: 'Licensing department' }],
  portals: [{ key: 'citizen', label: 'Citizen portal' }],
  queues: [{ key: 'front', label: 'Front desk queue' }],
  signals: [{ key: 'docsAsked', label: 'Documents requested', fields: [] }, { key: 'docsIn', label: 'Documents received', fields: [] }],
};
const schema: UiWorkflowSchema = { specVersion: 1, steps: [], registry };

function storeWith(def: UiWorkflowDefinition, reg = registry): WfBuilderStore {
  TestBed.configureTestingModule({ providers: [WfBuilderStore] });
  const store = TestBed.inject(WfBuilderStore);
  store.schema.set({ ...schema, registry: reg });
  store.load(def);
  return store;
}

const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('department, portal and queue assignees', () => {
  it('are offered after groups with the contract wording, and only when the registry lists any', () => {
    const f = TestBed.createComponent(WfAssigneesEditor);
    f.componentRef.setInput('registry', { ...registry, groups: [{ key: 'fin', label: 'Finance' }] });
    f.detectChanges();
    const labels = (f.componentInstance as unknown as { addOptions(): { label: string }[] }).addOptions().map((o) => o.label);
    const g = labels.indexOf('A group › Finance');
    expect(labels.slice(g, g + 4)).toEqual(['A group › Finance', 'A department › Licensing department', 'A portal › Citizen portal', 'A queue › Front desk queue']);
    f.componentRef.setInput('registry', { specVersion: 1, entities: [] });
    f.detectChanges();
    expect((f.componentInstance as unknown as { addOptions(): { label: string }[] }).addOptions().some((o) => /A (department|portal|queue)/.test(o.label))).toBe(false);
  });

  it('picking one emits exactly one key', () => {
    const f = TestBed.createComponent(WfAssigneesEditor);
    f.componentRef.setInput('registry', registry);
    f.detectChanges();
    const out: UiWfAssignee[][] = [];
    f.componentInstance.valueChange.subscribe((v) => out.push(v as UiWfAssignee[]));
    const add = (f.componentInstance as unknown as { add(v: string): void }).add.bind(f.componentInstance);
    add('department:licensing');
    add('portal:citizen');
    add('queue:front');
    expect(out.map((v) => v.at(-1))).toEqual([{ department: 'licensing' }, { portal: 'citizen' }, { queue: 'front' }]);
  });

  it('read as the label, falling back to the key', () => {
    const ctx = { registry, def: createWorkflow('automation', 'W', 'application') };
    expect(describeAssignees([{ department: 'licensing' }, { portal: 'citizen' }, { queue: 'front' }], ctx)).toBe('Licensing department, Citizen portal and Front desk queue');
    expect(describeAssignees([{ department: 'gone' }, { queue: 'old' }], ctx)).toBe('gone and old');
  });
});

describe('ui-wf-check-list', () => {
  it('reports the ticked values in option order and keeps a value no longer offered until it is unticked', () => {
    const f = TestBed.createComponent(WfCheckList);
    f.componentRef.setInput('options', [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]);
    f.componentRef.setInput('value', ['b', 'old']);
    f.detectChanges();
    expect(text(f.nativeElement)).toContain('old (not available)');
    const out: string[][] = [];
    f.componentInstance.valueChange.subscribe((v) => out.push(v));
    const c = f.componentInstance as unknown as { toggle(v: string, on: boolean): void };
    c.toggle('a', true);
    c.toggle('old', false);
    expect(out).toEqual([['a', 'b', 'old'], ['b']]);
  });
});

describe('approval: Separation of duties', () => {
  @Component({ imports: [WfStepEditor], template: `<ui-wf-step-editor [step]="step()" />` })
  class StepHost { step = input.required<UiWfStep>(); }

  function setup(reg = registry) {
    const def = insertStep(createWorkflow('automation', 'W', 'application'), 'root', 0, { ...createStep('approval'), id: 'ap' } as UiWfStep);
    const store = storeWith(def, reg);
    const f = TestBed.createComponent(StepHost);
    f.componentRef.setInput('step', store.steps().get('ap')!.step);
    f.detectChanges();
    const inner = f.debugElement.children[0].componentInstance as { setMakerChecker(p: Record<string, unknown>): void };
    // As in the builder, the editor is handed the changed step after every edit.
    const ed = { setMakerChecker(p: Record<string, unknown>) { inner.setMakerChecker(p); f.componentRef.setInput('step', store.steps().get('ap')!.step); f.detectChanges(); } };
    return { store, f, ed, step: () => store.steps().get('ap')!.step as unknown as Record<string, unknown> };
  }

  it('shows the section, its hint and the labels', () => {
    const { f } = setup();
    const t = text(f.nativeElement);
    for (const s of ['Separation of duties', 'Stops one person from both asking and approving.', 'The person who started it cannot approve', 'Whoever approved the step before cannot approve this one', 'Must hold the role']) expect(t).toContain(s);
  });

  it('writes the settings and removes the key (never {}) when all are off', () => {
    const { ed, step } = setup();
    expect('makerChecker' in step()).toBe(false);
    ed.setMakerChecker({ excludeInitiator: true });
    ed.setMakerChecker({ requiredRole: 'head' });
    expect(step()['makerChecker']).toEqual({ excludeInitiator: true, requiredRole: 'head' });
    ed.setMakerChecker({ excludeInitiator: undefined });
    ed.setMakerChecker({ requiredRole: '' });
    expect('makerChecker' in step()).toBe(false);
  });

  it('hides the role choice when the registry has no roles', () => {
    const { f } = setup({ ...registry, roles: [] });
    expect(text(f.nativeElement)).not.toContain('Must hold the role');
  });
});

describe('state inspector: pausing the time limit', () => {
  function setup(reg = registry) {
    const def = createWorkflow('lifecycle', 'L', 'application');
    const lc = { ...def.lifecycle!, field: 'status', states: [
      { id: 's1', key: 'a', label: 'Open', category: 'initial' as const },
      { id: 's2', key: 'b', label: 'Waiting', category: 'active' as const },
      { id: 's3', key: 'c', label: 'Done', category: 'terminal' as const },
    ], transitions: [] };
    const store = storeWith({ ...def, lifecycle: lc }, reg);
    store.selection.set({ kind: 'state', id: 's1' });
    const f = TestBed.createComponent(WfStateEditor);
    f.detectChanges();
    const ed = f.componentInstance as unknown as { setSla(k: string, l: string[]): void };
    const sla = () => store.def().lifecycle!.states[0].sla as Record<string, unknown> | undefined;
    return { store, f, ed, sla };
  }

  it('shows the three controls and the hint only when the state has a time limit', () => {
    const { store, f, ed } = setup();
    expect(text(f.nativeElement)).not.toContain('Pause the clock');
    store.updateState('s1', (s) => ({ ...s, sla: { within: 'P2D', steps: [] } }));
    f.detectChanges();
    const t = text(f.nativeElement);
    for (const s of ['Pause the clock while the record is in', 'Pause the clock when', 'Start it again when', 'Time spent paused does not count towards the limit.']) expect(t).toContain(s);
    expect(ed).toBeTruthy();
  });

  it('lists the other states only, writes the lists and removes an emptied one (no [])', () => {
    const { store, f, ed, sla } = setup();
    store.updateState('s1', (s) => ({ ...s, sla: { within: 'P2D', steps: [] } }));
    f.detectChanges();
    const first = f.nativeElement.querySelector('ui-wf-check-list') as HTMLElement;
    expect(text(first)).toContain('Waiting');
    expect(text(first)).not.toContain('Open');
    ed.setSla('pauseOnStatus', ['s2']);
    ed.setSla('pauseOnEvent', ['docsAsked']);
    ed.setSla('resumeOnEvent', ['docsIn']);
    expect(sla()).toEqual({ within: 'P2D', steps: [], pauseOnStatus: ['s2'], pauseOnEvent: ['docsAsked'], resumeOnEvent: ['docsIn'] });
    ed.setSla('pauseOnEvent', []);
    expect('pauseOnEvent' in sla()!).toBe(false);
  });

  it('hides the signal lists when the registry has no signals', () => {
    const { store, f } = setup({ ...registry, signals: [] });
    store.updateState('s1', (s) => ({ ...s, sla: { within: 'P2D', steps: [] } }));
    f.detectChanges();
    const t = text(f.nativeElement);
    expect(t).toContain('Pause the clock while the record is in');
    expect(t).not.toContain('Start it again when');
  });
});

describe('workflow settings: Public processing time', () => {
  function setup(kind: 'automation' | 'lifecycle') {
    const store = storeWith(createWorkflow(kind, 'W', 'application'));
    const f = TestBed.createComponent(WfWorkflowEditor);
    f.detectChanges();
    const ed = f.componentInstance as unknown as { setPublicTime(p: Record<string, unknown>): void };
    return { store, f, ed };
  }

  it('is in the settings of both kinds, with the contract wording', () => {
    const { f } = setup('automation');
    const t = text(f.nativeElement);
    for (const s of ['Public processing time', 'What people are told', 'Show this to the public', 'Shown to people outside the office, for example on the service page. It does not change any time limit.']) expect(t).toContain(s);
    expect((f.nativeElement.querySelector('ui-input[placeholder="e.g. 5 working days"]'))).not.toBeNull();
  });

  it('is in a lifecycle\'s settings too', () => {
    expect(text(setup('lifecycle').f.nativeElement)).toContain('Public processing time');
  });

  it('writes estimate and display, and removes the key when blank and off', () => {
    const { store, ed } = setup('lifecycle');
    ed.setPublicTime({ estimate: '5 working days' });
    expect(store.def().publicProcessingTime).toEqual({ estimate: '5 working days', display: false });
    ed.setPublicTime({ display: true });
    expect(store.def().publicProcessingTime).toEqual({ estimate: '5 working days', display: true });
    ed.setPublicTime({ estimate: '' });
    ed.setPublicTime({ display: false });
    expect('publicProcessingTime' in store.def()).toBe(false);
    expect(JSON.stringify(store.def())).not.toContain('publicProcessingTime');
  });

  it('keeps a switched-on blank estimate (the engine reports it) and caps the text at 200 characters', () => {
    const { store, ed } = setup('automation');
    ed.setPublicTime({ display: true });
    expect(store.def().publicProcessingTime).toEqual({ estimate: '', display: true });
    ed.setPublicTime({ estimate: 'x'.repeat(250) });
    expect(store.def().publicProcessingTime!.estimate).toHaveLength(200);
  });
});

describe('record panel: Usual processing time', () => {
  const rec = (extra: Partial<UiWfRecord> = {}): UiWfRecord => ({
    entity: 'application', id: '1', title: 'A', lifecycle: 'l', lifecycleTitle: 'L', state: 'a', stateLabel: 'Open', stateTone: null, status: 'active',
    stateEnteredAt: new Date().toISOString(), transitions: [], tasks: [], instances: [], manual: [], states: [{ key: 'a', label: 'Open', category: 'initial', tone: null }], ...extra,
  });

  @Component({ imports: [UiWorkflowPanel], template: `<ui-workflow-panel entity="application" entityId="1" [layout]="layout" [api]="api" />` })
  class Host { layout: UiWorkflowPanelLayout = 'vertical'; api!: UiWorkflowApi; }

  async function render(r: UiWfRecord, layout: string): Promise<string> {
    const f = TestBed.createComponent(Host);
    f.componentInstance.layout = layout as UiWorkflowPanelLayout;
    f.componentInstance.api = { record: async () => r, recordHistory: async () => [] } as unknown as UiWorkflowApi;
    f.detectChanges();
    await new Promise((res) => setTimeout(res));
    f.detectChanges();
    await f.whenStable();
    return text(f.nativeElement);
  }

  it('shows the line in every layout when the record view carries the estimate', async () => {
    for (const layout of ['vertical', 'horizontal', 'compact']) expect(await render(rec({ publicProcessingTime: '5 working days' }), layout)).toContain('Usual processing time: 5 working days');
  });

  it('shows nothing when the field is absent', async () => {
    for (const layout of ['vertical', 'compact']) expect(await render(rec(), layout)).not.toContain('Usual processing time');
  });
});

describe('audit: paused and resumed time limits', () => {
  const entry = (action: string, data: Record<string, unknown>): UiWfAuditEntry => ({
    seq: 1, id: 'a', at: '2026-01-01T00:00:00Z', tenant: null, actorType: 'system', actorId: null, actorName: null, category: 'lifecycle', action, subjectType: 'record', subjectId: '1',
    entity: 'application', entityId: '1', instanceId: 'i', definitionId: 'd', before: null, after: null, data: JSON.stringify(data), correlationId: 'c', causationId: null, prevHash: '', hash: '',
  });
  const label = (k: unknown) => (k === 'waiting' ? 'Waiting' : String(k));

  it('labels the actions', () => {
    expect(wfAuditActionLabel('lifecycle', 'slaPaused')).toBe('Time limit paused');
    expect(wfAuditActionLabel('lifecycle', 'slaResumed')).toBe('Time limit running again');
  });

  it('reads as a sentence naming the state', () => {
    expect(wfDescribeHistory(entry('slaPaused', { state: 'waiting', reason: 'event', signal: 'docsAsked' }), label)).toBe('Time limit paused in Waiting');
    expect(wfDescribeHistory(entry('slaResumed', { state: 'waiting', reason: 'status', due: '2026-01-05T00:00:00Z' }), label)).toBe('Time limit running again in Waiting');
  });
});

describe('segregationOfDuties errors', () => {
  it('show the engine\'s own message', () => {
    const msg = 'You cannot approve this: the person who started it cannot approve it.';
    expect(wfErrorText(new UiWfApiError(403, 'segregationOfDuties', msg), 'The decision could not be saved.')).toBe(msg);
  });
});
