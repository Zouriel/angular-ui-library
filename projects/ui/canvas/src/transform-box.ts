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

export interface UiTransformTap {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
  pointerType: string;
}

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
 *
 * Two fingers pinch: the box grows or shrinks toward the point between the fingers — that point stays
 * under them, like zooming a photo — proportions kept, and moves with them. Fingers either side of
 * the middle grow it equally from every side. A second finger landing anywhere while one drags the box turns the drag
 * into a pinch; a host that sees two fingers land elsewhere (both beside a small element) can start
 * one with `startPinch`. It reports as a resize: `transformStart('resize')`, `transform`, `transformEnd`.
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
    @media (pointer: coarse) {
      .handle { width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; }
      .handle::after { inset: -12px; }
      .handle[data-h="n"], .handle[data-h="s"], .handle[data-h="e"], .handle[data-h="w"] { width: 12px; height: 12px; margin: -6px 0 0 -6px; }
      .stem { top: -34px; height: 34px; }
      .rotate { top: -46px; width: 20px; height: 20px; margin-left: -10px; }
      .rotate::after { inset: -12px; }
    }
    .size { position: absolute; left: 50%; top: calc(100% + 10px); translate: -50% 0; white-space: nowrap; pointer-events: none;
      padding: 2px 6px; border-radius: var(--ui-radius-xs); background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      font: 500 11px/1.4 var(--ui-font-mono); }
  `,
})
export class UiTransformBox implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  box = input.required<UiBox>();
  /** Layout pixels per stage unit — how the box is sized inside its stage. */
  scale = input(1);
  /**
   * Screen pixels per stage unit, when the stage itself is visually scaled (e.g. inside a CSS
   * transform). Pointer movement is divided by this. Defaults to `scale`.
   */
  pointerScale = input<number | null>(null);
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
  /**
   * The body was pressed and released without moving. The box covers whatever is under it, so this is
   * how a host lets a click on the selection reach the thing beneath — or the thing on top of it.
   */
  readonly tap = output<UiTransformTap>();

  private nudged: UiBox | null = null;
  private nudgedFrom: UiBox | null = null;

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
    pointerType: string;
    moved: boolean;
  } | null = null;

  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = (e: PointerEvent) => this.end(e);
  private readonly onSecondDown = (e: PointerEvent) => this.secondFinger(e);

  /** Two fingers on the stage: where each is, and the box and spread when they started. */
  private pinch: {
    points: Map<number, { x: number; y: number }>;
    spread: number;
    mid: { x: number; y: number };
    /** The box's centre on screen when the pinch began. */
    centre: { x: number; y: number };
    origin: UiBox;
    last: UiBox;
    moved: boolean;
  } | null = null;
  private readonly onPinchMove = (e: PointerEvent) => this.pinchMove(e);
  private readonly onPinchUp = (e: PointerEvent) => this.pinchEnd(e);

  /**
   * Starts a pinch from two touch points (pointer events, or anything with a pointerId and client
   * position) — for a host that sees both fingers land off the box. Does nothing while disabled.
   */
  startPinch(a: { pointerId: number; clientX: number; clientY: number }, b: { pointerId: number; clientX: number; clientY: number }): void {
    if (this.disabled() || this.pinch || a.pointerId === b.pointerId) return;
    // A drag in progress hands over to the pinch, keeping where it had got to.
    const from = this.drag?.last ?? this.box();
    // A drag that already moved has told the host it started; the pinch carries on from it.
    const carried = !!this.drag?.moved;
    if (this.drag) { this.detach(); this.drag = null; }
    const points = new Map([[a.pointerId, { x: a.clientX, y: a.clientY }], [b.pointerId, { x: b.clientX, y: b.clientY }]]);
    const [p, q] = [...points.values()];
    const stage = (this.el.nativeElement.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const px = this.pointerScale() ?? this.scale();
    const centre = { x: (stage?.left ?? 0) + (from.x + from.w / 2) * px, y: (stage?.top ?? 0) + (from.y + from.h / 2) * px };
    this.pinch = { centre, points, spread: Math.max(1, Math.hypot(q.x - p.x, q.y - p.y)), mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, origin: { ...from }, last: { ...from }, moved: carried };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPinchMove);
      window.addEventListener('pointerup', this.onPinchUp);
      window.addEventListener('pointercancel', this.onPinchUp);
    });
    if (carried) this.zone.run(() => this.transformStart.emit('resize'));
  }

  /** Whether two fingers are pinching the box now. */
  get pinching(): boolean {
    return this.pinch !== null;
  }

  protected start(e: PointerEvent, mode: UiTransformMode, handle?: Handle): void {
    if (this.disabled() || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.el.nativeElement.focus({ preventScroll: true });

    const origin = { ...this.box() };
    const stage = (this.el.nativeElement.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    const scale = this.pointerScale() ?? this.scale();
    const centerX = (stage?.left ?? 0) + (origin.x + origin.w / 2) * scale;
    const centerY = (stage?.top ?? 0) + (origin.y + origin.h / 2) * scale;

    this.drag = {
      mode, handle, startX: e.clientX, startY: e.clientY, origin, centerX, centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX), last: origin, pointerId: e.pointerId,
      pointerType: e.pointerType, moved: false,
    };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
      // A finger dragging the box: a second one anywhere makes it a pinch.
      if (e.pointerType === 'touch') window.addEventListener('pointerdown', this.onSecondDown, true);
    });
    this.transformStart.emit(mode);
  }

  private secondFinger(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerType !== 'touch' || e.pointerId === d.pointerId || d.pointerType !== 'touch') return;
    e.preventDefault();
    e.stopPropagation();
    const first = { pointerId: d.pointerId, clientX: d.startX, clientY: d.startY };
    // The first finger may have moved since: its latest place is where the pinch measures from.
    const at = this.lastPoint ?? first;
    this.startPinch({ pointerId: d.pointerId, clientX: at.clientX, clientY: at.clientY }, e);
  }

  private lastPoint: { clientX: number; clientY: number } | null = null;

  private pinchMove(e: PointerEvent): void {
    const p = this.pinch;
    if (!p || !p.points.has(e.pointerId)) return;
    p.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...p.points.values()];
    const scale = (this.pointerScale() ?? this.scale()) || 1;
    const o = p.origin;
    const min = this.minSize();
    // Equal from every side: one factor for both, never below the smallest size.
    const k = Math.max(Math.hypot(b.x - a.x, b.y - a.y) / p.spread, min / Math.max(1e-6, o.w), min / Math.max(1e-6, o.h));
    const w = o.w * k;
    const h = o.h * k;
    // The point that was between the fingers stays between them: the centre keeps its offset from it,
    // scaled, and the pair's movement carries both.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cx = o.x + o.w / 2 + (mx - p.mid.x + (p.centre.x - p.mid.x) * (k - 1)) / scale;
    const cy = o.y + o.h / 2 + (my - p.mid.y + (p.centre.y - p.mid.y) * (k - 1)) / scale;
    p.last = { ...o, x: cx - w / 2, y: cy - h / 2, w, h };
    // Told on the first movement, so two fingers that land and lift change nothing.
    if (!p.moved) this.zone.run(() => this.transformStart.emit('resize'));
    p.moved = true;
    this.zone.run(() => this.transform.emit(p.last));
  }

  private pinchEnd(e: PointerEvent): void {
    const p = this.pinch;
    if (!p || !p.points.has(e.pointerId)) return;
    // Lifting either finger ends it; the other one doesn't carry on as a drag, so nothing jumps.
    this.pinch = null;
    window.removeEventListener('pointermove', this.onPinchMove);
    window.removeEventListener('pointerup', this.onPinchUp);
    window.removeEventListener('pointercancel', this.onPinchUp);
    // Fingers that never moved changed nothing: no end, so the host doesn't record a change.
    if (p.moved) this.zone.run(() => this.transformEnd.emit(p.last));
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.lastPoint = { clientX: e.clientX, clientY: e.clientY };
    if (!d.moved) {
      // A finger wobbles: don't let a tap become a one-pixel move.
      const slop = d.pointerType === 'touch' ? 6 : 1;
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < slop) return;
      d.moved = true;
    }
    const scale = (this.pointerScale() ?? this.scale()) || 1;
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
    else if (d.mode === 'move' && e.type === 'pointerup')
      this.zone.run(() => this.tap.emit({ clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, pointerType: e.pointerType }));
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
    // Presses faster than the host re-renders (a held key) build on the last nudge, not on a box
    // that hasn't caught up yet — otherwise they overwrite each other and the element barely moves.
    const base = this.nudged && this.nudgedFrom === b ? this.nudged : b;
    const next = { ...base, x: base.x + m[0], y: base.y + m[1] };
    this.nudged = next;
    this.nudgedFrom = b;
    this.transformEnd.emit(next);
  }

  private detach(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('pointerdown', this.onSecondDown, true);
    this.lastPoint = null;
  }

  ngOnDestroy(): void {
    this.detach();
    window.removeEventListener('pointermove', this.onPinchMove);
    window.removeEventListener('pointerup', this.onPinchUp);
    window.removeEventListener('pointercancel', this.onPinchUp);
  }
}
