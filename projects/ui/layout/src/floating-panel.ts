import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, booleanAttribute, PLATFORM_ID, afterNextRender, effect, inject, input, output } from '@angular/core';
import { UI_CONFIG, type UiGlassStrength } from '@zouriel/ui';

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
 *
 * `(coverChange)` reports how much of the parent's edge it covers, in px (its gutter plus its
 * height), whenever that changes: feed it to a map's `insets` so the map centres below a status
 * card at the top.
 *
 * `glass` (0.41.2) is the same see-through surface as `ui-bottom-sheet`'s `glass`, with the same
 * `glassStrength` (0.41.3): `'clear'` (the default) lets a map in the theme's brightness plainly show
 * through, `'frosted'` is the near-opaque surface that stays AA over anything; solid where
 * `backdrop-filter` is missing or under reduced transparency or more contrast.
 */
@Component({
  selector: 'ui-floating-panel',
  host: {
    class: 'ui-floating-panel',
    '[attr.data-placement]': 'placement()',
    '[class.glass]': 'glass()',
    '[class.frosted]': "glass() && glassStrength() === 'frosted'",
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
    /* glass: the see-through recipe of ui-bottom-sheet's glass, so a status card over a map matches
       the sheet (see tokens.css). Clear by default (0.41.3): the map shows through; frosted holds AA
       over any backdrop. Solid when it can't be either. */
    :host(.glass) {
      background: var(--ui-glass-clear-bg); border-color: var(--ui-glass-border);
      -webkit-backdrop-filter: var(--ui-glass-clear-filter); backdrop-filter: var(--ui-glass-clear-filter);
    }
    :host(.glass.frosted) {
      background: var(--ui-glass-sheet-bg);
      -webkit-backdrop-filter: var(--ui-glass-sheet-filter); backdrop-filter: var(--ui-glass-sheet-filter);
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      :host(.glass), :host(.glass.frosted) { background: var(--ui-color-surface-raised); }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      :host(.glass), :host(.glass.frosted) { background: var(--ui-color-surface-raised); -webkit-backdrop-filter: none; backdrop-filter: none; }
    }
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
  /** See-through surface over a map, as ui-bottom-sheet's glass (0.41.2). */
  glass = input(this.config.glass, { transform: booleanAttribute });
  /**
   * How see-through `glass` is (0.41.3), as ui-bottom-sheet's: `'clear'` (default) for a map in the
   * theme's brightness, which plainly shows through; `'frosted'` for anything else (AA over any backdrop).
   */
  glassStrength = input<UiGlassStrength>('clear');
  radius = input<boolean>(this.config.radius);

  /** Px of the parent's edge (top or bottom, per `placement`) it covers: its gutter plus its height. */
  readonly coverChange = output<number>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private last = -1;
  private destroyed = false;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => (this.destroyed = true));
    afterNextRender(() => {
      const ro = new ResizeObserver(() => this.measure());
      ro.observe(this.el);
      destroy.onDestroy(() => ro.disconnect());
      this.measure();
    });
    // The other edge's gutter is read once the placement has been applied.
    effect(() => {
      this.placement();
      queueMicrotask(() => this.measure());
    });
  }

  /** Its height plus the gap between it and the parent's edge, from layout (the entry slide's transform doesn't count). */
  private measure(): void {
    if (this.destroyed) return;
    const el = this.el;
    const height = el.offsetHeight;
    const parent = el.offsetParent as HTMLElement | null;
    const gap = !parent ? 0 : this.placement() === 'top' ? el.offsetTop : parent.clientHeight - el.offsetTop - height;
    const cover = height ? Math.round(height + Math.max(0, gap)) : 0;
    if (cover === this.last) return;
    this.last = cover;
    this.coverChange.emit(cover);
  }
}
