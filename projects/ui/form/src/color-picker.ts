import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from '@zouriel/ui';

/** `ui-color-picker` — native color well + hex field + preset swatches (CVA; value is hex). */
@Component({
  selector: 'ui-color-picker',
  template: `
    <div class="cp" [class.no-radius]="!radius()">
      <label class="well" [style.background]="value()">
        <input type="color" [value]="value()" [disabled]="disabled()" (input)="set($any($event.target).value)" aria-label="Pick color" />
      </label>
      <input class="hex" [value]="value()" [disabled]="disabled()" (input)="typeHex($any($event.target).value)" (blur)="leaveHex($event)" aria-label="Hex color" />
      <div class="swatches">
        @for (c of swatches(); track c) {
          <button type="button" class="sw" [attr.aria-label]="c" [attr.aria-pressed]="c.toLowerCase() === (value() || '').toLowerCase()" [disabled]="disabled()" (click)="set(c)"><span class="dot" [style.background]="c"></span></button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .cp { display: flex; align-items: center; gap: var(--ui-space-2); }
    .well { box-sizing: border-box; width: var(--ui-size-md); height: var(--ui-size-md); border-radius: var(--ui-radius); border: 1px solid var(--ui-control-border); overflow: hidden; cursor: pointer; flex: none; }
    .cp.no-radius .well, .cp.no-radius .hex { border-radius: 0; }
    .well:has(input:disabled) { opacity: .5; cursor: not-allowed; }
    /* The native colour input is invisible, so its keyboard focus is drawn on the well. */
    .well:has(input:focus-visible) { box-shadow: var(--ui-focus-ring); }
    .well input { opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    .hex { box-sizing: border-box; width: 92px; height: var(--ui-size-md); padding: 0 var(--ui-space-3); background: var(--ui-color-surface);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius); color: var(--ui-color-text);
      font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); outline: none;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .hex:focus-visible { border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .hex:disabled { opacity: .5; cursor: not-allowed; }
    /* Each swatch is a 24x24 button (WCAG 2.5.8 target size) drawing a 20px dot, 4px apart, so the
       dots sit 8px apart and the selected ring (3px out) keeps clear of its neighbour. */
    .swatches { display: flex; gap: var(--ui-space-1); }
    .sw { display: grid; place-items: center; box-sizing: border-box; width: 24px; height: 24px; border: none; border-radius: 50%;
      background: transparent; cursor: pointer; padding: 0; }
    .dot { box-sizing: border-box; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--ui-color-border);
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .sw:hover:not(:disabled) .dot { transform: scale(1.1); }
    .sw[aria-pressed="true"] .dot { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 3px var(--ui-color-text); }
    .sw:disabled { opacity: .5; cursor: not-allowed; }
    .sw:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiColorPicker), multi: true }],
})
export class UiColorPicker implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  radius = input<boolean>(this.config.radius);
  swatches = input<string[]>(['#1b3d59', '#6a97c0', '#b3d5f1', '#f3eed8', '#2e6b50', '#a83a3f']);

  protected readonly value = signal('#1b3d59');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected set(v: string): void {
    this.value.set(v);
    this.onChange(v);
  }

  /**
   * The hex field passes a colour on only once it is a whole one (#rgb or #rrggbb, the # optional).
   * Passing on each keystroke sent "#3d" to the form and turned the well black, since a colour input
   * can't hold a partial value.
   */
  protected typeHex(raw: string): void {
    const hex = normalizeHex(raw);
    if (hex && hex !== this.value().toLowerCase()) this.set(hex);
  }

  /** Leaving the field shows the current colour again, replacing any half-typed text. */
  protected leaveHex(e: FocusEvent): void {
    (e.target as HTMLInputElement).value = this.value();
    this.onTouched();
  }
}

/** `#RGB`, `RRGGBB` and the like as lower-case `#rrggbb`, or null when it isn't a whole hex colour. */
function normalizeHex(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return '#' + h.toLowerCase();
}
