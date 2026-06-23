import { Component } from '@angular/core';
import { UiText } from 'ui/text';
import { UiThemeProvider } from 'ui/theme';
import { UiCard } from 'ui/card';
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
        <doc-demo lang="css" code="--ui-color-bg / surface / surface-raised / text / text-muted / border
--ui-color-primary / secondary / success / warning / danger
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
        summary="Sets data-theme on <html>. Built-ins: dark (default), light, dramatic. Any string is accepted, so you can register custom themes.">
        <doc-demo lang="ts" code="theme = inject(UiThemeService);
this.theme.set('dramatic');
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
  protected readonly colors = ['bg', 'surface', 'surface-raised', 'text', 'border', 'primary', 'success', 'warning', 'danger'];
}
