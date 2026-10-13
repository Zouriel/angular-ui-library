import { Component, ElementRef, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from '@zouriel/ui';

/** `ui-chip-input` — tokenized text entry (CVA; value is string[]). Enter adds, Backspace removes. */
@Component({
  selector: 'ui-chip-input',
  template: `
    <div class="ci" [class.no-radius]="!radius()" [class.invalid]="invalid()" (click)="focusInput()">
      @for (chip of chips(); track $index) {
        <span class="chip"><span class="chip-text" [attr.title]="chip">{{ chip }}</span><button type="button" class="x" tabindex="-1" [attr.aria-label]="'Remove ' + chip" [disabled]="disabled()" (click)="removeAt($index, $event)"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></span>
      }
      <input #inp class="entry" [attr.placeholder]="chips().length ? '' : placeholder()" [attr.aria-label]="label() || null"
             [attr.aria-invalid]="invalid() || null"
             [disabled]="disabled()" (keydown)="onKey($event)" (blur)="onTouched()" />
    </div>
  `,
  styles: `
    :host { display: block; }
    .ci { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); align-items: center; box-sizing: border-box; min-height: var(--ui-size-md);
      padding: 2px var(--ui-space-1); line-height: 1.35; background: var(--ui-color-surface); border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius); cursor: text;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ci:focus-within { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .ci.no-radius { border-radius: 0; }
    .ci.invalid { border-color: var(--ui-color-danger); }
    .ci.invalid:focus-within { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger); }
    .ci:has(.entry:disabled) { opacity: .5; cursor: not-allowed; }
    .chip { display: inline-flex; align-items: center; gap: var(--ui-space-1); max-width: 100%; min-width: 0; box-sizing: border-box; height: 22px;
      padding: 0 var(--ui-space-1) 0 var(--ui-space-2);
      background: color-mix(in srgb, var(--ui-color-primary) 18%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-primary) 45%, transparent);
      border-radius: var(--ui-radius-pill); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .chip-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* 24x24 hit box (WCAG 2.5.8) drawing the same 16px circle: 4px of padding outside the painted
       background, and negative margins so the chip keeps its compact size. */
    .x { display: grid; place-items: center; flex: none; box-sizing: border-box; width: 24px; height: 24px; margin: -2px -4px -2px -4px;
      border: none; background: none; background-clip: content-box; color: inherit; cursor: pointer;
      font: inherit; padding: 4px; border-radius: var(--ui-radius-pill); opacity: .7;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard), background var(--ui-motion-fast) var(--ui-ease-standard); }
    .x:hover:not(:disabled) { opacity: 1; background-color: color-mix(in srgb, currentColor 14%, transparent); }
    .x:disabled { cursor: not-allowed; }
    .x:focus-visible { outline: none; opacity: 1; box-shadow: var(--ui-focus-ring); }
    .entry { flex: 1; min-width: 80px; box-sizing: border-box; padding: 0 var(--ui-space-2); border: none; background: transparent; outline: none; color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); height: 24px; }
    .entry::placeholder { color: var(--ui-color-text-muted); }
    .entry:disabled { cursor: not-allowed; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiChipInput), multi: true }],
})
export class UiChipInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  placeholder = input('Add tag…');
  /** Accessible name for the text field, when no ui-form-field label names it (e.g. a toolbar search). */
  label = input<string>();
  invalid = input(false);
  radius = input<boolean>(this.config.radius);

  private readonly inp = viewChild<ElementRef<HTMLInputElement>>('inp');
  protected readonly chips = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (v: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string[]): void { this.chips.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onKey(e: KeyboardEvent): void {
    const input = e.target as HTMLInputElement;
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      this.chips.update((c) => [...c, input.value.trim()]);
      input.value = '';
      this.onChange(this.chips());
    } else if (e.key === 'Backspace' && !input.value && this.chips().length) {
      this.chips.update((c) => c.slice(0, -1));
      this.onChange(this.chips());
    }
  }
  protected removeAt(i: number, e: Event): void {
    e.stopPropagation();
    if (this.disabled()) return;
    this.chips.update((c) => c.filter((_, idx) => idx !== i));
    this.onChange(this.chips());
  }
  protected focusInput(): void { this.inp()?.nativeElement.focus(); }
}
