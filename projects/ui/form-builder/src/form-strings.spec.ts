import { Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiFormEngine } from './engine';
import { UiFormRenderer } from './form-renderer';
import { formatValue } from './format';
import { fbStrings, provideUiFormStrings, UI_FB_STRINGS_DV, UI_FB_STRINGS_EN, type UiFbStringOverrides } from './form-strings';
import type { UiFbElement, UiFbField, UiFormDefinition } from './schema';
import { validatorMessage, type UiFbValidatorDef } from './validators';

const f = (id: string, type: UiFbField['type'], extra: Partial<UiFbField> = {}): UiFbField => ({ kind: 'field', id, type, key: id, label: id.toUpperCase(), ...extra });

function def(elements: UiFbElement[], extra: Partial<UiFormDefinition> = {}): UiFormDefinition {
  return { schemaVersion: 2, id: 'f', title: 'T', defaultLocale: 'en', supportedLocales: [{ code: 'en' }, { code: 'dv' }], revision: 1, pages: [{ id: 'p1', elements }], ...extra };
}

const two = (elements: UiFbElement[], extra: Partial<UiFormDefinition> = {}): UiFormDefinition =>
  def(elements, { pages: [{ id: 'p1', title: 'One', elements }, { id: 'p2', title: 'Two', elements: [f('z', 'text')] }], ...extra });

function engine(d: UiFormDefinition, opts: Partial<ConstructorParameters<typeof UiFormEngine>[0]> = {}) {
  const e = new UiFormEngine({ definition: d, injector: TestBed.inject(Injector), today: () => '2026-10-11', ...opts });
  TestBed.tick();
  return e;
}

describe('fbStrings', () => {
  it('picks by code, then base language, then English, and lays overrides on top', () => {
    expect(fbStrings('dv').submit).toBe(UI_FB_STRINGS_DV.submit);
    expect(fbStrings('dv-MV').submit).toBe(UI_FB_STRINGS_DV.submit);
    expect(fbStrings('fr').submit).toBe('Submit');
    expect(fbStrings('fr', { fr: { submit: 'Envoyer' } })).toEqual({ ...UI_FB_STRINGS_EN, submit: 'Envoyer' });
    expect(fbStrings('dv-MV', { dv: { back: 'X' } }).back).toBe('X');
  });
});

describe('UiFormEngine strings', () => {
  const required = def([f('name', 'text', { label: { en: 'Name', dv: 'ނަން' }, required: true, validators: [{ id: 'v', type: 'minLength', params: { min: 5 } }] })]);

  it('keeps English wording unchanged', () => {
    const e = engine(required);
    expect(e.instanceState('name', null).errors).toEqual(['Name is required.']);
    e.setValue('name', null, 'ab');
    expect(e.instanceState('name', null).errors).toEqual(['Name must be at least 5 characters.']);
    expect(e.strings()).toEqual(UI_FB_STRINGS_EN);
  });

  it('words required and length messages in Dhivehi, and again when the language changes', () => {
    const e = engine(required, { locale: 'dv' });
    expect(e.instanceState('name', null).errors).toEqual(['ނަން ފުރިހަމަ ކުރަންޖެހެއެވެ.']);
    e.setValue('name', null, 'ab');
    expect(e.instanceState('name', null).errors).toEqual(['ނަން ގައި މަދުވެގެން 5 އަކުރު ހުންނަންޖެހެއެވެ.']);
    e.setLocale('en');
    expect(e.instanceState('name', null).errors).toEqual(['Name must be at least 5 characters.']);
  });

  it('lets a message written on the form win, and overrides win over the built-in words', () => {
    const d = def([f('a', 'text', { label: 'A', required: true, requiredMessage: { en: 'Fill A', dv: 'ފުރާ' } })]);
    expect(engine(d, { locale: 'dv' }).instanceState('a', null).errors).toEqual(['ފުރާ']);
    const e = engine(def([f('a', 'text', { label: 'A', required: true })]), { strings: { en: { requiredField: 'Need {label}!' } } });
    expect(e.instanceState('a', null).errors).toEqual(['Need A!']);
    e.setStrings({ en: { requiredField: 'Please give {label}' } });
    expect(e.instanceState('a', null).errors).toEqual(['Please give A']);
  });

  it('says Yes/No in the form language', () => {
    const c = f('c', 'checkbox');
    expect(formatValue(c, true, 'dv', 'en', UI_FB_STRINGS_DV)).toBe('އާނ');
    expect(formatValue(c, false, 'dv', 'en', UI_FB_STRINGS_DV)).toBe('ނޫން');
    expect(formatValue(c, true)).toBe('Yes');
  });

  it('words comparison and relative date messages', () => {
    const d = def([f('a', 'number', { label: 'A' }), f('b', 'number', { label: 'B', validators: [{ id: 'c', type: 'compareField', params: { comparison: 'gt', field: 'a' } }] })]);
    const e = engine(d, { data: { a: 5, b: 1 } });
    expect(e.instanceState('b', null).errors).toEqual(['B must be more than “A”.']);
    expect(engine(d, { data: { a: 5, b: 1 }, locale: 'dv' }).instanceState('b', null).errors[0]).toContain(UI_FB_STRINGS_DV.compareGt);
  });

  it('takes a message by language from a registered check', () => {
    const check: UiFbValidatorDef = { type: 'taken', label: 'Taken', defaultMessage: { en: 'Taken.', dv: 'ނެގިފައި.' }, validate: () => false };
    const d = def([f('a', 'text', { validators: [{ id: 'r', type: 'taken' }] })]);
    const e = engine(d, { validators: [check], data: { a: 'x' } });
    expect(e.instanceState('a', null).errors).toEqual(['Taken.']);
    e.setLocale('dv');
    expect(e.instanceState('a', null).errors).toEqual(['ނެގިފައި.']);
    expect(validatorMessage({ type: 'zzz' }, UI_FB_STRINGS_EN)).toBe('{label} is not valid.');
  });

  it('names repeat entries in the form language', () => {
    const g = { kind: 'group', id: 'g', key: 'g', repeat: { min: 1 }, elements: [f('n', 'text', { required: true })] } as UiFbElement;
    const e = engine(def([g]), { locale: 'dv' });
    expect(e.instanceLabel('n', e.rows('g')[0])).toContain('އެންޓްރީ 1');
  });
});

@Component({
  imports: [UiFormRenderer],
  template: `<ui-form-renderer [definition]="def()" [locale]="locale()" [strings]="strings()" [data]="data()" [mode]="mode()" />`,
})
class Host {
  def = signal<UiFormDefinition>(def([]));
  locale = signal<string | null>(null);
  strings = signal<UiFbStringOverrides | null>(null);
  data = signal<Record<string, unknown> | null>(null);
  mode = signal<'create' | 'edit' | 'view' | null>(null);
}

async function render(d: UiFormDefinition, setup: (h: Host) => void = () => undefined) {
  const fx = TestBed.createComponent(Host);
  fx.componentInstance.def.set(d);
  setup(fx.componentInstance);
  fx.detectChanges();
  await fx.whenStable();
  fx.detectChanges();
  const settle = async () => { fx.detectChanges(); await fx.whenStable(); fx.detectChanges(); };
  return { fx, el: fx.nativeElement as HTMLElement, host: fx.componentInstance, settle };
}

describe('UiFormRenderer strings', () => {
  const text = (el: HTMLElement, sel: string) => el.querySelector(sel)?.textContent?.trim();

  it('shows English as before', async () => {
    const { el } = await render(two([f('a', 'text', { required: true })]));
    expect(text(el, '.ui-fr-step')).toBe('Step 1 of 2: One');
    expect(text(el, 'button[type=submit]')).toBe('Continue');
  });

  it('words buttons, step text and errors in Dhivehi, and re-words a visible error on a language change', async () => {
    const { el, host, settle, fx } = await render(two([f('a', 'text', { label: { en: 'A', dv: 'އޭ' }, required: true })]), (h) => h.locale.set('dv'));
    expect(text(el, '.ui-fr-step')).toBe('ފިޔަވަޅު 2 އިން 1: One');
    expect(text(el, 'button[type=submit]')).toBe(UI_FB_STRINGS_DV.next);
    (el.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle();
    expect(text(el, '.ui-fr-summary-title')).toBe(UI_FB_STRINGS_DV.problemOne);
    expect(text(el, '.ui-fr-summary li')).toBe('އޭ ފުރިހަމަ ކުރަންޖެހެއެވެ.');
    host.locale.set('en');
    await settle();
    expect(text(el, '.ui-fr-summary-title')).toBe('There is a problem');
    expect(text(el, '.ui-fr-summary li')).toBe('A is required.');
    fx.destroy();
  });

  it('shows the last page words and Yes/No in Dhivehi', async () => {
    const { el } = await render(def([f('c', 'checkbox', { label: 'C' }), f('t', 'toggle', { label: 'T' })]), (h) => { h.locale.set('dv'); h.data.set({ c: true, t: false }); h.mode.set('view'); });
    const values = Array.from(el.querySelectorAll('.ui-fbf-value')).map((v) => v.textContent!.trim());
    expect(values).toEqual([UI_FB_STRINGS_DV.yes, UI_FB_STRINGS_DV.no]);
    const create = await render(def([f('a', 'text')]), (h) => h.locale.set('dv'));
    expect(text(create.el, 'button[type=submit]')).toBe(UI_FB_STRINGS_DV.submit);
  });

  it('lets a form-authored label win over the built-in word', async () => {
    const d = def([f('a', 'text')], { settings: { submitLabel: { en: 'Send', dv: 'ފޮނުވާ' } } });
    const { el } = await render(d, (h) => h.locale.set('dv'));
    expect(text(el, 'button[type=submit]')).toBe('ފޮނުވާ');
  });

  it('takes overrides from the input', async () => {
    const { el, host, settle } = await render(def([f('a', 'text')]), (h) => h.strings.set({ en: { submit: 'Go' } }));
    expect(text(el, 'button[type=submit]')).toBe('Go');
    host.strings.set({ en: { submit: 'Send now' } });
    await settle();
    expect(text(el, 'button[type=submit]')).toBe('Send now');
  });

  it('takes overrides from the provider, and the input wins', async () => {
    TestBed.configureTestingModule({ providers: [provideUiFormStrings({ en: { submit: 'From app', back: 'Retour' } })] });
    const { el, host, settle } = await render(def([f('a', 'text')]));
    expect(text(el, 'button[type=submit]')).toBe('From app');
    host.strings.set({ en: { submit: 'From input' } });
    await settle();
    expect(text(el, 'button[type=submit]')).toBe('From input');
  });

  it('words the placeholders of the controls in Dhivehi', async () => {
    const { el } = await render(def([f('s', 'select', { options: [{ id: 'o', value: 'x', label: 'X' }] })]), (h) => h.locale.set('dv'));
    expect(el.textContent).toContain(UI_FB_STRINGS_DV.choose);
  });
});

