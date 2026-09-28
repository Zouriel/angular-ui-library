import { Component, computed, forwardRef, input, model, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface UiAnchor { x: number; y: number }

const NAMES = [['Top left', 'Top', 'Top right'], ['Left', 'Centre', 'Right'], ['Bottom left', 'Bottom', 'Bottom right']];

/**
 * `ui-anchor-picker` — the nine-dot grid for choosing a point of a box (a pivot, an alignment), as in
 * Figma and Photoshop. The value is `{x, y}` in fractions of the box (0, 0.5, 1); a value between the
 * dots shows no dot chosen. Arrow keys move the choice; each dot is named for screen readers.
 */
@Component({
  selector: 'ui-anchor-picker',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiAnchorPicker), multi: true }],
  template: `
    <div class="grid" role="radiogroup" [attr.aria-label]="label()">
      @for (row of rows; track $index; let r = $index) {
        @for (col of rows; track $index; let c = $index) {
          <button type="button" role="radio" class="dot" [class.on]="chosen() === r * 3 + c"
            [attr.aria-checked]="chosen() === r * 3 + c" [attr.aria-label]="names[r][c]" [attr.title]="names[r][c]"
            [attr.tabindex]="(chosen() ?? 4) === r * 3 + c ? 0 : -1" [disabled]="disabled()"
            (click)="pick(c, r)" (keydown)="onKey($event, c, r)"><span aria-hidden="true"></span></button>
        }
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .grid { display: grid; grid-template-columns: repeat(3, var(--ui-size-sm, 32px)); grid-template-rows: repeat(3, var(--ui-size-sm, 32px));
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle); }
    .dot { display: flex; align-items: center; justify-content: center; padding: 0; border: none; background: transparent; cursor: pointer; border-radius: var(--ui-radius); }
    .dot span { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-color-text-muted); opacity: 0.45;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), opacity var(--ui-motion-fast) var(--ui-ease-standard); }
    .dot:hover span { opacity: 0.9; }
    .dot.on span { width: 12px; height: 12px; background: var(--ui-color-primary); opacity: 1; }
    .dot:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .dot:disabled { cursor: not-allowed; }
  `,
})
export class UiAnchorPicker implements ControlValueAccessor {
  label = input('Point');
  value = model<UiAnchor | null>({ x: 0.5, y: 0.5 });

  protected readonly rows = [0, 1, 2];
  protected readonly names = NAMES;
  protected readonly disabled = signal(false);
  private onChange: (v: UiAnchor) => void = () => {};
  private onTouched: () => void = () => {};

  /** Index 0–8 of the chosen dot, or null for a point between them. */
  protected readonly chosen = computed(() => {
    const v = this.value() ?? { x: 0.5, y: 0.5 };
    const c = [0, 0.5, 1].findIndex((p) => Math.abs(p - v.x) < 0.001);
    const r = [0, 0.5, 1].findIndex((p) => Math.abs(p - v.y) < 0.001);
    return c < 0 || r < 0 ? null : r * 3 + c;
  });

  writeValue(v: UiAnchor | null): void { this.value.set(v ?? { x: 0.5, y: 0.5 }); }
  registerOnChange(fn: (v: UiAnchor) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected pick(c: number, r: number): void {
    const v = { x: c / 2, y: r / 2 };
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
  }

  protected onKey(e: KeyboardEvent, c: number, r: number): void {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const nc = Math.min(2, Math.max(0, c + m[0]));
    const nr = Math.min(2, Math.max(0, r + m[1]));
    this.pick(nc, nr);
    ((e.currentTarget as HTMLElement).parentElement?.children[nr * 3 + nc] as HTMLElement | undefined)?.focus();
  }
}
