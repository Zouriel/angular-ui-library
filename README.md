# ui — Angular component library

A token-driven, signal-first **Angular v22** component library. Standalone, zoneless,
tree-shakeable across secondary entry points, fully themeable, and accessible
(`@angular/aria` + CDK). ~110 components across 33 entry points — including a flagship
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
- **Flagships** — `ui-window` (drag/snap/resize/dock + `UiWindowManager`) and
  `ui-file-viewer` (image/video/audio/text/code/**lazy PDF**/explorer).
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

The `dramatic` theme (ink/ember/blood palette, display + mono fonts, glow + grain) lives
in `ui/styles/theme-dramatic.css` and re-skins every component automatically.

## Develop

```bash
npm install
ng build ui                 # build the library to dist/ui
ng serve showcase           # run the documentation site (http://localhost:4200)
```

The showcase is a routed docs app: a sidebar (built from `ui-side-nav`) plus one page per
component group, each with live demos and full API tables (inputs / outputs / types / shapes).

## License

MIT — see [LICENSE](./LICENSE).
