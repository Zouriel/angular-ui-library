import { Component, ElementRef, effect, forwardRef, inject, input, signal, untracked } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';

/** The character an empty cell takes in the value when a later cell is filled. */
const OTP_HOLE = ' ';

/**
 * `ui-otp-input` — fixed-length one-time-code entry (CVA; value is a string).
 *
 * The value keeps every character in its cell's position: an empty cell before a filled one is a
 * space, and empty cells at the end are dropped. So `1`,`2`,empty,`4` reads `"12 4"`, writing
 * `"12 4"` back fills the same cells, and an untouched control is `''`.
 *
 * It also validates itself: a value that is not empty but has fewer than `length` filled cells (a
 * code still being typed, or one with a hole) gives the error `{ otpIncomplete: { filled, length } }`.
 * An empty value is valid, so add `Validators.required` to make the code mandatory.
 */
@Component({
  selector: 'ui-otp-input',
  template: `
    <!-- A code reads left to right in every language: the boxes stay in that order under dir="rtl". -->
    <div class="ui-otp" role="group" dir="ltr" [attr.aria-label]="strings.otpLabel">
      @for (i of slots(); track i) {
        <input
          class="cell"
          [attr.inputmode]="numeric() ? 'numeric' : 'text'"
          [attr.autocomplete]="i === 0 ? 'one-time-code' : 'off'"
          maxlength="1"
          [value]="chars()[i] || ''"
          [disabled]="disabled()"
          [attr.aria-invalid]="invalid() || null"
          [attr.aria-label]="format(strings.otpDigit, { n: i + 1 })"
          (input)="onInput($event, i)"
          (keydown)="onKeydown($event, i)"
          (paste)="onPaste($event, i)"
          (focus)="select($event)"
          (blur)="onTouched()" />
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-otp { display: inline-flex; gap: var(--ui-space-2); }
    .cell {
      box-sizing: border-box; width: var(--ui-size-md); height: var(--ui-size-lg); padding: 0; text-align: center;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-mono); font-size: var(--ui-font-size-lg); outline: none;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .cell:focus-visible { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .cell:disabled { opacity: .5; cursor: not-allowed; }
    .cell[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .cell[aria-invalid="true"]:focus-visible { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
  `,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiOtpInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => UiOtpInput), multi: true },
  ],
})
export class UiOtpInput implements ControlValueAccessor, Validator {
  protected readonly strings = injectUiStrings();
  protected readonly format = uiFormatString;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  length = input(6);
  numeric = input(true);
  invalid = input(false);

  protected readonly chars = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  constructor() {
    // A new length changes what counts as complete.
    effect(() => { this.length(); untracked(() => this.onValidatorChange()); });
  }

  protected slots(): number[] {
    return Array.from({ length: this.length() }, (_, i) => i);
  }

  writeValue(v: string): void {
    this.chars.set((v ?? '').slice(0, this.length()).split('').map((c) => (c === OTP_HOLE ? '' : c)));
  }
  validate(control: AbstractControl): ValidationErrors | null {
    const v = typeof control.value === 'string' ? control.value : '';
    if (!v) return null;
    const length = this.length();
    const filled = v.slice(0, length).split('').filter((c) => c !== OTP_HOLE).length;
    return filled < length ? { otpIncomplete: { filled, length } } : null;
  }
  registerOnValidatorChange(fn: () => void): void { this.onValidatorChange = fn; }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onInput(e: Event, index: number): void {
    const input = e.target as HTMLInputElement;

    // Autofill (`one-time-code`) and some mobile paste paths drop the whole code into a single
    // cell without firing `paste` — spread it instead of keeping one character.
    if (input.value.length > 1) {
      const code = this.sanitize(input.value);
      input.value = this.chars()[index] || '';
      if (code.length > 1) { this.fill(code, 0); return; }
    }

    let ch = input.value.slice(-1);
    if (this.numeric() && ch && !/[0-9]/.test(ch)) { input.value = this.chars()[index] || ''; return; }
    const next = [...this.chars()];
    next[index] = ch;
    this.chars.set(next);
    this.emit();
    if (ch) this.focusCell(index + 1);
  }

  protected onKeydown(e: KeyboardEvent, index: number): void {
    if (e.key === 'Backspace' && !this.chars()[index]) { this.focusCell(index - 1); }
    else if (e.key === 'ArrowLeft') this.focusCell(index - 1);
    else if (e.key === 'ArrowRight') this.focusCell(index + 1);
  }

  // Distribute a pasted code across the cells (the common "paste the whole code" case).
  protected onPaste(e: ClipboardEvent, index: number): void {
    e.preventDefault();
    const value = this.sanitize(e.clipboardData?.getData('text') ?? '');
    if (!value) return;
    // A multi-character paste is the whole code, so it always fills from the first cell — anchoring
    // it at the pasted-into cell would silently drop the tail (paste into the last cell kept 1 digit).
    this.fill(value, value.length > 1 ? 0 : index);
  }

  protected select(e: Event): void { (e.target as HTMLInputElement).select(); }

  private sanitize(raw: string): string {
    return this.numeric() ? raw.replace(/\D/g, '') : raw.replace(/\s/g, '');
  }

  /** Write an already-sanitized code into the cells starting at `start`. */
  private fill(value: string, start: number): void {
    const len = this.length();
    const next = Array.from({ length: len }, (_, i) => this.chars()[i] ?? '');
    for (let i = 0; i < value.length && start + i < len; i++) {
      next[start + i] = value[i];
    }
    this.chars.set(next);
    this.emit();
    this.focusCell(Math.min(start + value.length, len - 1));
  }

  /** Holes keep their position as spaces; trailing empty cells are dropped (see the class doc). */
  private emit(): void {
    const cells = Array.from({ length: this.length() }, (_, i) => this.chars()[i] || OTP_HOLE);
    this.onChange(cells.join('').trimEnd());
  }
  private focusCell(i: number): void {
    const cells = this.host.nativeElement.querySelectorAll<HTMLInputElement>('.cell');
    cells[i]?.focus();
  }
}
