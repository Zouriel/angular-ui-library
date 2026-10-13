import { Component, model } from '@angular/core';
import type { UiTheme } from './ui-theme.service';

/**
 * Scoped theme boundary. Wrap any subtree to override the theme for just that
 * region — the token custom properties cascade to descendants. Uses
 * `display: contents` so it never introduces layout of its own.
 *
 *   <ui-theme-provider theme="light"> ... </ui-theme-provider>
 */
@Component({
  selector: 'ui-theme-provider',
  template: `<ng-content />`,
  host: { '[attr.data-theme]': 'theme()' },
  styles: `
    :host { display: contents; }
    /* Opt-in: class="ui-surface" paints the island in its own theme (background + text colour),
       so a light region inside a dark page doesn't inherit the page's text colour. */
    :host(.ui-surface) { display: block; background: var(--ui-color-bg); color: var(--ui-color-text); }
  `,
})
export class UiThemeProvider {
  theme = model<UiTheme>('dark');
}
