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
| `map` | OpenStreetMap (or any raster tiles, light and dark) map with markers, a pin, route lines, fit-to-points, a "searching" pulse, view insets for full-screen map pages, a "my location" button and the "you are here" dot (Leaflet, loaded on first use; install `leaflet` ~1.9.4) |
| `google-sign-in` | Sign in with Google: `ui-google-sign-in` (Google Identity Services' button, emits the ID token), `ui-google-button` (the drawn, branded button) and `UiGoogleAuthorization` (an access token for more scopes); see below |
| `form` | input and textarea (with leading/trailing slots and `dir`), number (scrubbable) + number label, password, search, select, checkbox(es), radio, switch, slider, rating, OTP, chip/token input, colour, file upload, choice grid, anchor picker, editable text, time, form field |
| `combobox` | combobox, multi-select |
| `datepicker` | date picker, date range picker, calendar |
| `overlay` | tooltip, hint (coachmark), popover, menu, context menu, backdrop, click-outside |
| `dialog` | modal, drawer, bottom sheet, confirm dialog, toasts |
| `navigation` | navbar, side nav, bottom nav, breadcrumbs, pagination, stepper, anchor nav |
| `tabs`, `accordion`, `list`, `table`, `card`, `alert`, `spinner`, `skeleton`, `divider`, `text` | tabs, accordion, list, table, card + stat card + feature card, alert, spinner, skeleton, divider, text |
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

## Sign in with Google (`@zouriel/ui/google-sign-in`)

```ts
import { UiGoogleSignIn } from '@zouriel/ui/google-sign-in';
```
```html
<ui-google-sign-in clientId="1234-abc.apps.googleusercontent.com" text="continue_with"
  [nonce]="nonce" (credential)="signIn($event)" (failed)="showError($event.message)" />
```

- `ui-google-sign-in` loads `https://accounts.google.com/gsi/client` once, calls
  `google.accounts.id.initialize({ client_id, callback, nonce, ux_mode: 'popup', use_fedcm_for_button: true })`
  and renders Google's button. `(credential)` is the ID token (a JWT): send it to your API, which
  verifies it for the same client ID (and the nonce, if you gave one). A skeleton holds the space
  while the script loads; if it can't load (blocked, offline) a disabled drawn button shows and
  `(failed)` fires. Inputs: `clientId` (required), `text` (`'signin_with' | 'signup_with' |
  'continue_with' | 'signin'`), `theme` (`'auto' | 'light' | 'dark' | 'neutral'`: light → `outline`,
  dark → `filled_black`, neutral → `outline` because GIS has no neutral theme; auto follows the
  library theme and re-renders when it changes), `shape` (`'rectangular' | 'pill'`), `width` (px,
  kept within GIS's 200–400; otherwise the host's width), `locale`, `nonce`. GIS's initialize is
  page-wide, so show one per page. A Content-Security-Policy must allow `accounts.google.com`
  (script, frame, connect). Tests provide `UI_GOOGLE_IDENTITY` (a loader returning a fake with
  `initialize` / `renderButton`).
- `ui-google-button` is the button drawn to Google's branding guidelines (the official G, Google's
  light / dark / neutral colours, 40px, rectangular or pill), a plain `<button>` that emits
  `(pressed)`, for apps that run their own OAuth flow. Inputs: `text` (`'signIn' | 'signUp' |
  'continueWith' | 'signInShort'`), `theme`, `shape`, `loading`, `disabled`, `expand`, `ariaLabel`.
  Its words come from `provideUiStrings`. The guideline's font is Google Sans Medium 14/20; the
  library bundles no Google font, so it uses Google Sans if the device has it, then Roboto, then
  the library font (`--ui-font-default`).
- Flutter: `UiGoogleSignInButton` draws the same button; the app pairs it with the `google_sign_in`
  package (`authenticate()` → `idToken`, with `serverClientId` = this web client ID).

### Asking for more Google data

Sign-in gives only name, email and picture. For more (birthday, phone number, contacts), ask the
signed-in user for an OAuth access token with extra scopes, then call the Google API with it:

```ts
import { UiGoogleAuthorization, UiGoogleAuthorizationError } from '@zouriel/ui/google-sign-in';

private auth = inject(UiGoogleAuthorization);
ngOnInit() { this.auth.preload(); }   // load GIS before the click

async addBirthday() {                 // call from a click: browsers block popups otherwise
  try {
    const t = await this.auth.requestAccessToken({
      clientId: '1234-abc.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/user.birthday.read'],
      hint: this.user.email,          // skips the account chooser
    });
    if (t.grantedScopes.includes('https://www.googleapis.com/auth/user.birthday.read')) {
      // t.accessToken is valid for t.expiresIn seconds
    }
  } catch (e) {
    if (e instanceof UiGoogleAuthorizationError && e.kind === 'cancelled') return;
    throw e;
  }
}
```

- `requestAccessToken({ clientId, scopes, hint?, prompt? })` uses Google Identity Services'
  token client (`google.accounts.oauth2.initTokenClient`, popup, `include_granted_scopes: true`)
  through the same `UI_GOOGLE_IDENTITY` loader, and resolves with
  `{ accessToken, grantedScopes, expiresIn }`. The user can untick scopes, so check
  `grantedScopes` before calling an API. `prompt: 'consent'` always shows the consent screen.
- It rejects with a `UiGoogleAuthorizationError` whose `kind` is `'cancelled'` (popup closed or
  consent declined), `'popup_blocked'`, `'unavailable'` (the script could not load) or `'failed'`
  (anything else; `googleError` has Google's code).
- The scopes must be enabled for the client in Google Cloud (and sensitive ones verified). Tests
  give the fake from `UI_GOOGLE_IDENTITY` an `oauth2` part with `initTokenClient`.
- Flutter has no library equivalent: apps use the `google_sign_in` package's `authorizationClient`.

## Sidebar layout as an app shell

`ui-sidebar-layout` (`@zouriel/ui/layout`) puts the sidebar on the start side (the right in
`dir="rtl"`, where the drawer slides in from the right). For an app with its own top bar and a
part docked at the bottom (a chat composer):

```html
<ui-sidebar-layout #shell [bar]="false" fill [(open)]="navOpen">
  <my-nav sidebar (navigate)="navOpen.set(false)" />
  <my-top-bar [showMenu]="shell.compact()" (menu)="shell.toggle()" />
  <div class="messages">…</div>   <!-- flex: 1; min-height: 0; overflow-y: auto -->
  <my-composer />
</ui-sidebar-layout>
```

`bar` (default true) is the built-in top bar with the menu button and `[header]` slot; `fill`
(default false) makes the shell exactly the viewport (100dvh, safe-area aware), with the sidebar and
the content scrolling inside and the content an unpadded flex column. `compact` is a readonly
signal, true in drawer mode. In drawer mode Escape and the backdrop close the drawer, focus moves in
on open and back to the opener on close, and a closed drawer is inert. Its words are the strings
`sidebarToggle`, `sidebarClose` and `sidebarLabel`.

**Fixed top and bottom (0.41).** A chat list between a New chat button and the account, with the
account always in view:

```html
<ui-sidebar-layout [bar]="false" fill>
  <ui-button sidebar-header [block]="true">New chat</ui-button>
  <my-chat-list sidebar />          <!-- the only part that scrolls -->
  <my-account sidebar-footer />     <!-- at the bottom of the viewport -->
  …
</ui-sidebar-layout>
```

The aside is a column: `[sidebar-header]`, the `[sidebar]` body (`overflow-y: auto`), and
`[sidebar-footer]`, docked and in the drawer. The safe-area insets go on the outer parts (the header's
top, the footer's bottom); a hairline shows under the header while the list is scrolled down and over
the footer while more is below. Without `fill` the header and footer stick to the screen while the
page scrolls. `ui-drawer` has the same structure with `[drawer-header]` and `[drawer-footer]`: under
the title bar, the fixed header, the scrolling body, the fixed footer (left and right drawers pad it
by `env(safe-area-inset-bottom)`). Leave the slots empty and both look exactly as before (the sidebar's
`[sidebar]` content now scrolls in an inner `.sb-bd` instead of the aside itself).

## A document as the whole page (`fill`, 0.41.1)

`ui-image-viewer` and `ui-pdf-viewer` take `fill` for a page whose point is one document, such as a
payment slip opened from a list. Give the parent a height:

```html
<main class="slip-page">            <!-- display: flex; flex-direction: column; height: 100dvh -->
  <h1>Payment slip</h1>
  @if (isPdf) {
    <ui-pdf-viewer fill [src]="url" />
  } @else {
    <ui-image-viewer fill [src]="url" alt="Payment slip" />
  }
</main>
```

```css
.slip-page > ui-image-viewer, .slip-page > ui-pdf-viewer { flex: 1; min-height: 0; }
```

The viewer takes all of that space with no frame; the photo or page is fitted into it (contain,
centred; 100% means fitted), pinch, Ctrl+wheel and the buttons zoom, a zoomed photo pans, and the
controls float over the bottom (glass panel surface, pill, above `env(safe-area-inset-bottom)`)
instead of a bar of their own. In fill the image viewer is focusable (named by `alt`) and takes
`+`/`-`/`0`; the PDF viewer adds a Fit button. Without `fill`, a viewer in a parent that gives no
height is 60% of the screen (`--ui-image-viewer-min-height`, `--ui-pdf-viewer-min-height`), still
within a parent that does give one, and the photo is fitted to its stage whatever its size.

## Compact tinted tiles (`ui-feature-card`, 0.38)

Two shortcut tiles under a chat bar, together exactly its width and equal in height:

```html
<ui-input placeholder="Describe how you feel" ariaLabel="Ask" />
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3)">
  <ui-feature-card size="sm" surface="tinted" radius="control" trailingArrow [descriptionLines]="2"
    tone="primary" title="Find a doctor" description="Book a clinic visit near you." (action)="open('doctors')">
    <hugeicons-icon feature-icon [icon]="StethoscopeIcon" />
  </ui-feature-card>
  <ui-feature-card size="sm" surface="tinted" radius="control" trailingArrow [descriptionLines]="2"
    tone="accent" title="Nurse at home" description="A nurse comes to you." (action)="open('nurse')">
    <hugeicons-icon feature-icon [icon]="AmbulanceIcon" />
  </ui-feature-card>
</div>
```

- `size="sm"`: 16px padding, 40px badge with a 20px icon, body-strong title, small description.
- `surface="tinted"`: a soft wash in the tone (8% over the surface with 4% of the text), no border,
  a shadow only on hover; muted and primary words are deepened a quarter towards the text colour so
  they stay AA on the wash in every theme. `glass` is ignored.
- `trailingArrow` (without `actionLabel`): the whole card is one `<button>` (`<a>` with `href`)
  named "title, description", with a small arrow that points the reading way, at the end of the
  badge row in the vertical layout (the end of the title row when horizontal or without an icon).
- `radius`: `true` (card radius), `false` (square) or `'control'` (an input's `--ui-radius`;
  square when `UiConfig.radius` is off, like the input).
- `descriptionLines`: clamp the description with an ellipsis.

The Flutter twin: `UiFeatureCard(size: UiSize.sm, surface: UiFeatureSurface.tinted,
controlRadius: true, trailingArrow: true, descriptionLines: 2, onPressed: ...)`, two of them in an
`IntrinsicHeight` + stretched `Row`.

## Full-screen map page (`ui-map`, 0.39)

A map behind the whole page, the form in a bottom sheet, a status card at the top, and soft rings
on the map while the app looks for someone:

```html
<div class="page"> <!-- position: fixed; inset: 0 -->
  <ui-map fill [center]="home" [zoom]="15" [markers]="nurses" [pin]="home" [pinDraggable]="false"
    [pulse]="{ lat: home.lat, lng: home.lng, active: searching() }"
    [insets]="{ top: cardCover(), bottom: sheetCover() }" />
  <ui-floating-panel placement="top" ariaLabel="Status" (coverChange)="cardCover.set($event)">
    <span role="status">{{ searching() ? 'Looking for a nurse near you' : 'Where should the nurse come?' }}</span>
  </ui-floating-panel>
  <ui-bottom-sheet title="Find a nurse" [snaps]="[0.42, 0.75]" [(snap)]="snap" [closable]="false"
    (coverChange)="sheetCover.set($event)">…</ui-bottom-sheet>
</div>
```

- `pulse: UiMapPulse | null` (`{ lat, lng, tone?: UiStatus = 'primary', active?: boolean = true }`):
  three rings, 0.8s apart in a 2.4s loop, growing to 120px as they fade, in the tone at low
  opacity. They live in their own Leaflet pane above the tiles and below the markers and the pin,
  move with the map, never take a click, and say nothing to screen readers (put the words in the
  status card). Under reduced motion: one still 72px halo. `active: false` or `null` removes them.
- `insets: UiMapInsets` (`{ top?, bottom?, start?, end? }` in px; start/end follow the direction):
  the map still draws edge to edge, but `center`, the pin's Enter-to-centre, `centerChanged`, the
  zoom buttons' zooming, and the zoom and attribution controls use the part between the insets.
  When the insets change (the sheet moves to another snap) the map pans, over 0.32s, so the point in
  the middle of the old visible part sits in the middle of the new one; no pan under reduced motion.
- `fill`: the map fills its parent's height with square corners.
- `ui-floating-panel (coverChange)`: px of the parent's edge the card covers (gutter plus height);
  `ui-bottom-sheet (coverChange)`: px of the screen bottom the sheet covers once it settles.
- A sheet with no 0 snap, like `[0.42, 0.75]` here, is `persistent()` (0.39.1): it never closes.
  Escape (and `close()`) collapse it to its smallest snap and keep focus inside; at that snap Escape
  does nothing. The sheet leaves browser history alone, so the browser's Back button always leaves
  the page. A sheet with a 0 snap still closes on Escape and hands focus back.
- `ui-bottom-sheet [maxWidth]` (0.39.1, a number in px or a CSS length, default `null` = full
  width): on a wider screen the sheet (surface, handle, title row and body) is that wide and
  centred (`margin-inline: auto`, so RTL is the same); the backdrop still covers the whole screen
  and `coverChange` still reports the covered height. The demo uses 560, for tablets and desktops.
- The map is its own stacking context (`isolation: isolate`), the card sits above it (`z-index: 1`)
  and the sheet on the overlay layer, so both stay usable over it and the map pans around them.
- `glass` (0.41.2) on `ui-bottom-sheet` (default `false`, not set by `UiConfig.glass`) and
  `ui-floating-panel` (default `UiConfig.glass`), e.g. `<ui-bottom-sheet glass …>`: a see-through
  frosted surface over the map. `--ui-glass-sheet-bg` (the theme's surface at
  `--ui-glass-sheet-tint`, 0.6) over `backdrop-filter: var(--ui-glass-sheet-filter)`, which blurs
  (`--ui-glass-sheet-blur`, 20px) and maps every backdrop channel into the theme's
  `--ui-glass-sheet-floor`..`--ui-glass-sheet-ceiling` first. Each theme sets that range so text,
  muted text, primary and status colours keep WCAG AA over pure white and pure black (the
  style-contract spec checks all 15 themes); the colourful light palettes need a narrow one, so the map
  shows through faintly there. Fields and buttons inside keep their solid backgrounds. Solid surface
  where `backdrop-filter` isn't supported and under `prefers-reduced-transparency: reduce` or
  `prefers-contrast: more`. An app theme of its own should set the floor and ceiling too (light:
  floor high, ceiling 1; dark: floor 0, ceiling low) and check its colours.
- `glassStrength` (0.41.3) on both, `'clear'` (default) or `'frosted'`. The 0.41.2 recipe above is
  `'frosted'`: AA over anything, but over a real map it reads as near-opaque. `'clear'` is made for a
  map in the theme's own brightness (light tiles under a light theme, dark tiles under a dark one):
  `--ui-glass-clear-bg` (the surface at `--ui-glass-clear-tint`, 0.12) over
  `--ui-glass-clear-filter`, a 3px blur (`--ui-glass-clear-blur`), the squeeze into the theme's
  `--ui-glass-clear-floor`..`--ui-glass-clear-ceiling`, then `saturate(1.8)`
  (`--ui-glass-clear-saturate`) so water and parks stay apart. The range is set per theme only as far
  as text, muted text, primary, success and danger (4.5:1) and icons and warning (3:1) need over the
  colours MapTiler's dataviz / dataviz-dark draw Malé in (the style-contract spec checks all 15
  themes), so 43-75% of the map's own contrast comes through (maldives 48%, maldives-dark 75%),
  against 5-17% frosted. Over photos or a map in the other brightness use `glassStrength="frosted"`.

The Flutter twin: `UiMap(fill: true, pulse: UiMapPulse(lat:, lng:, active:), viewInsets:
EdgeInsetsDirectional.only(top:, bottom:))`, with `UiFloatingPanel.onCoverChanged` and
`UiBottomSheet.onCoverChanged`, and `glass: true` on both (solid under `MediaQuery.highContrast`, as
Flutter has no reduce-transparency setting).

## Routes and fit to points (`ui-map`, 0.42)

```html
<ui-map #map fill [insets]="{ top: cardCover(), bottom: sheetCover() }" [userLocation]="me()" [markers]="[patient]"
  [routes]="[{ id: 'to-patient', points: route.points, tone: 'primary', label: 'Route, 1.2 km' }]" />
```
```ts
// OSRM GeoJSON is [lng, lat]: swap it. Points are [lat, lng] or { lat, lng }.
this.map().fitPoints([me, patient, ...route.points], { padding: 24, maxZoom: 17 });
```

- `routes: UiMapRoute[]` (`{ id, points, tone?: 'primary' | 'muted' | 'success' | 'warning' | 'danger', label? }`):
  each a line in `--ui-map-route-<tone>` over `--ui-map-route-casing`, round caps and joins, 5px over
  9px from zoom 14 in and down to 60% at zoom 10 (`uiMapRouteWidth`). In a pane above the tiles and
  below the pulse, the dot, markers and pin; never hit. A new list moves, recolours or removes the
  lines already drawn (the map is not rebuilt); `[]` removes them. `label` names the line for screen
  readers (`role="img"`); without it the line is hidden. The tones default to the theme's primary,
  text-muted and status colours; themes where those don't hold 3:1 against MapTiler's streets-v2 and
  dataviz tiles (in the theme's own brightness) and the casing set their own (the style-contract spec
  checks all 15 themes).
- Draw-in (0.46.2): a route that appears, or gets new points, grows from its start to its end, casing
  and line together, ease-out (`uiMapRouteEase`) over `uiMapRouteDrawMs(uiMapRouteLength(points))`
  (450 ms for 1 km, +150 ms per doubling, within 250..900 ms). The same id and points again never
  replay it. `animate: false` on a route draws it at once, as do reduced motion and `preview`. A
  removed route fades out over `UI_MAP_ROUTE_FADE_MS` (150 ms), at once under reduced motion.
  `uiMapRoutePartial(points, fraction)` is the part shown at each frame.
- `fitPoints(points, { padding = 24, maxZoom = 17, animate = true })`: every point inside the part
  between the insets less the padding (px, or `{ top, right, bottom, left }`), at a whole zoom up to
  maxZoom; one point is centred there at maxZoom. Animated unless `animate: false` or reduced motion.
  `uiMapFitView(points, size, area, maxZoom)` is the same sum, returning the map's centre and zoom.
- Marker labels: sized to their text up to `--ui-map-label-max` (min(320px, the map's width less
  32px), set by the map), two lines before the ellipsis. Zoom buttons: the locate button's surface,
  border and `--ui-shadow-2`, 38px (44px with a 48px hit area on touch).

Turning the map (0.47.0): `[bearing]` (degrees clockwise from north at the top) turns it about the middle of the
visible part; `rotatable` (true) lets two fingers turn it once they twist 15 degrees before the pinch zooms 10% or
pans 30 px (`uiMapTwoFingerGesture`), or Alt + drag with a mouse (Shift + drag stays the box zoom). While turned,
a compass button (`compass`, true) sits under the zoom buttons; a click eases north up and emits `(bearingChange)`
0, which also reports the end of every turn. `rotateTo(b)` turns it from code. Markers, the pin and the area handle
stay upright; routes and dots turn with the map. `userLocation.heading` draws an arrow puck. `zoomButtons` false
hides the zoom buttons, `(userMove)` says the person moved the map, `UiMapRoute.opacity` dims a line.

Navigation (0.47.0): `<ui-map-navigation [route] [steps] [position] (announce) (offRoute) (arrived) (end)>` with
`UiNavTracker`, `uiNavFormatDistance` / `uiNavFormatDuration` / `uiNavFormatClock` and the maneuver icons
(`uiNavIconKind`, `uiNavIcon`, `UI_NAV_ICONS`); see the showcase's Navigation section.

The Flutter twin: `UiMap(routes: [UiMapRoute(id:, points:, tone: UiMapRouteTone.primary, semanticLabel:, animate: true)])`
and `UiMapState.fitPoints(points, padding: EdgeInsets?, maxZoom:, animate:)`.

## Map search area, swipe screens, SOS fab (0.44.0)

```html
<ui-swipe-screens [(index)]="screen">
  <ui-swipe-screen label="Chat"> … </ui-swipe-screen>
  <ui-swipe-screen label="Map" edgeSwipeOnly>
    <ui-map #map fill [center]="home" [zoom]="12"
      [area]="{ lat: home.lat, lng: home.lng, radiusMeters: radius(), editable: true, minMeters: 500, maxMeters: 30000 }"
      areaLabel="Search radius" (areaChanging)="live.set($event)" (areaChange)="radius.set($event)" />
  </ui-swipe-screen>
</ui-swipe-screens>
<ui-fab label="SOS, call for help" position="top-center" tone="danger" text="SOS" aboveOverlays>…</ui-fab>
```

- **`ui-map [area]`** (`UiMapArea`: `lat`, `lng`, `radiusMeters`, `tone?`, `editable?`, `minMeters?` 200,
  `maxMeters?` 50000): a soft circle in its tone (12% fill, a 2px line over a 4px casing), in true
  metres (`radiusMeters / uiMapMetersPerPx(lat, zoom)` px), under the routes, markers and pin; the map
  pans and zooms through it. `editable` adds a round handle on the inline-end edge (east; west in RTL),
  a 48px target with a radius chip ("20 km", `uiMapFormatRadius`). Dragging it changes the radius
  (`uiMapNiceRadius`: 10 m / 100 m / 1 km steps, clamped) without panning the map, emitting
  `(areaChanging)` per change and `(areaChange)` on release. It is a `role="slider"` named `areaLabel`
  (the `mapSearchArea` string): ArrowUp and the outward arrow +about 10% (`uiMapAreaStep`), ArrowDown and
  the inward arrow -10%, Home / End to min / max, each step emitting both. No handle on a preview.
  `fitArea(options?)` fits the whole circle (`fitPoints` options). Flutter: `UiMap(area: UiMapArea(...),
  onAreaChanging:, onAreaChanged:, areaLabel:)` and `UiMapState.fitArea()`.
- **`ui-swipe-screens [(index)]`** (`@zouriel/ui/layout`) with `ui-swipe-screen label [edgeSwipeOnly]`
  children: full-height screens, screen i+1 at the inline end. Drags follow the finger and snap (a
  400 px/s fling or past half the width, `uiSwipeTarget`; instant under reduced motion); only clearly
  horizontal drags are taken; on screen 0 a drag within `leadingEdgeExclusion` (24px) of the leading
  edge is left to the app's drawer; an `edgeSwipeOnly` screen keeps its drags and swipes back only from
  a 24px strip (`edgeWidth`) on its leading edge. Setting `index` animates; screens out of view stay
  alive but are `inert` and `aria-hidden`; the screen that comes in is announced. Flutter:
  `UiSwipeScreens(screens: [UiSwipeScreen(...)], index:, onIndexChanged:)`.
- **`ui-fab`**: `position` gains `top-start` / `top-center` / `top-end` / `bottom-start` /
  `bottom-center` / `bottom-end` (safe-area aware: a top fab sits below the status bar); `tone="danger"`
  is the high-visibility SOS style (danger fill, a raised-surface ring and a danger halo); `text` adds a
  visible word (a pill); `aboveOverlays` puts it at `--ui-z-overlay` + 1, over sheets and drawers;
  `topOffset` (px) puts a top fab under the app's own top bar. Hold to activate: import `UiFabHold`
  from `@zouriel/ui/hold-button` (it lives there because the confirm dialog does) and add
  `[hold]="2000"` with `confirmTitle` / `confirmMessage` / `confirmLabel` / `destructive` / `holdHint`
  and `(confirmed)`: `ui-hold-button`'s behaviour (the shared `UiHoldPress`), a contrast-colour fill
  growing from the inline start, a tap or screen-reader activation opening the confirm dialog.
- **`[badge]`** on `ui-button` and `ui-icon-button`: a count bubble at the top-end corner (the bottom
  nav's look), `badgeTone` 'danger' | 'primary', hidden from screen readers and added to the name
  (`badgeLabel`, else its text: "Chat, 2 unread"). `uiBadgeCount(n, max = 9)` from `@zouriel/ui`
  gives null / "1".."9" / "9+".
- **`ui-bottom-sheet [sheet-footer]`**: a footer pinned to the bottom of the visible sheet at every
  open snap (the body scrolls above it, top hairline, safe area below, part of `coverChange`, on the
  keyboard with the sheet); a snap too short for the header and footer is raised to fit them.
- **`ui-floating-panel [insetEnd]`**: px kept free at the inline end on top of the gutter (mirrored
  in RTL), room for a top-end fab beside the card.

## Map background tap (`ui-map`, 0.43.1)

```html
<ui-map [markers]="results" [selectedMarkerId]="selected()?.id ?? null"
  (markerSelected)="selected.set($event)" (mapTap)="selected.set(null)" />
```

`(mapTap)` emits the background point as `UiLatLng`, inside the Angular zone. It does not emit for
a marker, the pin, zoom/locate/app controls, attribution, preview mode, a
drag, or double-click zoom; the user-location dot counts as background. In `pinMode`, a background tap keeps moving the pin and also emits
`(mapTap)`; Enter moves the pin without pretending there was a tap. The Flutter twin is
`UiMap(onMapTap: (point) { ... })` with the same hit-testing rules.

## Map preview, selected marker, label modes (`ui-map`, 0.43.0)

```html
<!-- A result card's Map tab: a still map; clicking it opens the full map. -->
<ui-map preview [markers]="results" markerLabels="none" (previewPress)="openResultsMap()" />

<!-- The full map: a tapped pin is the selected one, and only its label shows. -->
<ui-map fill [markers]="results" [selectedMarkerId]="selected()?.id ?? null" markerLabels="selected"
  (markerSelected)="selected.set($event)" />
```

- `preview`: a still picture of the map that is one native `<button class="ui-map-preview">` over it.
  Every Leaflet handler is off (drag, pinch, double-click and wheel zoom, box zoom, keys), the zoom,
  locate and app buttons are not drawn, and the canvas is `inert` and `aria-hidden`: the markers are
  drawn but take no clicks or focus, and the attribution stays visible (the tile licence) but is not a
  link. The button never cancels the wheel and has `touch-action: manipulation`, so the page scrolls
  over it. A click, Enter or Space emits `(previewPress)` once. Its name is `previewLabel`, else the
  `mapOpen` string ("Open map", from `provideUiStrings`). A pointer cursor, an 8% text-colour wash
  while pressed, the focus ring inside the edge, and a 30px round expand badge (`ArrowExpand01Icon`)
  in the map controls' raised style at the top-end corner (top-left in RTL). `center`, `zoom` and
  `fitPoints` still place it, without animating. Turning `preview` off gives the full map back on the
  same Leaflet map.
- `selectedMarkerId: string | null`: that marker gets `data-selected` (a 22px dot, `UI_MAP_SELECTED_DOT`,
  with a `--ui-color-location-ring` ring and a 6px halo at 30% of its tone, still centred on its point),
  rises above the others (`zIndexOffset` 500) and is `aria-pressed="true"`, the others `"false"` (no
  `aria-pressed` without a selection). Changing it updates the markers in place: no rebuild, no move.
- `markerLabels: 'all' | 'selected' | 'none'` ('all' by default): labels the mode hides get
  `data-label-hidden` (not drawn); every marker keeps its `aria-label` (`ariaLabel`, else `label`).
  `uiMapLabelShown(mode, selected)` is the rule. 'none' hides the selected marker's label too.

The Flutter twin: `UiMap(preview: true, onPreviewPressed:, previewLabel:, selectedMarkerId:,
markerLabels: UiMapMarkerLabels.selected)` and `UiStrings.mapOpen`.

## Map controls, a fit that holds, labels off the edge (`ui-map`, 0.42.1)

```html
<ui-map #map fill [insets]="{ top: cardCover(), bottom: sheetCover() }" locateControl (locate)="findMe()"
  [controls]="[{ id: 'fit', icon: CenterFocusIcon, label: 'Show both', tooltip: 'Show both' }]"
  (controlPress)="map.fitPoints([me(), patient])" />
```

- A fit owns the camera: when `insets` change while `fitPoints` animates or after it (a sheet growing
  as the route appears), the fit is worked out again for the new insets instead of panning by the
  inset difference, so the points stay inside the visible part. While Leaflet is mid-zoom (it drops
  a `setView` then) the new fit runs once it lands. The fit lets go when anything else moves the map:
  a drag, the wheel, a double click, a pinch, the arrow or +/- keys, the zoom buttons, `flyTo` or a
  new `center` / `zoom`; after that inset changes pan as before.
- `controls: UiMapControl[]` (`{ id, icon, label, tooltip?, disabled? }`, the icon a hugeicons object
  imported one file per icon): round buttons with the locate button's surface, border and
  `--ui-shadow-2`, 38px (44px with a 48px hit area on touch), stacked 8px apart above the locate
  button at the bottom-end of the visible part (in its place without one), following the insets and
  at the bottom-left in RTL; the tooltip faces into the map. `(controlPress)` emits the pressed control
  (never while `disabled`). There is no built-in "Show all" control: `fitPoints` in the handler is one
  line, and the app knows which points (and which words) it means.
- Marker labels sit 12px from the point at the inline end of the dot (right; left in RTL) and flip to
  the other side when they would run off the map there (8px to spare), re-checked as the map moves;
  `uiMapLabelSide(x, labelWidth, mapWidth, rtl)` is the rule, and the marker gets `data-side`.

The Flutter twin: `UiMap(controls: [UiMapControl(id:, icon:, semanticLabel:, onPressed:, tooltip:)])`
and `uiMapLabelSide(x, labelWidth, mapWidth, rtl:)`.

## Chat bubbles in any parent (`ui-chat-bubble`, 0.42.2)

A bubble takes the whole row whatever its parent aligns: a column with `align-items: flex-start`,
`flex-end` or `center`, a flex row, a grid with `justify-items: start`. Yours still sit at the
inline end and theirs at the inline start (mirrored in RTL), and text wraps at 80% of the row.
Before, such a parent shrank the bubble to its own text, the 80% resolved against that, and
`overflow-wrap: anywhere` broke short words ("ok/ay"). Words now wrap whole
(`overflow-wrap: break-word`); a word too long for 80% of the row (a URL) breaks only where it would
overflow. No app change is needed; app-side workarounds (stretching the column) can go.

**Yours on the right in both directions (0.46.3).** By default your own messages sit at the inline
end, so the left in RTL. `mineSide="right"` keeps them on the right and the other side's on the left
in LTR and RTL; the tucked corners and the meta line follow, laid out as in LTR, and the text takes its
own direction (`dir="auto"`: Thaana right to left, Latin left to right). Set it once for the app:

```ts
provideUiConfig({ chatMineSide: 'right' });            // or per bubble: mineSide="right" | "end"
```

The Flutter twin: `UiChatBubble(mineSide: UiChatBubbleSide.right)` and
`UiConfig(chatMineSide: UiChatBubbleSide.right)`.

## Map tiles, my location and the "you are here" dot (`ui-map`, 0.40)

```html
<ui-map fill [insets]="{ top: cardCover(), bottom: sheetCover() }"
  tileUrl="https://api.maptiler.com/maps/dataviz/256/{z}/{x}/{y}{r}.png?key=…"
  tileUrlDark="https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}{r}.png?key=…"
  attribution="&copy; MapTiler &copy; OpenStreetMap contributors"
  locateControl [locating]="locating()" [locateOff]="denied()" (locate)="findMe()"
  [userLocation]="me()" />
```

- `tileUrlDark: string | null` (default null): on a dark theme these tiles are shown as they are (no
  dimming filter; the host gets `data-dark-tiles`). The map swaps between `tileUrl` and
  `tileUrlDark` the moment the theme changes, by changing the URL of the same tile layer (no map
  rebuild). Without it, dark themes dim the light tiles as before. `{r}` in either URL is `@2x` on a
  high-density screen and empty otherwise (Leaflet's own placeholder). `tileSize` (256) and
  `zoomOffset` (0) are for 512 px tiles: 512 and -1. Serve keys from your API, not the bundle.
- `locateControl`: a round button (38px, 44px on touch screens with a 48px hit area centred on it
  since 0.40.1; the zoom buttons get the same 48px hit area; raised surface, shadow) at the
  bottom-end corner of the visible part: `bottom: insets.bottom + 32px`, `inset-inline-end:
  insets.end + 12px`, so it floats just above a bottom sheet and moves with it (and sits above the
  attribution). Named `mapLocate` ("Show my location"), hugeicons `Gps01Icon`. It emits `(locate)`.
  `locating`: a spinner instead of the icon, `aria-busy`, presses do nothing. `locateOff`:
  `GpsOff01Icon` (struck through), `aria-description` and tooltip `mapLocationOff` ("Location is
  off"); presses still emit so the app can ask for permission again.
- `userLocation: UiMapUserLocation | null` (`{ lat, lng, accuracy? }`, accuracy in metres): a 16px
  dot in `--ui-color-location` (#1a73e8 in every theme) with a 3px white ring (`--ui-color-location-ring`), over a soft halo
  `uiMapAccuracyPx(accuracy, lat, zoom)` px across (twice the accuracy in metres at that zoom,
  clamped to 28..240; none without an accuracy), redrawn on zoom. Its own pane above the tiles and
  the pulse, below the markers and the pin; `role="img"` named `mapYourLocation` ("Your location").
- `flyTo(point, zoom?)`: moves the map so the point sits in the middle of the visible part (between
  the insets); animated unless reduced motion. The app does the geolocation itself.
- The attribution is always laid out left to right (`dir="ltr"`, `unicode-bidi: isolate`, 0.40.1),
  so "© MapTiler © OpenStreetMap contributors" reads correctly on an RTL page; it still sits at the
  inline end (bottom-left in RTL).

The Flutter twin: `UiMap(tileUrlDark:, tileDimension:, zoomOffset:, locateControl: true, locating:,
locateOff:, onLocate:, userLocation: UiMapUserLocation(lat, lng, accuracy: 30))` and
`UiMapState.flyTo`; `tileHeaders` go with both the light and the dark tiles.

## Bottom sheet while typing (`ui-bottom-sheet`, 0.40)

- An index past the end of `snaps` reads as the last snap, never as closed. When `snaps` changes and
  the app didn't move `snap` with it, the sheet stays at the snap nearest the height it rested at,
  and `snap` follows. (An app that sized its snaps to the viewport lost a snap when the keyboard
  shrank the window; the sheet read as closed, went inert, blurred the field, the keyboard dropped,
  the snaps came back and the sheet re-opened, over and over.)
- `expandOnFocus` raises the sheet once per field: focus coming straight back to the same field
  (within 600 ms of leaving the sheet) doesn't raise a sheet the person lowered.
- The visual viewport is read in whole px; a pan only moves the sheet with the visible area.

## Feature card colours and motion (`ui-feature-card`, 0.39)

```html
<ui-feature-card size="sm" surface="tinted" radius="control" trailingArrow [descriptionLines]="2"
  [colors]="{ surface: '#E1F4EF', accent: '#4B8791' }" enter [enterDelay]="0"
  title="Nurse at home" description="A nurse comes to you." (action)="open('nurse')">…</ui-feature-card>
<ui-feature-card … [colors]="{ surface: '#E5F0FA', accent: '#4B8791' }" enter [enterDelay]="90"
  title="Prescriptions" description="Order and refill your medicines.">…</ui-feature-card>
<ui-feature-card … tone="accent" badgeTone="primary" title="Book a clinic">…</ui-feature-card>
```

- `badgeTone`: the badge's own tone (tint and icon); the card's `tone` when left out.
- `colors: UiFeatureCardColors` (`{ surface, accent, surfaceDark?, accentDark? }`, hex or rgb
  strings): `surface` is the card's background (no border at rest); `accent` is the badge tint (14%
  over the surface), the icon, the arrow and the border on hover and focus. The action words and
  eyebrow use the accent deepened until 4.5:1; the title and description keep the theme's text
  colours (the description moved towards the text until 4.5:1). On a dark theme (surface luminance
  under 0.2) a missing `surfaceDark` is the accent 18% into the theme's surface and a missing
  `accentDark` is the accent lightened until 4.5:1 on it and 3:1 on its badge. Invalid strings fall
  back to the tone, with a warning in dev mode. Wins over `tone` and `badgeTone`. The sums are
  exported (`uiResolveFeatureColors`, `uiParseColor`, `uiContrast`) and match Flutter exactly.
  Both cards get the same derived dark surface, since it comes from the shared accent: pass
  `surfaceDark` to keep them apart on dark themes.
  The dark/light choice comes from the theme in effect at the card (its computed tokens), read again
  after the first render and whenever they can change: a `data-theme` anywhere, a class or inline
  style on the card or an ancestor, a stylesheet added or finishing loading, and the device's
  `prefers-color-scheme` (0.40.2; before, a card created while a critical-CSS build was still loading
  its stylesheet kept the inlined Winter Dark tokens until the theme was toggled). The same watcher
  is exported as `uiWatchTheme(el, destroyRef, check)` and also drives the Google button's auto theme
  and the map's dark tiles.
- `enter` / `enterDelay` (ms): a fade and 8px rise over `--ui-motion-slow` (decelerate), once,
  when the card first appears; stagger cards with the delay. Not replayed on re-render or a theme
  change.
- On hover, keyboard focus and press the badge icon lifts 2px and grows 8% and the trailing arrow
  nudges 3px towards the end (flipped in RTL). Under reduced motion none of this moves.

The Flutter twin: `UiFeatureCard(badgeTone:, colors: UiFeatureCardColors.tryParse(surface: '#E1F4EF',
accent: '#4B8791'), enter: true, enterDelay: Duration(milliseconds: 90))`.

## License

MIT

## Built-in strings

The library's own words (names of icon-only buttons, default labels and placeholders, date names) are
English by default. Since 0.46.0 every component reads them live:

```ts
import { provideUiStrings, uiStringsDv, UiStringsService } from '@zouriel/ui';

providers: [provideUiStrings(uiStringsDv)]       // the complete Dhivehi set
// or partial: provideUiStrings({ close: 'ބަންދުކުރޭ' }) — the rest stay English

inject(UiStringsService).set(uiStringsDv);     // switch at runtime, no reload
inject(UiStringsService).set({});              // back to English
inject(UiStringsService).patch({ close: '…' }); // change a few, keep the rest
```

The keys (same in Flutter's `UiStrings`, which has `UiStrings.dv`): `close`, `dismiss`, `clear`, `clearAll`,
`clearSearch`, `previousPage` / `nextPage`, `previousMonth` / `nextMonth`, `chooseDate`, `moreActions`,
`uploadLabel` / `uploadHint`, `holdHint`, `confirmTitle`, `confirm`, `cancel`, the map's `zoomIn` / `zoomOut` /
`placePinAtCentre` / `mapLocate` / `mapLocationOff` / `mapYourLocation` / `mapOpen` / `mapSearchArea` /
`mapRadiusMeters` / `mapRadiusKilometers` / `mapShowBoth` / `mapLabel` / `mapChosenLocation`, the Google
wordings, the sidebar's `sidebarToggle` / `sidebarClose` / `sidebarLabel`, and (0.46.0) `loading`, `previous`,
`next`, `previousSlide`, `nextSlide`, `goToSlide`, `carousel`, `imageViewer`, `previousImage`, `nextImage`,
`resetView`, `fit`, `fitPage`, `fitToView`, `doubleTapToZoom`, `play`, `pause`, `seek`, `volume`,
`playbackSpeed`, `fullscreen`, `video`, `mediaSet`, `path`, `open`, `previewUnavailable`, `emptyFolder`,
`loadingPdf`, `pageControls`, `page`, `pageOf`, `pagination`, `resizePanes`, `resize`, `breadcrumb`,
`showMore`, `onThisPage`, `otpLabel`, `otpDigit`, `remove`, `showPassword`, `hidePassword`, `pickColor`,
`hexColor`, `hue`, `commandPalette`, `commandPlaceholder`, `noResults`, `searchPlaceholder`,
`selectPlaceholder`, `datePlaceholder`, `chooseTime`, `previousYear` / `nextYear` / `previousYears` /
`nextYears`, `monthsOf`, `yearsRange`, `dateRange`, `emptyHeading`, `noData`, `empty`, `selectAll`,
`selectAllRows`, `selectRow`, `actions`, `options`, `tabs`, `progress`, `rating`, `meterWarn`, `meterDanger`,
`decrease`, `increase`, `addTag`, `menu`, `showMenu`, `move`, `dragHint`, `rotate`, `playhead`,
`dragToReorder`, `adding`, `today`, `notSet`, `chooseMonth`, `chooseYear`, `opensCalendar`, `opensTimePicker`,
`hours`, `minutes`, `seconds`, `cut`, `copy`, `paste`, `delete`, `lookUp`, `searchWeb`, `share`, `scanText`,
`fieldRequired`, `thisField`, `sheetSmaller`, `sheetLarger`, `navigationOpen`, `currentStep`, `upcoming`, `openImage`,
`image`, `meter`, `chosenFiles`, `slider`. A few are used by only one library (the doc comment on each key says which);
both define all of them. `{n}`, `{total}`, `{label}`, `{start}`, `{end}` are filled in
(`uiFormatString(template, params)`).

Date names: `locale` ('' = the app's `LOCALE_ID`; never the browser default), `months`, `monthsShort`,
`weekdays`, `weekdaysShort` (Sunday first), `firstDayOfWeek` (null = the locale's first day, Sunday when it
says nothing), `dateFormat`, `dateFormatShort`, `monthYearFormat` (`{d} {month} {y}`). Empty arrays and
formats take everything from Intl; `uiStringsDv` carries Dhivehi names, since Intl has no `dv` data, and starts
the week on Sunday (the Maldivian work week). An `en-GB` app's calendars now start on Monday.

A component's own input for a word wins (a `placeholder`, `ui-file-upload` `label` / `hint`,
`ui-split-button` `menuLabel`, `ui-confirm-dialog` `title`). Inputs that used to default to English text
(`placeholder`, `label`, `heading`, `selectAllLabel`, the meter's `warnText` / `dangerText`, …) now default to
`undefined` and fall back to the built-in word.

Still English (0.46.0): the form builder's and workflow editor's interface text (many strings; separate
work), and a few rarely used names: the window's Minimize / Maximize / Restore, the media lightbox's Mute /
Unmute / Full screen / Exit full screen / Media viewer / Item N, the image viewer's Image controls /
Clip controls, the sequencer's keyframe, lock and hide names, the transform box's Selected element, the
anchor picker's and choice grid's default group names (Point, Choices) and the tree table's Name heading.

## Right to left and Dhivehi

Every component mirrors under `dir="rtl"` (0.46.0): logical insets, paddings, borders and corners;
`ui-drawer side="start" | "end"` and `ui-toast-host position="…-start" | "…-end"` (the default is now
`bottom-end`) slide in from that edge; chevrons that mean back and forward point the other way (play, check,
search and logos don't); arrow keys in tabs, segmented, rating, choice grid, tree, menubar, splitter, gallery
and the date picker move the way the row reads; the switch turns on toward the inline end; the chat bubble's
own messages sit at the inline end with the tucked corner mirrored (`mineSide="right"` keeps them on the right); the slider fills from the right; the
indeterminate progress bar, skeleton shine and marquee run right to left. The map itself doesn't mirror: the
zoom buttons sit at the inline start, the locate and app buttons and the credits at the inline end, and a
label starts on the dot's inline end. An OTP code, code blocks and the code viewer stay left to right.

An app's language toggle:

```ts
const dir = inject(UiDirectionService);
const strings = inject(UiStringsService);
dir.set('rtl', 'dv');          // <html dir="rtl" lang="dv">; the CDK Directionality is kept in step
strings.set(uiStringsDv);
```

`UiDirectionService` also follows `<html dir>` when the app sets it itself; what a script places (map
controls, CDK overlays such as the date picker) moves at once, the rest through CSS. Slides that follow the
text direction multiply their travel by `--ui-inline-sign` (1, or -1 under `dir="rtl"`, from animations.css);
`UI_ANIM.slideFromStart` / `slideFromEnd` are the logical enter/leave classes. Helpers: `uiIsRtl(el)`,
`uiLogicalKey(event)`.

Thaana text draws in the app's font: put it first in `--ui-font-default` (and `--ui-font-display`), e.g.
`Faruma, 'Poppins', system-ui, sans-serif`. Every component draws with those tokens (the Google button keeps
Google's Roboto first and falls back to them).

Since 0.46.1 a `ui-badge` under `:lang(dv)` or `:dir(rtl)` grows to fit Thaana's marks below the line (the
font's own line height plus 1px, 20px minimum); give a Thaana badge in an English page `lang="dv"`. A text field
with `dir="auto"` keeps `dir` off its native control while empty, so its placeholder follows the page.
