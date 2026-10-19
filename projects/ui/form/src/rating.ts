import { Component, ElementRef, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * `ui-rating` — star rating (CVA). A radio group: one tab stop, arrow keys (and Home/End) move the
 * rating, clicking the current star again clears it to 0.
 */
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
          [attr.tabindex]="i === (value() || 1) ? 0 : -1"
          [disabled]="disabled()"
          (click)="set(i)"
          (keydown)="onKey($event, i)"
          (blur)="onTouched()"
          (mouseenter)="!disabled() && hover.set(i)"
          (mouseleave)="hover.set(0)"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z"/></svg></button>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    /* 24x24 buttons (WCAG 2.5.8 target size) around 20px stars; no gap, so the stars sit as before. */
    .ui-rating { display: inline-flex; }
    /* Drawn star (a ★ glyph fell back to Arial). Empty = outline in text-muted so it clears 3:1 in
       every theme (--ui-color-border measured 1.2–1.5:1); filled = solid warning. */
    .star { display: grid; place-items: center; box-sizing: border-box; width: 24px; height: 24px; border: none; background: none; cursor: pointer; padding: 0; font: inherit;
      color: var(--ui-color-text-muted); transition: color var(--ui-motion-fast) var(--ui-ease-standard); }
    .star svg path { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round; }
    .star.filled { color: var(--ui-rating-fill); }
    .star.filled svg path { fill: currentColor; }
    .star:disabled { cursor: not-allowed; opacity: .5; }
    .star:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiRating), multi: true }],
})
export class UiRating implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
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

  protected onKey(e: KeyboardEvent, i: number): void {
    const max = this.max();
    const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(max, i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, i - 1)
      : e.key === 'Home' ? 1 : e.key === 'End' ? max : 0;
    if (!next) return;
    e.preventDefault();
    if (next !== this.value()) {
      this.value.set(next);
      this.onChange(next);
    }
    this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.star')[next - 1]?.focus();
  }

  protected set(v: number): void {
    const next = this.value() === v ? 0 : v;
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }
}
