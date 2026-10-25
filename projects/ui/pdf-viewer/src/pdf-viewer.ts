import { DecimalPipe } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, InjectionToken, afterNextRender, booleanAttribute, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';

/**
 * How ui-pdf-viewer loads pdf.js: `import('pdfjs-dist')` by default. Provide another loader to test
 * a viewer without pdf.js or to control when it arrives.
 */
export const UI_PDFJS = new InjectionToken<() => Promise<unknown>>('UI_PDFJS', {
  providedIn: 'root',
  factory: () => () => import('pdfjs-dist'),
});

/**
 * `ui-pdf-viewer` — renders a PDF with page navigation and zoom. `pdfjs-dist`
 * is loaded via a dynamic import so it ships only when this component is used
 * (its own secondary entry point; pair with `@defer` for full lazy loading).
 * Override `workerSrc` to self-host the worker instead of the CDN default.
 *
 * <p>With `fill` it is a whole page: it takes all the space its parent gives, each page is fitted
 * (contain, centred) into it with 100% meaning "fitted", and the controls float over the bottom.</p>
 */
@Component({
  selector: 'ui-pdf-viewer',
  imports: [DecimalPipe],
  template: `
    <div class="pv" [class.fill]="fill()">
      <div class="bar" [class.overlay]="fill()" role="group" [attr.aria-label]="strings.pageControls">
        <button type="button" (click)="prev()" [disabled]="page() <= 1" [attr.aria-label]="strings.previousPage"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="pg" [attr.aria-label]="pages() ? format(strings.pageOf, { n: page(), total: pages() }) : null">{{ page() }} / {{ pages() || '—' }}</span>
        <button type="button" (click)="next()" [disabled]="page() >= pages()" [attr.aria-label]="strings.nextPage"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="spacer"></span>
        <button type="button" (click)="zoomBy(-0.2)" [disabled]="zoom() <= minScale" [attr.aria-label]="strings.zoomOut"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span class="pct">{{ (zoom() * 100) | number:'1.0-0' }}%</span>
        <button type="button" (click)="zoomBy(0.2)" [disabled]="zoom() >= maxScale" [attr.aria-label]="strings.zoomIn"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        @if (fill()) {
          <button type="button" class="fit" (click)="fit()" [attr.aria-label]="strings.fitPage">{{ strings.fit }}</button>
        }
      </div>
      <div class="stage">
        <div #scroller class="scroller" (wheel)="onWheel($event)"
             (touchstart)="onTouch($event)" (touchmove)="onTouch($event)"
             (touchend)="onTouchEnd($event)" (touchcancel)="onTouchEnd($event)">
          @if (error()) { <div class="msg err">{{ error() }}</div> }
          @else if (loading()) { <div class="msg" role="status">{{ strings.loading }}</div> }
          <canvas #canvas [class.hidden]="loading() || error()" [style.transform]="pinch() === 1 ? null : 'scale(' + pinch() + ')'"
                  role="img" [attr.aria-label]="pages() ? format(strings.page, { n: page() }) : null"></canvas>
        </div>
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
    .bar button.fit { width: auto; padding: 0 var(--ui-space-2); font-size: var(--ui-font-size-sm); }
    .pg, .pct { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted);
      font-variant-numeric: tabular-nums; min-width: 42px; text-align: center; }
    /*
      The page scrolls inside .scroller, laid out absolutely, so the page never sizes the viewer: in a
      parent with no definite height the stage's spacer (60% of the screen) does, and the viewer is a
      readable window rather than as tall as the page at 120%; a parent that gives a height wins.
    */
    .stage { position: relative; flex: 1 1 auto; min-height: 0; background: var(--ui-color-bg); }
    .stage::before { content: ''; display: block; height: var(--ui-pdf-viewer-min-height, 60svh); }
    /* safe center: a page zoomed wider than the stage must still scroll to its left edge.
       pan-x pan-y: one finger scrolls the page natively; two are ours, for the pinch. */
    .scroller { position: absolute; inset: 0; box-sizing: border-box; overflow: auto; display: flex; align-items: flex-start;
      justify-content: safe center; padding: var(--ui-space-3); touch-action: pan-x pan-y; }
    canvas { flex: none; box-shadow: var(--ui-shadow-2); background: var(--ui-pdf-page-bg); transform-origin: center top; }
    /*
      fill: the viewer is the page. No frame, no spacer; the page is fitted and centred, and the
      controls float over the bottom on the glass panel surface, clear of the home indicator. The
      scroller's bottom padding keeps the page's own bottom edge clear of them.
    */
    .pv.fill { border-radius: 0; background: none; position: relative; min-height: 200px; }
    .pv.fill .stage::before { display: none; }
    .pv.fill .scroller { align-items: safe center;
      padding-bottom: calc(var(--ui-size-touch) + 2 * var(--ui-space-3) + env(safe-area-inset-bottom, 0px)); }
    .pv.fill canvas { transform-origin: center center; }
    .bar.overlay { position: absolute; z-index: 1; left: 50%; transform: translateX(-50%);
      bottom: calc(var(--ui-space-3) + env(safe-area-inset-bottom, 0px));
      max-width: calc(100% - 2 * var(--ui-space-3)); box-sizing: border-box;
      border-bottom: none; border-radius: var(--ui-radius-pill); background: var(--ui-glass-panel-bg);
      -webkit-backdrop-filter: blur(var(--ui-glass-blur)); backdrop-filter: blur(var(--ui-glass-blur));
      box-shadow: var(--ui-shadow-2); }
    .bar.overlay .spacer { flex: none; width: var(--ui-space-2); }
    canvas.hidden { display: none; }
    .msg { padding: var(--ui-space-4); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .msg.err { color: var(--ui-color-danger); }
  `,
})
export class UiPdfViewer {
  protected readonly strings = injectUiStrings();
  protected readonly format = uiFormatString;
  src = input.required<string>();
  workerSrc = input<string>();

  /**
   * Take all the space the parent gives (a full page, or an expanded flex child): each page is
   * fitted (contain, centred) into it and 100% means fitted, and the controls float over the bottom
   * instead of sitting in a bar above. The parent must have a height.
   */
  fill = input(false, { transform: booleanAttribute });

  protected readonly minScale = 0.4;
  protected readonly maxScale = 4;
  protected readonly page = signal(1);
  protected readonly pages = signal(0);
  /**
   * What the bar shows and the buttons change. Without `fill` it is pdf.js's own scale (1 = the
   * page's size in CSS points), starting at 120% as before; with `fill` it is relative to the page
   * fitted into the viewer, starting at 100%.
   */
  protected readonly zoom = signal(1.2);
  /** A pinch in progress, as a factor on {@link zoom}; drawn as a CSS scale until the fingers lift. */
  protected readonly pinch = signal(1);
  /** The scroller's size, so a filled viewer refits when its parent resizes. */
  private readonly box = signal({ width: 0, height: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private task: any = null;
  private pinchFrom = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private doc: any = null;
  /** Bumped by every load and by destroy: a load that finds it changed is stale and stops. */
  private generation = 0;
  private destroyed = false;
  private readonly loadPdfjs = inject(UI_PDFJS);

  constructor() {
    // pdf.js loads lazily: the viewer can be destroyed (or src change) while it does. A load that
    // finishes after that must not touch the view, and its document is released.
    let resize: ResizeObserver | undefined;
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const el = this.scroller().nativeElement;
      resize = new ResizeObserver(() => this.box.set({ width: el.clientWidth, height: el.clientHeight }));
      resize.observe(el);
    });
    // A filled viewer starts fitted; a plain one at 120%, as it always has.
    effect(() => this.zoom.set(this.fill() ? 1 : 1.2));
    inject(DestroyRef).onDestroy(() => {
      resize?.disconnect();
      this.destroyed = true;
      this.generation++;
      this.doc?.destroy?.();
      this.doc = null;
    });
    // (Re)load whenever src changes.
    effect(() => {
      const url = this.src();
      this.load(url);
    });
    // Re-render whenever page or zoom changes, or a filled viewer is resized (and a doc is loaded).
    effect(() => {
      const p = this.page();
      const z = this.zoom();
      if (this.fill()) this.box();
      if (this.doc) this.render(p, z);
    });
  }

  private async load(url: string): Promise<void> {
    const gen = ++this.generation;
    const current = () => gen === this.generation && !this.destroyed;
    this.loading.set(true);
    this.error.set(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjs = (await this.loadPdfjs()) as any;
      if (!current()) return;
      pdfjs.GlobalWorkerOptions.workerSrc =
        this.workerSrc() ?? `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const doc = await pdfjs.getDocument(url).promise;
      if (!current()) {
        doc.destroy?.();
        return;
      }
      this.doc?.destroy?.();
      this.doc = doc;
      this.pages.set(doc.numPages);
      this.page.set(1);
      await this.render(1, this.zoom());
    } catch (e) {
      if (current()) this.error.set(`Could not load PDF: ${e}`);
    } finally {
      if (current()) this.loading.set(false);
    }
  }

  private async render(pageNum: number, zoom: number): Promise<void> {
    if (!this.doc || this.destroyed) return;
    try {
      const page = await this.doc.getPage(pageNum);
      if (this.destroyed) return;
      const scale = this.fill() ? pdfFitScale(page.getViewport({ scale: 1 }), this.contentBox()) * zoom : zoom;
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
      // One render per canvas at a time: a newer one (a wheel, a resize) replaces any still drawing.
      this.task?.cancel?.();
      const task = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      this.task = task;
      await task.promise;
      if (this.task === task) this.task = null;
    } catch (e) {
      if ((e as { name?: string })?.name === 'RenderingCancelledException') return;
      if (!this.destroyed) this.error.set(`Render failed: ${e}`);
    }
  }

  /** The scroller's content box: where a fitted page has to fit. */
  private contentBox(): { width: number; height: number } {
    const el = this.scroller().nativeElement;
    const css = globalThis.getComputedStyle?.(el);
    const px = (v: string | undefined) => parseFloat(v ?? '') || 0;
    return {
      width: el.clientWidth - px(css?.paddingLeft) - px(css?.paddingRight),
      height: el.clientHeight - px(css?.paddingTop) - px(css?.paddingBottom),
    };
  }

  protected fit(): void { this.zoom.set(1); }

  /** Ctrl/Cmd + wheel (and a trackpad pinch, which arrives as one) zooms; a plain wheel scrolls. */
  protected onWheel(e: WheelEvent): void {
    if (!(e.ctrlKey || e.metaKey) || !this.doc) return;
    e.preventDefault();
    this.setZoom(this.zoom() * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }

  /** Two fingers pinch the page; one is left to the browser, which scrolls it. */
  protected onTouch(e: TouchEvent): void {
    if (e.touches.length !== 2 || !this.doc) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const spread = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    e.preventDefault();
    if (!this.pinchFrom || e.type === 'touchstart') {
      this.pinchFrom = spread;
      return;
    }
    const z = this.zoom();
    this.pinch.set(clampZoom(z * (spread / this.pinchFrom), this.minScale, this.maxScale) / z);
  }

  protected onTouchEnd(e: TouchEvent): void {
    if (e.touches.length >= 2 || !this.pinchFrom) return;
    this.pinchFrom = 0;
    const p = this.pinch();
    this.pinch.set(1);
    if (p !== 1) this.setZoom(this.zoom() * p);
  }

  private setZoom(z: number): void { this.zoom.set(clampZoom(z, this.minScale, this.maxScale)); }

  protected prev(): void { this.page.update((p) => Math.max(1, p - 1)); }
  protected next(): void { this.page.update((p) => Math.min(this.pages(), p + 1)); }
  protected zoomBy(d: number): void { this.setZoom(this.zoom() + d); }
}

function clampZoom(z: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, +z.toFixed(2)));
}

/**
 * The pdf.js scale that fits a page (its size at scale 1) whole into `box`, as `fill` shows it.
 * An unmeasured box (not laid out yet) gives 1.
 */
export function pdfFitScale(page: { width: number; height: number }, box: { width: number; height: number }): number {
  if (!page.width || !page.height || box.width <= 0 || box.height <= 0) return 1;
  return Math.min(box.width / page.width, box.height / page.height);
}
