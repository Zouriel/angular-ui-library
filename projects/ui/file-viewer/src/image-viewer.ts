import { DecimalPipe } from '@angular/common';
import { booleanAttribute, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import MinusSignIcon from '@hugeicons/core-free-icons/MinusSignIcon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import { clampOffset, fitContain, isSwipe, resist } from './gestures';
import { injectUiStrings } from '@zouriel/ui';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;

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
 *
 * <p>With {@link fill} it is a whole page rather than a box on one: it takes every pixel its parent
 * gives, the picture is fitted into that, and the controls float over the bottom of it instead of
 * sitting in a bar of their own.</p>
 */
@Component({
  selector: 'ui-image-viewer',
  imports: [DecimalPipe, HugeiconsIconComponent],
  template: `
    <div class="iv" [class.fill]="fill()">
      <div #stage class="stage" [class.panning]="pannable()"
           [attr.role]="focusable() ? 'group' : null"
           [attr.aria-label]="focusable() ? (alt() || strings.image) : null"
           (wheel)="onWheel($event)"
           (pointerdown)="onDown($event)" (pointermove)="onMove($event)"
           (pointerup)="onUp($event)" (pointercancel)="onUp($event)"
           (keydown)="onKey($event)"
           [attr.tabindex]="focusable() ? 0 : null"
           (dblclick)="toggleZoom()">
        @if (isVideo()) {
          <!-- Its own controls, not ours: scrubbing a clip is what the browser is already good at,
               and a party video is watched far more often than it is zoomed. -->
          <video #clip [src]="src()" controls playsinline preload="metadata"
                 [style.transform]="transform()" [class.settling]="!interacting()"
                 (loadedmetadata)="reset()"></video>
        } @else {
          <img #img [src]="src()" [alt]="alt()" [style.transform]="transform()"
               [class.settling]="!interacting()" (load)="reset()" draggable="false" />
        }
      </div>
      <div class="bar" [class.overlay]="fill()" role="group" [attr.aria-label]="isVideo() ? 'Clip controls' : 'Image controls'">
        @if (navigable()) {
          <button type="button" class="step" (click)="previous.emit()"
                  [disabled]="!hasPrevious()" [attr.aria-label]="strings.previousImage"><hugeicons-icon [icon]="prevIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
        }
        @if (!isVideo()) {
          <button type="button" (click)="zoomBy(-0.25)" [disabled]="zoom() <= min" [attr.aria-label]="strings.zoomOut"><hugeicons-icon [icon]="minusIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
          <span class="pct">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
          <button type="button" (click)="zoomBy(0.25)" [disabled]="zoom() >= max" [attr.aria-label]="strings.zoomIn"><hugeicons-icon [icon]="plusIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
          <button type="button" class="fit" (click)="reset()" [attr.aria-label]="strings.resetView">{{ strings.fit }}</button>
        }
        @if (navigable()) {
          <button type="button" class="step" (click)="next.emit()"
                  [disabled]="!hasNext()" [attr.aria-label]="strings.nextImage"><hugeicons-icon [icon]="nextIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" /></button>
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
    .iv { position: relative; display: flex; flex-direction: column; height: 100%;
      min-height: 200px; max-height: var(--ui-image-viewer-max-height, 70svh); }
    /* min-height:0 is load-bearing: a flex child refuses to shrink below its content without it, so
       a tall image would push the bar out however the parent is sized. We own every gesture here —
       see the class comment. */
    .stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden;
      background: var(--ui-color-bg); touch-action: none; }
    /*
      The stage's own preferred height. The picture is laid out absolutely (below), so it never sizes
      the stage: a 1 px image and a 4000 px photograph get the same frame. In a parent with no definite
      height this spacer is what the viewer grows to (60% of the screen, under the 70% cap), so it is
      never a short box with its zoom bar under it and the page empty below; in a parent that does
      give a height, the stage shrinks past it (min-height: 0) and the parent wins.
    */
    .stage::before { content: ''; display: block; height: var(--ui-image-viewer-min-height, 60svh); }
    .stage.panning { cursor: grab; }
    .stage.panning:active { cursor: grabbing; }
    .stage:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* contain, so the shot is fitted to the stage (centred, never cropped), whatever its own size. */
    img, video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; user-select: none;
      -webkit-user-drag: none; will-change: transform; }
    /* A clip is never zoomed or panned, so it never needs to claim the gestures an image does —
       and taking them would be taking them from its own scrubber. */
    video { touch-action: auto; }
    /* Only eases back to rest. A transition during a pinch makes the image lag the fingers. */
    img.settling, video.settling { transition: transform var(--ui-motion-fast, 120ms) var(--ui-ease-standard, ease-out); }
    @media (prefers-reduced-motion: reduce) { img.settling, video.settling { transition: none; } }

    /* flex-none: the controls are the one part that must never be the thing that gets squeezed out. */
    .bar { flex: 0 0 auto; display: flex; align-items: center; gap: var(--ui-space-1); justify-content: center;
      padding: var(--ui-space-1) var(--ui-space-2); border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface-raised);
      font-family: var(--ui-font-default); line-height: 1.35; }
    /* Sized to be tappable outright. It used to stay 26px and grow an invisible ::before to
       var(--ui-size-touch), which inset by -9px against an 8px gap — so neighbouring hit areas
       overlapped by 10px and a tap near an edge pressed the wrong button. */
    .bar button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
      min-width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0;
      border: none; background: transparent;
      color: var(--ui-color-text); border-radius: var(--ui-radius-xs); cursor: pointer;
      font: inherit; font-size: var(--ui-font-size-sm); line-height: 1;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .bar button.fit { padding: 0 var(--ui-space-2); }
    /* The step arrows sit at the ends so the pair never reads as part of the zoom cluster. */
    .bar button.step:first-child { margin-right: auto; }
    .bar button.step:last-child { margin-left: auto; }
    .bar button:hover:not(:disabled) { background: var(--ui-color-elevated-hover); }
    .bar button:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .bar button:disabled { opacity: 0.5; cursor: not-allowed; }
    .bar button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) {
      .bar { gap: var(--ui-space-3); }
      .bar button { min-width: var(--ui-size-touch); height: var(--ui-size-touch); }
    }
    /*
      fill: the viewer is the page. No cap, no spacer, no bar of its own: the controls float over the
      bottom of the picture on the glass panel surface, clear of the home indicator.
    */
    .iv.fill { max-height: none; }
    .iv.fill .stage::before { display: none; }
    .bar.overlay { position: absolute; left: 50%; transform: translateX(-50%);
      bottom: calc(var(--ui-space-3) + env(safe-area-inset-bottom, 0px));
      max-width: calc(100% - 2 * var(--ui-space-3)); box-sizing: border-box;
      border-top: none; border-radius: var(--ui-radius-pill); background: var(--ui-glass-panel-bg);
      -webkit-backdrop-filter: blur(var(--ui-glass-blur)); backdrop-filter: blur(var(--ui-glass-blur));
      box-shadow: var(--ui-shadow-2); }
    .bar.overlay button.step:first-child, .bar.overlay button.step:last-child { margin: 0; }
    .pct { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); min-width: 42px; text-align: center;
      font-variant-numeric: tabular-nums; }
  `,
})
export class UiImageViewer {
  protected readonly strings = injectUiStrings();
  src = input.required<string>();
  alt = input('');

  /**
   * What `src` points at. A gallery holds both, and the two need the same frame around them — the
   * same swipe, the same arrows, the same place in the list — so they are one component rather than
   * two that happen to sit in the same modal.
   */
  kind = input<'image' | 'video'>('image');

  /**
   * Whether a neighbour exists in each direction. Both default to false, so a viewer showing one
   * image behaves exactly as it did before navigation existed: no arrows, and a swipe does nothing.
   */
  hasPrevious = input(false);
  hasNext = input(false);

  /**
   * Take all the space the parent gives (a full page, or an expanded flex child) instead of being a
   * box on the page: no height cap, the picture fitted (contain, centred) into the whole area, and
   * the zoom controls floating over its bottom edge. The parent must have a height.
   */
  fill = input(false, { transform: booleanAttribute });

  /** A swipe, arrow key or step button asking for the neighbour. The host changes `src`. */
  previous = output<void>();
  next = output<void>();

  protected readonly prevIcon = ArrowLeft01Icon;
  protected readonly nextIcon = ArrowRight01Icon;
  protected readonly minusIcon = MinusSignIcon;
  protected readonly plusIcon = PlusSignIcon;

  protected readonly min = MIN_ZOOM;
  protected readonly max = MAX_ZOOM;

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly img = viewChild<ElementRef<HTMLImageElement>>('img');
  private readonly clip = viewChild<ElementRef<HTMLVideoElement>>('clip');

  protected readonly isVideo = computed(() => this.kind() === 'video');

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

  /**
   * In the tab order when the keyboard can do something there: step, pan, or (filling a page, where
   * the viewer is the whole point of it) zoom.
   */
  protected readonly focusable = computed(() => this.navigable() || this.pannable() || (this.fill() && !this.isVideo()));

  /** There is only something to drag once the image is bigger than the stage. */
  protected readonly pannable = computed(() => !this.isVideo() && this.zoom() > 1);

  protected reset(): void {
    this.zoom.set(1);
    this.offset.set({ x: 0, y: 0 });
    // A new image arriving mid-gesture must not inherit the last one's travel.
    this.swipe.set(0);
  }

  protected toggleZoom(): void {
    if (this.isVideo()) return;   // a double tap on a clip belongs to the clip
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

  /** Keeps the image reachable — see {@link clampOffset}. */
  private clamp(o: { x: number; y: number }): { x: number; y: number } {
    const stage = this.stage()?.nativeElement;
    const img = this.img()?.nativeElement;
    if (!stage || !img) return o;
    const box = { width: stage.clientWidth, height: stage.clientHeight };
    // The element fills the stage; what is drawn is the picture fitted into it (object-fit: contain),
    // and that is what must stay reachable, not the letterbox around it.
    return clampOffset(o, fitContain({ width: img.naturalWidth, height: img.naturalHeight }, box), box, this.zoom());
  }

  protected onWheel(e: WheelEvent): void {
    if (this.isVideo()) return;
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
    // + / - / 0 zoom and reset, as in the Flutter viewer and most image apps.
    if (!this.isVideo() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const zoomKey: Record<string, () => void> = { '+': () => this.zoomBy(0.25), '=': () => this.zoomBy(0.25), '-': () => this.zoomBy(-0.25), '0': () => this.reset() };
      if (zoomKey[e.key]) {
        zoomKey[e.key]();
        e.preventDefault();
        return;
      }
    }
    // Zoomed in, the arrows pan — the keyboard's version of dragging the picture around.
    const pan: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (this.pannable() && pan[e.key]) {
      const [dx, dy] = pan[e.key];
      const step = e.shiftKey ? 160 : 40;
      this.offset.update((o) => this.clamp({ x: o.x + dx * step, y: o.y + dy * step }));
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight' && this.hasNext()) this.next.emit();
    else if (e.key === 'ArrowLeft' && this.hasPrevious()) this.previous.emit();
    else return;
    e.preventDefault();
  }

  protected onDown(e: PointerEvent): void {
    // Not captured over a clip: capturing it here is capturing it away from the scrubber, and a
    // video whose seek bar has stopped working is a worse trade than a swipe that needs more room.
    if (!this.isVideo()) (e.target as Element).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1 && !this.onControls(e)) {
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
    return resist(dx, this.stage()?.nativeElement.clientWidth ?? 0, blocked);
  }

  /** Decides what the finished drag meant, then puts the image back at rest either way. */
  private settle(at: number): void {
    const from = this.swipeFrom;
    const dx = this.swipe();
    this.swipeFrom = null;
    this.swipe.set(0);
    if (!from || !dx) return;

    const width = this.stage()?.nativeElement.clientWidth ?? 0;
    if (!isSwipe(dx, this.swipeDy, at - from.at, width)) return;

    if (dx < 0 && this.hasNext()) this.next.emit();
    else if (dx > 0 && this.hasPrevious()) this.previous.emit();
  }

  /**
   * Whether the gesture began on a clip's own controls.
   *
   * <p>Pointer events from inside the video's shadow DOM reach us all the same, so a drag along the
   * seek bar is indistinguishable from a swipe across the picture — and scrubbing would jump to the
   * next clip. The controls sit at the bottom, so the bottom of the clip is not swipeable. Nothing
   * else about the gesture changes: a swipe anywhere above it still works.</p>
   */
  private onControls(e: PointerEvent): boolean {
    const clip = this.clip()?.nativeElement;
    if (!clip) return false;
    const box = clip.getBoundingClientRect();
    return e.clientY > box.bottom - 56 && e.clientX >= box.left && e.clientX <= box.right;
  }

  /** Distance between the two live pointers. */
  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
