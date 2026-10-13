# ui — Angular component library

A token-driven, signal-first **Angular v22** component library. Standalone, zoneless,
tree-shakeable across secondary entry points, fully themeable, and accessible
(`@angular/aria` + CDK). ~110 components across 34 entry points — including a flagship
floating-window system and a multi-format file viewer — plus a cinematic motion/FX layer.

> Built as an Angular workspace: the library lives in `projects/ui`, and a routed
> **documentation site** (with live examples + API tables) lives in `projects/showcase`.

## Highlights

- **Tokens-only styling** — every component reads CSS custom properties, so a theme is
  just a set of token overrides. Ships **dark**, **light**, and a cinematic **dramatic**
  theme; switch at runtime with `UiThemeService.set('dramatic')`.
- **Secondary entry points** — import only what you use: `ui/button`, `ui/form`,
  `ui/overlay`, `ui/window`, `ui/file-viewer`, `ui/fx`, …
- **Signals + modern APIs** — `input()` / `output()` / `model()`, control flow, no NgModules.
- **CVA form controls** — work with template-driven, reactive, and Signal Forms.
- **Flagships** — `ui-window` (drag/snap/resize/dock + `UiWindowManager`),
  `ui-file-viewer` (image/video/audio/text/code/**lazy PDF**/explorer), and
  `ui-form-builder` + `ui-form-renderer` (drag-and-drop forms with rules between
  questions and sections, repeating sections, steps, calculations, custom checks;
  JSON in, JSON out — see `projects/ui/form-builder/README.md`).
- **Motion/FX** — scroll reveal, custom cursor, marquee, film grain, glyph-field
  background, split-text, magnetic, intro-loader.

## Quick start

```bash
npm i ui @angular/cdk @angular/aria
```

Load the global tokens once (e.g. in `angular.json` styles or your global stylesheet):

```css
@import 'ui/styles/tokens.css';
@import 'ui/styles/animations.css';
/* optional cinematic skin + fx utilities */
@import 'ui/styles/theme-dramatic.css';
@import 'ui/styles/fx.css';
```

Use any component — they're standalone:

```ts
import { Component } from '@angular/core';
import { UiButton } from 'ui/button';

@Component({
  selector: 'app-demo',
  imports: [UiButton],
  template: `<ui-button variant="primary">Go</ui-button>`,
})
export class Demo {}
```

Optional: set library-wide defaults.

```ts
import { provideUiConfig } from 'ui';

export const appConfig = {
  providers: [provideUiConfig({ glass: true, radius: true, animations: true })],
};
```

## Theming

Themes are token overrides keyed on `data-theme`. The `UiThemeService` writes it for you:

```ts
theme = inject(UiThemeService);
this.theme.set('dramatic');  // 'dark' | 'light' | 'dramatic' | any custom
this.theme.toggle();         // dark <-> light
```

The `darkOrange` theme (ink/ember/blood palette, display + mono fonts, glow + grain) lives
in `ui/styles/theme-dark-orange.css` and re-skins every component automatically.

## Develop

```bash
npm install
ng build ui                 # build the library to dist/ui
ng serve showcase           # run the documentation site (http://localhost:4200)
```

The showcase is a routed docs app: a sidebar (built from `ui-side-nav`) plus one page per
component group, each with live demos and full API tables (inputs / outputs / types / shapes).
**Form studio** (`/form-studio`) is a playground for the form builder: make forms, publish them,
fill them in and edit the saved answers. It keeps everything in the browser's local storage.

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
