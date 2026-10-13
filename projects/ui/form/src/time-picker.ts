import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';

/** `ui-time-picker` — time field (CVA; value is `HH:MM`), built on a native time input. */
@Component({
  selector: 'ui-time-picker',
  template: `
    <input
      class="ui-time"
      type="time"
      [class.no-radius]="!radius()"
      [attr.data-size]="size()"
      [attr.step]="step()"
      [attr.aria-invalid]="invalid() || null"
      [value]="value()"
      [disabled]="disabled()"
      (input)="set($any($event.target).value)"
      (blur)="onTouched()" />
  `,
  styles: `
    :host { display: block; }
    .ui-time { width: 100%; box-sizing: border-box; height: var(--ui-size-md); padding: 0 var(--ui-space-3); font-variant-numeric: tabular-nums;
      background: var(--ui-color-surface); color: var(--ui-color-text); border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-time:focus-visible { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ui-time:disabled { opacity: .5; cursor: not-allowed; }
    .ui-time.no-radius { border-radius: 0; }
    .ui-time[data-size="sm"] { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .ui-time[data-size="lg"] { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .ui-time[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .ui-time[aria-invalid="true"]:focus-visible { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    /* The theme's color-scheme already picks a light or dark indicator; just quiet it. */
    .ui-time::-webkit-calendar-picker-indicator { opacity: .6; cursor: pointer; transition: opacity var(--ui-motion-fast) var(--ui-ease-standard); }
    .ui-time::-webkit-calendar-picker-indicator:hover { opacity: 1; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTimePicker), multi: true }],
})
export class UiTimePicker implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  size = input<UiSize>('md');
  /** Seconds granularity: 60 = minutes (default), 1 = show seconds. */
  step = input(60);
  invalid = input(false);
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: string): void { this.value.set(v); this.onChange(v); }
}
