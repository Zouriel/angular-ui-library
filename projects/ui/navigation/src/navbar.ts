import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

/**
 * `ui-navbar` — top navigation surface (glass-capable). Slots:
 * `[navbar-brand]`, default (center/links), `[navbar-actions]`.
 */
@Component({
  selector: 'ui-navbar',
  // Sticky belongs on the host. A sticky element is confined to its parent's box, and the parent
  // here is the host, which is exactly the bar's own height: the bar would scroll away with it and
  // never stick to anything. Hosts are laid out by the page, so this is the element that can.
  host: { '[class.ui-navbar-sticky]': 'sticky()' },
  template: `
    <nav class="ui-navbar" [class.glass]="glass()" [class.no-radius]="!radius()">
      <div class="brand"><ng-content select="[navbar-brand]" /></div>
      <div class="links"><ng-content /></div>
      <div class="actions"><ng-content select="[navbar-actions]" /></div>
    </nav>
  `,
  styles: `
    :host { display: block; }
    .ui-navbar {
      display: flex; align-items: center; gap: var(--ui-space-4);
      height: 52px; padding: 0 var(--ui-space-4);
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default);
    }
    .ui-navbar.no-radius { border-radius: 0; }
    .ui-navbar.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    :host(.ui-navbar-sticky) { position: sticky; top: 0; z-index: var(--ui-z-docked); }
    .brand { font-weight: 700; color: var(--ui-color-text); letter-spacing: var(--ui-tracking-tight); display: flex; align-items: center; gap: var(--ui-space-2); }
    .links { display: flex; align-items: center; gap: var(--ui-space-2); flex: 1; }
    .actions { display: flex; align-items: center; gap: var(--ui-space-2); }

    /*
     * On a narrow screen a single fixed-height row silently truncates: the last links and the whole
     * actions slot end up past the right edge, unreachable, with no scrollbar to hint at it. Wrapping
     * to a second row keeps everything on the page. The links row scrolls on its own as a last
     * resort, for a nav with more items than a phone can hold.
     */
    @media (max-width: 48rem) {
      .ui-navbar { height: auto; flex-wrap: wrap; padding-block: var(--ui-space-2); gap: var(--ui-space-2); }
      .brand { flex: 1 0 auto; }
      /* nowrap so a two-word link scrolls out of view rather than stacking into a tall column and
         dragging the whole bar down with it. */
      .links { order: 1; flex-basis: 100%; overflow-x: auto; scrollbar-width: none; white-space: nowrap; }
      .links::-webkit-scrollbar { display: none; }
      .actions { flex: 0 0 auto; }
    }
  `,
})
export class UiNavbar {
  private config = inject(UI_CONFIG);
  sticky = input(false);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
}
