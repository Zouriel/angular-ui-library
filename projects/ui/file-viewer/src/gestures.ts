/**
 * The gesture arithmetic the viewers share.
 *
 * <p>Two components read the same drag: the inline {@link UiImageViewer} and the fullscreen
 * {@link UiMediaLightbox}. They frame media very differently, but a swipe has to mean the same thing
 * in both — the same distance, the same flick, the same refusal to fire on a vertical drag — or the
 * gallery changes its mind about what a gesture is depending on how it happens to be shown. The
 * thresholds live here so there is one answer rather than two that drift.</p>
 */

/** How far a drag must travel before it counts as a swipe, and the ceiling on that distance. */
export const SWIPE_FRACTION = 0.2;
export const SWIPE_MIN = 32;
export const SWIPE_MAX = 72;

/** A short, fast drag counts even when it falls short of the distance above. */
export const FLICK_DISTANCE = 24;
export const FLICK_SPEED = 0.4; // px per ms

/** How much of a drag survives when there is nothing to swipe to in that direction. */
export const RUBBER_BAND = 0.25;

/**
 * Whether a finished drag was a swipe.
 *
 * <p>A drag that wandered further down the screen than across it was a scroll or a dismiss attempt,
 * never a swipe — that test comes first, because a diagonal drag would otherwise pass on distance
 * alone. Past that, either travelling far enough or flicking fast enough is instruction enough: on a
 * phone the quick flick is much the more common of the two.</p>
 *
 * @param width the stage's width, so the distance scales with the screen; 0 falls back to the floor.
 */
export function isSwipe(dx: number, dy: number, ms: number, width: number): boolean {
  if (Math.abs(dx) <= Math.abs(dy)) return false;
  const far = Math.abs(dx) >= Math.min(SWIPE_MAX, Math.max(SWIPE_MIN, width * SWIPE_FRACTION));
  const flick =
    Math.abs(dx) >= FLICK_DISTANCE && Math.abs(dx) / Math.max(1, ms) >= FLICK_SPEED;
  return far || flick;
}

/**
 * How far the picture actually moves for a drag of `dx`.
 *
 * <p>Toward a neighbour it follows the finger; toward nothing it gives a little and comes back,
 * which says "that is the end" without a message. Capped at the stage's width either way, so a drag
 * that leaves the screen cannot fling the picture arbitrarily far.</p>
 */
export function resist(dx: number, width: number, blocked: boolean): number {
  const capped = width > 0 ? Math.max(-width, Math.min(width, dx)) : dx;
  return blocked ? capped * RUBBER_BAND : capped;
}

/**
 * Keeps a zoomed image reachable: without this a drag could throw the picture entirely outside the
 * stage, leaving a blank box and Fit as the only way back.
 */
export function clampOffset(
  offset: { x: number; y: number },
  content: { width: number; height: number },
  stage: { width: number; height: number },
  zoom: number,
): { x: number; y: number } {
  const maxX = Math.max(0, (content.width * zoom - stage.width) / 2);
  const maxY = Math.max(0, (content.height * zoom - stage.height) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}
