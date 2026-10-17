import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiWorkflowApi } from './api';
import { WfBuilderUi } from './canvas';
import { createStep, createWorkflow, insertStep } from './definition';
import { WfDnd } from './dnd';
import { WfInspector, WfResetEditor, WfStateEditor, WfTransitionEditor } from './inspector';
import { WfLifecycleCanvas, WfLifecycleRuns } from './lifecycle';
import type { UiWfStep, UiWorkflowDefinition, UiWorkflowSchema } from './schema';
import { WfStepEditor } from './step-editors';
import { WfBuilderStore } from './store';
import { UiWorkflowBuilder } from './workflow-builder';

// jsdom has no ResizeObserver; the builder and the text boxes measure themselves with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const schema: UiWorkflowSchema = {
  specVersion: 1,
  steps: [],
  registry: {
    specVersion: 1,
    entities: [
      { key: 'application', label: 'Application', fields: [
        { key: 'title', label: 'Title', type: 'text', settable: true },
        { key: 'status', label: 'Status', type: 'enum', lifecycle: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
        { key: 'documents', label: 'Documents', type: 'collection', entity: 'document' },
      ] },
      { key: 'document', label: 'Document', fields: [{ key: 'verified', label: 'Verified', type: 'boolean', settable: true }] },
    ],
  },
} as UiWorkflowSchema;

function life(): UiWorkflowDefinition {
  const d = createWorkflow('lifecycle', 'Life', 'application');
  return {
    ...d,
    lifecycle: {
      field: 'status',
      states: [
        { id: 'draft', key: 'draft', label: 'Draft', category: 'initial' }, { id: 'sub', key: 'sub', label: 'Submitted', category: 'active' },
        { id: 'rev', key: 'rev', label: 'Review', category: 'active' }, { id: 'done', key: 'done', label: 'Done', category: 'terminal' },
      ],
      transitions: [
        { id: 't1', key: 'submit', label: 'Submit', from: ['draft'], to: 'sub', who: [], input: { form: { schemaVersion: 1, id: 'f', title: 'F', pages: [{ id: 'p', elements: [{ kind: 'field', id: 'e', type: 'text', key: 'why', label: 'Why' }] }] } } },
        { id: 't2', key: 'start', label: 'Start', from: ['sub'], to: 'rev', who: [] },
        { id: 't3', key: 'finish', label: 'Finish', from: ['rev'], to: 'done', who: [] },
        { id: 't4', key: 'more', label: 'Ask for more', from: ['rev'], to: 'rev', who: [] },
      ],
      reset: { who: [], states: ['sub', 'rev', 'done'] },
    },
  } as UiWorkflowDefinition;
}

function storeWith(def: UiWorkflowDefinition): WfBuilderStore {
  TestBed.configureTestingModule({ providers: [WfBuilderStore, WfBuilderUi, WfDnd] });
  const store = TestBed.inject(WfBuilderStore);
  store.schema.set(schema);
  store.load(def);
  return store;
}

@Component({ imports: [WfStepEditor], template: `<ui-wf-step-editor [step]="step()" />` })
class StepHost {
  step = input.required<UiWfStep>();
}

function editStep(store: WfBuilderStore, id: string) {
  const f = TestBed.createComponent(StepHost);
  f.componentRef.setInput('step', store.steps().get(id)!.step);
  f.detectChanges();
  return f;
}

describe('Update record inside a For each', () => {
  function withLoop(target?: string): { store: WfBuilderStore; def: UiWorkflowDefinition } {
    let def: UiWorkflowDefinition = createWorkflow('automation', 'Docs', 'application');
    def = insertStep(def, 'root', 0, { ...createStep('forEach'), id: 'loop', collection: 'entity.documents' } as UiWfStep);
    const set = { ...createStep('setFields'), id: 'set', ...(target ? { target } : {}), values: [{ field: 'verified', value: { const: true } }] } as UiWfStep;
    def = insertStep(def, 'loop/each', 0, set);
    def = insertStep(def, 'root', 1, { ...set, id: 'outside' } as UiWfStep);
    return { store: storeWith(def), def };
  }

  it('offers the current item, and a loaded item target shows as such with its fields', () => {
    const { store } = withLoop('item');
    const f = editStep(store, 'set');
    const el = f.nativeElement as HTMLElement;
    const select = el.querySelector('select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent?.trim())).toContain('Current document (each item of the For each)');
    expect(select.options[select.selectedIndex].value).toBe('item');
    // The item's own settable fields are offered.
    expect([...el.querySelectorAll('.assign select option')].map((o) => o.textContent?.trim())).toContain('Verified');
  });

  it('outside a For each, a loaded item target is kept (values too) and explained', () => {
    const { store } = withLoop('item');
    const before = JSON.stringify(store.def());
    const f = editStep(store, 'outside');
    const el = f.nativeElement as HTMLElement;
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(select.options[select.selectedIndex].textContent?.trim()).toBe('Current item (needs a For each around this step)');
    expect(el.textContent).toContain('isn’t inside a For each');
    expect(JSON.stringify(store.def())).toBe(before);
  });

  it('choosing the item sets target "item" and starts the fields again', () => {
    const { store } = withLoop();
    const f = editStep(store, 'set');
    const select = (f.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    select.value = 'item';
    select.dispatchEvent(new Event('change'));
    expect(store.steps().get('set')!.step).toMatchObject({ target: 'item', values: [] });
  });
});

describe('Webhook body box', () => {
  function webhooks(): WfBuilderStore {
    let def: UiWorkflowDefinition = createWorkflow('automation', 'Hooks', 'application');
    def = insertStep(def, 'root', 0, { ...createStep('webhook'), id: 'w1' } as UiWfStep);
    def = insertStep(def, 'root', 1, { ...createStep('webhook'), id: 'w2', body: { a: 1 } } as UiWfStep);
    return storeWith(def);
  }
  const type = (f: { nativeElement: HTMLElement; detectChanges(): void }, text: string) => {
    const box = f.nativeElement.querySelector('ui-textarea textarea') as HTMLTextAreaElement;
    box.value = text;
    box.dispatchEvent(new Event('input'));
    f.detectChanges();
    return box;
  };

  it('keeps what is typed as typed while it is valid JSON, and saves it', async () => {
    const store = webhooks();
    const f = editStep(store, 'w1');
    type(f, '{"id": 1');
    f.componentRef.setInput('step', store.steps().get('w1')!.step);
    f.detectChanges();
    const box = type(f, '{"id": 1}');
    f.componentRef.setInput('step', store.steps().get('w1')!.step);
    for (let i = 0; i < 2; i++) { f.detectChanges(); await f.whenStable(); }
    expect(box.value).toBe('{"id": 1}');
    // Leaving the box tidies it.
    box.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    for (let i = 0; i < 2; i++) { f.detectChanges(); await f.whenStable(); }
    expect(box.value).toBe('{\n  "id": 1\n}');
    expect((store.steps().get('w1')!.step as { body?: unknown }).body).toEqual({ id: 1 });
  });

  it('an invalid body belongs to its step: the next step does not say it is invalid', async () => {
    const store = webhooks();
    const f = editStep(store, 'w1');
    type(f, '{"id":');
    expect((f.nativeElement as HTMLElement).textContent).toContain('That isn’t valid JSON yet.');
    f.componentRef.setInput('step', store.steps().get('w2')!.step);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('That isn’t valid JSON yet.');
    expect((el.querySelector('ui-textarea textarea') as HTMLTextAreaElement).value).toContain('"a": 1');
  });
});

describe('Move lifecycle step', () => {
  it('has a remarks template, stored as comment (left out when empty)', () => {
    let def: UiWorkflowDefinition = createWorkflow('automation', 'Move', 'application');
    def = insertStep(def, 'root', 0, { ...createStep('applyTransition'), id: 'mv' } as UiWfStep);
    const store = storeWith(def);
    const f = editStep(store, 'mv');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Remarks (optional)');
    const ed = f.debugElement.children[0].componentInstance as { patch(p: Record<string, unknown>, k?: string): void; templateOrNothing(t: unknown): unknown };
    ed.patch({ comment: ed.templateOrNothing(['Score ', { ref: 'entity.title' }]) });
    expect(store.steps().get('mv')!.step).toMatchObject({ comment: ['Score ', { ref: 'entity.title' }] });
    ed.patch({ comment: ed.templateOrNothing('') });
    expect('comment' in store.steps().get('mv')!.step).toBe(false);
  });
});

describe('Lifecycle editors', () => {
  it('making a state the start is one undo step', () => {
    const store = storeWith(life());
    store.selection.set({ kind: 'state', id: 'sub' });
    const f = TestBed.createComponent(WfStateEditor);
    f.detectChanges();
    (f.componentInstance as unknown as { setCategory(c: string): void }).setCategory('initial');
    const cats = () => store.def().lifecycle!.states.map((s) => s.category);
    expect(cats()).toEqual(['active', 'initial', 'active', 'terminal']);
    store.undo();
    expect(cats()).toEqual(['initial', 'active', 'active', 'terminal']);
  });

  it('"Back to" works the offered states out again when they were "from a state onwards", and says when ticks match no state', () => {
    const store = storeWith(life());
    store.selection.set({ kind: 'reset' });
    const f = TestBed.createComponent(WfResetEditor);
    f.detectChanges();
    const ed = f.componentInstance as unknown as { setBackTo(v: string): void; toggleState(id: string, on: boolean): void };
    // From Submitted onwards; going back to Review instead of the start stops the walk before Review.
    ed.setBackTo('rev');
    expect(store.def().lifecycle!.reset).toMatchObject({ to: 'rev', states: ['sub'] });
    store.undo();
    expect(store.def().lifecycle!.reset!.states).toEqual(['sub', 'rev', 'done']);
    ed.toggleState('done', false);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('aren’t one state and the ones after it');
  });

  it('checks before a move and automatic moves don\'t offer form answers, remarks or who moved it', () => {
    const store = storeWith(life());
    store.selection.set({ kind: 'transition', id: 't1' });
    const f = TestBed.createComponent(WfTransitionEditor);
    f.detectChanges();
    const ed = f.componentInstance as unknown as { tokens(): { path: string }[]; checkTokens(): { path: string }[] };
    expect(ed.tokens().map((t) => t.path)).toEqual(expect.arrayContaining(['input.why', 'trigger.comment', 'trigger.actor']));
    const check = ed.checkTokens().map((t) => t.path);
    expect(check).not.toContain('input.why');
    expect(check).not.toContain('trigger.comment');
    expect(check).not.toContain('trigger.actor');
    expect(check).toContain('entity.title');
  });

  it('the starting state can run steps on leaving too', () => {
    const store = storeWith(life());
    store.selection.set({ kind: 'state', id: 'draft' });
    const f = TestBed.createComponent(WfLifecycleRuns);
    f.detectChanges();
    expect((f.componentInstance as unknown as { lists(): { label: string }[] }).lists().map((l) => l.label)).toEqual(['On entering', 'On leaving']);
  });

  it('draws a move back to the same state as a loop with its label, and says where a restricted reset is offered', () => {
    const store = storeWith(life());
    const f = TestBed.createComponent(WfLifecycleCanvas);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.edge-label')].map((b) => b.textContent?.trim())).toContain('Ask for more');
    expect(el.querySelector('.anychip.reset')?.textContent).toContain('from 3 states');
    expect(el.querySelector('.any .wf-label')?.textContent?.trim()).toBe('Starting over');
    expect(store.def().lifecycle!.layout).toBeUndefined();
  });
});

describe('Inspector in the phone sheet', () => {
  @Component({ imports: [WfInspector], template: `<ui-wf-inspector [showHead]="false" (deleteRequest)="deleted = deleted + 1" />` })
  class SheetHost { deleted = 0; }

  it('keeps Delete for states, transitions and the reset, and the way back up for their steps', () => {
    const def = life();
    def.lifecycle!.transitions[1] = { ...def.lifecycle!.transitions[1], steps: [{ ...createStep('notify'), id: 'n1' }] };
    const store = storeWith(def);
    const f = TestBed.createComponent(SheetHost);
    for (const sel of [{ kind: 'state', id: 'rev' }, { kind: 'transition', id: 't2' }, { kind: 'reset' }] as const) {
      store.selection.set(sel);
      f.detectChanges();
      const del = [...(f.nativeElement as HTMLElement).querySelectorAll('.sheet-bar ui-button')].find((b) => b.textContent?.trim() === 'Delete') as HTMLElement;
      expect(del).toBeTruthy();
      del.querySelector('button')!.click();
    }
    expect(f.componentInstance.deleted).toBe(3);
    store.selection.set({ kind: 'step', id: 'n1' });
    f.detectChanges();
    const back = (f.nativeElement as HTMLElement).querySelector('.sheet-bar .back') as HTMLButtonElement;
    expect(back.textContent?.trim()).toBe('‹ Start');
    back.click();
    expect(store.selection()).toEqual({ kind: 'transition', id: 't2' });
  });
});

describe('View-only builder', () => {
  async function render(api?: Partial<UiWorkflowApi>) {
    const f = TestBed.createComponent(UiWorkflowBuilder);
    f.componentRef.setInput('definition', life());
    f.componentRef.setInput('schema', schema);
    f.componentRef.setInput('readOnly', true);
    if (api) { f.componentRef.setInput('api', api as UiWorkflowApi); f.componentRef.setInput('persist', true); }
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    const store = f.debugElement.injector.get(WfBuilderStore);
    return { f, store, el: f.nativeElement as HTMLElement };
  }
  const key = (el: HTMLElement, k: string, mod = false) => {
    const e = new KeyboardEvent('keydown', { key: k, ctrlKey: mod, bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e;
  };

  it('Delete asks nothing and deletes nothing; Ctrl+S saves nothing and is left to the browser', async () => {
    let saves = 0;
    const { f, store, el } = await render({
      schema: async () => schema, definitions: async () => [], me: async () => ({ can: { edit: false } }) as never,
      saveDraft: async () => { saves++; }, createDefinition: async () => { saves++; },
    } as unknown as Partial<UiWorkflowApi>);
    store.selection.set({ kind: 'state', id: 'rev' });
    f.detectChanges();
    const del = key(el, 'Delete');
    f.detectChanges();
    expect(del.defaultPrevented).toBe(false);
    expect(document.body.textContent).not.toContain('Delete “Review”?');
    expect(store.def().lifecycle!.states).toHaveLength(4);
    const save = key(el, 's', true);
    await f.whenStable();
    expect(save.defaultPrevented).toBe(false);
    expect(saves).toBe(0);
  });

  it('a drag starts nothing and announces nothing', async () => {
    const { f } = await render();
    const dnd = f.debugElement.injector.get(WfDnd);
    const e = new Event('pointerdown') as PointerEvent;
    Object.defineProperties(e, { button: { value: 0 }, clientX: { value: 0 }, clientY: { value: 0 }, pointerId: { value: 1 } });
    dnd.begin({ kind: 'new', type: 'notify', label: 'Notify', icon: [] as never }, e, { immediate: true });
    expect(dnd.drag()).toBeNull();
    expect(dnd.announcement()).toBe('');
  });
});

describe('Adding from the palette', () => {
  it('adds to the end of the selected transition\'s steps, not the start', () => {
    const def = life();
    def.lifecycle!.transitions[1] = { ...def.lifecycle!.transitions[1], steps: [{ ...createStep('notify'), id: 'n1' }] };
    const f = TestBed.createComponent(UiWorkflowBuilder);
    f.componentRef.setInput('definition', def);
    f.componentRef.setInput('schema', schema);
    f.componentRef.setInput('readOnly', false);
    f.detectChanges();
    const store = f.debugElement.injector.get(WfBuilderStore);
    store.selection.set({ kind: 'transition', id: 't2' });
    (f.componentInstance as unknown as { addFromPalette(t: string): void }).addFromPalette('notify');
    const steps = store.def().lifecycle!.transitions[1].steps!;
    expect(steps[0].id).toBe('n1');
    expect(steps).toHaveLength(2);
  });
});
