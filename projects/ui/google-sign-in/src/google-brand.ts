import type { DestroyRef } from '@angular/core';
import { uiWatchTheme } from '@zouriel/ui';

/** The words on the drawn button (Google's approved wordings; the words come from UI_STRINGS). */
export type UiGoogleButtonText = 'signIn' | 'signUp' | 'continueWith' | 'signInShort';
/** Google's three button themes, plus 'auto': dark on a dark library theme, light otherwise. */
export type UiGoogleButtonTheme = 'auto' | 'light' | 'dark' | 'neutral';
/** Google's pre-approved shapes: 4px corners or fully rounded. */
export type UiGoogleButtonShape = 'rectangular' | 'pill';

/** The library themes that are dark (their stylesheets set `color-scheme: dark`). */
const DARK_THEMES = new Set(['dark', 'winterDark', 'darkOrange', 'darkPink', 'darkTeal', 'darkPurple', 'goldBlack', 'goldRed', 'maldives-dark']);

/**
 * Whether the library theme in effect at `el` is dark: its computed `color-scheme` when the theme
 * stylesheets set one, else the nearest `data-theme` name. No `data-theme` at all is Winter Dark
 * (`:root` is dark), the library's base.
 */
export function uiGoogleIsDarkTheme(el: Element): boolean {
  const scheme = (getComputedStyle(el).colorScheme || '').trim();
  const dark = /\bdark\b/.test(scheme);
  const light = /\blight\b/.test(scheme);
  if (dark !== light) return dark;
  const name = el.closest('[data-theme]')?.getAttribute('data-theme');
  return name == null ? true : DARK_THEMES.has(name);
}

/**
 * Calls `onChange` with whether the theme at `el` is dark, now and whenever anything that can change
 * the theme changes (see `uiWatchTheme`: a `data-theme`, a class or style up the tree, a stylesheet
 * arriving late, the device's preference), until `destroy`. Browser only (call after render).
 */
export function uiGoogleObserveTheme(el: Element, destroy: DestroyRef, onChange: (dark: boolean) => void): void {
  uiWatchTheme(el, destroy, () => onChange(uiGoogleIsDarkTheme(el)));
}
