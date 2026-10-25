# @zouriel/ui — Angular component library

A token-driven, signal-first **Angular v22** component library. Standalone, zoneless,
tree-shakeable across secondary entry points, themeable, and accessible (ARIA roles,
keyboard support, CDK focus handling). About 140 components and directives across
40 secondary entry points, plus a small core (`@zouriel/ui`):
- the everyday catalog;
- design tools;
- three flagships: a floating-window system, a multi-format file viewer and a form builder;
- a motion and FX layer.

> Built as an Angular workspace: the library lives in `projects/ui`, and a routed
> **documentation site** (live examples + API tables) lives in `projects/showcase`,
> deployed at <https://zouriel.com/uilib/>.

## Highlights

- **Tokens-only styling**: every component reads CSS custom properties, so a theme is a
  set of token overrides. Ships **15 themes**:
  - **Winter**: Dark and Light, the defaults;
  - **colour palettes** (10): Light Orange; Light and Dark Pink, Teal and Purple; Gold Black, Gold Red and Light Purple Gold;
  - **Dark Orange**: a cinematic theme with web fonts and FX;
  - **Maldives** and **Maldives Dark**: a calm sea theme (Poppins) by day and by night, with its own sea backdrops.

  All text and status colours meet WCAG AA in every theme. Switch at runtime with
  `UiThemeService.set('goldBlack')`.
- **Secondary entry points**: import only what you use (`@zouriel/ui/button`,
  `@zouriel/ui/form`, `@zouriel/ui/overlay`, `@zouriel/ui/form-builder`, …).
  Breaking in 0.33.1: `UiDropdownButton` / `UiDropdownItem` moved from `@zouriel/ui/button` to
  `@zouriel/ui/dropdown-button`, so importing a button no longer brings in the CDK overlay.
  Breaking in 0.35.1: `UiMenubar` / `UiMenubarMenu` moved from `@zouriel/ui/navigation` to
  `@zouriel/ui/menubar`, for the same reason. `UiChatBubble` has its own entry,
  `@zouriel/ui/chat-bubble` (still re-exported from `@zouriel/ui/data`).
- **Sign in with Google** (`@zouriel/ui/google-sign-in`, 0.36): `ui-google-sign-in` wraps Google
  Identity Services' own button and emits the ID token; `ui-google-button` is the same button drawn
  to Google's branding guidelines, for apps with their own OAuth flow (and the twin of Flutter's
  `UiGoogleSignInButton`).
- **App shell, feature card, Google authorization** (0.37): `ui-sidebar-layout` puts the sidebar on
  the start side (right in RTL), takes its words from `provideUiStrings`, and with `[bar]="false"`
  and `fill` becomes a full-height chat-style shell driven by the app's own top bar (`compact()`,
  `toggle()`). `ui-feature-card` (`@zouriel/ui/card`) is a clickable product card for landing pages.
  `UiGoogleAuthorization` asks the signed-in user for more Google scopes and returns an access token.
- **Compact tinted feature card** (0.38): `ui-feature-card` gains `size="sm"`, `surface="tinted"`,
  `radius="control"`, `trailingArrow` (the whole card is one button named by its title and
  description) and `descriptionLines`, for start-screen tiles under a chat bar.
- **Full-screen map pages** (0.39): `ui-map` gains `pulse` (soft "searching" rings around a point,
  geo-anchored, a still halo under reduced motion), `insets` (centring, the pin's centre and the
  controls use the part a sheet and a status card leave visible) and `fill`; `ui-floating-panel`
  and `ui-bottom-sheet` report `coverChange` to feed them. `ui-feature-card` gains `badgeTone`,
  `colors` (an app's own surface and accent, dark pair derived, contrast-checked) and `enter` /
  `enterDelay` (a staggered entrance), with an icon lift and arrow nudge on hover and focus.
- **Map preview, selected marker, label modes** (0.43.0): `ui-map preview` is a still picture of the
  map that is one button (`(previewPress)`, named `previewLabel` / the `mapOpen` string, an expand badge
  at the top-end corner): no pan, zoom, keys or controls, and the wheel or a drag over it scrolls the
  page. `selectedMarkerId` draws one marker bigger, ringed and haloed on top with its label, and
  `markerLabels` ('all' | 'selected' | 'none') says which labels show.
- **0.44.2**: `ui-map` markers sit exactly on their points. Since 0.35.1 `.ui-map .ui-map-marker` set
  `position: relative`, which outranked Leaflet's absolute marker positioning, so the icons fell into normal flow
  and each was drawn about 16px below the one before (280 pins became a column); every dot was also 4px low.
  `npm run audit:map-markers` checks every marker's dot and hit area in a real browser. A glass `ui-bottom-sheet`'s `[sheet-footer]` is always frosted, whatever `glassStrength`, so the
  body scrolling under it never shows through. `fitPoints()` / `fitArea()` called before Leaflet has loaded are
  held and run once it has, without animating (they did nothing). Toasts take their font from `--ui-toast-font`
  on `ui-toast-host` (default the theme font), as the fields do with `--ui-field-font`. The Flutter twin also
  made a one-row textarea at least 48dp on phones; the web textarea already meets its target rule.
- **0.45.1**: a tap on a `ui-swipe-screen`'s back-swipe strip (the 24px leading edge of an `edgeSwipeOnly` screen)
  goes to what is under it, such as the screen's Back arrow; a swipe from it still only swipes back.
- **0.45.2**: `ui-map` ignores a queued Leaflet `moveend` after its host is removed, including when the map is left during an animated move. Keyboard pin placement also safely stops if the map is no longer ready.
- **Right to left and Dhivehi** (0.46.0): every component mirrors under `dir="rtl"` (logical insets, start/end
  drawers and toast corners, mirrored chevrons and slides, arrow keys that follow the row, map controls that move
  with a runtime direction change); `UiDirectionService.set('rtl', 'dv')` flips the page and keeps the CDK in step.
  All the library's words are built-in strings, switchable live with `UiStringsService.set(uiStringsDv)` (a complete
  Dhivehi set with month and day names); date names and the first weekday come from the strings or `LOCALE_ID`,
  never the browser default. Breaking-ish: the toast host defaults to `bottom-end` (same as before in LTR), inputs
  that defaulted to English text now default to `undefined`, and an `en-GB` app's calendars start on Monday.
  Showcase: an RTL · ދިވެހި switch in the top bar mirrors every page; `npm run audit:rtl` measures it in a browser.
- **0.46.1**: three RTL fixes from the Dhirumi web app. An empty `dir="auto"` `ui-input` / `ui-textarea` leaves `dir`
  off its native control (and its wrapper), so the placeholder follows the page and sits at the start of an RTL page
  (Chromium resolved the empty field to LTR); once there is text it is `auto` again. Text fields (input, textarea,
  search, password) write a model value into the native control whenever the two differ, so `''` set straight after
  typing (a chat composer clearing on send) clears the box. `ui-badge` under `:lang(dv)` or `:dir(rtl)` takes the
  font's own line height plus 1px below (20px minimum), so Thaana's marks below the line stay inside the pill; Latin
  badges keep 20px. `npm run audit:rtl -- --font <Faruma.ttf>` measures all three in a browser.
- **0.47.1**: navigation view gaps found by the Dhirumi apps. `ui-map-navigation`: the app's own buttons as children
  (`<button uiNavAction [icon] label tone pressed>`, `UiNavAction`: 48px round opaque buttons stacked at the end
  side under the banner, clear of the compass and Recenter; `tone="danger"` is the SOS style, `pressed` a toggle),
  `[status]` (a pill under the banner, a polite live region: "Rerouting…") and `[insets]` (`{ top, bottom, start,
  end }`: the banner, buttons, Recenter and bar stay clear of the app's own bars; the safe area counts where bigger).
  The banner's maneuver arrow (and the tab, Recenter and action icons) keep the banner's contrast colour over a theme
  or app icon tint (it read faint on the primary banner); 4.5:1 or more in every theme, plain and glass. Maneuver
  types and modifiers may be snake_case (`sharp_right`, `end_of_road`) as well as OSRM's words (`uiNavWord`).
  `ui-fab` `bottomOffset` floats a bottom fab above a sheet's peek (eased). `npm run audit:nav` measures it all in a
  browser.
- **0.47.2**: navigation action hold and status wrapping. `button[uiNavAction]` takes `hold` (2 s, `UI_NAV_HOLD_MS`) or
  `[holdMs]`: it fires `(confirmed)` only when held to the end, on the library's hold logic (`UiHoldPress`, as
  `ui-hold-button` and a holding `ui-fab`). A ring in the button's ink fills clockwise round its edge; letting go or
  sliding off cancels; Space or Enter held works; it is described by `holdHint` and a polite live region reads the
  progress ("Holding, 50%") and an early release ("Hold cancelled"; new strings `holdProgress`, `holdCancelled`, in
  English and Dhivehi). Under reduced motion the hold is still needed and the ring shows whole and steady. A tap or a
  screen reader's activation calls `[onTap]` (the SOS confirm sheet) or, without one, the confirm dialog
  (`confirmTitle`, `confirmMessage`, `confirmLabel`, `destructive`). The status pill wraps to two lines and then ends
  on a whole word with an ellipsis (`uiNavFitWords`; screen readers get the whole text), between the compass column
  and the buttons, in LTR and RTL; it is outside the measured banner, so a taller pill moves neither the banner, the
  buttons nor the map. `npm run audit:nav` checks both in a browser (LTR / RTL, reduced motion on and off).
- **0.47.0**: map navigation mode and turning the map. `ui-map-navigation` (in `@zouriel/ui/map`) is a turn-by-turn
  view: the map follows the person heading-up, the way behind dimmed, an arrow puck, a banner with the next maneuver's
  arrow, "in 80 m", the instruction and street, the maneuver after it small, and the time / distance left, arrival
  time and End. The app feeds the OSRM route, steps (its own localized instructions) and positions; `UiNavTracker`
  (pure) emits `announce` (start, each new maneuver, 200 m and 30 m before it), `offRoute` (5 s over 40 m off) and
  `arrived` (20 m). Maneuver icons (`UI_NAV_ICONS`) cover turns, slight / sharp, U-turns, roundabout exits, forks,
  merges, depart and arrive, never mirrored in RTL. `ui-map` gains `[bearing]`, `rotatable` (two fingers past 15
  degrees before a 10% zoom or 30 px pan; Alt + drag with a mouse), a compass under the zoom buttons while turned
  ("Reset to north"), `rotateTo()`, `(bearingChange)`, `(userMove)`, `zoomButtons`, `UiMapUserLocation.heading`
  (arrow puck) and `UiMapRoute.opacity`; markers, the pin and labels stay upright. Leaflet can't rotate, so the map
  pane turns with CSS, for that map only. New strings `nav*` and `mapResetNorth` (en + dv).
- **0.46.2**: map routes draw in. A route that appears in `ui-map` `[routes]`, or gets new points, grows along its
  path from start to end (casing and line together, ease-out, 250..900 ms by length: `uiMapRouteDrawMs`), then sits
  as before; `fitPoints` is unchanged. Re-rendering the same id and points doesn't replay it. `animate: false` on a
  route, reduced motion or `preview` draw it at once. A removed route fades out over 150 ms.
- **0.46.3**: chat bubble side. `<ui-chat-bubble [mine]="true" mineSide="right">` keeps your own messages on the
  right and the other side's on the left in LTR and RTL alike (the chat-app habit), with the tucked corners and meta
  line laid out as in LTR; the text takes its own direction (`dir="auto"`: Thaana right to left, Latin left to
  right). `provideUiConfig({ chatMineSide: 'right' })` sets it app-wide. The default, `'end'` (the inline end, so the
  left in RTL), is unchanged. `npm run audit:rtl` measures it.
- **Compact density** (0.45.0): `provideUiConfig({ density: 'comfortable' | 'compact' | 'auto' })`, or
  `data-density="compact"` / `"auto"` on `<html>` (or any element, for its subtree; `applyUiDensity()` at runtime).
  Compact makes things smaller, not tighter: `--ui-font-size-sm/md/lg` 12/14/16px (from 13/15/18), the ui-text
  headings (new tokens `--ui-font-size-h1/h2/h3/h5/h6`) about 10% smaller, `--ui-size-sm/md/lg` 24/26/34px
  (from 26/30/38), text components size in px scaled by `--ui-font-scale` 0.93, and every icon plus the switch,
  checkbox and radio marks drawn 10% smaller (`--ui-density-scale` 0.9, a 20px icon at 18). Spacing, radii,
  `--ui-size-xl` and the 44px touch areas don't change. `auto` is compact below 600px wide and follows resizes.
  On iOS, compact keeps typed text at 16px so Safari doesn't zoom into fields (comfortable keeps 15px, as before).
  Default: comfortable, unchanged. `npm run audit:density` checks it in a browser; `npm run audit:ui -- --density compact`.
- **0.44.3**: `ui-bottom-sheet` with a `[sheet-footer]`: the body's scroll box ends at the footer's top, so nothing
  scrolls under its buttons (frosting alone left text readable in light themes).
- **0.44.1**: no Angular change. The Flutter twin fixed dialogs opened from above its navigator (a held SOS fab
  in `UiApp.builder`); web overlays never depended on one.
- **Map search area, swipe screens, SOS fab** (0.44.0): `ui-map [area]` draws a search circle in
  true metres; with `editable` a handle on its edge drags the radius (a slider for keyboards and
  screen readers, `(areaChanging)` / `(areaChange)`), and `fitArea()` shows it all.
  `ui-swipe-screens` puts full-height screens side by side (a chat with its map one swipe away),
  leaving the leading edge to an app drawer and letting a map screen keep its drags. `ui-fab` gains
  logical and centred placements, `tone="danger"` (a high-visibility SOS button), `text`,
  `aboveOverlays`, `topOffset` and hold-to-activate (`UiFabHold`, `[hold]`). `ui-button` and
  `ui-icon-button` gain `[badge]` (a count bubble read with the name; `uiBadgeCount`),
  `ui-bottom-sheet` a `[sheet-footer]` action bar pinned at every snap, and `ui-floating-panel`
  `[insetEnd]`.
- **Map background taps** (0.43.1): `ui-map` emits `(mapTap)` with the tapped `UiLatLng` only for
  the map background (the user dot counts as background)—not for a marker, pin, zoom/locate/app control, attribution,
  preview, drag or double-click zoom. In `pinMode`, a background tap still moves the pin and also
  emits the event, so a results map can clear its selected card without breaking location picking.
- **Chat bubbles keep their words whole** (0.42.2): `ui-chat-bubble` takes the whole row whatever its
  parent aligns (a column with `align-items: flex-start`/`flex-end`/`center`, a row, a grid), so its
  80% never resolves against a host shrunk to its own text ("okay" broke as "ok/ay"), and it uses
  `overflow-wrap: break-word`: words wrap whole, a long URL breaks only where it would overflow.
- **Map controls, a fit that holds, labels off the edge** (0.42.1): a `fitPoints` fit owns the camera,
  so when `insets` change while it animates or after it (a sheet growing as the route appears) it is
  worked out again for the new insets, until the person or the app moves the map. `ui-map` gains
  `controls` (the app's own round buttons in the locate button's stack and style, `(controlPress)`),
  and marker labels flip to the other side of their dot near the map's edge (mirrored in RTL).
- **Map routes and fit to points** (0.42.0): `ui-map` gains `routes` (lines along the road in a tone
  over a casing, under the dots, markers and pin; `--ui-map-route-*` tokens, 3:1 against MapTiler
  streets-v2 and dataviz tiles in every theme) and `fitPoints(points, { padding, maxZoom, animate })`
  (every point inside the part the insets leave visible, at a whole zoom up to 17). Marker labels size
  to their text up to 320px (or the map less 32px) and wrap to two lines; the zoom buttons share the
  locate button's raised surface and shadow.
- **Clear glass; sheet cover follows the sheet** (0.41.3): `glassStrength` on `ui-bottom-sheet` and
  `ui-floating-panel`, `'clear'` by default: over a map in the theme's brightness the map plainly
  shows through (a 12% tint, a 3px blur, a per-theme squeeze only as far as AA over such a map needs,
  and a saturation boost); `'frosted'` is the 0.41.2 surface, AA over anything. A bottom `ui-drawer`
  rests on the on-screen keyboard (it was `bottom: 0`, behind the keyboard wherever the browser shrinks
  only the visual viewport). `coverChange` is covered by a spec for new snaps at the same index and a
  new offset (the Flutter twin did not report those).
- **Glass bottom sheet and floating panel** (0.41.2): `ui-bottom-sheet` gains `glass` and
  `ui-floating-panel`'s `glass` uses the same recipe: a see-through surface for a form and a status
  card over a full-screen map, the theme's surface at 60% over a blurred backdrop held to a per-theme
  range (`--ui-glass-sheet-floor` / `--ui-glass-sheet-ceiling`) so text stays WCAG AA over any tile,
  pure white and pure black included, in every theme. Solid without `backdrop-filter` and under
  `prefers-reduced-transparency` or `prefers-contrast: more`.
- **Image and PDF viewers can fill the page** (0.41.1): `ui-image-viewer` and `ui-pdf-viewer` take
  `fill`: all the space the parent gives, no frame, the photo or page fitted (contain, centred) and
  the zoom controls floating over the bottom, safe-area aware, instead of a bar of their own. Without
  `fill` a viewer in a parent with no height is now 60% of the screen rather than a short box, and a
  photo is fitted to its stage whatever its size. The PDF viewer also zooms with Ctrl+wheel and a
  two-finger pinch; the image viewer takes `+`/`-`/`0` when focused.
- **Fixed header and footer in drawers and sidebars** (0.41.0): `ui-drawer` gains `[drawer-header]`
  and `[drawer-footer]`, and `ui-sidebar-layout` gains `[sidebar-header]` and `[sidebar-footer]`.
  They stay put (docked and in the drawer, the footer at the bottom of the viewport with `fill`,
  clear of the home indicator) while only the body between them scrolls, with a hairline under the
  header and over the footer while the body is scrolled out of sight on that side. Focus and screen
  readers go header, body, footer. Without them nothing changes. `uiScrollFade` is exportable
  (`#x="uiScrollFade"`) and draws no fade with size 0.
- **Feature card colours follow the active theme from the first frame** (0.40.2): a `ui-feature-card`
  with `colors` created while the app's stylesheet was still loading (critical-CSS builds inline only
  the Winter Dark `:root` tokens) no longer keeps the dark pair on a light theme. Components that read
  theme tokens (feature-card colours, the Google button's auto theme, the map's dark tiles) share
  `uiWatchTheme`, which re-reads after render and on `data-theme`, class and style changes up the
  tree, stylesheets arriving, and `prefers-color-scheme` changes.
- **48px map controls on touch, LTR attribution** (0.40.1): on coarse pointers the `ui-map` locate
  button and zoom buttons get a 48px hit area centred on the visible control (the zoom buttons are
  now really 44px on touch), and the attribution is an LTR isolate, so English credits keep their ©
  signs in place in RTL while its corner still flips.
- **Map tiles, my location, a sheet that holds still** (0.40): `ui-map` gains `tileUrlDark` (dark
  tiles shown undimmed, swapped live with the theme), `tileSize` / `zoomOffset` (512 px tiles) and
  `{r}` retina URLs; `locateControl` (a round "Show my location" button above the bottom sheet, with
  `locating` and `locateOff` states, `(locate)`), `userLocation` (the "you are here" dot with an
  accuracy halo) and `flyTo()`. `ui-bottom-sheet` no longer jumps or re-opens while typing on a phone.
- **Persistent bottom sheets** (0.39.1): a `ui-bottom-sheet` whose smallest snap is above 0 (peek /
  half / full, no closed state) is `persistent()`: Escape collapses it to that snap and does nothing
  there, and the sheet never touches browser history, so Back always leaves the page. `maxWidth`
  (px or a CSS length) caps the sheet and centres it on wider screens, e.g. 560 on tablets and desktops.
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
/* optional: the Maldives sea skins, maldives and maldives-dark (loads Poppins) */
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
| `density` | `'comfortable'` | `'compact'` or `'auto'` (compact below 600px) sets `data-density` on `<html>`: smaller type, controls and icons, same spacing and touch targets (0.45.0). |
| `defaultFont` | `'var(--ui-font-default)'` | A font-family list; when given, it is written to the `--ui-font-default` token on `<html>`, so every component uses it. |

A component's own input always wins over the config. The core entry point also exports
`UI_CONFIG` (the injection token), `injectUiConfig()`, `defaultUiConfig`, the shared
`UiSize` (`'sm' | 'md' | 'lg'`) and `UiStatus` types, and `UI_ANIM`, the class names of
the shared enter/leave animations for Angular's `animate.enter` / `animate.leave`, and
`uiLeaveHidden(leaveClass)`, an `(animate.leave)` handler for a backdrop that leaves next to a
longer panel animation: it holds the backdrop at 0 instead of letting it flash back.

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
| Sea | `maldives`: Ocean Deep, Lagoon, Coral, Sand and Mist, Poppins; `maldives-dark`: the same sea at night (deep ocean canvas, Foam ink, Lagoon primary, Coral accent). A day/night toggle switches between the two names | `theme-maldives.css` |

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
npm run audit:chat-wrap -- --url http://localhost:4310   # or --dist <showcase build>
npm run audit:rtl -- --dist <showcase build>             # RTL / Dhivehi, measured (0.46.0)
```

`audit:ui` opens every showcase page in Chromium, in several themes at desktop and phone width,
and reports what only a browser can measure. Errors cover:
- rendered contrast;
- fonts outside the theme;
- text under 11px;
- controls of different heights in one row;
- pages that scroll sideways.

Warnings cover cut-off text and small tap targets. `audit:chat-wrap` puts the showcase's chat
bubbles in every common parent (flex columns aligned start/end/center/stretch, a row, a grid; LTR
and RTL) at 390px and fails if a short word wraps, a bubble leaves its side of the row, or a
200-character URL escapes 80% of the row. `audit:rtl` loads the showcase at 390px in English and with the
RTL · ދިވެހި switch on and measures drawers, toasts, the chat bubble, switch, alert, select, date picker, map
controls (also after a runtime flip), the OTP order and that Thaana draws in `--ui-font-default`. Run `npx playwright-core install chromium`
once, or point `CHROME_PATH` at a Chrome.

## License

MIT — see [LICENSE](./LICENSE).
