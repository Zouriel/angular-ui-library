import { describe, expect, it } from 'vitest';
import { createWorkflow } from './definition';
import { WfBuilderStore } from './store';

describe('WfBuilderStore', () => {
  const fresh = () => {
    const s = new WfBuilderStore();
    s.load(createWorkflow('automation', 'Test', 'application'));
    return s;
  };

  it('undoes and redoes edits', () => {
    const s = fresh();
    const id = s.addStep('notify', 'root', 0);
    expect(s.canUndo()).toBe(true);
    s.undo();
    expect(s.def().steps).toEqual([]);
    expect(s.selection()).toBeNull(); // the added step is gone, so is its selection
    s.redo();
    expect(s.def().steps!.map((x) => x.id)).toEqual([id]);
    expect(s.canRedo()).toBe(false);
  });

  it('merges quick edits with the same key into one undo step', () => {
    const s = fresh();
    s.patch({ title: 'A' }, 'title');
    s.patch({ title: 'AB' }, 'title');
    s.patch({ title: 'ABC' }, 'title');
    s.undo();
    expect(s.def().title).toBe('Test');
    expect(s.canUndo()).toBe(false);
  });

  it('a new edit clears redo', () => {
    const s = fresh();
    s.patch({ title: 'A' });
    s.undo();
    s.patch({ title: 'B' });
    expect(s.canRedo()).toBe(false);
  });

  it('removing keys with undefined and replacing with a function', () => {
    const s = fresh();
    const id = s.addStep('notify', 'root', 0);
    s.updateStep(id, { title: 'Hello' });
    expect(s.selectedStep()?.title).toBe('Hello');
    s.updateStep(id, { title: undefined });
    expect('title' in s.selectedStep()!).toBe(false);
    s.updateStep(id, (st) => ({ ...st, disabled: true }));
    expect(s.selectedStep()?.disabled).toBe(true);
  });

  it('deleting the selected step, state or transition clears the selection', () => {
    const s = fresh();
    const id = s.addStep('wait', 'root', 0);
    s.removeStep(id);
    expect(s.selection()).toBeNull();

    s.load(createWorkflow('lifecycle', 'Life', 'application'));
    const st = s.addState('Review');
    expect(s.selection()).toEqual({ kind: 'state', id: st });
    s.removeState(st);
    expect(s.selection()).toBeNull();
    const [a, b] = s.def().lifecycle!.states;
    const t = s.addTransition(a.id, b.id);
    s.removeTransition(t);
    expect(s.selection()).toBeNull();
  });

  it('new states get unique keys and transitions are named after their target', () => {
    const s = fresh();
    s.load(createWorkflow('lifecycle', 'Life', 'application'));
    s.addState('Review');
    s.addState('Review');
    expect(s.def().lifecycle!.states.map((x) => x.key)).toEqual(['Draft', 'Done', 'Review', 'Review 2']);
    const [a, b] = s.def().lifecycle!.states;
    const t = s.addTransition(a.id, b.id);
    expect(s.selectedTransition()?.label).toBe('To Done');
    expect(s.selectedTransition()?.id).toBe(t);
  });

  it('dragging a state stores its place; tidying forgets it', () => {
    const s = fresh();
    s.load(createWorkflow('lifecycle', 'Life', 'application'));
    const [a] = s.def().lifecycle!.states;
    s.placeState(a.id, 10.4, 20.6);
    expect(s.def().lifecycle!.layout).toEqual({ [a.id]: [10, 21] });
    s.tidyLayout();
    expect(s.def().lifecycle!.layout).toBeUndefined();
  });

  it('loading another workflow clears history; echoing the same one keeps it', () => {
    const s = fresh();
    s.patch({ title: 'X' });
    s.load({ ...s.def() });
    expect(s.canUndo()).toBe(true);
    s.load(createWorkflow('automation'));
    expect(s.canUndo()).toBe(false);
  });

  it('ignores every edit while read-only', () => {
    const s = fresh();
    s.readOnly.set(true);
    const before = s.def();
    s.addStep('notify', 'root', 0);
    s.patch({ title: 'Changed' });
    expect(s.def()).toBe(before);
    expect(s.canUndo()).toBe(false);
  });

  it('a move that changes nothing is not an edit', () => {
    const s = fresh();
    const a = s.addStep('notify', 'root', 0);
    s.addStep('notify', 'root', 1);
    const before = s.def();
    expect(s.moveStep(a, 'root', 1)).toBe(false);
    expect(s.def()).toBe(before);
    expect(s.moveStep(a, 'root', 2)).toBe(true);
  });
});
