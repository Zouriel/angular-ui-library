# @zouriel/ui — Angular component library

A token-driven, signal-first **Angular v22** component library. Standalone, zoneless,
tree-shakeable across secondary entry points, themeable, and accessible (ARIA roles,
keyboard support, CDK focus handling). About 140 components and directives across
34 secondary entry points, plus a small core (`@zouriel/ui`):
- the everyday catalog;
- design tools;
- three flagships: a floating-window system, a multi-format file viewer and a form builder;
- a motion and FX layer.

> Built as an Angular workspace: the library lives in `projects/ui`, and a routed
> **documentation site** (live examples + API tables) lives in `projects/showcase`,
> deployed at <https://zouriel.com/uilib/>.

## Highlights

- **Tokens-only styling**: every component reads CSS custom properties, so a theme is a
  set of token overrides. Ships **14 themes**:
  - **Winter**: Dark and Light, the defaults;
  - **colour palettes** (10): Light Orange; Light and Dark Pink, Teal and Purple; Gold Black, Gold Red and Light Purple Gold;
  - **Dark Orange**: a cinematic theme with web fonts and FX;
  - **Maldives**: a calm, light sea theme (Poppins) with its own sea backdrops.

  All text and status colours meet WCAG AA in every theme. Switch at runtime with
  `UiThemeService.set('goldBlack')`.
- **Secondary entry points**: import only what you use (`@zouriel/ui/button`,
  `@zouriel/ui/form`, `@zouriel/ui/overlay`, `@zouriel/ui/form-builder`, …).
- **Signals + modern APIs**: `input()` / `output()` / `model()`, control flow, no NgModules.
- **CVA form controls**: work with template-driven, reactive, and Signal Forms.
- **Consistent by test**: a style-contract spec and a browser audit (below) keep spacing,
  sizes, type, colour and contrast consistent across components and themes.
- **Flagships**:
  - **Window system**: `ui-window` + `UiWindowManager`, with drag, snap, resize and dock.
  - **File viewer**: `ui-file-viewer` for image, video, audio, text, code, **lazy PDF** and a file explorer.
  - **Form builder**: `ui-form-builder` + `ui-form-renderer`. Admins make forms by drag and drop, with:
    - rules between questions, sections and pages;
    - repeating sections, steps and calculations;
    - built-in and app checks with custom messages;
    - **option sources** (searchable, paginated lists from your API);
    - `ui-form-global-settings` for app-wide lists and new-form defaults.

    JSON in, JSON out; see [`projects/ui/form-builder/README.md`](projects/ui/form-builder/README.md).
  - **Workflow builder**: `ui-workflow-builder` for automations (a trigger and a tree of steps:
    approvals, waits, branches, parallel paths, loops, messages, record updates, your actions) and
    lifecycles (states and transitions that own a status field), plus the components that run them:
    `ui-workflow-panel` (a record's workflow: vertical, horizontal, compact or a drawer),
    `ui-workflow-tasks-drawer`, `ui-workflow-audit`,
    `ui-workflow-permissions` and `ui-workflow-global-settings`.
    Runs on the Zouriel Workflows engine (.NET first); see [`projects/ui/workflow/README.md`](projects/ui/workflow/README.md).
- **Design tools**: transform box with snapping, vector path editor (pen, points, brushes),
  timeline sequencer, scrubber, token input, device frame.
- **Motion/FX**: scroll reveal, custom cursor, marquee, film grain, glyph-field background,
  split text, magnetic, intro loader. Reduced motion calms these rather than removing them.

## Quick start

The package is published to GitHub Packages, so point the scope there once:

```bash
echo "@zouriel:registry=https://npm.pkg.github.com" >> .npmrc
npm i @zouriel/ui @angular/cdk @hugeicons/angular @hugeicons/core-free-icons
npm i pdfjs-dist        # only if you use the PDF viewer (ui-pdf-viewer, or PDFs in ui-file-viewer)
```

Peer dependencies: `@angular/core`, `@angular/common`, `@angular/forms` and `@angular/cdk` ^22,
`@hugeicons/angular` ^1.0.11, `@hugeicons/core-free-icons` ^4.3.0, and optionally `pdfjs-dist` ^4.10.38.

Load the global styles once (e.g. in `angular.json` styles or your global stylesheet):

```css
@import '@zouriel/ui/styles/tokens.css';
@import '@zouriel/ui/styles/animations.css';
/* optional: the ten colour palettes */
@import '@zouriel/ui/styles/theme-palettes.css';
/* optional: the cinematic Dark Orange skin (loads Google Fonts) */
@import '@zouriel/ui/styles/theme-dark-orange.css';
/* optional: the light Maldives sea skin (loads Poppins) */
@import '@zouriel/ui/styles/theme-maldives.css';
/* optional: FX utility classes (.ui-glow, .ui-gradient-text, .ui-underline)
   and the palettes' signature motion on them */
@import '@zouriel/ui/styles/fx.css';
@import '@zouriel/ui/styles/theme-animations.css';
/* optional: --color-* aliases for the --ui-color-* tokens, for your own app code */
@import '@zouriel/ui/styles/color-aliases.css';
```

Without `tokens.css` the components have no colours, spacing or sizes, so it is not optional.

Use any component; they're standalone:

```ts
import { Component } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';

@Component({
  selector: 'app-demo',
  imports: [UiButton],
  template: `<ui-button variant="primary">Go</ui-button>`,
})
export class Demo {}
```

Optional: set library-wide defaults in the application providers.

```ts
import { provideUiConfig } from '@zouriel/ui';

export const appConfig = {
  providers: [provideUiConfig({ glass: true, radius: true, animations: true })],
};
```

| Key | Default | Effect |
| --- | --- | --- |
| `glass` | `false` | Default glass surface for components with a `glass` input (card, modal, drawer, popover, menu, window, …). |
| `radius` | `true` | Default rounded corners for components with a `radius` input. |
| `animations` | `true` | `false` adds `.ui-no-anim` to `<html>`, which turns every library animation and transition off. |
| `defaultFont` | `'var(--ui-font-default)'` | A font-family list; when given, it is written to the `--ui-font-default` token on `<html>`, so every component uses it. |

A component's own input always wins over the config. The core entry point also exports
`UI_CONFIG` (the injection token), `injectUiConfig()`, `defaultUiConfig`, the shared
`UiSize` (`'sm' | 'md' | 'lg'`) and `UiStatus` types, and `UI_ANIM`, the class names of
the shared enter/leave animations for Angular's `animate.enter` / `animate.leave`.

## Theming

Themes are token overrides keyed on `data-theme`. `UiThemeService` writes it for you:

```ts
theme = inject(UiThemeService);
this.theme.set('goldBlack');   // any of the 14, or your own
this.theme.toggle();           // dark <-> light
```

| Family | Themes | Stylesheet |
| --- | --- | --- |
| Winter (default) | `dark` (`winterDark`), `light` (`winterLight`) | `tokens.css` |
| Palettes | `lightOrange`, `lightPink`, `lightTeal`, `lightPurple`, `lightPurpleGold`, `darkPink`, `darkTeal`, `darkPurple`, `goldBlack`, `goldRed` | `theme-palettes.css` |
| Cinematic | `darkOrange`: ink/ember palette, display + mono fonts, glow | `theme-dark-orange.css` |
| Sea | `maldives`: Ocean Deep, Lagoon, Coral, Sand and Mist, Poppins | `theme-maldives.css` |

`toggle()` moves from `dark` to `light` and from any other theme to `dark`; `winterDark` and
`winterLight` swap with each other.
The darkOrange film grain and custom cursor are components (`ui-grain`, `ui-cursor` from
`@zouriel/ui/fx`) that the app mounts itself; so are the maldives sea backdrops (`ui-wave-footer`,
`ui-ocean-hero`, `ui-coral-decor`, `ui-palm-decor`, `ui-sunrise`, `ui-sea-surface`, `[uiTide]`).

A custom theme is a `[data-theme="yours"]` block that sets the core `--ui-color-*` tokens;
every other token is derived. See `projects/ui/styles/COLOR-SYSTEM.md`. `ui-theme-provider`
scopes a theme to part of the page.

## Develop

```bash
npm install
ng build ui                 # build the library to dist/ui
ng serve showcase           # run the documentation site (http://localhost:4200)
npm run audit:ui -- --url http://localhost:4200   # browser audit of every page (see Checks)
```

The showcase is a routed docs app: a sidebar (built from `ui-side-nav`) plus one page per
component group, each with live demos and full API tables (inputs / outputs / types / shapes).
**Form studio** (`/form-studio`) is a playground for the form builder. It covers:
- making forms, publishing them, filling them in and editing the saved answers;
- a **Settings** page (`ui-form-global-settings`) with a live list over a public API.

It keeps everything in the browser's local storage.

### Checks

```bash
ng test ui --watch=false                    # unit tests, plus the style contract:
                                            #   tokens exist, text ≥ 11px, colours from tokens,
                                            #   every named theme passes WCAG AA
node projects/ui/styles/contrast-check.mjs  # Winter dark/light contrast table
npm run audit:ui -- --url http://localhost:4200
```

`audit:ui` opens every showcase page in Chromium, in several themes at desktop and phone width,
and reports what only a browser can measure. Errors cover:
- rendered contrast;
- fonts outside the theme;
- text under 11px;
- controls of different heights in one row;
- pages that scroll sideways.

Warnings cover cut-off text and small tap targets. Run `npx playwright-core install chromium`
once, or point `CHROME_PATH` at a Chrome.

## License

MIT — see [LICENSE](./LICENSE).
