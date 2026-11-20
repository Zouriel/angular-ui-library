import { Component, ElementRef, HostListener, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';

export interface UiRepositionPosition { x: number; y: number }

interface Layout { left: number; top: number; width: number; height: number; imageWidth: number; imageHeight: number; imageLeft: number; imageTop: number; actionsTop: number; actionsLeft: number; grown: boolean }

const clamp = (n: number) => Math.max(0, Math.min(100, n));
/** Smallest editing frame (px) while repositioning, so a tiny avatar can still be dragged on a phone. */
const MIN_FRAME = 120;
/** Gutter (px) kept between the Save/Cancel bar and the viewport edge. */
const GUTTER = 16;

/** `ui-reposition` — an in-place cover-photo focal-point editor for rectangular or round frames. */
@Component({
  selector: 'ui-reposition',
  imports: [UiButton],
  host: {
    '[class.active]': 'active()',
    '[class.circle]': 'circle()',
  },
  template: `
    <img class="frame-image" [src]="src()" [alt]="alt()" draggable="false" [style.object-position]="position().x + '% ' + position().y + '%'" (load)="imageLoaded($event)" (error)="loadError.emit()" />
    @if (active() && layout(); as l) {
      <div #layer class="layer" popover="manual">
      <div class="scrim" aria-hidden="true" [style.clip-path]="scrimClip(l)"></div>
      @if (circle()) {
        <div class="circle-scrim" aria-hidden="true" [class.grown]="l.grown" [style.left.px]="l.left" [style.top.px]="l.top" [style.width.px]="l.width" [style.height.px]="l.height"></div>
      }
      <div class="photo ghost" aria-hidden="true" [class.circle]="circle()" [class.grown]="l.grown" [style.left.px]="l.imageLeft" [style.top.px]="l.imageTop" [style.width.px]="l.imageWidth" [style.height.px]="l.imageHeight">
        <img [src]="src()" draggable="false" />
      </div>
      <div #dragSurface class="bright" [class.circle]="circle()" [class.grown]="l.grown" [style.left.px]="l.left" [style.top.px]="l.top" [style.width.px]="l.width" [style.height.px]="l.height"
           role="application" tabindex="0" aria-label="Reposition photo" [attr.aria-valuetext]="announcement()"
           (pointerdown)="pointerDown($event)" (pointermove)="pointerMove($event)" (pointerup)="pointerUp($event)" (pointercancel)="pointerUp($event)">
        <img [src]="src()" draggable="false" [style.left.px]="l.imageLeft - l.left" [style.top.px]="l.imageTop - l.top" [style.width.px]="l.imageWidth" [style.height.px]="l.imageHeight" />
      </div>
      <div #actionsBar class="actions" [style.left.px]="l.actionsLeft" [style.top.px]="l.actionsTop">
        <ui-button variant="secondary" size="sm" (click)="cancelEdit()">Cancel</ui-button>
        <ui-button size="sm" (click)="saveEdit()">Save</ui-button>
      </div>
      <span class="sr" aria-live="polite">{{ announcement() }}</span>
      </div>
    }
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; }
    :host(.active) { overflow: visible; }
    :host(.circle), :host(.circle) .frame-image { border-radius: 50%; }
    .frame-image { display: block; width: 100%; height: 100%; object-fit: cover; user-select: none; -webkit-user-drag: none; }
    /* The editor lives in the browser's top layer (popover), so no page element can paint over it. */
    .layer { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: none; color: inherit; overflow: visible; }
    .scrim { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: var(--ui-color-overlay);
    }
    .circle-scrim { position: fixed; z-index: var(--ui-z-overlay); pointer-events: none; background: var(--ui-color-overlay);
      -webkit-mask: radial-gradient(circle, transparent 69%, var(--ui-color-text) 71%); mask: radial-gradient(circle, transparent 69%, var(--ui-color-text) 71%); }
    .photo, .bright { position: fixed; z-index: calc(var(--ui-z-overlay) + 1); touch-action: none; user-select: none; }
    .photo { pointer-events: none; opacity: .28; }
    .photo img, .bright img { display: block; width: 100%; height: 100%; }
    .bright { overflow: hidden; cursor: move; outline: none; }
    .bright.circle { border-radius: 50%; }
    .bright img { position: absolute; max-width: none; pointer-events: none; }
    .bright:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .actions { position: fixed; z-index: calc(var(--ui-z-overlay) + 2); display: flex; gap: var(--ui-space-2); padding: var(--ui-space-2); border-radius: var(--ui-radius); background: var(--ui-color-surface-raised); box-shadow: var(--ui-shadow-2); }
    .sr { position: fixed; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (prefers-reduced-motion: no-preference) {
      .grown { animation: ui-reposition-grow var(--ui-motion-base) ease-out; }
    }
    @keyframes ui-reposition-grow { from { opacity: 0; transform: scale(.7); } }
  `,
})
export class UiReposition {
  readonly src = input.required<string>();
  readonly position = input<UiRepositionPosition>({ x: 50, y: 50 });
  readonly active = input(false);
  readonly circle = input(false);
  readonly alt = input('');
  readonly save = output<UiRepositionPosition>();
  readonly cancel = output<void>();
  readonly loadError = output<void>();

  private readonly host: ElementRef<HTMLElement>;
  private readonly dragSurface = viewChild<ElementRef<HTMLElement>>('dragSurface');
  private readonly layer = viewChild<ElementRef<HTMLElement>>('layer');
  private readonly actionsBar = viewChild<ElementRef<HTMLElement>>('actionsBar');
  private readonly actionsWidth = signal(0);
  private readonly natural = signal({ width: 0, height: 0 });
  protected readonly draft = signal<UiRepositionPosition>({ x: 50, y: 50 });
  private wasActive = false;
  private drag: { id: number; x: number; y: number; start: UiRepositionPosition } | null = null;

  protected readonly layout = computed<Layout | null>(() => {
    if (!this.active()) return null;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const image = this.natural();
    if (!rect.width || !rect.height || !image.width || !image.height) return null;
    // A frame smaller than MIN_FRAME is shown enlarged around its centre, as an overlay (the host never resizes).
    const grow = Math.max(1, MIN_FRAME / Math.min(rect.width, rect.height));
    const w = rect.width * grow, h = rect.height * grow;
    const vw = innerWidth, vh = innerHeight;
    const left = grow > 1 ? Math.max(8, Math.min(vw - 8 - w, rect.left + (rect.width - w) / 2)) : rect.left;
    const top = grow > 1 ? Math.max(8, Math.min(vh - 8 - h, rect.top + (rect.height - h) / 2)) : rect.top;
    const frame = { left, top, width: w, height: h, bottom: top + h };
    const scale = Math.max(frame.width / image.width, frame.height / image.height);
    const imageWidth = image.width * scale, imageHeight = image.height * scale;
    const p = this.draft();
    const imageLeft = frame.left + (frame.width - imageWidth) * p.x / 100;
    const imageTop = frame.top + (frame.height - imageHeight) * p.y / 100;
    const below = frame.bottom + 8;
    const actionsTop = below + 48 <= innerHeight ? below : Math.max(8, frame.top - 56);
    const barWidth = this.actionsWidth() || 168;
    const actionsLeft = Math.max(GUTTER, Math.min(vw - GUTTER - barWidth, frame.left + frame.width / 2 - barWidth / 2));
    return { left: frame.left, top: frame.top, width: frame.width, height: frame.height, imageWidth, imageHeight, imageLeft, imageTop, actionsTop, actionsLeft, grown: grow > 1 };
  });
  protected readonly announcement = computed(() => `Photo position ${Math.round(this.draft().x)} percent horizontal, ${Math.round(this.draft().y)} percent vertical`);

  constructor(host: ElementRef<HTMLElement>) {
    this.host = host;
    effect(() => {
      const layer = this.layer()?.nativeElement;
      if (layer && !layer.matches?.(':popover-open')) layer.showPopover?.();
    });
    effect(() => {
      const el = this.actionsBar()?.nativeElement;
      if (el) untracked(() => this.actionsWidth.set(el.offsetWidth));
    });
    effect(() => {
      const active = this.active();
      const current = this.position();
      if (active && !this.wasActive) {
        untracked(() => this.draft.set({ x: clamp(current.x), y: clamp(current.y) }));
        queueMicrotask(() => this.dragSurface()?.nativeElement.focus());
      }
      this.wasActive = active;
    });
  }

  protected imageLoaded(event: Event) {
    const image = event.target as HTMLImageElement;
    this.natural.set({ width: image.naturalWidth, height: image.naturalHeight });
  }
  protected scrimClip(l: Layout) {
    return `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${l.left}px ${l.top}px,${l.left}px ${l.top + l.height}px,${l.left + l.width}px ${l.top + l.height}px,${l.left + l.width}px ${l.top}px,${l.left}px ${l.top}px)`;
  }
  protected pointerDown(event: PointerEvent) {
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: this.draft() };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }
  protected pointerMove(event: PointerEvent) {
    if (!this.drag || event.pointerId !== this.drag.id) return;
    const l = this.layout(); if (!l) return;
    const x = l.imageWidth > l.width ? clamp(this.drag.start.x + (event.clientX - this.drag.x) / (l.width - l.imageWidth) * 100) : 50;
    const y = l.imageHeight > l.height ? clamp(this.drag.start.y + (event.clientY - this.drag.y) / (l.height - l.imageHeight) * 100) : 50;
    this.draft.set({ x, y });
    event.preventDefault();
  }
  protected pointerUp(event: PointerEvent) { if (this.drag?.id === event.pointerId) this.drag = null; }
  @HostListener('window:keydown', ['$event'])
  protected keydown(event: KeyboardEvent) {
    if (!this.active()) return;
    if (event.key === 'Enter') { event.preventDefault(); this.saveEdit(); return; }
    if (event.key === 'Escape') { event.preventDefault(); this.cancelEdit(); return; }
    const l = this.layout(); if (!l || !event.key.startsWith('Arrow')) return;
    const d = event.shiftKey ? 10 : 1, p = this.draft();
    let x = p.x, y = p.y;
    if (l.imageWidth > l.width) { if (event.key === 'ArrowLeft') x -= d; if (event.key === 'ArrowRight') x += d; }
    if (l.imageHeight > l.height) { if (event.key === 'ArrowUp') y -= d; if (event.key === 'ArrowDown') y += d; }
    this.draft.set({ x: clamp(x), y: clamp(y) }); event.preventDefault();
  }
  protected saveEdit() { this.save.emit(this.draft()); }
  protected cancelEdit() { this.draft.set(this.position()); this.cancel.emit(); }
}
