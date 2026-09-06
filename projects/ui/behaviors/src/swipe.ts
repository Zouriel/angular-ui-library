import { Directive, ElementRef, inject, input, output } from '@angular/core';
import { isSwipe } from './gestures';

/** How close to the edge of the screen a gesture may begin before we leave it to the browser. */
const EDGE_GUARD = 24;

/** Where a gesture must never be read as a swipe, because the element wants the drag itself. */
const INTERACTIVE = 'input, textarea, select, [contenteditable], [draggable="true"], [data-no-swipe]';

/** One point of a drag, whichever event model it arrived by. */
interface Point {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

/**
 * `uiSwipe` — reports a horizontal swipe across the host, and gets out of the way of everything
 * else the finger might have meant.
 *
 * <h4>Why this listens to touch events and not pointer events</h4>
 *
 * <p>Pointer events are the modern, unified API and they are the wrong tool here. A browser does not
 * promote a touch to a pointer event until it knows the touch is not a gesture, and a swipe IS a
 * gesture — so the promotion never happens. Measured on Chromium, the same finger produces:</p>
 *
 * <pre>
 *   tap     pointerdown + touchstart ............ pointerup + touchend
 *   swipe   touchstart + touchmove x12 + touchend        (no pointer events at all)
 * </pre>
 *
 * <p>Not a `pointercancel` to react to, not a truncated stream to salvage — nothing. Anything built
 * on pointer events can answer a tap and can never answer a swipe. Touch events, by contrast, are
 * delivered in full and uninterrupted throughout, which is exactly why every swipe library worth the
 * name is built on them. So: touch events carry the finger, and pointer events are kept only for the
 * mouse and the pen, which are never subject to that arbitration.</p>
 *
 * <p>Nothing here calls `preventDefault`, and the host is deliberately left with its normal
 * `touch-action`: the page must still scroll down under exactly the same finger, and a strip that
 * scrolls sideways inside it must keep doing that too — which rules out the usual `touch-action:
 * pan-y`, since a descendant cannot take back a direction an ancestor gave away. The drag is instead
 * measured as it happens, against the shared thresholds in {@link isSwipe}, and answered the moment
 * it qualifies. That reads better anyway: the screen turns under the finger rather than after it.</p>
 *
 * <p>It declines far more often than it fires, and that is the point:</p>
 * <ul>
 *   <li><b>A second finger</b> cancels the candidate outright. A pinch is not half a swipe.</li>
 *   <li><b>The screen's edges</b> belong to the browser — that is where back and forward live on
 *       both iOS and Android, and a page that answered there would fire alongside them.</li>
 *   <li><b>Anything scrollable sideways</b> under the finger keeps its own drag: a tab strip, a
 *       carousel, a wide table. Reaching the end of one is not permission to leave the page.</li>
 *   <li><b>Fields, sliders and editable text</b>, which are dragged for their own reasons.</li>
 *   <li><b>The mouse</b>, unless asked for. A mouse drag across a page is a text selection, and
 *       whoever has one also has the whole navigation on screen.</li>
 * </ul>
 *
 * <p>Anything else can opt out by marking a subtree `data-no-swipe`.</p>
 */
@Directive({
  selector: '[uiSwipe]',
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd($event)',
    '(touchcancel)': 'onTouchEnd($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerMove($event)',
    '(pointercancel)': 'onPointerCancel($event)',
  },
})
export class UiSwipe {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Turns the gesture off without unmounting it — for a page with nowhere to go, say. */
  readonly disabled = input(false, { alias: 'uiSwipeDisabled' });

  /** Whether a mouse drag counts too. Off by default; see the note above. */
  readonly mouse = input(false, { alias: 'uiSwipeMouse' });

  /** Finger travelled leftwards: the next thing, the way a photo gallery reads. */
  readonly swipeLeft = output<void>({ alias: 'uiSwipeLeft' });
  /** Finger travelled rightwards: the previous thing. */
  readonly swipeRight = output<void>({ alias: 'uiSwipeRight' });

  /** The live candidate — null whenever there isn't one, which is most of the time. */
  private from: Point | null = null;

  /** Where it was last seen, which is all we are left with if the browser takes the drag away. */
  private last: Point | null = null;

  /**
   * True once a touch has been seen, after which pointer events are ignored entirely.
   *
   * <p>A browser that sends both would otherwise read one finger as two drags. Latched rather than
   * feature-detected because `'ontouchstart' in window` is false in several places that still
   * deliver touch events perfectly well — a device tells you what it is by what it sends.</p>
   */
  private touched = false;

  // --- touch: the finger ----------------------------------------------------------------------

  protected onTouchStart(event: TouchEvent): void {
    this.touched = true;
    // A second finger landing means this was never a swipe. Drop the candidate rather than let the
    // eventual release of one of them be read as a flick.
    if (event.touches.length > 1) {
      this.clear();
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.begin(touch.identifier, touch.clientX, touch.clientY, event.timeStamp, event.target);
  }

  protected onTouchMove(event: TouchEvent): void {
    if (event.touches.length > 1) {
      this.clear();
      return;
    }
    this.advance(event);
  }

  protected onTouchEnd(event: TouchEvent): void {
    this.advance(event);
    this.clear();
  }

  /** Follows the one finger we started with, and judges it where it now is. */
  private advance(event: TouchEvent): void {
    const from = this.from;
    if (!from) return;
    const touch = Array.from(event.changedTouches).find((t) => t.identifier === from.id);
    if (!touch) return;
    this.last = { id: from.id, x: touch.clientX, y: touch.clientY, at: event.timeStamp };
    this.judge(from, this.last);
  }

  // --- pointer: the mouse and the pen ---------------------------------------------------------

  protected onPointerDown(event: PointerEvent): void {
    if (this.touched || event.pointerType === 'touch') return;
    if (event.pointerType === 'mouse' && !this.mouse()) return;
    if (this.from) {
      this.clear();
      return;
    }
    this.begin(event.pointerId, event.clientX, event.clientY, event.timeStamp, event.target);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.touched || event.pointerType === 'touch') return;
    const from = this.from;
    if (!from || event.pointerId !== from.id) return;
    this.last = { id: from.id, x: event.clientX, y: event.clientY, at: event.timeStamp };
    this.judge(from, this.last);
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (this.touched || event.pointerType === 'touch') return;
    const from = this.from;
    if (from && event.pointerId === from.id && this.last) this.judge(from, this.last);
    this.clear();
  }

  // --- the gesture itself ---------------------------------------------------------------------

  private begin(id: number, x: number, y: number, at: number, target: EventTarget | null): void {
    if (this.disabled()) return;
    if (this.declines(x, target)) return;
    this.from = { id, x, y, at };
    this.last = null;
  }

  /** Judged while the finger is still down, and fired the moment it qualifies. */
  private judge(from: Point, now: Point): void {
    const dx = now.x - from.x;
    const dy = now.y - from.y;
    if (!isSwipe(dx, dy, now.at - from.at, this.host.nativeElement.clientWidth)) return;

    // Spent: the rest of this drag is somebody following through on a gesture already answered.
    this.clear();
    if (dx < 0) this.swipeLeft.emit();
    else this.swipeRight.emit();
  }

  private clear(): void {
    this.from = null;
    this.last = null;
  }

  /** Whether the gesture began somewhere that has a better claim to it than we do. */
  private declines(x: number, target: EventTarget | null): boolean {
    const width = window.innerWidth || document.documentElement.clientWidth;
    if (x <= EDGE_GUARD || x >= width - EDGE_GUARD) return true;

    if (!(target instanceof Element)) return true;
    if (target.closest(INTERACTIVE)) return true;
    return this.scrollsSideways(target);
  }

  /**
   * Whether anything between the target and the host scrolls horizontally.
   *
   * <p>Checked by overflow AND by actual width, because the common case is a container that is
   * *allowed* to scroll sideways but currently has nothing to scroll — a tab strip that fits. That
   * one is not competing for the gesture and should not block it.</p>
   */
  private scrollsSideways(target: Element): boolean {
    const root = this.host.nativeElement;
    for (let el: Element | null = target; el && el !== root.parentElement; el = el.parentElement) {
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      const overflow = getComputedStyle(el).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    return false;
  }
}
