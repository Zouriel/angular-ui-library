import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  computed,
  effect,
  input,
  signal,
  type Signal,
} from '@angular/core';

/** One synchronised source/blur pair painted by a glass backdrop transition. */
export interface UiGlassBackdropLayer {
  readonly sourceUrl: string;
  readonly imageUrl: string;
  readonly opacity: number;
}

/** The static backdrop published to descendant `ui-card` instances. */
export interface UiGlassBackdropContext {
  readonly imageUrl: Signal<string | null>;
  readonly layers: Signal<readonly UiGlassBackdropLayer[]>;
  registerCard(card: HTMLElement): () => void;
}

export const UI_GLASS_BACKDROP = new InjectionToken<UiGlassBackdropContext>('UI_GLASS_BACKDROP');

function numberValue(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function durationValue(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return value.trim().endsWith('s') && !value.trim().endsWith('ms') ? parsed * 1000 : parsed;
}

interface BackdropLayer {
  readonly sourceUrl: string;
  readonly imageUrl: string;
}

interface VisibleLayer {
  readonly layer: BackdropLayer;
  readonly opacity: number;
}

/**
 * Paints a static image background and publishes one downscaled, blurred copy to glass cards below it.
 * The copy is deliberately not a live CSS backdrop: cards only paint positioned slices of the same
 * source/blur layers. A transition runs only while an image is changing.
 */
@Component({
  selector: 'ui-glass-backdrop',
  providers: [{ provide: UI_GLASS_BACKDROP, useExisting: UiGlassBackdrop }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (i of [0, 1, 2, 3]; track i) {
      <div class="source" [class]="'source source-' + i" [style.background-image]="sourceCss(i)" [style.opacity]="layerOpacity(i)"></div>
    }
    <div class="dim" [style.background-color]="color()" [style.opacity]="dim()"></div>
    <ng-content />
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; isolation: isolate; }
    .source, .dim { position: absolute; inset: 0; pointer-events: none; }
    .source { background-position: center; background-repeat: no-repeat; background-size: cover; }
    .dim { z-index: 0; background: oklch(0 0 0); }
    :host > ::ng-deep *:not(.source):not(.dim) { position: relative; z-index: 1; }
  `,
})
export class UiGlassBackdrop implements UiGlassBackdropContext {
  image = input<string | null>(null);
  dim = input(0, { transform: (value: number | string) => Math.min(1, Math.max(0, Number(value) || 0)) });
  color = input('transparent');
  /** Cross-fade duration in milliseconds. Null follows `--ui-motion-slow`. */
  transition = input<number | string | null>(null);
  readonly layers = signal<readonly UiGlassBackdropLayer[]>([]);
  readonly imageUrl = computed(() => {
    const current = this.layers();
    return current.length ? current[current.length - 1].imageUrl : null;
  });
  private readonly host: HTMLElement;
  private readonly cards = new Map<HTMLElement, () => void>();
  private readonly owned = new Set<BackdropLayer>();
  private current: BackdropLayer | null = null;
  private from: VisibleLayer[] = [];
  private target: BackdropLayer | null = null;
  private fading = false;
  private ready: BackdropLayer | null = null;
  private readyAvailable = false;
  private readyAnimate = true;
  private progress = 1;
  private generation = 0;
  private requestedImage: string | null | undefined;
  private lastBuildKey = '';
  private raf = 0;
  private fadeStarted = 0;

  constructor(private readonly element: ElementRef<HTMLElement>, destroy: DestroyRef) {
    this.host = element.nativeElement;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.rebuild(false));
    ro?.observe(this.host);
    destroy.onDestroy(() => {
      ro?.disconnect();
      this.generation++;
      if (this.raf) this.host.ownerDocument.defaultView?.cancelAnimationFrame?.(this.raf);
      this.raf = 0;
      this.ready = null;
      for (const layer of this.owned) URL.revokeObjectURL(layer.imageUrl);
      this.owned.clear();
      for (const stop of this.cards.values()) stop();
      this.cards.clear();
    });
    effect(() => {
      const source = this.image();
      this.dim(); this.color();
      const changed = source !== this.requestedImage;
      this.requestedImage = source;
      this.rebuild(changed);
    });
  }

  protected sourceCss(index: number): string {
    const layer = this.layers()[index];
    return layer ? `url("${layer.sourceUrl.replaceAll('"', '%22')}")` : 'none';
  }

  protected layerOpacity(index: number): number {
    return this.layers()[index]?.opacity ?? 0;
  }

  registerCard(card: HTMLElement): () => void {
    const refresh = () => {
      const outer = this.host.getBoundingClientRect();
      const inner = card.getBoundingClientRect();
      card.style.setProperty('--_ui-glass-backdrop-x', `${inner.left - outer.left}px`);
      card.style.setProperty('--_ui-glass-backdrop-y', `${inner.top - outer.top}px`);
      card.style.setProperty('--_ui-glass-backdrop-width', `${outer.width}px`);
      card.style.setProperty('--_ui-glass-backdrop-height', `${outer.height}px`);
    };
    let frame = 0;
    let last = '';
    let activeUntil = 0;
    const track = () => {
      frame = 0;
      refresh();
      const now = `${card.style.getPropertyValue('--_ui-glass-backdrop-x')}|${card.style.getPropertyValue('--_ui-glass-backdrop-y')}`;
      const changed = now !== last;
      last = now;
      if (changed || performance.now() < activeUntil) frame = requestAnimationFrame(track);
    };
    const startTracking = () => {
      activeUntil = performance.now() + 1200;
      if (!frame) frame = requestAnimationFrame(track);
    };
    const onScroll = () => { refresh(); startTracking(); };
    const onMotion = () => startTracking();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { refresh(); startTracking(); });
    ro?.observe(card); ro?.observe(this.host);
    window.addEventListener('resize', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    card.addEventListener('animationstart', onMotion);
    card.addEventListener('transitionrun', onMotion);
    refresh();
    const stop = () => {
      ro?.disconnect(); window.removeEventListener('resize', onScroll);
      document.removeEventListener('scroll', onScroll, true);
      card.removeEventListener('animationstart', onMotion);
      card.removeEventListener('transitionrun', onMotion);
      if (frame) cancelAnimationFrame(frame);
    };
    this.cards.set(card, stop);
    return () => { stop(); this.cards.delete(card); };
  }

  private visibleLayers(): VisibleLayer[] {
    if (!this.fading) return this.current ? [{ layer: this.current, opacity: 1 }] : this.from;
    const visible = this.from
      .map(({ layer, opacity }) => ({ layer, opacity: opacity * (1 - this.progress) }))
      .filter(({ opacity }) => opacity > 0);
    if (this.target && this.progress > 0) visible.push({ layer: this.target, opacity: this.progress });
    return visible;
  }

  private publish(): void {
    this.layers.set(this.visibleLayers().map(({ layer, opacity }) => ({ ...layer, opacity })));
  }

  private rebuild(animate: boolean): void {
    const src = this.image();
    const rect = this.host.getBoundingClientRect();
    const key = `${src ?? ''}|${Math.round(rect.width)}x${Math.round(rect.height)}|${this.dim()}|${this.color()}`;
    if (key === this.lastBuildKey) return;
    this.lastBuildKey = key;
    const generation = ++this.generation;
    if (!src || typeof document === 'undefined') {
      this.finish(null, animate);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (generation !== this.generation) return;
      const scale = 0.25;
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const styles = getComputedStyle(this.host);
      const blur = numberValue(styles.getPropertyValue('--ui-glass-card-clear-blur'), 24);
      const saturate = numberValue(styles.getPropertyValue('--ui-glass-card-clear-saturate'), 1.6);
      ctx.filter = `blur(${blur * scale}px) saturate(${saturate})`;
      const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const dw = image.naturalWidth * cover;
      const dh = image.naturalHeight * cover;
      ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
      if (this.dim() > 0) {
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(0, 0, 0, ${this.dim()})`;
        ctx.fillRect(0, 0, width, height);
      }
      canvas.toBlob(blob => {
        if (!blob || generation !== this.generation) return;
        const layer = { sourceUrl: src, imageUrl: URL.createObjectURL(blob) };
        this.owned.add(layer);
        this.finish(layer, animate);
      }, 'image/png');
    };
    image.onerror = () => { if (generation === this.generation) this.finish(null, animate); };
    image.src = src;
  }

  private finish(layer: BackdropLayer | null, animate: boolean): void {
    if (this.ready) {
      this.owned.delete(this.ready);
      URL.revokeObjectURL(this.ready.imageUrl);
    }
    this.ready = layer;
    this.readyAvailable = true;
    this.readyAnimate = animate;
    this.consumeReady();
  }

  private consumeReady(): void {
    if (!this.readyAvailable) return;
    const layer = this.ready;
    this.ready = null;
    this.readyAvailable = false;
    const duration = this.transitionMs();
    if (!this.hasShown() || !this.readyAnimate || duration <= 0 || this.prefersReducedMotion()) {
      this.commit(layer);
      return;
    }
    this.from = this.visibleLayers();
    this.target = layer;
    this.fading = true;
    this.progress = 0;
    this.current = null;
    if (this.raf) this.host.ownerDocument.defaultView?.cancelAnimationFrame?.(this.raf);
    this.raf = 0;
    this.publish();
    this.fadeStarted = performance.now();
    this.scheduleFade();
  }

  private hasShown(): boolean {
    return this.current !== null || this.from.length > 0 || this.target !== null;
  }

  private commit(layer: BackdropLayer | null): void {
    if (this.raf) this.host.ownerDocument.defaultView?.cancelAnimationFrame?.(this.raf);
    this.raf = 0;
    for (const old of this.owned) {
      if (old !== layer) URL.revokeObjectURL(old.imageUrl);
    }
    this.owned.clear();
    if (layer) this.owned.add(layer);
    this.current = layer;
    this.from = [];
    this.target = null;
    this.fading = false;
    this.progress = 1;
    this.publish();
  }

  private scheduleFade(): void {
    const win = this.host.ownerDocument.defaultView;
    if (!win?.requestAnimationFrame || !this.fading) {
      this.commit(this.target);
      return;
    }
    this.raf = win.requestAnimationFrame((time) => {
      this.raf = 0;
      if (!this.fading) return;
      this.progress = Math.min(1, (time - this.fadeStarted) / this.transitionMs());
      this.publish();
      if (this.progress >= 1) this.commit(this.target);
      else this.scheduleFade();
    });
  }

  private transitionMs(): number {
    const raw = this.transition();
    if (raw !== null) return Math.max(0, typeof raw === 'number' ? raw : durationValue(raw));
    return durationValue(getComputedStyle(this.host).getPropertyValue('--ui-motion-slow'));
  }

  private prefersReducedMotion(): boolean {
    return !!this.host.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
}
