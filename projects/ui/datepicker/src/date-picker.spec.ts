import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiDatePicker } from './date-picker';
import { UiCalendar } from './calendar';
import { UiDateRangePicker, type UiDateRange } from './date-range-picker';

@Component({
  imports: [ReactiveFormsModule, UiDatePicker, UiCalendar, UiDateRangePicker],
  template: `
    <ui-date-picker [formControl]="date" />
    <ui-calendar [formControl]="day" />
    <ui-date-range-picker [formControl]="range" />
  `,
})
class Host {
  date = new FormControl<string | null>('2026-03-15');
  day = new FormControl<string | null>('2026-03-15');
  range = new FormControl<UiDateRange>({ start: '2025-11-02', end: '2025-11-09' });
}

const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('UiDatePicker keyboard', () => {
  it('opens from the keyboard onto the chosen day and moves by day and week', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const field = f.nativeElement.querySelector('ui-date-picker input') as HTMLInputElement;
    expect(field.getAttribute('aria-haspopup')).toBe('dialog');

    key(field, 'Enter');
    await f.whenStable();
    const active = () => document.activeElement as HTMLElement;
    expect(active().getAttribute('data-iso')).toBe('2026-03-15');

    key(active(), 'ArrowRight');
    await f.whenStable();
    expect(active().getAttribute('data-iso')).toBe('2026-03-16');
    key(active(), 'ArrowUp');
    await f.whenStable();
    expect(active().getAttribute('data-iso')).toBe('2026-03-09');
    key(active(), 'PageDown');
    await f.whenStable();
    expect(active().getAttribute('data-iso')).toBe('2026-04-09');

    active().click();
    await f.whenStable();
    expect(f.componentInstance.date.value).toBe('2026-04-09');
    expect(document.activeElement).toBe(field);
    expect(document.querySelectorAll('.cal-panel').length).toBe(0);
  });

  it('closes on Escape and returns focus to the field', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const field = f.nativeElement.querySelector('ui-date-picker input') as HTMLInputElement;
    key(field, 'ArrowDown');
    await f.whenStable();
    key(document.activeElement!, 'Escape');
    await f.whenStable();
    expect(document.querySelectorAll('.cal-panel').length).toBe(0);
    expect(document.activeElement).toBe(field);
  });
});

describe('inline calendars', () => {
  it('name every day in full and mark the chosen ones', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const chosen = f.nativeElement.querySelector('ui-calendar [aria-pressed="true"]') as HTMLElement;
    expect(chosen.textContent?.trim()).toBe('15');
    expect(chosen.getAttribute('aria-label')).toMatch(/2026/);
    // The range picker opens on the month its range starts in.
    const pressed = f.nativeElement.querySelectorAll('ui-date-range-picker [aria-pressed="true"]');
    expect(pressed.length).toBe(8);
  });
});
