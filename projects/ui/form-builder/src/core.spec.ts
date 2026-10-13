import { describeCondition, evaluateCondition, type UiFbConditionContext } from './conditions';
import { evaluateCalc, type UiFbCalcContext } from './calc';
import {
  createDefinition,
  createField,
  createGroup,
  diffDefinitions,
  duplicateElement,
  externalReferences,
  fbSlug,
  findCycles,
  indexDefinition,
  insertElement,
  lintDefinition,
  moveElement,
  removeReferences,
  renameKey,
  uniqueKey,
} from './definition';
import type { UiFbField, UiFbGroup, UiFormDefinition } from './schema';

function ctx(values: Record<string, unknown>, extra: Partial<UiFbConditionContext> = {}): UiFbConditionContext {
  return {
    value: (r) => values[r],
    visible: () => true,
    complete: () => true,
    rows: () => 0,
    today: () => '2026-10-11',
    ...extra,
  };
}

describe('conditions', () => {
  it('compares text without caring about case or surrounding spaces', () => {
    expect(evaluateCondition({ ref: 'a', op: 'eq', value: { const: 'Married' } }, ctx({ a: ' married ' }))).toBe(true);
    expect(evaluateCondition({ ref: 'a', op: 'contains', value: { const: 'GMAIL' } }, ctx({ a: 'x@gmail.com' }))).toBe(true);
  });

  it('compares numbers as numbers, not text', () => {
    expect(evaluateCondition({ ref: 'n', op: 'gt', value: { const: 9 } }, ctx({ n: 10 }))).toBe(true);
    expect(evaluateCondition({ ref: 'n', op: 'gt', value: { const: '9' } }, ctx({ n: '10' }))).toBe(true);
    expect(evaluateCondition({ ref: 'n', op: 'between', value: { const: 1 }, value2: { const: 10 } }, ctx({ n: 10 }))).toBe(true);
  });

  it('never matches an unfinished rule, so a half-built rule hides nothing by accident', () => {
    expect(evaluateCondition({ ref: 'n', op: 'gt' }, ctx({ n: 10 }))).toBe(false);
  });

  it('handles choice lists and multi-select answers', () => {
    expect(evaluateCondition({ ref: 'c', op: 'anyOf', value: { const: ['uk', 'us'] } }, ctx({ c: 'us' }))).toBe(true);
    expect(evaluateCondition({ ref: 'm', op: 'includesAll', value: { const: ['a', 'b'] } }, ctx({ m: ['b', 'a', 'c'] }))).toBe(true);
    expect(evaluateCondition({ ref: 'm', op: 'countGte', value: { const: 3 } }, ctx({ m: ['a', 'b'] }))).toBe(false);
  });

  it('compares dates against today', () => {
    expect(evaluateCondition({ ref: 'd', op: 'before', value: { today: 0 } }, ctx({ d: '2026-10-10' }))).toBe(true);
    expect(evaluateCondition({ ref: 'd', op: 'after', value: { today: 30 } }, ctx({ d: '2026-10-20' }))).toBe(false);
  });

  it('can compare one answer with another', () => {
    expect(evaluateCondition({ ref: 'end', op: 'after', value: { ref: 'start' } }, ctx({ start: '2026-01-01', end: '2026-02-01' }))).toBe(true);
  });

  it('combines all / any / none', () => {
    const c = ctx({ a: 1, b: 2 });
    const yes = { ref: 'a', op: 'eq' as const, value: { const: 1 } };
    const no = { ref: 'b', op: 'eq' as const, value: { const: 9 } };
    expect(evaluateCondition({ match: 'all', conditions: [yes, no] }, c)).toBe(false);
    expect(evaluateCondition({ match: 'any', conditions: [yes, no] }, c)).toBe(true);
    expect(evaluateCondition({ match: 'none', conditions: [no] }, c)).toBe(true);
    expect(evaluateCondition({ match: 'all', conditions: [] }, c)).toBe(true);
  });

  it('describes a rule in plain words', () => {
    const text = describeCondition(
      { match: 'all', conditions: [{ ref: 'c', op: 'anyOf', value: { const: ['uk', 'us'] } }, { ref: 'age', op: 'gte', value: { const: 18 } }] },
      { name: (r) => (r === 'c' ? 'Country' : 'Age'), value: (r, v) => (r === 'c' ? String(v).toUpperCase() : String(v)) },
    );
    expect(text).toBe('“Country” is any of UK or US and “Age” is at least 18');
  });
});

describe('calculations', () => {
  const cctx = (values: Record<string, unknown[]>, rows: Record<string, number> = {}): UiFbCalcContext => ({
    values: (r) => values[r] ?? [],
    rows: (r) => rows[r] ?? null,
    today: () => '2026-10-11',
  });

  it('adds up every entry of a repeating section', () => {
    expect(evaluateCalc({ op: 'sum', args: [{ ref: 'price' }, { const: 5 }] }, cctx({ price: [10, 2.5, '3'] }))).toBe(20.5);
  });

  it('multiplies and rounds', () => {
    expect(evaluateCalc({ op: 'multiply', args: [{ ref: 'q' }, { ref: 'p' }], decimals: 2 }, cctx({ q: [3], p: [0.333] }))).toBe(1);
  });

  it('is empty until there is something to work with', () => {
    expect(evaluateCalc({ op: 'sum', args: [{ ref: 'x' }] }, cctx({ x: [null] }))).toBeNull();
    expect(evaluateCalc({ op: 'divide', args: [{ ref: 'a' }, { ref: 'b' }] }, cctx({ a: [1], b: [0] }))).toBeNull();
  });

  it('works out age in whole years', () => {
    expect(evaluateCalc({ op: 'ageYears', args: [{ ref: 'dob' }] }, cctx({ dob: ['2000-10-12'] }))).toBe(25);
    expect(evaluateCalc({ op: 'ageYears', args: [{ ref: 'dob' }] }, cctx({ dob: ['2000-10-11'] }))).toBe(26);
  });

  it('counts ticked options and entries', () => {
    expect(evaluateCalc({ op: 'count', args: [{ ref: 'm' }, { ref: 'kids' }] }, cctx({ m: [['a', 'b']] }, { kids: 3 }))).toBe(5);
  });
});

describe('definition editing', () => {
  function form(): { def: UiFormDefinition; a: UiFbField; b: UiFbField; g: UiFbGroup } {
    let def = createDefinition('Test');
    const a = createField('text', def, 'First name');
    def = insertElement(def, a, { containerId: def.pages[0].id, index: 0 });
    const b = createField('number', def, 'Age');
    def = insertElement(def, b, { containerId: def.pages[0].id, index: 1 });
    const g = createGroup(def);
    def = insertElement(def, g, { containerId: def.pages[0].id, index: 2 });
    return { def, a, b, g };
  }

  it('makes keys from labels', () => {
    expect(fbSlug('First name (legal)')).toBe('first_name_legal');
    expect(fbSlug('2nd line')).toBe('f_2nd_line');
    expect(fbSlug('Café')).toBe('cafe');
  });

  it('keeps keys unique within the same data object', () => {
    const { def } = form();
    expect(uniqueKey(def, 'first_name', null)).toBe('first_name_2');
  });

  it('moves an element into a group and back, adjusting for its own removal', () => {
    const { def, a, g } = form();
    const inGroup = moveElement(def, a.id, { containerId: g.id, index: 0 });
    expect((inGroup.pages[0].elements.find((e) => e.id === g.id) as UiFbGroup).elements[0].id).toBe(a.id);
    const back = moveElement(inGroup, a.id, { containerId: def.pages[0].id, index: 2 });
    expect(back.pages[0].elements.map((e) => e.id)).toEqual([indexDefinition(def).get(def.pages[0].elements[1].id)!.id, g.id, a.id]);
  });

  it('refuses to drop a group into itself', () => {
    const { def, g } = form();
    expect(moveElement(def, g.id, { containerId: g.id, index: 0 })).toBe(def);
  });

  it('duplicates a group with fresh ids, unique keys and its internal rules following the copy', () => {
    let { def, a, b, g } = form();
    def = moveElement(def, a.id, { containerId: g.id, index: 0 });
    def = moveElement(def, b.id, { containerId: g.id, index: 1 });
    // "Age" only shows when "First name" (inside the same group) is filled in.
    def = {
      ...def,
      pages: def.pages.map((p) => ({
        ...p,
        elements: p.elements.map((e) => e.kind === 'group'
          ? { ...e, elements: e.elements.map((x) => x.id === b.id ? { ...x, visibility: { action: 'show' as const, when: { ref: a.id, op: 'notEmpty' as const } } } : x) }
          : e),
      })),
    };
    const { def: out, id } = duplicateElement(def, g.id);
    const copy = out.pages[0].elements.find((e) => e.id === id) as UiFbGroup;
    const [ca, cb] = copy.elements as UiFbField[];
    expect(ca.id).not.toBe(a.id);
    expect(ca.key).toBe('first_name_2');
    expect(cb.visibility?.when).toEqual({ ref: ca.id, op: 'notEmpty' });
  });

  it('remembers old keys when renaming', () => {
    const { def, a } = form();
    const once = renameKey(def, a.id, 'given_name');
    const twice = renameKey(once, a.id, 'forename');
    const f = indexDefinition(twice).get(a.id)!.element as UiFbField;
    expect(f.key).toBe('forename');
    expect(f.keyHistory).toEqual(['first_name', 'given_name']);
  });

  it('finds and removes rules that mention a deleted field', () => {
    let { def, a, b } = form();
    def = { ...def, pages: def.pages.map((p) => ({ ...p, elements: p.elements.map((e) => e.id === b.id ? { ...e, visibility: { action: 'show' as const, when: { match: 'all' as const, conditions: [{ ref: a.id, op: 'notEmpty' as const }] } } } : e) })) };
    expect(externalReferences(def, a.id)).toEqual([{ ownerId: b.id, kind: 'visibility' }]);
    const cleaned = removeReferences(def, [a.id]);
    expect((indexDefinition(cleaned).get(b.id)!.element as UiFbField).visibility).toBeUndefined();
  });

  it('spots real loops but not "section is complete" rules', () => {
    let { def, a, b, g } = form();
    const c = createField('text', def, 'Inside');
    def = insertElement(def, c, { containerId: g.id, index: 0 });
    // "Age" shows when the section is complete — the section doesn't depend on Age. Fine.
    const setVis = (d: UiFormDefinition, id: string, when: object) => ({
      ...d,
      pages: d.pages.map((p) => ({ ...p, elements: p.elements.map((e) => e.id === id ? { ...e, visibility: { action: 'show' as const, when } } : e) })),
    }) as UiFormDefinition;
    def = setVis(def, b.id, { ref: g.id, op: 'complete' });
    expect(findCycles(def)).toEqual([]);
    // A shows when B is shown, B shows when A is shown: a loop.
    def = setVis(def, a.id, { ref: b.id, op: 'visible' });
    def = setVis(def, b.id, { ref: a.id, op: 'visible' });
    expect(findCycles(def).length).toBe(1);
    expect(lintDefinition(def).some((p) => p.message.includes('loop'))).toBe(true);
  });

  it('lists what changed between versions', () => {
    const { def, a, b } = form();
    let next = renameKey(def, a.id, 'given_name');
    next = { ...next, pages: next.pages.map((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== b.id) })) };
    const d = diffDefinitions(def, next);
    expect(d.renamedKeys).toEqual([{ id: a.id, from: 'first_name', to: 'given_name' }]);
    expect(d.removed).toEqual([b.id]);
    expect(d.summary.length).toBe(2);
  });
});
