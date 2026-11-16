import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiFbServerErrorItem } from './engine';
import { UiFormRenderer } from './form-renderer';
import type { UiFormDefinition, UiFormSubmission } from './schema';

/** 0.87.0: starting answers for a new submission, and errors from the server on their fields. */
const def: UiFormDefinition = {
  schemaVersion: 1, id: 'apply', title: 'Apply', revision: 2,
  pages: [{
    id: 'p1',
    elements: [
      { kind: 'field', id: 'name', type: 'text', key: 'full_name', label: 'Full name', required: true },
      { kind: 'field', id: 'island', type: 'text', key: 'island', label: 'Island', defaultValue: 'Hithadhoo' },
      { kind: 'group', id: 'addr', key: 'address', title: 'Address', elements: [{ kind: 'field', id: 'city', type: 'text', key: 'city', label: 'City' }] },
    ],
  }],
};

@Component({
  imports: [UiFormRenderer],
  template: `<ui-form-renderer [definition]="def" [prefill]="prefill()" [serverErrors]="errors()" (submitted)="got.push($event)" (serverErrorsUnmatched)="unmatched.push($event)" />`,
})
class Host {
  def = def;
  prefill = signal<Record<string, unknown> | null>({ full_name: 'Aisha Ali', address: { city: 'Addu' }, efaas_id: 'A1' });
  errors = signal<Record<string, string | string[]> | null>(null);
  got: UiFormSubmission[] = [];
  unmatched: UiFbServerErrorItem[][] = [];
}

async function render() {
  const fx = TestBed.createComponent(Host);
  fx.detectChanges();
  await fx.whenStable();
  fx.detectChanges();
  const el = fx.nativeElement as HTMLElement;
  const input = (label: string) => [...el.querySelectorAll('ui-fb-field')].find((f) => f.textContent?.includes(label))!.querySelector('input') as HTMLInputElement;
  const type = async (label: string, v: string) => {
    const i = input(label);
    i.value = v;
    i.dispatchEvent(new Event('input'));
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
  };
  const settle = async () => { fx.detectChanges(); await fx.whenStable(); fx.detectChanges(); };
  return { fx, el, input, type, settle };
}

describe('UiFormRenderer prefill (create mode)', () => {
  it('fills in the starting answers but stays a new submission: Submit, no change list, defaults kept, extra keys dropped', async () => {
    const { fx, el, input } = await render();
    expect(input('Full name').value).toBe('Aisha Ali');
    expect(input('City').value).toBe('Addu');
    expect(input('Island').value).toBe('Hithadhoo');
    expect(el.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Submit');
    expect(el.querySelector('.ui-fr-changes, .ui-fr-saved')).toBeNull();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(fx.componentInstance.got[0].values).toEqual({ full_name: 'Aisha Ali', island: 'Hithadhoo', address: { city: 'Addu' } });
  });
});

describe('UiFormRenderer serverErrors', () => {
  it('shows each message on its field and in the summary (unmatched first, as plain text), and reports the unmatched', async () => {
    const { fx, el, settle } = await render();
    fx.componentInstance.errors.set({ full_name: ['Use the name on your ID card.'], 'address.city': 'Unknown city.', office: 'Applications are closed.' });
    await settle();
    const fields = [...el.querySelectorAll('ui-fb-field')];
    expect(fields[0].textContent).toContain('Use the name on your ID card.');
    expect(fields.find((f) => f.textContent?.includes('City'))?.textContent).toContain('Unknown city.');
    const summary = el.querySelector('.ui-fr-summary') as HTMLElement;
    expect(summary.querySelector('h3')?.textContent).toContain('3');
    const items = [...summary.querySelectorAll('li')];
    expect(items[0].textContent?.trim()).toBe('Applications are closed.');
    expect(items[0].querySelector('a')).toBeNull();
    expect(items.slice(1).map((li) => li.querySelector('a')?.textContent?.trim())).toEqual(['Use the name on your ID card.', 'Unknown city.']);
    expect(fx.componentInstance.unmatched).toEqual([[{ path: 'office', message: 'Applications are closed.' }]]);
  });

  it('a field’s message goes away when its answer changes; submitting is refused until then', async () => {
    const { fx, el, type, settle } = await render();
    fx.componentInstance.errors.set({ full_name: 'Use the name on your ID card.' });
    await settle();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(fx.componentInstance.got).toHaveLength(0);
    await type('Full name', 'Aisha A. Ali');
    expect(el.textContent).not.toContain('Use the name on your ID card.');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(fx.componentInstance.got).toHaveLength(1);
    expect(fx.componentInstance.got[0].values['full_name']).toBe('Aisha A. Ali');
  });

  it('null clears the messages', async () => {
    const { fx, el, settle } = await render();
    fx.componentInstance.errors.set({ full_name: 'Nope.' });
    await settle();
    expect(el.textContent).toContain('Nope.');
    fx.componentInstance.errors.set(null);
    await settle();
    expect(el.textContent).not.toContain('Nope.');
  });
});
