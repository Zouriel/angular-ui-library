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
| `map` | OpenStreetMap map with markers, a pin, a "searching" pulse and view insets for full-screen map pages (Leaflet, loaded on first use; install `leaflet` ~1.9.4) |
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
- The map is its own stacking context (`isolation: isolate`), the card sits above it (`z-index: 1`)
  and the sheet on the overlay layer, so both stay usable over it and the map pans around them.

The Flutter twin: `UiMap(fill: true, pulse: UiMapPulse(lat:, lng:, active:), viewInsets:
EdgeInsetsDirectional.only(top:, bottom:))`, with `UiFloatingPanel.onCoverChanged` and
`UiBottomSheet.onCoverChanged`.

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

The library's own words (names of icon-only buttons, default labels) are English. Replace them with
`provideUiStrings({ … })` (partial; the rest stay English): `close` (modal, drawer, bottom sheet),
`dismiss` (toast, alert, hint), `clear` (combobox), `clearAll` (multi-select), `clearSearch` (search
input), `previousPage` / `nextPage` (pagination), `previousMonth` / `nextMonth` (calendar, date range
picker), `chooseDate` (date picker), `moreActions` (split button; also its `menuLabel` input),
`uploadLabel` / `uploadHint` (file upload; also its `label` / `hint` inputs), `holdHint`, `confirmTitle`,
`confirm`, `cancel` (hold button), `zoomIn` / `zoomOut` / `placePinAtCentre` (map), `googleSignIn` /
`googleSignUp` / `googleContinue` / `googleSignInShort` (Google button, and the sign-in fallback),
`sidebarToggle` / `sidebarClose` / `sidebarLabel` (sidebar layout). Flutter has the same
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
| splitter | Resize panes |
| carousel, gallery | Previous/Next slide, Previous, Next, Close, Image viewer |
| anchor nav, breadcrumbs | On this page, Breadcrumb |
| PDF viewer | Previous/Next page, Zoom in/out |
| sequencer | Playhead, Drag to reorder |
| table | Actions, Select all rows, Select row N |
| window | Close |
| form builder, workflow | their editors' interface text (many strings; separate work) |
