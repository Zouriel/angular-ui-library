import { InjectionToken, inject, type Provider } from '@angular/core';

/**
 * The library's own built-in words: names of icon-only buttons, default labels. English by default;
 * give an app's language with `provideUiStrings({ close: 'ބަންދުކުރޭ', … })` (partial: the rest stay
 * English). Text that comes from the app (titles, labels, items) is never here.
 *
 * Components with their own input for a word (ui-file-upload's label/hint, ui-split-button's
 * menuLabel) use that input first. The words still hard-coded elsewhere are listed in the README
 * ("Built-in strings").
 */
export interface UiStrings {
  /** Close buttons of modal, drawer, bottom sheet, lightbox. */
  close: string;
  /** Dismiss buttons of toast, alert, hint. */
  dismiss: string;
  /** Combobox clear button. */
  clear: string;
  /** Multi-select clear button. */
  clearAll: string;
  /** Search input clear button. */
  clearSearch: string;
  /** Pagination arrows. */
  previousPage: string;
  nextPage: string;
  /** Calendar and date range picker arrows. */
  previousMonth: string;
  nextMonth: string;
  /** The date picker's calendar dialog. */
  chooseDate: string;
  /** The split button's menu (caret) button. */
  moreActions: string;
  /** File upload: the action (in bold) and what follows it. */
  uploadLabel: string;
  uploadHint: string;
  /** Hold button: what holding does (read with the button), and its confirm dialog. */
  holdHint: string;
  confirmTitle: string;
  confirm: string;
  cancel: string;
  /** Map: the zoom buttons, and placing the pin at the centre (keyboard / screen reader). */
  zoomIn: string;
  zoomOut: string;
  placePinAtCentre: string;
  /** Map: the "my location" button, its off state (location off or denied), and the "you are here" dot. */
  mapLocate: string;
  mapLocationOff: string;
  mapYourLocation: string;
  /** Map preview (0.43.0): the still map's one button, which opens the full map. */
  mapOpen: string;
  /** Map search area (0.44.0): the radius handle's name, and the radius in metres / kilometres
   *  (`{n}` is the number). */
  mapSearchArea: string;
  mapRadiusMeters: string;
  mapRadiusKilometers: string;
  /** Google sign-in button: Google's approved wordings (a translation must keep the meaning: signing
   *  in to this app with a Google account, not creating one). */
  googleSignIn: string;
  googleSignUp: string;
  googleContinue: string;
  googleSignInShort: string;
  /** Sidebar layout: the menu (burger) button, the drawer's close button (shown to keyboard and
   *  screen-reader users), and the drawer's name. */
  sidebarToggle: string;
  sidebarClose: string;
  sidebarLabel: string;
}

export const defaultUiStrings: UiStrings = {
  close: 'Close',
  dismiss: 'Dismiss',
  clear: 'Clear',
  clearAll: 'Clear all',
  clearSearch: 'Clear search',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  chooseDate: 'Choose a date',
  moreActions: 'More actions',
  uploadLabel: 'Click to upload',
  uploadHint: 'or drag & drop',
  holdHint: 'Press and hold to confirm',
  confirmTitle: 'Are you sure?',
  confirm: 'Confirm',
  cancel: 'Cancel',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  placePinAtCentre: 'Place the pin at the centre',
  mapLocate: 'Show my location',
  mapLocationOff: 'Location is off',
  mapYourLocation: 'Your location',
  mapOpen: 'Open map',
  mapSearchArea: 'Search area',
  mapRadiusMeters: '{n} m',
  mapRadiusKilometers: '{n} km',
  googleSignIn: 'Sign in with Google',
  googleSignUp: 'Sign up with Google',
  googleContinue: 'Continue with Google',
  googleSignInShort: 'Sign in',
  sidebarToggle: 'Toggle navigation',
  sidebarClose: 'Close navigation',
  sidebarLabel: 'Navigation',
};

export const UI_STRINGS = new InjectionToken<UiStrings>('UI_STRINGS', { providedIn: 'root', factory: () => defaultUiStrings });

/** Replaces some of the library's built-in words (the rest stay English). */
export function provideUiStrings(strings: Partial<UiStrings>): Provider {
  return { provide: UI_STRINGS, useValue: { ...defaultUiStrings, ...strings } };
}

/** The built-in words in effect (inside an injection context). */
export function injectUiStrings(): UiStrings {
  return inject(UI_STRINGS, { optional: true }) ?? defaultUiStrings;
}
