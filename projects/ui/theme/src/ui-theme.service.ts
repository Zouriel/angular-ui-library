import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

/**
 * Built-in theme names.
 *
 * Current themes (use these for new work):
 *
 * - `dark` (default) and `light` are the Winter colour system (defined in
 *   `@zouriel/ui/styles/tokens.css`), also reachable by their explicit names
 *   `winterDark` and `winterLight`. See `@zouriel/ui/styles/COLOR-SYSTEM.md`.
 * - `darkOrange` is the cinematic ink/ember skin (grain, FX cursor, web fonts,
 *   glow) and requires `@zouriel/ui/styles/theme-dark-orange.css`. It was formerly
 *   named `dramatic`.
 * - `maldives` is the calm, light sea skin (Find Doctor brand: Ocean Deep, Lagoon, Coral, Sand,
 *   Mist; Poppins) with its own sea backdrops in `@zouriel/ui/fx`, and requires
 *   `@zouriel/ui/styles/theme-maldives.css`.
 * - `maldives-dark` is its night variant (deep ocean canvas, Foam ink, Lagoon primary, Coral
 *   accent), in the same stylesheet; toggle day/night by switching between the two names.
 * - The liquid themes, six day/night pairs in `@zouriel/ui/styles/theme-liquid.css`, made for
 *   glass surfaces over `ui-liquid-backdrop` (`@zouriel/ui/fx`): `rugged` / `rugged-dark`
 *   (Desert Sand, Olive Drab, Signal Yellow), `glacier` / `glacier-dark` (Ice White, Glacier Blue,
 *   Signal Red), `oxblood` / `oxblood-dark` (Bone, Charcoal, Oxblood) and `graphite` /
 *   `graphite-dark` (Light Grey, Slate, Safety Orange), `cocoa` / `cocoa-dark` (Cream, Cocoa,
 *   Raspberry) and `violet` / `violet-dark` (Mist, Ink, Electric Violet).
 *
 * Legacy themes (still supported and unchanged, but new work should use a current theme; see
 * {@link UI_LEGACY_THEMES} and {@link isLegacyTheme}):
 *
 * - The accent palettes `lightOrange`, `lightPink`, `darkPink`, `goldBlack`, `goldRed`,
 *   `lightTeal`, `darkTeal`, `lightPurple`, `darkPurple` and `lightPurpleGold`: colours-only skins
 *   in `@zouriel/ui/styles/theme-palettes.css`, with optional signature motion in
 *   `@zouriel/ui/styles/theme-animations.css`.
 *
 * Consumers may register their own theme names too — any string is accepted by
 * {@link UiThemeService.set}.
 */
export type UiTheme =
  | 'dark'
  | 'light'
  | 'winterDark'
  | 'winterLight'
  | 'darkOrange'
  | 'maldives'
  | 'maldives-dark'
  | 'rugged'
  | 'rugged-dark'
  | 'glacier'
  | 'glacier-dark'
  | 'oxblood'
  | 'oxblood-dark'
  | 'graphite'
  | 'graphite-dark'
  | 'cocoa'
  | 'cocoa-dark'
  | 'violet'
  | 'violet-dark'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'lightOrange'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'lightPink'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'darkPink'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'goldBlack'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'goldRed'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'lightTeal'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'darkTeal'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'lightPurple'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'darkPurple'
  /** @deprecated Legacy theme: still supported, but new work should use a current theme. */
  | 'lightPurpleGold'
  | (string & {});

/** The current built-in themes, in the order a theme picker lists them. */
export const UI_CURRENT_THEMES = [
  'dark',
  'light',
  'winterDark',
  'winterLight',
  'darkOrange',
  'maldives',
  'maldives-dark',
  'rugged',
  'rugged-dark',
  'glacier',
  'glacier-dark',
  'oxblood',
  'oxblood-dark',
  'graphite',
  'graphite-dark',
  'cocoa',
  'cocoa-dark',
  'violet',
  'violet-dark',
] as const;

/**
 * The legacy built-in themes: still supported and unchanged (same names, tokens and stylesheets), but
 * new work should use one of {@link UI_CURRENT_THEMES}. Pickers list them in a separate "Legacy" group.
 */
export const UI_LEGACY_THEMES = [
  'lightOrange',
  'lightPink',
  'darkPink',
  'goldBlack',
  'goldRed',
  'lightTeal',
  'darkTeal',
  'lightPurple',
  'darkPurple',
  'lightPurpleGold',
] as const;

/** A current built-in theme name. */
export type UiCurrentTheme = (typeof UI_CURRENT_THEMES)[number];
/** A legacy built-in theme name. */
export type UiLegacyTheme = (typeof UI_LEGACY_THEMES)[number];

/** Whether `name` is one of the legacy built-in themes ({@link UI_LEGACY_THEMES}). */
export function isLegacyTheme(name: string): name is UiLegacyTheme {
  return (UI_LEGACY_THEMES as readonly string[]).includes(name);
}

/** Built-in themes that come as a day/night pair named `x` and `x-dark`. */
const UI_DAY_NIGHT_PAIRS: readonly string[] = ['maldives', 'rugged', 'glacier', 'oxblood', 'graphite', 'cocoa', 'violet'];

/**
 * Global theme controller. Drives `data-theme` on the document root so the
 * token overrides in `@zouriel/ui/styles/tokens.css` take effect app-wide. For scoped
 * theming of a subtree, use {@link UiThemeProvider} instead.
 */
@Injectable({ providedIn: 'root' })
export class UiThemeService {
  private readonly doc = inject(DOCUMENT);

  /** Current global theme. Defaults to dark (Winter Dark, the library's base palette). */
  readonly theme = signal<UiTheme>('dark');

  constructor() {
    effect(() => {
      const root = this.doc.documentElement;
      if (root) {
        // setAttribute rather than dataset: a server-side DOM (prerendering) has no dataset.
        root.setAttribute('data-theme', this.theme());
      }
    });
  }

  set(theme: UiTheme): void {
    this.theme.set(theme);
  }

  /**
   * Flips day and night: a built-in `x` / `x-dark` pair (`maldives`, `rugged`, `glacier`, `oxblood`,
   * `graphite`, `cocoa`, `violet`) to its other half, and anything else between the light and dark Winter themes,
   * keeping whichever naming the app uses.
   */
  toggle(): void {
    this.theme.update((t) => {
      const day = t.endsWith('-dark') ? t.slice(0, -'-dark'.length) : t;
      if (UI_DAY_NIGHT_PAIRS.includes(day)) return day === t ? `${t}-dark` : day;
      if (t === 'winterDark') return 'winterLight';
      if (t === 'winterLight') return 'winterDark';
      return t === 'dark' ? 'light' : 'dark';
    });
  }
}
