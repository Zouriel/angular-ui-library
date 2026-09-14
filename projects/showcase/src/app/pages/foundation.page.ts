import { Component } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiThemeProvider } from '@zouriel/ui/theme';
import { UiCard } from '@zouriel/ui/card';
import { DocPage, DocSection, DocDemo } from '../docs/docs-ui';

@Component({
  selector: 'page-foundation',
  imports: [UiText, UiThemeProvider, UiCard, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Getting started" title="Foundation"
      lead="Design tokens, the config provider, and the theme service. Everything else builds on these.">

      <doc-section name="Design tokens" selector="ui/styles/tokens.css"
        summary="Components reference CSS custom properties only — never hard-coded values. Override them per theme to re-skin the whole library.">
        <div class="swatches">
          @for (c of colors; track c) {
            <div class="sw"><span class="chip" [style.background]="'var(--ui-color-' + c + ')'"></span><ui-text variant="caption">{{ c }}</ui-text></div>
          }
        </div>
        <doc-demo lang="css" code="--ui-winter-*   primitive palette (never read by components)
--ui-color-bg / surface / surface-raised / surface-subtle / surface-hover
--ui-color-text / text-secondary / text-muted / text-disabled / text-inverse
--ui-color-border-subtle / border / border-strong / border-focus
--ui-color-primary / primary-hover / primary-active / primary-contrast / secondary
--ui-color-accent / accent-subtle / accent-strong
--ui-color-success / warning / danger / info  (+ -contrast)
--ui-control-border  --ui-switch-*  --ui-skeleton-*  --ui-media-*   component tokens
--ui-size-sm|md|lg   --ui-space-1..6   --ui-radius
--ui-font-default / mono / display   --ui-motion-* / --ui-ease-*"></doc-demo>
      </doc-section>

      <doc-section name="provideUiConfig()" selector="provideUiConfig"
        summary="Set library-wide defaults once. Components read these and let their own inputs override per-instance.">
        <doc-demo lang="ts" code="export const appConfig = {
  providers: [
    provideUiConfig({ glass: true, radius: true, animations: true }),
  ],
};"></doc-demo>
      </doc-section>

      <doc-section name="Theme service" selector="UiThemeService"
        summary="Sets data-theme on <html>. Built-ins: dark (default) and light, the Winter colour system (also named winterDark / winterLight), the professional accent palettes (lightOrange, lightPink, darkPink, goldBlack, goldRed, lightTeal, darkTeal, lightPurple, darkPurple) and the cinematic darkOrange skin. Any string is accepted, so you can register custom themes.">
        <doc-demo lang="ts" code="theme = inject(UiThemeService);
this.theme.set('darkPink');
this.theme.toggle();   // dark <-> light"></doc-demo>
      </doc-section>

      <doc-section name="Scoped theme" selector="ui-theme-provider"
        summary="Theme just a subtree. Uses display:contents so it adds no layout of its own.">
        <doc-demo code="<ui-theme-provider theme=&quot;light&quot;> … </ui-theme-provider>">
          <ui-theme-provider theme="light">
            <ui-card><ui-text variant="body">This card is a light-theme island regardless of the page theme.</ui-text></ui-card>
          </ui-theme-provider>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: var(--ui-space-3); margin-bottom: var(--ui-space-3); }
    .sw { display: flex; flex-direction: column; gap: 4px; align-items: center; }
    .chip { width: 100%; height: 40px; border-radius: 8px; border: 1px solid var(--ui-color-border); }
  `,
})
export class FoundationPage {
  protected readonly colors = ['bg', 'surface', 'surface-raised', 'surface-subtle', 'text', 'text-secondary', 'text-muted', 'border', 'border-strong', 'primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info'];
}
