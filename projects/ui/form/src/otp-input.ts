import { Component, ElementRef, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-otp-input` — fixed-length one-time-code entry (CVA; value is the joined string). */
@Component({
  selector: 'ui-otp-input',
  template: `
    <div class="ui-otp" role="group" aria-label="One-time code">
      @for (i of slots(); track i) {
        <input
          class="cell"
          [attr.inputmode]="numeric() ? 'numeric' : 'text'"
          [attr.autocomplete]="i === 0 ? 'one-time-code' : 'off'"
          maxlength="1"
          [value]="chars()[i] || ''"
          [disabled]="disabled()"
          [attr.aria-invalid]="invalid() || null"
          [attr.aria-label]="'Digit ' + (i + 1)"
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
      width: var(--ui-size-md); height: var(--ui-size-lg); text-align: center;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-mono); font-size: var(--ui-font-size-lg); outline: none;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .cell:focus { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .cell:disabled { opacity: 0.55; }
    .cell[aria-invalid="true"] { border-color: var(--ui-color-danger); }
    .cell[aria-invalid="true"]:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-danger) 30%, transparent); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiOtpInput), multi: true }],
})
export class UiOtpInput implements ControlValueAccessor {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  length = input(6);
  numeric = input(true);
  invalid = input(false);

  protected readonly chars = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  protected slots(): number[] {
    return Array.from({ length: this.length() }, (_, i) => i);
  }

  writeValue(v: string): void { this.chars.set((v ?? '').slice(0, this.length()).split('')); }
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

  private emit(): void {
    this.onChange(this.chars().join(''));
  }
  private focusCell(i: number): void {
    const cells = this.host.nativeElement.querySelectorAll<HTMLInputElement>('.cell');
    cells[i]?.focus();
  }
}
