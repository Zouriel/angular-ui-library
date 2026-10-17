import { describe, expect, it } from 'vitest';
import {
  cloneStep, createStep, createWorkflow, formFields, describeDuration, describeStep, describeTrigger, duplicateStep, ensureList, goToTargets, indexSteps,
  insertStep, isInsideStep, listSteps, mapLists, moveStep, removeState, removeStep, stepReferences, stepSlots, tokensAt,
  transitionAllows, upstreamSteps, wfId, wfKey, wfStatesFrom, withSlot,
} from './definition';
import type { UiWfStep, UiWorkflowDefinition, UiWorkflowRegistry } from './schema';

const registry: UiWorkflowRegistry = {
  entities: [
    {
      key: 'application', label: 'Application',
      fields: [
        { key: 'status', label: 'Status', type: 'enum', options: [{ value: 'Draft', label: 'Draft' }, { value: 'Submitted', label: 'Submitted' }] },
        { key: 'amount', label: 'Amount', type: 'currency' },
        { key: 'documents', label: 'Documents', type: 'collection', entity: 'document' },
      ],
    },
    { key: 'document', label: 'Document', fields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'verified', label: 'Verified', type: 'boolean' }] },
  ],
} as UiWorkflowRegistry;

const step = (id: string, type: UiWfStep['type'] = 'notify'): UiWfStep => ({ ...createStep(type), id });

/** root: a, b(branch: path p → [c], otherwise → [d]), e(parallel: p1 → [f], p2 → []), g */
function sample(): UiWorkflowDefinition {
  const def = createWorkflow('automation', 'Sample', 'application');
  const b = { ...step('b', 'branch') } as Extract<UiWfStep, { type: 'branch' }>;
  b.paths = [{ ...b.paths[0], id: 'p', steps: [step('c')] }];
  b.otherwise = { id: 'o', label: 'Otherwise', steps: [step('d')] };
  const e = { ...step('e', 'parallel') } as Extract<UiWfStep, { type: 'parallel' }>;
  e.paths = [{ id: 'p1', label: 'Path 1', steps: [step('f')] }, { id: 'p2', label: 'Path 2', steps: [] }];
  return { ...def, steps: [step('a'), b, e, step('g')] };
}

const ids = (steps: readonly UiWfStep[] | null) => (steps ?? []).map((s) => s.id);

describe('ids and keys', () => {
  it('wfId is spec-valid and unique', () => {
    const many = new Set(Array.from({ length: 2000 }, () => wfId('s')));
    expect(many.size).toBe(2000);
    for (const id of many) expect(id).toMatch(/^s_[A-Za-z0-9_-]+$/);
  });

  it('wfKey camel-cases, strips accents, starts with a letter and avoids taken keys', () => {
    expect(wfKey('Send reminder')).toBe('sendReminder');
    expect(wfKey('  Révision  finale! ')).toBe('revisionFinale');
    expect(wfKey('2nd review')).toBe('k2ndReview');
    expect(wfKey('!!!')).toBe('item');
    expect(wfKey('Approve', ['approve', 'approve2'])).toBe('approve3');
  });
});

describe('creating', () => {
  it('an automation starts with a field-change trigger and no steps', () => {
    const d = createWorkflow('automation', 'Remind', 'application');
    expect(d).toMatchObject({ specVersion: 1, kind: 'automation', entity: 'application', trigger: { type: 'fieldChanged' }, steps: [] });
  });

  it('a lifecycle starts with a start state, a final state and a move between them', () => {
    const d = createWorkflow('lifecycle');
    const [draft, done] = d.lifecycle!.states;
    expect([draft.category, done.category]).toEqual(['initial', 'terminal']);
    expect(d.lifecycle!.transitions).toEqual([expect.objectContaining({ from: [draft.id], to: done.id })]);
  });

  it('every step type gets the lists it needs', () => {
    expect(stepSlots(createStep('approval')).map((s) => s.slot)).toEqual(['outcome:approved', 'outcome:rejected', 'outcome:timedOut']);
    expect(stepSlots(createStep('task')).map((s) => s.kind)).toEqual(['outcome', 'timeout']);
    expect(stepSlots(createStep('parallel'))).toHaveLength(2);
    expect(stepSlots(createStep('notify'))).toEqual([]);
  });
});

describe('step lists', () => {
  it('indexes every step with its list, parent and path', () => {
    const idx = indexSteps(sample());
    expect(idx.get('a')).toMatchObject({ listId: 'root', index: 0, parentId: null, path: ['root'] });
    expect(idx.get('c')).toMatchObject({ listId: 'b/path:p', index: 0, parentId: 'b', path: ['root', 'b/path:p'] });
    expect(idx.get('d')?.listId).toBe('b/otherwise');
    expect(idx.get('f')?.listId).toBe('e/path:p1');
  });

  it('finds lists by id', () => {
    const d = sample();
    expect(ids(listSteps(d, 'root'))).toEqual(['a', 'b', 'e', 'g']);
    expect(ids(listSteps(d, 'e/path:p2'))).toEqual([]);
    expect(listSteps(d, 'nope/path:x')).toBeNull();
  });

  it('withSlot replaces one nested list', () => {
    const b = sample().steps![1];
    const next = withSlot(b, 'otherwise', [step('z')]);
    expect(ids(stepSlots(next).find((s) => s.slot === 'otherwise')!.steps)).toEqual(['z']);
    expect(ids(stepSlots(next).find((s) => s.slot === 'path:p')!.steps)).toEqual(['c']);
  });

  it('mapLists keeps untouched branches identical', () => {
    const d = sample();
    expect(mapLists(d, (_, s) => s)).toBe(d);
    const next = mapLists(d, (id, s) => (id === 'b/path:p' ? [...s, step('x')] : s));
    expect(next.steps![2]).toBe(d.steps![2]);
    expect(next.steps![1]).not.toBe(d.steps![1]);
  });

  it('inserts, clamping the index', () => {
    const d = insertStep(sample(), 'e/path:p2', 99, step('n'));
    expect(ids(listSteps(d, 'e/path:p2'))).toEqual(['n']);
    expect(ids(listSteps(insertStep(d, 'root', -3, step('m')), 'root'))[0]).toBe('m');
  });

  it('removes a step wherever it is', () => {
    expect(indexSteps(removeStep(sample(), 'f')).has('f')).toBe(false);
    expect(indexSteps(removeStep(sample(), 'b')).has('c')).toBe(false);
  });

  it('moves within a list using drop-line indexes', () => {
    const d = sample();
    expect(ids(listSteps(moveStep(d, 'a', 'root', 2), 'root'))).toEqual(['b', 'a', 'e', 'g']);
    expect(ids(listSteps(moveStep(d, 'g', 'root', 0), 'root'))).toEqual(['g', 'a', 'b', 'e']);
    // Dropping right above or below itself changes nothing.
    expect(moveStep(d, 'b', 'root', 1)).toBe(d);
    expect(moveStep(d, 'b', 'root', 2)).toBe(d);
  });

  it('moves into another branch, but never into itself', () => {
    const d = moveStep(sample(), 'a', 'b/otherwise', 1);
    expect(ids(listSteps(d, 'b/otherwise'))).toEqual(['d', 'a']);
    expect(isInsideStep(sample(), 'b/path:p', 'b')).toBe(true);
    const s = sample();
    expect(moveStep(s, 'b', 'b/path:p', 0)).toBe(s);
  });

  it('a lifecycle list is created on first use', () => {
    const d = createWorkflow('lifecycle');
    const t = d.lifecycle!.transitions[0];
    expect(listSteps(d, `transition:${t.id}`)).toBeNull();
    const next = insertStep(d, `transition:${t.id}`, 0, step('x'));
    expect(ids(listSteps(next, `transition:${t.id}`))).toEqual(['x']);
    const st = d.lifecycle!.states[0];
    expect(ensureList(d, `sla:${st.id}`).lifecycle!.states[0].sla).toEqual({ within: 'P2D', steps: [] });
  });

  it('duplicates with fresh ids everywhere inside, placed right after', () => {
    const { def, id } = duplicateStep(sample(), 'b');
    expect(ids(listSteps(def, 'root'))).toEqual(['a', 'b', id, 'e', 'g']);
    const copy = indexSteps(def).get(id!)!.step;
    const inner = stepSlots(copy).flatMap((s) => ids(s.steps));
    expect(inner).not.toContain('c');
    expect(inner).toHaveLength(2);
  });

  it('a duplicate gets its own name, and its inner steps read each other, not the original', () => {
    let d = sample();
    d = insertStep(d, 'b/path:p', 1, { ...step('reader'), subject: ['Path: ', { ref: 'steps.c.sent' }] } as UiWfStep);
    d = insertStep(d, 'b/path:p', 2, { ...step('back', 'goTo'), target: 'c' } as UiWfStep);
    const { def, id } = duplicateStep(d, 'b');
    const copy = indexSteps(def).get(id!)!.step;
    const [c2, reader2, back2] = stepSlots(copy)[0].steps;
    expect(copy.title).toBe('Branch (copy)');
    expect(JSON.stringify(reader2)).toContain(`steps.${c2.id}.sent`);
    expect((back2 as Extract<UiWfStep, { type: 'goTo' }>).target).toBe(c2.id);
    // Outside references to the original stay as they were.
    expect(JSON.stringify(indexSteps(def).get('reader')!.step)).toContain('steps.c.sent');
  });

  it('cloneStep keeps embedded form ids', () => {
    const s = { ...step('t', 'task'), form: { schemaVersion: 1, id: 'form1', elements: [] } } as unknown as UiWfStep;
    expect((cloneStep(s) as unknown as { form: { id: string } }).form.id).toBe('form1');
  });
});

describe('what a step can see', () => {
  it('upstream steps: earlier in the list, enclosing containers, never parallel siblings', () => {
    const d = sample();
    expect(ids(upstreamSteps(d, { stepId: 'g' }))).toEqual(['a', 'b', 'e']);
    expect(ids(upstreamSteps(d, { stepId: 'c' }))).toEqual(['a', 'b']);
    expect(ids(upstreamSteps(d, { listId: 'e/path:p2', index: 0 }))).toEqual(['a', 'b', 'e']);
  });

  it('go back targets stop at a parallel path', () => {
    const d = insertStep(sample(), 'e/path:p1', 1, step('back', 'goTo'));
    expect(ids(goToTargets(d, 'back'))).toEqual(['f']);
    const top = insertStep(sample(), 'b/path:p', 1, step('back', 'goTo'));
    expect(ids(goToTargets(top, 'back'))).toEqual(['a', 'c']);
  });

  it('tokens include the record, the trigger, upstream outputs and the loop item', () => {
    let d = sample();
    d = { ...d, trigger: { type: 'fieldChanged', field: 'status' } };
    const fe = { ...step('loop', 'forEach'), collection: 'entity.documents' } as UiWfStep;
    d = insertStep(d, 'root', 4, fe);
    d = insertStep(d, 'loop/each', 0, step('inside'));
    const paths = tokensAt({ def: d, registry, at: { stepId: 'inside' } }).map((t) => t.path);
    expect(paths).toEqual(expect.arrayContaining(['entity.amount', 'trigger.from', 'trigger.to', 'item.name', 'item.verified', 'steps.b.path', 'steps.loop.count', 'today']));
    expect(paths).not.toContain('steps.inside.sent');
    expect(tokensAt({ def: d, registry, at: { stepId: 'a' } }).map((t) => t.path)).not.toContain('item.name');
  });

  it('finds steps that refer to another step', () => {
    let d = sample();
    d = insertStep(d, 'root', 4, { ...step('n'), subject: ['Path: ', { ref: 'steps.b.path' }] } as UiWfStep);
    d = insertStep(d, 'root', 5, { ...step('j', 'goTo'), target: 'a' } as UiWfStep);
    expect(ids(stepReferences(d, 'b'))).toEqual(['n']);
    expect(ids(stepReferences(d, 'a'))).toEqual(['j']);
  });
});

describe('summaries', () => {
  it('durations read naturally', () => {
    expect(describeDuration('P1D')).toBe('1 day');
    expect(describeDuration('P2DT3H')).toBe('2 days 3 hours');
    expect(describeDuration('-P1W')).toBe('1 week before');
    expect(describeDuration('PT0S')).toBe('no time');
    expect(describeDuration(undefined)).toBe('no time set');
    expect(describeDuration('soon')).toBe('soon');
  });

  it('triggers read naturally, with option labels', () => {
    const def = createWorkflow('automation', 'x', 'application');
    const ctx = { registry, def };
    expect(describeTrigger({ type: 'fieldChanged', field: 'status', to: ['Submitted'] }, ctx)).toBe('When Status changes to Submitted');
    expect(describeTrigger({ type: 'fieldChanged' }, ctx)).toBe('When an application changes');
    expect(describeTrigger({ type: 'created' }, ctx)).toBe('When an application is created');
    expect(describeTrigger({ type: 'manual', label: 'Escalate' }, ctx)).toBe('When someone presses “Escalate”');
  });
});

describe('lifecycle helpers', () => {
  it('removing a state removes arrows into it and its place, and drops moves left with no source', () => {
    const d = createWorkflow('lifecycle');
    const [draft, done] = d.lifecycle!.states;
    const withLayout = { ...d, lifecycle: { ...d.lifecycle!, layout: { [draft.id]: [0, 0] as [number, number] } } };
    const next = removeState(withLayout, draft.id);
    expect(next.lifecycle!.states.map((s) => s.id)).toEqual([done.id]);
    expect(next.lifecycle!.transitions).toEqual([]);
    expect(next.lifecycle!.layout).toEqual({});
  });

  it('"from any state" allows every state but final ones and its own target', () => {
    const d = createWorkflow('lifecycle');
    const [draft, done] = d.lifecycle!.states;
    const t = { id: 't', key: 'w', label: 'W', from: '*' as const, to: draft.id, who: [] };
    expect(transitionAllows(d, t, draft.id)).toBe(false);
    expect(transitionAllows(d, t, done.id)).toBe(false);
    expect(transitionAllows(d, { ...t, to: done.id }, draft.id)).toBe(true);
  });
});

describe('reset', () => {
  const withReset = () => {
    const d = createWorkflow('lifecycle', 'Life', 'application');
    return { ...d, lifecycle: { ...d.lifecycle!, reset: { who: [], input: { form: { schemaVersion: 1, id: 'f', title: 'Reset', pages: [{ id: 'p', elements: [
      { kind: 'field', id: 'r', key: 'reason', type: 'textarea', label: 'Why' },
      { kind: 'group', id: 'g', key: 'extra', elements: [{ kind: 'field', id: 'n', key: 'note', type: 'text', label: 'Note' }] },
    ] }] } as never } } } } as UiWorkflowDefinition;
  };

  it('its steps are a list called reset, created on first use', () => {
    const d = withReset();
    expect(listSteps(d, 'reset')).toBeNull();
    const next = insertStep(d, 'reset', 0, step('x'));
    expect(ids(listSteps(next, 'reset'))).toEqual(['x']);
    expect(indexSteps(next).get('x')?.listId).toBe('reset');
  });

  it('no reset, no list', () => {
    const d = createWorkflow('lifecycle');
    expect(insertStep(d, 'reset', 0, step('x'))).toEqual(d);
  });

  it('steps on reset can read the reset form\'s answers, groups included', () => {
    const d = insertStep(withReset(), 'reset', 0, step('x'));
    const paths = tokensAt({ def: d, registry, at: { stepId: 'x' } }).map((t) => t.path);
    expect(paths).toEqual(expect.arrayContaining(['input.reason', 'input.extra.note']));
    expect(formFields(undefined)).toEqual([]);
  });
});


describe('create record step', () => {
  it('starts empty, says what it creates, and later steps can read the new record\'s id', () => {
    const c = { ...createStep('createRecord'), id: 'mk' } as Extract<UiWfStep, { type: 'createRecord' }>;
    expect(c).toEqual({ id: 'mk', type: 'createRecord', entity: '', values: [] });
    const def = createWorkflow('automation', 'Sample', 'application');
    expect(describeStep(c, { def, registry })).toBe('Choose what to create');
    const doc = { ...c, entity: 'document', values: [{ field: 'name', value: { const: 'Checklist' } }] };
    expect(describeStep(doc, { def, registry })).toBe('a new document with Name');
    const d = { ...def, steps: [doc, step('after')] };
    const t = tokensAt({ def: d, registry, at: { stepId: 'after' } }).find((x) => x.path === 'steps.mk.id');
    expect(t?.label).toBe('New document id');
    expect(tokensAt({ def: d, registry, at: { stepId: 'mk' } }).some((x) => x.path === 'steps.mk.id')).toBe(false);
  });
});

describe('wfStatesFrom', () => {
  // draft → submitted → review → approved | rejected; review → draft (send back); withdraw from any state.
  const life = (): UiWorkflowDefinition => {
    const d = createWorkflow('lifecycle', 'Life', 'application');
    return {
      ...d,
      lifecycle: {
        field: 'status',
        states: [
          { id: 'draft', key: 'draft', label: 'Draft', category: 'initial' }, { id: 'sub', key: 'sub', label: 'Submitted', category: 'active' },
          { id: 'rev', key: 'rev', label: 'Review', category: 'active' }, { id: 'ok', key: 'ok', label: 'Approved', category: 'terminal' },
          { id: 'no', key: 'no', label: 'Rejected', category: 'terminal' }, { id: 'wd', key: 'wd', label: 'Withdrawn', category: 'terminal' },
        ],
        transitions: [
          { id: 't1', key: 'submit', label: 'Submit', from: ['draft'], to: 'sub' },
          { id: 't2', key: 'start', label: 'Start', from: ['sub'], to: 'rev' },
          { id: 't3', key: 'ok', label: 'Approve', from: ['rev'], to: 'ok' },
          { id: 't4', key: 'no', label: 'Reject', from: ['rev'], to: 'no' },
          { id: 't5', key: 'back', label: 'Send back', from: ['rev'], to: 'draft' },
          { id: 't6', key: 'wd', label: 'Withdraw', from: '*', to: 'wd' },
        ],
      },
    } as UiWorkflowDefinition;
  };

  it('is the state and everything after it, final states included, without looping back to the start', () => {
    expect(wfStatesFrom(life(), 'sub')).toEqual(['sub', 'rev', 'ok', 'no', 'wd']);
    expect(wfStatesFrom(life(), 'rev')).toEqual(['rev', 'ok', 'no', 'wd']);
    expect(wfStatesFrom(life(), 'ok')).toEqual(['ok']);
  });

  it('stops at the reset\'s own target when it goes back somewhere else', () => {
    const d = life();
    d.lifecycle!.reset = { to: 'sub' };
    expect(wfStatesFrom(d, 'draft')).toEqual(['draft', 'wd']);
    expect(wfStatesFrom(d, 'unknown')).toEqual([]);
  });
});
