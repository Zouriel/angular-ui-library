import { DecimalPipe } from '@angular/common';
import {
  Component, ElementRef, effect, input, signal, viewChild,
} from '@angular/core';

/**
 * `ui-pdf-viewer` — renders a PDF with page navigation and zoom. `pdfjs-dist`
 * is loaded via a dynamic import so it ships only when this component is used
 * (its own secondary entry point; pair with `@defer` for full lazy loading).
 * Override `workerSrc` to self-host the worker instead of the CDN default.
 */
@Component({
  selector: 'ui-pdf-viewer',
  imports: [DecimalPipe],
  template: `
    <div class="pv">
      <div class="bar">
        <button type="button" (click)="prev()" [disabled]="page() <= 1" aria-label="Previous page"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="pg">{{ page() }} / {{ pages() || '—' }}</span>
        <button type="button" (click)="next()" [disabled]="page() >= pages()" aria-label="Next page"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="spacer"></span>
        <button type="button" (click)="zoomBy(-0.2)" [disabled]="scale() <= minScale" aria-label="Zoom out"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="pct">{{ (scale() * 100) | number:'1.0-0' }}%</span>
        <button type="button" (click)="zoomBy(0.2)" [disabled]="scale() >= maxScale" aria-label="Zoom in"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="stage">
        @if (error()) { <div class="msg err">{{ error() }}</div> }
        @else if (loading()) { <div class="msg" role="status">Loading PDF…</div> }
        <canvas #canvas [class.hidden]="loading() || error()"></canvas>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .pv { display: flex; flex-direction: column; height: 100%; min-height: 240px; background: var(--ui-color-surface); border-radius: var(--ui-radius); overflow: hidden;
      font-family: var(--ui-font-default); line-height: 1.35; }
    .bar { display: flex; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .bar button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; padding: 0;
      width: var(--ui-size-sm); height: var(--ui-size-sm); border: none; background: transparent; color: var(--ui-color-text);
      border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard), opacity var(--ui-motion-base) var(--ui-ease-standard); }
    .bar button:hover:not(:disabled) { background: var(--ui-color-elevated-hover); }
    .bar button:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .bar button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .bar button:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (pointer: coarse) {
      .bar { gap: var(--ui-space-3); }
      .bar button { width: var(--ui-size-touch); height: var(--ui-size-touch); }
    }
    .spacer { flex: 1; }
    .pg, .pct { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted);
      font-variant-numeric: tabular-nums; min-width: 42px; text-align: center; }
    /* safe center: a page zoomed wider than the stage must still scroll to its left edge. */
    .stage { flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: safe center; padding: var(--ui-space-3); background: var(--ui-color-bg); }
    canvas { box-shadow: var(--ui-shadow-2); background: var(--ui-pdf-page-bg); }
    canvas.hidden { display: none; }
    .msg { padding: var(--ui-space-4); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .msg.err { color: var(--ui-color-danger); }
  `,
})
export class UiPdfViewer {
  src = input.required<string>();
  workerSrc = input<string>();

  protected readonly minScale = 0.4;
  protected readonly maxScale = 4;
  protected readonly page = signal(1);
  protected readonly pages = signal(0);
  protected readonly scale = signal(1.2);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private doc: any = null;

  constructor() {
    // (Re)load whenever src changes.
    effect(() => {
      const url = this.src();
      this.load(url);
    });
    // Re-render whenever page or scale changes (and a doc is loaded).
    effect(() => {
      const p = this.page();
      const s = this.scale();
      if (this.doc) this.render(p, s);
    });
  }

  private async load(url: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc =
        this.workerSrc() ?? `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      this.doc = await pdfjs.getDocument(url).promise;
      this.pages.set(this.doc.numPages);
      this.page.set(1);
      await this.render(1, this.scale());
    } catch (e) {
      this.error.set(`Could not load PDF: ${e}`);
    } finally {
      this.loading.set(false);
    }
  }

  private async render(pageNum: number, scale: number): Promise<void> {
    if (!this.doc) return;
    try {
      const page = await this.doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = this.canvas().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Backing store at device resolution, CSS box at layout size, so text is crisp on HiDPI.
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      await page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
    } catch (e) {
      this.error.set(`Render failed: ${e}`);
    }
  }

  protected prev(): void { this.page.update((p) => Math.max(1, p - 1)); }
  protected next(): void { this.page.update((p) => Math.min(this.pages(), p + 1)); }
  protected zoomBy(d: number): void { this.scale.update((s) => Math.min(this.maxScale, Math.max(this.minScale, +(s + d).toFixed(2)))); }
}
