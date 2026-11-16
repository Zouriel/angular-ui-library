import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiDatePicker } from './date-picker';
import { UiDateTimePicker, uiSplitDateTime } from './date-time-picker';

/** 0.87.0: a day and a time of day in one field. */
@Component({
  imports: [FormsModule, UiDateTimePicker],
  template: `<ui-date-time-picker [(ngModel)]="value" [min]="min()" max="2026-12-31" [step]="step()" [disabled]="off()" />`,
})
class Host {
  value: string | null = null;
  min = signal<string | null>('2026-11-01T08:00');
  step = signal(60);
  off = signal(false);
}

/** A component's own CSS, as compiled: scoping attributes dropped, whitespace collapsed, attribute quotes gone. */
const cssOf = (c: unknown) => ((c as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\[_ngcontent-%COMP%\]/g, '').replace(/\s+/g, ' ');

async function render(value: string | null = null) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.value = value;
  // ngModel writes a microtask later, and the inner fields' ngModel a microtask after that.
  const settle = async () => { for (let i = 0; i < 3; i++) { fixture.detectChanges(); await fixture.whenStable(); } fixture.detectChanges(); };
  await settle();
  const el = fixture.nativeElement as HTMLElement;
  const picker = fixture.debugElement.query((d) => d.componentInstance instanceof UiDateTimePicker).componentInstance as UiDateTimePicker;
  const date = fixture.debugElement.query((d) => d.componentInstance instanceof UiDatePicker).componentInstance as UiDatePicker;
  const time = el.querySelector('ui-time-picker input') as HTMLInputElement;
  const typeTime = async (v: string) => { time.value = v; time.dispatchEvent(new Event('input')); await settle(); };
  const pickDay = async (iso: string) => { (date as unknown as { pick(d: string): void }).pick(iso); await settle(); };
  return { fixture, el, picker, date, time, typeTime, pickDay, settle };
}

describe('uiSplitDateTime', () => {
  it('splits a date-time into its parts and refuses anything else', () => {
    expect(uiSplitDateTime('2026-11-17T14:30')).toEqual({ date: '2026-11-17', time: '14:30' });
    expect(uiSplitDateTime('2026-11-17T14:30:05')).toEqual({ date: '2026-11-17', time: '14:30:05' });
    expect(uiSplitDateTime('2026-11-17')).toEqual({ date: '2026-11-17', time: null });
    expect(uiSplitDateTime('17/11/2026 14:30')).toEqual({ date: null, time: null });
    expect(uiSplitDateTime(null)).toEqual({ date: null, time: null });
  });
});

describe('UiDateTimePicker', () => {
  it('shows a given value in both fields', async () => {
    const { time, date } = await render('2026-11-20T15:45');
    expect(time.value).toBe('15:45');
    expect((date as unknown as { value(): string }).value()).toBe('2026-11-20');
  });

  it('picking a day first takes the default time (shown at once); then the time changes it', async () => {
    const { fixture, time, typeTime, pickDay } = await render();
    await pickDay('2026-11-20');
    expect(fixture.componentInstance.value).toBe('2026-11-20T09:00');
    expect(time.value).toBe('09:00');
    await typeTime('16:15');
    expect(fixture.componentInstance.value).toBe('2026-11-20T16:15');
    // Clearing the time keeps the day, at the default time.
    await typeTime('');
    expect(fixture.componentInstance.value).toBe('2026-11-20T09:00');
  });

  it('a time typed before any day waits for the day; with none the value stays empty', async () => {
    const { fixture, typeTime, pickDay } = await render();
    await typeTime('07:30');
    expect(fixture.componentInstance.value).toBeNull();
    await pickDay('2026-11-21');
    expect(fixture.componentInstance.value).toBe('2026-11-21T07:30');
  });

  it('limits the calendar to the days of min and max, names its two parts and is a group', async () => {
    const { el, date } = await render();
    expect(date.min()).toBe('2026-11-01');
    expect(date.max()).toBe('2026-12-31');
    expect(el.querySelector('ui-date-time-picker')?.getAttribute('role')).toBe('group');
    expect(el.querySelector('ui-date-picker input')?.getAttribute('aria-label')).toBe('Date');
    expect(el.querySelector('ui-time-picker input')?.getAttribute('aria-label')).toBe('Time');
  });

  it('takes the Dhivehi names with the Dhivehi strings, and turns off both parts', async () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const { fixture, el, time, settle } = await render();
    expect(el.querySelector('ui-date-picker input')?.getAttribute('aria-label')).toBe(uiStringsDv.dateLabel);
    expect(el.querySelector('ui-time-picker input')?.getAttribute('aria-label')).toBe(uiStringsDv.timeLabel);
    fixture.componentInstance.off.set(true);
    await settle();
    expect(time.disabled).toBe(true);
    expect((el.querySelector('ui-date-picker input') as HTMLInputElement).disabled).toBe(true);
  });

  it('stacks its parts in a narrow box', () => {
    expect(cssOf(UiDateTimePicker)).toMatch(/@container \(max-width: 320px\) \{ \.row \{ flex-direction: column/);
  });
});
