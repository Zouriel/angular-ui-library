/**
 * The viewers' gesture arithmetic.
 *
 * <p>The swipe half of it moved to `@zouriel/ui/behaviors`, where an ordinary page can reach it too;
 * it is re-exported here so the two viewers keep importing one module, and so that a swipe means the
 * same distance and the same flick whether it happens over a photograph or over a whole screen.
 * What stays is {@link clampOffset}, which is about a zoomed image and nothing else.</p>
 */
export {
  SWIPE_FRACTION,
  SWIPE_MIN,
  SWIPE_MAX,
  FLICK_DISTANCE,
  FLICK_SPEED,
  RUBBER_BAND,
  isSwipe,
  resist,
} from '@zouriel/ui/behaviors';

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
