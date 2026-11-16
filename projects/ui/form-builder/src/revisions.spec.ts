import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiFbRevisionPanel } from './builder-revisions';
import { fbCreateRevision, rollbackDefinition, UiFbMemoryRevisionStore, type UiFbRevisionStore } from './revisions';
import type { UiFbElement, UiFbField, UiFbGroup, UiFormDefinition } from './schema';

const f = (id: string, extra: Partial<UiFbField> = {}): UiFbField => ({ kind: 'field', id, type: 'text', key: id, label: id.toUpperCase(), ...extra });
const form = (pages: UiFbElement[][], extra: Partial<UiFormDefinition> = {}): UiFormDefinition => ({
  schemaVersion: 2, id: 'form1', title: 'T', revision: 1, pages: pages.map((elements, i) => ({ id: 'p' + (i + 1), elements })), ...extra,
});
const sel = (id: string, values: string[], extra: Partial<UiFbField> = {}) =>
  f(id, { type: 'select', options: values.map((v) => ({ id: 'o_' + v, value: v, label: v })), ...extra });
const flat = (d: UiFormDefinition) => d.pages.flatMap((p) => p.elements);

describe('fbCreateRevision', () => {
  it('snapshots a deep copy with a diff and a default summary', () => {
    const v1 = form([[f('a')]], { revision: 1 });
    const v2 = form([[f('a'), f('b')]], { revision: 2 });
    const r = fbCreateRevision(v2, v1, { publishedBy: 'Aisha' });
    expect(r.formId).toBe('form1');
    expect(r.revision).toBe(2);
    expect(r.publishedBy).toBe('Aisha');
    expect(r.diff?.added).toEqual(['b']);
    expect(r.summary).toContain('Added');
    v2.pages[0].elements.pop();
    expect(r.definition.pages[0].elements.length).toBe(2);
    expect(fbCreateRevision(v1).summary).toBe('First version');
    expect(fbCreateRevision(v1).diff).toBeUndefined();
  });
});

describe('UiFbMemoryRevisionStore', () => {
  it('lists newest first, gets, and replaces the same revision', () => {
    const s = new UiFbMemoryRevisionStore();
    s.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 1 })));
    s.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 2 })));
    s.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 3 })));
    expect(s.listRevisions('form1').map((r) => r.revision)).toEqual([3, 2, 1]);
    expect(s.getRevision('form1', 2)?.revision).toBe(2);
    expect(s.getRevision('form1', 9)).toBeNull();
    s.saveRevision({ ...fbCreateRevision(form([[f('a')]], { revision: 2 })), summary: 'edited' });
    expect(s.listRevisions('form1').length).toBe(3);
    expect(s.getRevision('form1', 2)?.summary).toBe('edited');
    expect(s.revisions('other')()).toEqual([]);
    s.clear('form1');
    expect(s.all().length).toBe(0);
  });

  it('rolls back to a draft that keeps the current revision number', () => {
    const s = new UiFbMemoryRevisionStore();
    s.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 1 })));
    const draft = s.rollback('form1', 1, form([[f('a'), f('b')]], { revision: 4 }));
    expect(draft.revision).toBe(4);
    expect(draft.id).toBe('form1');
  });

  it('uses the latest revision as the current one when none is given, and throws for a missing one', () => {
    const s = new UiFbMemoryRevisionStore();
    s.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 1 })));
    s.saveRevision(fbCreateRevision(form([[f('a'), f('b')]], { revision: 2 })));
    const draft = s.rollback('form1', 1);
    expect(draft.revision).toBe(2);
    expect(flat(draft).map((e) => [e.id, e.archived])).toEqual([['a', undefined], ['b', true]]);
    expect(() => s.rollback('form1', 7)).toThrowError(/Version 7/);
  });

  it('persists to localStorage and loads it back', () => {
    const key = 'zui-test-revisions';
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
    const a = new UiFbMemoryRevisionStore({ storageKey: key });
    a.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 1 })));
    expect(new UiFbMemoryRevisionStore({ storageKey: key }).listRevisions('form1').length).toBe(1);
    a.clear();
    expect(new UiFbMemoryRevisionStore({ storageKey: key }).listRevisions('form1').length).toBe(0);
    mem.set(key, "{not json");
    expect(new UiFbMemoryRevisionStore({ storageKey: key }).all()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('still works when localStorage is missing or full', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
    const s = new UiFbMemoryRevisionStore({ storageKey: 'k' });
    s.saveRevision(fbCreateRevision(form([[f('a')]], { revision: 1 })));
    expect(s.listRevisions('form1').length).toBe(1);
    vi.unstubAllGlobals();
  });
});

describe('rollbackDefinition', () => {
  it('keeps the current id and revision', () => {
    const out = rollbackDefinition(form([[f('a')]], { id: 'old', revision: 1 }), form([[f('a')]], { id: 'cur', revision: 5 }));
    expect([out.id, out.revision]).toEqual(['cur', 5]);
  });

  it('archives a field added since, on its page, or on the last page when its page is gone', () => {
    const target = form([[f('a')]]);
    const current = form([[f('a'), f('b')], [f('c')]]);
    const out = rollbackDefinition(target, current);
    expect(out.pages.length).toBe(1);
    expect(out.pages[0].elements.map((e) => [e.id, e.archived ?? false])).toEqual([['a', false], ['b', true], ['c', true]]);
    const two = rollbackDefinition(form([[f('a')], [f('z')]]), current);
    expect(two.pages[0].elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(two.pages[1].elements.map((e) => e.id)).toEqual(['z', 'c']);
  });

  it('archives a section added since, with its children, and puts a new child back inside an existing section', () => {
    const g0: UiFbGroup = { kind: 'group', id: 'g', key: 'g', elements: [f('x')] };
    const gNew: UiFbGroup = { kind: 'group', id: 'gn', key: 'gn', elements: [f('y')] };
    const out = rollbackDefinition(form([[g0]]), form([[{ ...g0, elements: [f('x'), f('x2')] }, gNew]]));
    const els = flat(out);
    const g = els[0] as UiFbGroup;
    expect(g.elements.map((e) => [e.id, e.archived ?? false])).toEqual([['x', false], ['x2', true]]);
    const added = els[1] as UiFbGroup;
    expect(added.archived).toBe(true);
    expect((added.elements[0] as UiFbField).archived).toBe(true);
  });

  it('keeps options added since, archived', () => {
    const out = rollbackDefinition(form([[sel('s', ['a', 'b'])]]), form([[sel('s', ['a', 'b', 'c'])]]));
    const opts = (flat(out)[0] as UiFbField).options!;
    expect(opts.map((o) => [o.value, o.archived ?? false])).toEqual([['a', false], ['b', false], ['c', true]]);
  });

  it('merges key history when a key was renamed, never including its own key', () => {
    const target = form([[f('a', { key: 'old_name', keyHistory: ['older'] })]]);
    const current = form([[f('a', { key: 'new_name', keyHistory: ['old_name', 'mid'] })]]);
    const out = rollbackDefinition(target, current);
    const a = flat(out)[0] as UiFbField;
    expect(a.key).toBe('old_name');
    expect(a.keyHistory).toEqual(['older', 'mid', 'new_name']);
  });

  it('brings back what was archived in the current draft', () => {
    const out = rollbackDefinition(form([[f('a')]]), form([[f('a', { archived: true })]]));
    expect(flat(out)[0].archived).toBeUndefined();
  });

  it('never changes its inputs', () => {
    const target = form([[f('a', { key: 'k1' })]]);
    const current = form([[f('a', { key: 'k2' }), sel('s', ['x'])]]);
    const t = JSON.stringify(target);
    const c = JSON.stringify(current);
    rollbackDefinition(target, current);
    expect(JSON.stringify(target)).toBe(t);
    expect(JSON.stringify(current)).toBe(c);
  });
});

@Component({
  imports: [UiFbRevisionPanel],
  template: `<ui-fb-revisions [store]="store()" [formId]="formId()" [current]="current" (restore)="got.set($event)" />`,
})
class Host {
  store = signal<UiFbRevisionStore>(new UiFbMemoryRevisionStore());
  formId = signal('form1');
  current = form([[f('a'), f('b')]], { revision: 3 });
  got = signal<UiFormDefinition | null>(null);
}

describe('UiFbRevisionPanel', () => {
  const seed = () => {
    const s = new UiFbMemoryRevisionStore();
    const v1 = form([[f('a')]], { revision: 1 });
    const v2 = form([[f('a'), f('b')]], { revision: 2 });
    s.saveRevision(fbCreateRevision(v1));
    s.saveRevision(fbCreateRevision(v2, v1, { publishedBy: 'Aisha' }));
    return s;
  };
  const text = (fx: { nativeElement: HTMLElement }) => fx.nativeElement.textContent ?? '';
  const flush = async (fx: { whenStable(): Promise<unknown>; detectChanges(): void }) => { fx.detectChanges(); await fx.whenStable(); fx.detectChanges(); };

  it('shows an empty state, then the versions newest first', async () => {
    const fx = TestBed.createComponent(Host);
    await flush(fx);
    expect(text(fx)).toContain('Nothing has been published yet');
    fx.componentInstance.store.set(seed());
    await flush(fx);
    const heads = [...fx.nativeElement.querySelectorAll('.head strong')].map((e: Element) => e.textContent!.trim());
    expect(heads).toEqual(['Version 2', 'Version 1']);
    expect(text(fx)).toContain('Aisha');
  });

  it('shows what changed and the comparison with the draft', async () => {
    const fx = TestBed.createComponent(Host);
    fx.componentInstance.store.set(seed());
    await flush(fx);
    const buttons = () => [...fx.nativeElement.querySelectorAll('ui-button button')] as HTMLButtonElement[];
    buttons().find((b) => b.textContent!.includes('What changed'))!.click();
    await flush(fx);
    expect(text(fx)).toContain('Added');
    buttons().find((b) => b.textContent!.includes('Compare with draft'))!.click();
    await flush(fx);
    expect(text(fx)).toContain('since version');
  });

  it('restores after a confirmation and emits the new draft', async () => {
    const fx = TestBed.createComponent(Host);
    fx.componentInstance.store.set(seed());
    await flush(fx);
    const restore = [...fx.nativeElement.querySelectorAll('ui-button button')].filter((b) => (b as HTMLElement).textContent!.trim() === 'Restore')[1] as HTMLButtonElement;
    restore.click();
    await flush(fx);
    const confirm = [...document.querySelectorAll('ui-button button')].find((b) => b.textContent!.includes('Restore this version')) as HTMLButtonElement;
    expect(confirm).toBeTruthy();
    confirm.click();
    await flush(fx);
    const draft = fx.componentInstance.got()!;
    expect(draft.revision).toBe(3);
    expect(flat(draft).map((e) => [e.id, e.archived ?? false])).toEqual([['a', false], ['b', true]]);
  });

  it('handles an async store and its failure', async () => {
    const fx = TestBed.createComponent(Host);
    const inner = seed();
    fx.componentInstance.store.set({ ...inner, listRevisions: async (id) => inner.listRevisions(id), getRevision: async () => null, saveRevision: async () => {}, rollback: async () => form([[]]) });
    await flush(fx);
    expect(text(fx)).toContain('Version 2');
    fx.componentInstance.store.set({ listRevisions: () => Promise.reject(new Error('offline')), getRevision: () => null, saveRevision: () => {}, rollback: () => form([[]]) });
    await flush(fx);
    expect(text(fx)).toContain('offline');
    fx.componentInstance.formId.set('x');
    await flush(fx);
    expect(text(fx)).toContain('offline');
  });
});
