import { Component, ElementRef, OnDestroy, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';

/**
 * `ui-device-frame` — a phone-shaped frame whose screen is exactly `width` × `height` CSS pixels,
 * scaled to fit the space it's given. What you project renders at true phone size (so a 390px-wide
 * page lays out as it would on a phone) and is scaled down only visually.
 *
 * `zoom` multiplies the fitted scale (1 = fits, 2 = twice that). Zoomed past the space, the host
 * scrolls both ways to every edge; smaller, the phone stays centred.
 *
 * Readable from a template reference: `scale` (the scale actually drawn, for overlays that have to
 * line up with the screen), `fitScale` (the scale at zoom 1, so `scale / fitScale` is the zoom shown
 * as "100% = fits") and `scrollElement` (the host, which is what scrolls).
 *
 * Zooming around a point (Ctrl+wheel, pinch): keep the point under the cursor still by reading it
 * before the zoom changes and scrolling it back afterwards:
 *
 * ```ts
 * const p = frame.pointAt(e.clientX, e.clientY);   // screen px under the cursor, at the old scale
 * zoom.set(next);
 * afterNextRender(() => frame.scrollPointTo(p, e.clientX, e.clientY), { injector });
 * ```
 *
 * By hand, with `s0`/`s1` the old and new `scale()` and `r` the screen's client rect at each scale:
 * `p.x = (clientX - r0.left) / s0`, then after rendering
 * `scrollElement.scrollLeft += r1.left + p.x * s1 - clientX` (and the same with top/Y).
 */
@Component({
  selector: 'ui-device-frame',
  host: { class: 'ui-device-frame', '[class.zoomed]': 'zoomFactor() > 1' },
  template: `
    <div class="fit" [style.width.px]="outerW() * scale()" [style.height.px]="outerH() * scale()">
      <div class="device" [class.bare]="!bezel()" [style.width.px]="outerW()" [style.height.px]="outerH()" [style.transform]="'scale(' + scale() + ')'">
        <div #screen class="screen" [style.width.px]="width()" [style.height.px]="height()">
          <ng-content />
        </div>
        @if (bezel() && island()) { <span class="island" aria-hidden="true"></span> }
      </div>
    </div>
  `,
  styles: `
    :host { display: flex; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
    /* Zoomed in, the host scrolls. Centred with auto margins, not justify/align-content: those push
       an overflowing box past the start edge where it can't be scrolled to. */
    :host(.zoomed) { overflow: auto; }
    .fit { position: relative; flex: none; margin: auto; }
    .device { position: absolute; left: 0; top: 0; transform-origin: 0 0; box-sizing: border-box; padding: var(--bezel);
      border-radius: 54px; background: #152026; /* Black Pine: the colour the frame always had (it read a Winter primitive, now retired) */ box-shadow: var(--ui-shadow-3), inset 0 0 0 2px color-mix(in srgb, #fff 12%, transparent); --bezel: 12px; }
    .device.bare { padding: 0; border-radius: 0; background: none; box-shadow: var(--ui-shadow-2); --bezel: 0px; }
    .screen { position: relative; overflow: hidden; border-radius: 42px; background: var(--ui-color-bg); isolation: isolate; }
    .device.bare .screen { border-radius: var(--ui-radius); }
    .island { position: absolute; top: calc(var(--bezel) + 11px); left: 50%; width: 110px; height: 32px; translate: -50% 0;
      border-radius: 20px; background: #000; z-index: 5; pointer-events: none;
      /* A faint rim, as the bezel has: on a dark screen a black island would vanish. */
      box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 12%, transparent); }
  `,
})
export class UiDeviceFrame implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  width = input(390);
  height = input(844);
  bezel = input(true);
  island = input(true);
  /** Never fit up past this. Applies to the fitted scale only, not to `zoom`. */
  maxScale = input(1);
  /** Multiplies the fitted scale: 1 fits, 2 is twice that. Kept within 0.25–8. */
  zoom = input(1);

  private readonly avail = signal<{ w: number; h: number }>({ w: 0, h: 0 });
  protected readonly outerW = computed(() => this.width() + (this.bezel() ? 24 : 0));
  protected readonly outerH = computed(() => this.height() + (this.bezel() ? 24 : 0));
  protected readonly zoomFactor = computed(() => {
    const z = this.zoom();
    return Number.isFinite(z) ? Math.min(8, Math.max(0.25, z)) : 1;
  });
  /** The scale that fits the frame into the host (capped by `maxScale`): the scale at zoom 1. */
  readonly fitScale = computed(() => {
    const { w, h } = this.avail();
    if (!w || !h) return 1;
    return Math.max(0.1, Math.min(this.maxScale(), w / this.outerW(), h / this.outerH()));
  });
  /** The scale actually drawn: `fitScale * zoom`. */
  readonly scale = computed(() => this.fitScale() * this.zoomFactor());

  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  /** The element that scrolls when zoomed in (the host). */
  get scrollElement(): HTMLElement {
    return this.host.nativeElement;
  }

  /** The point of the screen (in unscaled screen px, as the projected content sees them) under a client point. */
  pointAt(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.screen().nativeElement.getBoundingClientRect();
    const s = this.scale();
    return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
  }

  /** Scroll so screen point `p` (from `pointAt`) sits under the client point, at the scale now drawn. */
  scrollPointTo(p: { x: number; y: number }, clientX: number, clientY: number): void {
    const r = this.screen().nativeElement.getBoundingClientRect();
    const s = this.scale();
    const el = this.host.nativeElement;
    el.scrollLeft += r.left + p.x * s - clientX;
    el.scrollTop += r.top + p.y * s - clientY;
  }

  private observer?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.observer = new ResizeObserver(([entry]) => {
        // The border box, which includes any scrollbars: the fit mustn't shrink when zooming in adds them.
        const b = entry.borderBoxSize?.[0];
        const box = b ? { w: b.inlineSize, h: b.blockSize } : { w: entry.contentRect.width, h: entry.contentRect.height };
        this.avail.set(box);
      });
      this.observer.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
