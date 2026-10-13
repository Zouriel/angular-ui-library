import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { formatIsoDate, monthYear, WEEKDAYS } from './date-names';

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export type UiDateRange = { start: string | null; end: string | null };

/** `ui-date-range-picker` — inline range selection (CVA; value is `{ start, end }` ISO strings). */
@Component({
  selector: 'ui-date-range-picker',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="cal">
      <div class="head">
        <button type="button" class="nav" aria-label="Previous month" [disabled]="disabled()" (click)="shift(-1)"><hugeicons-icon [icon]="prevIcon" [size]="16" [strokeWidth]="1.8" /></button>
        <span class="month">{{ heading() }}</span>
        <button type="button" class="nav" aria-label="Next month" [disabled]="disabled()" (click)="shift(1)"><hugeicons-icon [icon]="nextIcon" [size]="16" [strokeWidth]="1.8" /></button>
      </div>
      <div class="weekdays">@for (w of weekdays; track w) { <span>{{ w }}</span> }</div>
      <div class="grid" role="grid" [class.ranged]="ranged()" (mouseleave)="hover.set(null)">
        @for (b of leading(); track $index) { <span class="cell empty"></span> }
        @for (c of days(); track c.iso) {
          <button type="button" class="cell" [class.start]="c.iso === range().start" [class.end]="c.iso === range().end"
                  [class.inrange]="inRange(c.iso)" [disabled]="disabled()" (click)="pick(c.iso)" (mouseenter)="hover.set(c.iso)">{{ c.day }}</button>
        }
      </div>
      <div class="foot">{{ range().start ? fmt(range().start!) : '—' }} → {{ range().end ? fmt(range().end!) : '—' }}</div>
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .cal { padding: var(--ui-space-3); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); width: 252px; box-sizing: border-box; font-family: var(--ui-font-default); line-height: 1.35; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--ui-space-2); }
    .month { font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .nav { display: grid; place-items: center; width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; border: none; background: transparent; color: var(--ui-color-text-muted); border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .nav:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .nav:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .nav:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .nav:disabled { opacity: .5; cursor: not-allowed; }
    .weekdays, .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    /* No column gap: the in-range band must read as one continuous strip, not separate squares. */
    .grid { column-gap: 0; }
    .weekdays span { text-align: center; font-size: 11px; color: var(--ui-color-text-muted); padding: 2px 0; }
    .cell { aspect-ratio: 1; border: none; background: transparent; color: var(--ui-color-text); border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .cell.empty { cursor: default; }
    .cell:not(.empty):hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .cell:not(.empty):active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .cell:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .cell:disabled:not(.empty) { opacity: .5; cursor: not-allowed; }
    .cell.inrange { background: var(--ui-color-selected); border-radius: 0; }
    .cell.start, .cell.end { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .grid.ranged .cell.start:not(.end) { border-radius: var(--ui-radius-xs) 0 0 var(--ui-radius-xs); }
    .grid.ranged .cell.end:not(.start) { border-radius: 0 var(--ui-radius-xs) var(--ui-radius-xs) 0; }
    .foot { margin-top: var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiDateRangePicker), multi: true }],
})
export class UiDateRangePicker implements ControlValueAccessor {
  protected readonly weekdays = WEEKDAYS;
  protected readonly prevIcon = ArrowLeft01Icon;
  protected readonly nextIcon = ArrowRight01Icon;
  protected readonly range = signal<UiDateRange>({ start: null, end: null });
  protected readonly hover = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly view = signal<[number, number]>([new Date().getFullYear(), new Date().getMonth()]);

  /** Start/end get one-sided corners only while the band runs rightwards from start (end set, or hovering later). */
  protected readonly ranged = computed(() => {
    const { start, end } = this.range();
    const h = this.hover();
    return !!start && (!!end || (!!h && h > start));
  });
  protected fmt(isoDate: string): string { return formatIsoDate(isoDate, true); }
  protected readonly heading = computed(() => monthYear(this.view()[0], this.view()[1]));
  protected readonly leading = computed(() => Array.from({ length: new Date(this.view()[0], this.view()[1], 1).getDay() }));
  protected readonly days = computed(() => {
    const [y, m] = this.view();
    const count = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => ({ day: i + 1, iso: iso(y, m, i + 1) }));
  });

  private onChange: (v: UiDateRange) => void = () => {};
  protected onTouched: () => void = () => {};
  writeValue(v: UiDateRange | null): void { this.range.set(v ?? { start: null, end: null }); }
  registerOnChange(fn: (v: UiDateRange) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected shift(delta: number): void { const d = new Date(this.view()[0], this.view()[1] + delta, 1); this.view.set([d.getFullYear(), d.getMonth()]); }
  protected inRange(d: string): boolean {
    const { start, end } = this.range();
    if (!start) return false;
    const hi = end ?? this.hover();
    if (!hi) return false;
    const lo = start < hi ? start : hi;
    const up = start < hi ? hi : start;
    return d > lo && d < up;
  }
  protected pick(d: string): void {
    const { start, end } = this.range();
    let next: UiDateRange;
    if (!start || (start && end)) next = { start: d, end: null };
    else next = d < start ? { start: d, end: start } : { start, end: d };
    this.range.set(next);
    this.onChange(next);
    if (next.end) this.onTouched();
  }
}
