import { Component, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, injectUiStrings, type UiSize } from '@zouriel/ui';
import { UiTimePicker } from '@zouriel/ui/form';
import { UiDatePicker } from './date-picker';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

/** Splits `YYYY-MM-DDTHH:MM[:SS]` (or a plain date) into its date and time; anything else is empty. */
export function uiSplitDateTime(value: string | null | undefined): { date: string | null; time: string | null } {
  const [date, time] = (value ?? '').split('T');
  return { date: DATE.test(date ?? '') ? date : null, time: TIME.test(time ?? '') ? time.slice(0, 8) : null };
}

/**
 * `ui-date-time-picker` — a day and a time of day (0.87.0): a CVA whose value is a local date-time,
 * `YYYY-MM-DDTHH:MM` (with seconds when `step` is under 60), or null. A `ui-date-picker` and a
 * `ui-time-picker` side by side (stacked when the box is narrower than 320px). Picking a day before a time
 * takes `defaultTime`, shown in the time field at once; clearing the time keeps the day with it.
 * `min` / `max` (a date-time or a date) limit the calendar's days.
 *
 * ```html
 * <ui-form-field label="Publish at"><ui-date-time-picker [(ngModel)]="publishAt" /></ui-form-field>
 * ```
 */
@Component({
  selector: 'ui-date-time-picker',
  imports: [FormsModule, UiDatePicker, UiTimePicker],
  host: { role: 'group' },
  template: `
    <div class="row">
      <ui-date-picker class="date" [ngModel]="date()" (ngModelChange)="setDate($event)" [disabled]="disabled()" [size]="size()"
        [radius]="radius()" [min]="day(min())" [max]="day(max())" [invalid]="invalid()" [placeholder]="placeholder()"
        [ariaLabel]="dateLabel() ?? strings.dateLabel" (focusout)="onTouched()" />
      <ui-time-picker class="time" [ngModel]="time() ?? ''" (ngModelChange)="setTime($event)" [disabled]="disabled()" [size]="size()"
        [radius]="radius()" [step]="step()" [invalid]="invalid()" [ariaLabel]="timeLabel() ?? strings.timeLabel" (focusout)="onTouched()" />
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .row { display: flex; gap: var(--ui-space-2); }
    .date { flex: 1 1 auto; min-width: 0; }
    .time { flex: 0 0 8.5rem; }
    @container (max-width: 320px) {
      .row { flex-direction: column; }
      .time { flex-basis: auto; }
    }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiDateTimePicker), multi: true }],
})
export class UiDateTimePicker implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  private readonly config = inject(UI_CONFIG);
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);
  /** Earliest moment, as a date-time or a date; its day limits the calendar. */
  min = input<string | null>(null);
  max = input<string | null>(null);
  /** Seconds granularity of the time: 60 = minutes, 1 = seconds. */
  step = input(60);
  invalid = input(false);
  /** The date field's placeholder; default "Select a date". */
  placeholder = input<string | undefined>(undefined);
  /** The time a day takes when it is picked before a time (and when the time is cleared). */
  defaultTime = input('09:00');
  /** The two fields' accessible names; null: the built-in "Date" and "Time". */
  dateLabel = input<string | null>(null);
  timeLabel = input<string | null>(null);

  protected readonly date = signal<string | null>(null);
  protected readonly time = signal<string | null>(null);
  protected readonly disabled = signal(false);
  protected readonly day = (v: string | null) => (v ? v.slice(0, 10) : null);
  /** The value as it is emitted. */
  readonly value = computed(() => {
    const d = this.date();
    return d ? `${d}T${this.time() ?? this.defaultTime()}` : null;
  });

  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    const { date, time } = uiSplitDateTime(v);
    this.date.set(date);
    this.time.set(date ? time : null);
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected setDate(d: string | null): void {
    this.date.set(d || null);
    if (d && !this.time()) this.time.set(this.defaultTime());
    if (!d) this.time.set(null);
    this.onChange(this.value());
  }

  protected setTime(t: string): void {
    this.time.set(TIME.test(t) ? t : this.date() ? this.defaultTime() : null);
    if (this.date()) this.onChange(this.value());
  }
}
