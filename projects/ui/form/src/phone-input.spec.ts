import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiFormField } from './form-field';
import {
  UI_PHONE_COUNTRIES,
  uiPhoneCountry,
  uiPhoneE164,
  uiPhoneFlag,
  uiPhoneSearch,
  uiPhoneSplit,
} from './phone';
import { UiPhoneInput } from './phone-input';

const split = (e164: string, def?: string) => {
  const r = uiPhoneSplit(e164.replace(/^\+/, ''), def);
  return r && `${r.country.iso2} ${r.national}`;
};
const out = (iso: string, text: string) => uiPhoneE164(uiPhoneCountry(iso)!, text);

describe('phone country data', () => {
  it('has every geographic country from libphonenumber, one main country per shared code', () => {
    expect(UI_PHONE_COUNTRIES.length).toBe(245);
    const isos = new Set(UI_PHONE_COUNTRIES.map((c) => c.iso2));
    expect(isos.size).toBe(245);
    for (const iso of ['GB', 'US', 'MV', 'CA', 'AG', 'RU', 'KZ', 'IT', 'IN', 'AE', 'XK']) expect(isos.has(iso), iso).toBe(true);
    const dials = new Set(UI_PHONE_COUNTRIES.map((c) => c.dial));
    for (const dial of dials) expect(UI_PHONE_COUNTRIES.filter((c) => c.dial === dial && c.main).length, `+${dial}`).toBe(1);
    expect(uiPhoneCountry('gb')).toMatchObject({ name: 'United Kingdom', dial: '44', trunk: '0', main: true });
    expect(uiPhoneCountry('mv')).toMatchObject({ name: 'Maldives', dial: '960', trunk: '' });
    expect(uiPhoneCountry('US')!.main).toBe(true);
    // Sorted by English name.
    const names = UI_PHONE_COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('builds the flag from regional indicator symbols', () => {
    expect([...uiPhoneFlag('GB')].map((c) => c.codePointAt(0)!.toString(16))).toEqual(['1f1ec', '1f1e7']);
    expect([...uiPhoneFlag('mv')].map((c) => c.codePointAt(0)!.toString(16))).toEqual(['1f1f2', '1f1fb']);
  });
});

describe('phone value in: the country from the dial code', () => {
  it('takes the longest dial code that exists', () => {
    expect(split('+447700900123')).toBe('GB 7700900123');
    expect(split('+9607771234')).toBe('MV 7771234');
    expect(split('+35312345678')).toBe('IE 12345678');
    expect(split('+390612345678')).toBe('IT 0612345678');
  });
  it('for a shared code: leading digits, then defaultCountry, then the main country', () => {
    expect(split('+12684641234')).toBe('AG 2684641234');
    expect(split('+12684641234', 'CA')).toBe('AG 2684641234');
    expect(split('+14165550123', 'CA')).toBe('CA 4165550123');
    expect(split('+14165550123')).toBe('US 4165550123');
    expect(split('+14165550123', 'GB')).toBe('US 4165550123');
    expect(split('+79161234567')).toBe('RU 9161234567');
    expect(split('+77012345678')).toBe('KZ 7012345678');
    expect(split('+447781123456', 'GG')).toBe('GG 7781123456');
    expect(split('+447781123456')).toBe('GB 7781123456');
  });
});

describe('phone value out: E.164', () => {
  it('drops punctuation and the trunk prefix', () => {
    expect(out('GB', '07700 900-123')).toBe('+447700900123');
    expect(out('GB', '(07700) 900.123')).toBe('+447700900123');
    expect(out('GB', '7700 900123')).toBe('+447700900123');
    expect(out('HU', '06 1 234 5678')).toBe('+3612345678');
    expect(out('US', '1 (212) 555-0123')).toBe('+12125550123');
    expect(out('US', '(212) 555-0123')).toBe('+12125550123');
    expect(out('RU', '8 916 123 45 67')).toBe('+79161234567');
    expect(out('RU', '800 123 45 67')).toBe('+78001234567');
    expect(out('MV', '777 1234')).toBe('+9607771234');
  });
  it('keeps a 0 that belongs to the number (Italy has no trunk prefix)', () => {
    expect(out('IT', '06 1234 5678')).toBe('+390612345678');
  });
  it('is null with no digits', () => {
    expect(out('GB', '')).toBeNull();
    expect(out('GB', ' - ')).toBeNull();
  });
});

describe('phone country search', () => {
  it('matches name, ISO code and dial code', () => {
    expect(uiPhoneSearch('maldiv').map((c) => c.iso2)).toEqual(['MV']);
    expect(uiPhoneSearch('kingdom').map((c) => c.iso2)).toEqual(['GB']);
    expect(uiPhoneSearch('gb').map((c) => c.iso2)).toContain('GB');
    expect(uiPhoneSearch('+960').map((c) => c.iso2)).toEqual(['MV']);
    expect(uiPhoneSearch('44').map((c) => c.iso2).sort()).toEqual(['GB', 'GG', 'IM', 'JE']);
    expect(uiPhoneSearch('').length).toBe(245);
    expect(uiPhoneSearch('zzzz')).toEqual([]);
  });
});

@Component({
  imports: [UiPhoneInput, ReactiveFormsModule, UiFormField],
  template: `
    <ui-phone-input class="a" [formControl]="ctrl" [defaultCountry]="def()" [invalid]="invalid()" (countryChange)="countries.push($event)" />
    <ui-form-field label="Mobile"><ui-phone-input class="b" /></ui-form-field>`,
})
class Host {
  ctrl = new FormControl<string | null>(null);
  def = signal<string | null>('GB');
  invalid = signal(false);
  countries: string[] = [];
}

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const field = () => el.querySelector('ui-phone-input.a input.num') as HTMLInputElement;
  const trigger = () => el.querySelector('ui-phone-input.a button.cty') as HTMLButtonElement;
  const type = (v: string) => {
    field().value = v;
    field().dispatchEvent(new Event('input'));
    f.detectChanges();
  };
  return { f, h: f.componentInstance, el, field, trigger, type };
}

describe('ui-phone-input', () => {
  it('starts on defaultCountry and outputs E.164 to the form', () => {
    const { h, trigger, type } = make();
    expect(trigger().textContent).toContain('+44');
    expect(trigger().getAttribute('aria-label')).toBe('Country: United Kingdom +44');
    type('07700 900-123');
    expect(h.ctrl.value).toBe('+447700900123');
    type('');
    expect(h.ctrl.value).toBeNull();
  });

  it('assumes no country without defaultCountry: a globe and "+", and no value', () => {
    const { f, h, el, trigger, type } = make();
    h.def.set(null);
    f.detectChanges();
    expect(trigger().textContent!.replace(/\s+/g, '')).toBe('+');
    expect(trigger().querySelector('hugeicons-icon.globe')).not.toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe('Country');
    type('7700900123');
    expect(h.ctrl.value).toBeNull();
    expect(el.querySelector('ui-phone-input.b button.cty')!.textContent!.replace(/\s+/g, '')).toBe('+');
  });

  it('shows a value from the form: country by dial code, national digits as stored', async () => {
    const { f, h, field, trigger } = make();
    h.ctrl.setValue('+12684641234');
    f.detectChanges();
    await Promise.resolve();
    expect(trigger().getAttribute('aria-label')).toBe('Country: Antigua & Barbuda +1');
    expect(field().value).toBe('2684641234');
    h.ctrl.setValue('+9607771234');
    f.detectChanges();
    expect(trigger().textContent).toContain('+960');
    expect(field().value).toBe('7771234');
    // A form value never counts as the user picking a country.
    expect(h.countries).toEqual([]);
  });

  it('switches country when a whole international number is typed or pasted', () => {
    const { h, field, trigger, type } = make();
    type('+960 777 1234');
    expect(trigger().textContent).toContain('+960');
    expect(field().value).toBe('7771234');
    expect(h.ctrl.value).toBe('+9607771234');
    type('0044 7700 900123');
    expect(h.ctrl.value).toBe('+447700900123');
    expect(h.countries).toEqual(['MV', 'GB']);
  });

  it('picks a country from the searchable list and moves to the number', async () => {
    const { f, h, trigger, type, field } = make();
    type('7771234');
    trigger().click();
    f.detectChanges();
    const search = document.querySelector('.cdk-overlay-container input.search') as HTMLInputElement;
    expect(search).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    search.value = 'maldives';
    search.dispatchEvent(new Event('input'));
    f.detectChanges();
    const opts = [...document.querySelectorAll('.cdk-overlay-container li[role="option"]')] as HTMLElement[];
    expect(opts.map((o) => o.dataset['iso'])).toEqual(['MV']);
    expect(opts[0].querySelector('.name')!.textContent!.trim()).toBe('Maldives');
    expect(opts[0].querySelector('.code')!.textContent!.trim()).toBe('+960');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    f.detectChanges();
    expect(h.ctrl.value).toBe('+9607771234');
    expect(h.countries).toEqual(['MV']);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(field());
  });

  it('closes the list on Escape and returns to the country button', () => {
    const { f, trigger } = make();
    trigger().click();
    f.detectChanges();
    const search = document.querySelector('.cdk-overlay-container input.search') as HTMLInputElement;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('marks itself invalid and disabled like the other fields', () => {
    const { f, h, el, field, trigger } = make();
    h.invalid.set(true);
    f.detectChanges();
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('ui-phone-input.a .frame')!.classList).toContain('invalid');
    h.ctrl.disable();
    f.detectChanges();
    expect(field().disabled).toBe(true);
    expect(trigger().disabled).toBe(true);
  });

  it('lets a form field label name the number field', () => {
    const { el } = make();
    const label = el.querySelector('ui-form-field label') as HTMLLabelElement;
    const field = el.querySelector('ui-phone-input.b input.num') as HTMLInputElement;
    expect(label.htmlFor).toBe(field.id);
    // No aria-label of its own there (it would hide the visible label); outside a field it has one.
    expect(field.getAttribute('aria-label')).toBeNull();
    expect((el.querySelector('ui-phone-input.a input.num') as HTMLInputElement).getAttribute('aria-label')).toBe('Phone number');
  });
});
