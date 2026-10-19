import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, Injector, afterNextRender, computed, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import Calendar01Icon from '@hugeicons/core-free-icons/Calendar01Icon';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';
import { formatIsoDate, isoMonth, MONTHS, MONTHS_SHORT, WEEKDAYS } from './date-names';

interface DayCell { day: number; iso: string; label: string; today: boolean; disabled: boolean; }

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * `ui-date-picker` — calendar popover (CVA; value is an ISO `YYYY-MM-DD`
 * string). Backed by the CDK Overlay; closes on outside click / Escape.
 *
 * Keyboard: Enter, Space or ArrowDown on the field opens it with focus on the chosen day (or today).
 * Arrow keys move by day and week (crossing months), PageUp/PageDown by month, Home/End to the
 * month's ends; Enter picks. The month and year grids (opened from the heading) work the same way:
 * one tab stop, Arrow keys move (Up/Down by a row of three), Home/End to the first/last cell,
 * PageUp/PageDown by a year (month grid) or a page of 12 years (year grid), Enter or Space picks;
 * opening a grid focuses the month or year in view. Tab stays inside the popover; Escape closes it
 * and returns to the field.
 */
@Component({
  selector: 'ui-date-picker',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, CdkTrapFocus, HugeiconsIconComponent],
  template: `
    <div class="wrap" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <input
        #field
        class="ui-date"
        readonly
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.placeholder]="placeholder()"
        [value]="display()"
        [disabled]="disabled()"
        (click)="toggle()"
        (keydown)="onFieldKey($event)"
        (blur)="onTouched()" />
      <span class="cal" aria-hidden="true">
        <hugeicons-icon [icon]="calendarIcon" [size]="16" [strokeWidth]="1.8" />
      </span>
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="onOutsideClick($event)"
      (attach)="focusDay(value() || todayIso())">
      <div class="cal-panel" role="dialog" aria-label="Choose a date" cdkTrapFocus (keydown.escape)="close()">
        <div class="cal-head">
          <button type="button" class="nav" [attr.aria-label]="prevLabel()" (click)="shift(-1)"><hugeicons-icon [icon]="prevIcon" [size]="16" [strokeWidth]="1.8" /></button>
          @if (mode() === 'days') {
            <span class="heading">
              <button type="button" class="lbl" (click)="showMonths()">{{ monthName() }}</button>
              <button type="button" class="lbl" (click)="showYears()">{{ view()[0] }}</button>
            </span>
          } @else if (mode() === 'months') {
            <button type="button" class="lbl" (click)="showYears()">{{ view()[0] }}</button>
          } @else {
            <span class="heading-static">{{ yearRange() }}</span>
          }
          <button type="button" class="nav" [attr.aria-label]="nextLabel()" (click)="shift(1)"><hugeicons-icon [icon]="nextIcon" [size]="16" [strokeWidth]="1.8" /></button>
        </div>

        @if (mode() === 'days') {
          <div class="weekdays">
            @for (w of weekdays; track w) { <span class="wd">{{ w }}</span> }
          </div>
          <div class="grid">
            @for (blank of leading(); track $index) { <span class="cell empty"></span> }
            @for (cell of days(); track cell.iso) {
              <button
                type="button"
                class="cell"
                [class.selected]="cell.iso === value()"
                [class.today]="cell.today"
                [disabled]="cell.disabled"
                [attr.data-iso]="cell.iso"
                [attr.aria-label]="cell.label"
                [attr.aria-pressed]="cell.iso === value()"
                [attr.aria-current]="cell.today ? 'date' : null"
                [attr.tabindex]="cell.iso === tabDay() ? 0 : -1"
                (keydown)="onDayKey($event, cell.iso)"
                (click)="pick(cell.iso)">{{ cell.day }}</button>
            }
          </div>
        } @else if (mode() === 'months') {
          <div class="mgrid" role="group" [attr.aria-label]="'Months of ' + view()[0]">
            @for (mo of months; track mo.index) {
              <button
                type="button"
                class="mcell"
                [class.selected]="mo.index === view()[1]"
                [attr.data-month]="mo.index"
                [attr.aria-label]="mo.long + ' ' + view()[0]"
                [attr.aria-pressed]="mo.index === view()[1]"
                [attr.tabindex]="mo.index === gridMonth() ? 0 : -1"
                (keydown)="onMonthKey($event, mo.index)"
                (click)="pickMonth(mo.index)">{{ mo.short }}</button>
            }
          </div>
        } @else {
          <div class="mgrid" role="group" [attr.aria-label]="'Years ' + yearRange()">
            @for (yr of years(); track yr) {
              <button
                type="button"
                class="mcell"
                [class.selected]="yr === view()[0]"
                [attr.data-year]="yr"
                [attr.aria-pressed]="yr === view()[0]"
                [attr.tabindex]="yr === gridYear() ? 0 : -1"
                (keydown)="onYearKey($event, yr)"
                (click)="pickYear(yr)">{{ yr }}</button>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; }
    .ui-date { width: 100%; box-sizing: border-box; height: var(--ui-size-md);
      padding: 0 calc(var(--ui-space-3) + 16px + var(--ui-space-2)) 0 var(--ui-space-3); cursor: pointer;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-date:focus-visible { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-date::placeholder { color: var(--ui-color-text-muted); }
    .ui-date:disabled { opacity: .5; cursor: not-allowed; }
    .wrap:has(.ui-date:disabled) .cal { opacity: .5; }
    .wrap.no-radius .ui-date { border-radius: 0; }
    .wrap[data-size="sm"] .ui-date { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-date { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    /* Flex so the drawn icon centres in the box the glyph used to sit in; currentColor so it
       follows the field's own text colour rather than the vendor's emoji palette. */
    .cal { position: absolute; right: var(--ui-space-3); top: 50%; transform: translateY(-50%);
      pointer-events: none; display: inline-flex; align-items: center; color: var(--ui-color-text-muted); }
    .cal-panel { padding: var(--ui-space-3); line-height: 1.35;
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); box-sizing: border-box;
      /* Seven 32px days with 2px gaps: the same box as ui-calendar and ui-date-range-picker. */
      width: calc(7 * 32px + 6 * 2px + 2 * var(--ui-space-3) + 2px); }
    .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--ui-space-2); }
    .heading { display: inline-flex; gap: var(--ui-space-1); }
    .heading-static { font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .lbl { border: none; background: transparent; color: var(--ui-color-text); font-weight: 600; font-size: var(--ui-font-size-sm);
      font-family: inherit; cursor: pointer; padding: 2px var(--ui-space-2); border-radius: var(--ui-radius-xs);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    .lbl:hover { background: var(--ui-color-elevated-hover); color: var(--ui-color-primary); }
    .lbl:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .nav { display: grid; place-items: center; width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; border: none; background: transparent; color: var(--ui-color-text-muted); border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .nav:hover { background: var(--ui-color-elevated-hover); color: var(--ui-color-text); }
    .nav:active { transform: scale(var(--ui-scale-press)); }
    .nav:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .mgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--ui-space-1); }
    .mcell { border: none; background: transparent; color: var(--ui-color-text); font: inherit;
      font-size: var(--ui-font-size-sm); padding: var(--ui-space-2) 0; border-radius: var(--ui-radius-xs); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .mcell:hover { background: var(--ui-color-elevated-hover); }
    .mcell:active { transform: scale(var(--ui-scale-press)); }
    .mcell:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .mcell.selected { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, 32px); gap: 2px; }
    .wd { text-align: center; font-size: 11px; color: var(--ui-color-text-muted); padding: 2px 0; }
    .cell { aspect-ratio: 1; border: none; background: transparent; color: var(--ui-color-text);
      border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .cell.empty { background: none; cursor: default; }
    .cell:not(.empty):hover { background: var(--ui-color-elevated-hover); }
    .cell:not(.empty):active { transform: scale(var(--ui-scale-press)); }
    .cell.today { box-shadow: inset 0 0 0 1px var(--ui-color-border); }
    .cell.selected { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .cell:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .cell:disabled { opacity: .5; cursor: not-allowed; }
    .cell:disabled:hover { background: transparent; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiDatePicker), multi: true }],
})
export class UiDatePicker implements ControlValueAccessor {
  /** Drawn, not 📅 — an emoji renders in the vendor's own colours whatever the theme says. */
  protected readonly calendarIcon = Calendar01Icon;
  protected readonly prevIcon = ArrowLeft01Icon;
  protected readonly nextIcon = ArrowRight01Icon;
  private config = inject(UI_CONFIG);
  placeholder = input('Select a date');
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);
  /** Earliest selectable day, as ISO `YYYY-MM-DD`. Days before it are shown but cannot be picked. */
  min = input<string | null>(null);
  /** Latest selectable day, as ISO `YYYY-MM-DD`. */
  max = input<string | null>(null);

  protected readonly value = signal<string | null>(null);
  protected readonly open = signal(false);
  /** The day that holds the popover's single tab stop. */
  protected readonly focusIso = signal<string>('');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly injector = inject(Injector);
  protected readonly disabled = signal(false);
  protected readonly weekdays = WEEKDAYS;
  protected readonly months = MONTHS_SHORT.map((short, index) => ({ index, short, long: MONTHS[index] }));
  /** The month (0-11) holding the month grid's single tab stop. */
  protected readonly gridMonth = signal(0);
  /** The year holding the year grid's single tab stop; it also decides which 12-year page shows. */
  protected readonly gridYear = signal(new Date().getFullYear());
  // Which sub-view is showing: day grid, month grid, or year grid.
  protected readonly mode = signal<'days' | 'months' | 'years'>('days');
  // [year, monthIndex] currently displayed.
  protected readonly view = signal<[number, number]>(this.initialView());

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    // Near the right edge of the screen, line up with the trigger's right edge instead.
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly display = computed(() => {
    const v = this.value();
    if (!v) return '';
    return formatIsoDate(v);
  });
  protected readonly monthName = computed(() => MONTHS[this.view()[1]]);
  // Start year of the current 12-year page shown in the year grid.
  private readonly yearPageStart = computed(() => Math.floor(this.gridYear() / 12) * 12);
  protected readonly years = computed(() => {
    const start = this.yearPageStart();
    return Array.from({ length: 12 }, (_, i) => start + i);
  });
  protected readonly yearRange = computed(() => `${this.yearPageStart()} – ${this.yearPageStart() + 11}`);
  protected readonly prevLabel = computed(() =>
    this.mode() === 'days' ? 'Previous month' : this.mode() === 'months' ? 'Previous year' : 'Previous years');
  protected readonly nextLabel = computed(() =>
    this.mode() === 'days' ? 'Next month' : this.mode() === 'months' ? 'Next year' : 'Next years');
  protected readonly leading = computed(() => {
    const [y, m] = this.view();
    return Array.from({ length: new Date(y, m, 1).getDay() });
  });
  protected readonly days = computed<DayCell[]>(() => {
    const [y, m] = this.view();
    const count = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const cellIso = iso(y, m, d);
      const min = this.min();
      const max = this.max();
      const disabled = (!!min && cellIso < min) || (!!max && cellIso > max);
      return { day: d, iso: cellIso, label: formatIsoDate(cellIso), today: cellIso === todayIso, disabled };
    });
  });

  /** The day in view that takes the tab stop: the focused one, else the chosen one, else the first that can be picked. */
  protected readonly tabDay = computed(() => {
    const days = this.days().filter((c) => !c.disabled);
    const want = [this.focusIso(), this.value()];
    return days.find((c) => want.includes(c.iso))?.iso ?? days[0]?.iso ?? null;
  });

  private initialView(): [number, number] {
    const now = new Date();
    return [now.getFullYear(), now.getMonth()];
  }

  writeValue(v: string | null): void {
    // '' or a malformed value is no date: the field stays empty and the calendar opens on today.
    const month = isoMonth(v);
    this.value.set(month ? v : null);
    if (month) this.view.set(month);
  }
  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected toggle(): void {
    if (this.disabled()) return;
    const next = !this.open();
    if (next) {
      this.mode.set('days');
      // Reopening shows the chosen month again, not wherever the last visit was left.
      const month = isoMonth(this.value());
      if (month) this.view.set(month);
    }
    this.open.set(next);
  }

  protected todayIso(): string {
    const t = new Date();
    return iso(t.getFullYear(), t.getMonth(), t.getDate());
  }

  protected onFieldKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { this.open.set(false); return; }
    if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && !this.open()) {
      e.preventDefault();
      this.toggle();
    }
  }

  /** Clicking the field itself is handled by toggle(); any other outside click just closes. */
  protected onOutsideClick(e: MouseEvent): void {
    if (e.target !== this.field().nativeElement) this.open.set(false);
  }

  /** Closes and puts focus back on the field. */
  protected close(): void {
    this.open.set(false);
    this.field().nativeElement.focus();
  }

  /** Shows the day's month and focuses it once rendered. */
  protected focusDay(isoDate: string): void {
    const month = isoMonth(isoDate);
    if (!month) return;
    const [y, m] = month;
    if (this.view()[0] !== y || this.view()[1] !== m) this.view.set(month);
    this.focusIso.set(isoDate);
    afterNextRender(() => {
      const cell = document.querySelector<HTMLButtonElement>(`.cal-panel .cell[data-iso="${isoDate}"]`);
      // A day outside min/max can't take focus; fall back to the month's tab stop.
      (cell && !cell.disabled ? cell : document.querySelector<HTMLElement>('.cal-panel .cell[tabindex="0"]'))?.focus();
    }, { injector: this.injector });
  }

  protected onDayKey(e: KeyboardEvent, isoDate: string): void {
    const [y, m, d] = isoDate.split('-').map(Number);
    const at = (yy: number, mm: number, dd: number) => { const t = new Date(yy, mm, dd); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
    const daysIn = new Date(y, m, 0).getDate();
    const moves: Record<string, () => string> = {
      ArrowLeft: () => at(y, m - 1, d - 1), ArrowRight: () => at(y, m - 1, d + 1),
      ArrowUp: () => at(y, m - 1, d - 7), ArrowDown: () => at(y, m - 1, d + 7),
      Home: () => at(y, m - 1, 1), End: () => at(y, m - 1, daysIn),
      PageUp: () => at(y, m - 2, Math.min(d, new Date(y, m - 1, 0).getDate())),
      PageDown: () => at(y, m, Math.min(d, new Date(y, m + 1, 0).getDate())),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    this.focusDay(move());
  }
  // Prev/next stepping depends on the active sub-view: month, year, or 12-year page.
  protected shift(delta: number): void {
    const [y, m] = this.view();
    const mode = this.mode();
    if (mode === 'days') {
      const date = new Date(y, m + delta, 1);
      this.view.set([date.getFullYear(), date.getMonth()]);
    } else if (mode === 'months') {
      this.view.set([y + delta, m]);
    } else {
      // Pages through the years without choosing one; the tab stop moves with the page.
      this.gridYear.update((g) => g + delta * 12);
    }
  }
  /** Opens the month grid with focus on the month in view. */
  protected showMonths(): void {
    this.gridMonth.set(this.view()[1]);
    this.mode.set('months');
    this.focusGridCell(`.mcell[data-month="${this.gridMonth()}"]`);
  }
  /** Opens the year grid with focus on the year in view. */
  protected showYears(): void {
    this.gridYear.set(this.view()[0]);
    this.mode.set('years');
    this.focusGridCell(`.mcell[data-year="${this.gridYear()}"]`);
  }
  protected pickMonth(monthIndex: number): void {
    this.view.set([this.view()[0], monthIndex]);
    this.mode.set('days');
    // The clicked cell is gone; carry focus to the day grid's tab stop so it isn't lost to <body>.
    const v = this.value();
    const [y, m] = this.view();
    this.focusDay(v && v.startsWith(iso(y, m, 1).slice(0, 8)) ? v : iso(y, m, 1));
  }
  protected pickYear(year: number): void {
    this.view.set([year, this.view()[1]]);
    this.showMonths();
  }

  /** Month grid keys: 3 columns within the year shown; PageUp/PageDown change the year. */
  protected onMonthKey(e: KeyboardEvent, monthIndex: number): void {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    let next: number;
    // A move off the grid (e.g. Up from the first row) stays put rather than jumping sideways.
    if (e.key in moves) { const n = monthIndex + moves[e.key]; next = n < 0 || n > 11 ? monthIndex : n; }
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 11;
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      this.view.update(([y, m]) => [y + (e.key === 'PageUp' ? -1 : 1), m]);
      this.focusGridCell(`.mcell[data-month="${monthIndex}"]`);
      return;
    } else return;
    e.preventDefault();
    this.gridMonth.set(next);
    this.focusGridCell(`.mcell[data-month="${next}"]`);
  }

  /** Year grid keys: 3 columns; moving past either end of the page turns the page. */
  protected onYearKey(e: KeyboardEvent, year: number): void {
    const start = this.yearPageStart();
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 };
    let next: number;
    if (e.key in moves) next = year + moves[e.key];
    else if (e.key === 'Home') next = start;
    else if (e.key === 'End') next = start + 11;
    else return;
    e.preventDefault();
    this.gridYear.set(next);
    this.focusGridCell(`.mcell[data-year="${next}"]`);
  }

  private focusGridCell(selector: string): void {
    afterNextRender(() => document.querySelector<HTMLElement>(`.cal-panel ${selector}`)?.focus(), { injector: this.injector });
  }
  protected pick(isoDate: string): void {
    const min = this.min();
    const max = this.max();
    if ((min && isoDate < min) || (max && isoDate > max)) return;
    this.value.set(isoDate);
    this.onChange(isoDate);
    this.onTouched();
    this.close();
  }
}
