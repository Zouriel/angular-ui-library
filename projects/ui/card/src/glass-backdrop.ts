import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  input,
  effect,
  signal,
  type Signal,
} from '@angular/core';

/** The static backdrop published to descendant `ui-card` instances. */
export interface UiGlassBackdropContext {
  readonly imageUrl: Signal<string | null>;
  registerCard(card: HTMLElement): () => void;
}

export const UI_GLASS_BACKDROP = new InjectionToken<UiGlassBackdropContext>('UI_GLASS_BACKDROP');

function numberValue(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Paints a static image background and publishes one downscaled, blurred copy to glass cards below it.
 * The copy is deliberately not a live CSS backdrop: cards only paint a positioned slice of this image.
 * Liquid refraction is skipped in this mode; the rim, sheen and tint remain on the card.
 */
@Component({
  selector: 'ui-glass-backdrop',
  providers: [{ provide: UI_GLASS_BACKDROP, useExisting: UiGlassBackdrop }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="source" [style.background-color]="color()" [style.background-image]="imageCss()"></div>
    <div class="dim" [style.opacity]="dim()"></div>
    <ng-content />
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; isolation: isolate; }
    .source, .dim { position: absolute; inset: 0; pointer-events: none; }
    .source { background-position: center; background-repeat: no-repeat; background-size: cover; }
    .dim { background: oklch(0 0 0); }
    :host > ::ng-deep *:not(.source):not(.dim) { position: relative; z-index: 1; }
  `,
})
export class UiGlassBackdrop implements UiGlassBackdropContext {
  image = input<string | null>(null);
  dim = input(0, { transform: (value: number | string) => Math.min(1, Math.max(0, Number(value) || 0)) });
  color = input('transparent');
  readonly imageUrl = signal<string | null>(null);
  private readonly host: HTMLElement;
  private objectUrl: string | null = null;
  private generation = 0;
  private readonly cards = new Map<HTMLElement, () => void>();

  constructor(private readonly element: ElementRef<HTMLElement>, destroy: DestroyRef) {
    this.host = element.nativeElement;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.rebuild());
    ro?.observe(this.host);
    destroy.onDestroy(() => {
      ro?.disconnect();
      this.generation++;
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
      this.imageUrl.set(null);
      for (const stop of this.cards.values()) stop();
      this.cards.clear();
    });
    effect(() => {
      this.image(); this.dim(); this.color();
      this.rebuild();
    });
  }

  protected imageCss(): string {
    return this.image() ? `url("${this.image()!.replaceAll('"', '%22')}")` : 'none';
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

  private rebuild(): void {
    const src = this.image();
    if (!src || typeof document === 'undefined') { this.replaceUrl(null); return; }
    const generation = ++this.generation;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (generation !== this.generation) return;
      const rect = this.host.getBoundingClientRect();
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
        this.replaceUrl(URL.createObjectURL(blob));
      }, 'image/png');
    };
    image.onerror = () => { if (generation === this.generation) this.replaceUrl(null); };
    image.src = src;
  }

  private replaceUrl(url: string | null): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = url;
    this.imageUrl.set(url);
  }
}
