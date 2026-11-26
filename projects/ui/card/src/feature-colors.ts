/**
 * Custom colours for `ui-feature-card` (`[colors]`): an app's own surface and accent for a card, with
 * the dark-theme pair derived when it isn't given, and every colour checked for contrast. The same
 * sums run in the Flutter twin (`UiFeatureCardColors`), so both libraries pick the same colours.
 */

/** A card's own colours. Strings are hex (`#rgb`, `#rrggbb`, with or without alpha) or `rgb()` / `rgba()`. */
export interface UiFeatureCardColors {
  /** The card's background (the wash; with `surface="tinted"` it replaces the tone's). */
  surface: string;
  /** The badge tint (14% over the surface), the icon, the trailing arrow, the hover/focus border and the action words. */
  accent: string;
  /** The surface on a dark theme. Derived when left out: the accent 18% into the theme's surface. */
  surfaceDark?: string;
  /** The accent on a dark theme. Derived when left out: lightened until it reads 4.5:1 on the surface. */
  accentDark?: string;
}

export type UiRgb = readonly [number, number, number];
/** A colour with its alpha (0 to 1). */
export type UiRgba = readonly [number, number, number, number];

/** The theme colours the resolver needs: its surface, text and muted text (either may be translucent), and whether it is dark. */
export interface UiFeatureColorTheme {
  surface: UiRgb;
  text: UiRgba;
  muted: UiRgba;
  dark: boolean;
}

/** What a card with custom colours draws, as `#rrggbb`. */
export interface UiFeatureResolvedColors {
  /** The card's background. */
  surface: string;
  /** Icon, arrow and hover/focus border: at least 3:1 on the surface and on the badge (4.5:1 on a dark theme). */
  accent: string;
  /** The badge fill. */
  badge: string;
  /** The action words and eyebrow: the accent, deepened (or lightened) until 4.5:1 on the surface. */
  ink: string;
  /** The description: the theme's muted text, moved towards the text until 4.5:1 on the surface. */
  desc: string;
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, n));

/** Parses `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(r, g, b)`, `rgba(r g b / a)` with its alpha; null when it isn't one. */
export function uiParseColorAlpha(value: string | null | undefined): UiRgba | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (m) {
    const h = m[1];
    const short = h.length <= 4;
    const at = (i: number) => (short ? parseInt(h[i] + h[i], 16) : parseInt(h.slice(i * 2, i * 2 + 2), 16));
    const hasAlpha = h.length === 4 || h.length === 8;
    return [at(0), at(1), at(2), hasAlpha ? at(3) / 255 : 1];
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/);
  if (m) {
    const c = [m[1], m[2], m[3]].map(Number);
    if (c.some((n) => !Number.isFinite(n) || n > 255)) return null;
    const a = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
    if (!Number.isFinite(a) || a > 1) return null;
    return [c[0], c[1], c[2], a];
  }
  return null;
}

/** Like uiParseColorAlpha, without the alpha (the app's own colours are taken as opaque). */
export function uiParseColor(value: string | null | undefined): UiRgb | null {
  const c = uiParseColorAlpha(value);
  return c ? [c[0], c[1], c[2]] : null;
}

/** A translucent colour composited over an opaque ground. */
export function uiOver(c: UiRgba, ground: UiRgb): UiRgb {
  return uiMix([c[0], c[1], c[2]], ground, c[3]);
}

export function uiToHex(c: UiRgb): string {
  return '#' + c.map((n) => Math.round(clamp255(n)).toString(16).padStart(2, '0')).join('');
}

/** `k` of `a` over `1 - k` of `b` (CSS `color-mix(in srgb, a k, b)`). */
export function uiMix(a: UiRgb, b: UiRgb, k: number): UiRgb {
  return [0, 1, 2].map((i) => a[i] * k + b[i] * (1 - k)) as unknown as UiRgb;
}

export function uiLuminance(c: UiRgb): number {
  const ch = (x: number) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
}

/** WCAG contrast ratio. */
export function uiContrast(a: UiRgb, b: UiRgb): number {
  const x = uiLuminance(a);
  const y = uiLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Whole channel values: what `#rrggbb` will hold, so every check is made on the colour actually drawn. */
const round = (c: UiRgb): UiRgb => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];

/** Moves `c` towards `to` in 2% steps until `ok` holds (or it reaches `to`). */
function towards(c: UiRgb, to: UiRgb, ok: (c: UiRgb) => boolean): UiRgb {
  for (let k = 0; k <= 1.0001; k += 0.02) {
    const x = round(uiMix(to, c, Math.min(1, k)));
    if (ok(x)) return x;
  }
  return round(to);
}

const WHITE: UiRgb = [255, 255, 255];

/**
 * The colours a card with `colors` draws on a theme; null when a colour string can't be read (the
 * card then keeps its tone).
 */
export function uiResolveFeatureColors(colors: UiFeatureCardColors, theme: UiFeatureColorTheme): UiFeatureResolvedColors | null {
  const surface = uiParseColor(colors.surface);
  const accent = uiParseColor(colors.accent);
  const surfaceDark = colors.surfaceDark == null ? null : uiParseColor(colors.surfaceDark);
  const accentDark = colors.accentDark == null ? null : uiParseColor(colors.accentDark);
  if (!surface || !accent || (colors.surfaceDark != null && !surfaceDark) || (colors.accentDark != null && !accentDark)) return null;

  const S = round(theme.dark ? (surfaceDark ?? uiMix(accent, theme.surface, 0.18)) : surface);
  const badgeOf = (a: UiRgb, k = 0.14) => round(uiMix(a, S, k));
  let A = theme.dark ? (accentDark ?? accent) : accent;
  if (theme.dark && !accentDark) {
    // Lighten until the arrow reads 4.5:1 on the card and the icon 3:1 on its badge.
    A = towards(A, WHITE, (a) => uiContrast(a, S) >= 4.5 && uiContrast(a, badgeOf(a)) >= 3);
  }
  // A lighter badge tint (down to 6%) before touching the app's accent.
  let k = 0.14;
  while (k > 0.06 + 1e-9 && uiContrast(A, badgeOf(A, k)) < 3) k -= 0.02;
  const text = round(uiOver(theme.text, S));
  const muted = round(uiOver(theme.muted, S));
  if (uiContrast(A, badgeOf(A, k)) < 3 || uiContrast(A, S) < 3) {
    // Still too faint: move the accent towards the text (darker on light, lighter on dark).
    A = towards(A, text, (a) => uiContrast(a, S) >= 3 && uiContrast(a, badgeOf(a, k)) >= 3);
  }
  const ink = uiContrast(A, S) >= 4.5 ? A : towards(A, text, (a) => uiContrast(a, S) >= 4.5);
  const desc = uiContrast(muted, S) >= 4.5 ? muted : towards(muted, text, (a) => uiContrast(a, S) >= 4.5);
  return { surface: uiToHex(S), accent: uiToHex(A), badge: uiToHex(badgeOf(A, k)), ink: uiToHex(ink), desc: uiToHex(desc) };
}
