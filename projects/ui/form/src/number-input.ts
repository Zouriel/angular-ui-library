import { Component, ElementRef, effect, forwardRef, inject, input, signal, untracked, viewChild } from '@angular/core';
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
        [disabled]="disabled()"
        (input)="handleInput($event)"
        (change)="settle()"
        (keydown.enter)="settle()"
        [attr.aria-label]="ariaLabel() || label() || null"
        (focus)="selectAll($event)"
        (mouseup)="keepSelection($event)"
        (blur)="settle(); onTouched()" />
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

  /**
   * While typing, the field is left alone: clamping each keystroke made some numbers impossible to
   * type — "18" in a field with a minimum of 4 became "48", because the "1" was raised to 4 before
   * the "8" arrived. A value is passed on as soon as it's in range; out-of-range or half-typed input
   * waits for Enter or leaving the field, which clamps and rounds it.
   */
  protected handleInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    if (raw === '' || raw === '-' || raw.endsWith('.')) return;
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const min = this.min(), max = this.max();
    if ((min !== undefined && v < min) || (max !== undefined && v > max)) return;
    const precision = this.precision();
    const value = precision !== null ? Number(v.toFixed(precision)) : v;
    this.typed = value;
    this.onChange(value);
  }

  /** The last value passed on from typing, so the model echoing it back doesn't rewrite the text. */
  private typed: number | null | undefined = undefined;

  constructor() {
    effect(() => {
      const v = this.value();
      const el = this.inp()?.nativeElement;
      if (el) untracked(() => this.show(v, el));
    });
  }

  /** Writes a value into the field — unless it's being typed and already says that. */
  private show(v: number | null, el: HTMLInputElement): void {
    const typing = typeof document !== 'undefined' && document.activeElement === el;
    if (typing && el.value !== '' && Number(el.value) === v) return;
    const display = v === null ? '' : String(v);
    if (el.value !== display) el.value = display;
  }

  /** Enter, change or blur: the typed text becomes a valid value, shown as such. */
  protected settle(): void {
    const el = this.inp()?.nativeElement;
    if (!el) return;
    const raw = el.value;
    if (raw === '') {
      if (this.value() !== null) this.commit(null);
      return;
    }
    const v = Number(raw);
    this.commit(Number.isFinite(v) ? v : this.value(), { quietIfUnchanged: true });
  }
  protected startScrub(e: PointerEvent): void {
    if (this.disabled() || e.button !== 0) return;
    e.preventDefault();
    this.scrubStart = { x: e.clientX, value: this.value() ?? 0 };
    this.scrubbing.set(true);
    window.addEventListener('pointermove', this.scrubMove);
    window.addEventListener('pointerup', this.scrubUp);
  }

  /**
   * Focusing the field selects its number, so typing replaces it. On a phone there's no quick
   * select-all: without this a tap put the caret after "1" and typing "2" gave 12. Selected at once,
   * never later — a delayed select landed mid-typing and swallowed digits.
   */
  protected selectAll(e: FocusEvent): void {
    (e.target as HTMLInputElement).select();
    this.justFocused = true;
  }

  /** The click that focused the field would put the caret where it landed and drop the selection. */
  protected keepSelection(e: MouseEvent): void {
    if (this.justFocused) e.preventDefault();
    this.justFocused = false;
  }

  private justFocused = false;

  protected bump(delta: number): void {
    this.commit((this.value() ?? 0) + delta);
  }
  private commit(v: number | null, { quietIfUnchanged = false } = {}): void {
    const before = this.typed !== undefined ? this.typed : this.value();
    if (v !== null) {
      const precision = this.precision();
      if (precision !== null) v = Number(v.toFixed(precision));
      const min = this.min(), max = this.max();
      if (min !== undefined) v = Math.max(min, v);
      if (max !== undefined) v = Math.min(max, v);
    }
    this.value.set(v);
    // Settling always shows the result, even when it equals the current value (so "1000" typed into
    // a field capped at 100 reads 100).
    const el = this.inp()?.nativeElement;
    const display = v === null ? '' : String(v);
    if (el && el.value !== display) el.value = display;
    this.typed = undefined;
    // Leaving a field that wasn't changed is not a change.
    if (!(quietIfUnchanged && v === before)) this.onChange(v);
  }
}
