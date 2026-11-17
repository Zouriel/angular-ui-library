/** A text field's writing direction: the native `dir`, with `auto` following the text typed. */
export type UiTextDir = 'ltr' | 'rtl' | 'auto';

/* Right-to-left scripts: Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan, Mandaic and the Arabic and
   Hebrew presentation forms, plus the RTL ranges of the supplementary planes. */
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]|[\u{10800}-\u{10FFF}\u{1E800}-\u{1EFFF}]/u;
const STRONG = /[\p{L}֐-ࣿיִ-﷿ﹰ-﻿]/u;

/**
 * The direction of [text] by its first strongly directional character, as the browser resolves
 * `dir="auto"`; null when it has none (no letters yet), so the field keeps the surrounding direction.
 */
export function uiTextDirection(text: string): 'ltr' | 'rtl' | null {
  for (const ch of text) {
    if (!STRONG.test(ch)) continue;
    return RTL.test(ch) ? 'rtl' : 'ltr';
  }
  return null;
}

/** What a field's frame lays out with: an explicit direction, `auto` resolved from [text], or null to inherit. */
export function uiResolvedDir(dir: UiTextDir | null | undefined, text: string): 'ltr' | 'rtl' | null {
  if (dir === 'auto') return uiTextDirection(text);
  return dir ?? null;
}

/**
 * The `dir` a field puts on its native control (0.46.1): `auto` only once it holds text. An empty
 * `dir="auto"` control resolves to LTR in Chromium, so a placeholder in an RTL page (Thaana) would sit on
 * the left; with no attribute it inherits the page direction and the placeholder sits at the start.
 */
export function uiNativeDir(dir: UiTextDir | null | undefined, text: string): UiTextDir | null {
  if (dir === 'auto' && !text) return null;
  return dir ?? null;
}

/** Elements inside a field's slot that take their own clicks (anything else focuses the field). */
export const UI_SLOT_INTERACTIVE = 'button, a[href], input, select, textarea, label, [tabindex], [contenteditable], [role=button]';

/**
 * Whether a press inside a field's slot landed on a control that takes it. A disabled one does not
 * (0.87.1): a greyed Send button in a composer swallowed the tap, so on a phone the keyboard never
 * came up when a finger landed on that end of the box. It now counts as the slot's empty space.
 */
export function uiSlotControlTakes(target: Element | null, slot: HTMLElement): boolean {
  const hit = target?.closest(UI_SLOT_INTERACTIVE);
  return !!hit && slot.contains(hit) && !hit.matches(':disabled, [aria-disabled="true"]');
}
