import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;

/** How far a drag must travel before it counts as a swipe, and the ceiling on that distance. */
const SWIPE_FRACTION = 0.2;
const SWIPE_MIN = 32;
const SWIPE_MAX = 72;

/** A short, fast drag counts even when it falls short of the distance above. */
const FLICK_DISTANCE = 24;
const FLICK_SPEED = 0.4; // px per ms

/** How much of a drag survives when there is nothing to swipe to in that direction. */
const RUBBER_BAND = 0.25;

/**
 * `ui-image-viewer` — zoom (buttons, wheel, pinch), pan (drag, wheel), fit/reset, and — when the
 * host says there is somewhere to go — swipe between images.
 *
 * <p>Gestures are handled here rather than left to the browser, which is why the stage sets
 * `touch-action: none`: a two-finger pinch that the browser claims first never reaches us, and the
 * page would zoom instead of the image. Owning the gesture is what makes pinch work at all.</p>
 *
 * <p>It follows that navigation has to live here too. A gallery cannot listen for its own swipes
 * over a stage that has already captured the pointer, so the viewer detects the gesture and the
 * host moves: {@link hasPrevious}/{@link hasNext} say what exists, {@link previous}/{@link next}
 * report the intent, and the list itself stays where it belongs — with whoever owns it.</p>
 */
@Component({
  selector: 'ui-image-viewer',
  imports: [DecimalPipe],
  template: `
    <div class="iv">
      <div #stage class="stage" [class.panning]="pannable()"
           (wheel)="onWheel($event)"
           (pointerdown)="onDown($event)" (pointermove)="onMove($event)"
           (pointerup)="onUp($event)" (pointercancel)="onUp($event)"
           (keydown)="onKey($event)"
           [attr.tabindex]="navigable() ? 0 : null"
           (dblclick)="toggleZoom()">
        <img #img [src]="src()" [alt]="alt()" [style.transform]="transform()"
             [class.settling]="!interacting()" (load)="reset()" draggable="false" />
      </div>
      <div class="bar">
        @if (navigable()) {
          <button type="button" class="step" (click)="previous.emit()"
                  [disabled]="!hasPrevious()" aria-label="Previous image">‹</button>
        }
        <button type="button" (click)="zoomBy(-0.25)" [disabled]="zoom() <= min" aria-label="Zoom out">−</button>
        <span class="pct">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
        <button type="button" (click)="zoomBy(0.25)" [disabled]="zoom() >= max" aria-label="Zoom in">+</button>
        <button type="button" class="fit" (click)="reset()" aria-label="Reset view">Fit</button>
        @if (navigable()) {
          <button type="button" class="step" (click)="next.emit()"
                  [disabled]="!hasNext()" aria-label="Next image">›</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; min-height: 0; }
    /*
      Self-bounding on purpose. Dropped into a container with no definite height — a modal panel that
      is max-height 85vh with overflow auto, say — height:100% resolves to auto, the stage grows to
      the photograph's natural size, and the control bar is pushed below the fold. Reaching it then
      means scrolling over the stage, which owns touch and pans the image instead: the controls become
      unreachable. The cap keeps the whole viewer inside one screen so the bar is always in view, and
      a host that DOES give a definite height still gets all of it.
    */
    .iv { display: flex; flex-direction: column; height: 100%;
      min-height: 200px; max-height: var(--ui-image-viewer-max-height, 70svh); }
    /* min-height:0 is load-bearing: a flex child refuses to shrink below its content without it, so
       a tall image would push the bar out however the parent is sized. We own every gesture here —
       see the class comment. */
    .stage { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; align-items: center;
      justify-content: center; background: var(--ui-color-bg); touch-action: none; }
    .stage.panning { cursor: grab; }
    .stage.panning:active { cursor: grabbing; }
    .stage:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* contain, so the shot is fitted to the box rather than cropped or overflowing it. */
    img { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none;
      -webkit-user-drag: none; will-change: transform; }
    /* Only eases back to rest. A transition during a pinch makes the image lag the fingers. */
    img.settling { transition: transform var(--ui-motion-fast, 120ms) var(--ui-ease-standard, ease-out); }
    @media (prefers-reduced-motion: reduce) { img.settling { transition: none; } }

    /* flex-none: the controls are the one part that must never be the thing that gets squeezed out. */
    .bar { flex: 0 0 auto; display: flex; align-items: center; gap: var(--ui-space-2); justify-content: center;
      padding: var(--ui-space-2); border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    /* Sized to be tappable outright. It used to stay 26px and grow an invisible ::before to
       var(--ui-size-touch), which inset by -9px against an 8px gap — so neighbouring hit areas
       overlapped by 10px and a tap near an edge pressed the wrong button. */
    .bar button { display: inline-flex; align-items: center; justify-content: center;
      min-width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0 var(--ui-space-2);
      border: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      color: var(--ui-color-text); border-radius: var(--ui-radius); cursor: pointer;
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .bar button.fit { min-width: auto; }
    /* The step arrows sit at the ends so the pair never reads as part of the zoom cluster. */
    .bar button.step { font-size: var(--ui-font-size-lg); }
    .bar button.step:first-child { margin-right: auto; }
    .bar button.step:last-child { margin-left: auto; }
    .bar button:hover:not(:disabled) { background: var(--ui-color-surface-raised); }
    .bar button:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .bar button:disabled { opacity: 0.45; cursor: default; }
    .bar button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) {
      .bar { gap: var(--ui-space-3); }
      .bar button { min-width: var(--ui-size-touch); height: var(--ui-size-touch); }
    }
    .pct { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); min-width: 42px; text-align: center; }
  `,
})
export class UiImageViewer {
  src = input.required<string>();
  alt = input('');

  /**
   * Whether a neighbour exists in each direction. Both default to false, so a viewer showing one
   * image behaves exactly as it did before navigation existed: no arrows, and a swipe does nothing.
   */
  hasPrevious = input(false);
  hasNext = input(false);

  /** A swipe, arrow key or step button asking for the neighbour. The host changes `src`. */
  previous = output<void>();
  next = output<void>();

  protected readonly min = MIN_ZOOM;
  protected readonly max = MAX_ZOOM;

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly img = viewChild<ElementRef<HTMLImageElement>>('img');

  protected readonly zoom = signal(1);
  protected readonly offset = signal({ x: 0, y: 0 });
  protected readonly interacting = signal(false);

  /** Live pointers, by id. Two of them means a pinch rather than a drag. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchFrom = 0;
  private pinchZoom = 1;

  /** Where the current one-finger drag began, while it is still a candidate for a swipe. */
  private swipeFrom: { x: number; y: number; at: number } | null = null;
  /** How far that drag has strayed vertically — a mostly-vertical drag is not a swipe. */
  private swipeDy = 0;
  /** Live horizontal travel, so the image follows the finger. */
  protected readonly swipe = signal(0);

  protected readonly navigable = computed(() => this.hasPrevious() || this.hasNext());

  protected readonly transform = computed(() => {
    const o = this.offset();
    return `translate(${o.x + this.swipe()}px, ${o.y}px) scale(${this.zoom()})`;
  });

  /** There is only something to drag once the image is bigger than the stage. */
  protected readonly pannable = computed(() => this.zoom() > 1);

  protected reset(): void {
    this.zoom.set(1);
    this.offset.set({ x: 0, y: 0 });
    // A new image arriving mid-gesture must not inherit the last one's travel.
    this.swipe.set(0);
  }

  protected toggleZoom(): void {
    if (this.zoom() > 1) this.reset();
    else this.setZoom(2);
  }

  protected zoomBy(d: number): void {
    this.setZoom(this.zoom() + d);
  }

  private setZoom(next: number): void {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +next.toFixed(3))));
    // Zooming out can leave the image parked off-centre with slack around it; pull it back in.
    this.offset.update((o) => this.clamp(o));
  }

  /**
   * Keeps the image reachable. Without it a drag could throw the picture entirely outside the
   * stage, leaving a blank box and Fit as the only way back.
   */
  private clamp(o: { x: number; y: number }): { x: number; y: number } {
    const stage = this.stage()?.nativeElement;
    const img = this.img()?.nativeElement;
    if (!stage || !img) return o;
    const z = this.zoom();
    const maxX = Math.max(0, (img.clientWidth * z - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.clientHeight * z - stage.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, o.x)),
      y: Math.min(maxY, Math.max(-maxY, o.y)),
    };
  }

  protected onWheel(e: WheelEvent): void {
    // A trackpad pinch arrives as ctrl+wheel; so does the usual zoom modifier.
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      return;
    }
    // Otherwise scroll around the image — but only while it has somewhere left to go, so a wheel
    // over a fitted image still scrolls the page behind it instead of being swallowed.
    const from = this.offset();
    const to = this.clamp({ x: from.x - e.deltaX, y: from.y - e.deltaY });
    if (to.x !== from.x || to.y !== from.y) {
      e.preventDefault();
      this.offset.set(to);
    }
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight' && this.hasNext()) this.next.emit();
    else if (e.key === 'ArrowLeft' && this.hasPrevious()) this.previous.emit();
    else return;
    e.preventDefault();
  }

  protected onDown(e: PointerEvent): void {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.swipeFrom = { x: e.clientX, y: e.clientY, at: e.timeStamp };
      this.swipeDy = 0;
    }
    if (this.pointers.size === 2) {
      this.pinchFrom = this.spread();
      this.pinchZoom = this.zoom();
      // A pinch is not a half-finished swipe. Drop the candidate rather than let the second finger
      // land and the release be read as a flick.
      this.swipeFrom = null;
      this.swipe.set(0);
    }
    this.interacting.set(true);
  }

  protected onMove(e: PointerEvent): void {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size >= 2) {
      // Two fingers: the ratio of how far apart they are now to where they started IS the zoom.
      if (this.pinchFrom > 0) this.setZoom(this.pinchZoom * (this.spread() / this.pinchFrom));
      return;
    }

    // A zoomed-in image is being read, not browsed: the drag pans it, and only once it is back at
    // fit does the same gesture mean "show me the next one". Both at once and neither works.
    if (this.pannable()) {
      this.offset.update((o) =>
        this.clamp({ x: o.x + (e.clientX - previous.x), y: o.y + (e.clientY - previous.y) }),
      );
      return;
    }

    const from = this.swipeFrom;
    if (!from || !this.navigable()) return;
    this.swipeDy = e.clientY - from.y;
    this.swipe.set(this.resist(e.clientX - from.x));
  }

  protected onUp(e: PointerEvent): void {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    this.pointers.delete(e.pointerId);
    // Lifting one finger of a pinch must not resume the pan from a stale position.
    if (this.pointers.size < 2) this.pinchFrom = 0;
    if (this.pointers.size === 0) {
      this.interacting.set(false);
      this.settle(e.timeStamp);
    }
  }

  /**
   * A drag toward nothing still moves, but grudgingly — the image gives a little and comes back,
   * which says "that is the end" without a message. Straight travel elsewhere.
   */
  private resist(dx: number): number {
    const blocked = dx > 0 ? !this.hasPrevious() : !this.hasNext();
    const width = this.stage()?.nativeElement.clientWidth ?? 0;
    const capped = width > 0 ? Math.max(-width, Math.min(width, dx)) : dx;
    return blocked ? capped * RUBBER_BAND : capped;
  }

  /** Decides what the finished drag meant, then puts the image back at rest either way. */
  private settle(at: number): void {
    const from = this.swipeFrom;
    const dx = this.swipe();
    this.swipeFrom = null;
    this.swipe.set(0);
    if (!from || !dx) return;

    // A drag that wandered further down the screen than across it was a scroll attempt, not a swipe.
    if (Math.abs(dx) <= Math.abs(this.swipeDy)) return;

    const width = this.stage()?.nativeElement.clientWidth ?? 0;
    const far = Math.abs(dx) >= Math.min(SWIPE_MAX, Math.max(SWIPE_MIN, width * SWIPE_FRACTION));
    // A quick flick is as clear an instruction as a long drag, and much more common on a phone.
    const flick =
      Math.abs(dx) >= FLICK_DISTANCE && Math.abs(dx) / Math.max(1, at - from.at) >= FLICK_SPEED;
    if (!far && !flick) return;

    if (dx < 0 && this.hasNext()) this.next.emit();
    else if (dx > 0 && this.hasPrevious()) this.previous.emit();
  }

  /** Distance between the two live pointers. */
  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
