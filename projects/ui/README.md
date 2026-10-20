# @zouriel/ui

A token-driven, signal-first component library for **Angular 22**. It is:
- standalone, zoneless and tree-shakeable, with 39 secondary entry points;
- themeable, with 15 themes that all pass WCAG AA;
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
@import '@zouriel/ui/styles/theme-maldives.css';    /* optional: Maldives sea skins, day and night (loads Poppins) */
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
- `UiSize` (`'sm' | 'md' | 'lg'`), `UiButtonSize` (`UiSize | 'xl'`, 56px: buttons, icon buttons, hold button, avatar) and `UiStatus` (`'neutral' | 'primary' | 'success' | 'warning' | 'danger'`).
- `UI_ANIM`: class names of the shared animations in `animations.css`, for `animate.enter` / `animate.leave`.
- `uiLeaveHidden(leaveClass)`: an `(animate.leave)` handler that plays the class and then holds the element at opacity 0 until it is removed; use it for a backdrop that leaves alongside a longer panel animation (the class form flashes the backdrop back in Angular 22.2).

## Themes

`UiThemeService.set(name)` sets `data-theme` on the document:
- `dark` / `light` (Winter, the default; also `winterDark` / `winterLight`), in `tokens.css`;
- `lightOrange`, `lightPink`, `lightTeal`, `lightPurple`, `lightPurpleGold`, `darkPink`, `darkTeal`, `darkPurple`, `goldBlack`, `goldRed`, in `theme-palettes.css`;
- `darkOrange`, in `theme-dark-orange.css`;
- `maldives` and its night variant `maldives-dark`, both in `theme-maldives.css` (its sea backdrops are components in `@zouriel/ui/fx`; `ui-sea-surface` scopes `maldives` unless given `theme="maldives-dark"` or `[theme]="null"`).

`ui-theme-provider` scopes a theme to part of the page. A custom theme sets the core `--ui-color-*`
tokens and everything else is derived (see `styles/COLOR-SYSTEM.md`).

## Entry points

| Import from `@zouriel/ui/…` | What's in it |
| --- | --- |
| `button` | button, icon button, button group, segmented, toggle, split, FAB |
| `dropdown-button` | dropdown button (its own entry since 0.33.1: it needs the CDK overlay) |
| `menubar` | menubar (its own entry since 0.35.1: it needs the CDK overlay) |
| `chat-bubble` | chat bubble (also re-exported from `data`) |
| `hold-button` | press-and-hold to confirm, with a confirm-dialog fallback |
| `map` | OpenStreetMap map with markers and a pin (Leaflet, loaded on first use; install `leaflet` ~1.9.4) |
| `form` | input and textarea (with leading/trailing slots and `dir`), number (scrubbable) + number label, password, search, select, checkbox(es), radio, switch, slider, rating, OTP, chip/token input, colour, file upload, choice grid, anchor picker, editable text, time, form field |
| `combobox` | combobox, multi-select |
| `datepicker` | date picker, date range picker, calendar |
| `overlay` | tooltip, hint (coachmark), popover, menu, context menu, backdrop, click-outside |
| `dialog` | modal, drawer, bottom sheet, confirm dialog, toasts |
| `navigation` | navbar, side nav, bottom nav, breadcrumbs, pagination, stepper, anchor nav |
| `tabs`, `accordion`, `list`, `table`, `card`, `alert`, `spinner`, `skeleton`, `divider`, `text` | tabs, accordion, list, table, card + stat card, alert, spinner, skeleton, divider, text |
| `badge` | badge, chip, avatar, avatar group |
| `feedback`, `progress` | empty state, result, loading overlay; progress bar, progress circle, meter |
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
| `fx` | reveal, cursor, marquee, drift row, grain, glyph field, split text, magnetic, intro loader, scroll progress, section label; sea backdrops (wave footer, ocean hero, coral and palm decor, sunrise, sea surface, tide) |
| `behaviors` | swipe, intersect, infinite scroll, virtual list, copy to clipboard, ripple, resize observer, slide transition (views and routes) |
| `theme` | `UiThemeService`, `ui-theme-provider` |

## License

MIT

## Built-in strings

The library's own words (names of icon-only buttons, default labels) are English. Replace them with
`provideUiStrings({ … })` (partial; the rest stay English): `close` (modal, drawer, bottom sheet),
`dismiss` (toast, alert, hint), `clear` (combobox), `clearAll` (multi-select), `clearSearch` (search
input), `previousPage` / `nextPage` (pagination), `previousMonth` / `nextMonth` (calendar, date range
picker), `chooseDate` (date picker), `moreActions` (split button; also its `menuLabel` input),
`uploadLabel` / `uploadHint` (file upload; also its `label` / `hint` inputs), `holdHint`, `confirmTitle`,
`confirm`, `cancel` (hold button), `zoomIn` / `zoomOut` / `placePinAtCentre` (map). Flutter has the same
keys in `UiConfig(strings: UiStrings(...))`.

Still English only (0.34.0), to move to `UiStrings` next:

| Component | Words |
| --- | --- |
| canvas viewport, transform box | Zoom in, Zoom out, Fit to view (and their tooltips), Rotate |
| command palette | Command palette |
| file viewer: audio, video, image viewer, lightbox, explorer | Seek, Volume, Playback speed, Fullscreen, Play, Previous/Next (image), Zoom in/out, Reset view, Close, Everything in this set, Path |
| color picker | Pick color, Hex color |
| OTP input | One-time code |
| intro loader | Loading… |
| sidebar layout, splitter | Toggle navigation, Resize panes |
| carousel, gallery | Previous/Next slide, Previous, Next, Close, Image viewer |
| anchor nav, breadcrumbs | On this page, Breadcrumb |
| PDF viewer | Previous/Next page, Zoom in/out |
| sequencer | Playhead, Drag to reorder |
| table | Actions, Select all rows, Select row N |
| window | Close |
| form builder, workflow | their editors' interface text (many strings; separate work) |
