import { Component, inject, input } from '@angular/core';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';
import type { UiButtonVariant } from './button';

/**
 * `ui-icon-button` — square, icon-only action. `label` is REQUIRED and applied
 * as `aria-label` so the control is named for assistive tech (WCAG).
 */
@Component({
  selector: 'ui-icon-button',
  template: `
    <button
      class="ui-icon-btn"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.round]="round()"
      [attr.type]="type()"
      [attr.data-variant]="variant()"
      [attr.data-size]="size()"
      [attr.aria-label]="label()"
      [disabled]="disabled()">
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-icon-btn {
      position: relative;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-md); height: var(--ui-size-md);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font: inherit; padding: 0;
      cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    /* Invisible hit-slop on coarse pointers only: every size here is below the 44px touch minimum.
       On desktop a slop overlapped the next button in a dense toolbar and stole its clicks. */
    @media (pointer: coarse) {
      .ui-icon-btn::before { content: ''; position: absolute; inset: calc((var(--ui-size-md) - var(--ui-size-touch)) / 2); }
      .ui-icon-btn[data-size="sm"]::before { inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2); }
      .ui-icon-btn[data-size="lg"]::before { inset: calc((var(--ui-size-lg) - var(--ui-size-touch)) / 2); }
    }
    .ui-icon-btn:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .ui-icon-btn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-icon-btn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-icon-btn:disabled { opacity: .5; cursor: not-allowed; }
    .ui-icon-btn.no-radius { border-radius: 0; }
    .ui-icon-btn.round { border-radius: var(--ui-radius-pill); }
    .ui-icon-btn.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .ui-icon-btn[data-size="sm"] { width: var(--ui-size-sm); height: var(--ui-size-sm); }
    .ui-icon-btn[data-size="lg"] { width: var(--ui-size-lg); height: var(--ui-size-lg); }
    .ui-icon-btn[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    .ui-icon-btn[data-variant="destructive"] { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="destructive"]:hover:not(:disabled) { background: var(--ui-color-danger-hover); }
    .ui-icon-btn[data-variant="primary"]:active:not(:disabled) { background: var(--ui-color-primary-active); }
    .ui-icon-btn[data-variant="secondary"] { background: var(--ui-color-secondary); color: var(--ui-color-secondary-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="secondary"]:hover:not(:disabled) { background: var(--ui-color-secondary-hover); }
    .ui-icon-btn[data-variant="accent"] { background: var(--ui-color-accent); color: var(--ui-color-accent-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="accent"]:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-accent) 88%, var(--ui-color-accent-contrast)); }
    .ui-icon-btn[data-variant="outline"] { background: transparent; }
    /* Icons follow the button's colour when it is filled; ghost and outline ones take --ui-color-icon. */
    .ui-icon-btn:not([data-variant="ghost"]):not([data-variant="outline"]):not([data-variant="link"]) { --ui-color-icon: currentColor; }
    .ui-icon-btn[data-variant="ghost"], .ui-icon-btn[data-variant="link"] { background: transparent; border-color: transparent; }
    .ui-icon-btn[data-variant="brand"] { background: var(--ui-gradient-brand, var(--ui-color-primary)); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-icon-btn[data-variant="brand"]:hover:not(:disabled) { background: var(--ui-gradient-brand, var(--ui-color-primary)); box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--ui-color-primary-contrast) 12%, transparent); }
    /* Projected icons carry the parent's content attribute, so they need ::ng-deep to be sized. */
    .ui-icon-btn ::ng-deep svg { width: 16px; height: 16px; flex: none; }
    .ui-icon-btn[data-size="sm"] ::ng-deep svg { width: 14px; height: 14px; }
    .ui-icon-btn[data-size="lg"] ::ng-deep svg { width: 18px; height: 18px; }
  `,
})
export class UiIconButton {
  private config = inject(UI_CONFIG);
  /** Accessible name for the icon-only control (required for a11y). */
  label = input.required<string>();
  variant = input<UiButtonVariant>('ghost');
  size = input<UiSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  round = input(false);
  /** Opt-in glass treatment; solid by default (see UiButton). */
  glass = input(false);
  radius = input<boolean>(this.config.radius);
}
