import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Directive, ElementRef, PLATFORM_ID, inject, input, output } from '@angular/core';

/** How far the two fingers must travel from the baseline, as a share of it, to make one step. */
const PINCH_OUT = 1.25;
const PINCH_IN = 0.8;

/** The move listener must be able to cancel, or the browser zooms the page under the pinch. */
const BLOCKING: AddEventListenerOptions = { passive: false };

/**
 * `uiPinch`: a two-finger pinch reported as steps, not as a scale. For a photo grid that changes its
 * column count, the way a phone's gallery does.
 *
 * <p>The distance between the two fingers is taken as a baseline. Once it reaches 1.25 times that
 * (`uiPinchOut`) or falls to 0.8 times it (`uiPinchIn`), one step fires and the current distance
 * becomes the new baseline, so one long pinch can take several steps. A third finger is ignored; when
 * one of the two lifts while others remain, the next two carry on from a fresh baseline. Fewer than
 * two fingers ends it.</p>
 *
 * <p>It uses touch events, for the reason given on `UiSwipe`: a browser sends no pointer events for a
 * touch it is treating as a gesture. While two fingers are on the host it cancels `touchmove`, so the
 * page does not zoom; that needs a non-passive listener, which a host binding can't ask for. One
 * finger is never cancelled, so the page still scrolls and an enclosing `uiSwipe` still works. A
 * finger elsewhere on the screen doesn't count towards the two.</p>
 *
 * <p>A browser keeps sending a touch's events to the element it landed on, and if that element has
 * left the document they no longer bubble to the host. A grid that re-renders on each step can do
 * exactly that, so the move and end listeners also go on the element under each finger while it is
 * down. An attached element's events then arrive twice, which is harmless: the second look finds
 * nothing changed.</p>
 */
@Directive({ selector: '[uiPinch]' })
export class UiPinch {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Turns the gesture off without unmounting it: nothing fires and nothing is cancelled. */
  readonly disabled = input(false, { alias: 'uiPinchDisabled' });

  /** The fingers moved together. */
  readonly pinchIn = output<void>({ alias: 'uiPinchIn' });
  /** The fingers moved apart. */
  readonly pinchOut = output<void>({ alias: 'uiPinchOut' });

  /** Fingers that landed on the host, oldest first, with the element each landed on. */
  private readonly fingers = new Map<number, EventTarget>();

  /** The two fingers being measured, as `first:second`; empty when there aren't two. */
  private pair = '';
  private baseline = 0;

  private readonly onStart = (event: TouchEvent): void => {
    if (this.disabled()) {
      this.reset();
      return;
    }
    for (const touch of Array.from(event.changedTouches)) {
      if (this.fingers.has(touch.identifier) || !this.host.contains(touch.target as Node | null)) continue;
      this.fingers.set(touch.identifier, touch.target);
      if (touch.target !== this.host) this.listen(touch.target);
    }
    this.measured(event.touches);
  };

  private readonly onMove = (event: TouchEvent): void => {
    if (this.disabled()) {
      this.reset();
      return;
    }
    const distance = this.measured(event.touches);
    if (distance === null) return;
    if (event.cancelable) event.preventDefault();

    // Fingers landing on the same spot: there is nothing to take a share of yet.
    if (this.baseline <= 0) {
      this.baseline = distance;
    } else if (distance >= this.baseline * PINCH_OUT) {
      this.baseline = distance;
      this.pinchOut.emit();
    } else if (distance <= this.baseline * PINCH_IN) {
      this.baseline = distance;
      this.pinchIn.emit();
    }
  };

  private readonly onEnd = (event: TouchEvent): void => {
    this.measured(event.touches);
  };

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.host.addEventListener('touchstart', this.onStart as EventListener, { passive: true });
    this.listen(this.host);
    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('touchstart', this.onStart as EventListener);
      this.unlisten(this.host);
      this.reset();
    });
  }

  /**
   * Forgets fingers no longer on the screen, and returns the distance between the two being measured
   * (null without two). A change of pair starts a fresh baseline, so it can't read as a step.
   */
  private measured(touches: TouchList): number | null {
    const live = Array.from(touches);
    for (const [id, target] of this.fingers) {
      if (live.some((t) => t.identifier === id)) continue;
      this.fingers.delete(id);
      if (target !== this.host && !Array.from(this.fingers.values()).includes(target)) this.unlisten(target);
    }

    const ids = Array.from(this.fingers.keys()).slice(0, 2);
    const pair = ids.length === 2 ? ids.join(':') : '';
    if (!pair) {
      this.pair = '';
      this.baseline = 0;
      return null;
    }
    const [a, b] = ids.map((id) => live.find((t) => t.identifier === id)!);
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pair !== this.pair) {
      this.pair = pair;
      this.baseline = distance;
    }
    return distance;
  }

  private reset(): void {
    for (const target of this.fingers.values()) if (target !== this.host) this.unlisten(target);
    this.fingers.clear();
    this.pair = '';
    this.baseline = 0;
  }

  private listen(target: EventTarget): void {
    target.addEventListener('touchmove', this.onMove as EventListener, BLOCKING);
    target.addEventListener('touchend', this.onEnd as EventListener);
    target.addEventListener('touchcancel', this.onEnd as EventListener);
  }

  private unlisten(target: EventTarget): void {
    target.removeEventListener('touchmove', this.onMove as EventListener);
    target.removeEventListener('touchend', this.onEnd as EventListener);
    target.removeEventListener('touchcancel', this.onEnd as EventListener);
  }
}
