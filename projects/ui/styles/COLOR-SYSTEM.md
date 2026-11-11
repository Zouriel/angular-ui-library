# Navy colour system

`@zouriel/ui` ships one colour identity in two modes, built on three brand colours: **Midnight Navy**
`#0F1433`, **Powder Blue** `#C9D6FF` and **Sunflower** `#FFC93C`. It replaced the retired Winter palette
as the library default.

| Mode | Theme names | Character |
|---|---|---|
| Dark (library default) | `dark`, `navy-dark` | A Midnight Navy canvas with surfaces stepped up from it, Powder Blue as the ink and the secondary tone, Sunflower as the primary |
| Light | `light`, `navy` | A Mist canvas (`#EEF2FF`) with white cards, Midnight Navy ink, Powder Blue for secondary fills and borders, and Sunflower deepened to a dark gold for the primary |

```html
<html data-theme="navy">   <!-- or navy-dark; `light` / `dark` resolve to the same tokens -->
```

```ts
inject(UiThemeService).set('navy-dark');
inject(UiThemeService).toggle(); // navy-dark <-> navy (dark <-> light for the short names)
```

**Deprecated aliases.** `winterDark` and `winterLight`, the old palette's names, are selectors on the
same blocks as `navy-dark` and `navy`, so an app that sets them gets Navy and keeps working.
`UI_LEGACY_THEMES` lists them; new code should use `dark` / `light` or `navy-dark` / `navy`.

**Rules the palette follows.**

- Powder Blue is never a large surface on dark: it is the ink, the secondary fill and the info tone.
  Dark surfaces are Midnight Navy stepped up (`navy-900`, `navy-850`, `navy-800`).
- Sunflower is 1.37:1 on the light canvas, so it can't be text or the primary there. The light primary
  is Sunflower deepened to `#7a5800` (5.8:1 on Mist, 6.5:1 under white text); Sunflower itself stays the
  accent fill (with Midnight text), the selection bar, the glow, the highlight gradient and the liquid
  backdrop.
- On dark, Sunflower is the primary as it is (11.7:1 on the canvas, with a Midnight label).

`theme-dark-orange.css`, `theme-maldives.css`, `theme-liquid.css` and the legacy `theme-palettes.css`
set their own palettes and don't read Navy.

---

## 1. Primitive palette

Primitives are named `--ui-navy-*`. Components never read them; only the theme blocks in `tokens.css` do.

### Reference colours

| Token | Hex | Note |
|---|---|---|
| `--ui-navy-midnight` | `#0f1433` | Midnight Navy: the dark canvas and the light ink |
| `--ui-navy-powder` | `#c9d6ff` | Powder Blue: the dark ink and secondary tone |
| `--ui-navy-sunflower` | `#ffc93c` | Sunflower: the accent |
| `--ui-navy-mist` | `#eef2ff` | the light canvas |

### Navy ramp

From the deepest step under Midnight, through the mid blues, to Powder Blue, Mist and white.

| Token | Hex | Note |
|---|---|---|
| `--ui-navy-1000` | `#0a0e26` |  |
| `--ui-navy-950` | `#0f1433` | Midnight Navy |
| `--ui-navy-900` | `#151b3f` |  |
| `--ui-navy-850` | `#1b224b` |  |
| `--ui-navy-800` | `#232b59` |  |
| `--ui-navy-750` | `#2c3568` |  |
| `--ui-navy-725` | `#2d3a7a` | deep blue: secondary text, focus and info on light |
| `--ui-navy-700` | `#38427a` |  |
| `--ui-navy-650` | `#46507e` | slate navy: muted text on light |
| `--ui-navy-500` | `#6673b0` |  |
| `--ui-navy-400` | `#9daadc` | muted text on dark |
| `--ui-navy-300` | `#aebbea` |  |
| `--ui-navy-275` | `#b7c7ff` | Powder Blue, a step deeper: the light secondary's hover |
| `--ui-navy-250` | `#bfcbf5` | secondary text on dark: 4.5:1 even on a selected row's Sunflower tint |
| `--ui-navy-200` | `#c9d6ff` | Powder Blue |
| `--ui-navy-100` | `#dce4ff` |  |
| `--ui-navy-75` | `#e4eaff` |  |
| `--ui-navy-50` | `#eef2ff` | Mist |
| `--ui-navy-25` | `#f7f9ff` |  |
| `--ui-navy-white` | `#ffffff` |  |

### Sunflower

| Token | Hex | Note |
|---|---|---|
| `--ui-navy-sun-50` | `#fff4d6` |  |
| `--ui-navy-sun-200` | `#ffe6a3` |  |
| `--ui-navy-sun-300` | `#ffd873` |  |
| `--ui-navy-sun-400` | `#ffc93c` | Sunflower |
| `--ui-navy-sun-500` | `#f2b91e` |  |
| `--ui-navy-sun-700` | `#7a5800` | the light theme's primary: Sunflower deepened to 5.8:1 on Mist |
| `--ui-navy-sun-800` | `#6a4c00` |  |
| `--ui-navy-sun-900` | `#5a4100` |  |
| `--ui-navy-sun-950` | `#3a3014` |  |

### Status

| Token | Hex | Note |
|---|---|---|
| `--ui-navy-green-700` | `#23673f` |  |
| `--ui-navy-green-300` | `#8fd3ae` |  |
| `--ui-navy-orange-700` | `#a34700` |  |
| `--ui-navy-orange-300` | `#ffa463` |  |
| `--ui-navy-red-800` | `#922831` |  |
| `--ui-navy-red-700` | `#b0303a` |  |
| `--ui-navy-red-300` | `#ff9c9c` |  |
| `--ui-navy-red-200` | `#ffb8b8` |  |

---

## 2. Light theme tokens (`navy`)

| Token | Value | From |
|---|---|---|
| `--ui-color-bg` | `#eef2ff` | `--ui-navy-50` |
| `--ui-color-surface` | `#f7f9ff` | `--ui-navy-25` |
| `--ui-color-surface-raised` | `#ffffff` | `--ui-navy-white` |
| `--ui-color-surface-subtle` | `#e4eaff` | `--ui-navy-75` |
| `--ui-color-surface-hover` | `#e4eaff` | `--ui-navy-75` |
| `--ui-color-elevated-hover` | `#e4eaff` | `--ui-navy-75` |
| `--ui-color-text` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-text-secondary` | `#2d3a7a` | `--ui-navy-725` |
| `--ui-color-text-muted` | `#46507e` | `--ui-navy-650` |
| `--ui-color-text-disabled` | `#6673b0` | `--ui-navy-500` |
| `--ui-color-text-inverse` | `#eef2ff` | `--ui-navy-50` |
| `--ui-color-border-subtle` | `#dce4ff` | `--ui-navy-100` |
| `--ui-color-border` | `#c9d6ff` | `--ui-navy-200` |
| `--ui-color-border-strong` | `#6673b0` | `--ui-navy-500` |
| `--ui-color-border-focus` | `#2d3a7a` | `--ui-navy-725` |
| `--ui-color-primary` | `#7a5800` | `--ui-navy-sun-700` |
| `--ui-color-primary-hover` | `#6a4c00` | `--ui-navy-sun-800` |
| `--ui-color-primary-active` | `#5a4100` | `--ui-navy-sun-900` |
| `--ui-color-primary-contrast` | `#ffffff` | `--ui-navy-white` |
| `--ui-color-secondary` | `#c9d6ff` | `--ui-navy-200` |
| `--ui-color-secondary-hover` | `#b7c7ff` | `--ui-navy-275` |
| `--ui-color-secondary-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-accent` | `#ffc93c` | `--ui-navy-sun-400` |
| `--ui-color-accent-subtle` | `#fff4d6` | `--ui-navy-sun-50` |
| `--ui-color-accent-strong` | `#7a5800` | `--ui-navy-sun-700` |
| `--ui-color-accent-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-info` | `#2d3a7a` | `--ui-navy-725` |
| `--ui-color-info-contrast` | `#ffffff` | `--ui-navy-white` |
| `--ui-color-success` | `#23673f` | `--ui-navy-green-700` |
| `--ui-color-success-contrast` | `#ffffff` | `--ui-navy-white` |
| `--ui-color-warning` | `#a34700` | `--ui-navy-orange-700` |
| `--ui-color-warning-contrast` | `#ffffff` | `--ui-navy-white` |
| `--ui-color-danger` | `#b0303a` | `--ui-navy-red-700` |
| `--ui-color-danger-hover` | `#922831` | `--ui-navy-red-800` |
| `--ui-color-danger-contrast` | `#ffffff` | `--ui-navy-white` |
| `--ui-color-selected` | `rgba(15, 20, 51, 0.1)` |  |
| `--ui-color-track` | `#dce4ff` | `--ui-navy-100` |
| `--ui-color-overlay` | `rgba(15, 20, 51, 0.42)` |  |

---

## 3. Dark theme tokens (`navy-dark`)

| Token | Value | From |
|---|---|---|
| `--ui-color-bg` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-surface` | `#151b3f` | `--ui-navy-900` |
| `--ui-color-surface-raised` | `#1b224b` | `--ui-navy-850` |
| `--ui-color-surface-subtle` | `#0a0e26` | `--ui-navy-1000` |
| `--ui-color-surface-hover` | `#232b59` | `--ui-navy-800` |
| `--ui-color-elevated-hover` | `#232b59` | `--ui-navy-800` |
| `--ui-color-text` | `#c9d6ff` | `--ui-navy-200` |
| `--ui-color-text-secondary` | `#bfcbf5` | `--ui-navy-250` |
| `--ui-color-text-muted` | `#9daadc` | `--ui-navy-400` |
| `--ui-color-text-disabled` | `#6673b0` | `--ui-navy-500` |
| `--ui-color-text-inverse` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-border-subtle` | `#232b59` | `--ui-navy-800` |
| `--ui-color-border` | `#38427a` | `--ui-navy-700` |
| `--ui-color-border-strong` | `#6673b0` | `--ui-navy-500` |
| `--ui-color-border-focus` | `#ffc93c` | `--ui-navy-sun-400` |
| `--ui-color-primary` | `#ffc93c` | `--ui-navy-sun-400` |
| `--ui-color-primary-hover` | `#ffd873` | `--ui-navy-sun-300` |
| `--ui-color-primary-active` | `#f2b91e` | `--ui-navy-sun-500` |
| `--ui-color-primary-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-secondary` | `#c9d6ff` | `--ui-navy-200` |
| `--ui-color-secondary-hover` | `#dce4ff` | `--ui-navy-100` |
| `--ui-color-secondary-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-accent` | `#ffc93c` | `--ui-navy-sun-400` |
| `--ui-color-accent-subtle` | `#3a3014` | `--ui-navy-sun-950` |
| `--ui-color-accent-strong` | `#ffd873` | `--ui-navy-sun-300` |
| `--ui-color-accent-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-info` | `#c9d6ff` | `--ui-navy-200` |
| `--ui-color-info-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-success` | `#8fd3ae` | `--ui-navy-green-300` |
| `--ui-color-success-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-warning` | `#ffa463` | `--ui-navy-orange-300` |
| `--ui-color-warning-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-danger` | `#ff9c9c` | `--ui-navy-red-300` |
| `--ui-color-danger-hover` | `#ffb8b8` | `--ui-navy-red-200` |
| `--ui-color-danger-contrast` | `#0f1433` | `--ui-navy-950` |
| `--ui-color-selected` | `rgba(201, 214, 255, 0.14)` |  |
| `--ui-color-track` | `#2c3568` | `--ui-navy-750` |
| `--ui-color-overlay` | `rgba(5, 7, 20, 0.72)` |  |

### Component tokens (both modes)

| Token | Light (`navy`) | Dark (`navy-dark`) |
|---|---|---|
| `--ui-control-border` | `#6673b0` | `#6673b0` |
| `--ui-switch-track` | `#6673b0` | `#6673b0` |
| `--ui-switch-thumb` | `#ffffff` | `#c9d6ff` |
| `--ui-switch-thumb-checked` | `#ffffff` | `#0f1433` |
| `--ui-slider-thumb` | `#ffffff` | `#c9d6ff` |
| `--ui-slider-thumb-border` | `#6673b0` | `#0f1433` |
| `--ui-skeleton-base` | `#dce4ff` | `#232b59` |
| `--ui-skeleton-highlight` | `#eef2ff` | `#2c3568` |
| `--ui-progress-neutral` | `#686e73` | `#a1a6b4` |
| `--ui-media-bg` | `#0f1433` | `#000000` |
| `--ui-media-on-scrim` | `#f7f9ff` | `#f7f9ff` |
| `--ui-cursor-color` | `#0f1433` | `#c9d6ff` |

### Gradients, glow, glass, shadow, liquid backdrop

| Token | Light (`navy`) | Dark (`navy-dark`) |
|---|---|---|
| `--ui-gradient-brand` | `linear-gradient(90deg, #0f1433 0%, #2d3a7a 100%)` | `linear-gradient(90deg, #ffc93c 0%, #ffd873 100%)` |
| `--ui-gradient-hero` | `linear-gradient(160deg, #0f1433 0%, #2d3a7a 70%, #6673b0 100%)` | `linear-gradient(160deg, #0f1433 0%, #2c3568 100%)` |
| `--ui-gradient-frost` | `linear-gradient(135deg, #6673b0 0%, #c9d6ff 100%)` | `linear-gradient(135deg, #2c3568 0%, #6673b0 100%)` |
| `--ui-gradient-snow` | `linear-gradient(135deg, #c9d6ff 0%, #dce4ff 100%)` | `linear-gradient(135deg, #151b3f 0%, #1b224b 100%)` |
| `--ui-gradient-highlight` | `linear-gradient(180deg, rgba(255, 201, 60, 0.22) 0%, rgba(255, 201, 60, 0) 100%)` | `linear-gradient(180deg, rgba(201, 214, 255, 0.14) 0%, rgba(201, 214, 255, 0) 100%)` |
| `--ui-glow-amber` | `0 8px 24px rgba(255, 201, 60, 0.35)` | `0 0 28px rgba(255, 201, 60, 0.28)` |
| `--ui-glass-bg` | `rgba(255, 255, 255, 0.9)` | `rgba(201, 214, 255, 0.06)` |
| `--ui-glass-border` | `rgba(15, 20, 51, 0.12)` | `rgba(201, 214, 255, 0.13)` |
| `--ui-shadow-1` | `0 1px 2px rgba(15, 20, 51, 0.07)` | `0 1px 2px rgba(0, 0, 0, 0.6)` |
| `--ui-shadow-2` | `0 8px 24px rgba(15, 20, 51, 0.1)` | `0 8px 24px rgba(0, 0, 0, 0.7)` |
| `--ui-shadow-3` | `0 16px 48px rgba(15, 20, 51, 0.16)` | `0 16px 48px rgba(0, 0, 0, 0.8)` |
| `--ui-liquid-main` | `#eef2ff` | `#0f1433` |
| `--ui-liquid-second` | `#c9d6ff` | `#c9d6ff` |
| `--ui-liquid-accent` | `#ffc93c` | `#ffc93c` |
| `--ui-liquid-second-strength` | `60%` | `10%` |
| `--ui-liquid-accent-strength` | `45%` | `10%` |

The `--ui-liquid-*` tokens let `ui-liquid-backdrop` (`@zouriel/ui/fx`) work in Navy: faint pools of
Powder Blue and Sunflower on Midnight in dark, stronger ones on Mist in light. `provideUiConfig`'s
`glass` stays `false` by default, so apps keep their solid surfaces unless they ask for glass.

---

## 4. Semantic token architecture

```
Primitive  --ui-navy-sun-700 (#7a5800)
    │   only referenced inside the theme blocks of tokens.css
Semantic   --ui-color-primary  →  light: var(--ui-navy-sun-700)   dark: var(--ui-navy-sun-400)
    │   what every component reads
Component  --ui-switch-track-checked: var(--ui-color-primary)
           --ui-control-border: var(--ui-color-border-strong)
```

`tokens.css` is layered in four blocks, in cascade order:

1. **`:root`** holds the primitives, the non-colour tokens (size, space, radius, motion, type) and the neutral glass/shadow defaults.
2. **`:root, [data-theme]`** derives the extended semantic and component tokens from the core set. Every theme defines the core set: bg, surface, surface-raised, text, text-muted, border, primary, primary-hover, primary-contrast, secondary, success, warning, danger.
   - A skin written before 0.7.0 gets formula defaults, for example `--ui-color-border-strong: var(--ui-color-border)` and `--ui-color-danger-contrast: var(--ui-color-primary-contrast)`, so it renders exactly as before.
   - The block is declared on every `[data-theme]` element, so a scoped `<ui-theme-provider>` island recomputes the tokens from its own palette.
3. **`:root, [data-theme="dark"], [data-theme="navy-dark"], [data-theme="winterDark"]`** sets the Navy Dark core tokens. **`:root:not([data-theme]), [data-theme="dark"], [data-theme="navy-dark"], [data-theme="winterDark"]`** sets the tuned extended tokens. A page with no `data-theme` gets Navy Dark. (`winterDark` is the deprecated alias.)
4. **`[data-theme="light"], [data-theme="navy"], [data-theme="winterLight"]`** sets the complete Navy Light set. (`winterLight` is the deprecated alias.)

`color-aliases.css` is optional. It exposes the brief's generic names (`--color-background-default`, `--color-text-primary`, `--color-brand-primary`, `--color-status-error`, …) as aliases of the `--ui-color-*` tokens. Library components never read them.

---

## 5. Component state mapping

| Component | Default | Hover | Active / pressed | Focus | Selected / checked | Disabled | Error / success / loading |
|---|---|---|---|---|---|---|---|
| Button, primary | `primary` fill, `primary-contrast` label | `primary-hover` | `primary-active` + press scale | `--ui-focus-ring` (bg gap + `border-focus`) | n/a | 50% opacity | loading: spinner in `currentColor`, `aria-busy` |
| Button, secondary | `secondary` fill, `secondary-contrast` | `secondary-hover` | press scale | focus ring | n/a | 50% opacity | loading spinner |
| Button, outline / ghost / default | `surface` + `border` / transparent | `surface-hover` | press scale | focus ring | n/a | 50% opacity | |
| Button, destructive | `danger` fill, `danger-contrast` | `danger-hover` | press scale | focus ring | n/a | 50% opacity | |
| Button, brand | `gradient-brand`, `gradient-brand-contrast` (else `primary-contrast`), `glow-amber` | contrast-colour wash | press scale | focus ring | n/a | 50% opacity | |
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

Result: **79 of 79 pairs pass in light and 79 of 79 in dark.**

| Mode | Lowest text | Lowest label on fill | Lowest link / status text | Lowest non-text |
|---|---|---|---|---|
| Light | 6.30 (text-muted on selected (raised)) | 5.42 (tier-premium-contrast on tier-premium-light) | 5.43 (warning on bg) | 3.57 (slider thumb (slider-thumb-border) on track) |
| Dark | 4.71 (text-muted on selected (raised)) | 5.42 (tier-premium-contrast on tier-premium-light) | 7.62 (danger on surface-raised) | 3.13 (switch-thumb on switch-track) |

Derived role colours (where a brand colour fails its role):

- **Light primary** `#7a5800` (`--ui-navy-sun-700`): Sunflower deepened; Sunflower is 1.37:1 on Mist.
  Hover `#6a4c00`, pressed `#5a4100`, white label.
- **Light brand gradient** Midnight → `#2d3a7a` with a white label: `.ui-gradient-text` paints the
  gradient straight onto the page, where Sunflower would vanish. Sunflower carries the light theme's
  glow, highlight gradient, eyebrow bar and backdrop instead.
- **Dark muted text** `#9daadc` (`--ui-navy-400`): 4.5:1 even on frosted glass over a white backdrop.
- **Dark secondary text** `#bfcbf5` (`--ui-navy-250`): 4.5:1 on a selected row's 26% Sunflower tint
  (the mid step `#aebbea` was 4.33:1).
- **Status colours** are their own steps (green, orange, red: 700 on light, 300 on dark); warning is an
  orange rather than an amber so it doesn't read as the Sunflower primary.

The library-wide contract (`projects/ui/src/lib/style-contract.spec.ts`) checks Navy again under its
`dark` / `light` names with every other theme (glass over maps, frosted glass over white and black, the
feature-card tints, route lines, tier metals), and its `navy` suite checks that the Winter aliases
resolve to exactly the Navy tokens.

### Full results

#### Light (navy)


**Text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| text on bg | `#0f1433` | `#eef2ff` | 16.08 | 4.5 | Pass |
| text-secondary on bg | `#2d3a7a` | `#eef2ff` | 9.40 | 4.5 | Pass |
| text-muted on bg | `#46507e` | `#eef2ff` | 6.93 | 4.5 | Pass |
| text on surface | `#0f1433` | `#f7f9ff` | 17.08 | 4.5 | Pass |
| text-secondary on surface | `#2d3a7a` | `#f7f9ff` | 9.99 | 4.5 | Pass |
| text-muted on surface | `#46507e` | `#f7f9ff` | 7.36 | 4.5 | Pass |
| text on surface-raised | `#0f1433` | `#ffffff` | 17.98 | 4.5 | Pass |
| text-secondary on surface-raised | `#2d3a7a` | `#ffffff` | 10.51 | 4.5 | Pass |
| text-muted on surface-raised | `#46507e` | `#ffffff` | 7.75 | 4.5 | Pass |
| text on surface-subtle | `#0f1433` | `#e4eaff` | 14.99 | 4.5 | Pass |
| text-secondary on surface-subtle | `#2d3a7a` | `#e4eaff` | 8.77 | 4.5 | Pass |
| text-muted on surface-subtle | `#46507e` | `#e4eaff` | 6.46 | 4.5 | Pass |
| text on surface-hover | `#0f1433` | `#e4eaff` | 14.99 | 4.5 | Pass |
| text-muted on surface-hover | `#46507e` | `#e4eaff` | 6.46 | 4.5 | Pass |
| text-inverse on text | `#eef2ff` | `#0f1433` | 16.08 | 4.5 | Pass |
| text on selected (raised) | `#0f1433` | `#e7e8eb` | 14.62 | 4.5 | Pass |
| text-muted on selected (raised) | `#46507e` | `#e7e8eb` | 6.30 | 4.5 | Pass |
| text on primary 26% tint (raised) | `#0f1433` | `#dcd4bd` | 12.12 | 4.5 | Pass |
| text-secondary on primary 26% tint (raised) | `#2d3a7a` | `#dcd4bd` | 7.09 | 4.5 | Pass |

**Button & badge labels**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary-contrast on primary | `#ffffff` | `#7a5800` | 6.51 | 4.5 | Pass |
| primary-contrast on primary-hover | `#ffffff` | `#6a4c00` | 7.93 | 4.5 | Pass |
| primary-contrast on primary-active | `#ffffff` | `#5a4100` | 9.59 | 4.5 | Pass |
| secondary-contrast on secondary | `#0f1433` | `#c9d6ff` | 12.45 | 4.5 | Pass |
| secondary-contrast on secondary-hover | `#0f1433` | `#b7c7ff` | 10.81 | 4.5 | Pass |
| danger-contrast on danger | `#ffffff` | `#b0303a` | 6.31 | 4.5 | Pass |
| danger-contrast on danger-hover | `#ffffff` | `#922831` | 8.17 | 4.5 | Pass |
| success-contrast on success | `#ffffff` | `#23673f` | 6.81 | 4.5 | Pass |
| warning-contrast on warning | `#ffffff` | `#a34700` | 6.07 | 4.5 | Pass |
| info-contrast on info | `#ffffff` | `#2d3a7a` | 10.51 | 4.5 | Pass |
| accent-contrast on accent | `#0f1433` | `#ffc93c` | 11.70 | 4.5 | Pass |
| tier-gold-contrast on tier-gold | `#2b1e00` | `#d9a520` | 7.26 | 4.5 | Pass |
| tier-gold-contrast on tier-gold-light | `#2b1e00` | `#f2d272` | 11.05 | 4.5 | Pass |
| tier-platinum-contrast on tier-platinum | `#1f2933` | `#cdd4dd` | 9.88 | 4.5 | Pass |
| tier-platinum-contrast on tier-platinum-light | `#1f2933` | `#eef1f5` | 13.02 | 4.5 | Pass |
| tier-premium-contrast on tier-premium | `#ffffff` | `#4a2fb0` | 9.03 | 4.5 | Pass |
| tier-premium-contrast on tier-premium-light | `#ffffff` | `#6e52d9` | 5.42 | 4.5 | Pass |
| primary-contrast on gradient-brand start | `#ffffff` | `#0f1433` | 17.98 | 4.5 | Pass |
| primary-contrast on gradient-brand end | `#ffffff` | `#2d3a7a` | 10.51 | 4.5 | Pass |

**Links & status text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary on bg | `#7a5800` | `#eef2ff` | 5.83 | 4.5 | Pass |
| primary-hover on bg | `#6a4c00` | `#eef2ff` | 7.10 | 4.5 | Pass |
| danger on bg | `#b0303a` | `#eef2ff` | 5.64 | 4.5 | Pass |
| success on bg | `#23673f` | `#eef2ff` | 6.09 | 4.5 | Pass |
| warning on bg | `#a34700` | `#eef2ff` | 5.43 | 4.5 | Pass |
| info on bg | `#2d3a7a` | `#eef2ff` | 9.40 | 4.5 | Pass |
| accent-strong on bg | `#7a5800` | `#eef2ff` | 5.83 | 4.5 | Pass |
| primary on surface | `#7a5800` | `#f7f9ff` | 6.19 | 4.5 | Pass |
| primary-hover on surface | `#6a4c00` | `#f7f9ff` | 7.54 | 4.5 | Pass |
| danger on surface | `#b0303a` | `#f7f9ff` | 5.99 | 4.5 | Pass |
| success on surface | `#23673f` | `#f7f9ff` | 6.47 | 4.5 | Pass |
| warning on surface | `#a34700` | `#f7f9ff` | 5.77 | 4.5 | Pass |
| info on surface | `#2d3a7a` | `#f7f9ff` | 9.99 | 4.5 | Pass |
| accent-strong on surface | `#7a5800` | `#f7f9ff` | 6.19 | 4.5 | Pass |
| primary on surface-raised | `#7a5800` | `#ffffff` | 6.51 | 4.5 | Pass |
| primary-hover on surface-raised | `#6a4c00` | `#ffffff` | 7.93 | 4.5 | Pass |
| danger on surface-raised | `#b0303a` | `#ffffff` | 6.31 | 4.5 | Pass |
| success on surface-raised | `#23673f` | `#ffffff` | 6.81 | 4.5 | Pass |
| warning on surface-raised | `#a34700` | `#ffffff` | 6.07 | 4.5 | Pass |
| info on surface-raised | `#2d3a7a` | `#ffffff` | 10.51 | 4.5 | Pass |
| accent-strong on surface-raised | `#7a5800` | `#ffffff` | 6.51 | 4.5 | Pass |

**Controls & focus (non-text)**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| control-border on bg | `#6673b0` | `#eef2ff` | 4.04 | 3 | Pass |
| border-focus on bg | `#2d3a7a` | `#eef2ff` | 9.40 | 3 | Pass |
| checked / selected indicator on bg | `#7a5800` | `#eef2ff` | 5.83 | 3 | Pass |
| error border on bg | `#b0303a` | `#eef2ff` | 5.64 | 3 | Pass |
| switch-track on bg | `#6673b0` | `#eef2ff` | 4.04 | 3 | Pass |
| control-border on surface | `#6673b0` | `#f7f9ff` | 4.30 | 3 | Pass |
| border-focus on surface | `#2d3a7a` | `#f7f9ff` | 9.99 | 3 | Pass |
| checked / selected indicator on surface | `#7a5800` | `#f7f9ff` | 6.19 | 3 | Pass |
| error border on surface | `#b0303a` | `#f7f9ff` | 5.99 | 3 | Pass |
| switch-track on surface | `#6673b0` | `#f7f9ff` | 4.30 | 3 | Pass |
| control-border on surface-raised | `#6673b0` | `#ffffff` | 4.52 | 3 | Pass |
| border-focus on surface-raised | `#2d3a7a` | `#ffffff` | 10.51 | 3 | Pass |
| checked / selected indicator on surface-raised | `#7a5800` | `#ffffff` | 6.51 | 3 | Pass |
| error border on surface-raised | `#b0303a` | `#ffffff` | 6.31 | 3 | Pass |
| switch-track on surface-raised | `#6673b0` | `#ffffff` | 4.52 | 3 | Pass |
| switch-thumb on switch-track | `#ffffff` | `#6673b0` | 4.52 | 3 | Pass |
| switch-thumb-checked on switch-track-checked | `#ffffff` | `#7a5800` | 6.51 | 3 | Pass |
| progress / slider fill on track | `#7a5800` | `#dce4ff` | 5.15 | 3 | Pass |
| slider thumb (slider-thumb) on fill | `#ffffff` | `#7a5800` | 6.51 | 3 | Pass |
| slider thumb (slider-thumb-border) on track | `#6673b0` | `#dce4ff` | 3.57 | 3 | Pass |

**Informational (exempt)**

| Pair | Foreground | Background | Ratio |
|---|---|---|---:|
| text-disabled on bg | `#6673b0` | `#eef2ff` | 4.04 |
| text-disabled on surface-raised | `#6673b0` | `#ffffff` | 4.52 |
| border on bg | `#c9d6ff` | `#eef2ff` | 1.29 |
| border-subtle on surface-raised | `#dce4ff` | `#ffffff` | 1.27 |
| surface-raised vs bg | `#ffffff` | `#eef2ff` | 1.12 |
| skeleton on raised card | `#dce4ff` | `#ffffff` | 1.27 |

#### Dark (navy-dark)


**Text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| text on bg | `#c9d6ff` | `#0f1433` | 12.45 | 4.5 | Pass |
| text-secondary on bg | `#bfcbf5` | `#0f1433` | 11.19 | 4.5 | Pass |
| text-muted on bg | `#9daadc` | `#0f1433` | 7.89 | 4.5 | Pass |
| text on surface | `#c9d6ff` | `#151b3f` | 11.54 | 4.5 | Pass |
| text-secondary on surface | `#bfcbf5` | `#151b3f` | 10.37 | 4.5 | Pass |
| text-muted on surface | `#9daadc` | `#151b3f` | 7.31 | 4.5 | Pass |
| text on surface-raised | `#c9d6ff` | `#1b224b` | 10.56 | 4.5 | Pass |
| text-secondary on surface-raised | `#bfcbf5` | `#1b224b` | 9.50 | 4.5 | Pass |
| text-muted on surface-raised | `#9daadc` | `#1b224b` | 6.69 | 4.5 | Pass |
| text on surface-subtle | `#c9d6ff` | `#0a0e26` | 13.18 | 4.5 | Pass |
| text-secondary on surface-subtle | `#bfcbf5` | `#0a0e26` | 11.85 | 4.5 | Pass |
| text-muted on surface-subtle | `#9daadc` | `#0a0e26` | 8.35 | 4.5 | Pass |
| text on surface-hover | `#c9d6ff` | `#232b59` | 9.32 | 4.5 | Pass |
| text-muted on surface-hover | `#9daadc` | `#232b59` | 5.90 | 4.5 | Pass |
| text-inverse on text | `#0f1433` | `#c9d6ff` | 12.45 | 4.5 | Pass |
| text on selected (raised) | `#c9d6ff` | `#333b64` | 7.43 | 4.5 | Pass |
| text-muted on selected (raised) | `#9daadc` | `#333b64` | 4.71 | 4.5 | Pass |
| text on primary 26% tint (raised) | `#c9d6ff` | `#564d47` | 5.68 | 4.5 | Pass |
| text-secondary on primary 26% tint (raised) | `#bfcbf5` | `#564d47` | 5.10 | 4.5 | Pass |

**Button & badge labels**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary-contrast on primary | `#0f1433` | `#ffc93c` | 11.70 | 4.5 | Pass |
| primary-contrast on primary-hover | `#0f1433` | `#ffd873` | 13.12 | 4.5 | Pass |
| primary-contrast on primary-active | `#0f1433` | `#f2b91e` | 10.04 | 4.5 | Pass |
| secondary-contrast on secondary | `#0f1433` | `#c9d6ff` | 12.45 | 4.5 | Pass |
| secondary-contrast on secondary-hover | `#0f1433` | `#dce4ff` | 14.20 | 4.5 | Pass |
| danger-contrast on danger | `#0f1433` | `#ff9c9c` | 8.98 | 4.5 | Pass |
| danger-contrast on danger-hover | `#0f1433` | `#ffb8b8` | 10.96 | 4.5 | Pass |
| success-contrast on success | `#0f1433` | `#8fd3ae` | 10.36 | 4.5 | Pass |
| warning-contrast on warning | `#0f1433` | `#ffa463` | 9.20 | 4.5 | Pass |
| info-contrast on info | `#0f1433` | `#c9d6ff` | 12.45 | 4.5 | Pass |
| accent-contrast on accent | `#0f1433` | `#ffc93c` | 11.70 | 4.5 | Pass |
| tier-gold-contrast on tier-gold | `#2b1e00` | `#d9a520` | 7.26 | 4.5 | Pass |
| tier-gold-contrast on tier-gold-light | `#2b1e00` | `#f2d272` | 11.05 | 4.5 | Pass |
| tier-platinum-contrast on tier-platinum | `#1f2933` | `#cdd4dd` | 9.88 | 4.5 | Pass |
| tier-platinum-contrast on tier-platinum-light | `#1f2933` | `#eef1f5` | 13.02 | 4.5 | Pass |
| tier-premium-contrast on tier-premium | `#ffffff` | `#4a2fb0` | 9.03 | 4.5 | Pass |
| tier-premium-contrast on tier-premium-light | `#ffffff` | `#6e52d9` | 5.42 | 4.5 | Pass |
| primary-contrast on gradient-brand start | `#0f1433` | `#ffc93c` | 11.70 | 4.5 | Pass |
| primary-contrast on gradient-brand end | `#0f1433` | `#ffd873` | 13.12 | 4.5 | Pass |

**Links & status text**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| primary on bg | `#ffc93c` | `#0f1433` | 11.70 | 4.5 | Pass |
| primary-hover on bg | `#ffd873` | `#0f1433` | 13.12 | 4.5 | Pass |
| danger on bg | `#ff9c9c` | `#0f1433` | 8.98 | 4.5 | Pass |
| success on bg | `#8fd3ae` | `#0f1433` | 10.36 | 4.5 | Pass |
| warning on bg | `#ffa463` | `#0f1433` | 9.20 | 4.5 | Pass |
| info on bg | `#c9d6ff` | `#0f1433` | 12.45 | 4.5 | Pass |
| accent-strong on bg | `#ffd873` | `#0f1433` | 13.12 | 4.5 | Pass |
| primary on surface | `#ffc93c` | `#151b3f` | 10.85 | 4.5 | Pass |
| primary-hover on surface | `#ffd873` | `#151b3f` | 12.16 | 4.5 | Pass |
| danger on surface | `#ff9c9c` | `#151b3f` | 8.32 | 4.5 | Pass |
| success on surface | `#8fd3ae` | `#151b3f` | 9.60 | 4.5 | Pass |
| warning on surface | `#ffa463` | `#151b3f` | 8.52 | 4.5 | Pass |
| info on surface | `#c9d6ff` | `#151b3f` | 11.54 | 4.5 | Pass |
| accent-strong on surface | `#ffd873` | `#151b3f` | 12.16 | 4.5 | Pass |
| primary on surface-raised | `#ffc93c` | `#1b224b` | 9.93 | 4.5 | Pass |
| primary-hover on surface-raised | `#ffd873` | `#1b224b` | 11.13 | 4.5 | Pass |
| danger on surface-raised | `#ff9c9c` | `#1b224b` | 7.62 | 4.5 | Pass |
| success on surface-raised | `#8fd3ae` | `#1b224b` | 8.78 | 4.5 | Pass |
| warning on surface-raised | `#ffa463` | `#1b224b` | 7.80 | 4.5 | Pass |
| info on surface-raised | `#c9d6ff` | `#1b224b` | 10.56 | 4.5 | Pass |
| accent-strong on surface-raised | `#ffd873` | `#1b224b` | 11.13 | 4.5 | Pass |

**Controls & focus (non-text)**

| Pair | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---:|---:|---|
| control-border on bg | `#6673b0` | `#0f1433` | 3.98 | 3 | Pass |
| border-focus on bg | `#ffc93c` | `#0f1433` | 11.70 | 3 | Pass |
| checked / selected indicator on bg | `#ffc93c` | `#0f1433` | 11.70 | 3 | Pass |
| error border on bg | `#ff9c9c` | `#0f1433` | 8.98 | 3 | Pass |
| switch-track on bg | `#6673b0` | `#0f1433` | 3.98 | 3 | Pass |
| control-border on surface | `#6673b0` | `#151b3f` | 3.68 | 3 | Pass |
| border-focus on surface | `#ffc93c` | `#151b3f` | 10.85 | 3 | Pass |
| checked / selected indicator on surface | `#ffc93c` | `#151b3f` | 10.85 | 3 | Pass |
| error border on surface | `#ff9c9c` | `#151b3f` | 8.32 | 3 | Pass |
| switch-track on surface | `#6673b0` | `#151b3f` | 3.68 | 3 | Pass |
| control-border on surface-raised | `#6673b0` | `#1b224b` | 3.37 | 3 | Pass |
| border-focus on surface-raised | `#ffc93c` | `#1b224b` | 9.93 | 3 | Pass |
| checked / selected indicator on surface-raised | `#ffc93c` | `#1b224b` | 9.93 | 3 | Pass |
| error border on surface-raised | `#ff9c9c` | `#1b224b` | 7.62 | 3 | Pass |
| switch-track on surface-raised | `#6673b0` | `#1b224b` | 3.37 | 3 | Pass |
| switch-thumb on switch-track | `#c9d6ff` | `#6673b0` | 3.13 | 3 | Pass |
| switch-thumb-checked on switch-track-checked | `#0f1433` | `#ffc93c` | 11.70 | 3 | Pass |
| progress / slider fill on track | `#ffc93c` | `#2c3568` | 7.53 | 3 | Pass |
| slider thumb (slider-thumb-border) on fill | `#0f1433` | `#ffc93c` | 11.70 | 3 | Pass |
| slider thumb (slider-thumb) on track | `#c9d6ff` | `#2c3568` | 8.01 | 3 | Pass |

**Informational (exempt)**

| Pair | Foreground | Background | Ratio |
|---|---|---|---:|
| text-disabled on bg | `#6673b0` | `#0f1433` | 3.98 |
| text-disabled on surface-raised | `#6673b0` | `#1b224b` | 3.37 |
| border on bg | `#38427a` | `#0f1433` | 1.91 |
| border-subtle on surface-raised | `#232b59` | `#1b224b` | 1.13 |
| surface-raised vs bg | `#1b224b` | `#0f1433` | 1.18 |
| skeleton on raised card | `#232b59` | `#1b224b` | 1.13 |

---

## 7. CSS variables

The complete source is `projects/ui/styles/tokens.css`. The Navy theme blocks:

```css
/* ── Navy Dark (default `dark`, also `navy-dark`; `winterDark` is a deprecated alias) ──────────
   Midnight Navy stepped up for the surfaces, Powder Blue as the ink and the secondary tone, Sunflower
   as the primary. Core tokens also live on :root so a page with no data-theme at all still renders
   Navy Dark. */
:root,
[data-theme="dark"],
[data-theme="navy-dark"],
[data-theme="winterDark"] {
  color-scheme: dark;

  --ui-color-bg: var(--ui-navy-950);
  --ui-color-surface: var(--ui-navy-900);
  --ui-color-surface-raised: var(--ui-navy-850);
  /* Powder Blue: 12.5:1 on the canvas, 10.4:1 on raised surfaces. */
  --ui-color-text: var(--ui-navy-200);
  --ui-color-text-muted: var(--ui-navy-400);
  --ui-color-border: var(--ui-navy-700);
  --ui-color-primary: var(--ui-navy-sun-400);
  --ui-color-primary-hover: var(--ui-navy-sun-300);
  --ui-color-primary-contrast: var(--ui-navy-950);
  --ui-color-secondary: var(--ui-navy-200);
  --ui-color-success: var(--ui-navy-green-300);
  --ui-color-warning: var(--ui-navy-orange-300);
  --ui-color-danger: var(--ui-navy-red-300);
  /* Frosted glass (glassStrength="frosted"; bottom sheet, floating panel): the backdrop is held between these, so text stays AA over white or black. */
  --ui-glass-sheet-floor: 0;
  --ui-glass-sheet-ceiling: 0.43;
  /* Clear glass (the default glassStrength, 0.41.3): the range for a map in this theme's brightness. */
  --ui-glass-clear-floor: 0;
  --ui-glass-clear-ceiling: 0.85;
}

:root:not([data-theme]),
[data-theme="dark"],
[data-theme="navy-dark"],
[data-theme="winterDark"] {
  --ui-color-surface-subtle: var(--ui-navy-1000);
  --ui-color-surface-hover: var(--ui-navy-800);
  --ui-color-elevated-hover: var(--ui-navy-800);
  --ui-color-text-secondary: var(--ui-navy-250);
  --ui-color-text-disabled: var(--ui-navy-500);
  --ui-color-text-inverse: var(--ui-navy-950);
  --ui-color-border-subtle: var(--ui-navy-800);
  --ui-color-border-strong: var(--ui-navy-500);
  --ui-color-border-focus: var(--ui-navy-sun-400);
  --ui-color-primary-active: var(--ui-navy-sun-500);
  --ui-color-secondary-hover: var(--ui-navy-100);
  --ui-color-secondary-contrast: var(--ui-navy-950);
  --ui-color-accent: var(--ui-navy-sun-400);
  --ui-color-accent-subtle: var(--ui-navy-sun-950);
  --ui-color-accent-strong: var(--ui-navy-sun-300);
  --ui-color-accent-contrast: var(--ui-navy-950);
  --ui-color-info: var(--ui-navy-200);
  --ui-color-info-contrast: var(--ui-navy-950);
  --ui-color-success-contrast: var(--ui-navy-950);
  --ui-color-warning-contrast: var(--ui-navy-950);
  --ui-color-danger-contrast: var(--ui-navy-950);
  --ui-color-danger-hover: var(--ui-navy-red-200);
  --ui-color-selected: rgba(201, 214, 255, 0.14);
  --ui-color-track: var(--ui-navy-750);
  --ui-color-overlay: rgba(5, 7, 20, 0.72);

  --ui-switch-track: var(--ui-navy-500);
  --ui-switch-thumb: var(--ui-navy-200);
  --ui-switch-thumb-checked: var(--ui-navy-950);
  --ui-slider-thumb: var(--ui-navy-200);
  --ui-slider-thumb-border: var(--ui-navy-950);
  /* One step above the raised surface, so a skeleton inside a card is still visible at rest. */
  --ui-skeleton-base: var(--ui-navy-800);
  --ui-skeleton-highlight: var(--ui-navy-750);
  /* Navy's muted text is blue, which reads as the secondary fill; a true grey for the neutral tone. */
  --ui-progress-neutral: #a1a6b4;
  --ui-scroll-progress-track: rgba(201, 214, 255, 0.06);
  --ui-media-bg: #000000;
  --ui-media-scrim: #000000;
  --ui-media-on-scrim: var(--ui-navy-25);
  --ui-media-danger: var(--ui-navy-red-300);
  --ui-cursor-color: var(--ui-navy-200);
  --ui-section-label-bracket: var(--ui-color-accent-strong);

  --ui-gradient-brand: linear-gradient(90deg, #ffc93c 0%, #ffd873 100%);
  --ui-gradient-hero: linear-gradient(160deg, #0f1433 0%, #2c3568 100%);
  --ui-gradient-frost: linear-gradient(135deg, #2c3568 0%, #6673b0 100%);
  --ui-gradient-snow: linear-gradient(135deg, #151b3f 0%, #1b224b 100%);
  --ui-gradient-highlight: linear-gradient(180deg, rgba(201, 214, 255, 0.14) 0%, rgba(201, 214, 255, 0) 100%);
  --ui-glow-amber: 0 0 28px rgba(255, 201, 60, 0.28);

  --ui-glass-bg: rgba(201, 214, 255, 0.06);
  --ui-glass-border: rgba(201, 214, 255, 0.13);
  --ui-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.6);
  --ui-shadow-2: 0 8px 24px rgba(0, 0, 0, 0.7);
  --ui-shadow-3: 0 16px 48px rgba(0, 0, 0, 0.8);

  /* Map route tones that hold 3:1 over the map tiles here (see tokens.css). */
  --ui-map-route-muted: var(--ui-navy-300);

  /* ui-liquid-backdrop (@zouriel/ui/fx) in Navy: faint pools of Powder Blue and Sunflower on Midnight. */
  --ui-liquid-main: #0f1433;
  --ui-liquid-second: #c9d6ff;
  --ui-liquid-accent: #ffc93c;
  --ui-liquid-ink: #c9d6ff;
  --ui-liquid-second-strength: 10%;
  --ui-liquid-accent-strength: 10%;
}

/* ── Navy Light (default `light`, also `navy`; `winterLight` is a deprecated alias) ─────────────
   A Mist canvas with white cards, Midnight Navy ink, Powder Blue for secondary fills and borders, and
   Sunflower deepened to a dark gold for the primary (Sunflower itself is 1.4:1 on Mist; it stays for
   the accent fill, the backdrop, the glow and highlights). */
[data-theme="light"],
[data-theme="navy"],
[data-theme="winterLight"] {
  color-scheme: light;
  /* Frosted glass (glassStrength="frosted"; bottom sheet, floating panel): the backdrop is held between these, so text stays AA over white or black. */
  --ui-glass-sheet-floor: 0.70;
  --ui-glass-sheet-ceiling: 1;
  /* Clear glass (the default glassStrength, 0.41.3): the range for a map in this theme's brightness. */
  --ui-glass-clear-floor: 0.35;
  --ui-glass-clear-ceiling: 1;

  --ui-color-bg: var(--ui-navy-50);
  --ui-color-surface: var(--ui-navy-25);
  --ui-color-surface-raised: var(--ui-navy-white);
  --ui-color-text: var(--ui-navy-950);
  --ui-color-text-muted: var(--ui-navy-650);
  --ui-color-border: var(--ui-navy-200);
  --ui-color-primary: var(--ui-navy-sun-700);
  --ui-color-primary-hover: var(--ui-navy-sun-800);
  --ui-color-primary-contrast: var(--ui-navy-white);
  --ui-color-secondary: var(--ui-navy-200);
  --ui-color-success: var(--ui-navy-green-700);
  --ui-color-warning: var(--ui-navy-orange-700);
  --ui-color-danger: var(--ui-navy-red-700);

  --ui-color-surface-subtle: var(--ui-navy-75);
  --ui-color-surface-hover: var(--ui-navy-75);
  --ui-color-elevated-hover: var(--ui-navy-75);
  --ui-color-text-secondary: var(--ui-navy-725);
  --ui-color-text-disabled: var(--ui-navy-500);
  --ui-color-text-inverse: var(--ui-navy-50);
  --ui-color-border-subtle: var(--ui-navy-100);
  --ui-color-border-strong: var(--ui-navy-500);
  --ui-color-border-focus: var(--ui-navy-725);
  --ui-color-primary-active: var(--ui-navy-sun-900);
  --ui-color-secondary-hover: var(--ui-navy-275);
  --ui-color-secondary-contrast: var(--ui-navy-950);
  --ui-color-accent: var(--ui-navy-sun-400);
  --ui-color-accent-subtle: var(--ui-navy-sun-50);
  --ui-color-accent-strong: var(--ui-navy-sun-700);
  --ui-color-accent-contrast: var(--ui-navy-950);
  --ui-color-info: var(--ui-navy-725);
  --ui-color-info-contrast: var(--ui-navy-white);
  --ui-color-success-contrast: var(--ui-navy-white);
  --ui-color-warning-contrast: var(--ui-navy-white);
  --ui-color-danger-contrast: var(--ui-navy-white);
  --ui-color-danger-hover: var(--ui-navy-red-800);
  --ui-color-selected: rgba(15, 20, 51, 0.1);
  --ui-color-track: var(--ui-navy-100);
  --ui-color-overlay: rgba(15, 20, 51, 0.42);

  --ui-switch-track: var(--ui-navy-500);
  --ui-switch-thumb: var(--ui-navy-white);
  --ui-switch-thumb-checked: var(--ui-navy-white);
  --ui-slider-thumb: var(--ui-navy-white);
  /* 1.26:1 on white cards, and the shimmer a step lighter. */
  --ui-skeleton-base: var(--ui-navy-100);
  --ui-skeleton-highlight: var(--ui-navy-50);
  --ui-progress-neutral: #686e73; /* a true grey, 4:1 on the track */
  --ui-scroll-progress-track: rgba(15, 20, 51, 0.06);
  --ui-media-bg: var(--ui-navy-950);
  --ui-media-scrim: var(--ui-navy-1000);
  --ui-media-on-scrim: var(--ui-navy-25);
  --ui-media-danger: var(--ui-navy-red-300);
  --ui-cursor-color: var(--ui-navy-950);
  --ui-section-label-bracket: var(--ui-navy-sun-400);

  --ui-gradient-brand: linear-gradient(90deg, #0f1433 0%, #2d3a7a 100%);
  --ui-gradient-hero: linear-gradient(160deg, #0f1433 0%, #2d3a7a 70%, #6673b0 100%);
  --ui-gradient-frost: linear-gradient(135deg, #6673b0 0%, #c9d6ff 100%);
  --ui-gradient-snow: linear-gradient(135deg, #c9d6ff 0%, #dce4ff 100%);
  --ui-gradient-highlight: linear-gradient(180deg, rgba(255, 201, 60, 0.22) 0%, rgba(255, 201, 60, 0) 100%);
  --ui-glow-amber: 0 8px 24px rgba(255, 201, 60, 0.35);

  --ui-glass-bg: rgba(255, 255, 255, 0.9);
  --ui-glass-border: rgba(15, 20, 51, 0.12);
  --ui-shadow-1: 0 1px 2px rgba(15, 20, 51, 0.07);
  --ui-shadow-2: 0 8px 24px rgba(15, 20, 51, 0.1);
  --ui-shadow-3: 0 16px 48px rgba(15, 20, 51, 0.16);

  /* ui-liquid-backdrop in Navy: Powder Blue and Sunflower pooling on Mist. */
  --ui-liquid-main: #eef2ff;
  --ui-liquid-second: #c9d6ff;
  --ui-liquid-accent: #ffc93c;
  --ui-liquid-ink: #0f1433;
  --ui-liquid-second-strength: 60%;
  --ui-liquid-accent-strength: 45%;
}

[data-theme="dark"] ::selection,
[data-theme="navy-dark"] ::selection,
[data-theme="winterDark"] ::selection {
  background: rgba(255, 201, 60, 0.32);
  color: #f7f9ff;
}
[data-theme="light"] ::selection,
[data-theme="navy"] ::selection,
[data-theme="winterLight"] ::selection {
  background: #c9d6ff;
  color: #0f1433;
}
```

---

## 8. Usage guidelines

- **Read semantic tokens only.** Use `--ui-color-*`, or a component token, in components and app code. Never use `--ui-navy-*` or raw hex.
- **Pair every fill with its `-contrast` token.** For example, `danger` goes with `danger-contrast`. `primary-contrast` is Midnight Navy in dark mode and white in light mode, so it is not a generic "white".
- **Separate text and fill roles.**
  - `accent` (Sunflower) is a fill. For accent-coloured text or icons use `accent-strong` (Sunflower deepened on light).
  - Use Sunflower sparingly as a fill on light: a highlight badge, a featured marker, one warm detail per view.
- **Never put Powder Blue on a large dark surface.** It is the dark ink; as a panel it would glare and turn the hierarchy upside down.
- **Pick borders by role.**
  - `border-subtle` for dividers and table rows.
  - `border` for cards and containers.
  - `border-strong` / `--ui-control-border` for anything a user must find to operate: inputs, checkboxes, radios.
  - `border-focus` for focus indicators only.
- **Keep text hierarchy to three steps.** `text` for content, `text-secondary` for supporting headings and labels, `text-muted` for captions and hints. Anything quieter is disabled and must not carry meaning.
- **Keep status colours for status.** Never use them as decoration or as a second brand colour.
- **Keep media chrome dark.** The lightbox, carousel, gallery and video player read `--ui-media-*`, which stays dark in both modes because it sits over photographs.
- **Use gradients in few places.**
  - *Allowed:* hero sections, featured or marketing cards, background decoration, callouts, the single brand CTA per view (`variant="brand"`), and `.ui-gradient-text` display headings.
  - *Not allowed:* ordinary buttons, inputs, nav, tables, badges, alerts or body text.
  - Prefer `--ui-gradient-hero` for large decorative surfaces, `--ui-gradient-frost` / `--ui-gradient-snow` for featured cards, and `--ui-gradient-highlight` as a top-fade over a surface.
- **Keep elevation quiet.** In light mode, elevation comes from the white raised surface plus a Midnight-tinted shadow, not from heavier borders. In dark mode, surfaces step up from Midnight in navy steps rather than greys.
- **Write new skins against the core tokens.** Set the core 13 tokens. The derived block fills in the rest, and you can override any extended token when its formula is not good enough.

---

## 9. Same components, light and dark

| Component | Light (`navy`) | Dark (`navy-dark`) |
|---|---|---|
| Page | `#eef2ff` Mist canvas, `#0f1433` text | `#0f1433` Midnight canvas, `#c9d6ff` text |
| Card | `#f7f9ff` on the canvas, `#c9d6ff` hairline, soft Midnight shadow | `#151b3f` surface, `#38427a` hairline, deep shadow |
| Primary button | `#7a5800` fill, `#ffffff` label; hover `#6a4c00` | `#ffc93c` fill, `#0f1433` label; hover `#ffd873` |
| Secondary button | `#c9d6ff` fill, `#0f1433` label | `#c9d6ff` fill, `#0f1433` label |
| Accent fill | `#ffc93c` Sunflower, `#0f1433` label | `#ffc93c` Sunflower, `#0f1433` label |
| Input | `#f7f9ff` field, `#6673b0` outline; focus `#2d3a7a` | `#151b3f` field, `#6673b0` outline; focus `#ffc93c` |
| Switch on | `#7a5800` track, white thumb | `#ffc93c` track, Midnight thumb |
| Badge (success) | `#23673f` fill, `#ffffff` label | `#8fd3ae` fill, `#0f1433` label |
| Modal | white panel over a 42% Midnight scrim | `#1b224b` panel over a 72% scrim |
| Skeleton | `#dce4ff` shimmering to `#eef2ff` | `#232b59` shimmering to `#2c3568` |

The showcase's Foundation page renders these components live; switch the theme in its top bar to compare.
