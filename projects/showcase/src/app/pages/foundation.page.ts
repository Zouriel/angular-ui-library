import { Component, inject } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiThemeProvider, UiThemeService } from '@zouriel/ui/theme';
import { UiCard } from '@zouriel/ui/card';
import { UiButton } from '@zouriel/ui/button';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-foundation',
  imports: [UiText, UiThemeProvider, UiCard, UiButton, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Getting started" title="Foundation"
      lead="Design tokens, the config provider, and the theme service. Everything else builds on these.">

      <doc-section name="Design tokens" selector="@zouriel/ui/styles/tokens.css"
        summary="Components read CSS custom properties, not hard-coded values, so overriding the tokens re-skins the whole library. Load tokens.css once at the app root. Colour comes in three layers: --ui-winter-* primitives (never read by components), semantic --ui-color-* roles that every theme sets, and component tokens that default to a semantic role. The swatches below show the current theme.">
        <div class="swatches">
          @for (c of colors; track c) {
            <div class="sw"><span class="chip" [style.background]="'var(--ui-color-' + c + ')'"></span><ui-text variant="caption">{{ c }}</ui-text></div>
          }
        </div>
        <doc-demo lang="css" code="/* styles.css (or angular.json &quot;styles&quot;) */
@import '@zouriel/ui/styles/tokens.css';
@import '@zouriel/ui/styles/theme-palettes.css';     /* the accent palettes */
@import '@zouriel/ui/styles/theme-dark-orange.css';  /* darkOrange; loads web fonts */"></doc-demo>
        <doc-demo lang="css" code="Colour roles (per theme)
--ui-color-bg / surface / surface-raised / surface-subtle / surface-hover / elevated-hover
--ui-color-text / text-secondary / text-muted / text-disabled / text-inverse
--ui-color-border-subtle / border / border-strong / border-focus
--ui-color-primary / primary-hover / primary-active / primary-contrast
--ui-color-secondary / secondary-hover / secondary-contrast
--ui-color-accent / accent-subtle / accent-strong / accent-contrast
--ui-color-success / warning / danger / info  (each + -contrast)   --ui-color-danger-hover
--ui-color-selected / track / overlay   --ui-focus-ring   --ui-gradient-hero / gradient-highlight
--ui-shadow-1 / 2 / 3   --ui-glass-bg / glass-blur / glass-border

Component tokens (default to a role)
--ui-control-border   --ui-switch-track / track-checked / thumb / thumb-checked
--ui-slider-thumb / slider-thumb-border   --ui-skeleton-base / skeleton-highlight
--ui-media-bg / media-scrim / media-on-scrim / media-danger   --ui-pdf-page-bg   --ui-scroll-progress-track"></doc-demo>
        <doc-demo lang="css" code="Fixed scales (same in every theme; darkOrange swaps the fonts)
--ui-size-sm 26px   --ui-size-md 30px   --ui-size-lg 38px   --ui-size-touch 44px
--ui-space-1 4px   -2 8px   -3 12px   -4 16px   -6 24px   -8 32px   -12 48px   -20 80px
--ui-radius 7px   --ui-radius-xs 5px   -sm 8px   -lg 18px   -pill 9999px
--ui-font-size-sm 13px   -md 15px   -lg 18px   --ui-tracking-tight -0.02em   -tighter -0.03em
--ui-font-default (system-ui stack)   --ui-font-mono (ui-monospace stack)   --ui-font-display (= default)
--ui-motion-fast 120ms   -base 200ms   -slow 320ms   --ui-scale-press 0.96
--ui-ease-standard / decelerate / accelerate / spring
--ui-z-base 0   -docked 10   -overlay 1000   -window 1100   -toast 1200"></doc-demo>
      </doc-section>

      <doc-section name="provideUiConfig()" selector="provideUiConfig" [api]="configApi"
        summary="Set library-wide defaults once. Components that support a key read it as their input's default, and their own input still wins per instance. Unset keys keep their defaults.">
        <doc-demo lang="ts" code="import { provideUiConfig } from '@zouriel/ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideUiConfig({ glass: true, radius: false }),
  ],
};"></doc-demo>
      </doc-section>

      <doc-section name="Theme service" selector="UiThemeService" [api]="themeApi"
        summary="Sets data-theme on the html element; read the current theme from the theme signal. The default is dark. Any string is accepted, so you can add your own themes in CSS under [data-theme=&quot;name&quot;]. toggle() flips dark and light, or winterDark and winterLight if the app uses those names; from any other theme it goes to dark. The service does not remember the choice between visits; store it yourself if you need to."
        [shapes]="THEME_TYPE">
        <doc-demo lang="ts" code="import { UiThemeService } from '@zouriel/ui/theme';

theme = inject(UiThemeService);
this.theme.set('darkPink');
this.theme.toggle();   // dark <-> light
this.theme.theme();    // current theme (signal)"></doc-demo>
      </doc-section>

      <doc-section name="Themes" selector="data-theme"
        summary="Thirteen built-in themes. dark and light are the Winter colour system in tokens.css, also reachable as winterDark and winterLight. The ten accent palettes live in theme-palettes.css and change colours only. darkOrange lives in theme-dark-orange.css and also changes the fonts. Each tile below is a ui-theme-provider island; Use sets it for the whole page.">
        <div class="themes">
          @for (t of themes; track t.name) {
            <ui-theme-provider [theme]="t.name" class="ui-surface tile">
              <div class="tile-head">
                <ui-text variant="label">{{ t.name }}</ui-text>
                <ui-text variant="caption">{{ t.file }}</ui-text>
              </div>
              <div class="dots" aria-hidden="true">
                @for (c of tileColors; track c) { <span class="dot" [style.background]="'var(--ui-color-' + c + ')'"></span> }
              </div>
              <ui-button size="sm" variant="outline" (click)="theme.set(t.name)">Use<span class="sr-only"> {{ t.name }}</span></ui-button>
            </ui-theme-provider>
          }
        </div>
      </doc-section>

      <doc-section name="Scoped theme" selector="ui-theme-provider" [api]="providerApi"
        summary="Theme just a subtree. It sets data-theme on its own element, and the tokens cascade to everything inside. It uses display:contents, so it adds no layout of its own; add class=ui-surface to make it a block painted with its theme's background and text colour.">
        <doc-demo code="<ui-theme-provider theme=&quot;light&quot;> … </ui-theme-provider>
<ui-theme-provider theme=&quot;dark&quot; class=&quot;ui-surface&quot;> … </ui-theme-provider>">
          <div class="islands">
            <ui-theme-provider theme="light">
              <ui-card><ui-text variant="body">A light-theme card, whatever the page theme.</ui-text></ui-card>
            </ui-theme-provider>
            <ui-theme-provider theme="dark">
              <ui-card><ui-text variant="body">A dark-theme card, whatever the page theme.</ui-text></ui-card>
            </ui-theme-provider>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: var(--ui-space-3); margin-bottom: var(--ui-space-3); }
    .sw { display: flex; flex-direction: column; gap: var(--ui-space-1); align-items: center; text-align: center; }
    .chip { width: 100%; height: 40px; border-radius: var(--ui-radius-sm); border: 1px solid var(--ui-color-border); }
    .themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--ui-space-3); }
    .tile { display: flex; flex-direction: column; gap: var(--ui-space-2); align-items: flex-start;
      padding: var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .tile-head { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .dots { display: flex; gap: var(--ui-space-1); }
    .dot { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--ui-color-border); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .islands { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); }
    @media (max-width: 640px) { .islands { grid-template-columns: 1fr; } }
  `,
})
export class FoundationPage {
  protected readonly theme = inject(UiThemeService);
  protected readonly colors = ['bg', 'surface', 'surface-raised', 'surface-subtle', 'text', 'text-secondary', 'text-muted', 'border', 'border-strong', 'primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'selected', 'track'];
  protected readonly tileColors = ['surface', 'primary', 'secondary', 'accent', 'success', 'warning', 'danger'];
  protected readonly themes = [
    { name: 'dark', file: 'tokens.css (default)' },
    { name: 'light', file: 'tokens.css' },
    { name: 'darkOrange', file: 'theme-dark-orange.css' },
    { name: 'lightOrange', file: 'theme-palettes.css' },
    { name: 'lightPink', file: 'theme-palettes.css' },
    { name: 'darkPink', file: 'theme-palettes.css' },
    { name: 'goldBlack', file: 'theme-palettes.css' },
    { name: 'goldRed', file: 'theme-palettes.css' },
    { name: 'lightTeal', file: 'theme-palettes.css' },
    { name: 'darkTeal', file: 'theme-palettes.css' },
    { name: 'lightPurple', file: 'theme-palettes.css' },
    { name: 'darkPurple', file: 'theme-palettes.css' },
    { name: 'lightPurpleGold', file: 'theme-palettes.css' },
  ];
  protected readonly THEME_TYPE = `type UiTheme =
  | 'dark' | 'light' | 'winterDark' | 'winterLight' | 'darkOrange'
  | 'lightOrange' | 'lightPink' | 'darkPink' | 'goldBlack' | 'goldRed'
  | 'lightTeal' | 'darkTeal' | 'lightPurple' | 'darkPurple' | 'lightPurpleGold'
  | (string & {});`;
  protected readonly configApi: ApiRow[] = [
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Default glass surface for card, stat-card, modal, drawer, popover, menu, context menu, command palette, navbar, bottom nav and window.' },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Default rounded corners for components with a radius input.' },
    { name: 'defaultFont', type: 'string', default: "'var(--ui-font-default)'", desc: 'Reserved: accepted, but no component reads it yet. Set --ui-font-default instead.' },
    { name: 'animations', type: 'boolean', default: 'true', desc: 'Reserved: accepted, but no component reads it yet. Components already slow or stop motion under prefers-reduced-motion.' },
  ];
  protected readonly themeApi: ApiRow[] = [
    { name: 'theme', type: 'WritableSignal<UiTheme>', default: "'dark'", desc: 'Current theme; written to data-theme on the html element.' },
    { name: 'set()', type: 'method', default: '—', desc: 'set(theme: UiTheme): switch the global theme.' },
    { name: 'toggle()', type: 'method', default: '—', desc: 'Flip between the light and dark Winter themes.' },
  ];
  protected readonly providerApi: ApiRow[] = [
    { name: 'theme', type: 'UiTheme', default: "'dark'", desc: 'Two-way (`[(theme)]`). Theme for this subtree.' },
    { name: 'class="ui-surface"', type: 'class', default: '—', desc: "Render as a block painted in the theme's background and text colour." },
  ];
}
