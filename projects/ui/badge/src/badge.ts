import { Component, input } from '@angular/core';
import type { UiStatus } from '@zouriel/ui';

/** `ui-badge` — small status/count label. */
@Component({
  selector: 'ui-badge',
  template: `<span class="ui-badge" [attr.data-tone]="tone()" [class.dot]="dot()"><ng-content /></span>`,
  styles: `
    :host { display: inline-flex; }
    .ui-badge {
      display: inline-flex; align-items: center; gap: var(--ui-space-1);
      box-sizing: border-box; height: calc(20px * var(--ui-density-scale)); padding: 0 var(--ui-space-2);
      border-radius: var(--ui-radius-pill);
      font-size: 11px; font-weight: 600; line-height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums;
      font-family: var(--ui-font-default);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
    }
    /* Thaana (0.46.1): its marks below the line hang lower than Latin descenders and spilled out of the
       16px line and the fixed height. In a Dhivehi or right-to-left context the pill takes the font's own
       line height (the Thaana fallback's metrics count once it draws) and 1px more below, growing only as
       far as the text needs; Latin keeps 20px (compact: 20px, from 18px). Set lang="dv" on a Thaana badge in
       an English page to get the same. */
    .ui-badge:is(:lang(dv), :dir(rtl)) {
      height: auto; min-height: calc(20px * var(--ui-density-scale));
      line-height: normal; padding-block: 0 1px;
    }
    .ui-badge.dot { width: 8px; height: 8px; min-height: 0; padding: 0; }
    .ui-badge { --ui-color-icon: currentColor; }
    .ui-badge[data-tone="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-badge[data-tone="success"] { background: var(--ui-color-success); color: var(--ui-color-success-contrast); border-color: transparent; }
    .ui-badge[data-tone="warning"] { background: var(--ui-color-warning); color: var(--ui-color-warning-contrast); border-color: transparent; }
    .ui-badge[data-tone="danger"] { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); border-color: transparent; }
  `,
})
export class UiBadge {
  tone = input<UiStatus>('neutral');
  /** Render as a bare status dot (no content). */
  dot = input(false);
}
