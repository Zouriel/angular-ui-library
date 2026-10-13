# @zouriel/ui — Angular component library

A token-driven, signal-first **Angular v22** component library. Standalone, zoneless,
tree-shakeable across secondary entry points, themeable, and accessible
(`@angular/aria` + CDK). About 140 components and directives across 34 entry points:
- the everyday catalog;
- design tools;
- three flagships: a floating-window system, a multi-format file viewer and a form builder;
- a motion and FX layer.

> Built as an Angular workspace: the library lives in `projects/ui`, and a routed
> **documentation site** (live examples + API tables) lives in `projects/showcase`,
> deployed at <https://zouriel.com/uilib/>.

## Highlights

- **Tokens-only styling**: every component reads CSS custom properties, so a theme is a
  set of token overrides. Ships **13 themes**:
  - **Winter**: Dark and Light, the defaults;
  - **colour palettes**: light and dark Orange, Pink, Teal and Purple, plus Gold Black, Gold Red and Light Purple Gold;
  - **Dark Orange**: a cinematic theme with web fonts and FX.

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
- **Design tools**: transform box with snapping, vector path editor (pen, points, brushes),
  timeline sequencer, scrubber, token input, device frame.
- **Motion/FX**: scroll reveal, custom cursor, marquee, film grain, glyph-field background,
  split text, magnetic, intro loader. Reduced motion calms these rather than removing them.

## Quick start

The package is published to GitHub Packages, so point the scope there once:

```bash
echo "@zouriel:registry=https://npm.pkg.github.com" >> .npmrc
npm i @zouriel/ui @angular/cdk @angular/aria @hugeicons/angular @hugeicons/core-free-icons
npm i pdfjs-dist        # only if you use the PDF viewer
```

Load the global styles once (e.g. in `angular.json` styles or your global stylesheet):

```css
@import '@zouriel/ui/styles/tokens.css';
@import '@zouriel/ui/styles/animations.css';
/* optional: the colour palettes and their signature motion */
@import '@zouriel/ui/styles/theme-palettes.css';
@import '@zouriel/ui/styles/theme-animations.css';
/* optional: the cinematic Dark Orange skin + FX utilities */
@import '@zouriel/ui/styles/theme-dark-orange.css';
@import '@zouriel/ui/styles/fx.css';
```

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

Optional: set library-wide defaults.

```ts
import { provideUiConfig } from '@zouriel/ui';

export const appConfig = {
  providers: [provideUiConfig({ glass: true, radius: true, animations: true })],
};
```

## Theming

Themes are token overrides keyed on `data-theme`. `UiThemeService` writes it for you:

```ts
theme = inject(UiThemeService);
this.theme.set('goldBlack');   // any of the 13, or your own
this.theme.toggle();           // dark <-> light
```

| Family | Themes |
| --- | --- |
| Winter (default) | `dark` (`winterDark`), `light` (`winterLight`) |
| Palettes | `lightOrange`, `lightPink`, `lightTeal`, `lightPurple`, `lightPurpleGold`, `darkPink`, `darkTeal`, `darkPurple`, `goldBlack`, `goldRed` |
| Cinematic | `darkOrange`: ink/ember palette, display + mono fonts, glow and grain |

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
