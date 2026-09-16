import { Component, ElementRef, NgZone, OnDestroy, computed, inject, input, output } from '@angular/core';

/** A box in stage units, rotated about its centre. */
export interface UiBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
}

export type UiTransformMode = 'move' | 'resize' | 'rotate';

/** Which edges a resize handle drags: -1 left/top, 1 right/bottom, 0 untouched. */
type Handle = { id: string; sx: -1 | 0 | 1; sy: -1 | 0 | 1; cursor: string };

const HANDLES: Handle[] = [
  { id: 'nw', sx: -1, sy: -1, cursor: 'nwse-resize' },
  { id: 'n', sx: 0, sy: -1, cursor: 'ns-resize' },
  { id: 'ne', sx: 1, sy: -1, cursor: 'nesw-resize' },
  { id: 'e', sx: 1, sy: 0, cursor: 'ew-resize' },
  { id: 'se', sx: 1, sy: 1, cursor: 'nwse-resize' },
  { id: 's', sx: 0, sy: 1, cursor: 'ns-resize' },
  { id: 'sw', sx: -1, sy: 1, cursor: 'nesw-resize' },
  { id: 'w', sx: -1, sy: 0, cursor: 'ew-resize' },
];

/**
 * `ui-transform-box` — selection handles for an element on a design stage: drag the body to move,
 * a handle to resize, the top knob to rotate. Place it inside a positioned stage; it lays itself out
 * from `box` (stage units) times `scale` (screen px per unit).
 *
 * The component never mutates `box`. It reports `transform` on every pointer move and
 * `transformEnd` once on release, so the host decides what a change means (live preview vs an undo
 * step). Resizing respects rotation: the opposite edge stays put on screen.
 *
 * Modifiers: Shift keeps proportions while resizing and snaps rotation to 15°; Alt resizes from the
 * centre. Arrow keys nudge by one unit, Shift+arrow by ten.
 */
@Component({
  selector: 'ui-transform-box',
  host: {
    class: 'ui-transform-box',
    role: 'group',
    '[attr.aria-label]': 'label() || "Selected element"',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    '[class.disabled]': 'disabled()',
    '[style.left.px]': 'box().x * scale()',
    '[style.top.px]': 'box().y * scale()',
    '[style.width.px]': 'box().w * scale()',
    '[style.height.px]': 'box().h * scale()',
    '[style.transform]': '"rotate(" + box().rotate + "deg)"',
    '(keydown)': 'onKey($event)',
    '(dblclick)': 'activate.emit()',
  },
  template: `
    <div class="body" (pointerdown)="start($event, 'move')"></div>
    @if (resizable() && !disabled()) {
      @for (h of handles(); track h.id) {
        <span class="handle" [attr.data-h]="h.id" [style.cursor]="h.cursor" (pointerdown)="start($event, 'resize', h)"></span>
      }
    }
    @if (rotatable() && !disabled()) {
      <span class="stem" aria-hidden="true"></span>
      <span class="rotate" title="Rotate" (pointerdown)="start($event, 'rotate')"></span>
    }
    @if (showSize()) {
      <span class="size" [style.transform]="'rotate(' + -box().rotate + 'deg)'">{{ sizeText() }}</span>
    }
  `,
  styles: `
    :host { position: absolute; box-sizing: border-box; transform-origin: 50% 50%; outline: 1.5px solid var(--ui-color-primary);
      outline-offset: 0; z-index: 2; touch-action: none; }
    :host(:focus-visible) { box-shadow: var(--ui-focus-ring); }
    :host(.disabled) { outline-style: dashed; }
    .body { position: absolute; inset: 0; cursor: move; }
    :host(.disabled) .body { cursor: default; }
    .handle { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; box-sizing: border-box;
      background: var(--ui-color-surface); border: 1.5px solid var(--ui-color-primary); border-radius: 2px; }
    .handle::after { content: ''; position: absolute; inset: -7px; }
    .handle[data-h="nw"] { left: 0; top: 0; } .handle[data-h="n"] { left: 50%; top: 0; }
    .handle[data-h="ne"] { left: 100%; top: 0; } .handle[data-h="e"] { left: 100%; top: 50%; }
    .handle[data-h="se"] { left: 100%; top: 100%; } .handle[data-h="s"] { left: 50%; top: 100%; }
    .handle[data-h="sw"] { left: 0; top: 100%; } .handle[data-h="w"] { left: 0; top: 50%; }
    .stem { position: absolute; left: 50%; top: -22px; width: 1.5px; height: 22px; margin-left: -0.75px; background: var(--ui-color-primary); }
    .rotate { position: absolute; left: 50%; top: -30px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%;
      background: var(--ui-color-primary); border: 2px solid var(--ui-color-surface); box-sizing: border-box; cursor: grab; }
    .rotate::after { content: ''; position: absolute; inset: -8px; }
    .size { position: absolute; left: 50%; top: calc(100% + 10px); translate: -50% 0; white-space: nowrap; pointer-events: none;
      padding: 2px 6px; border-radius: var(--ui-radius-xs); background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      font: 500 11px/1.4 var(--ui-font-mono); }
  `,
})
export class UiTransformBox implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  box = input.required<UiBox>();
  /** Screen pixels per stage unit. */
  scale = input(1);
  resizable = input(true);
  rotatable = input(true);
  /** Keep proportions on every resize, not only with Shift. */
  lockAspect = input(false);
  /** Smallest width/height, in stage units. */
  minSize = input(4);
  disabled = input(false);
  label = input('');
  /** Show a W × H readout while resizing. */
  showSize = input(false);
  /** Only the four corners — for elements where edge handles crowd the box. */
  cornersOnly = input(false);

  readonly transformStart = output<UiTransformMode>();
  readonly transform = output<UiBox>();
  readonly transformEnd = output<UiBox>();
  readonly activate = output<void>();

  protected readonly handles = computed(() => (this.cornersOnly() ? HANDLES.filter((h) => h.sx !== 0 && h.sy !== 0) : HANDLES));
  protected readonly sizeText = computed(() => `${Math.round(this.box().w)} × ${Math.round(this.box().h)}`);

  private drag: {
    mode: UiTransformMode;
    handle?: Handle;
    startX: number;
    startY: number;
    origin: UiBox;
    centerX: number;
    centerY: number;
    startAngle: number;
    last: UiBox;
    pointerId: number;
  } | null = null;

  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = (e: PointerEvent) => this.end(e);

  protected start(e: PointerEvent, mode: UiTransformMode, handle?: Handle): void {
    if (this.disabled() || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.el.nativeElement.focus({ preventScroll: true });

    const origin = { ...this.box() };
    const stage = (this.el.nativeElement.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const scale = this.scale();
    const centerX = (stage?.left ?? 0) + (origin.x + origin.w / 2) * scale;
    const centerY = (stage?.top ?? 0) + (origin.y + origin.h / 2) * scale;

    this.drag = {
      mode, handle, startX: e.clientX, startY: e.clientY, origin, centerX, centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX), last: origin, pointerId: e.pointerId,
    };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
    });
    this.transformStart.emit(mode);
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const scale = this.scale() || 1;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const o = d.origin;
    let next: UiBox;

    if (d.mode === 'move') {
      next = { ...o, x: o.x + dx, y: o.y + dy };
    } else if (d.mode === 'rotate') {
      const angle = Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX);
      let deg = o.rotate + ((angle - d.startAngle) * 180) / Math.PI;
      deg = ((deg % 360) + 540) % 360 - 180;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      else for (const r of [-180, -90, 0, 90, 180]) if (Math.abs(deg - r) < 3) deg = r;
      next = { ...o, rotate: Math.round(deg * 10) / 10 };
    } else {
      next = this.resize(o, d.handle!, dx, dy, e.shiftKey || this.lockAspect(), e.altKey);
    }

    d.last = next;
    this.zone.run(() => this.transform.emit(next));
  }

  /** Resizes in the box's own rotated frame, keeping the opposite edge fixed on screen. */
  private resize(o: UiBox, h: Handle, dx: number, dy: number, keepRatio: boolean, fromCenter: boolean): UiBox {
    const rad = (o.rotate * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Pointer delta expressed along the box's own axes.
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const factor = fromCenter ? 2 : 1;
    const min = this.minSize();

    let w = h.sx === 0 ? o.w : Math.max(min, o.w + h.sx * lx * factor);
    let hh = h.sy === 0 ? o.h : Math.max(min, o.h + h.sy * ly * factor);

    if (keepRatio && o.w > 0 && o.h > 0) {
      const ratio = o.w / o.h;
      if (h.sx !== 0 && h.sy !== 0) {
        // Follow whichever axis moved further, relative to its size.
        if (Math.abs(w / o.w - 1) > Math.abs(hh / o.h - 1)) hh = w / ratio;
        else w = hh * ratio;
      } else if (h.sx !== 0) hh = w / ratio;
      else w = hh * ratio;
      w = Math.max(min, w);
      hh = Math.max(min, hh);
    }

    // Where the centre goes: halfway along the growth, in the box's frame, then back to the stage.
    const cx0 = o.x + o.w / 2;
    const cy0 = o.y + o.h / 2;
    let shiftX = 0;
    let shiftY = 0;
    if (!fromCenter) {
      shiftX = h.sx === 0 ? 0 : (h.sx * (w - o.w)) / 2;
      shiftY = h.sy === 0 ? 0 : (h.sy * (hh - o.h)) / 2;
    }
    const cx = cx0 + shiftX * cos - shiftY * sin;
    const cy = cy0 + shiftX * sin + shiftY * cos;
    return { ...o, x: cx - w / 2, y: cy - hh / 2, w, h: hh };
  }

  private end(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.detach();
    this.drag = null;
    const moved = d.last !== d.origin;
    if (moved) this.zone.run(() => this.transformEnd.emit(d.last));
  }

  protected onKey(e: KeyboardEvent): void {
    if (this.disabled() || e.target !== this.el.nativeElement) return;
    const step = e.shiftKey ? 10 : 1;
    const b = this.box();
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    this.transformEnd.emit({ ...b, x: b.x + m[0], y: b.y + m[1] });
  }

  private detach(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  ngOnDestroy(): void {
    this.detach();
  }
}
