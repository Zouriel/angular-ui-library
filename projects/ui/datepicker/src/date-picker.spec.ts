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

describe('UiDatePicker month and year grids', () => {
  it('move a single tab stop with the arrow keys, Home/End and PageUp/PageDown', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const field = f.nativeElement.querySelector('ui-date-picker input') as HTMLInputElement;
    const active = () => document.activeElement as HTMLElement;
    const press = async (k: string) => { key(active(), k); await f.whenStable(); };
    key(field, 'Enter');
    await f.whenStable();

    // Month grid opens on the month in view (March 2026), with one tab stop.
    (document.querySelectorAll('.cal-panel .lbl')[0] as HTMLElement).click();
    await f.whenStable();
    expect(active().getAttribute('data-month')).toBe('2');
    expect(document.querySelectorAll('.cal-panel .mcell[tabindex="0"]').length).toBe(1);
    await press('ArrowDown');
    expect(active().getAttribute('data-month')).toBe('5');
    await press('ArrowRight');
    expect(active().getAttribute('data-month')).toBe('6');
    await press('Home');
    expect(active().getAttribute('data-month')).toBe('0');
    await press('ArrowUp'); // off the top row: stays
    expect(active().getAttribute('data-month')).toBe('0');
    await press('End');
    expect(active().getAttribute('data-month')).toBe('11');
    await press('PageUp');
    expect(active().getAttribute('aria-label')).toMatch(/2025$/);
    // Enter/Space activate the native button, which is a click.
    active().click();
    await f.whenStable();
    expect(active().getAttribute('data-iso')).toBe('2025-12-01');

    // Year grid opens on the year in view and turns the page when moving past its ends.
    (document.querySelectorAll('.cal-panel .lbl')[1] as HTMLElement).click();
    await f.whenStable();
    expect(active().getAttribute('data-year')).toBe('2025');
    await press('ArrowUp');
    expect(active().getAttribute('data-year')).toBe('2022');
    await press('Home');
    expect(active().getAttribute('data-year')).toBe('2016');
    await press('ArrowLeft');
    expect(active().getAttribute('data-year')).toBe('2015');
    expect(document.querySelector('.cal-panel .mcell[data-year="2004"]')).not.toBeNull();
    await press('PageDown');
    expect(active().getAttribute('data-year')).toBe('2027');
    await press('End');
    expect(active().getAttribute('data-year')).toBe('2027');
    active().click();
    await f.whenStable();
    // Picking a year goes to its months, focused on the month in view.
    expect(active().getAttribute('data-month')).toBe('11');
    expect(active().getAttribute('aria-label')).toMatch(/2027$/);
    expect(f.componentInstance.date.value).toBe('2026-03-15');
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

@Component({
  imports: [ReactiveFormsModule, UiDatePicker],
  template: `<ui-date-picker [formControl]="date" />`,
})
class EmptyHost {
  // Apps often start a date field at '' rather than null.
  date = new FormControl<string | null>('');
}

describe('UiDatePicker with an empty value', () => {
  it("treats '' as no date and opens on today's month, days and all", async () => {
    const f = TestBed.createComponent(EmptyHost);
    f.detectChanges();
    await f.whenStable();
    const field = f.nativeElement.querySelector('ui-date-picker input') as HTMLInputElement;
    expect(field.value).toBe('');

    key(field, 'Enter');
    await f.whenStable();
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    expect(document.querySelectorAll('.cal-panel .cell[data-iso]').length).toBeGreaterThan(27);
    expect((document.activeElement as HTMLElement).getAttribute('data-iso')).toBe(today);
  });
});
