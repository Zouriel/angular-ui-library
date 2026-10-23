import { Component, ElementRef, forwardRef, input, model, signal, viewChildren } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import type { UiSize } from '@zouriel/ui';
import { UiScrollFade } from '@zouriel/ui/behaviors';

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
 * `[(value)]` or ngModel. Too wide for its space, it scrolls sideways with the cut-off edge faded.
 */
@Component({
  selector: 'ui-segmented',
  imports: [UiScrollFade],
  template: `
    <div class="seg" uiScrollFade role="radiogroup" [attr.aria-label]="label()" [attr.data-size]="size()">
      @for (o of options(); track o.value; let i = $index) {
        <button #opt type="button" role="radio" class="opt" [class.on]="o.value === value()"
          [attr.aria-checked]="o.value === value()" [attr.aria-label]="o.glyph ? o.label : null" [attr.title]="o.glyph ? o.label : null"
          [attr.tabindex]="o.value === value() || (!hasValue() && i === 0) ? 0 : -1" [disabled]="o.disabled || disabled()"
          (click)="choose(o.value)" (keydown)="onKey($event, i)" (blur)="onTouched()">{{ o.glyph ?? o.label }}</button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-flex; max-width: 100%; }
    .seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle);
      border: 1px solid var(--ui-color-border); max-width: 100%; overflow-x: auto; }
    .opt { flex: 1 0 auto; min-width: 30px; height: calc(var(--ui-size-md) - 6px); padding: 0 var(--ui-space-3); border: 0; border-radius: calc(var(--ui-radius) - 2px);
      background: transparent; color: var(--ui-color-text-muted); font: 500 var(--ui-font-size-sm) var(--ui-font-default); cursor: pointer; white-space: nowrap;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    /* sm: the track is as tall as the other sm controls (26px). Its options paint 22px but their hit
       area reaches over the 1px track padding, so the target stays 24px tall (WCAG 2.5.8). */
    /* md and lg: the hit area reaches over the 2px track padding too, so a compact md option (20px
       painted, 0.45.0) is still a 24px target. */
    .opt { position: relative; }
    .opt::before { content: ''; position: absolute; left: 0; right: 0; top: -2px; bottom: -2px; }
    .seg[data-size="sm"] { padding: 1px; gap: 1px; }
    .seg[data-size="sm"] .opt { position: relative; height: calc(var(--ui-size-sm) - 4px); min-width: 24px; padding: 0 var(--ui-space-2); }
    .seg[data-size="sm"] .opt::before { top: -1px; bottom: -1px; }
    .seg[data-size="lg"] .opt { height: calc(var(--ui-size-lg) - 6px); padding: 0 var(--ui-space-4); font-size: var(--ui-font-size-md); }
    .opt:hover:not(:disabled):not(.on) { color: var(--ui-color-text); background: var(--ui-color-surface-hover); }
    .opt.on { --ui-color-icon: currentColor; }
    .opt.on { background: var(--ui-color-surface-raised); color: var(--ui-color-text); box-shadow: var(--ui-shadow-1); }
    /* Inset: .seg scrolls horizontally, which would clip an outset ring. */
    .opt:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .opt:disabled { opacity: .5; cursor: not-allowed; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSegmented), multi: true }],
})
export class UiSegmented implements ControlValueAccessor {
  options = input<readonly UiSegmentedOption[]>([]);
  value = model<string | null>(null);
  label = input('Options');
  size = input<UiSize>('md');

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('opt');
  /** A signal, so a form's disable() re-renders the buttons even with no event in flight (zoneless). */
  protected readonly disabled = signal(false);
  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

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
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
