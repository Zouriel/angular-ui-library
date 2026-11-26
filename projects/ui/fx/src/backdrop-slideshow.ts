import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  numberAttribute,
  untracked,
  viewChildren,
} from '@angular/core';
import { injectUiConfig } from '@zouriel/ui';

/** One photo of a `ui-backdrop-slideshow`. */
export interface UiBackdropSlide {
  /** Image URL (the fallback when `srcset` is given). */
  src: string;
  /** Responsive sources, e.g. `'slide-960.webp 960w, slide-1920.webp 1920w'` (sizes is 100vw). */
  srcset?: string;
  /** Description; decorative slideshows are hidden from screen readers, so this is only kept on the img. */
  alt?: string;
  /** CSS object-position, e.g. `'center 30%'`, to keep the subject in frame. */
  position?: string;
}

/** How strongly the theme's page colour is laid over the photos. */
export type UiBackdropScrim = 'none' | 'soft' | 'strong';

/** How each slide moves: `'pan'` right to left across a photo wider than the screen, `'zoom'` a slow zoom and drift, `'none'`. */
export type UiBackdropMotion = 'pan' | 'zoom' | 'none';

/** Share of the overflow kept as a margin at each end of a pan, so it never stops exactly on an edge. */
export const UI_SLIDESHOW_PAN_MARGIN = 0.04;

/**
 * The pan for a photo `natW` x `natH` shown at the full height of a `viewW` x `viewH` box: the photo's
 * rendered width and the start and end translateX (px, right to left), or null when it barely overflows
 * (under 48px or 6% of the width), where a slow zoom and drift reads better.
 */
export function uiSlideshowPan(viewW: number, viewH: number, natW: number, natH: number, margin = UI_SLIDESHOW_PAN_MARGIN): { width: number; from: number; to: number } | null {
  if (!(viewW > 0 && viewH > 0 && natW > 0 && natH > 0)) return null;
  const width = (viewH * natW) / natH;
  const overflow = width - viewW;
  if (overflow < Math.max(48, viewW * 0.06)) return null;
  return { width, from: -overflow * margin, to: -overflow * (1 - margin) };
}

/** Under reduced motion the crossfade is plain and at least this slow (ms). */
export const UI_SLIDESHOW_REDUCED_FADE_MS = 2400;

/**
 * `ui-backdrop-slideshow` — a decorative full-screen background of photos that crossfade while they move.
 *
 * `motion: 'pan'` (default): on a narrow or portrait screen each photo fills the height and pans slowly
 * right to left across its whole width (a small margin at each end) over the time it shows, so a phone
 * sees most of a wide photo; the next slide starts its own pan as it fades in, so the motion never stops
 * during a crossfade. The travel comes from the photo's real aspect ratio and is recomputed on resize.
 * Where the photo barely overflows (a wide screen), it falls back to a slow zoom and drift, so it is never
 * static. `'zoom'`: always the slow zoom and drift. `'none'`: still photos. Only transform (translate3d,
 * scale) and opacity animate, through the Web Animations API: no layout work while it runs.
 *
 * The first slide shows at once; every next slide is loaded and decoded before it fades in over the
 * current one, so there is never a blank frame. It pauses while the tab is hidden. One slide is static.
 * Under prefers-reduced-motion there is no pan or zoom and the crossfade is plain and slow; with
 * provideUiConfig({ animations: false }) it stays on the first slide.
 *
 * `fixed` (default) covers the window: position fixed, inset 0, z-index 0, no pointer, aria-hidden. Layer
 * order for a page that uses several backgrounds: the slideshow first (bottom), then `ui-liquid-backdrop`
 * or `ui-model-viewer [fixed]`, then the content, which needs `position: relative` (or a z-index) to sit
 * above these positioned layers. `scrim` lays the theme's page colour over the photos (soft 45%, strong
 * 72%, tokens `--ui-backdrop-scrim-soft/-strong`) so glass cards and text on top read in light and dark
 * themes.
 */
@Component({
  selector: 'ui-backdrop-slideshow',
  host: {
    'aria-hidden': 'true',
    class: 'ui-backdrop-slideshow',
    '[class.fixed]': 'fixed()',
    '[attr.data-scrim]': 'scrim()',
  },
  template: `
    <img #layer class="layer" alt="" decoding="async" sizes="100vw" />
    <img #layer class="layer" alt="" decoding="async" sizes="100vw" />
    @if (scrim() !== 'none') {
      <div class="scrim"></div>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        contain: strict;
      }
      :host(.fixed) {
        position: fixed;
      }
      .layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        will-change: opacity, transform;
        transform-origin: 50% 50%;
        backface-visibility: hidden;
      }
      /* Above both photo layers (they take z-index 0 and 1 as they swap). */
      .scrim {
        position: absolute;
        inset: 0;
        z-index: 2;
      }
      :host([data-scrim='soft']) .scrim {
        background: color-mix(in srgb, var(--ui-backdrop-scrim, var(--ui-color-bg)) var(--ui-backdrop-scrim-soft, 45%), transparent);
      }
      :host([data-scrim='strong']) .scrim {
        background: color-mix(in srgb, var(--ui-backdrop-scrim, var(--ui-color-bg)) var(--ui-backdrop-scrim-strong, 72%), transparent);
      }
    `,
  ],
})
export class UiBackdropSlideshow {
  /** The photos, in order. */
  slides = input<readonly UiBackdropSlide[]>([]);
  /** How long each slide shows, in ms (from the start of its fade in). */
  interval = input(7000, { transform: numberAttribute });
  /** Crossfade duration, in ms. */
  fade = input(1600, { transform: numberAttribute });
  /** How each slide moves: pan right to left (default), a slow zoom and drift, or none. Off under reduced motion. */
  motion = input<UiBackdropMotion>('pan');
  /** Cover the window (position fixed) instead of the nearest positioned container. */
  fixed = input(true, { transform: booleanAttribute });
  /** The theme's page colour over the photos, so content on top reads. */
  scrim = input<UiBackdropScrim>('soft');

  private readonly layers = viewChildren<ElementRef<HTMLImageElement>>('layer');
  private readonly zone = inject(NgZone);
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;
  private readonly animationsOn = injectUiConfig().animations;

  /** Index of the slide on top, and which of the two layers holds it. */
  private current = -1;
  private front = 0;
  private readonly anims = new Map<HTMLImageElement, { anim: Animation; index: number; ms: number }>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private destroyed = false;
  private hidden = false;
  private reducedMotion = false;
  private seq = 0;
  private cleanups: (() => void)[] = [];

  constructor() {
    afterNextRender(() => {
      this.started = true;
      this.watch();
      this.restart();
    });
    effect(() => {
      this.slides();
      untracked(() => {
        if (this.started) this.restart();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stop();
      for (const c of this.cleanups) c();
    });
  }

  /** The slide on top now (-1 before the first shows). */
  get index(): number {
    return this.current;
  }

  private get motionAllowed(): boolean {
    return this.animationsOn && !this.reducedMotion;
  }

  private watch(): void {
    const doc = this.host.ownerDocument;
    const onVis = () => {
      this.hidden = doc.visibilityState === 'hidden';
      if (this.hidden) this.stop();
      else this.schedule();
    };
    doc.addEventListener('visibilitychange', onVis);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.relayout());
      ro.observe(this.host);
      this.cleanups.push(() => ro.disconnect());
    }
    this.cleanups.push(() => doc.removeEventListener('visibilitychange', onVis));
    this.hidden = doc.visibilityState === 'hidden';
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq) {
      this.reducedMotion = mq.matches;
      const onMq = () => (this.reducedMotion = mq.matches);
      mq.addEventListener?.('change', onMq);
      this.cleanups.push(() => mq.removeEventListener?.('change', onMq));
    }
  }

  /** Show the first slide at once (no fade) and start the cycle. */
  private restart(): void {
    this.stop();
    const slides = this.slides();
    const [a, b] = this.layers().map((r) => r.nativeElement);
    if (!a || !b) return;
    this.seq++;
    this.current = -1;
    for (const el of [a, b]) {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.zIndex = '0';
      this.halt(el);
      el.removeAttribute('src');
      el.removeAttribute('srcset');
    }
    if (!slides.length) return;
    this.front = 0;
    this.assign(a, slides[0]);
    a.style.opacity = '1';
    a.style.zIndex = '1';
    this.current = 0;
    const seq = this.seq;
    // Show it at once; start its motion as soon as its size is known.
    const go = () => seq === this.seq && !this.destroyed && this.move(a, 0);
    if (a.complete && a.naturalWidth) go();
    else a.decode?.().then(go, () => undefined);
    this.schedule();
  }

  private schedule(): void {
    this.stop();
    if (this.destroyed || this.hidden || !this.animationsOn || this.slides().length < 2 || this.current < 0) return;
    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => void this.advance(), Math.max(this.interval(), 500));
    });
    this.preload((this.current + 1) % this.slides().length);
  }

  /** Warm the cache with the next photo now, so its fade starts on time and the pans never wait. */
  private preload(index: number): void {
    const s = this.slides()[index];
    if (!s || typeof Image === 'undefined') return;
    const img = new Image();
    if (s.srcset) {
      img.sizes = '100vw';
      img.srcset = s.srcset;
    }
    img.src = s.src;
    img.decode?.().catch(() => undefined);
  }

  private stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Load and decode the next slide in the hidden layer, then fade it in over the current one. */
  private async advance(): Promise<void> {
    const slides = this.slides();
    if (slides.length < 2) return;
    const seq = this.seq;
    const next = (this.current + 1) % slides.length;
    const layers = this.layers().map((r) => r.nativeElement);
    const incoming = layers[1 - this.front];
    const outgoing = layers[this.front];
    // The incoming layer is under the current one (or transparent), so changing its source shows nothing.
    incoming.style.transition = 'none';
    incoming.style.opacity = '0';
    this.halt(incoming);
    this.assign(incoming, slides[next]);
    try {
      await incoming.decode();
    } catch {
      // A broken image: skip it (stay on the current slide) and try the one after next time.
      if (seq === this.seq && !this.destroyed) {
        this.current = next;
        this.schedule();
      }
      return;
    }
    if (seq !== this.seq || this.destroyed) return;
    if (this.hidden) return; // resumes on visibilitychange
    const fade = this.motionAllowed ? this.fade() : Math.max(this.fade(), UI_SLIDESHOW_REDUCED_FADE_MS);
    outgoing.style.zIndex = '0';
    incoming.style.zIndex = '1';
    // The incoming slide is already moving when its fade starts; the outgoing one keeps moving under it.
    this.move(incoming, next);
    // Next frame: let opacity 0 apply, then fade in. The outgoing layer stays fully opaque underneath.
    requestAnimationFrame(() => {
      if (seq !== this.seq || this.destroyed) return;
      incoming.style.transition = `opacity ${fade}ms ease-in-out`;
      incoming.style.opacity = '1';
    });
    this.front = 1 - this.front;
    this.current = next;
    this.schedule();
  }

  private assign(el: HTMLImageElement, s: UiBackdropSlide): void {
    if (s.srcset) el.srcset = s.srcset;
    else el.removeAttribute('srcset');
    el.src = s.src;
    el.alt = s.alt ?? '';
    el.style.objectPosition = s.position ?? '';
  }

  /** Lay the photo out for its motion and start it (transform only, Web Animations API). */
  private move(el: HTMLImageElement, index: number): void {
    this.halt(el);
    // One slide is a still photo.
    const mode = this.motionAllowed && this.slides().length > 1 ? this.motion() : 'none';
    // Visible from the start of its fade in to the end of the next slide's fade (the next photo is preloaded),
    // so the pan reaches its far end just as the slide is covered.
    const ms = this.interval() + this.fade();
    const frames = this.frames(el, mode, index);
    if (!frames || typeof el.animate !== 'function') return;
    const anim = el.animate(frames, { duration: ms, easing: 'linear', fill: 'both' });
    this.anims.set(el, { anim, index, ms });
  }

  /** Keyframes for one slide, and the layer's size: full height and its own width for a pan, cover otherwise. */
  private frames(el: HTMLImageElement, mode: UiBackdropMotion, index: number): Keyframe[] | null {
    el.style.left = '0';
    el.style.width = '100%';
    if (mode === 'none') {
      el.style.transform = '';
      return null;
    }
    if (mode === 'pan') {
      const pan = uiSlideshowPan(this.host.clientWidth, this.host.clientHeight, el.naturalWidth, el.naturalHeight);
      if (pan) {
        el.style.width = `${pan.width}px`;
        return [{ transform: `translate3d(${pan.from}px, 0, 0)` }, { transform: `translate3d(${pan.to}px, 0, 0)` }];
      }
    }
    // Zoom and drift: alternate four gentle directions.
    const dirs = [
      ['scale(1.03) translate3d(0, 0, 0)', 'scale(1.1) translate3d(-1.5%, -1%, 0)'],
      ['scale(1.03) translate3d(0, 0, 0)', 'scale(1.1) translate3d(1.5%, -1%, 0)'],
      ['scale(1.1) translate3d(1%, 1%, 0)', 'scale(1.03) translate3d(0, 0, 0)'],
      ['scale(1.1) translate3d(-1%, 1%, 0)', 'scale(1.03) translate3d(0, 0, 0)'],
    ][index % 4];
    return [{ transform: dirs[0] }, { transform: dirs[1] }];
  }

  /** On resize, recompute each running slide's travel and keep its progress. */
  private relayout(): void {
    // A snapshot: move() deletes and re-adds each entry, which a live Map iteration would visit forever.
    for (const [el, a] of [...this.anims]) {
      const t = a.anim.currentTime;
      this.move(el, a.index);
      const now = this.anims.get(el);
      if (now && t !== null) now.anim.currentTime = t;
    }
  }

  private halt(el: HTMLImageElement): void {
    this.anims.get(el)?.anim.cancel();
    this.anims.delete(el);
  }
}
