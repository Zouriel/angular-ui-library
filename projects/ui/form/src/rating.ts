import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-rating` — star rating (CVA). */
@Component({
  selector: 'ui-rating',
  template: `
    <div class="ui-rating" role="radiogroup" [attr.aria-label]="label()">
      @for (i of stars(); track i) {
        <button
          type="button"
          class="star"
          [class.filled]="i <= (hover() || value())"
          role="radio"
          [attr.aria-checked]="i === value()"
          [attr.aria-label]="i + ' of ' + max()"
          [disabled]="disabled()"
          (click)="set(i)"
          (mouseenter)="!disabled() && hover.set(i)"
          (mouseleave)="hover.set(0)"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z"/></svg></button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .ui-rating { display: inline-flex; gap: 2px; }
    /* Drawn star (a ★ glyph fell back to Arial). Empty = outline in text-muted so it clears 3:1 in
       every theme (--ui-color-border measured 1.2–1.5:1); filled = solid warning. */
    .star { display: grid; place-items: center; border: none; background: none; cursor: pointer; padding: 0; font: inherit;
      color: var(--ui-color-text-muted); transition: color var(--ui-motion-fast) var(--ui-ease-standard); }
    .star svg path { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
    .star.filled { color: var(--ui-color-warning); }
    .star.filled svg path { fill: currentColor; }
    .star:disabled { cursor: not-allowed; opacity: .5; }
    .star:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiRating), multi: true }],
})
export class UiRating implements ControlValueAccessor {
  max = input(5);
  label = input('Rating');

  protected readonly value = signal(0);
  protected readonly hover = signal(0);
  protected readonly disabled = signal(false);
  private onChange: (v: number) => void = () => {};
  protected onTouched: () => void = () => {};

  protected stars(): number[] {
    return Array.from({ length: this.max() }, (_, i) => i + 1);
  }

  writeValue(v: number): void { this.value.set(v ?? 0); }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: number): void {
    const next = this.value() === v ? 0 : v;
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }
}
