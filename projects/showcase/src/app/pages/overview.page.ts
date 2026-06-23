import { Component } from '@angular/core';
import { UiText } from 'ui/text';
import { UiCard } from 'ui/card';
import { UiBadge } from 'ui/badge';
import { DocPage, DocSection, DocDemo } from '../docs/docs-ui';

@Component({
  selector: 'page-overview',
  imports: [UiText, UiCard, UiBadge, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Introduction" title="UI Library"
      lead="A token-driven, signal-first Angular v22 component library — standalone, zoneless, tree-shakeable across secondary entry points, and fully themeable.">

      <doc-section name="Install" anchor="install"
        summary="Components live in secondary entry points so you import only what you use. Bring the peer deps and the global token stylesheet.">
        <doc-demo lang="bash" code="npm i ui @angular/cdk @angular/aria"></doc-demo>
        <ui-text variant="body">Then load the tokens once (e.g. in <code>angular.json</code> styles or your global stylesheet):</ui-text>
        <doc-demo lang="css" code="@import 'ui/styles/tokens.css';
@import 'ui/styles/animations.css';
/* optional: the cinematic skin */
@import 'ui/styles/theme-dramatic.css';
@import 'ui/styles/fx.css';"></doc-demo>
      </doc-section>

      <doc-section name="Usage" anchor="usage"
        summary="Every component is standalone — import it directly. No NgModules.">
        <doc-demo lang="ts" code="import { UiButton } from 'ui/button';

@Component({
  imports: [UiButton],
  template: '<ui-button variant=&quot;primary&quot;>Go</ui-button>',
})
export class Demo {}"></doc-demo>
      </doc-section>

      <doc-section name="Theming" anchor="theming"
        summary="Components only read CSS custom-property tokens, so a theme is just a set of token overrides. Switch with UiThemeService.set('dark' | 'light' | 'dramatic') — use the switcher in the top bar to preview.">
        <doc-demo lang="ts" code="theme = inject(UiThemeService);
this.theme.set('dramatic');   // cinematic ink/ember skin
this.theme.toggle();          // dark <-> light"></doc-demo>
      </doc-section>

      <doc-section name="What's inside" anchor="catalog"
        summary="~110 components across 33 entry points covering the full catalog plus two flagships (window system, file viewer) and a motion/FX layer.">
        <div class="grid">
          @for (g of groups; track g.title) {
            <ui-card padding="sm">
              <ui-text variant="label" card-header>{{ g.title }}</ui-text>
              <div class="tags">
                @for (t of g.items; track t) { <ui-badge>{{ t }}</ui-badge> }
              </div>
            </ui-card>
          }
        </div>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--ui-space-3); }
    .tags { display: flex; flex-wrap: wrap; gap: 4px; }
    code { font-family: var(--ui-font-mono); font-size: 0.9em; color: var(--ui-color-primary); }
  `,
})
export class OverviewPage {
  protected readonly groups = [
    { title: 'Buttons & actions', items: ['button', 'icon-button', 'button-group', 'toggle', 'split', 'dropdown', 'fab'] },
    { title: 'Forms', items: ['input', 'select', 'combobox', 'checkbox', 'switch', 'radio', 'slider', 'date-picker', 'rating', 'otp', '+more'] },
    { title: 'Overlays', items: ['tooltip', 'popover', 'menu', 'modal', 'drawer', 'toast', 'context-menu'] },
    { title: 'Feedback', items: ['alert', 'spinner', 'skeleton', 'progress', 'empty-state', 'result'] },
    { title: 'Navigation', items: ['navbar', 'tabs', 'side-nav', 'breadcrumbs', 'pagination', 'stepper', 'menubar'] },
    { title: 'Data', items: ['table', 'list', 'tree', 'tree-table', 'accordion', 'timeline', 'stat-card'] },
    { title: 'Flagship', items: ['window', 'window-manager', 'file-viewer', 'pdf-viewer'] },
    { title: 'Motion & FX', items: ['reveal', 'cursor', 'marquee', 'grain', 'glyph-field', 'split-text', 'magnetic'] },
  ];
}
