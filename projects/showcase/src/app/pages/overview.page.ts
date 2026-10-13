import { Component } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiCard } from '@zouriel/ui/card';
import { UiBadge } from '@zouriel/ui/badge';
import { DocPage, DocSection, DocDemo } from '../docs/docs-ui';

@Component({
  selector: 'page-overview',
  imports: [UiText, UiCard, UiBadge, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Introduction" title="UI Library"
      lead="A token-driven, signal-first Angular v22 component library: standalone, zoneless, tree-shakeable across secondary entry points, and themeable, with 13 themes that all pass WCAG AA contrast.">

      <doc-section name="Install" anchor="install"
        summary="Components live in secondary entry points so you import only what you use. The package is on GitHub Packages: point the @zouriel scope there, install it with its peers, then load the token stylesheet.">
        <doc-demo lang="bash" code="echo &quot;@zouriel:registry=https://npm.pkg.github.com&quot; >> .npmrc
npm i @zouriel/ui @angular/cdk @angular/aria @hugeicons/angular @hugeicons/core-free-icons
npm i pdfjs-dist   # only for the PDF viewer"></doc-demo>
        <ui-text variant="body">Then load the tokens once (e.g. in <code>angular.json</code> styles or your global stylesheet):</ui-text>
        <doc-demo lang="css" code="@import '@zouriel/ui/styles/tokens.css';
@import '@zouriel/ui/styles/animations.css';
/* optional: the colour palettes + their signature motion */
@import '@zouriel/ui/styles/theme-palettes.css';
@import '@zouriel/ui/styles/theme-animations.css';
/* optional: the cinematic Dark Orange skin + FX utilities */
@import '@zouriel/ui/styles/theme-dark-orange.css';
@import '@zouriel/ui/styles/fx.css';"></doc-demo>
      </doc-section>

      <doc-section name="Usage" anchor="usage"
        summary="Every component is standalone: import it directly. No NgModules.">
        <doc-demo lang="ts" code="import { UiButton } from '@zouriel/ui/button';

@Component({
  imports: [UiButton],
  template: '<ui-button variant=&quot;primary&quot;>Go</ui-button>',
})
export class Demo {}"></doc-demo>
      </doc-section>

      <doc-section name="Theming" anchor="theming"
        summary="Components only read CSS custom-property tokens, so a theme is just a set of token overrides. Switch with UiThemeService.set('dark' | 'light' | 'lightOrange' | 'darkPink' | 'goldBlack' | 'darkOrange' | …); use the picker in the top bar to preview all 13. Every theme’s text and status colours meet WCAG AA, checked by a test.">
        <doc-demo lang="ts" code="theme = inject(UiThemeService);
this.theme.set('goldBlack');  // professional gold-on-black palette
this.theme.set('darkOrange'); // cinematic ink/ember skin (web fonts + FX)
this.theme.toggle();          // dark <-> light"></doc-demo>
      </doc-section>

      <doc-section name="What's inside" anchor="catalog"
        summary="About 140 components and directives across 34 entry points: the everyday catalog, design tools, three flagships (window system, file viewer, form builder) and a motion/FX layer.">
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
    { title: 'Buttons & actions', items: ['button', 'icon-button', 'button-group', 'segmented', 'toggle', 'split', 'dropdown', 'fab'] },
    { title: 'Forms', items: ['input', 'select', 'combobox', 'multi-select', 'checkbox', 'switch', 'radio', 'slider', 'date-picker', 'date-range', 'time', 'rating', 'otp', 'chip-input', 'color', 'file-upload', 'choice-grid', '+more'] },
    { title: 'Overlays', items: ['tooltip', 'popover', 'menu', 'context-menu', 'modal', 'drawer', 'bottom-sheet', 'confirm', 'toast', 'command-palette'] },
    { title: 'Feedback', items: ['alert', 'spinner', 'skeleton', 'progress', 'meter', 'empty-state', 'result', 'loading-overlay'] },
    { title: 'Navigation', items: ['navbar', 'tabs', 'side-nav', 'bottom-nav', 'breadcrumbs', 'pagination', 'stepper', 'menubar', 'anchor-nav'] },
    { title: 'Data', items: ['table', 'list', 'tree', 'tree-table', 'accordion', 'timeline', 'card', 'stat-card', 'code-block'] },
    { title: 'Layout', items: ['grid', 'stack', 'container', 'splitter', 'sidebar-layout', 'panel-section', 'scroll-area', 'aspect-ratio'] },
    { title: 'Media', items: ['carousel', 'gallery', 'image-picker', 'device-frame'] },
    { title: 'Design tools', items: ['transform-box', 'snap-guides', 'path-editor', 'sequencer', 'scrubber', 'token-input', 'resize-handle'] },
    { title: 'Flagship', items: ['window', 'window-manager', 'file-viewer', 'pdf-viewer', 'form-builder', 'form-renderer', 'form-global-settings'] },
    { title: 'Motion & FX', items: ['reveal', 'cursor', 'marquee', 'grain', 'glyph-field', 'split-text', 'magnetic', 'swipe', 'virtual-list'] },
  ];
}
