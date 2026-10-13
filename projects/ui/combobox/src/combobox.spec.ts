import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiCombobox, type UiComboboxOption } from './combobox';
import { UiMultiSelect } from './multi-select';

@Component({
  imports: [ReactiveFormsModule, UiCombobox, UiMultiSelect],
  template: `
    <ui-combobox [options]="options()" [formControl]="country" />
    <ui-multi-select [options]="options()" [formControl]="many" />
  `,
})
class Host {
  options = signal<UiComboboxOption[]>([]);
  country = new FormControl<string | null>('ca');
  many = new FormControl<string[]>([]);
}

describe('UiCombobox / UiMultiSelect', () => {
  async function setup() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const combo = f.nativeElement.querySelector('ui-combobox input') as HTMLInputElement;
    const multi = f.nativeElement.querySelector('ui-multi-select input') as HTMLInputElement;
    const panels = () => document.querySelectorAll('.cdk-overlay-container .panel').length;
    return { f, combo, multi, panels };
  }

  it('shows the label of a value whose options arrive later', async () => {
    const { f, combo } = await setup();
    expect(combo.value).toBe('');
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }, { label: 'Japan', value: 'jp' }]);
    await f.whenStable();
    expect(combo.value).toBe('Canada');
  });

  it('closes the list when focus leaves the field', async () => {
    const { f, combo, multi, panels } = await setup();
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }]);
    await f.whenStable();
    for (const field of [combo, multi]) {
      field.dispatchEvent(new FocusEvent('focus'));
      await f.whenStable();
      expect(panels()).toBe(1);
      field.dispatchEvent(new FocusEvent('blur'));
      await f.whenStable();
      expect(panels()).toBe(0);
    }
  });

  it('follows the form control disabled state', async () => {
    const { f, combo, multi } = await setup();
    f.componentInstance.country.disable();
    f.componentInstance.many.disable();
    await f.whenStable();
    expect(combo.disabled).toBe(true);
    expect(multi.disabled).toBe(true);
  });
});
