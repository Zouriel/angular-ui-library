import { Directive, ElementRef, inject, input, output } from '@angular/core';
import { isSwipe } from './gestures';

/** How close to the edge of the screen a gesture may begin before we leave it to the browser. */
const EDGE_GUARD = 24;

/** Where a gesture must never be read as a swipe, because the element wants the drag itself. */
const INTERACTIVE = 'input, textarea, select, [contenteditable], [draggable="true"], [data-no-swipe]';

/**
 * `uiSwipe` — reports a horizontal swipe across the host, and gets out of the way of everything
 * else the finger might have meant.
 *
 * <p>Nothing here calls `preventDefault`, and the host is deliberately left with its normal
 * `touch-action`: the page must still scroll down under exactly the same finger. So the gesture is
 * judged after the fact, on release, against the shared thresholds in {@link isSwipe} — which is
 * also why a drag the browser claims for scrolling simply never arrives.</p>
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
    '(pointerdown)': 'onDown($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'abandon()',
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
  private from: { id: number; x: number; y: number; at: number } | null = null;

  protected onDown(event: PointerEvent): void {
    // A second finger landing means this was never a swipe. Drop the candidate rather than let the
    // eventual release of one of them be read as a flick.
    if (this.from) {
      this.from = null;
      return;
    }
    if (this.disabled()) return;
    if (event.pointerType === 'mouse' && !this.mouse()) return;
    if (this.declines(event)) return;
    this.from = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
  }

  protected onUp(event: PointerEvent): void {
    const from = this.from;
    this.from = null;
    if (!from || event.pointerId !== from.id) return;

    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!isSwipe(dx, dy, event.timeStamp - from.at, this.host.nativeElement.clientWidth)) return;

    if (dx < 0) this.swipeLeft.emit();
    else this.swipeRight.emit();
  }

  protected abandon(): void {
    this.from = null;
  }

  /** Whether the gesture began somewhere that has a better claim to it than we do. */
  private declines(event: PointerEvent): boolean {
    const width = window.innerWidth || document.documentElement.clientWidth;
    if (event.clientX <= EDGE_GUARD || event.clientX >= width - EDGE_GUARD) return true;

    const target = event.target as Element | null;
    if (!target) return true;
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
