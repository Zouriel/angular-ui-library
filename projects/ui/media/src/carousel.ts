import { Component, OnDestroy, OnInit, computed, effect, input, model, signal } from '@angular/core';
import { injectUiStrings, uiFormatString, uiIsRtl } from '@zouriel/ui';

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
    <div class="cz" [class.has-dots]="dots() && slides().length > 1" (pointerenter)="hovered.set(true)" (pointerleave)="hovered.set(false)" (focusin)="focused.set(true)" (focusout)="onFocusOut($event)">
      <div
        class="track"
        [class.dragging]="drag() !== null"
        [style.transform]="'translateX(calc(' + (-index() * 100) + '% * var(--ui-inline-sign, 1) + ' + (drag() ?? 0) + 'px))'"
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
          <button type="button" class="arrow prev" [attr.aria-label]="strings.previousSlide" (click)="prev()"><svg viewBox="0 0 12 12" width="20" height="20" aria-hidden="true"><path d="M7.5 2.5L4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button type="button" class="arrow next" [attr.aria-label]="strings.nextSlide" (click)="next()"><svg viewBox="0 0 12 12" width="20" height="20" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        }
        @if (dots()) {
          <div class="dots">
            @for (s of slides(); track $index) {
              <button type="button" class="dot" [class.active]="$index === index()" [attr.aria-label]="format(strings.goToSlide, { n: $index + 1 })" (click)="index.set($index)"></button>
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
    .slide { position: relative; flex: 0 0 100%; display: flex; }
    .slide img { width: 100%; height: auto; align-self: stretch; max-height: 360px; object-fit: cover; display: block; user-select: none; -webkit-user-drag: none; }
    .caption { position: absolute; inset-inline: 0; bottom: 0; padding: var(--ui-space-6) var(--ui-space-3) var(--ui-space-3); background: linear-gradient(transparent, color-mix(in srgb, var(--ui-media-scrim) 60%, transparent));
      color: var(--ui-media-on-scrim); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    /* Room under the text for the row of dots, so a caption never runs beneath them. */
    .has-dots .caption { padding-bottom: calc(var(--ui-space-3) + 24px); }
    .arrow { position: absolute; top: 50%; transform: translateY(-50%); width: var(--ui-size-touch); height: var(--ui-size-touch); border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: none; background: color-mix(in srgb, var(--ui-media-scrim) 45%, transparent); color: var(--ui-media-on-scrim); cursor: pointer; font: inherit; padding: 0;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .arrow:hover { background: color-mix(in srgb, var(--ui-media-scrim) 65%, transparent); }
    .arrow:active { transform: translateY(-50%) scale(var(--ui-scale-press)); }
    .arrow:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Previous at the inline start, next at the end; the chevrons point that way (mirrored in RTL). */
    .prev { inset-inline-start: var(--ui-space-2); } .next { inset-inline-end: var(--ui-space-2); }
    .arrow:dir(rtl) svg { transform: scaleX(-1); }
    /* Fingers swipe; the arrows are for a mouse. */
    @media (hover: none) { .arrow { display: none; } }
    .dots { position: absolute; bottom: 0; inset-inline: 0; display: flex; justify-content: center; }
    /* The button is a 24px square (WCAG 2.5.8 target size); the visible dot is an 8px circle drawn inside it. */
    .dot { width: 24px; height: 24px; display: grid; place-items: center; border: none; background: none; cursor: pointer; padding: 0; }
    @media (pointer: coarse) { .dot { height: var(--ui-size-touch); } }
    .dot::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, var(--ui-media-on-scrim) 50%, transparent);
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .dot:hover::after { background: color-mix(in srgb, var(--ui-media-on-scrim) 75%, transparent); }
    .dot:active::after { transform: scale(var(--ui-scale-press)); }
    .dot:focus-visible { outline: none; }
    .dot:focus-visible::after { box-shadow: var(--ui-focus-ring); }
    .dot.active::after { background: var(--ui-media-on-scrim); }
  `,
})
export class UiCarousel implements OnInit, OnDestroy {
  protected readonly strings = injectUiStrings();
  protected readonly format = uiFormatString;
  slides = input<UiCarouselSlide[]>([]);
  /** Autoplay interval in ms; 0 disables. */
  autoplay = input(0);
  /** The slide showing. Bind it to draw your own position marker. */
  index = model(0);
  /** The built-in dots. Turn off when drawing your own. */
  dots = input(true);
  /** The built-in arrows, shown only where there is a mouse. */
  arrows = input(true);

  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  /** Autoplay holds while a pointer is over the carousel or focus is inside it. */
  protected readonly paused = computed(() => this.hovered() || this.focused());
  /** How far the finger has pulled the track, in px, while a swipe is under way. */
  protected readonly drag = signal<number | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  private start: { id: number; x: number; y: number; at: number; width: number; rtl: boolean } | null = null;
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
    // Reduced motion: no slide turns on its own; arrows, dots and swipes still work.
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (ms > 0 && !reduce) this.timer = setInterval(() => { if (!this.paused() && this.drag() === null) this.next(); }, ms);
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected onFocusOut(e: FocusEvent): void {
    const next = e.relatedTarget as Node | null;
    if (!next || !(e.currentTarget as HTMLElement).contains(next)) this.focused.set(false);
  }

  protected next(): void { this.index.update((i) => (i + 1) % Math.max(1, this.slides().length)); }
  protected prev(): void { this.index.update((i) => (i - 1 + this.slides().length) % Math.max(1, this.slides().length)); }

  protected onTouchStart(event: TouchEvent): void {
    // Ours, whatever happens next: a screen-level swipe must not start from inside a photo.
    event.stopPropagation();
    if (event.touches.length > 1) { this.reset(); return; }
    const t = event.changedTouches[0];
    const width = (event.currentTarget as HTMLElement).clientWidth || 1;
    // In RTL the next slide lies to the left, so a swipe to the right moves forward.
    this.start = { id: t.identifier, x: t.clientX, y: t.clientY, at: event.timeStamp, width, rtl: uiIsRtl(event.currentTarget as Element) };
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
    const fwd = start.rtl ? dx : -dx; // > 0: toward the next slide
    const atEdge = (fwd < 0 && this.index() === 0) || (fwd > 0 && this.index() === this.slides().length - 1);
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
      const fwd = start.rtl ? dx : -dx;
      if (turn && fwd > 0 && this.index() < last) this.index.update((i) => i + 1);
      else if (turn && fwd < 0 && this.index() > 0) this.index.update((i) => i - 1);
    }
    this.reset();
  }

  private reset(): void {
    this.start = null;
    this.sideways = null;
    this.drag.set(null);
  }
}
