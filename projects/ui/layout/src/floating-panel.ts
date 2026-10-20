import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

/**
 * `ui-floating-panel` — a raised surface floating over the bottom (or top) of its positioned parent:
 * the details card over a map, a summary over a list.
 *
 * Non-modal: it takes no focus and blocks nothing outside its own box, so the content around it
 * stays usable (a map still pans and zooms beside it). It sits 16px in from the parent's edges
 * (plus the device's safe-area insets), up to `--ui-floating-panel-width` (480px) wide and centred,
 * so it fits a 390px phone with a 16px gutter. Name it with `ariaLabel` and it is a region screen
 * readers can jump to. The parent needs `position: relative` (or any positioning).
 *
 *   <div class="map-wrap"><ui-map … /><ui-floating-panel ariaLabel="Nurse">…</ui-floating-panel></div>
 */
@Component({
  selector: 'ui-floating-panel',
  host: {
    class: 'ui-floating-panel',
    '[attr.data-placement]': 'placement()',
    '[class.glass]': 'glass()',
    '[class.no-radius]': '!radius()',
    '[attr.role]': "ariaLabel() ? 'region' : null",
    '[attr.aria-label]': 'ariaLabel() || null',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      position: absolute; z-index: 1;
      left: calc(var(--ui-space-4) + env(safe-area-inset-left, 0px));
      right: calc(var(--ui-space-4) + env(safe-area-inset-right, 0px));
      bottom: calc(var(--ui-space-4) + env(safe-area-inset-bottom, 0px));
      margin-inline: auto; max-width: var(--ui-floating-panel-width, 480px); box-sizing: border-box;
      max-height: calc(100% - 2 * var(--ui-space-4)); overflow: auto; overscroll-behavior: contain;
      padding: var(--ui-space-4);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-3);
      font-family: var(--ui-font-default); line-height: 1.4;
      animation: ui-floating-panel-in var(--ui-motion-base) var(--ui-ease-decelerate) both;
    }
    :host([data-placement="top"]) {
      bottom: auto;
      top: calc(var(--ui-space-4) + env(safe-area-inset-top, 0px));
      animation-name: ui-floating-panel-in-top;
    }
    :host(.glass) { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    :host(.no-radius) { border-radius: 0; }
    @keyframes ui-floating-panel-in { from { opacity: 0; transform: translateY(8px); } }
    @keyframes ui-floating-panel-in-top { from { opacity: 0; transform: translateY(-8px); } }
    @media (prefers-reduced-motion: reduce) {
      :host, :host([data-placement="top"]) { animation-name: ui-fade-in; }
    }
  `,
})
export class UiFloatingPanel {
  private config = inject(UI_CONFIG);
  /** The edge of the parent it floats over. */
  placement = input<'bottom' | 'top'>('bottom');
  /** Names it as a region for screen readers. */
  ariaLabel = input<string | undefined>(undefined);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
}
