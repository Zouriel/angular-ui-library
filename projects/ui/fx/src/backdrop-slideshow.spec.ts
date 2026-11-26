import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideUiConfig } from '@zouriel/ui';
import { UI_SLIDESHOW_REDUCED_FADE_MS, UiBackdropSlideshow, uiSlideshowPan, type UiBackdropMotion, type UiBackdropScrim, type UiBackdropSlide } from './backdrop-slideshow';

const SLIDES: UiBackdropSlide[] = [
  { src: '/s1.webp', srcset: '/s1-960.webp 960w, /s1.webp 1920w', alt: 'One', position: 'center 30%' },
  { src: '/s2.webp' },
  { src: '/s3.webp' },
];

@Component({
  imports: [UiBackdropSlideshow],
  template: `<ui-backdrop-slideshow [slides]="slides()" [interval]="1000" [fade]="200" [motion]="motion()" [scrim]="scrim()" [fixed]="fixed()" />`,
})
class Host {
  slides = signal<UiBackdropSlide[]>(SLIDES);
  motion = signal<UiBackdropMotion>('pan');
  scrim = signal<UiBackdropScrim>('soft');
  fixed = signal(true);
}

let reduce = false;
let decodes: string[] = [];
let animations: { el: HTMLElement; frames: Keyframe[]; opts: KeyframeAnimationOptions }[] = [];
let rafs: FrameRequestCallback[] = [];

function layers(f: { nativeElement: HTMLElement }): HTMLImageElement[] {
  return [...f.nativeElement.querySelectorAll('img.layer')] as HTMLImageElement[];
}
const top = (f: { nativeElement: HTMLElement }) => layers(f).find((l) => l.style.zIndex === '1')!;
const flushRaf = () => {
  const q = rafs;
  rafs = [];
  for (const cb of q) cb(performance.now());
};

async function make(providers: unknown[] = [], setup?: (h: Host) => void) {
  TestBed.configureTestingModule({ providers: providers as never[] });
  const f = TestBed.createComponent(Host);
  setup?.(f.componentInstance);
  f.detectChanges();
  await f.whenStable();
  await vi.advanceTimersByTimeAsync(0);
  flushRaf();
  return f;
}

describe('ui-backdrop-slideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reduce = false;
    decodes = [];
    animations = [];
    rafs = [];
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') && reduce, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafs.push(cb));
    // The slideshow fills a 390 x 844 phone.
    const size = (v: number) => ({ configurable: true, get(this: HTMLElement) { return this.classList?.contains('ui-backdrop-slideshow') ? v : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', size(390));
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', size(844));
    // The test photos are 1920 x 1080 and decode at once.
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1920 });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 1080 });
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
      decodes.push(this.getAttribute('src') ?? '');
      return Promise.resolve();
    };
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = function (this: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions) {
      animations.push({ el: this, frames, opts });
      return { cancel() {}, currentTime: 0 } as unknown as Animation;
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth;
    delete (HTMLElement.prototype as unknown as { clientHeight?: unknown }).clientHeight;
  });

  it('shows the first slide at once, decoded, as a decorative fixed layer under a theme scrim', async () => {
    const f = await make();
    const host = f.nativeElement.querySelector('ui-backdrop-slideshow') as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.classList).toContain('fixed');
    expect(host.getAttribute('data-scrim')).toBe('soft');
    expect(host.querySelector('.scrim')).toBeTruthy();
    const first = top(f);
    expect(first.getAttribute('src')).toBe('/s1.webp');
    expect(first.getAttribute('srcset')).toContain('960w');
    expect(first.style.opacity).toBe('1');
    expect(first.style.objectPosition).toBe('center 30%');
    const css = (UiBackdropSlideshow as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(css).toMatch(/\.fixed[^{]*\{\s*position:\s*fixed/);
    expect(css).toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/object-fit:\s*cover/);
    expect(css).toMatch(/\.scrim[^{]*\{[^}]*z-index:\s*2/); // over both photo layers
    expect(css).toContain('var(--ui-backdrop-scrim-soft');
    expect(css).toContain('var(--ui-backdrop-scrim-strong');
    // Transform and opacity only: no animated layout properties.
    expect(css).not.toMatch(/transition:[^;]*(width|height|left|top)/);
  });

  it('pans each photo right to left across its overflow on a phone, the next one starting as its fade begins', async () => {
    const f = await make();
    const pan = animations.at(-1)!;
    expect(pan.el).toBe(top(f));
    const from = parseFloat(String(pan.frames[0]['transform']).match(/translate3d\((-?[\d.]+)px/)![1]);
    const to = parseFloat(String(pan.frames[1]['transform']).match(/translate3d\((-?[\d.]+)px/)![1]);
    const expected = uiSlideshowPan(390, 844, 1920, 1080)!;
    expect(from).toBeCloseTo(expected.from, 3);
    expect(to).toBeCloseTo(expected.to, 3);
    expect(to).toBeLessThan(from); // right to left
    expect(pan.opts.easing).toBe('linear');
    // It keeps moving until the next slide has fully faded in over it.
    expect(Number(pan.opts.duration)).toBeGreaterThanOrEqual(1000 + 200);
    expect(top(f).style.width).toBe(`${expected.width}px`);

    const before = animations.length;
    await vi.advanceTimersByTimeAsync(1000);
    const incoming = top(f);
    expect(incoming.getAttribute('src')).toBe('/s2.webp');
    expect(decodes).toContain('/s2.webp');
    // Decoded and already panning before it fades in; the old slide stays opaque underneath.
    expect(animations.length).toBeGreaterThan(before);
    expect(animations.at(-1)!.el).toBe(incoming);
    expect(incoming.style.opacity).toBe('0');
    const outgoing = layers(f).find((l) => l !== incoming)!;
    expect(outgoing.style.opacity).toBe('1');
    flushRaf();
    expect(incoming.style.opacity).toBe('1');
    expect(incoming.style.transition).toContain('200ms');
  });

  it('recomputes the travel on resize, once per running slide, keeping its progress', async () => {
    let resize: (() => void) | null = null;
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resize = cb; } observe() {} disconnect() {} });
    await make();
    const before = animations.length;
    resize!();
    expect(animations.length - before).toBe(1); // the one slide on screen, not an endless loop
  });

  it('falls back to a slow zoom where the photo barely overflows, and zoom / none on request', () => {
    expect(uiSlideshowPan(1440, 810, 1920, 1080)).toBeNull(); // 16:9 on 16:9
    expect(uiSlideshowPan(1440, 840, 1920, 1080)).toBeNull(); // 53px of overflow, under 6% of the width
    expect(uiSlideshowPan(1440, 900, 1920, 1080)).not.toBeNull(); // 160px: a slow pan
    const phone = uiSlideshowPan(390, 844, 1920, 1080)!;
    expect(phone.width).toBeCloseTo(1500.44, 1);
    // Reaches close to both edges of the photo: 4% of the overflow is left at each end.
    expect(-phone.from).toBeCloseTo((1500.44 - 390) * 0.04, 1);
    expect(-phone.to).toBeCloseTo((1500.44 - 390) * 0.96, 1);
  });

  it('zooms with motion="zoom" and stands still with motion="none"', async () => {
    let f = await make([], (h) => h.motion.set('zoom'));
    expect(String(animations.at(-1)!.frames[0]['transform'])).toContain('scale(');
    TestBed.resetTestingModule();
    animations = [];
    f = await make([], (h) => h.motion.set('none'));
    expect(animations).toEqual([]);
    expect(top(f).style.width).toBe('100%');
  });

  it('under reduced motion: no pan or zoom, and a slow plain crossfade', async () => {
    reduce = true;
    const f = await make();
    expect(animations).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    flushRaf();
    expect(top(f).getAttribute('src')).toBe('/s2.webp');
    expect(top(f).style.transition).toContain(`${UI_SLIDESHOW_REDUCED_FADE_MS}ms`);
    expect(animations).toEqual([]);
  });

  it('is static with one slide or animations off, and pauses while the tab is hidden', async () => {
    let f = await make([], (h) => h.slides.set([SLIDES[0]]));
    await vi.advanceTimersByTimeAsync(5000);
    expect(top(f).getAttribute('src')).toBe('/s1.webp');
    expect(animations).toEqual([]);

    TestBed.resetTestingModule();
    f = await make([provideUiConfig({ animations: false })]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(top(f).getAttribute('src')).toBe('/s1.webp');

    TestBed.resetTestingModule();
    f = await make();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(top(f).getAttribute('src')).toBe('/s1.webp');
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(top(f).getAttribute('src')).toBe('/s2.webp');
    delete (document as unknown as { visibilityState?: unknown }).visibilityState;
  });

  it('drops the scrim with scrim="none" and covers its container without fixed', async () => {
    const f = await make([], (h) => {
      h.scrim.set('none');
      h.fixed.set(false);
    });
    const host = f.nativeElement.querySelector('ui-backdrop-slideshow') as HTMLElement;
    expect(host.querySelector('.scrim')).toBeNull();
    expect(host.classList).not.toContain('fixed');
  });
});
