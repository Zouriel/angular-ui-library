import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { createWorkflow } from './definition';
import { WfResetEditor, WfWorkflowEditor } from './inspector';
import type { UiWfToken } from './definition';
import type { UiWfConditionGroup, UiWorkflowSchema } from './schema';
import { WfBuilderStore } from './store';

const schema: UiWorkflowSchema = {
  specVersion: 1,
  steps: [],
  registry: {
    specVersion: 1,
    entities: [
      { key: 'application', label: 'Application', fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'track', label: 'Type', type: 'enum', options: [{ value: 'passport', label: 'Passport' }, { value: 'visa', label: 'Visa' }] },
        { key: 'status', label: 'Status', type: 'enum', lifecycle: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
        { key: 'programme', label: 'Programme', type: 'relation', entity: 'programme' },
      ] },
      { key: 'programme', label: 'Programme', fields: [{ key: 'name', label: 'Name', type: 'text' }] },
    ],
  },
};

// jsdom has no ResizeObserver; the description box sizes itself with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

describe('WfWorkflowEditor: applies to', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [WfBuilderStore] });
    const store = TestBed.inject(WfBuilderStore);
    store.schema.set(schema);
    const def = createWorkflow('lifecycle', 'Passport application', 'application');
    store.load({ ...def, lifecycle: { ...def.lifecycle!, field: 'status' } });
    const fixture = TestBed.createComponent(WfWorkflowEditor);
    fixture.detectChanges();
    return { store, fixture, editor: fixture.componentInstance as unknown as { ownFieldTokens(): UiWfToken[]; setAppliesWhen(w: UiWfConditionGroup): void } };
  };

  it('offers only the record’s own fields, never the field the lifecycle controls or related records', () => {
    const { fixture, editor } = setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Applies to');
    expect(el.textContent).toContain('Every application that no other lifecycle on this field covers.');
    expect(editor.ownFieldTokens().map((t) => t.path)).toEqual(['entity.title', 'entity.track', 'entity.programme']);
  });

  it('stores the condition on the lifecycle and drops it when the last condition goes', () => {
    const { store, editor } = setup();
    const when: UiWfConditionGroup = { match: 'all', conditions: [{ ref: 'entity.track', op: 'eq', value: { const: 'passport' } }] };
    editor.setAppliesWhen(when);
    expect(store.def().lifecycle!.appliesWhen).toEqual(when);
    editor.setAppliesWhen({ match: 'all', conditions: [] });
    expect(store.def().lifecycle!.appliesWhen).toBeUndefined();
  });
});

describe('WfResetEditor: where it is offered and remarks', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [WfBuilderStore] });
    const store = TestBed.inject(WfBuilderStore);
    store.schema.set(schema);
    const def = createWorkflow('lifecycle', 'Life', 'application');
    store.load({
      ...def,
      lifecycle: {
        field: 'status',
        states: [
          { id: 'draft', key: 'draft', label: 'Draft', category: 'initial' }, { id: 'rev', key: 'rev', label: 'Review', category: 'active' },
          { id: 'done', key: 'done', label: 'Done', category: 'terminal' },
        ],
        transitions: [
          { id: 't1', key: 'submit', label: 'Submit', from: ['draft'], to: 'rev' }, { id: 't2', key: 'finish', label: 'Finish', from: ['rev'], to: 'done' },
          { id: 't3', key: 'back', label: 'Back', from: ['rev'], to: 'draft' },
        ],
        reset: { who: [] },
      },
    });
    const fixture = TestBed.createComponent(WfResetEditor);
    fixture.detectChanges();
    const editor = fixture.componentInstance as unknown as { setOffer(m: string): void; offerFrom(s: string): void; toggleState(id: string, on: boolean): void; fromState(): string };
    return { store, fixture, editor };
  };

  it('offers it everywhere by default, or from the first state after the start onwards, with the ticks adjustable', () => {
    const { store, fixture, editor } = setup();
    expect(store.def().lifecycle!.reset!.states).toBeUndefined();
    editor.setOffer('some');
    expect(store.def().lifecycle!.reset!.states).toEqual(['rev', 'done']);
    fixture.detectChanges();
    expect(editor.fromState()).toBe('rev');
    editor.offerFrom('done');
    expect(store.def().lifecycle!.reset!.states).toEqual(['done']);
    editor.toggleState('rev', true);
    expect(store.def().lifecycle!.reset!.states).toEqual(['rev', 'done']);
    editor.toggleState('done', false);
    expect(store.def().lifecycle!.reset!.states).toEqual(['rev']);
    expect(editor.fromState()).toBe('');
    editor.setOffer('');
    expect(store.def().lifecycle!.reset!.states).toBeUndefined();
  });

  it('shows the remarks setting, optional by default', () => {
    const { fixture } = setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Remarks');
    expect(el.textContent).toContain('Offer it');
  });
});
