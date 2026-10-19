import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UI_ANIM } from '@zouriel/ui';
import { UiText } from '@zouriel/ui/text';
import { UiCard } from '@zouriel/ui/card';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-overview',
  imports: [RouterLink, UiText, UiCard, UiBadge, UiButton, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Introduction" title="UI Library"
      lead="A token-driven, signal-first Angular 22 component library: standalone, zoneless, tree-shakeable across 34 secondary entry points, and themeable, with 14 themes whose text and status colours pass WCAG AA.">

      <doc-section name="Install" anchor="install"
        summary="The package is on GitHub Packages: point the @zouriel scope there, then install it with its peers. Peers: @angular/core, @angular/common, @angular/forms and @angular/cdk ^22, @hugeicons/angular ^1.0.11 and @hugeicons/core-free-icons ^4.3.0. pdfjs-dist ^4.10.38 is optional and only needed to show PDFs.">
        <doc-demo lang="bash" code="echo &quot;@zouriel:registry=https://npm.pkg.github.com&quot; >> .npmrc
npm i @zouriel/ui @angular/cdk @hugeicons/angular @hugeicons/core-free-icons
npm i pdfjs-dist   # only for ui-pdf-viewer, or PDFs in ui-file-viewer"></doc-demo>
      </doc-section>

      <doc-section name="Stylesheets" anchor="styles"
        summary="Load the styles once, in angular.json styles or your global stylesheet. tokens.css is required: without it components have no colours, sizes or spacing. animations.css holds the enter/leave animations that modals, drawers, popovers and the command palette use. The rest are optional.">
        <doc-demo lang="css" code="@import '@zouriel/ui/styles/tokens.css';            /* required: tokens + Winter dark/light */
@import '@zouriel/ui/styles/animations.css';        /* enter/leave animations */
@import '@zouriel/ui/styles/theme-palettes.css';    /* optional: the ten colour palettes */
@import '@zouriel/ui/styles/theme-dark-orange.css'; /* optional: Dark Orange (loads Google Fonts) */
@import '@zouriel/ui/styles/fx.css';                /* optional: .ui-glow, .ui-gradient-text, .ui-underline */
@import '@zouriel/ui/styles/theme-animations.css';  /* optional: palette motion on those FX classes */
@import '@zouriel/ui/styles/color-aliases.css';     /* optional: --color-* aliases for your own CSS */"></doc-demo>
      </doc-section>

      <doc-section name="Usage" anchor="usage"
        summary="Every component is standalone: import it from its entry point and add it to imports. There are no NgModules. Form controls implement ControlValueAccessor, so they work with template-driven, reactive and Signal Forms.">
        <doc-demo lang="ts" code="import { Component } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';

@Component({
  selector: 'app-demo',
  imports: [UiButton],
  template: '<ui-button variant=&quot;primary&quot;>Go</ui-button>',
})
export class Demo {}"></doc-demo>
      </doc-section>

      <doc-section name="Library defaults" anchor="config" selector="provideUiConfig()" apiTitle="UiConfig"
        summary="Call provideUiConfig() once in the application providers to change library-wide defaults; keys you leave out keep their default, and a component's own input always wins. It returns environment providers, so it belongs in app.config.ts, not in a component's providers. Your own components can read the resolved config with injectUiConfig() or inject(UI_CONFIG); defaultUiConfig holds the defaults."
        [api]="configApi" [shapes]="configShape">
        <doc-demo lang="ts" code="import { ApplicationConfig } from '@angular/core';
import { injectUiConfig, provideUiConfig } from '@zouriel/ui';

export const appConfig: ApplicationConfig = {
  providers: [provideUiConfig({ glass: true, radius: true, animations: true })],
};

// In your own component:
private readonly ui = injectUiConfig(); // { glass, radius, defaultFont, animations }"></doc-demo>
      </doc-section>

      <doc-section name="Shared types" anchor="types"
        summary="Two types from @zouriel/ui that many components use. UiSize is the fixed size scale; components do not take arbitrary sizes. UiStatus is the tone scale of badges, chips, progress and similar."
        [shapes]="typesShape">
      </doc-section>

      <doc-section name="Animations" anchor="animations" selector="UI_ANIM"
        summary="The class names of the shared enter/leave animations in animations.css, for Angular's animate.enter and animate.leave bindings. Durations and easings come from the --ui-motion-* and --ui-ease-* tokens. Under prefers-reduced-motion the moving variants become a plain fade, and provideUiConfig({ animations: false }) turns them all off."
        [shapes]="animShape">
        <doc-demo lang="ts" code="import { UI_ANIM } from '@zouriel/ui';

protected readonly anim = UI_ANIM;
// template:
@if (shown()) {
  <div [animate.enter]=&quot;anim.scale.enter&quot; [animate.leave]=&quot;anim.scale.leave&quot;>…</div>
}">
          <div class="anim-row">
            <ui-button variant="outline" (click)="shown.set(!shown())">{{ shown() ? 'Hide' : 'Show' }}</ui-button>
            <div class="anim-stage">
              @if (shown()) {
                <ui-card padding="sm" [animate.enter]="anim.scale.enter" [animate.leave]="anim.scale.leave">
                  <ui-text variant="body">Scales in and out.</ui-text>
                </ui-card>
              }
            </div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Theming" anchor="theming"
        summary="Components only read CSS custom-property tokens, so a theme is a set of token overrides keyed on data-theme. UiThemeService (from @zouriel/ui/theme) sets data-theme on <html>; ui-theme-provider scopes a theme to part of the page. Use the picker in the top bar to preview all 14. A custom theme is a [data-theme] block that sets the core --ui-color-* tokens; the rest are derived from them.">
        <doc-demo lang="ts" code="theme = inject(UiThemeService);
this.theme.set('goldBlack');  // needs theme-palettes.css
this.theme.set('darkOrange'); // needs theme-dark-orange.css
this.theme.set('maldives');   // needs theme-maldives.css
this.theme.toggle();          // dark -> light; any other theme -> dark
this.theme.theme();           // the current theme (a signal)"></doc-demo>
        <div class="themes">
          @for (f of themeFamilies; track f.title) {
            <div class="family">
              <ui-text variant="label">{{ f.title }}</ui-text>
              <ui-text variant="caption">{{ f.file }}</ui-text>
              <div class="tags">@for (t of f.themes; track t) { <ui-badge>{{ t }}</ui-badge> }</div>
            </div>
          }
        </div>
      </doc-section>

      <doc-section name="What's inside" anchor="catalog"
        summary="About 140 components and directives across 34 entry points, grouped as in the sidebar. Each card names the entry points to import from and links to its page.">
        <div class="grid">
          @for (g of groups; track g.route) {
            <ui-card padding="sm">
              <a card-header class="group-link" [routerLink]="'/' + g.route">{{ g.title }}</a>
              <ui-text variant="caption" class="entries">{{ g.entries }}</ui-text>
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
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--ui-space-3); }
    .tags { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); }
    .entries { display: block; margin-bottom: var(--ui-space-2); font-family: var(--ui-font-mono); }
    /* 24px tall target; the negative margin keeps the card header the height it was. */
    .group-link { display: inline-flex; align-items: center; min-height: 24px; margin-block: -3px; font-weight: 600; font-size: var(--ui-font-size-sm); color: var(--ui-color-text); text-decoration: none; }
    .group-link:hover { color: var(--ui-color-primary); text-decoration: underline; }
    .group-link:focus-visible { outline: none; border-radius: var(--ui-radius-xs); box-shadow: var(--ui-focus-ring); }
    .themes { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--ui-space-3); }
    .family { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .anim-row { display: flex; align-items: center; gap: var(--ui-space-4); flex-wrap: wrap; }
    .anim-stage { min-height: 56px; display: flex; align-items: center; }
  `,
})
export class OverviewPage {
  protected readonly anim = UI_ANIM;
  protected readonly shown = signal(true);

  protected readonly configApi: ApiRow[] = [
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Default for the glass input of card, stat card, modal, drawer, popover, menu, context menu, command palette, navbar, bottom nav and window.' },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Default for the radius input (rounded corners) of the components that have one.' },
    { name: 'animations', type: 'boolean', default: 'true', desc: 'false adds the ui-no-anim class to <html>, which turns off every library animation and transition.' },
    { name: 'defaultFont', type: 'string', default: "'var(--ui-font-default)'", desc: 'A font-family list. When given, it is written to the --ui-font-default token on <html>, so every component uses it.' },
    { name: 'provideUiConfig(config)', type: '(Partial<UiConfig>) => EnvironmentProviders', default: '—', desc: 'Provides UI_CONFIG with the given keys merged over defaultUiConfig.' },
    { name: 'UI_CONFIG', type: 'InjectionToken<UiConfig>', default: 'defaultUiConfig', desc: 'The resolved config. Provided in root, so it works without provideUiConfig().' },
    { name: 'injectUiConfig()', type: '() => UiConfig', default: '—', desc: 'Reads UI_CONFIG, falling back to defaultUiConfig. Call it in an injection context.' },
    { name: 'defaultUiConfig', type: 'UiConfig', default: '—', desc: 'The defaults listed above.' },
  ];

  protected readonly configShape = `interface UiConfig {
  glass: boolean;
  radius: boolean;
  defaultFont: string;
  animations: boolean;
}`;

  protected readonly typesShape = `type UiSize = 'sm' | 'md' | 'lg';
type UiStatus = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';`;

  protected readonly animShape = `const UI_ANIM = {
  fade:       { enter: 'ui-fade-enter',        leave: 'ui-fade-leave' },
  scale:      { enter: 'ui-scale-enter',       leave: 'ui-scale-leave' },
  slideUp:    { enter: 'ui-slide-up-enter',    leave: 'ui-slide-up-leave' },
  slideDown:  { enter: 'ui-slide-down-enter',  leave: 'ui-slide-down-leave' },
  slideLeft:  { enter: 'ui-slide-left-enter',  leave: 'ui-slide-left-leave' },
  slideRight: { enter: 'ui-slide-right-enter', leave: 'ui-slide-right-leave' },
  sheet:      { enter: 'ui-sheet-enter',       leave: 'ui-sheet-leave' },
  backdrop:   { enter: 'ui-backdrop-enter',    leave: 'ui-backdrop-leave' },
  window:     { enter: 'ui-window-open-enter', leave: 'ui-window-close-leave', dock: 'ui-window-dock' },
} as const;`;

  protected readonly themeFamilies = [
    { title: 'Winter (default)', file: 'tokens.css', themes: ['dark', 'light', 'winterDark', 'winterLight'] },
    { title: 'Colour palettes', file: 'theme-palettes.css', themes: ['lightOrange', 'lightPink', 'lightTeal', 'lightPurple', 'lightPurpleGold', 'darkPink', 'darkTeal', 'darkPurple', 'goldBlack', 'goldRed'] },
    { title: 'Cinematic', file: 'theme-dark-orange.css', themes: ['darkOrange'] },
    { title: 'Sea', file: 'theme-maldives.css', themes: ['maldives'] },
  ];

  protected readonly groups = [
    { title: 'Foundation', route: 'foundation', entries: '@zouriel/ui, /theme', items: ['provideUiConfig', 'UiThemeService', 'theme-provider', 'UI_ANIM'] },
    { title: 'Typography', route: 'typography', entries: '/text, /link', items: ['text', 'link', 'kbd', 'inline-code', 'blockquote'] },
    { title: 'Layout & grid', route: 'layout', entries: '/layout, /divider', items: ['grid', 'stack', 'container', 'spacer', 'splitter', 'sidebar-layout', 'panel-section', 'scroll-area', 'aspect-ratio', 'divider'] },
    { title: 'Buttons & actions', route: 'buttons', entries: '/button', items: ['button', 'icon-button', 'button-group', 'segmented', 'toggle-button', 'split-button', 'dropdown-button', 'fab'] },
    { title: 'Form controls', route: 'forms', entries: '/form, /combobox, /datepicker', items: ['input', 'textarea', 'number-input', 'password-input', 'search-input', 'select', 'combobox', 'multi-select', 'checkbox', 'checkbox-group', 'radio-group', 'switch', 'slider', 'rating', 'otp-input', 'chip-input', 'color-picker', 'file-upload', 'choice-grid', 'anchor-picker', 'editable-text', 'time-picker', 'date-picker', 'date-range-picker', 'calendar', 'form-field', 'uiNumberLabel'] },
    { title: 'Overlays & dialogs', route: 'overlays', entries: '/overlay, /dialog, /command-palette', items: ['uiTooltip', 'popover', 'menu', 'uiContextMenu', 'backdrop', 'uiClickOutside', 'modal', 'drawer', 'bottom-sheet', 'confirm-dialog', 'toast-host', 'UiToastService', 'command-palette'] },
    { title: 'Feedback & status', route: 'feedback', entries: '/alert, /progress, /spinner, /skeleton, /feedback', items: ['alert', 'progress-bar', 'meter', 'spinner', 'skeleton', 'empty-state', 'result', 'loading-overlay'] },
    { title: 'Navigation', route: 'navigation', entries: '/navigation, /tabs', items: ['navbar', 'side-nav', 'bottom-nav', 'menubar', 'breadcrumbs', 'pagination', 'stepper', 'anchor-nav', 'tabs'] },
    { title: 'Data display', route: 'data', entries: '/table, /list, /data, /accordion, /card, /badge', items: ['table', 'list', 'tree', 'tree-table', 'timeline', 'description-list', 'code-block', 'accordion', 'card', 'stat-card', 'badge', 'chip', 'avatar', 'avatar-group'] },
    { title: 'Media', route: 'media', entries: '/media', items: ['carousel', 'gallery', 'image-picker'] },
    { title: 'Window system', route: 'window', entries: '/window', items: ['window', 'UiWindowManager', 'uiDraggable', 'uiResizable'] },
    { title: 'File viewer', route: 'file-viewer', entries: '/file-viewer, /pdf-viewer', items: ['file-viewer', 'image-viewer', 'video-player', 'audio-player', 'text-viewer', 'code-viewer', 'media-lightbox', 'file-explorer', 'pdf-viewer'] },
    { title: 'Design tools', route: 'design-tools', entries: '/canvas, /sequencer, /form, /media, /layout', items: ['transform-box', 'snap-guides', 'path-editor', 'sequencer', 'scrubber', 'token-input', 'device-frame', 'resize-handle'] },
    { title: 'Form builder', route: 'form-builder', entries: '/form-builder', items: ['form-builder', 'form-renderer', 'form-global-settings'] },
    { title: 'Motion & FX', route: 'fx', entries: '/fx', items: ['uiReveal', 'cursor', 'marquee', 'drift-row', 'grain', 'glyph-field', 'uiSplitText', 'uiMagnetic', 'intro-loader', 'scroll-progress', 'section-label'] },
    { title: 'Behavior directives', route: 'behaviors', entries: '/behaviors', items: ['uiSwipe', 'uiIntersect', 'uiInfiniteScroll', 'uiScrollFade', 'virtual-list', 'uiCopyToClipboard', 'uiRipple', 'uiResizeObserver'] },
  ];
}
