import { Component, ElementRef, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';

/** `ui-number-input` — numeric field with stepper buttons (CVA). */
@Component({
  selector: 'ui-number-input',
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [class.invalid]="invalid()" [attr.data-size]="size()">
      @if (label()) {
        <span class="scrub" [class.active]="scrubbing()" [attr.title]="'Drag to change ' + label()" aria-hidden="true"
          (pointerdown)="startScrub($event)">{{ label() }}</span>
      }
      <input
        class="ui-number"
        type="number"
        [attr.min]="min()" [attr.max]="max()" [attr.step]="step()"
        [attr.placeholder]="placeholder()"
        [attr.aria-invalid]="invalid() || null"
        #inp
        [value]="value()"
        [disabled]="disabled()"
        (input)="handleInput($event)"
        [attr.aria-label]="ariaLabel() || label() || null"
        (blur)="onTouched()" />
      @if (suffix()) { <span class="suffix" aria-hidden="true">{{ suffix() }}</span> }
      @if (steppers()) {
      <div class="steppers">
        <button type="button" tabindex="-1" aria-label="Increment" [disabled]="disabled()" (click)="bump(step())">▲</button>
        <button type="button" tabindex="-1" aria-label="Decrement" [disabled]="disabled()" (click)="bump(-step())">▼</button>
      </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { position: relative; display: flex; align-items: stretch;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .wrap:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .wrap.no-radius { border-radius: 0; }
    .wrap.invalid { border-color: var(--ui-color-danger); }
    .wrap.invalid:focus-within { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-danger) 30%, transparent); }
    .ui-number {
      flex: 1; min-width: 0; appearance: textfield; -moz-appearance: textfield;
      height: var(--ui-size-md); padding: 0 var(--ui-space-3); border: none; background: transparent;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none;
    }
    .ui-number::-webkit-outer-spin-button, .ui-number::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .wrap[data-size="sm"] .ui-number { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-number { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .scrub { display: flex; align-items: center; padding: 0 0 0 var(--ui-space-2); color: var(--ui-color-text-muted); cursor: ew-resize;
      font-size: var(--ui-font-size-sm); font-weight: 500; user-select: none; touch-action: none; min-width: 1.2em; }
    .scrub:hover, .scrub.active { color: var(--ui-color-primary); }
    .suffix { display: flex; align-items: center; padding-right: var(--ui-space-2); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="sm"] .ui-number { padding: 0 var(--ui-space-2); }
    .steppers { display: flex; flex-direction: column; border-left: 1px solid var(--ui-color-border); }
    .steppers button { flex: 1; width: 22px; border: none; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font-size: 8px; padding: 0; }
    .steppers button:first-child { border-bottom: 1px solid var(--ui-color-border); }
    .steppers button:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .steppers button:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiNumberInput), multi: true }],
})
export class UiNumberInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  min = input<number>();
  max = input<number>();
  step = input(1);
  placeholder = input('');
  size = input<UiSize>('md');
  invalid = input(false);
  radius = input<boolean>(this.config.radius);
  /** A short label before the number that you can drag left/right to change the value (e.g. "X", "W"). */
  label = input('');
  /** Accessible name when the visible label is too terse. */
  ariaLabel = input('');
  /** A unit shown after the number, e.g. "px" or "°". */
  suffix = input('');
  /** Decimal places kept; values are rounded to this. */
  precision = input<number | null>(null);
  /** Show the ▲▼ buttons. */
  steppers = input(true);

  protected readonly scrubbing = signal(false);
  private scrubStart: { x: number; value: number } | null = null;
  private readonly scrubMove = (e: PointerEvent) => {
    if (!this.scrubStart) return;
    const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const delta = Math.round((e.clientX - this.scrubStart.x) / 2) * this.step() * factor;
    this.commit(this.scrubStart.value + delta);
  };
  private readonly scrubUp = () => {
    this.scrubStart = null;
    this.scrubbing.set(false);
    window.removeEventListener('pointermove', this.scrubMove);
    window.removeEventListener('pointerup', this.scrubUp);
    this.onTouched();
  };

  private readonly inp = viewChild<ElementRef<HTMLInputElement>>('inp');
  protected readonly value = signal<number | null>(null);
  protected readonly disabled = signal(false);
  private onChange: (v: number | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: number | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const v = raw === '' ? null : Number(raw);
    this.commit(v);
  }
  protected startScrub(e: PointerEvent): void {
    if (this.disabled() || e.button !== 0) return;
    e.preventDefault();
    this.scrubStart = { x: e.clientX, value: this.value() ?? 0 };
    this.scrubbing.set(true);
    window.addEventListener('pointermove', this.scrubMove);
    window.addEventListener('pointerup', this.scrubUp);
  }

  protected bump(delta: number): void {
    this.commit((this.value() ?? 0) + delta);
  }
  private commit(v: number | null): void {
    if (v !== null) {
      const precision = this.precision();
      if (precision !== null) v = Number(v.toFixed(precision));
      const min = this.min(), max = this.max();
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
    }
    this.value.set(v);
    // If the clamp result equals the current signal value, value.set() is a no-op and the [value]
    // binding won't re-write the input — so the DOM would keep the un-clamped text the user typed
    // (e.g. "1000" while the control holds 100). Force the displayed value to match.
    const el = this.inp()?.nativeElement;
    const display = v === null ? '' : String(v);
    if (el && el.value !== display) el.value = display;
    this.onChange(v);
  }
}
