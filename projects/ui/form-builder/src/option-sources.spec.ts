import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { evaluateCondition, type UiFbConditionContext } from './conditions';
import { diffDefinitions, lintDefinition, referencesTo, removeReferences } from './definition';
import { coerceValue } from './engine';
import { formatValue } from './format';
import { FbBuilderStore } from './builder-store';
import { UiFormRenderer } from './form-renderer';
import { optionValueOf, type UiFbChoice, type UiFbOptionSourceDef, type UiFbSourceQuery } from './option-sources';
import type { UiFbField, UiFormDefinition, UiFormSubmission } from './schema';
import { UiFbSourcePicker } from './source-picker';
import { FbSourceSettings } from './builder-source';

const PEOPLE = Array.from({ length: 45 }, (_, i) => ({ value: `S${100 + i}`, label: `Person ${i + 1}` }));

/** A paginated, searchable in-memory source that records what it was asked. */
function peopleSource(extra: Partial<UiFbOptionSourceDef> = {}) {
  const calls: UiFbSourceQuery[] = [];
  const def: UiFbOptionSourceDef = {
    type: 'people',
    label: 'People',
    pageSize: 20,
    debounceMs: 200,
    search: (q) => {
      calls.push(q);
      const hits = PEOPLE.filter((p) => p.label.toLowerCase().includes(q.query.toLowerCase()));
      return { items: hits.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: hits.length };
    },
    ...extra,
  };
  return { def, calls };
}

const f = (id: string, type: UiFbField['type'], extra: Partial<UiFbField> = {}): UiFbField => ({ kind: 'field', id, type, key: id, label: id.toUpperCase(), ...extra });
const ctx = (values: Record<string, unknown>): UiFbConditionContext => ({
  value: (r) => values[r], visible: () => true, complete: () => true, rows: () => 0, today: () => '2026-10-13',
});

describe('option sources: saved shape and rules', () => {
  const ana: UiFbChoice = { value: 'S100', label: 'Person 1' };

  it('rules compare the value of a { value, label } answer, whether the rule holds a plain value or a choice', () => {
    expect(evaluateCondition({ ref: 'p', op: 'eq', value: { const: 'S100' } }, ctx({ p: ana }))).toBe(true);
    expect(evaluateCondition({ ref: 'p', op: 'eq', value: { const: ana } }, ctx({ p: ana }))).toBe(true);
    expect(evaluateCondition({ ref: 'p', op: 'anyOf', value: { const: [{ value: 'S9', label: 'x' }, ana] } }, ctx({ p: ana }))).toBe(true);
    expect(evaluateCondition({ ref: 'p', op: 'includes', value: { const: ana } }, ctx({ p: [ana, { value: 'S101', label: 'Person 2' }] }))).toBe(true);
    expect(evaluateCondition({ ref: 'p', op: 'excludes', value: { const: 'S102' } }, ctx({ p: [ana] }))).toBe(true);
    expect(evaluateCondition({ ref: 'p', op: 'neq', value: { const: 'S100' } }, ctx({ p: ana }))).toBe(false);
  });

  it('keeps { value, label } for sourced fields, and plain values for typed lists', () => {
    const sourced = f('p', 'select', { source: { type: 'people' } });
    const typed = f('t', 'select', { options: [{ id: 'o', value: 'a', label: 'A' }] });
    expect(coerceValue(sourced, ana)).toEqual(ana);
    expect(coerceValue(sourced, 'S5')).toEqual({ value: 'S5', label: 'S5' });
    expect(coerceValue(typed, { value: 'a', label: 'A' })).toBe('a');
    expect(coerceValue(f('m', 'multiselect', { source: { type: 'people' } }), [ana, 'S7'])).toEqual([ana, { value: 'S7', label: 'S7' }]);
    expect(formatValue(sourced, ana)).toBe('Person 1');
    expect(formatValue(f('m', 'multiselect', { source: { type: 'people' } }), [ana, { value: 'S101', label: 'Person 2' }])).toBe('Person 1, Person 2');
    expect(optionValueOf([ana])).toEqual(['S100']);
  });

  it('counts a filter that follows another answer as a reference, and drops it when that question is deleted', () => {
    const def: UiFormDefinition = {
      schemaVersion: 1, id: 'f', title: 'T',
      pages: [{ id: 'p1', elements: [f('country', 'select', { source: { type: 'countries' } }), f('city', 'select', { source: { type: 'cities', params: { country: { ref: 'country' }, size: { const: 'big' } } } })] }],
    };
    expect(referencesTo(def, 'country')).toEqual([{ ownerId: 'city', kind: 'source' }]);
    const after = removeReferences(def, ['country']);
    const city = after.pages[0].elements[1] as UiFbField;
    expect(city.source).toEqual({ type: 'cities', params: { size: { const: 'big' } } });
  });

  it('does not ask a sourced field for typed options', () => {
    const def: UiFormDefinition = { schemaVersion: 1, id: 'f', title: 'T', pages: [{ id: 'p1', elements: [f('p', 'select', { label: 'Student', source: { type: 'people' } }), f('t', 'select', { label: 'Typed' })] }] };
    expect(lintDefinition(def).filter((p) => p.message.includes('no options')).map((p) => p.targetId)).toEqual(['t']);
  });

  it('lists switching a field to a data source among the unpublished changes', () => {
    const before: UiFormDefinition = { schemaVersion: 1, id: 'f', title: 'T', pages: [{ id: 'p1', elements: [f('p', 'select', { label: 'Student', options: [] })] }] };
    const after: UiFormDefinition = { ...before, pages: [{ id: 'p1', elements: [f('p', 'select', { label: 'Student', options: [], source: { type: 'people' } })] }] };
    expect(diffDefinitions(before, after).summary.join(' ')).toContain('now takes its options from a data source');
  });
});

// ── The picker ──────────────────────────────────────────────────────────────

@Component({
  imports: [UiFbSourcePicker],
  template: `<ui-fb-source-picker [source]="def" [params]="params()" [multiple]="multiple()" [value]="value()" (valueChange)="value.set($any($event))" ariaLabel="Person" />`,
})
class PickerHost {
  def!: UiFbOptionSourceDef;
  readonly params = signal<Record<string, unknown>>({});
  readonly multiple = signal(false);
  readonly value = signal<unknown>(null);
}

describe('UiFbSourcePicker', () => {
  afterEach(() => vi.useRealTimers());

  async function render(def: UiFbOptionSourceDef, multiple = false) {
    const fx = TestBed.createComponent(PickerHost);
    fx.componentInstance.def = def;
    fx.componentInstance.multiple.set(multiple);
    fx.detectChanges();
    const input = (fx.nativeElement as HTMLElement).querySelector('input')!;
    const settle = async () => { await Promise.resolve(); await Promise.resolve(); fx.detectChanges(); };
    const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role=option]'));
    return { fx, host: fx.componentInstance, input, settle, options };
  }

  it('opens on the first page, loads the next as the list scrolls, and marks the input as a combobox', async () => {
    const { def, calls } = peopleSource();
    const { input, settle, options } = await render(def);
    input.dispatchEvent(new Event('focus'));
    await settle();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().length).toBe(20);
    expect(calls[0]).toMatchObject({ query: '', page: 1, pageSize: 20 });
    const list = document.querySelector<HTMLElement>('[role=listbox]')!;
    Object.defineProperties(list, { scrollTop: { value: 600, configurable: true }, clientHeight: { value: 260 }, scrollHeight: { value: 860 } });
    list.dispatchEvent(new Event('scroll'));
    await settle();
    expect(calls[1]).toMatchObject({ page: 2 });
    expect(options().length).toBe(40);
  });

  it('searches after a pause in typing, and picks with the keyboard', async () => {
    vi.useFakeTimers();
    const { def, calls } = peopleSource();
    const { host, input, settle, options } = await render(def);
    input.dispatchEvent(new Event('focus'));
    await settle();
    input.value = 'Person 4';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(100);
    expect(calls.length).toBe(1);
    vi.advanceTimersByTime(150);
    await settle();
    expect(calls[1]).toMatchObject({ query: 'Person 4', page: 1 });
    expect(options().map((o) => o.textContent!.trim())).toEqual(['Person 4', 'Person 40', 'Person 41', 'Person 42', 'Person 43', 'Person 44', 'Person 45']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(host.value()).toEqual({ value: 'S139', label: 'Person 40' });
  });

  it('collects several as chips in multi mode; Backspace removes the last', async () => {
    const { def } = peopleSource();
    const { fx, host, input, settle, options } = await render(def, true);
    input.dispatchEvent(new Event('focus'));
    await settle();
    options()[0].click();
    fx.detectChanges();
    options()[2].click();
    fx.detectChanges();
    expect(host.value()).toEqual([{ value: 'S100', label: 'Person 1' }, { value: 'S102', label: 'Person 3' }]);
    expect(fx.nativeElement.querySelectorAll('.chip').length).toBe(2);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    fx.detectChanges();
    expect(host.value()).toEqual([{ value: 'S100', label: 'Person 1' }]);
  });

  it('waits for a required setting before searching, and offers a retry when the list fails', async () => {
    let fail = true;
    const { def, calls } = peopleSource({ params: [{ key: 'faculty', label: 'Faculty', required: true }] });
    const flaky: UiFbOptionSourceDef = { ...def, search: (q) => { calls.push(q); if (fail) throw new Error('down'); return { items: PEOPLE.slice(0, 3), hasMore: false }; } };
    const { fx, host, input, settle, options } = await render(flaky);
    input.dispatchEvent(new Event('focus'));
    await settle();
    expect(calls.length).toBe(0);
    expect(document.querySelector('.status')!.textContent).toContain('Choose faculty first');
    host.params.set({ faculty: 'health' });
    fx.detectChanges();
    await settle();
    expect(calls.length).toBe(1);
    expect(document.querySelector('.status')!.textContent).toContain('Couldn’t load the list');
    fail = false;
    (document.querySelector('.retry') as HTMLButtonElement).click();
    await settle();
    expect(options().length).toBe(3);
  });
});

// ── In a form ───────────────────────────────────────────────────────────────

@Component({
  imports: [UiFormRenderer],
  template: `<ui-form-renderer [definition]="def" [optionSources]="sources" [data]="data" (submitted)="sent = $event" />`,
})
class FormHost {
  def!: UiFormDefinition;
  sources: UiFbOptionSourceDef[] = [];
  data: Record<string, unknown> | null = null;
  sent: UiFormSubmission | null = null;
}

describe('sourced fields in ui-form-renderer', () => {
  const cities: UiFbOptionSourceDef = {
    type: 'cities', label: 'Cities', params: [{ key: 'country', label: 'Country', required: true }],
    search: ({ params }) => ({ items: params['country'] === 'mv' ? [{ value: 'mle', label: 'Malé' }, { value: 'adu', label: 'Addu' }] : [{ value: 'ldn', label: 'London' }], hasMore: false }),
  };
  const def: UiFormDefinition = {
    schemaVersion: 1, id: 'f', title: 'T',
    pages: [{ id: 'p1', elements: [
      f('country', 'select', { label: 'Country', options: [{ id: 'a', value: 'mv', label: 'Maldives' }, { id: 'b', value: 'uk', label: 'UK' }] }),
      f('city', 'select', { label: 'City', required: true, source: { type: 'cities', params: { country: { ref: 'country' } } } }),
    ] }],
  };

  it('saves the picked value with its label, and clears a dependent answer when what it depends on changes', async () => {
    const fx = TestBed.createComponent(FormHost);
    fx.componentInstance.def = def;
    fx.componentInstance.sources = [cities];
    fx.componentInstance.data = { country: 'mv' };
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('ui-fb-source-picker input')!;
    input.dispatchEvent(new Event('focus'));
    await Promise.resolve();
    await Promise.resolve();
    fx.detectChanges();
    const opts = Array.from(document.querySelectorAll<HTMLElement>('[role=option]'));
    expect(opts.map((o) => o.textContent!.trim())).toEqual(['Malé', 'Addu']);
    opts[0].click();
    fx.detectChanges();
    await fx.whenStable();
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.sent!.data['city']).toEqual({ value: 'mle', label: 'Malé' });

    // Choosing another country drops the city that belonged to the old one.
    const engine = fx.debugElement.children[0].componentInstance.engine();
    engine.setValue('country', null, 'uk');
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(engine.data()['city']).toBeNull();
  });
});

describe('builder: data sources', () => {
  it('flags a field whose source the app does not provide, or whose required setting is empty', () => {
    TestBed.configureTestingModule({ providers: [FbBuilderStore] });
    const s = TestBed.inject(FbBuilderStore);
    s.load({ schemaVersion: 1, id: 'f', title: 'T', pages: [{ id: 'p1', elements: [
      f('a', 'select', { label: 'Old', source: { type: 'gone' } }),
      f('b', 'select', { label: 'City', source: { type: 'cities' } }),
    ] }] });
    s.optionSourceDefs.set([{ type: 'cities', label: 'Cities', params: [{ key: 'country', label: 'Country', required: true }], search: () => ({ items: [] }) }]);
    const msgs = s.problems().map((p) => `${p.targetId}: ${p.message}`);
    expect(msgs.some((m) => m.startsWith('a:') && m.includes('doesn’t provide'))).toBe(true);
    expect(msgs.some((m) => m.startsWith('b:') && m.includes('needs “Country”'))).toBe(true);
  });
});

describe('builder: checking a source', () => {
  it('tests the list with a stand-in for a setting that follows another answer, and says what came back', async () => {
    TestBed.configureTestingModule({ providers: [FbBuilderStore] });
    const s = TestBed.inject(FbBuilderStore);
    const courses: UiFbOptionSourceDef = {
      type: 'courses', label: 'Courses', params: [{ key: 'programme', label: 'Programme', required: true, kind: 'select', options: [{ value: 'health', label: 'Health' }] }],
      search: ({ params }) => ({ items: params['programme'] === 'health' ? [{ value: 'h1', label: 'Anatomy' }, { value: 'h2', label: 'Physiology' }] : [], total: params['programme'] === 'health' ? 11 : 0 }),
    };
    s.optionSourceDefs.set([courses]);
    s.load({ schemaVersion: 1, id: 'f', title: 'T', pages: [{ id: 'p1', elements: [
      f('prog', 'select', { label: 'Programme', options: [{ id: 'o', value: 'health', label: 'Health' }] }),
      f('c', 'multiselect', { label: 'Courses', source: { type: 'courses', params: { programme: { ref: 'prog' } } } }),
    ] }] });
    const fx = TestBed.createComponent(FbSourceSettings);
    fx.componentRef.setInput('field', s.field('c'));
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const testBtn = () => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Test the list'))!;
    testBtn().click();
    await fx.whenStable();
    fx.detectChanges();
    expect(el.querySelector('.result')!.textContent).toContain('Choose programme to test with first');
    const sel = el.querySelector<HTMLSelectElement>('.with select')!;
    sel.value = 'health';
    sel.dispatchEvent(new Event('change'));
    fx.detectChanges();
    testBtn().click();
    await fx.whenStable();
    fx.detectChanges();
    expect(el.querySelector('.result')!.textContent).toContain('Works: 11 courses, e.g. Anatomy, Physiology.');
    expect(el.querySelector('ui-fb-source-picker')).toBeNull();
  });
});
