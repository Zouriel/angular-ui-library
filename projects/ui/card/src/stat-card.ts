import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

/** `ui-stat-card` — KPI tile: label, value, optional delta + icon slot. */
@Component({
  selector: 'ui-stat-card',
  template: `
    <div class="stat" [class.glass]="glass()" [class.no-radius]="!radius()">
      <div class="top">
        <span class="label">{{ label() }}</span>
        <span class="icon"><ng-content select="[stat-icon]" /></span>
      </div>
      <div class="value">{{ value() }}</div>
      @if (delta() !== undefined) {
        <div class="delta" [attr.data-trend]="trend()">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path [attr.d]="trend() === 'down' ? 'M2 4h8L6 9z' : 'M2 8h8L6 3z'" fill="currentColor"/></svg>
          <span class="sr-only">{{ trend() === 'down' ? 'Down ' : 'Up ' }}</span>{{ delta() }}
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    /* Fills a stretched host (a grid row) so neighbouring tiles are equal height, like ui-card. */
    .stat { display: flex; flex-direction: column; gap: var(--ui-space-1); height: 100%; box-sizing: border-box;
      padding: var(--ui-space-3) var(--ui-space-4);
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg); box-shadow: var(--ui-shadow-1); font-family: var(--ui-font-default); line-height: 1.35; }
    .stat.no-radius { border-radius: 0; }
    .stat.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .icon { flex: none; display: inline-flex; color: var(--ui-color-text-muted); }
    .icon:empty { display: none; }
    .value { font-family: var(--ui-font-display); font-variant-numeric: tabular-nums; font-size: 1.6rem; font-weight: 700; letter-spacing: var(--ui-tracking-tight); color: var(--ui-color-text); line-height: 1.1; }
    .delta { font-size: var(--ui-font-size-sm); font-weight: 600; font-variant-numeric: tabular-nums; }
    .delta { display: inline-flex; align-items: center; gap: var(--ui-space-1); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .delta[data-trend="up"] { color: var(--ui-color-success); }
    .delta[data-trend="down"] { color: var(--ui-color-danger); }
  `,
})
export class UiStatCard {
  private config = inject(UI_CONFIG);
  label = input('');
  value = input<string | number>('');
  delta = input<string | number>();
  trend = input<'up' | 'down'>('up');
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
}
