import { Component, computed, input } from '@angular/core';

/**
 * `ui-meter` — a measurement against a budget, e.g. file size against a limit. Unlike a progress bar
 * it isn't a task finishing: it turns warning past `warnAt` and danger past `dangerAt`, and says so in
 * its text, so the colour is never the only signal.
 */
@Component({
  selector: 'ui-meter',
  template: `
    <div class="head">
      @if (label()) { <span class="label">{{ label() }}</span> }
      <span class="value" [attr.data-tone]="tone()">{{ valueText() || value() + ' / ' + max() }}@if (statusText()) { <span class="status"> · {{ statusText() }}</span> }</span>
    </div>
    <div class="track" role="meter" [attr.aria-valuenow]="value()" [attr.aria-valuemin]="0" [attr.aria-valuemax]="max()"
      [attr.aria-valuetext]="(valueText() || value()) + (statusText() ? ', ' + statusText() : '')" [attr.aria-label]="label() || 'Meter'">
      <div class="fill" [attr.data-tone]="tone()" [style.width.%]="pct()"></div>
      @if (warnAt() !== null) { <span class="tick" [style.left.%]="tickPct(warnAt()!)"></span> }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 120px; }
    .head { display: flex; justify-content: space-between; gap: var(--ui-space-2); margin-bottom: 4px; font-size: var(--ui-font-size-sm); }
    .label { color: var(--ui-color-text-muted); }
    .value { font-family: var(--ui-font-mono); color: var(--ui-color-text-secondary); white-space: nowrap; }
    .value[data-tone="warning"] { color: var(--ui-color-warning); }
    .value[data-tone="danger"] { color: var(--ui-color-danger); }
    .status { font-family: var(--ui-font-default); }
    .track { position: relative; height: 6px; border-radius: var(--ui-radius-pill); background: var(--ui-color-track); overflow: hidden; }
    .fill { height: 100%; border-radius: inherit; background: var(--ui-color-success); transition: width var(--ui-motion-base) var(--ui-ease-standard); }
    .fill[data-tone="warning"] { background: var(--ui-color-warning); }
    .fill[data-tone="danger"] { background: var(--ui-color-danger); }
    .tick { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--ui-color-surface); opacity: .8; }
  `,
})
export class UiMeter {
  value = input(0);
  max = input(100);
  /** Past this, the meter is a warning. */
  warnAt = input<number | null>(null);
  /** Past this, it's a danger. Defaults to `max`. */
  dangerAt = input<number | null>(null);
  label = input('');
  /** How the value is written, e.g. "212 KB of 800 KB". */
  valueText = input('');
  warnText = input('Getting large');
  dangerText = input('Over the limit');

  protected readonly pct = computed(() => Math.max(0, Math.min(100, (this.value() / (this.max() || 1)) * 100)));
  protected tickPct(at: number): number { return Math.max(0, Math.min(100, (at / (this.max() || 1)) * 100)); }
  protected readonly tone = computed(() => {
    const danger = this.dangerAt() ?? this.max();
    if (this.value() > danger) return 'danger';
    const warn = this.warnAt();
    return warn !== null && this.value() > warn ? 'warning' : 'success';
  });
  protected readonly statusText = computed(() =>
    this.tone() === 'danger' ? this.dangerText() : this.tone() === 'warning' ? this.warnText() : '');
}
