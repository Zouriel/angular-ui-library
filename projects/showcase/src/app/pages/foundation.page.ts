import { Component, inject } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiThemeProvider, UiThemeService } from '@zouriel/ui/theme';
import { UiCard } from '@zouriel/ui/card';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiChip, UiAvatar } from '@zouriel/ui/badge';
import { UiInput, UiSwitch, UiCheckbox } from '@zouriel/ui/form';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import { ShowcaseDensity } from '../docs/density';
import { FormsModule } from '@angular/forms';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-foundation',
  imports: [UiText, UiThemeProvider, UiCard, UiButton, UiSegmented, UiChip, UiAvatar, UiInput, UiSwitch, UiCheckbox, HugeiconsIconComponent, FormsModule, DocPage, DocSection, DocDemo],
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
@import '@zouriel/ui/styles/theme-dark-orange.css';  /* darkOrange; loads web fonts */
@import '@zouriel/ui/styles/theme-maldives.css';     /* maldives; loads Poppins */"></doc-demo>
        <doc-demo lang="css" code="Colour roles (per theme)
--ui-color-bg / surface / surface-raised / surface-subtle / surface-hover / elevated-hover
--ui-color-text / text-secondary / text-muted / text-disabled / text-inverse
--ui-color-border-subtle / border / border-strong / border-focus
--ui-color-primary / primary-hover / primary-active / primary-contrast
--ui-color-secondary / secondary-hover / secondary-contrast
--ui-color-accent / accent-subtle / accent-strong / accent-contrast
--ui-color-success / warning / danger / info  (each + -contrast)   --ui-color-danger-hover
--ui-color-selected / track / overlay   --ui-focus-ring   --ui-gradient-hero / gradient-highlight
--ui-color-icon  (optional: icons on neutral surfaces; maldives sets Lagoon)
--ui-shadow-1 / 2 / 3   --ui-glass-bg / glass-blur / glass-border

Component tokens (default to a role)
--ui-control-border   --ui-switch-track / track-checked / thumb / thumb-checked
--ui-slider-thumb / slider-thumb-border   --ui-skeleton-base / skeleton-highlight
--ui-media-bg / media-scrim / media-on-scrim / media-danger   --ui-pdf-page-bg   --ui-scroll-progress-track
--ui-rating-fill"></doc-demo>
        <doc-demo lang="css" code="Fixed scales (same in every theme; darkOrange swaps the fonts)
--ui-size-sm 26px   --ui-size-md 30px   --ui-size-lg 38px   --ui-size-xl 56px   --ui-size-touch 44px
--ui-space-1 4px   -2 8px   -3 12px   -4 16px   -6 24px   -8 32px   -12 48px   -20 80px
--ui-radius 7px   --ui-radius-xs 5px   -sm 8px   -lg 18px   -pill 9999px
--ui-font-size-sm 13px   -md 15px   -lg 18px   -h1 2.5rem   -h2 1.875rem   -h3 1.375rem   -h5 1rem   -h6 0.9rem
--ui-font-scale 1   --ui-density-scale 1   (compact density lowers sizes and scales: see Density)
--ui-tracking-tight -0.02em   -tighter -0.03em
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

      <doc-section name="Density" selector="data-density" [api]="densityApi"
        summary="How big things are drawn (0.45.0). Comfortable, the default, is the library as it always was. Compact makes things smaller, not tighter: body text 14px instead of 15 (small 12, large 16), headings about 10% smaller, controls lower (md 26 and lg 34, 4px less; sm 24, 2px less, so it stays a 24px target with a mouse), icons and the switch, checkbox and radio marks 10% smaller (a 20px icon is drawn at 18). Spacing, corner radii and touch targets do not change: on touch screens every control still has its 44px tap area. Auto is compact below 600px wide and comfortable above, and follows resizes and rotation. Set it once with provideUiConfig({ density }), switch it at runtime with applyUiDensity(), or put data-density on any element for just its subtree. On iPhone and iPad, text typed into fields stays 16px in compact, because Safari zooms the page into any field under 16px; comfortable keeps its 15px. Try it here, or with the Density picker in the top bar.">
        <doc-demo lang="ts" code="import { provideUiConfig, applyUiDensity } from '@zouriel/ui';

providers: [provideUiConfig({ density: 'auto' })]   // compact on phones

applyUiDensity('compact');                 // runtime: sets data-density on &lt;html&gt;
applyUiDensity('comfortable');             // removes it
// or in HTML, for one subtree:  &lt;section data-density=&quot;compact&quot;&gt; … &lt;/section&gt;">
          <div class="density-demo">
            <ui-segmented label="Density" [options]="density.options" [value]="density.density()" (valueChange)="density.set($any($event))" />
            <div class="density-sample">
              <ui-text variant="h3">Find a nurse</ui-text>
              <ui-text variant="body">Body text, inputs, chips and buttons follow the density tokens.</ui-text>
              <ui-input aria-label="Area" placeholder="Search an island" />
              <div class="density-row">
                <ui-chip>Home visit</ui-chip><ui-chip>Today</ui-chip>
                <ui-avatar name="Aisha Rasheed" />
                <hugeicons-icon aria-hidden="true" [icon]="bell" [size]="20" [strokeWidth]="1.8" />
              </div>
              <div class="density-row">
                <ui-switch [ngModel]="true">Notify me</ui-switch><ui-checkbox [ngModel]="true">Remember</ui-checkbox>
              </div>
              <div class="density-row"><ui-button variant="primary">Book</ui-button><ui-button variant="outline">Later</ui-button></div>
            </div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Built-in strings" anchor="built-in-strings" selector="provideUiStrings" [api]="stringsApi"
        summary="The library's own words: the names of icon-only buttons (Close, Dismiss, Clear, Previous page…) and a few default labels (the file upload's Click to upload). English by default; give your app's language once with provideUiStrings, partly or whole, and the rest stay English. Components with their own input for a word (ui-file-upload label and hint, ui-split-button menuLabel) use that first. The words not yet covered are listed in the library README under Built-in strings.">
        <doc-demo lang="ts" code="import { provideUiStrings } from '@zouriel/ui';

providers: [
  provideUiStrings({ close: 'ބަންދުކުރޭ', dismiss: 'ފޮރުވާ', previousPage: 'ކުރީ ޞަފްޙާ', nextPage: 'ދެން ޞަފްޙާ' }),
]"></doc-demo>
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
        summary="Fifteen built-in themes. dark and light are the Winter colour system in tokens.css, also reachable as winterDark and winterLight. The ten accent palettes live in theme-palettes.css and change colours only. darkOrange lives in theme-dark-orange.css and also changes the fonts; maldives, the light sea theme, and maldives-dark, its night variant, live in theme-maldives.css, set Poppins and have their own sea backdrops (see Motion & FX). Each tile below is a ui-theme-provider island; Use sets it for the whole page.">
        <div class="themes">
          @for (t of themes; track t.name) {
            <ui-theme-provider [theme]="t.name" class="ui-surface tile">
              <div class="tile-head">
                <ui-text variant="label" class="tile-name">{{ t.name }}</ui-text>
                <ui-button size="sm" variant="outline" (click)="theme.set(t.name)">Use<span class="sr-only"> {{ t.name }}</span></ui-button>
                <ui-text variant="caption" class="tile-file">{{ t.file }}</ui-text>
              </div>
              <div class="dots" aria-hidden="true">
                @for (c of tileColors; track c) { <span class="dot" [style.background]="'var(--ui-color-' + c + ')'"></span> }
              </div>
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
              <ui-card [glass]="false"><ui-text variant="body">A light-theme card, whatever the page theme.</ui-text></ui-card>
            </ui-theme-provider>
            <ui-theme-provider theme="dark" class="ui-surface">
              <ui-card [glass]="false"><ui-text variant="body">A dark-theme card, whatever the page theme.</ui-text></ui-card>
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
    .tile { display: flex; flex-direction: column; gap: var(--ui-space-3);
      padding: var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    /* Name and Use share the first row; the file name gets the tile's full width below, so it never wraps. */
    .tile-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--ui-space-1) var(--ui-space-3); }
    .tile-name { min-width: 0; }
    .tile-file { grid-column: 1 / -1; white-space: nowrap; }
    .dots { display: flex; gap: var(--ui-space-1); }
    .dot { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--ui-color-border); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .islands { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); }
    .islands .ui-surface { border-radius: var(--ui-radius-lg); }
    @media (max-width: 640px) { .islands { grid-template-columns: 1fr; } }
    .density-demo { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .density-sample { display: flex; flex-direction: column; gap: var(--ui-space-3); max-width: 420px; }
    .density-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-3); }
  `,
})
export class FoundationPage {
  protected readonly theme = inject(UiThemeService);
  protected readonly density = inject(ShowcaseDensity);
  protected readonly bell = Notification01Icon;
  protected readonly colors = ['bg', 'surface', 'surface-raised', 'surface-subtle', 'text', 'text-secondary', 'text-muted', 'border', 'border-strong', 'primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'selected', 'track'];
  protected readonly tileColors = ['surface', 'text', 'primary', 'secondary', 'success', 'warning', 'danger'];
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
    { name: 'maldives', file: 'theme-maldives.css' },
    { name: 'maldives-dark', file: 'theme-maldives.css' },
  ];
  protected readonly THEME_TYPE = `type UiTheme =
  | 'dark' | 'light' | 'winterDark' | 'winterLight' | 'darkOrange'
  | 'lightOrange' | 'lightPink' | 'darkPink' | 'goldBlack' | 'goldRed'
  | 'lightTeal' | 'darkTeal' | 'lightPurple' | 'darkPurple' | 'lightPurpleGold'
  | 'maldives' | 'maldives-dark' | (string & {});`;
  protected readonly stringsApi: ApiRow[] = [
    { name: 'close / dismiss', type: 'string', default: "'Close' / 'Dismiss'", desc: 'Modal, drawer and bottom sheet close; toast, alert and hint dismiss.' },
    { name: 'clear / clearAll / clearSearch', type: 'string', default: "'Clear' / 'Clear all' / 'Clear search'", desc: 'Combobox, multi-select and search input.' },
    { name: 'previousPage / nextPage', type: 'string', default: "'Previous page' / 'Next page'", desc: 'Pagination.' },
    { name: 'previousMonth / nextMonth / chooseDate', type: 'string', default: "'Previous month' / 'Next month' / 'Choose a date'", desc: 'Calendar, date range picker, date picker.' },
    { name: 'moreActions', type: 'string', default: "'More actions'", desc: 'Split button menu.' },
    { name: 'uploadLabel / uploadHint', type: 'string', default: "'Click to upload' / 'or drag & drop'", desc: 'File upload.' },
    { name: 'holdHint / confirmTitle / confirm / cancel', type: 'string', default: "'Press and hold to confirm' / 'Are you sure?' / 'Confirm' / 'Cancel'", desc: 'Hold button and its confirm dialog.' },
    { name: 'zoomIn / zoomOut / placePinAtCentre', type: 'string', default: "'Zoom in' / 'Zoom out' / 'Place the pin at the centre'", desc: 'Map.' },
    { name: 'mapLocate / mapLocationOff / mapYourLocation', type: 'string', default: "'Show my location' / 'Location is off' / 'Your location'", desc: 'Map: the my-location button, its off state, the you-are-here dot.' },
    { name: 'mapOpen', type: 'string', default: "'Open map'", desc: 'Map: the preview map\'s one button (0.43.0).' },
    { name: 'mapSearchArea / mapRadiusMeters / mapRadiusKilometers', type: 'string', default: "'Search area' / '{n} m' / '{n} km'", desc: 'Map: the search area\'s radius handle and the radius in words (0.44.0); {n} is the number.' },
    { name: 'googleSignIn / googleSignUp / googleContinue / googleSignInShort', type: 'string', default: "'Sign in with Google' / 'Sign up with Google' / 'Continue with Google' / 'Sign in'", desc: 'Google button (Google\'s approved wordings only).' },
    { name: 'sidebarToggle / sidebarClose / sidebarLabel', type: 'string', default: "'Toggle navigation' / 'Close navigation' / 'Navigation'", desc: 'Sidebar layout: menu button, the drawer\'s close button, the drawer\'s name.' },
  ];
  protected readonly configApi: ApiRow[] = [
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Default glass surface for card, stat-card, modal, drawer, popover, menu, context menu, command palette, navbar, bottom nav and window.' },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Default rounded corners for components with a radius input.' },
    { name: 'defaultFont', type: 'string', default: "'var(--ui-font-default)'", desc: 'Reserved: accepted, but no component reads it yet. Set --ui-font-default instead.' },
    { name: 'density', type: "'comfortable' | 'compact' | 'auto'", default: "'comfortable'", desc: 'How big things are drawn (0.45.0); compact and auto are written to data-density on the html element. See Density.' },
    { name: 'animations', type: 'boolean', default: 'true', desc: 'Reserved: accepted, but no component reads it yet. Components already slow or stop motion under prefers-reduced-motion.' },
  ];
  protected readonly densityApi: ApiRow[] = [
    { name: 'data-density', type: "'compact' | 'auto'", default: '— (comfortable)', desc: 'On html (or any element, for its subtree). auto is compact below 600px wide.' },
    { name: 'applyUiDensity()', type: 'function', default: '—', desc: "applyUiDensity(density: UiDensity, el = document.documentElement): sets or removes data-density at runtime." },
    { name: 'UI_COMPACT_BELOW', type: 'number', default: '600', desc: 'The width (px) below which auto is compact.' },
    { name: 'compact values', type: 'tokens', default: '—', desc: '--ui-font-size-sm/md/lg 12/14/16px; -h1 2.25rem, -h2 1.6875rem, -h3 1.25rem, -h5 0.9375rem, -h6 0.8125rem; --ui-size-sm/md/lg 24/26/34px; --ui-font-scale 0.93 (text components size in px); --ui-density-scale 0.9 (icons, switch, checkbox and radio marks). --ui-space-*, radii, --ui-size-touch and --ui-size-xl unchanged.' },
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
