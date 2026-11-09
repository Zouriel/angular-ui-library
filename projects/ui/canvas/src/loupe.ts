/**
 * The magnifier the editors show beside a finger that paints (`ui-path-editor` in draw mode,
 * `ui-image-editor` erasing or restoring): a finger covers the very spot it works on, so a circle a
 * little way off shows what's under it, magnified, with the brush in the middle.
 */

/** The loupe's diameter in CSS pixels, on a surface big enough for it. */
export const UI_LOUPE_SIZE = 112;
/** How much bigger the loupe shows things than the editor does. */
export const UI_LOUPE_ZOOM = 2;

export interface UiLoupePlace {
  /** The loupe's centre, in the surface's own pixels. */
  x: number;
  y: number;
  /** Its diameter. */
  size: number;
}

/**
 * Where the loupe goes for a finger at (`x`, `y`) on a `width` × `height` surface: up and to the left
 * of it, clear of the fingertip (and of a right hand); to its right near the left edge, below it near
 * the top, and always inside the surface. A surface that hasn't been measured (0 × 0) gets the
 * full-size loupe at that offset.
 */
export function uiLoupePlace(x: number, y: number, width: number, height: number): UiLoupePlace {
  const measured = width > 0 && height > 0;
  const size = measured ? Math.round(Math.max(64, Math.min(UI_LOUPE_SIZE, Math.min(width, height) * 0.42))) : UI_LOUPE_SIZE;
  const r = size / 2;
  // Far enough along the diagonal that the circle stays ~40 px clear of the touch point.
  const off = (r + 40) / Math.SQRT2;
  let cx = x - off;
  let cy = y - off;
  if (!measured) return { x: cx, y: cy, size };
  if (cx - r < 0) cx = x + off;
  if (cy - r < 0) cy = y + off;
  cx = Math.max(r, Math.min(width - r, cx));
  cy = Math.max(r, Math.min(height - r, cy));
  return { x: cx, y: cy, size };
}
