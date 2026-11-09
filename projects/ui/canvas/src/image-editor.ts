import {
  Component, DestroyRef, ElementRef, InjectionToken, Injector, afterNextRender, computed, effect, inject, input, model, output, signal, untracked,
  viewChild,
} from '@angular/core';
import {
  UI_IMAGE_MAX_SIDE, UiCropHandle, UiDirtyRect, UiImageCrop, UiImageEdit, UiImageEditorMode, UiImageRaster, dragCrop, fitAspect, fullCrop,
  sameCrop,
} from './image-edit';

/**
 * How `ui-image-editor` gets pixels in and out. The default uses an `<img>` and a `<canvas>`; tests (and
 * hosts with their own decoder) provide another.
 */
export interface UiImageEditorBackend {
  /** Decodes `src`, scaled down so neither side is longer than `maxSide`. */
  load(src: string, maxSide: number): Promise<UiImageRaster>;
  /** Encodes pixels (straight RGBA) as an image file. */
  encode(raster: UiImageRaster, type: string, quality?: number): Promise<Blob>;
}

export const uiBrowserImageBackend: UiImageEditorBackend = {
  async load(src, maxSide) {
    const img = new Image();
    // A URL needs CORS to be read back; data: and blob: URLs are already ours.
    if (!/^(data|blob):/i.test(src)) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = src;
    await img.decode();
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * k));
    const height = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No 2D canvas');
    ctx.drawImage(img, 0, 0, width, height);
    return { width, height, data: ctx.getImageData(0, 0, width, height).data };
  },
  encode(raster, type, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = raster.width;
    canvas.height = raster.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('No 2D canvas'));
    ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), type, quality));
  },
};

export const UI_IMAGE_EDITOR_BACKEND = new InjectionToken<UiImageEditorBackend>('UI_IMAGE_EDITOR_BACKEND', {
  factory: () => uiBrowserImageBackend,
});

type Gesture =
  | { kind: 'paint' }
  | { kind: 'crop'; handle: UiCropHandle; start: UiImageCrop }
  | { kind: 'pan' };

interface Drag { gesture: Gesture; pointerId: number; startClient: { x: number; y: number }; startUnits: { x: number; y: number }; startCenter: { x: number; y: number }; moved: boolean }

const PAD = 24;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 64;
const HANDLES: { id: Exclude<UiCropHandle, 'move'>; fx: number; fy: number }[] = [
  { id: 'nw', fx: 0, fy: 0 }, { id: 'n', fx: 0.5, fy: 0 }, { id: 'ne', fx: 1, fy: 0 }, { id: 'e', fx: 1, fy: 0.5 },
  { id: 'se', fx: 1, fy: 1 }, { id: 's', fx: 0.5, fy: 1 }, { id: 'sw', fx: 0, fy: 1 }, { id: 'w', fx: 0, fy: 0.5 },
];

/**
 * `ui-image-editor` — crop a picture and erase parts of it with a soft or hard round brush.
 *
 * - **crop**: a frame with eight handles; drag inside it to move it. Outside is dimmed, rule-of-thirds
 *   lines show while dragging, `aspect` (width / height) keeps its shape, and it stays inside the image.
 * - **erase**: drag to paint transparency; **restore** paints the original back. `brushSize` is the
 *   brush's diameter in image pixels, `brushSoftness` runs from a hard edge (0) to very soft (1).
 *
 * Shift-click draws a straight line: the editor remembers where the last stroke ended (a click paints a
 * dot there), and a press with Shift held paints straight from that point to the new one with the current
 * brush, as one undo step; the new point is then remembered, so Shift-clicks chain. While Shift is held a
 * faint line shows where it will go. Dragging after a Shift-press carries on freehand from the new point
 * (the same stroke). `straightLine` does the same without Shift, for touch screens. Undo, redo, reset, a
 * new picture or another mode forget the point, so the next press starts afresh.
 *
 * Erased parts show over a checkerboard. Pinch or Ctrl/⌘ + wheel zooms about the pointer; two fingers,
 * Space + drag or the middle button pan. Once a pen has been used, fingers only navigate (as in
 * `ui-path-editor`, `fingerDraws` 'auto'). Every stroke and crop change is one undo step
 * (Ctrl/⌘+Z, Shift+Ctrl/⌘+Z or Ctrl+Y); `[` and `]` change the brush size.
 *
 * The working copy is at most 4096 px on its long side. `toBlob()` gives the crop with erased pixels
 * transparent, at that resolution.
 */
@Component({
  selector: 'ui-image-editor',
  host: {
    class: 'ui-image-editor',
    tabindex: '0',
    role: 'application',
    '[attr.aria-label]': 'label()',
    '[attr.aria-busy]': '!loaded()',
    '[attr.data-mode]': 'mode()',
    '[class.panning]': 'panReady()',
    '(keydown)': 'onKey($event)',
    '(keyup)': 'onKeyUp($event)',
    '(blur)': 'space.set(false); shift.set(false)',
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'cancel($event)',
    '(pointerleave)': 'hover.set(null)',
    '(wheel)': 'wheel($event)',
  },
  template: `
    <canvas #img class="img" [class.pixelated]="scale() > 3" [attr.width]="naturalWidth() || null" [attr.height]="naturalHeight() || null"
      [style.width.px]="naturalWidth()" [style.height.px]="naturalHeight()" [style.transform]="transform()"
      [style.background-size]="checker()" [hidden]="!loaded()"></canvas>
    @if (loaded() && frame(); as f) {
      <svg class="overlay" aria-hidden="true">
        <path class="dim" [class.strong]="mode() !== 'crop'" fill-rule="evenodd"
          [attr.d]="'M-1 -1H' + (size().w + 1) + 'V' + (size().h + 1) + 'H-1Z M' + f.x + ' ' + f.y + 'h' + f.w + 'v' + f.h + 'h' + -f.w + 'Z'" />
        <rect class="frame" [class.quiet]="mode() !== 'crop'" [attr.x]="f.x" [attr.y]="f.y" [attr.width]="f.w" [attr.height]="f.h" />
        @if (mode() === 'crop') {
          <rect class="inside" [attr.x]="f.x" [attr.y]="f.y" [attr.width]="f.w" [attr.height]="f.h" />
          @if (cropping()) {
            @for (k of thirds; track k) {
              <line class="third" [attr.x1]="f.x + f.w * k" [attr.y1]="f.y" [attr.x2]="f.x + f.w * k" [attr.y2]="f.y + f.h" />
              <line class="third" [attr.x1]="f.x" [attr.y1]="f.y + f.h * k" [attr.x2]="f.x + f.w" [attr.y2]="f.y + f.h * k" />
            }
          }
          @for (h of handles(); track h.id) {
            <path class="mark" [attr.d]="h.d" />
            <rect class="hit" [attr.data-handle]="h.id" [attr.x]="h.x - hit / 2" [attr.y]="h.y - hit / 2" [attr.width]="hit" [attr.height]="hit" />
          }
        }
        @if (linePreview(); as l) {
          <line class="line-preview-out" [attr.x1]="l.x1" [attr.y1]="l.y1" [attr.x2]="l.x2" [attr.y2]="l.y2" />
          <line class="line-preview" [attr.x1]="l.x1" [attr.y1]="l.y1" [attr.x2]="l.x2" [attr.y2]="l.y2" />
        }
        @if (cursor(); as c) {
          <circle class="brush-out" [attr.cx]="c.x" [attr.cy]="c.y" [attr.r]="c.r" />
          <circle class="brush" [attr.cx]="c.x" [attr.cy]="c.y" [attr.r]="c.r" />
          @if (c.inner > 2 && c.inner < c.r - 2) {
            <circle class="brush inner" [attr.cx]="c.x" [attr.cy]="c.y" [attr.r]="c.inner" />
          }
          @if (c.r < 4) { <circle class="brush dot" [attr.cx]="c.x" [attr.cy]="c.y" r="1.5" /> }
        }
      </svg>
    }
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; touch-action: none; outline: none; user-select: none;
      -webkit-user-select: none; -webkit-touch-callout: none; background: var(--ui-color-surface-subtle); color: var(--ui-color-text); }
    :host(:focus-visible) { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    :host([data-mode="erase"]), :host([data-mode="restore"]) { cursor: crosshair; }
    :host(.panning) { cursor: grab; }
    .img { position: absolute; left: 0; top: 0; transform-origin: 0 0; display: block;
      /* The checkerboard shows through whatever is erased. */
      background-color: var(--ui-color-surface);
      background-image: conic-gradient(color-mix(in srgb, var(--ui-color-text) 14%, var(--ui-color-surface)) 25%, transparent 0 50%,
        color-mix(in srgb, var(--ui-color-text) 14%, var(--ui-color-surface)) 0 75%, transparent 0);
      box-shadow: 0 0 0 1px var(--ui-color-border); }
    .img.pixelated { image-rendering: pixelated; }
    .overlay { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
    /* Chrome drawn over the picture uses the media colours: light on a dark outline, whatever the theme. */
    .dim { fill: var(--ui-color-overlay); opacity: .8; }
    .dim.strong { opacity: .9; }
    .frame { fill: none; stroke: var(--ui-media-on-scrim); stroke-width: 1.5; filter: drop-shadow(0 0 1px var(--ui-media-scrim)); }
    .frame.quiet { stroke-dasharray: 4 4; opacity: .7; }
    .third { stroke: var(--ui-media-on-scrim); stroke-width: 1; opacity: .7; }
    .mark { fill: none; stroke: var(--ui-media-on-scrim); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round;
      filter: drop-shadow(0 0 1.5px var(--ui-media-scrim)); }
    .hit { fill: transparent; pointer-events: all; }
    .inside { fill: transparent; pointer-events: all; cursor: move; }
    .hit[data-handle="nw"], .hit[data-handle="se"] { cursor: nwse-resize; }
    .hit[data-handle="ne"], .hit[data-handle="sw"] { cursor: nesw-resize; }
    .hit[data-handle="n"], .hit[data-handle="s"] { cursor: ns-resize; }
    .hit[data-handle="e"], .hit[data-handle="w"] { cursor: ew-resize; }
    .brush, .brush-out { fill: none; }
    .brush-out { stroke: var(--ui-media-scrim); stroke-width: 3; opacity: .5; }
    .brush { stroke: var(--ui-media-on-scrim); stroke-width: 1.25; }
    .brush.inner { stroke-dasharray: 3 3; opacity: .8; }
    .brush.dot { fill: var(--ui-media-on-scrim); }
    .line-preview-out { stroke: var(--ui-media-scrim); stroke-width: 3; opacity: .35; stroke-linecap: round; }
    .line-preview { stroke: var(--ui-media-on-scrim); stroke-width: 1.25; stroke-dasharray: 5 4; opacity: .75; stroke-linecap: round; }
  `,
})
export class UiImageEditor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly backend = inject(UI_IMAGE_EDITOR_BACKEND);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('img');
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** The picture: a URL (loaded with CORS) or a data: / blob: URL. */
  readonly src = input.required<string>();
  readonly mode = model<UiImageEditorMode>('erase');
  /** The brush's diameter, in image pixels. */
  readonly brushSize = model(40);
  /** 0 is a hard edge, 1 fades out from the centre. */
  readonly brushSoftness = model(0.3);
  /** Width / height the crop keeps; null crops freely. */
  readonly aspect = input<number | null>(null);
  /** The crop, in image pixels. Null until the picture has loaded; then the whole picture unless set. */
  readonly crop = model<UiImageCrop | null>(null);
  readonly label = input('Picture editor');
  /** Whether a finger paints. 'auto': until a pen is used, then fingers only pan and zoom. */
  readonly fingerDraws = input<boolean | 'auto'>('auto');
  /**
   * Every press after the first connects to the last point with a straight line, as Shift does: for
   * touch screens, where there's no Shift key (a host shows it as a "straight line" button).
   */
  readonly straightLine = input(false);

  /** After each committed stroke or crop change (and undo, redo and reset). */
  readonly changed = output<void>();
  /** The picture couldn't be loaded (or read, for a URL served without CORS). */
  readonly loadError = output<unknown>();

  private readonly _naturalWidth = signal(0);
  private readonly _naturalHeight = signal(0);
  private readonly _loaded = signal(false);
  private readonly _canUndo = signal(false);
  private readonly _canRedo = signal(false);
  private readonly _dirty = signal(false);
  /** The working copy's size (the picture's, unless it was scaled down to 4096 px). */
  readonly naturalWidth = this._naturalWidth.asReadonly();
  readonly naturalHeight = this._naturalHeight.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly canUndo = this._canUndo.asReadonly();
  readonly canRedo = this._canRedo.asReadonly();
  /** Anything erased, or cropped, compared with the original. */
  readonly dirty = this._dirty.asReadonly();

  private edit: UiImageEdit | null = null;
  private loadSeq = 0;

  protected readonly size = signal({ w: 0, h: 0 });
  private readonly zoom = signal(1);
  private readonly center = signal({ x: 0, y: 0 });
  protected readonly hover = signal<{ x: number; y: number } | null>(null);
  protected readonly space = signal(false);
  protected readonly shift = signal(false);
  /** Where the last stroke ended (image pixels): a Shift-press draws a straight line from here. */
  private readonly lineStart = signal<{ x: number; y: number } | null>(null);
  protected readonly cropping = signal(false);
  protected readonly coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  protected readonly hit = this.coarse ? 44 : 22;
  protected readonly thirds = [1 / 3, 2 / 3];

  private drag: Drag | null = null;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; zoom: number; world: { x: number; y: number } } | null = null;
  private penSeen = false;
  private dirtyRect: UiDirtyRect | null = null;
  private frameId = 0;

  /** Screen pixels per image pixel. */
  protected readonly scale = computed(() => this.fitScale(this._naturalWidth(), this._naturalHeight()) * this.zoom());

  protected readonly transform = computed(() => {
    const p = this.scale();
    const c = this.center();
    const { w, h } = this.size();
    return `translate(${w / 2 - c.x * p}px, ${h / 2 - c.y * p}px) scale(${p})`;
  });

  /** About 10 screen pixels a square, whatever the zoom. */
  protected readonly checker = computed(() => `${20 / this.scale()}px ${20 / this.scale()}px`);

  /** The crop, on screen. */
  protected readonly frame = computed(() => {
    const c = this.crop();
    if (!c) return null;
    const a = this.toScreen(c.x, c.y);
    const p = this.scale();
    return { x: a.x, y: a.y, w: c.width * p, h: c.height * p };
  });

  protected readonly handles = computed(() => {
    const f = this.frame();
    if (!f) return [];
    const L = Math.max(6, Math.min(18, f.w / 3, f.h / 3));
    return HANDLES.map(({ id, fx, fy }) => {
      const x = f.x + f.w * fx;
      const y = f.y + f.h * fy;
      let d: string;
      if (fx !== 0.5 && fy !== 0.5) {
        const ix = fx === 0 ? 1 : -1;
        const iy = fy === 0 ? 1 : -1;
        d = `M${x} ${y + iy * L}V${y}H${x + ix * L}`;
      } else if (fx === 0.5) d = `M${x - L / 2} ${y}H${x + L / 2}`;
      else d = `M${x} ${y - L / 2}V${y + L / 2}`;
      return { id, x, y, d };
    });
  });

  protected readonly cursor = computed(() => {
    const h = this.hover();
    if (!h || this.mode() === 'crop' || this.space()) return null;
    const r = (this.brushSize() / 2) * this.scale();
    return { x: h.x, y: h.y, r, inner: r * (1 - Math.min(1, Math.max(0, this.brushSoftness()))) };
  });

  protected readonly panReady = computed(() => this.space());

  /** While Shift is held (or `straightLine` is on), where the next press would draw, on screen. */
  protected readonly linePreview = computed(() => {
    const from = this.lineStart();
    const h = this.hover();
    if (!from || !h || this.mode() === 'crop' || this.space() || this.painting() || !(this.shift() || this.straightLine())) return null;
    const a = this.toScreen(from.x, from.y);
    return { x1: a.x, y1: a.y, x2: h.x, y2: h.y };
  });
  /** A stroke is under way (the preview hides while it is). */
  private readonly painting = signal(false);

  constructor() {
    effect(() => {
      const src = this.src();
      untracked(() => void this.load(src));
    });
    // A new aspect reshapes the crop (one undo step), keeping it centred where it was.
    effect(() => {
      const aspect = this.aspect();
      untracked(() => {
        const e = this.edit;
        if (!e || !aspect) return;
        const next = fitAspect(e.crop, aspect, e.width, e.height);
        if (Math.abs(e.crop.width / e.crop.height - aspect) * e.crop.height < 1) return;
        if (e.commitCrop(next)) this.afterChange();
      });
    });
    // The host setting the crop: taken as it is (kept inside the image), not as an undo step.
    effect(() => {
      const c = this.crop();
      untracked(() => {
        const e = this.edit;
        if (!e || !c || this.drag?.gesture.kind === 'crop' || sameCrop(c, e.crop)) return;
        e.setCrop(c);
        this.sync();
      });
    });
    // Crop mode shows the whole picture; erasing frames the crop.
    let wasCrop: boolean | null = null;
    effect(() => {
      const crop = this.mode() === 'crop';
      untracked(() => {
        this.abort();
        this.lineStart.set(null);
        if (wasCrop !== null && wasCrop !== crop) this.fit();
        wasCrop = crop;
      });
    });
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const measure = () => this.size.set({ w: el.clientWidth, h: el.clientHeight });
      measure();
      this.fit();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameId);
    });
  }

  // ----- Public -----------------------------------------------------------------------------------------

  undo(): void {
    this.lineStart.set(null);
    if (this.edit?.undo()) this.afterChange();
  }

  redo(): void {
    this.lineStart.set(null);
    if (this.edit?.redo()) this.afterChange();
  }

  /** Back to the original picture, uncropped (or the largest frame of `aspect`), as one undo step. */
  reset(): void {
    const e = this.edit;
    if (!e) return;
    this.abort();
    this.lineStart.set(null);
    const aspect = this.aspect();
    const whole = fullCrop(e.width, e.height);
    if (e.reset(aspect ? fitAspect(whole, aspect, e.width, e.height) : whole)) this.afterChange();
  }

  /** The crop back to the whole picture (or the largest frame of `aspect`), as one undo step. */
  resetCrop(): void {
    const e = this.edit;
    if (!e) return;
    const aspect = this.aspect();
    const whole = fullCrop(e.width, e.height);
    if (e.commitCrop(aspect ? fitAspect(whole, aspect, e.width, e.height) : whole)) this.afterChange();
  }

  /** Zooms by a factor about the middle of the view. */
  zoomBy(factor: number): void {
    this.zoom.update((z) => clampZoom(z * factor));
  }

  /** Frames the whole picture in crop mode, and the crop otherwise. */
  fit(): void {
    const W = this._naturalWidth(), H = this._naturalHeight();
    if (!W || !H) return;
    const c = this.mode() === 'crop' ? fullCrop(W, H) : this.edit?.crop ?? fullCrop(W, H);
    const base = this.fitScale(W, H);
    this.zoom.set(clampZoom(base ? this.fitScale(c.width, c.height) / base : 1));
    this.center.set({ x: c.x + c.width / 2, y: c.y + c.height / 2 });
  }

  /** The crop, with erased pixels transparent, at the working resolution. */
  toBlob(type = 'image/png', quality?: number): Promise<Blob> {
    const e = this.edit;
    if (!e) return Promise.reject(new Error('The picture has not loaded yet'));
    return this.backend.encode(e.result(), type, quality);
  }

  // ----- Loading ----------------------------------------------------------------------------------------

  private async load(src: string): Promise<void> {
    const seq = ++this.loadSeq;
    this.abort();
    this.edit = null;
    this.lineStart.set(null);
    this._loaded.set(false);
    let raster: UiImageRaster;
    try {
      raster = await this.backend.load(src, UI_IMAGE_MAX_SIDE);
    } catch (err) {
      if (seq === this.loadSeq) this.loadError.emit(err);
      return;
    }
    if (seq !== this.loadSeq) return;
    const e = new UiImageEdit(raster);
    const given = this.crop();
    if (given && given.x >= 0 && given.y >= 0 && given.x + given.width <= e.width && given.y + given.height <= e.height) e.setCrop(given);
    const aspect = this.aspect();
    if (aspect && Math.abs(e.crop.width / e.crop.height - aspect) * e.crop.height >= 1) e.setCrop(fitAspect(e.crop, aspect, e.width, e.height));
    e.onDirty = (r) => this.queue(r);
    this.edit = e;
    this._naturalWidth.set(e.width);
    this._naturalHeight.set(e.height);
    this._loaded.set(true);
    this.sync();
    this.fit();
    // The canvas takes its new size on the next render; paint it then.
    afterNextRender(() => this.paintAll(), { injector: this.injector });
  }

  // ----- Drawing ----------------------------------------------------------------------------------------

  private context(): CanvasRenderingContext2D | null {
    const el = this.canvas().nativeElement;
    try {
      return el.getContext?.('2d') ?? null;
    } catch {
      return null;
    }
  }

  private paintAll(): void {
    const e = this.edit;
    const el = this.canvas().nativeElement;
    if (!e) return;
    if (el.width !== e.width) el.width = e.width;
    if (el.height !== e.height) el.height = e.height;
    this.dirtyRect = null;
    const ctx = this.context();
    if (!ctx || typeof ImageData === 'undefined') return;
    ctx.putImageData(new ImageData(e.composeRegion({ x: 0, y: 0, w: e.width, h: e.height }), e.width, e.height), 0, 0);
  }

  /** Changed pixels are redrawn once a frame, as one rectangle. */
  private queue(r: UiDirtyRect): void {
    const d = this.dirtyRect;
    if (d) {
      const x = Math.min(d.x, r.x), y = Math.min(d.y, r.y);
      this.dirtyRect = { x, y, w: Math.max(d.x + d.w, r.x + r.w) - x, h: Math.max(d.y + d.h, r.y + r.h) - y };
    } else {
      this.dirtyRect = r;
      if (typeof requestAnimationFrame === 'function') this.frameId = requestAnimationFrame(() => this.flush());
      else this.flush();
    }
  }

  private flush(): void {
    const r = this.dirtyRect;
    const e = this.edit;
    this.dirtyRect = null;
    if (!r || !e) return;
    const ctx = this.context();
    if (!ctx || typeof ImageData === 'undefined') return;
    ctx.putImageData(new ImageData(e.composeRegion(r), r.w, r.h), r.x, r.y);
  }

  // ----- View -------------------------------------------------------------------------------------------

  private fitScale(w: number, h: number): number {
    const s = this.size();
    if (!s.w || !s.h || !w || !h) return 1;
    return Math.max(1e-3, Math.min(Math.max(1, s.w - PAD * 2) / w, Math.max(1, s.h - PAD * 2) / h));
  }

  private toUnits(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.host.nativeElement.getBoundingClientRect();
    const p = this.scale();
    const c = this.center();
    return { x: c.x + (clientX - (r.left + r.width / 2)) / p, y: c.y + (clientY - (r.top + r.height / 2)) / p };
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    const p = this.scale();
    const c = this.center();
    const { w, h } = this.size();
    return { x: w / 2 + (x - c.x) * p, y: h / 2 + (y - c.y) * p };
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.host.nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ----- Pointer ----------------------------------------------------------------------------------------

  protected down(e: PointerEvent): void {
    const middle = e.pointerType === 'mouse' && e.button === 1;
    if (e.pointerType === 'mouse' && e.button !== 0 && !middle) return;
    if (e.pointerType === 'pen' && !this.penSeen) this.penSeen = true;
    // A pen is painting: anything else touching the screen is a hand resting on it.
    if (this.penPainting && e.pointerType === 'touch') return;
    const ed = this.edit;
    if (!ed) return;

    this.host.nativeElement.focus({ preventScroll: true });
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      // A second finger: whatever the first one was doing is undone, and it becomes a pinch.
      this.abort();
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom(), world: this.toUnits(mid.x, mid.y) };
      e.preventDefault();
      return;
    }
    if (this.pointers.size > 2) return;

    const u = this.toUnits(e.clientX, e.clientY);
    let gesture: Gesture;
    if (middle || this.space()) gesture = { kind: 'pan' };
    else if (this.mode() === 'crop') {
      const handle = (e.target as Element | null)?.closest?.('[data-handle]')?.getAttribute('data-handle') as UiCropHandle | null;
      const c = ed.crop;
      const inside = u.x >= c.x && u.x <= c.x + c.width && u.y >= c.y && u.y <= c.y + c.height;
      gesture = handle ? { kind: 'crop', handle, start: c } : inside ? { kind: 'crop', handle: 'move', start: c } : { kind: 'pan' };
    } else gesture = this.fingerNavigates(e) ? { kind: 'pan' } : { kind: 'paint' };

    this.drag = { gesture, pointerId: e.pointerId, startClient: { x: e.clientX, y: e.clientY }, startUnits: u, startCenter: this.center(), moved: false };
    this.penPainting = gesture.kind === 'paint' && e.pointerType === 'pen';
    if (gesture.kind === 'paint') {
      // Shift (or `straightLine`) with a remembered point: straight from there to here, then on as usual.
      const from = this.lineStart();
      const straight = !!from && (e.shiftKey || this.straightLine());
      const start = straight ? from : u;
      ed.beginStroke(this.mode() === 'restore' ? 'restore' : 'erase', start.x, start.y, Math.max(1, this.brushSize()), this.brushSoftness());
      if (straight) ed.lineTo(u.x, u.y);
      this.painting.set(true);
    }
    if (gesture.kind === 'crop') this.cropping.set(true);
    e.preventDefault();
  }

  private penPainting = false;

  private fingerNavigates(e: PointerEvent): boolean {
    if (e.pointerType !== 'touch') return false;
    const setting = this.fingerDraws();
    return setting === 'auto' ? this.penSeen : !setting;
  }

  protected move(e: PointerEvent): void {
    if (e.shiftKey !== this.shift()) this.shift.set(e.shiftKey);
    // A mouse or pen shows the brush while hovering; a finger shows it while it paints.
    if (e.pointerType !== 'touch' || this.drag?.gesture.kind === 'paint') this.hover.set(this.local(e));
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.zoom.set(clampZoom((this.pinch.zoom * dist) / this.pinch.dist));
      // Keep the spot that was between the fingers between them.
      const p = this.scale();
      const r = this.host.nativeElement.getBoundingClientRect();
      this.center.set({
        x: this.pinch.world.x - (mid.x - (r.left + r.width / 2)) / p,
        y: this.pinch.world.y - (mid.y - (r.top + r.height / 2)) / p,
      });
      return;
    }

    const d = this.drag;
    const ed = this.edit;
    if (!d || !ed || e.pointerId !== d.pointerId) return;
    const g = d.gesture;
    if (g.kind === 'paint') {
      const events = e.getCoalescedEvents?.() ?? [];
      for (const ev of events.length ? events : [e]) {
        const u = this.toUnits(ev.clientX, ev.clientY);
        ed.strokeTo(u.x, u.y);
      }
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y) < (e.pointerType === 'touch' ? 6 : 2)) return;
    d.moved = true;
    if (g.kind === 'pan') {
      const p = this.scale();
      this.center.set({ x: d.startCenter.x - (e.clientX - d.startClient.x) / p, y: d.startCenter.y - (e.clientY - d.startClient.y) / p });
      return;
    }
    const u = this.toUnits(e.clientX, e.clientY);
    const next = dragCrop(g.start, g.handle, u.x - d.startUnits.x, u.y - d.startUnits.y, ed.width, ed.height, this.aspect());
    ed.setCrop(next);
    this.crop.set(ed.crop);
  }

  protected up(e: PointerEvent): void {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const d = this.drag;
    const ed = this.edit;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    this.penPainting = false;
    if (e.pointerType === 'touch') this.hover.set(null);
    this.cropping.set(false);
    if (!ed) return;
    const g = d.gesture;
    if (g.kind === 'paint') {
      const u = this.toUnits(e.clientX, e.clientY);
      ed.strokeTo(u.x, u.y);
      this.painting.set(false);
      // Where it lifted is where the next Shift-click's line starts (even if this stroke changed nothing).
      this.lineStart.set({ x: u.x, y: u.y });
      if (ed.endStroke()) this.afterChange();
    } else if (g.kind === 'crop') {
      if (ed.commitCrop(ed.crop, g.start)) this.afterChange();
      else this.sync();
    }
  }

  protected cancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (this.drag?.pointerId === e.pointerId || !this.pointers.size) this.abort();
  }

  /** Drops a stroke or crop drag in progress, putting things back as they were. */
  private abort(): void {
    const d = this.drag;
    this.drag = null;
    this.penPainting = false;
    this.cropping.set(false);
    this.painting.set(false);
    const ed = this.edit;
    if (!d || !ed) return;
    if (d.gesture.kind === 'paint') ed.cancelStroke();
    if (d.gesture.kind === 'crop') {
      ed.setCrop(d.gesture.start);
      this.sync();
    }
  }

  protected wheel(e: WheelEvent): void {
    // A plain wheel belongs to the page; Ctrl/⌘ + wheel (and a trackpad pinch, which sets ctrlKey) zooms.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const world = this.toUnits(e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    this.zoom.update((z) => clampZoom(z * factor));
    const p = this.scale();
    const r = this.host.nativeElement.getBoundingClientRect();
    this.center.set({ x: world.x - (e.clientX - (r.left + r.width / 2)) / p, y: world.y - (e.clientY - (r.top + r.height / 2)) / p });
  }

  // ----- Keyboard ---------------------------------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }
    if (e.key === 'Shift') {
      this.shift.set(true);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (!this.space()) this.space.set(true);
      return;
    }
    if ((e.key === '[' || e.key === ']') && !mod) {
      e.preventDefault();
      this.brushSize.set(stepBrush(this.brushSize(), e.key === ']' ? 1 : -1));
    }
  }

  protected onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') this.space.set(false);
    if (e.key === 'Shift') this.shift.set(false);
  }

  // ----- State ------------------------------------------------------------------------------------------

  private afterChange(): void {
    this.sync();
    this.changed.emit();
  }

  private sync(): void {
    const e = this.edit;
    if (!e) return;
    this._canUndo.set(e.canUndo);
    this._canRedo.set(e.canRedo);
    this._dirty.set(e.dirty);
    if (!sameCrop(this.crop(), e.crop)) this.crop.set(e.crop);
  }
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/** One `[` or `]`: a pixel at a time below 10, then about a fifth at a time. */
export function stepBrush(size: number, dir: 1 | -1): number {
  if (dir > 0) return Math.min(1000, size < 10 ? Math.floor(size) + 1 : Math.round(size * 1.2));
  return Math.max(1, size <= 10 ? Math.ceil(size) - 1 : Math.round(size / 1.2));
}
