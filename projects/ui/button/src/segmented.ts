import { Component, ElementRef, forwardRef, inject, input, model, viewChildren } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import type { UiSize } from '@zouriel/ui';

export interface UiSegmentedOption {
  value: string;
  label: string;
  /** Short visible content instead of the label (the label stays the accessible name). */
  glyph?: string;
  disabled?: boolean;
}

/**
 * `ui-segmented` — a row of mutually exclusive options, e.g. alignment or a preview mode. A radio
 * group underneath: arrow keys move the choice, only the chosen option is in the tab order. Use
 * `[(value)]` or ngModel.
 */
@Component({
  selector: 'ui-segmented',
  template: `
    <div class="seg" role="radiogroup" [attr.aria-label]="label()" [attr.data-size]="size()">
      @for (o of options(); track o.value; let i = $index) {
        <button #opt type="button" role="radio" class="opt" [class.on]="o.value === value()"
          [attr.aria-checked]="o.value === value()" [attr.aria-label]="o.glyph ? o.label : null" [attr.title]="o.glyph ? o.label : null"
          [attr.tabindex]="o.value === value() || (!hasValue() && i === 0) ? 0 : -1" [disabled]="o.disabled || disabled"
          (click)="choose(o.value)" (keydown)="onKey($event, i)">{{ o.glyph ?? o.label }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; max-width: 100%; }
    .seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle);
      border: 1px solid var(--ui-color-border); max-width: 100%; overflow-x: auto; }
    .opt { flex: 1 0 auto; min-width: 30px; height: calc(var(--ui-size-md) - 6px); padding: 0 10px; border: 0; border-radius: calc(var(--ui-radius) - 2px);
      background: transparent; color: var(--ui-color-text-muted); font: 500 var(--ui-font-size-sm) var(--ui-font-default); cursor: pointer; white-space: nowrap;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .seg[data-size="sm"] .opt { height: calc(var(--ui-size-sm) - 6px); padding: 0 8px; font-size: 12px; }
    .opt:hover:not(:disabled):not(.on) { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .opt.on { background: var(--ui-color-surface-raised); color: var(--ui-color-text); box-shadow: var(--ui-shadow-1); }
    .opt:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .opt:disabled { opacity: .45; cursor: not-allowed; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSegmented), multi: true }],
})
export class UiSegmented implements ControlValueAccessor {
  options = input<readonly UiSegmentedOption[]>([]);
  value = model<string | null>(null);
  label = input('Options');
  size = input<UiSize>('md');

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('opt');
  protected disabled = false;
  private onChange: (v: string | null) => void = () => {};

  protected hasValue(): boolean {
    return this.options().some((o) => o.value === this.value());
  }

  protected choose(v: string): void {
    this.value.set(v);
    this.onChange(v);
  }

  protected onKey(e: KeyboardEvent, index: number): void {
    const opts = this.options();
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    for (let i = 1; i <= opts.length; i++) {
      const next = (index + step * i + opts.length) % opts.length;
      if (!opts[next].disabled) {
        this.choose(opts[next].value);
        this.buttons()[next]?.nativeElement.focus();
        return;
      }
    }
  }

  writeValue(v: string | null): void { this.value.set(v); }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(): void {}
  setDisabledState(d: boolean): void { this.disabled = d; }
}
