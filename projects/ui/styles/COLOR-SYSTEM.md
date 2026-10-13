# Winter colour system

`@zouriel/ui` ships one colour identity in two modes, built on a six-colour winter palette.

| Mode | Theme names | Mood |
|---|---|---|
| Light | `light` (default light), `winterLight` | Fresh snow, pale ice and frosted glass in winter daylight: calm Nordic architecture |
| Dark | `dark` (library default), `winterDark` | A pine forest beside a dark ocean under moonlight: a true-black ground, faintly blue-black surfaces and soft ice-blue text |

```html
<html data-theme="winterLight">   <!-- or winterDark; `light` / `dark` resolve to the same tokens -->
```

```ts
inject(UiThemeService).set('winterDark');
inject(UiThemeService).toggle(); // winterDark <-> winterLight (dark <-> light for the short names)
```

The named skins in `theme-palettes.css` (`lightPurpleGold`, `darkPurple`, …) and `theme-dark-orange.css` still work unchanged.

---

## 1. Primitive palette

Primitives are named `--ui-winter-*`. Components never read them; only the theme blocks in `tokens.css` do.

### Reference colours

| Token | Hex | Name |
|---|---|---|
| `--ui-winter-black-pine` | `#152026` | Black Pine |
| `--ui-winter-deep-ocean` | `#1b3d59` | Deep Ocean |
| `--ui-winter-windstorm` | `#6a97c0` | Windstorm |
| `--ui-winter-melting-ice` | `#b3d5f1` | Melting Ice |
| `--ui-winter-avalanche` | `#d4eef8` | Avalanche |
| `--ui-winter-sun-beam` | `#f3eed8` | Sun Beam |

### Scales

| Scale | Steps |
|---|---|
| Pine | 950 `#152026` (Black Pine) · 900 `#19262e` · 850 `#1c2c37` |
| Night (dark-mode ground and surfaces) | 1000 `#000000` · 950 `#06080a` · 900 `#0b0f12` · 850 `#11171c` · 800 `#1a232a` · 700 `#26323b` |
| Blue (ocean → ice → snow) | 900 `#1b3d59` (Deep Ocean) · 850 `#20364a` · 800 `#264460` · 700 `#3a6488` · 500 `#6a97c0` (Windstorm) · 400 `#8bb5db` · 300 `#b3d5f1` (Melting Ice) · 100 `#d4eef8` (Avalanche) · 75 `#e3f0f7` · 50 `#eef5f9` · 25 `#f7fbfd` · white `#ffffff` |
| Slate (blue-grey neutrals) | 900 `#233441` · 800 `#2e4658` · 700 `#465d6f` · 600 `#587488` · 500 `#6c8497` · 400 `#93a6b5` · 300 `#c3d2dd` · 200 `#dae5ec` |
| Sun | 50 `#f9f7ec` · 100 `#f3eed8` (Sun Beam) · 700 `#76591a` · 900 `#34393a` |
| Status | green 700 `#2e6b50` / 300 `#8ccba9` · amber 700 `#85570f` / 300 `#e6c27d` · red 700 `#a83a3f` / 300 `#f0a3a3` |

Some reference colours fail contrast in some roles, so the palette adds these accessible variants:

- **Blue 700 `#3a6488`.** Windstorm deepened for light mode. Raw Windstorm on the light background is only about 3:1, which fails as text and as a fill behind light labels.
- **Blue 400 `#8bb5db`.** Windstorm brightened for dark mode, where it is the primary colour.
- **Sun 700 `#76591a`.** Sun Beam as readable text or an icon on light surfaces. Sun Beam itself is about 1.1:1 on snow.
- **Status 700/300 pairs.** These are desaturated and cool-leaning so they sit inside the palette. The 700 steps are for light mode and the 300 steps for dark mode.

---

## 2. Light theme tokens (`winterLight`)

| Role | Token | Value | Primitive |
|---|---|---|---|
| background.default | `--ui-color-bg` | `#eef5f9` | blue-50 |
| background.surface | `--ui-color-surface` | `#f7fbfd` | blue-25 |
| background.elevated | `--ui-color-surface-raised` | `#ffffff` | white (frosted) |
| background.subtle | `--ui-color-surface-subtle` | `#e3f0f7` | blue-75 |
| hover (surface / in panels) | `--ui-color-surface-hover`, `--ui-color-elevated-hover` | `#e3f0f7` | blue-75 |
| text.primary | `--ui-color-text` | `#152026` | Black Pine |
| text.secondary | `--ui-color-text-secondary` | `#1b3d59` | Deep Ocean |
| text.muted | `--ui-color-text-muted` | `#465d6f` | slate-700 |
| text.disabled | `--ui-color-text-disabled` | `#93a6b5` | slate-400 |
| text.inverse | `--ui-color-text-inverse` | `#eef5f9` | blue-50 |
| border.subtle | `--ui-color-border-subtle` | `#dae5ec` | slate-200 |
| border.default | `--ui-color-border` | `#c3d2dd` | slate-300 |
| border.strong | `--ui-color-border-strong` | `#6c8497` | slate-500 |
| border.focus | `--ui-color-border-focus` | `#3a6488` | blue-700 |
| brand.primary | `--ui-color-primary` | `#1b3d59` | Deep Ocean |
| brand.primary-hover | `--ui-color-primary-hover` | `#264460` | blue-800 |
| brand.primary-active | `--ui-color-primary-active` | `#152026` | Black Pine |
| on brand.primary | `--ui-color-primary-contrast` | `#f7fbfd` | blue-25 |
| brand.secondary | `--ui-color-secondary` | `#3a6488` | blue-700 |
| brand.secondary-hover | `--ui-color-secondary-hover` | `#264460` | blue-800 |
| on brand.secondary | `--ui-color-secondary-contrast` | `#f7fbfd` | blue-25 |
| accent.default | `--ui-color-accent` | `#f3eed8` | Sun Beam |
| accent.subtle | `--ui-color-accent-subtle` | `#f9f7ec` | sun-50 |
| accent.strong (text/icon) | `--ui-color-accent-strong` | `#76591a` | sun-700 |
| on accent | `--ui-color-accent-contrast` | `#152026` | Black Pine |
| status.success | `--ui-color-success` | `#2e6b50` | green-700 |
| status.warning | `--ui-color-warning` | `#85570f` | amber-700 |
| status.error | `--ui-color-danger` (hover `--ui-color-danger-hover`) | `#a83a3f` (`#922f34`) | red-700 |
| status.info | `--ui-color-info` | `#3a6488` | blue-700 |
| on status fills | `--ui-color-{success,warning,danger,info}-contrast` | `#f7fbfd` | blue-25 |
| selected tint | `--ui-color-selected` | `rgba(27,61,89,.12)` | Deep Ocean 12% |
| track | `--ui-color-track` | `#dae5ec` | slate-200 |
| overlay scrim | `--ui-color-overlay` | `rgba(21,32,38,.42)` | Black Pine 42% |

## 3. Dark theme tokens (`winterDark`)

| Role | Token | Value | Primitive |
|---|---|---|---|
| background.default | `--ui-color-bg` | `#000000` | night-1000 |
| background.surface | `--ui-color-surface` | `#0b0f12` | night-900 |
| background.elevated | `--ui-color-surface-raised` | `#11171c` | night-850 |
| background.subtle | `--ui-color-surface-subtle` | `#06080a` | night-950 |
| hover (surface / in panels) | `--ui-color-surface-hover`, `--ui-color-elevated-hover` | `#1a232a` | night-800 |
| text.primary | `--ui-color-text` | `#b3cbdc` | softened Avalanche (Avalanche glares on black) |
| text.secondary | `--ui-color-text-secondary` | `#a6c0d3` | softened Melting Ice |
| text.muted | `--ui-color-text-muted` | `#8aa4b8` | softened Windstorm |
| text.disabled | `--ui-color-text-disabled` | `#587488` | slate-600 |
| text.inverse | `--ui-color-text-inverse` | `#152026` | Black Pine |
| border.subtle | `--ui-color-border-subtle` | `#1a232a` | night-800 |
| border.default | `--ui-color-border` | `#26323b` | night-700 |
| border.strong | `--ui-color-border-strong` | `#6c8497` | slate-500 |
| border.focus | `--ui-color-border-focus` | `#8bb5db` | blue-400 |
| brand.primary | `--ui-color-primary` | `#8bb5db` | blue-400 (bright Windstorm) |
| brand.primary-hover | `--ui-color-primary-hover` | `#b3d5f1` | Melting Ice |
| brand.primary-active | `--ui-color-primary-active` | `#6a97c0` | Windstorm |
| on brand.primary | `--ui-color-primary-contrast` | `#152026` | Black Pine |
| brand.secondary | `--ui-color-secondary` | `#264460` | blue-800 (Deep Ocean lifted) |
| brand.secondary-hover | `--ui-color-secondary-hover` | `#3a6488` | blue-700 |
| on brand.secondary | `--ui-color-secondary-contrast` | `#d4eef8` | Avalanche |
| accent.default | `--ui-color-accent` | `#f3eed8` | Sun Beam |
| accent.subtle | `--ui-color-accent-subtle` | `#34393a` | sun-900 |
| accent.strong (text/icon) | `--ui-color-accent-strong` | `#f3eed8` | Sun Beam |
| on accent | `--ui-color-accent-contrast` | `#152026` | Black Pine |
| status.success | `--ui-color-success` | `#8ccba9` | green-300 |
| status.warning | `--ui-color-warning` | `#e6c27d` | amber-300 |
| status.error | `--ui-color-danger` (hover `--ui-color-danger-hover`) | `#f0a3a3` (`#f5bcbc`) | red-300 |
| status.info | `--ui-color-info` | `#b3d5f1` | Melting Ice |
| on status fills | `--ui-color-{success,warning,danger,info}-contrast` | `#152026` | Black Pine |
| selected tint | `--ui-color-selected` | `rgba(139,181,219,.14)` | blue-400 14% |
| track | `--ui-color-track` | `#2e4658` | slate-800 |
| overlay scrim | `--ui-color-overlay` | `rgba(0,0,0,.72)` | black 72% |

### Component tokens (both modes)

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--ui-control-border` | `#6c8497` (border-strong) | `#6c8497` (border-strong) | input, textarea, select, combobox, multi-select, chip-input, search, password, number, OTP, time, date picker, colour picker, file upload, checkbox, radio |
| `--ui-switch-track` / `-checked` | `#6c8497` / `#1b3d59` | `#6c8497` / `#8bb5db` | switch |
| `--ui-switch-thumb` / `-checked` | `#ffffff` / `#ffffff` | `#d4eef8` / `#152026` | switch |
| `--ui-slider-thumb` / `-border` | `#ffffff` / control border | `#d4eef8` / `#152026` | slider |
| `--ui-skeleton-base` / `-highlight` | `#e3f0f7` / `#f7fbfd` | `#1a232a` / `#26323b` | skeleton |
| `--ui-scroll-progress-track` | Deep Ocean 6% | Melting Ice 6% | scroll progress |
| `--ui-media-bg` / `-scrim` / `-on-scrim` / `-danger` | `#152026` / `#0b1216` / `#f7fbfd` / `#f0a3a3` | `#000000` / `#000000` / `#f7fbfd` / `#f0a3a3` | video player, carousel, gallery, media lightbox (always dark over photos) |
| `--ui-pdf-page-bg` | `#ffffff` | `#ffffff` | PDF viewer pages (paper) |
| `--ui-cursor-color` | `#1b3d59` | `#d4eef8` | FX cursor |
| `--ui-section-label-bracket` | `#76591a` (accent-strong) | `#f3eed8` (accent-strong) | section label |

### Gradients, glow, glass, shadow

| Token | Light | Dark |
|---|---|---|
| `--ui-gradient-brand` (brand CTA, gradient text) | Deep Ocean → blue-700 `#1b3d59 → #3a6488` | blue-400 → Melting Ice `#8bb5db → #b3d5f1` |
| `--ui-gradient-hero` | Deep Ocean → Windstorm | black → Deep Ocean |
| `--ui-gradient-frost` | Windstorm → Melting Ice | Deep Ocean → Windstorm |
| `--ui-gradient-snow` | Melting Ice → Avalanche | night-900 → night-850 |
| `--ui-gradient-highlight` | Avalanche 90% → transparent | Melting Ice 14% → transparent |
| `--ui-glow-amber` (legacy name) | `0 8px 24px rgba(27,61,89,.18)` | `0 0 28px rgba(139,181,219,.26)` |
| `--ui-glass-bg` / `-border` | white 62% / Deep Ocean 12% | Melting Ice 6% / 13% |
| `--ui-shadow-1..3` | Black Pine / Deep Ocean tinted, 7–16% | black, 60–80% |

The brand gradient is a deliberate accessibility deviation from the brief. The brief suggested Deep Ocean → Windstorm, but the brand button puts its label on the gradient. A light label on raw Windstorm is about 3:1, and a light label on the dark-mode Windstorm stop is about 2.4:1. Each mode therefore keeps both stops readable against its label, and the full brief gradients live in `--ui-gradient-hero` and `--ui-gradient-frost`, which are decoration only.

---

## 4. Semantic token architecture

```
Primitive  --ui-winter-blue-900 (#1b3d59)
    │   only referenced inside the theme blocks of tokens.css
Semantic   --ui-color-primary  →  light: var(--ui-winter-blue-900)   dark: var(--ui-winter-blue-400)
    │   what every component reads
Component  --ui-switch-track-checked: var(--ui-color-primary)
           --ui-control-border: var(--ui-color-border-strong)
```

`tokens.css` is layered in four blocks, in cascade order:

1. **`:root`** holds the primitives, the non-colour tokens (size, space, radius, motion, type) and the neutral glass/shadow defaults.
2. **`:root, [data-theme]`** derives the extended semantic and component tokens from the core set. Every theme defines the core set: bg, surface, surface-raised, text, text-muted, border, primary, primary-hover, primary-contrast, secondary, success, warning, danger.
   - A skin written before 0.7.0 gets formula defaults, for example `--ui-color-border-strong: var(--ui-color-border)` and `--ui-color-danger-contrast: var(--ui-color-primary-contrast)`, so it renders exactly as before.
   - The block is declared on every `[data-theme]` element, so a scoped `<ui-theme-provider>` island recomputes the tokens from its own palette.
3. **`:root, [data-theme="dark"], [data-theme="winterDark"]`** sets the Winter Dark core tokens. **`:root:not([data-theme]), [data-theme="dark"], [data-theme="winterDark"]`** sets the tuned extended tokens. A page with no `data-theme` gets Winter Dark.
4. **`[data-theme="light"], [data-theme="winterLight"]`** sets the complete Winter Light set.

`color-aliases.css` is optional. It exposes the brief's generic names (`--color-background-default`, `--color-text-primary`, `--color-brand-primary`, `--color-status-error`, …) as aliases of the `--ui-color-*` tokens. Library components never read them.

---

## 5. Component state mapping

| Component | Default | Hover | Active / pressed | Focus | Selected / checked | Disabled | Error / success / loading |
|---|---|---|---|---|---|---|---|
| Button, primary | `primary` fill, `primary-contrast` label | `primary-hover` | `primary-active` + press scale | `--ui-focus-ring` (bg gap + `border-focus`) | n/a | 50% opacity | loading: spinner in `currentColor`, `aria-busy` |
| Button, secondary | `secondary` fill, `secondary-contrast` | `secondary-hover` | press scale | focus ring | n/a | 50% opacity | loading spinner |
| Button, outline / ghost / default | `surface` + `border` / transparent | `surface-hover` | press scale | focus ring | n/a | 50% opacity | |
| Button, destructive | `danger` fill, `danger-contrast` | `danger-hover` | press scale | focus ring | n/a | 50% opacity | |
| Button, brand | `gradient-brand`, `primary-contrast`, `glow-amber` | brightness 1.08 | press scale | focus ring | n/a | 50% opacity | |
| Link | `primary` | `primary-hover` + underline | n/a | focus ring | n/a | n/a | |
| Input, textarea, select, combobox, date/time | `surface` + `control-border` | n/a | n/a | `primary` border + 30% primary halo | n/a | 55% opacity | error: `danger` border + 30% danger halo; message text `danger` |
| Checkbox / radio | `surface` + `control-border` | n/a | n/a | focus ring | `primary` fill (tick `primary-contrast`) / `primary` dot | 55% opacity | invalid: `danger` border |
| Switch | `switch-track` + `switch-thumb` | n/a | n/a | focus ring | `switch-track-checked` + `switch-thumb-checked` | 55% opacity | |
| Slider | `track` + `primary` fill, `slider-thumb` ringed by `slider-thumb-border` | n/a | n/a | focus ring | n/a | 50% opacity | |
| Tabs | `text-muted` label, `border` baseline | `text` | press scale | focus ring | `text` + `primary` underline | 50% opacity | |
| Side nav / menubar / pagination | `text-muted` | `surface-hover` | press scale | focus ring | active: `primary` fill + `primary-contrast` (pagination), primary tint (nav) | 50% opacity | |
| Card | `surface` + `border`, `shadow-1` | interactive: lift + `shadow-2` + `primary` border | n/a | focus ring | n/a | n/a | |
| Table / tree | header `surface-raised`, rows `border` | primary 8% tint | n/a | focus ring | primary tint | n/a | |
| Modal / drawer / command palette | panel `surface-raised`, `overlay` scrim, `shadow-3` | close: `surface-hover` | n/a | focus ring | n/a | n/a | |
| Menu / dropdown / combobox list | `surface-raised` + `border`, `shadow-2` | primary 14–18% tint | n/a | primary tint | primary 22–26% tint | 50% opacity | danger item: `danger` text |
| Tooltip / popover | `surface-raised`, `text`, `border` | n/a | n/a | n/a | n/a | n/a | |
| Alert / toast | `surface` / `surface-raised`, 3px left stripe | close: `surface-hover` / `elevated-hover` | n/a | focus ring | n/a | n/a | stripe: `info` / `success` / `warning` / `danger` |
| Badge | `surface-raised` + `border` | n/a | n/a | n/a | n/a | n/a | tone fills with the matching `*-contrast` label |
| Chip | status 22% tint + status border | remove: `currentColor` 18% | n/a | focus ring | n/a | n/a | |
| Progress / spinner / skeleton | `track` + `primary` (or status) fill; spinner `border` + `primary` arc; `skeleton-base` → `skeleton-highlight` | n/a | n/a | n/a | n/a | n/a | tone fills `success` / `warning` / `danger` |
| Date picker / calendar | `surface-raised` popover | `surface-hover` / `elevated-hover` cell | n/a | focus ring | `primary` fill + `primary-contrast` | cells 35–50% opacity | out-of-range cells disabled |
| Empty state / result | `text-muted` copy | n/a | n/a | n/a | n/a | n/a | glyph `success` / `warning` / `danger` |
| Charts / timeline / stat card | series in `primary`, `secondary`, `accent-strong`, `info` | n/a | n/a | n/a | n/a | n/a | trend up `success`, down `danger` |

Disabled controls stay on opacity, as before. WCAG 1.4.3 and 1.4.11 exempt disabled components. `--ui-color-text-disabled` is available when a static disabled label is needed.

---

## 6. Accessibility and contrast validation

Every number below is computed from `tokens.css` by `projects/ui/styles/contrast-check.mjs`. The script resolves the `var()` chains, flattens translucent tints onto the surface behind them, and exits non-zero on any failure.

```bash
node projects/ui/styles/contrast-check.mjs        # summary, exit 1 on failure
node projects/ui/styles/contrast-check.mjs --md   # the tables below
```

The thresholds come from WCAG 2.2:

- **4.5:1** for body text, labels, links and status text (1.4.3).
- **3:1** for control boundaries, focus indicators and checked, selected or track states (1.4.11).

Result: **73 of 73 pairs pass in light and 73 of 73 in dark.**

| Mode | Lowest text | Lowest label on fill | Lowest link / status text | Lowest non-text |
|---|---|---|---|---|
| Light | 5.56 (muted on selected) | 5.99 (label on warning) | 5.66 (warning on bg) | 3.05 (slider thumb ring on track) |
| Dark | 5.39 (muted on selected) | 5.18 (label on secondary-hover) | 8.37 (primary on elevated) | 3.23 (switch thumb on track) |

Adjustments made while validating:

- **Dark ground.** Moved from Black Pine to true black (night-1000), with faintly blue-black surfaces (night-900/850). Text was softened from Avalanche to `#b3cbdc` because the brighter blue glares on black; it is still 10.7:1 or better on every surface.
- **Dark `--ui-color-selected`.** Lowered from 20% to 14%, so muted text stays above 4.5:1 on selected rows.
- **Dark switch track.** slate-500, so the track stays above 3:1 against the surfaces it sits on.
- **Dark slider thumb.** It has a Black Pine ring (`--ui-slider-thumb-border`). An Avalanche thumb on the bright fill was 1.8:1.
- **Form controls.** They moved from `border` to `--ui-control-border`, which is border-strong. The default `border`, at about 1.4–1.7:1, is right for cards and dividers but not for input boundaries.

### Full results
#### Light (winterLight)


**Text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| text on bg | `#152026` | `#eef5f9` | 15.05 | 4.5 | Pass |
| text-secondary on bg | `#1b3d59` | `#eef5f9` | 10.26 | 4.5 | Pass |
| text-muted on bg | `#465d6f` | `#eef5f9` | 6.24 | 4.5 | Pass |
| text on surface | `#152026` | `#f7fbfd` | 15.93 | 4.5 | Pass |
| text-secondary on surface | `#1b3d59` | `#f7fbfd` | 10.85 | 4.5 | Pass |
| text-muted on surface | `#465d6f` | `#f7fbfd` | 6.60 | 4.5 | Pass |
| text on surface-raised | `#152026` | `#ffffff` | 16.58 | 4.5 | Pass |
| text-secondary on surface-raised | `#1b3d59` | `#ffffff` | 11.30 | 4.5 | Pass |
| text-muted on surface-raised | `#465d6f` | `#ffffff` | 6.87 | 4.5 | Pass |
| text on surface-subtle | `#152026` | `#e3f0f7` | 14.27 | 4.5 | Pass |
| text-secondary on surface-subtle | `#1b3d59` | `#e3f0f7` | 9.73 | 4.5 | Pass |
| text-muted on surface-subtle | `#465d6f` | `#e3f0f7` | 5.91 | 4.5 | Pass |
| text on surface-hover | `#152026` | `#e3f0f7` | 14.27 | 4.5 | Pass |
| text-muted on surface-hover | `#465d6f` | `#e3f0f7` | 5.91 | 4.5 | Pass |
| text-inverse on text | `#eef5f9` | `#152026` | 15.05 | 4.5 | Pass |
| text on selected (raised) | `#152026` | `#e4e8eb` | 13.42 | 4.5 | Pass |
| text-muted on selected (raised) | `#465d6f` | `#e4e8eb` | 5.56 | 4.5 | Pass |
| text on primary 26% tint (raised) | `#152026` | `#c4cdd4` | 10.25 | 4.5 | Pass |
| text-secondary on primary 26% tint (raised) | `#1b3d59` | `#c4cdd4` | 6.98 | 4.5 | Pass |

**Button & badge labels**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary-contrast on primary | `#f7fbfd` | `#1b3d59` | 10.85 | 4.5 | Pass |
| primary-contrast on primary-hover | `#f7fbfd` | `#264460` | 9.71 | 4.5 | Pass |
| primary-contrast on primary-active | `#f7fbfd` | `#152026` | 15.93 | 4.5 | Pass |
| secondary-contrast on secondary | `#f7fbfd` | `#3a6488` | 6.01 | 4.5 | Pass |
| secondary-contrast on secondary-hover | `#f7fbfd` | `#264460` | 9.71 | 4.5 | Pass |
| danger-contrast on danger | `#f7fbfd` | `#a83a3f` | 6.04 | 4.5 | Pass |
| danger-contrast on danger-hover | `#f7fbfd` | `#922f34` | 7.53 | 4.5 | Pass |
| success-contrast on success | `#f7fbfd` | `#2e6b50` | 6.05 | 4.5 | Pass |
| warning-contrast on warning | `#f7fbfd` | `#85570f` | 5.99 | 4.5 | Pass |
| info-contrast on info | `#f7fbfd` | `#3a6488` | 6.01 | 4.5 | Pass |
| accent-contrast on accent | `#152026` | `#f3eed8` | 14.24 | 4.5 | Pass |
| primary-contrast on gradient-brand start | `#f7fbfd` | `#1b3d59` | 10.85 | 4.5 | Pass |
| primary-contrast on gradient-brand end | `#f7fbfd` | `#3a6488` | 6.01 | 4.5 | Pass |

**Links & status text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary on bg | `#1b3d59` | `#eef5f9` | 10.26 | 4.5 | Pass |
| primary-hover on bg | `#264460` | `#eef5f9` | 9.17 | 4.5 | Pass |
| danger on bg | `#a83a3f` | `#eef5f9` | 5.70 | 4.5 | Pass |
| success on bg | `#2e6b50` | `#eef5f9` | 5.72 | 4.5 | Pass |
| warning on bg | `#85570f` | `#eef5f9` | 5.66 | 4.5 | Pass |
| info on bg | `#3a6488` | `#eef5f9` | 5.68 | 4.5 | Pass |
| accent-strong on bg | `#76591a` | `#eef5f9` | 5.93 | 4.5 | Pass |
| primary on surface | `#1b3d59` | `#f7fbfd` | 10.85 | 4.5 | Pass |
| primary-hover on surface | `#264460` | `#f7fbfd` | 9.71 | 4.5 | Pass |
| danger on surface | `#a83a3f` | `#f7fbfd` | 6.04 | 4.5 | Pass |
| success on surface | `#2e6b50` | `#f7fbfd` | 6.05 | 4.5 | Pass |
| warning on surface | `#85570f` | `#f7fbfd` | 5.99 | 4.5 | Pass |
| info on surface | `#3a6488` | `#f7fbfd` | 6.01 | 4.5 | Pass |
| accent-strong on surface | `#76591a` | `#f7fbfd` | 6.28 | 4.5 | Pass |
| primary on surface-raised | `#1b3d59` | `#ffffff` | 11.30 | 4.5 | Pass |
| primary-hover on surface-raised | `#264460` | `#ffffff` | 10.11 | 4.5 | Pass |
| danger on surface-raised | `#a83a3f` | `#ffffff` | 6.28 | 4.5 | Pass |
| success on surface-raised | `#2e6b50` | `#ffffff` | 6.30 | 4.5 | Pass |
| warning on surface-raised | `#85570f` | `#ffffff` | 6.24 | 4.5 | Pass |
| info on surface-raised | `#3a6488` | `#ffffff` | 6.25 | 4.5 | Pass |
| accent-strong on surface-raised | `#76591a` | `#ffffff` | 6.53 | 4.5 | Pass |

**Controls & focus (non-text)**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| control-border on bg | `#6c8497` | `#eef5f9` | 3.54 | 3 | Pass |
| border-focus on bg | `#3a6488` | `#eef5f9` | 5.68 | 3 | Pass |
| checked / selected indicator on bg | `#1b3d59` | `#eef5f9` | 10.26 | 3 | Pass |
| error border on bg | `#a83a3f` | `#eef5f9` | 5.70 | 3 | Pass |
| switch-track on bg | `#6c8497` | `#eef5f9` | 3.54 | 3 | Pass |
| control-border on surface | `#6c8497` | `#f7fbfd` | 3.75 | 3 | Pass |
| border-focus on surface | `#3a6488` | `#f7fbfd` | 6.01 | 3 | Pass |
| checked / selected indicator on surface | `#1b3d59` | `#f7fbfd` | 10.85 | 3 | Pass |
| error border on surface | `#a83a3f` | `#f7fbfd` | 6.04 | 3 | Pass |
| switch-track on surface | `#6c8497` | `#f7fbfd` | 3.75 | 3 | Pass |
| control-border on surface-raised | `#6c8497` | `#ffffff` | 3.90 | 3 | Pass |
| border-focus on surface-raised | `#3a6488` | `#ffffff` | 6.25 | 3 | Pass |
| checked / selected indicator on surface-raised | `#1b3d59` | `#ffffff` | 11.30 | 3 | Pass |
| error border on surface-raised | `#a83a3f` | `#ffffff` | 6.28 | 3 | Pass |
| switch-track on surface-raised | `#6c8497` | `#ffffff` | 3.90 | 3 | Pass |
| switch-thumb on switch-track | `#ffffff` | `#6c8497` | 3.90 | 3 | Pass |
| switch-thumb-checked on switch-track-checked | `#ffffff` | `#1b3d59` | 11.30 | 3 | Pass |
| progress / slider fill on track | `#1b3d59` | `#dae5ec` | 8.83 | 3 | Pass |
| slider thumb (slider-thumb) on fill | `#ffffff` | `#1b3d59` | 11.30 | 3 | Pass |
| slider thumb (slider-thumb-border) on track | `#6c8497` | `#dae5ec` | 3.05 | 3 | Pass |

**Informational (exempt)**

| Pair | Foreground | Background | Ratio |
|---|---|---|---:|
| text-disabled on bg | `#93a6b5` | `#eef5f9` | 2.28 |
| text-disabled on surface-raised | `#93a6b5` | `#ffffff` | 2.51 |
| border on bg | `#c3d2dd` | `#eef5f9` | 1.40 |
| border-subtle on surface-raised | `#dae5ec` | `#ffffff` | 1.28 |
| surface-raised vs bg | `#ffffff` | `#eef5f9` | 1.10 |
| skeleton on raised card | `#e3f0f7` | `#ffffff` | 1.16 |

#### Dark (winterDark)


**Text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| text on bg | `#b3cbdc` | `#000000` | 12.49 | 4.5 | Pass |
| text-secondary on bg | `#a6c0d3` | `#000000` | 11.10 | 4.5 | Pass |
| text-muted on bg | `#8aa4b8` | `#000000` | 8.08 | 4.5 | Pass |
| text on surface | `#b3cbdc` | `#0b0f12` | 11.45 | 4.5 | Pass |
| text-secondary on surface | `#a6c0d3` | `#0b0f12` | 10.17 | 4.5 | Pass |
| text-muted on surface | `#8aa4b8` | `#0b0f12` | 7.41 | 4.5 | Pass |
| text on surface-raised | `#b3cbdc` | `#11171c` | 10.74 | 4.5 | Pass |
| text-secondary on surface-raised | `#a6c0d3` | `#11171c` | 9.54 | 4.5 | Pass |
| text-muted on surface-raised | `#8aa4b8` | `#11171c` | 6.95 | 4.5 | Pass |
| text on surface-subtle | `#b3cbdc` | `#06080a` | 11.93 | 4.5 | Pass |
| text-secondary on surface-subtle | `#a6c0d3` | `#06080a` | 10.60 | 4.5 | Pass |
| text-muted on surface-subtle | `#8aa4b8` | `#06080a` | 7.72 | 4.5 | Pass |
| text on surface-hover | `#b3cbdc` | `#1a232a` | 9.48 | 4.5 | Pass |
| text-muted on surface-hover | `#8aa4b8` | `#1a232a` | 6.13 | 4.5 | Pass |
| text-inverse on text | `#152026` | `#b3cbdc` | 9.86 | 4.5 | Pass |
| text on selected (raised) | `#b3cbdc` | `#222d37` | 8.33 | 4.5 | Pass |
| text-muted on selected (raised) | `#8aa4b8` | `#222d37` | 5.39 | 4.5 | Pass |
| text on primary 26% tint (raised) | `#b3cbdc` | `#31404e` | 6.33 | 4.5 | Pass |
| text-secondary on primary 26% tint (raised) | `#a6c0d3` | `#31404e` | 5.63 | 4.5 | Pass |

**Button & badge labels**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary-contrast on primary | `#152026` | `#8bb5db` | 7.68 | 4.5 | Pass |
| primary-contrast on primary-hover | `#152026` | `#b3d5f1` | 10.82 | 4.5 | Pass |
| primary-contrast on primary-active | `#152026` | `#6a97c0` | 5.37 | 4.5 | Pass |
| secondary-contrast on secondary | `#d4eef8` | `#264460` | 8.37 | 4.5 | Pass |
| secondary-contrast on secondary-hover | `#d4eef8` | `#3a6488` | 5.18 | 4.5 | Pass |
| danger-contrast on danger | `#152026` | `#f0a3a3` | 8.27 | 4.5 | Pass |
| danger-contrast on danger-hover | `#152026` | `#f5bcbc` | 10.11 | 4.5 | Pass |
| success-contrast on success | `#152026` | `#8ccba9` | 8.87 | 4.5 | Pass |
| warning-contrast on warning | `#152026` | `#e6c27d` | 9.77 | 4.5 | Pass |
| info-contrast on info | `#152026` | `#b3d5f1` | 10.82 | 4.5 | Pass |
| accent-contrast on accent | `#152026` | `#f3eed8` | 14.24 | 4.5 | Pass |
| primary-contrast on gradient-brand start | `#152026` | `#8bb5db` | 7.68 | 4.5 | Pass |
| primary-contrast on gradient-brand end | `#152026` | `#b3d5f1` | 10.82 | 4.5 | Pass |

**Links & status text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary on bg | `#8bb5db` | `#000000` | 9.73 | 4.5 | Pass |
| primary-hover on bg | `#b3d5f1` | `#000000` | 13.70 | 4.5 | Pass |
| danger on bg | `#f0a3a3` | `#000000` | 10.47 | 4.5 | Pass |
| success on bg | `#8ccba9` | `#000000` | 11.23 | 4.5 | Pass |
| warning on bg | `#e6c27d` | `#000000` | 12.38 | 4.5 | Pass |
| info on bg | `#b3d5f1` | `#000000` | 13.70 | 4.5 | Pass |
| accent-strong on bg | `#f3eed8` | `#000000` | 18.03 | 4.5 | Pass |
| primary on surface | `#8bb5db` | `#0b0f12` | 8.92 | 4.5 | Pass |
| primary-hover on surface | `#b3d5f1` | `#0b0f12` | 12.56 | 4.5 | Pass |
| danger on surface | `#f0a3a3` | `#0b0f12` | 9.60 | 4.5 | Pass |
| success on surface | `#8ccba9` | `#0b0f12` | 10.29 | 4.5 | Pass |
| warning on surface | `#e6c27d` | `#0b0f12` | 11.34 | 4.5 | Pass |
| info on surface | `#b3d5f1` | `#0b0f12` | 12.56 | 4.5 | Pass |
| accent-strong on surface | `#f3eed8` | `#0b0f12` | 16.52 | 4.5 | Pass |
| primary on surface-raised | `#8bb5db` | `#11171c` | 8.37 | 4.5 | Pass |
| primary-hover on surface-raised | `#b3d5f1` | `#11171c` | 11.78 | 4.5 | Pass |
| danger on surface-raised | `#f0a3a3` | `#11171c` | 9.00 | 4.5 | Pass |
| success on surface-raised | `#8ccba9` | `#11171c` | 9.66 | 4.5 | Pass |
| warning on surface-raised | `#e6c27d` | `#11171c` | 10.64 | 4.5 | Pass |
| info on surface-raised | `#b3d5f1` | `#11171c` | 11.78 | 4.5 | Pass |
| accent-strong on surface-raised | `#f3eed8` | `#11171c` | 15.50 | 4.5 | Pass |

**Controls & focus (non-text)**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| control-border on bg | `#6c8497` | `#000000` | 5.39 | 3 | Pass |
| border-focus on bg | `#8bb5db` | `#000000` | 9.73 | 3 | Pass |
| checked / selected indicator on bg | `#8bb5db` | `#000000` | 9.73 | 3 | Pass |
| error border on bg | `#f0a3a3` | `#000000` | 10.47 | 3 | Pass |
| switch-track on bg | `#6c8497` | `#000000` | 5.39 | 3 | Pass |
| control-border on surface | `#6c8497` | `#0b0f12` | 4.93 | 3 | Pass |
| border-focus on surface | `#8bb5db` | `#0b0f12` | 8.92 | 3 | Pass |
| checked / selected indicator on surface | `#8bb5db` | `#0b0f12` | 8.92 | 3 | Pass |
| error border on surface | `#f0a3a3` | `#0b0f12` | 9.60 | 3 | Pass |
| switch-track on surface | `#6c8497` | `#0b0f12` | 4.93 | 3 | Pass |
| control-border on surface-raised | `#6c8497` | `#11171c` | 4.63 | 3 | Pass |
| border-focus on surface-raised | `#8bb5db` | `#11171c` | 8.37 | 3 | Pass |
| checked / selected indicator on surface-raised | `#8bb5db` | `#11171c` | 8.37 | 3 | Pass |
| error border on surface-raised | `#f0a3a3` | `#11171c` | 9.00 | 3 | Pass |
| switch-track on surface-raised | `#6c8497` | `#11171c` | 4.63 | 3 | Pass |
| switch-thumb on switch-track | `#d4eef8` | `#6c8497` | 3.23 | 3 | Pass |
| switch-thumb-checked on switch-track-checked | `#152026` | `#8bb5db` | 7.68 | 3 | Pass |
| progress / slider fill on track | `#8bb5db` | `#2e4658` | 4.56 | 3 | Pass |
| slider thumb (slider-thumb-border) on fill | `#152026` | `#8bb5db` | 7.68 | 3 | Pass |
| slider thumb (slider-thumb) on track | `#d4eef8` | `#2e4658` | 8.15 | 3 | Pass |

**Informational (exempt)**

| Pair | Foreground | Background | Ratio |
|---|---|---|---:|
| text-disabled on bg | `#587488` | `#000000` | 4.27 |
| text-disabled on surface-raised | `#587488` | `#11171c` | 3.67 |
| border on bg | `#26323b` | `#000000` | 1.60 |
| border-subtle on surface-raised | `#1a232a` | `#11171c` | 1.13 |
| surface-raised vs bg | `#11171c` | `#000000` | 1.16 |
| skeleton on raised card | `#1a232a` | `#11171c` | 1.13 |

---

## 7. CSS variables

The complete source is `projects/ui/styles/tokens.css`. The Winter theme blocks:

```css
/* ── Winter Dark (default `dark`, alias `winterDark`) ──────────────────────
   A pine forest beside a dark ocean under moonlight. Core tokens also live on :root so a page
   with no data-theme at all still renders Winter Dark. */
:root,
[data-theme="dark"],
[data-theme="winterDark"] {
  color-scheme: dark;

  --ui-color-bg: var(--ui-winter-night-1000);
  --ui-color-surface: var(--ui-winter-night-900);
  --ui-color-surface-raised: var(--ui-winter-night-850);
  /* A soft, slightly grey blue rather than Avalanche itself: on a black ground the brighter blue
     glares. 12.5:1 on the ground, 10.7:1 on raised surfaces. */
  --ui-color-text: #b3cbdc;
  --ui-color-text-muted: #8aa4b8;
  --ui-color-border: var(--ui-winter-night-700);
  --ui-color-primary: var(--ui-winter-blue-400);
  --ui-color-primary-hover: var(--ui-winter-blue-300);
  --ui-color-primary-contrast: var(--ui-winter-pine-950);
  --ui-color-secondary: var(--ui-winter-blue-800);
  --ui-color-success: var(--ui-winter-green-300);
  --ui-color-warning: var(--ui-winter-amber-300);
  --ui-color-danger: var(--ui-winter-red-300);
}

:root:not([data-theme]),
[data-theme="dark"],
[data-theme="winterDark"] {
  --ui-color-surface-subtle: var(--ui-winter-night-950);
  --ui-color-surface-hover: var(--ui-winter-night-800);
  --ui-color-elevated-hover: var(--ui-winter-night-800);
  --ui-color-text-secondary: #a6c0d3;
  --ui-color-text-disabled: var(--ui-winter-slate-600);
  --ui-color-text-inverse: var(--ui-winter-pine-950);
  --ui-color-border-subtle: var(--ui-winter-night-800);
  --ui-color-border-strong: var(--ui-winter-slate-500);
  --ui-color-border-focus: var(--ui-winter-blue-400);
  --ui-color-primary-active: var(--ui-winter-blue-500);
  --ui-color-secondary-hover: var(--ui-winter-blue-700);
  --ui-color-secondary-contrast: var(--ui-winter-blue-100);
  --ui-color-accent: var(--ui-winter-sun-100);
  --ui-color-accent-subtle: var(--ui-winter-sun-900);
  --ui-color-accent-strong: var(--ui-winter-sun-100);
  --ui-color-accent-contrast: var(--ui-winter-pine-950);
  --ui-color-info: var(--ui-winter-blue-300);
  --ui-color-info-contrast: var(--ui-winter-pine-950);
  --ui-color-success-contrast: var(--ui-winter-pine-950);
  --ui-color-warning-contrast: var(--ui-winter-pine-950);
  --ui-color-danger-contrast: var(--ui-winter-pine-950);
  --ui-color-danger-hover: #f5bcbc;
  --ui-color-selected: rgba(139, 181, 219, 0.14);
  --ui-color-track: var(--ui-winter-slate-800);
  --ui-color-overlay: rgba(0, 0, 0, 0.72);

  --ui-switch-track: var(--ui-winter-slate-500);
  --ui-switch-thumb: var(--ui-winter-blue-100);
  --ui-switch-thumb-checked: var(--ui-winter-pine-950);
  --ui-slider-thumb: var(--ui-winter-blue-100);
  --ui-slider-thumb-border: var(--ui-winter-pine-950);
  /* One step above the raised surface, so a skeleton inside a card is still visible at rest. */
  --ui-skeleton-base: var(--ui-winter-night-800);
  --ui-skeleton-highlight: var(--ui-winter-night-700);
  --ui-scroll-progress-track: rgba(179, 213, 241, 0.06);
  --ui-media-bg: var(--ui-winter-night-1000);
  --ui-media-scrim: #000000;
  --ui-media-on-scrim: var(--ui-winter-blue-25);
  --ui-media-danger: var(--ui-winter-red-300);
  --ui-cursor-color: var(--ui-winter-blue-100);
  --ui-section-label-bracket: var(--ui-color-accent-strong);

  --ui-gradient-brand: linear-gradient(90deg, #8bb5db 0%, #b3d5f1 100%);
  --ui-gradient-hero: linear-gradient(160deg, #000000 0%, #1b3d59 100%);
  --ui-gradient-frost: linear-gradient(135deg, #1b3d59 0%, #6a97c0 100%);
  --ui-gradient-snow: linear-gradient(135deg, #0b0f12 0%, #11171c 100%);
  --ui-gradient-highlight: linear-gradient(180deg, rgba(179, 213, 241, 0.14) 0%, rgba(179, 213, 241, 0) 100%);
  --ui-glow-amber: 0 0 28px rgba(139, 181, 219, 0.26);

  --ui-glass-bg: rgba(179, 213, 241, 0.06);
  --ui-glass-border: rgba(179, 213, 241, 0.13);
  --ui-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.6);
  --ui-shadow-2: 0 8px 24px rgba(0, 0, 0, 0.7);
  --ui-shadow-3: 0 16px 48px rgba(0, 0, 0, 0.8);
}

/* ── Winter Light (default `light`, alias `winterLight`) ───────────────────
   Snow-covered Nordic architecture in winter daylight. */
[data-theme="light"],
[data-theme="winterLight"] {
  color-scheme: light;

  --ui-color-bg: var(--ui-winter-blue-50);
  --ui-color-surface: var(--ui-winter-blue-25);
  --ui-color-surface-raised: var(--ui-winter-white);
  --ui-color-text: var(--ui-winter-pine-950);
  --ui-color-text-muted: var(--ui-winter-slate-700);
  --ui-color-border: var(--ui-winter-slate-300);
  --ui-color-primary: var(--ui-winter-blue-900);
  --ui-color-primary-hover: var(--ui-winter-blue-800);
  --ui-color-primary-contrast: var(--ui-winter-blue-25);
  --ui-color-secondary: var(--ui-winter-blue-700);
  --ui-color-success: var(--ui-winter-green-700);
  --ui-color-warning: var(--ui-winter-amber-700);
  --ui-color-danger: var(--ui-winter-red-700);

  --ui-color-surface-subtle: var(--ui-winter-blue-75);
  --ui-color-surface-hover: var(--ui-winter-blue-75);
  --ui-color-elevated-hover: var(--ui-winter-blue-75);
  --ui-color-text-secondary: var(--ui-winter-blue-900);
  --ui-color-text-disabled: var(--ui-winter-slate-400);
  --ui-color-text-inverse: var(--ui-winter-blue-50);
  --ui-color-border-subtle: var(--ui-winter-slate-200);
  --ui-color-border-strong: var(--ui-winter-slate-500);
  --ui-color-border-focus: var(--ui-winter-blue-700);
  --ui-color-primary-active: var(--ui-winter-pine-950);
  --ui-color-secondary-hover: var(--ui-winter-blue-800);
  --ui-color-secondary-contrast: var(--ui-winter-blue-25);
  --ui-color-accent: var(--ui-winter-sun-100);
  --ui-color-accent-subtle: var(--ui-winter-sun-50);
  --ui-color-accent-strong: var(--ui-winter-sun-700);
  --ui-color-accent-contrast: var(--ui-winter-pine-950);
  --ui-color-info: var(--ui-winter-blue-700);
  --ui-color-info-contrast: var(--ui-winter-blue-25);
  --ui-color-success-contrast: var(--ui-winter-blue-25);
  --ui-color-warning-contrast: var(--ui-winter-blue-25);
  --ui-color-danger-contrast: var(--ui-winter-blue-25);
  --ui-color-danger-hover: #922f34;
  --ui-color-selected: rgba(27, 61, 89, 0.12);
  --ui-color-track: var(--ui-winter-slate-200);
  --ui-color-overlay: rgba(21, 32, 38, 0.42);

  --ui-switch-track: var(--ui-winter-slate-500);
  --ui-switch-thumb: var(--ui-winter-white);
  --ui-switch-thumb-checked: var(--ui-winter-white);
  --ui-slider-thumb: var(--ui-winter-white);
  --ui-skeleton-base: var(--ui-winter-blue-75);
  --ui-skeleton-highlight: var(--ui-winter-blue-25);
  --ui-scroll-progress-track: rgba(27, 61, 89, 0.06);
  --ui-media-bg: var(--ui-winter-pine-950);
  --ui-media-scrim: #0b1216;
  --ui-media-on-scrim: var(--ui-winter-blue-25);
  --ui-media-danger: var(--ui-winter-red-300);
  --ui-cursor-color: var(--ui-winter-blue-900);
  --ui-section-label-bracket: var(--ui-color-accent-strong);

  --ui-gradient-brand: linear-gradient(90deg, #1b3d59 0%, #3a6488 100%);
  --ui-gradient-hero: linear-gradient(160deg, #1b3d59 0%, #6a97c0 100%);
  --ui-gradient-frost: linear-gradient(135deg, #6a97c0 0%, #b3d5f1 100%);
  --ui-gradient-snow: linear-gradient(135deg, #b3d5f1 0%, #d4eef8 100%);
  --ui-gradient-highlight: linear-gradient(180deg, rgba(212, 238, 248, 0.9) 0%, rgba(212, 238, 248, 0) 100%);
  --ui-glow-amber: 0 8px 24px rgba(27, 61, 89, 0.18);

  --ui-glass-bg: rgba(255, 255, 255, 0.62);
  --ui-glass-border: rgba(27, 61, 89, 0.12);
  --ui-shadow-1: 0 1px 2px rgba(21, 32, 38, 0.07);
  --ui-shadow-2: 0 8px 24px rgba(27, 61, 89, 0.1);
  --ui-shadow-3: 0 16px 48px rgba(27, 61, 89, 0.16);
}

[data-theme="dark"] ::selection,
[data-theme="winterDark"] ::selection {
  background: rgba(106, 151, 192, 0.45);
  color: #f7fbfd;
}
[data-theme="light"] ::selection,
[data-theme="winterLight"] ::selection {
  background: #b3d5f1;
  color: #152026;
}
```

---

## 8. Usage guidelines

- **Read semantic tokens only.** Use `--ui-color-*`, or a component token, in components and app code. Never use `--ui-winter-*` or raw hex.
- **Pair every fill with its `-contrast` token.** For example, `danger` goes with `danger-contrast`. `primary-contrast` is Black Pine in dark mode, so it is not a generic "white".
- **Separate text and fill roles.**
  - `accent` (Sun Beam) is a fill. For accent-coloured text or icons use `accent-strong`.
  - Use Sun Beam sparingly: a highlight badge, a featured marker, one warm detail per view.
- **Pick borders by role.**
  - `border-subtle` for dividers and table rows.
  - `border` for cards and containers.
  - `border-strong` / `--ui-control-border` for anything a user must find to operate: inputs, checkboxes, radios.
  - `border-focus` for focus indicators only.
- **Keep text hierarchy to three steps.** `text` for content, `text-secondary` for supporting headings and labels, `text-muted` for captions and hints. `text-muted` is tuned to pass on selected tints. Anything quieter is disabled and must not carry meaning.
- **Keep status colours for status.** Never use them as decoration or as a second brand colour.
- **Keep media chrome dark.** The lightbox, carousel, gallery and video player read `--ui-media-*`, which stays dark in both modes because it sits over photographs.
- **Use gradients in few places.**
  - *Allowed:* hero sections, featured or marketing cards, background decoration, callouts, the single brand CTA per view (`variant="brand"`), and `.ui-gradient-text` display headings.
  - *Not allowed:* ordinary buttons, inputs, nav, tables, badges, alerts or body text.
  - Prefer `--ui-gradient-hero` for large decorative surfaces, `--ui-gradient-frost` / `--ui-gradient-snow` for featured cards, and `--ui-gradient-highlight` as a top-fade over a surface.
- **Keep elevation quiet.** In light mode, elevation comes from the white raised surface plus a tinted shadow, not from heavier borders. In dark mode, surfaces step up from the black ground in faint blue-blacks (night-900, night-850) rather than greys.
- **Write new skins against the core tokens.** Set the core 13 tokens. The derived block fills in the rest, and you can override any extended token when its formula is not good enough.

---

## 9. Same components, light and dark

| Component | Light | Dark |
|---|---|---|
| Page | `#eef5f9` snow ground, `#152026` text | `#000000` ground, `#b3cbdc` text |
| Card | `#ffffff` on the snow ground, `#c3d2dd` hairline, soft Deep Ocean shadow | `#0b0f12` surface, `#26323b` hairline, deep shadow |
| Primary button | `#1b3d59` fill, `#f7fbfd` label (10.85:1); hover `#264460`; pressed `#152026` | `#8bb5db` fill, `#152026` label; hover `#b3d5f1`; pressed `#6a97c0` |
| Secondary button | `#3a6488` fill, `#f7fbfd` label (6.01:1) | `#264460` fill, `#d4eef8` label |
| Brand CTA | Deep Ocean → `#3a6488` pill, light label | `#8bb5db` → Melting Ice pill, Black Pine label, moonlight glow |
| Input | `#f7fbfd` field, `#6c8497` outline; focus `#1b3d59` + halo; error `#a83a3f` | `#0b0f12` field, `#6c8497` outline; focus `#8bb5db` + halo; error `#f0a3a3` |
| Checkbox checked | `#1b3d59` box, light tick | `#8bb5db` box, Black Pine tick |
| Switch on | `#1b3d59` track, white thumb | `#8bb5db` track, Black Pine thumb |
| Selected tab | `#152026` label, `#1b3d59` underline | `#b3cbdc` label, `#8bb5db` underline |
| Alert (warning) | `#f7fbfd` surface, `#85570f` stripe | `#0b0f12` surface, `#e6c27d` stripe |
| Badge (success) | `#2e6b50` fill, `#f7fbfd` label | `#8ccba9` fill, `#152026` label |
| Modal | white panel over a 42% Black Pine scrim | `#11171c` panel over a 72% black scrim |
| Skeleton | `#e3f0f7` shimmering to `#f7fbfd` | `#1a232a` shimmering to `#26323b` |

The showcase's Foundation page renders these components live; switch the theme in its top bar to compare.
