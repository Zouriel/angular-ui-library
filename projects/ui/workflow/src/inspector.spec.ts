import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { createWorkflow } from './definition';
import { WfWorkflowEditor } from './inspector';
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
    expect(el.textContent).toContain('Every application.');
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
