/**
 * A count as badge text (0.44.0, Flutter `uiBadgeCount`): null for none (0 or less), `max+` above
 * `max` ("9+"), else the number. For `[badge]` on ui-button / ui-icon-button and nav badges.
 */
export function uiBadgeCount(n: number, max = 9): string | null {
  if (!(n > 0)) return null;
  return n > max ? `${max}+` : String(Math.floor(n));
}
