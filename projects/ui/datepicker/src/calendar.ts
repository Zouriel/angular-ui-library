import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { injectUiDateNames, isoMonth, uiLeadingBlanks } from './date-names';
import { injectUiStrings } from '@zouriel/ui';

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** `ui-calendar` — inline month calendar (CVA; value is an ISO `YYYY-MM-DD` string). */
@Component({
  selector: 'ui-calendar',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="cal" [class.disabled]="disabled()">
      <div class="head">
        <button type="button" class="nav" [attr.aria-label]="strings.previousMonth" [disabled]="disabled()" (click)="shift(-1)"><hugeicons-icon [icon]="prevIcon" [size]="16" [strokeWidth]="1.8" /></button>
        <span class="month">{{ heading() }}</span>
        <button type="button" class="nav" [attr.aria-label]="strings.nextMonth" [disabled]="disabled()" (click)="shift(1)"><hugeicons-icon [icon]="nextIcon" [size]="16" [strokeWidth]="1.8" /></button>
      </div>
      <div class="weekdays">@for (w of names().gridWeekdays; track $index) { <span [attr.title]="names().gridWeekdaysLong[$index]">{{ w }}</span> }</div>
      <div class="grid">
        @for (b of leading(); track $index) { <span class="cell empty"></span> }
        @for (c of days(); track c.iso) {
          <button type="button" class="cell" [class.selected]="c.iso === value()" [class.today]="c.today" [disabled]="disabled() || c.blocked"
            [attr.aria-label]="c.label" [attr.aria-pressed]="c.iso === value()" [attr.aria-current]="c.today ? 'date' : null" (click)="pick(c.iso)">{{ c.day }}</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    /* Same box as ui-date-picker's popup: seven 32px days, 12px padding. */
    .cal { padding: var(--ui-space-3); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); width: calc(7 * 32px + 2 * var(--ui-space-3) + 2px); box-sizing: border-box; font-family: var(--ui-font-default); line-height: 1.35; }
    /* Disabled: everything dims together, the heading and weekdays too, not just the days. */
    .cal.disabled :is(.month, .weekdays, .foot) { opacity: .5; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--ui-space-2); }
    .month { font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .nav { display: grid; place-items: center; width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; border: none; background: transparent; color: var(--ui-color-text-muted); border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .nav:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .nav:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .nav:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Previous / next arrows point the way the calendar reads: mirrored in RTL. */
    .nav:dir(rtl) hugeicons-icon { transform: scaleX(-1); }
    .nav:disabled { opacity: .5; cursor: not-allowed; }
    /* 32px days, columns touching (a range band runs unbroken), 2px between weeks: as in Flutter. */
    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, 32px); gap: 2px 0; }
    .weekdays span { text-align: center; font-size: 11px; color: var(--ui-color-text-muted); padding: 2px 0; }
    .cell { aspect-ratio: 1; border: none; background: transparent; color: var(--ui-color-text); border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .cell.empty { cursor: default; }
    .cell:not(.empty):hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .cell:not(.empty):active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .cell.today { box-shadow: inset 0 0 0 1px var(--ui-color-border); }
    .cell.selected { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .cell:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .cell:disabled:not(.empty) { opacity: .5; cursor: not-allowed; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiCalendar), multi: true }],
})
export class UiCalendar implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  /** Month and day names, first weekday (0.46.0): built-in strings, then `LOCALE_ID`. */
  protected readonly names = injectUiDateNames();
  protected readonly prevIcon = ArrowLeft01Icon;
  protected readonly nextIcon = ArrowRight01Icon;
  /** Earliest selectable day, as ISO `YYYY-MM-DD`. */
  min = input<string | null>(null);
  /** Latest selectable day, as ISO `YYYY-MM-DD`. */
  max = input<string | null>(null);

  protected readonly value = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly view = signal<[number, number]>([new Date().getFullYear(), new Date().getMonth()]);

  protected readonly heading = computed(() => this.names().monthYear(this.view()[0], this.view()[1]));
  protected readonly leading = computed(() => Array.from({ length: uiLeadingBlanks(this.view()[0], this.view()[1], this.names().firstDay) }));
  protected readonly days = computed(() => {
    const [y, m] = this.view();
    const count = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
    const min = this.min();
    const max = this.max();
    return Array.from({ length: count }, (_, i) => {
      const cellIso = iso(y, m, i + 1);
      return { day: i + 1, iso: cellIso, label: this.names().formatIso(cellIso), today: cellIso === todayIso, blocked: (!!min && cellIso < min) || (!!max && cellIso > max) };
    });
  });

  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};
  writeValue(v: string | null): void { const month = isoMonth(v); this.value.set(month ? v : null); if (month) this.view.set(month); }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected shift(delta: number): void { const d = new Date(this.view()[0], this.view()[1] + delta, 1); this.view.set([d.getFullYear(), d.getMonth()]); }
  protected pick(isoDate: string): void { const min = this.min(); const max = this.max(); if ((min && isoDate < min) || (max && isoDate > max)) return; this.value.set(isoDate); this.onChange(isoDate); this.onTouched(); }
}
