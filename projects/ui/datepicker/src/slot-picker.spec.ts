import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiSlotPicker, type UiSlot } from './slot-picker';

@Component({
  imports: [UiSlotPicker, ReactiveFormsModule],
  template: `
    <ui-slot-picker
      [slots]="slots()"
      [(value)]="value"
      [lowAt]="lowAt()"
      [columns]="columns()"
      label="Session time" />
    <ui-slot-picker
      id="cva"
      [slots]="slots()"
      [formControl]="ctrl"
      label="Appointment" />
  `,
})
class Host {
  slots = signal<UiSlot[]>([
    { id: 's1', label: '09:00 – 10:00', note: 'Morning', remaining: 8 },
    { id: 's2', label: '10:30 – 11:30', remaining: 3 },
    { id: 's3', label: '13:00 – 14:00', remaining: 0 },
    { id: 's4', label: '14:30 – 15:30', remaining: 5 },
    { id: 's5', label: '16:00 – 17:00', disabled: true, remaining: 2 },
  ]);
  value = signal<string | null>(null);
  lowAt = signal(5);
  columns = signal<number | 'auto'>('auto');
  ctrl = new FormControl<string | null>('s2');
}

describe('UiSlotPicker', () => {
  const buttons = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>('button[role="radio"]')];

  it('renders a radiogroup with one tab stop and selects on click', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const picker = el.querySelector('ui-slot-picker')!;
    const group = picker.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Session time');

    const btns = buttons(picker);
    expect(btns).toHaveLength(5);
    expect(btns.map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);

    btns[1].click();
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('s2');
    expect(btns[1].getAttribute('aria-checked')).toBe('true');
    expect(btns[1].classList.contains('selected')).toBe(true);
    expect(btns.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1', '-1']);
  });

  it('disables remaining: 0 with slotFull and marks remaining <= lowAt as low', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const picker = (f.nativeElement as HTMLElement).querySelector('ui-slot-picker')!;
    const btns = buttons(picker);

    // s1: 8 left, not low
    expect(btns[0].querySelector('.remaining')?.textContent?.trim()).toBe('8 left');
    expect(btns[0].querySelector('.remaining')?.classList.contains('low')).toBe(false);
    expect(btns[0].disabled).toBe(false);

    // s2: 3 left, low
    expect(btns[1].querySelector('.remaining')?.textContent?.trim()).toBe('3 left');
    expect(btns[1].querySelector('.remaining')?.classList.contains('low')).toBe(true);

    // s3: remaining: 0 -> disabled + Full
    expect(btns[2].disabled).toBe(true);
    expect(btns[2].querySelector('.remaining')?.textContent?.trim()).toBe('Full');

    // s4: remaining: 5 == lowAt -> low
    expect(btns[3].querySelector('.remaining')?.classList.contains('low')).toBe(true);

    // s5: disabled: true
    expect(btns[4].disabled).toBe(true);
  });

  it('navigates and selects with Arrow keys, Home, and End skipping disabled slots', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const picker = (f.nativeElement as HTMLElement).querySelector('ui-slot-picker')!;
    const btns = buttons(picker);

    // From s1, ArrowRight -> s2
    btns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('s2');

    // From s2, ArrowDown -> skips disabled s3, selects s4
    btns[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('s4');

    // End -> last enabled (s4, since s5 is disabled)
    btns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('s4');

    // Home -> first enabled (s1)
    btns[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('s1');
  });

  it('supports ControlValueAccessor and columns input', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const cva = (f.nativeElement as HTMLElement).querySelector('#cva')!;
    expect(buttons(cva)[1].getAttribute('aria-checked')).toBe('true');

    buttons(cva)[0].click();
    f.detectChanges();
    expect(f.componentInstance.ctrl.value).toBe('s1');

    f.componentInstance.ctrl.disable();
    f.detectChanges();
    expect(buttons(cva).every((b) => b.disabled)).toBe(true);

    f.componentInstance.columns.set(3);
    f.detectChanges();
    const grid = (f.nativeElement as HTMLElement).querySelector('ui-slot-picker .grid') as HTMLElement;
    expect(grid.classList.contains('fixed-cols')).toBe(true);
    expect(grid.style.getPropertyValue('--ui-slot-cols')).toBe('3');
  });

  it('uses Dhivehi strings when provided', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const btns = buttons((f.nativeElement as HTMLElement).querySelector('ui-slot-picker')!);
    expect(btns[0].querySelector('.remaining')?.textContent?.trim()).toBe('8 ބާކީ');
    expect(btns[2].querySelector('.remaining')?.textContent?.trim()).toBe('ފުރިއްޖެ');
  });
});
