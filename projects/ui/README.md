# @zouriel/ui

A token-driven, signal-first component library for **Angular 22**. It is:
- standalone, zoneless and tree-shakeable, with 34 secondary entry points;
- themeable, with 13 themes that all pass WCAG AA;
- accessible: ARIA roles, keyboard support and CDK focus handling.

Docs with live examples: <https://zouriel.com/uilib/> · Source: <https://github.com/Zouriel/angular-ui-library>

## Install

The package is published to GitHub Packages:

```bash
echo "@zouriel:registry=https://npm.pkg.github.com" >> .npmrc
npm i @zouriel/ui @angular/cdk @hugeicons/angular @hugeicons/core-free-icons
npm i pdfjs-dist        # only if you show PDFs (ui-pdf-viewer, ui-file-viewer)
```

Peers: `@angular/core`, `@angular/common`, `@angular/forms`, `@angular/cdk` ^22;
`@hugeicons/angular` ^1.0.11; `@hugeicons/core-free-icons` ^4.3.0; `pdfjs-dist` ^4.10.38 (optional).

Load the styles once (global stylesheet or `angular.json` styles):

```css
@import '@zouriel/ui/styles/tokens.css';            /* required */
@import '@zouriel/ui/styles/animations.css';        /* enter/leave animations used by overlays */
@import '@zouriel/ui/styles/theme-palettes.css';    /* optional: the ten colour palettes */
@import '@zouriel/ui/styles/theme-dark-orange.css'; /* optional: cinematic Dark Orange (loads Google Fonts) */
@import '@zouriel/ui/styles/fx.css';                /* optional: FX utility classes */
@import '@zouriel/ui/styles/theme-animations.css';  /* optional: palette motion on the FX classes */
@import '@zouriel/ui/styles/color-aliases.css';     /* optional: --color-* aliases for app code */
```

## Use

```ts
import { UiButton } from '@zouriel/ui/button';

@Component({ imports: [UiButton], template: `<ui-button variant="primary">Go</ui-button>` })
export class Demo {}
```

Form controls implement `ControlValueAccessor` (template-driven, reactive and Signal Forms).

## Core (`@zouriel/ui`)

- `provideUiConfig({ glass, radius, animations, defaultFont })`: library-wide defaults, set once in
  the application providers. `glass` (default `false`) and `radius` (`true`) are the defaults for
  components with those inputs; `animations: false` adds `.ui-no-anim` to `<html>`, which turns
  every library animation off; `defaultFont` sets the `--ui-font-default` token on `<html>`.
- `UI_CONFIG`, `injectUiConfig()`, `defaultUiConfig`, `UiConfig`: read the resolved config in your own components.
- `UiSize` (`'sm' | 'md' | 'lg'`) and `UiStatus` (`'neutral' | 'primary' | 'success' | 'warning' | 'danger'`).
- `UI_ANIM`: class names of the shared animations in `animations.css`, for `animate.enter` / `animate.leave`.

## Themes

`UiThemeService.set(name)` sets `data-theme` on the document:
- `dark` / `light` (Winter, the default; also `winterDark` / `winterLight`), in `tokens.css`;
- `lightOrange`, `lightPink`, `lightTeal`, `lightPurple`, `lightPurpleGold`, `darkPink`, `darkTeal`, `darkPurple`, `goldBlack`, `goldRed`, in `theme-palettes.css`;
- `darkOrange`, in `theme-dark-orange.css`.

`ui-theme-provider` scopes a theme to part of the page. A custom theme sets the core `--ui-color-*`
tokens and everything else is derived (see `styles/COLOR-SYSTEM.md`).

## Entry points

| Import from `@zouriel/ui/…` | What's in it |
| --- | --- |
| `button` | button, icon button, button group, segmented, toggle, split, dropdown, FAB |
| `form` | input, textarea, number (scrubbable) + number label, password, search, select, checkbox(es), radio, switch, slider, rating, OTP, chip/token input, colour, file upload, choice grid, anchor picker, editable text, time, form field |
| `combobox` | combobox, multi-select |
| `datepicker` | date picker, date range picker, calendar |
| `overlay` | tooltip, popover, menu, context menu, backdrop, click-outside |
| `dialog` | modal, drawer, bottom sheet, confirm dialog, toasts |
| `navigation` | navbar, side nav, bottom nav, menubar, breadcrumbs, pagination, stepper, anchor nav |
| `tabs`, `accordion`, `list`, `table`, `card`, `alert`, `spinner`, `skeleton`, `divider`, `text` | tabs, accordion, list, table, card + stat card, alert, spinner, skeleton, divider, text |
| `badge` | badge, chip, avatar, avatar group |
| `feedback`, `progress` | empty state, result, loading overlay; progress bar, meter |
| `link` | link, kbd, inline code, blockquote |
| `data` | tree, tree table, timeline, description list, code block |
| `layout` | grid, stack, container, spacer, splitter, sidebar layout, panel section, scroll area, aspect ratio, resize handle |
| `media` | carousel, gallery, image picker, device frame |
| `canvas` | transform box with snapping, vector path editor (pen, points, brushes) |
| `sequencer` | timeline sequencer, scrubber |
| `command-palette` | command palette |
| `window` | floating windows, window manager, draggable, resizable |
| `file-viewer`, `pdf-viewer` | image/video/audio/text/code viewers, lightbox, explorer, lazy PDF |
| `form-builder` | form builder, form renderer, global form settings, option sources ([guide](form-builder/README.md)) |
| `fx` | reveal, cursor, marquee, drift row, grain, glyph field, split text, magnetic, intro loader, scroll progress, section label |
| `behaviors` | swipe, intersect, infinite scroll, virtual list, copy to clipboard, ripple, resize observer |
| `theme` | `UiThemeService`, `ui-theme-provider` |

## License

MIT
