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
    <ui-combobox class="fixed" [options]="options()" [formControl]="fixed" [clearable]="false" />
  `,
})
class Host {
  options = signal<UiComboboxOption[]>([]);
  country = new FormControl<string | null>('ca');
  many = new FormControl<string[]>([]);
  fixed = new FormControl<string | null>('ca');
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

  it('clears a chosen value with the Clear button and returns focus to the field', async () => {
    const { f, combo, panels } = await setup();
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }]);
    await f.whenStable();
    const clear = f.nativeElement.querySelector('ui-combobox .clear') as HTMLButtonElement;
    expect(clear.getAttribute('aria-label')).toBe('Clear');
    clear.click();
    await f.whenStable();
    expect(f.componentInstance.country.value).toBeNull();
    expect(combo.value).toBe('');
    expect(document.activeElement).toBe(combo);
    expect(panels()).toBe(0);
    // No value, no button.
    expect(f.nativeElement.querySelector('ui-combobox .clear')).toBeNull();
  });

  it('clears when the text is emptied and the field is left', async () => {
    const { f, combo } = await setup();
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }]);
    await f.whenStable();
    combo.value = '';
    combo.dispatchEvent(new Event('input'));
    combo.dispatchEvent(new FocusEvent('blur'));
    await f.whenStable();
    expect(f.componentInstance.country.value).toBeNull();
    expect(f.componentInstance.country.touched).toBe(true);
  });

  it('keeps the value when clearable is off, and hides Clear when disabled', async () => {
    const { f } = await setup();
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }]);
    await f.whenStable();
    const fixed = f.nativeElement.querySelector('ui-combobox.fixed input') as HTMLInputElement;
    expect(f.nativeElement.querySelector('ui-combobox.fixed .clear')).toBeNull();
    fixed.value = '';
    fixed.dispatchEvent(new Event('input'));
    fixed.dispatchEvent(new FocusEvent('blur'));
    await f.whenStable();
    expect(f.componentInstance.fixed.value).toBe('ca');
    expect(fixed.value).toBe('Canada');
    f.componentInstance.country.disable();
    await f.whenStable();
    expect(f.nativeElement.querySelector('ui-combobox .clear')).toBeNull();
  });

  it('empties a multi-select with Clear all', async () => {
    const { f, multi, panels } = await setup();
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }, { label: 'Japan', value: 'jp' }]);
    expect(f.nativeElement.querySelector('ui-multi-select .clear')).toBeNull();
    f.componentInstance.many.setValue(['ca', 'jp']);
    await f.whenStable();
    const clear = f.nativeElement.querySelector('ui-multi-select .clear') as HTMLButtonElement;
    expect(clear.getAttribute('aria-label')).toBe('Clear all');
    clear.click();
    await f.whenStable();
    expect(f.componentInstance.many.value).toEqual([]);
    expect(document.activeElement).toBe(multi);
    expect(panels()).toBe(0);
    expect(f.nativeElement.querySelector('ui-multi-select .clear')).toBeNull();
  });

  it('follows the form control disabled state', async () => {
    const { f, combo, multi } = await setup();
    f.componentInstance.country.disable();
    f.componentInstance.many.disable();
    await f.whenStable();
    expect(combo.disabled).toBe(true);
    expect(multi.disabled).toBe(true);
  });

  it('draws a chevron on the multi-select, like the combobox', async () => {
    const { f } = await setup();
    expect(f.nativeElement.querySelector('ui-multi-select .end .chevron')).not.toBeNull();
  });

  it('drops the chip remove buttons of a disabled multi-select, as it drops Clear all', async () => {
    const { f } = await setup();
    f.componentInstance.options.set([{ label: 'Canada', value: 'ca' }, { label: 'Japan', value: 'jp' }]);
    f.componentInstance.many.setValue(['ca', 'jp']);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('ui-multi-select .chip .x').length).toBe(2);
    f.componentInstance.many.disable();
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('ui-multi-select .chip').length).toBe(2);
    expect(f.nativeElement.querySelectorAll('ui-multi-select .chip .x').length).toBe(0);
    expect(f.nativeElement.querySelector('ui-multi-select .clear')).toBeNull();
  });
});

@Component({
  imports: [ReactiveFormsModule, UiCombobox],
  template: `<ui-combobox [options]="fonts" [formControl]="font" [fontPreview]="true" />`,
})
class FontHost {
  fonts: UiComboboxOption[] = [{ label: 'Georgia', value: 'Georgia' }, { label: 'Open Sans', value: 'Open Sans' }];
  font = new FormControl<string | null>('Georgia');
}

describe('UiCombobox font preview', () => {
  it('draws the chosen value and every option in its own font', async () => {
    const f = TestBed.createComponent(FontHost);
    f.detectChanges();
    await f.whenStable();
    const input = f.nativeElement.querySelector('ui-combobox input') as HTMLInputElement;
    expect(input.style.fontFamily).toContain('Georgia');
    input.focus();
    input.click();
    f.detectChanges();
    await f.whenStable();
    const opts = [...document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role=option]')];
    expect(opts.map((o) => o.style.fontFamily)).toEqual(['"Georgia", system-ui, sans-serif', '"Open Sans", system-ui, sans-serif']);
  });
});

describe('UiCombobox opening with a value', () => {
  it('lists every option with the chosen one active, and filters only after typing', async () => {
    const f = TestBed.createComponent(FontHost);
    f.detectChanges();
    await f.whenStable();
    const input = f.nativeElement.querySelector('ui-combobox input') as HTMLInputElement;
    input.value = 'Open Sans';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    f.componentInstance.font.setValue('Open Sans');
    input.dispatchEvent(new FocusEvent('blur'));
    f.detectChanges();
    input.click();
    f.detectChanges();
    await f.whenStable();
    const opts = () => [...document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role=option]')];
    expect(opts().length).toBe(2);
    expect(opts()[1].classList.contains('active')).toBe(true);
    input.value = 'geo';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(opts().map((o) => o.textContent!.trim())).toEqual(['Georgia']);
  });
});
