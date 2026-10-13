import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiFormEngine } from './engine';
import type { UiFbElement, UiFbField, UiFbGroup, UiFormDefinition } from './schema';
import type { UiFbValidatorDef } from './validators';

const f = (id: string, type: UiFbField['type'], extra: Partial<UiFbField> = {}): UiFbField => ({ kind: 'field', id, type, key: id, label: id.toUpperCase(), ...extra });

function def(elements: UiFbElement[], extra: Partial<UiFormDefinition> = {}): UiFormDefinition {
  return { schemaVersion: 1, id: 'form1', title: 'T', revision: 3, pages: [{ id: 'p1', elements }], ...extra };
}

function engine(d: UiFormDefinition, data?: Record<string, unknown> | null, validators: UiFbValidatorDef[] = []) {
  const e = new UiFormEngine({ definition: d, data, validators, today: () => '2026-10-11', injector: TestBed.inject(Injector) });
  TestBed.tick();
  return e;
}

describe('UiFormEngine', () => {
  it('shows a field only when its rule holds, and leaves hidden answers out of the data', () => {
    const e = engine(def([
      f('married', 'toggle'),
      f('spouse', 'text', { visibility: { action: 'show', when: { ref: 'married', op: 'isTrue' } } }),
    ]));
    expect(e.instanceState('spouse', null).visible).toBe(false);
    e.setValue('married', null, true);
    expect(e.instanceState('spouse', null).visible).toBe(true);
    e.setValue('spouse', null, 'Sam');
    expect(e.data()).toEqual({ married: true, spouse: 'Sam' });
    e.setValue('married', null, false);
    expect(e.data()).toEqual({ married: false });
  });

  it('makes a field required only under a condition, and hidden required fields never block', () => {
    const e = engine(def([
      f('kind', 'select', { options: [{ id: 'o1', value: 'company', label: 'Company' }, { id: 'o2', value: 'person', label: 'Person' }] }),
      f('vat', 'text', { required: { when: { ref: 'kind', op: 'eq', value: { const: 'company' } } } }),
      f('nick', 'text', { required: true, visibility: { action: 'hide', when: { ref: 'kind', op: 'eq', value: { const: 'company' } } } }),
    ]));
    e.setValue('kind', null, 'company');
    expect(e.instanceState('vat', null).errors).toEqual(['VAT is required.']);
    expect(e.instanceState('nick', null).errors).toEqual([]);
    e.setValue('kind', null, 'person');
    expect(e.instanceState('vat', null).errors).toEqual([]);
    expect(e.instanceState('nick', null).errors).toEqual(['NICK is required.']);
  });

  it('only shows errors after the field is left, or after trying to continue', () => {
    const e = engine(def([f('a', 'email', { required: true })]));
    expect(e.errorsShown('a', null)).toBe(false);
    e.setValue('a', null, 'nope');
    expect(e.instanceState('a', null).errors).toEqual(['Enter an email address like name@example.com.']);
    expect(e.errorsShown('a', null)).toBe(false);
    e.markTouched('a', null);
    expect(e.errorsShown('a', null)).toBe(true);
  });

  it('uses custom messages with placeholders', () => {
    const e = engine(def([f('code', 'text', { validators: [{ id: 'v1', type: 'minLength', params: { min: 4 }, message: '{label} needs {min}+ characters' }] })]));
    e.setValue('code', null, 'ab');
    expect(e.instanceState('code', null).errors).toEqual(['CODE needs 4+ characters']);
  });

  it('keeps repeat entries as an array of objects, with per-entry rules and a total', () => {
    const items: UiFbGroup = {
      kind: 'group', id: 'items', key: 'items', repeat: { min: 1, max: 3 },
      elements: [
        f('qty', 'number'),
        f('price', 'currency'),
        f('line', 'calculated', { calc: { op: 'multiply', args: [{ ref: 'qty' }, { ref: 'price' }] } }),
        f('note', 'text', { visibility: { action: 'show', when: { ref: 'qty', op: 'gt', value: { const: 10 } } } }),
      ],
    };
    const e = engine(def([items, f('total', 'calculated', { calc: { op: 'sum', args: [{ ref: 'line' }] } })]));
    const [r1] = e.rows('items');
    e.setValue('qty', r1, 2);
    e.setValue('price', r1, 5);
    const r2 = e.addRow('items')!;
    e.setValue('qty', r2, 20);
    e.setValue('price', r2, 1);
    expect(e.instanceState('note', r1).visible).toBe(false);
    expect(e.instanceState('note', r2).visible).toBe(true);
    expect(e.instanceState('total', null).value).toBe(30);
    expect(e.data()).toEqual({
      items: [{ qty: 2, price: 5, line: 10 }, { qty: 20, price: 1, line: 20, note: null }],
      total: 30,
    });
    e.addRow('items');
    expect(e.canAddRow('items')).toBe(false);
  });

  it('opens saved answers for editing: old keys, unknown keys and untouched hidden answers survive', () => {
    const d = def([
      f('name', 'text', { key: 'full_name', keyHistory: ['name'] }),
      f('show', 'toggle'),
      f('secret', 'text', { visibility: { action: 'show', when: { ref: 'show', op: 'isTrue' } } }),
      f('gone', 'text', { archived: true }),
    ]);
    const saved = { name: 'Ada', show: false, secret: 'kept', gone: 'old', legacy_field: 42 };
    const e = engine(d, saved);
    expect(e.mode).toBe('edit');
    expect(e.rawValue('name', null)).toBe('Ada');
    // Re-saving moves the answer to the new key and keeps everything it doesn't know about.
    expect(e.data()).toEqual({ full_name: 'Ada', show: false, secret: 'kept', gone: 'old', legacy_field: 42 });
    expect(e.dirty()).toBe(false);
    // Once the person reveals the field (it's rendered) and hides it again, it's their choice: it's cleared.
    e.setValue('show', null, true);
    expect(e.instanceState('secret', null).visible).toBe(true);
    e.setValue('show', null, false);
    expect(e.data()['secret']).toBeUndefined();
    expect(e.dirty()).toBe(true);
    expect(e.changes()).toEqual([{ path: 'secret', label: 'SECRET', from: 'kept', to: null }]);
  });

  it('lists changes made while editing', () => {
    const e = engine(def([f('a', 'text'), f('b', 'number')]), { a: 'x', b: 1 });
    e.setValue('b', null, 2);
    expect(e.changes()).toEqual([{ path: 'b', label: 'B', from: 1, to: 2 }]);
  });

  it('follows page jumps forward and skips the pages in between', () => {
    const d: UiFormDefinition = {
      schemaVersion: 1, id: 'f', title: 'T',
      pages: [
        { id: 'p1', elements: [f('student', 'toggle')], jumps: [{ id: 'j', when: { ref: 'student', op: 'isFalse' }, to: 'p3' }] },
        { id: 'p2', elements: [f('school', 'text', { required: true })] },
        { id: 'p3', elements: [f('done', 'text')] },
      ],
    };
    const e = engine(d);
    expect(e.path()).toEqual([0, 2]);
    expect(e.next()).toBe(true);
    expect(e.pageIndex()).toBe(2);
    // The skipped page's required field doesn't block submitting.
    expect(e.submit()).not.toBeNull();
    e.back();
    e.setValue('student', null, true);
    expect(e.path()).toEqual([0, 1, 2]);
    expect(e.next()).toBe(true);
    expect(e.next()).toBe(false);
    expect(e.pageErrors(1).map((x) => x.message)).toEqual(['SCHOOL is required.']);
  });

  it('sets a value when a condition becomes true, but not on load', () => {
    const e = engine(def([
      f('country', 'text'),
      f('currency', 'text', { setValue: [{ id: 's', when: { ref: 'country', op: 'eq', value: { const: 'uk' } }, value: { const: 'GBP' } }] }),
    ]), { country: 'uk', currency: 'EUR' });
    expect(e.rawValue('currency', null)).toBe('EUR');
    e.setValue('country', null, 'fr');
    TestBed.tick();
    e.setValue('country', null, 'uk');
    TestBed.tick();
    expect(e.rawValue('currency', null)).toBe('GBP');
  });

  it('runs app-registered async checks, blocks while pending and shows their message', async () => {
    vi.useFakeTimers();
    const taken: UiFbValidatorDef = {
      type: 'usernameFree', label: 'Username is free', defaultMessage: 'That username is taken.',
      validate: (v) => Promise.resolve(v !== 'admin'),
    };
    const e = engine(def([f('user', 'text', { validators: [{ id: 'v', type: 'usernameFree' }] })]), null, [taken]);
    e.setValue('user', null, 'admin');
    TestBed.tick();
    expect(e.instanceState('user', null).pending).toBe(true);
    expect(e.submit()).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();
    expect(e.instanceState('user', null)).toMatchObject({ pending: false, errors: ['That username is taken.'] });
    vi.useRealTimers();
  });

  it('submits the form id, revision and data', () => {
    const e = engine(def([f('a', 'text', { required: true })]));
    expect(e.submit()).toBeNull();
    e.setValue('a', null, 'hi');
    const s = e.submit()!;
    expect(s).toMatchObject({ formId: 'form1', revision: 3, data: { a: 'hi' } });
  });

  it('shows only values in view mode and never validates', () => {
    const e = engine(def([f('a', 'text', { required: true })]), { a: '' }, []);
    const v = new UiFormEngine({ definition: def([f('a', 'text', { required: true })]), data: { a: '' }, mode: 'view', injector: TestBed.inject(Injector) });
    expect(e.instanceState('a', null).errors.length).toBe(1);
    expect(v.instanceState('a', null)).toMatchObject({ errors: [], disabled: true });
  });
});
