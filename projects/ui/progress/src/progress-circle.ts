import { Component, computed, input } from '@angular/core';
import { type UiStatus, injectUiStrings } from '@zouriel/ui';

/**
 * `ui-progress-circle` — the round sibling of ui-progress-bar: determinate when `value` (0–100) is
 * set, otherwise a turning arc. `showValue` writes the percentage in the middle; projected content
 * goes in the middle instead (a countdown's seconds: `<ui-progress-circle [value]="left / total * 100">{{ left }}</ui-progress-circle>`).
 * A `progressbar` named by `label`; under reduced motion the arc still turns, more slowly.
 */
@Component({
  selector: 'ui-progress-circle',
  host: { '[style.--ui-pc-size]': "size() + 'px'" },
  template: `
    <span class="ring" role="progressbar" [attr.aria-label]="labelText()"
          [attr.aria-valuenow]="pct()" [attr.aria-valuemin]="pct() === null ? null : 0" [attr.aria-valuemax]="pct() === null ? null : 100"
          [attr.data-tone]="tone()" [class.spin]="pct() === null">
      <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" aria-hidden="true">
        <circle class="track" [attr.cx]="size() / 2" [attr.cy]="size() / 2" [attr.r]="r()" [attr.stroke-width]="strokeWidth()" />
        <circle class="arc" [attr.cx]="size() / 2" [attr.cy]="size() / 2" [attr.r]="r()" [attr.stroke-width]="strokeWidth()"
                [attr.stroke-dasharray]="circ()" [attr.stroke-dashoffset]="offset()" />
      </svg>
      <span class="centre"><ng-content />@if (showValue() && pct() !== null) {<span class="pct">{{ pct() }}%</span>}</span>
    </span>
  `,
  styles: `
    :host { display: inline-flex; }
    .ring { position: relative; display: inline-grid; place-items: center; width: var(--ui-pc-size); height: var(--ui-pc-size); }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    circle { fill: none; }
    .track { stroke: var(--ui-color-track); }
    .arc { stroke: var(--ui-color-primary); stroke-linecap: round; transition: stroke-dashoffset var(--ui-motion-base) var(--ui-ease-standard); }
    [data-tone="success"] .arc { stroke: var(--ui-color-success); }
    [data-tone="warning"] .arc { stroke: var(--ui-color-warning); }
    [data-tone="danger"] .arc { stroke: var(--ui-color-danger); }
    [data-tone="neutral"] .arc { stroke: var(--ui-color-text-muted); }
    .spin svg { animation: ui-pc-turn 1.4s linear infinite; }
    .centre { position: relative; display: inline-flex; align-items: center; justify-content: center;
      font-family: var(--ui-font-default); font-weight: 600; color: var(--ui-color-text); line-height: 1;
      font-size: clamp(11px, calc(var(--ui-pc-size) * 0.26), 32px); font-variant-numeric: tabular-nums; }
    @keyframes ui-pc-turn { from { transform: rotate(-90deg); } to { transform: rotate(270deg); } }
    @media (prefers-reduced-motion: reduce) { .spin svg { animation-duration: 2.8s; } .arc { transition: none; } }
  `,
})
export class UiProgressCircle {
  protected readonly strings = injectUiStrings();
  /** 0–100, or null for an indeterminate turning arc. */
  value = input<number | null>(null);
  /** Diameter in px. */
  size = input(40);
  strokeWidth = input(4);
  tone = input<UiStatus>('primary');
  /** Accessible name. */
  /** Default: the built-in `progress` (Progress), which follows the app's language. */
  label = input<string | undefined>(undefined);
  protected readonly labelText = computed(() => this.label() ?? this.strings.progress);
  /** Write the percentage in the middle (when nothing is projected there). */
  showValue = input(false);

  protected readonly pct = computed(() => {
    const v = this.value();
    return v === null || v === undefined || Number.isNaN(v) ? null : Math.round(Math.min(100, Math.max(0, v)));
  });
  protected readonly r = computed(() => (this.size() - this.strokeWidth()) / 2);
  protected readonly circ = computed(() => 2 * Math.PI * this.r());
  /** The determinate arc's gap; the indeterminate arc shows about a third of the ring. */
  protected readonly offset = computed(() => {
    const p = this.pct();
    return this.circ() * (1 - (p === null ? 0.3 : p / 100));
  });
}
