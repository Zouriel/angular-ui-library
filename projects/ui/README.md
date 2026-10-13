# @zouriel/ui

A token-driven, signal-first component library for **Angular 22**. It is:
- standalone, zoneless and tree-shakeable, with 34 secondary entry points;
- themeable, with 13 themes that all pass WCAG AA;
- accessible, built on `@angular/aria` and the CDK.

Docs with live examples: <https://zouriel.com/uilib/> · Source: <https://github.com/Zouriel/angular-ui-library>

## Install

The package is published to GitHub Packages:

```bash
echo "@zouriel:registry=https://npm.pkg.github.com" >> .npmrc
npm i @zouriel/ui @angular/cdk @angular/aria @hugeicons/angular @hugeicons/core-free-icons
npm i pdfjs-dist        # only if you use the PDF viewer
```

Load the styles once (global stylesheet or `angular.json` styles):

```css
@import '@zouriel/ui/styles/tokens.css';
@import '@zouriel/ui/styles/animations.css';
@import '@zouriel/ui/styles/theme-palettes.css';     /* optional: colour palettes */
@import '@zouriel/ui/styles/theme-animations.css';   /* optional: their signature motion */
@import '@zouriel/ui/styles/theme-dark-orange.css';  /* optional: cinematic Dark Orange */
@import '@zouriel/ui/styles/fx.css';                 /* optional: FX utilities */
```

## Use

```ts
import { UiButton } from '@zouriel/ui/button';

@Component({ imports: [UiButton], template: `<ui-button variant="primary">Go</ui-button>` })
export class Demo {}
```

Form controls implement `ControlValueAccessor` (template-driven, reactive and Signal Forms).
Library-wide defaults: `provideUiConfig({ glass, radius, animations })` from `@zouriel/ui`.

## Themes

`UiThemeService.set(name)` sets `data-theme` on the document:
- `dark` / `light` (Winter, the default);
- `lightOrange`, `lightPink`, `lightTeal`, `lightPurple`, `lightPurpleGold`, `darkPink`, `darkTeal`, `darkPurple`, `goldBlack`, `goldRed`;
- `darkOrange`.

`ui-theme-provider` scopes a theme to part of the page. A custom theme sets the core `--ui-color-*`
tokens and everything else is derived (see `styles/COLOR-SYSTEM.md`).

## Entry points

| Import from `@zouriel/ui/…` | What's in it |
| --- | --- |
| `button` | button, icon button, button group, segmented, toggle, split, dropdown, FAB |
| `form` | input, textarea, number (scrubbable), password, search, select, checkbox(es), radio, switch, slider, rating, OTP, chip/token input, colour, file upload, choice grid, anchor picker, editable text, time, form field |
| `combobox` | combobox, multi-select |
| `datepicker` | date picker, date range picker, calendar |
| `overlay` | tooltip, popover, menu, context menu, backdrop, click-outside |
| `dialog` | modal, drawer, bottom sheet, confirm dialog, toasts |
| `navigation` | navbar, side nav, bottom nav, menubar, breadcrumbs, pagination, stepper, anchor nav |
| `tabs`, `accordion`, `list`, `table`, `card`, `badge`, `alert`, `feedback`, `progress`, `spinner`, `skeleton`, `divider`, `text`, `link` | everyday building blocks |
| `data` | tree, tree table, timeline, description list, code block |
| `layout` | grid, stack, container, spacer, splitter, sidebar layout, panel section, scroll area, aspect ratio, resize handle |
| `media` | carousel, gallery, image picker, device frame |
| `canvas` | transform box with snapping, vector path editor (pen, points, brushes) |
| `sequencer` | timeline sequencer, scrubber |
| `command-palette` | command palette |
| `window` | floating windows, window manager, draggable, resizable |
| `file-viewer`, `pdf-viewer` | image/video/audio/text/code viewers, lightbox, explorer, lazy PDF |
| `form-builder` | form builder, form renderer, global form settings, option sources ([guide](form-builder/README.md)) |
| `fx`, `behaviors` | reveal, cursor, marquee, grain, glyph field, split text, magnetic; swipe, intersect, infinite scroll, virtual list, copy, ripple |
| `theme` | `UiThemeService`, `ui-theme-provider` |

## License

MIT
