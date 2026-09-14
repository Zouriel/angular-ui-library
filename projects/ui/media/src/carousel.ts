import { Component, OnDestroy, OnInit, effect, input, model, signal } from '@angular/core';

export interface UiCarouselSlide {
  image: string;
  alt?: string;
  caption?: string;
}

/** How far a finger has to travel, as a share of the width, before letting go turns the slide. */
const TURN_SHARE = 0.18;
/** A quick flick turns it too, however short. px per ms. */
const FLICK_SPEED = 0.45;
/** Movement before the gesture is read as sideways (ours) or up and down (the page's). */
const INTENT_PX = 8;

/**
 * `ui-carousel` — image slideshow with arrows, dots, a finger-following swipe and optional autoplay.
 *
 * Anything projected into it is laid over the slides (a title on a gradient, a counter), and a swipe
 * that starts on it still turns the slide.
 *
 * A swipe here is the carousel's own: touches that start inside it don't reach gesture handlers
 * further up the page, so a page-level swipe between screens never fires from a photo.
 */
@Component({
  selector: 'ui-carousel',
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd($event)',
    '(touchcancel)': 'onTouchEnd($event)',
  },
  template: `
    <div class="cz" (pointerenter)="paused.set(true)" (pointerleave)="paused.set(false)">
      <div
        class="track"
        [class.dragging]="drag() !== null"
        [style.transform]="'translateX(calc(' + (-index() * 100) + '% + ' + (drag() ?? 0) + 'px))'"
      >
        @for (s of slides(); track $index) {
          <div class="slide">
            <img [src]="s.image" [alt]="s.alt || ''" draggable="false" />
            @if (s.caption) { <div class="caption">{{ s.caption }}</div> }
          </div>
        }
      </div>
      <ng-content />
      @if (slides().length > 1) {
        @if (arrows()) {
          <button type="button" class="arrow prev" aria-label="Previous slide" (click)="prev()">‹</button>
          <button type="button" class="arrow next" aria-label="Next slide" (click)="next()">›</button>
        }
        @if (dots()) {
          <div class="dots">
            @for (s of slides(); track $index) {
              <button type="button" class="dot" [class.active]="$index === index()" [attr.aria-label]="'Go to slide ' + ($index + 1)" (click)="index.set($index)"></button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .cz { position: relative; overflow: hidden; border-radius: var(--ui-radius-lg); background: var(--ui-color-bg); touch-action: pan-y; }
    .track { display: flex; transition: transform var(--ui-motion-slow) var(--ui-ease-standard); }
    .track.dragging { transition: none; }
    .slide { position: relative; flex: 0 0 100%; }
    .slide img { width: 100%; height: 100%; max-height: 360px; object-fit: cover; display: block; user-select: none; -webkit-user-drag: none; }
    .caption { position: absolute; left: 0; right: 0; bottom: 0; padding: var(--ui-space-3); background: linear-gradient(transparent, color-mix(in srgb, var(--ui-media-scrim) 60%, transparent));
      color: var(--ui-media-on-scrim); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); }
    .arrow { position: absolute; top: 50%; transform: translateY(-50%); width: var(--ui-size-touch); height: var(--ui-size-touch); border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: none; background: color-mix(in srgb, var(--ui-media-scrim) 45%, transparent); color: var(--ui-media-on-scrim); cursor: pointer; font-size: 18px;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .arrow:hover { background: color-mix(in srgb, var(--ui-media-scrim) 65%, transparent); }
    .arrow:active { transform: translateY(-50%) scale(var(--ui-scale-press)); }
    .arrow:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .prev { left: var(--ui-space-2); } .next { right: var(--ui-space-2); }
    /* Fingers swipe; the arrows are for a mouse. */
    @media (hover: none) { .arrow { display: none; } }
    .dots { position: absolute; bottom: var(--ui-space-2); left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
    .dot { position: relative; width: 8px; height: 8px; border-radius: 50%; border: none; background: color-mix(in srgb, var(--ui-media-on-scrim) 50%, transparent); cursor: pointer; padding: 0;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .dot::before { content: ''; position: absolute; inset: -12px; }
    .dot:hover { background: color-mix(in srgb, var(--ui-media-on-scrim) 75%, transparent); }
    .dot:active { transform: scale(var(--ui-scale-press)); }
    .dot:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .dot.active { background: var(--ui-media-on-scrim); }
  `,
})
export class UiCarousel implements OnInit, OnDestroy {
  slides = input<UiCarouselSlide[]>([]);
  /** Autoplay interval in ms; 0 disables. */
  autoplay = input(0);
  /** The slide showing. Bind it to draw your own position marker. */
  index = model(0);
  /** The built-in dots. Turn off when drawing your own. */
  dots = input(true);
  /** The built-in arrows, shown only where there is a mouse. */
  arrows = input(true);

  protected readonly paused = signal(false);
  /** How far the finger has pulled the track, in px, while a swipe is under way. */
  protected readonly drag = signal<number | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  private start: { id: number; x: number; y: number; at: number; width: number } | null = null;
  /** Decided once the finger has moved enough: sideways is ours, anything else is the page's. */
  private sideways: boolean | null = null;

  constructor() {
    effect(() => {
      const n = this.slides().length;
      if (this.index() >= n && n > 0) this.index.set(0);
    });
  }

  ngOnInit(): void {
    const ms = this.autoplay();
    if (ms > 0) this.timer = setInterval(() => { if (!this.paused() && this.drag() === null) this.next(); }, ms);
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected next(): void { this.index.update((i) => (i + 1) % Math.max(1, this.slides().length)); }
  protected prev(): void { this.index.update((i) => (i - 1 + this.slides().length) % Math.max(1, this.slides().length)); }

  protected onTouchStart(event: TouchEvent): void {
    // Ours, whatever happens next: a screen-level swipe must not start from inside a photo.
    event.stopPropagation();
    if (event.touches.length > 1) { this.reset(); return; }
    const t = event.changedTouches[0];
    const width = (event.currentTarget as HTMLElement).clientWidth || 1;
    this.start = { id: t.identifier, x: t.clientX, y: t.clientY, at: event.timeStamp, width };
    this.sideways = null;
  }

  protected onTouchMove(event: TouchEvent): void {
    event.stopPropagation();
    const start = this.start;
    if (!start || this.slides().length < 2) return;
    const t = Array.from(event.changedTouches).find((c) => c.identifier === start.id);
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (this.sideways === null) {
      if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return;
      this.sideways = Math.abs(dx) > Math.abs(dy);
    }
    if (!this.sideways) return;
    if (event.cancelable) event.preventDefault();
    // Resistance past either end, so the edge is felt rather than hit.
    const atEdge = (dx > 0 && this.index() === 0) || (dx < 0 && this.index() === this.slides().length - 1);
    this.drag.set(atEdge ? dx / 3 : dx);
  }

  protected onTouchEnd(event: TouchEvent): void {
    event.stopPropagation();
    const start = this.start;
    const dx = this.drag();
    if (start && dx !== null && this.sideways) {
      const speed = Math.abs(dx) / Math.max(1, event.timeStamp - start.at);
      const turn = Math.abs(dx) > start.width * TURN_SHARE || speed > FLICK_SPEED;
      const last = this.slides().length - 1;
      if (turn && dx < 0 && this.index() < last) this.index.update((i) => i + 1);
      else if (turn && dx > 0 && this.index() > 0) this.index.update((i) => i - 1);
    }
    this.reset();
  }

  private reset(): void {
    this.start = null;
    this.sideways = null;
    this.drag.set(null);
  }
}
