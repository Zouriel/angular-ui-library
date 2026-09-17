import { isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, NgZone, PLATFORM_ID, computed, inject, input, model, output, signal,
} from '@angular/core';

export interface UiScrubberMarker {
  at: number;
  label: string;
}

/** A layer drawn as a thin line along the strip: where it starts and ends. */
export interface UiScrubberLane {
  start: number;
  end: number;
  selected?: boolean;
  muted?: boolean;
}

export interface UiScrubberTick {
  at: number;
  /** Drawn filled, e.g. the keyframe under the playhead. */
  active?: boolean;
}

/** Below this speed (px per ms) a released drag stops instead of gliding. */
const GLIDE_MIN = 0.05;
/** How much speed a glide keeps per frame. */
const GLIDE_DECAY = 0.94;
/** A finger held this long without moving is a long press, not a scrub. */
const LONG_PRESS_MS = 450;
const PRESS_SLOP = 8;

/**
 * `ui-scrubber` — a strip that slides under a playhead fixed at its centre, the way mobile video
 * editors do it: the finger moves the content, never a tiny handle. Sections (`markers`) run along it
 * as labelled segments, `lanes` draw layers as thin stacked lines (a flattened timeline), and `ticks`
 * mark points of interest such as keyframes. Past `end`, the strip is shaded.
 *
 * <p>Holding still on it emits `longPress` — for opening the full timeline — and puts the playhead back.</p>
 *
 * <p>Drag sideways to scrub; a flick glides and slows. Pinch with two fingers to zoom (`zoom` is
 * pixels per unit, two-way). With a mouse, drag or use the wheel. As a slider it takes ←/→ (Shift for
 * bigger steps), PageUp/PageDown and Home/End.</p>
 *
 * <p>The finger is followed with touch events and the strip claims every direction (`touch-action:
 * none`) — a sideways drag the browser could read as a swipe would otherwise never arrive as pointer
 * events. Pointer events serve the mouse and pen.</p>
 */
@Component({
  selector: 'ui-scrubber',
  host: {
    class: 'ui-scrubber',
    role: 'slider',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': 'length()',
    '[attr.aria-valuenow]': 'round(value())',
    '[attr.aria-valuetext]': 'valueText() || null',
    '[class.dragging]': 'dragging()',
    '[class.pressing]': 'pressing()',
    '(contextmenu)': 'onContextMenu($event)',
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd($event)',
    '(touchcancel)': 'onTouchEnd($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(wheel)': 'onWheel($event)',
    '(keydown)': 'onKey($event)',
  },
  template: `
    <div class="track" [style.width.px]="length() * zoom()" [style.transform]="'translateX(' + offset() + 'px)'">
      @if (lanes().length) {
        <span class="lanes" aria-hidden="true">
          @for (l of lanes(); track $index; let i = $index) {
            <span class="lane" [class.selected]="l.selected" [class.muted]="l.muted"
              [style.left.px]="l.start * zoom()" [style.width.px]="Math.max(2, (l.end - l.start) * zoom())"
              [style.top.%]="laneTop(i)" [style.height.%]="laneHeight()"></span>
          }
        </span>
      }
      @if (end() !== null && end()! < length()) {
        <span class="beyond" [style.left.px]="end()! * zoom()"></span>
      }
      @for (m of segments(); track $index; let i = $index) {
        <span class="segment" [class.alt]="i % 2 === 1" [style.left.px]="m.start * zoom()" [style.width.px]="(m.end - m.start) * zoom()">
          <span class="slabel">{{ m.label }}</span>
        </span>
      }
      @for (t of ticks(); track $index) {
        <span class="tick" [class.active]="t.active" [style.left.px]="t.at * zoom()"></span>
      }
    </div>
    <span class="edge start" aria-hidden="true"></span>
    <span class="edge end" aria-hidden="true"></span>
    <span class="playhead" aria-hidden="true"></span>
  `,
  styles: `
    :host { position: relative; display: block; height: 44px; overflow: hidden; touch-action: none; user-select: none; cursor: grab;
      background: var(--ui-color-surface-subtle); border-radius: var(--ui-radius); outline: none; }
    :host(.dragging) { cursor: grabbing; }
    :host(:focus-visible) { box-shadow: var(--ui-focus-ring); }
    .track { position: absolute; left: 0; top: 6px; bottom: 6px; will-change: transform; }
    .segment { position: absolute; top: 0; bottom: 0; box-sizing: border-box; border-left: 1px solid var(--ui-color-border-strong);
      background: color-mix(in srgb, var(--ui-color-primary) 10%, var(--ui-color-surface)); overflow: hidden; }
    .segment.alt { background: color-mix(in srgb, var(--ui-color-primary) 18%, var(--ui-color-surface)); }
    .slabel { position: absolute; left: 6px; top: 50%; translate: 0 -50%; white-space: nowrap; font: 500 11px var(--ui-font-mono);
      color: var(--ui-color-text-secondary); }
    .lanes { position: absolute; inset: 0; }
    .lane { position: absolute; box-sizing: border-box; border-radius: 2px; min-height: 1.5px;
      background: color-mix(in srgb, var(--ui-color-primary) 42%, var(--ui-color-surface)); }
    .lane.selected { background: var(--ui-color-primary); z-index: 1; }
    .lane.muted { opacity: .35; }
    .beyond { position: absolute; top: -6px; bottom: -6px; right: 0; border-left: 1.5px dashed var(--ui-color-border-strong);
      background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--ui-color-text) 6%, transparent) 0 5px, transparent 5px 10px); }
    :host(.pressing) .track { opacity: .75; transition: opacity .3s; }
    .tick { position: absolute; top: 50%; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; rotate: 45deg; box-sizing: border-box;
      background: var(--ui-color-surface); border: 1.5px solid var(--ui-color-primary); }
    .tick.active { background: var(--ui-color-primary); }
    .playhead { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--ui-color-primary);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-color-surface) 70%, transparent); pointer-events: none; }
    .playhead::before { content: ''; position: absolute; left: 50%; top: 0; translate: -50% 0; border: 5px solid transparent;
      border-top-color: var(--ui-color-primary); }
    .edge { position: absolute; top: 0; bottom: 0; width: 24px; pointer-events: none; }
    .edge.start { left: 0; background: linear-gradient(90deg, var(--ui-color-surface-subtle), transparent); }
    .edge.end { right: 0; background: linear-gradient(270deg, var(--ui-color-surface-subtle), transparent); }
  `,
})
export class UiScrubber {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  length = input(100);
  markers = input<readonly UiScrubberMarker[]>([]);
  ticks = input<readonly UiScrubberTick[]>([]);
  lanes = input<readonly UiScrubberLane[]>([]);
  /** Where the content ends, when the strip runs on past it. */
  end = input<number | null>(null);
  label = input('Position');
  valueText = input('');
  /** Smallest and largest zoom a pinch reaches, in px per unit. */
  minZoom = input(0.02);
  maxZoom = input(4);

  value = model(0);
  /** Pixels per unit. */
  zoom = model(0.25);

  /** Once, when a drag, glide, wheel or key change comes to rest. */
  readonly settle = output<number>();
  /** Held still (finger or mouse) — the playhead is left where it was. */
  readonly longPress = output<void>();

  protected readonly Math = Math;
  protected readonly pressing = signal(false);
  private pressTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly width = signal(0);
  protected readonly dragging = signal(false);

  protected readonly offset = computed(() => this.width() / 2 - this.value() * this.zoom());
  protected readonly segments = computed(() => {
    const markers = [...this.markers()].sort((a, b) => a.at - b.at);
    return markers.map((m, i) => ({ label: m.label, start: m.at, end: markers[i + 1]?.at ?? this.length() }))
      .filter((s) => s.end > s.start);
  });

  private touched = false;
  private touch: { id: number; x: number; y: number; value: number; lastX: number; lastAt: number; velocity: number; far: boolean } | null = null;
  private pinch: { distance: number; zoom: number } | null = null;
  private pointer: { id: number; x: number; value: number; lastX: number; lastAt: number; velocity: number; far?: boolean } | null = null;
  private glideFrame = 0;
  private wheelTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.browser) return;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => {
      observer.disconnect();
      cancelAnimationFrame(this.glideFrame);
      this.detachPointer();
      if (this.wheelTimer) clearTimeout(this.wheelTimer);
      if (this.pressTimer) clearTimeout(this.pressTimer);
    });
  }

  protected round(n: number): number {
    return Math.round(n);
  }

  /** Lanes share the strip's height, each at least a hairline; with many, they overlap evenly. */
  protected laneHeight(): number {
    const n = this.lanes().length;
    return Math.max(8, Math.min(34, 100 / Math.max(1, n) - 4));
  }

  protected laneTop(i: number): number {
    const n = this.lanes().length;
    if (n <= 1) return 50 - this.laneHeight() / 2;
    return (i / (n - 1)) * (100 - this.laneHeight());
  }

  private startPress(origin: number, isStill: () => boolean, cancel: () => void): void {
    this.clearPress();
    this.pressing.set(true);
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      this.pressing.set(false);
      if (!isStill()) return;
      cancel();
      cancelAnimationFrame(this.glideFrame);
      this.dragging.set(false);
      if (this.value() !== origin) this.value.set(origin);
      this.zone.run(() => this.longPress.emit());
    }, LONG_PRESS_MS);
  }

  private clearPress(): void {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
    this.pressing.set(false);
  }

  protected onContextMenu(e: Event): void {
    if (this.touch || this.pressing()) e.preventDefault();
  }

  private set(v: number): void {
    const next = Math.min(this.length(), Math.max(0, v));
    if (next !== this.value()) this.value.set(next);
  }

  // ----- Touch -------------------------------------------------------------------------------------

  protected onTouchStart(e: TouchEvent): void {
    this.touched = true;
    cancelAnimationFrame(this.glideFrame);
    if (e.touches.length >= 2) {
      this.clearPress();
      this.touch = null;
      this.pinch = { distance: distance(e.touches[0], e.touches[1]), zoom: this.zoom() };
      this.dragging.set(true);
      return;
    }
    const t = e.changedTouches[0];
    if (!t) return;
    const touch = { id: t.identifier, x: t.clientX, y: t.clientY, value: this.value(), lastX: t.clientX, lastAt: e.timeStamp, velocity: 0, far: false };
    this.touch = touch;
    this.dragging.set(true);
    this.startPress(touch.value, () => this.touch === touch && !touch.far, () => (this.touch = null));
  }

  protected onTouchMove(e: TouchEvent): void {
    if (e.cancelable) e.preventDefault();
    if (this.pinch && e.touches.length >= 2) {
      const ratio = distance(e.touches[0], e.touches[1]) / Math.max(1, this.pinch.distance);
      this.zoom.set(Math.min(this.maxZoom(), Math.max(this.minZoom(), this.pinch.zoom * ratio)));
      return;
    }
    const d = this.touch;
    if (!d) return;
    const t = Array.from(e.changedTouches).find((x) => x.identifier === d.id);
    if (!t) return;
    if (!d.far && Math.hypot(t.clientX - d.x, t.clientY - d.y) > PRESS_SLOP) {
      d.far = true;
      this.clearPress();
    }
    this.track(d, t.clientX, e.timeStamp);
  }

  protected onTouchEnd(e: TouchEvent): void {
    if (this.pinch) {
      if (e.touches.length < 2) {
        this.pinch = null;
        this.dragging.set(false);
        this.settle.emit(this.value());
      }
      return;
    }
    this.clearPress();
    const d = this.touch;
    if (!d || !Array.from(e.changedTouches).some((x) => x.identifier === d.id)) return;
    this.touch = null;
    this.release(d.velocity, e.timeStamp - d.lastAt);
  }

  // ----- Mouse and pen -----------------------------------------------------------------------------

  protected onPointerDown(e: PointerEvent): void {
    if (this.touched || e.pointerType === 'touch' || e.button !== 0) return;
    cancelAnimationFrame(this.glideFrame);
    this.host.nativeElement.focus();
    const pointer = { id: e.pointerId, x: e.clientX, value: this.value(), lastX: e.clientX, lastAt: e.timeStamp, velocity: 0, far: false };
    this.pointer = pointer;
    this.dragging.set(true);
    this.startPress(pointer.value, () => this.pointer === pointer && !pointer.far, () => { this.pointer = null; this.detachPointer(); });
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);
    });
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    const d = this.pointer;
    if (!d || e.pointerId !== d.id) return;
    if (!d.far && Math.abs(e.clientX - d.x) > PRESS_SLOP) {
      d.far = true;
      this.zone.run(() => this.clearPress());
    }
    this.zone.run(() => this.track(d, e.clientX, e.timeStamp));
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    const d = this.pointer;
    if (!d || e.pointerId !== d.id) return;
    this.pointer = null;
    this.detachPointer();
    this.zone.run(() => {
      this.clearPress();
      this.release(d.velocity, e.timeStamp - d.lastAt);
    });
  };

  private detachPointer(): void {
    if (!this.browser) return;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  protected onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    this.set(this.value() + delta / this.zoom());
    if (this.wheelTimer) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => this.settle.emit(this.value()), 150);
  }

  protected onKey(e: KeyboardEvent): void {
    const small = this.length() / 100;
    const big = this.length() / 10;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = this.value() + (e.shiftKey ? big : small);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = this.value() - (e.shiftKey ? big : small);
    else if (e.key === 'PageUp') next = this.value() + big;
    else if (e.key === 'PageDown') next = this.value() - big;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = this.length();
    if (next === null) return;
    e.preventDefault();
    this.set(next);
    this.settle.emit(this.value());
  }

  // ----- Shared ------------------------------------------------------------------------------------

  private track(d: { x: number; value: number; lastX: number; lastAt: number; velocity: number }, x: number, at: number): void {
    const dt = at - d.lastAt;
    if (dt > 0) d.velocity = 0.7 * ((x - d.lastX) / dt) + 0.3 * d.velocity;
    d.lastX = x;
    d.lastAt = at;
    // Content follows the finger: dragging left moves forward.
    this.set(d.value - (x - d.x) / this.zoom());
  }

  /** A fast release glides on and slows; a slow one stops where it is. */
  private release(velocity: number, idleMs: number): void {
    let v = idleMs > 80 ? 0 : velocity;
    if (Math.abs(v) < GLIDE_MIN) {
      this.dragging.set(false);
      this.settle.emit(this.value());
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      this.set(this.value() - (v * dt) / this.zoom());
      v *= Math.pow(GLIDE_DECAY, dt / 16);
      const atEdge = this.value() <= 0 || this.value() >= this.length();
      if (Math.abs(v) < GLIDE_MIN || atEdge) {
        this.dragging.set(false);
        this.settle.emit(this.value());
        return;
      }
      this.glideFrame = requestAnimationFrame(step);
    };
    this.glideFrame = requestAnimationFrame(step);
  }
}

function distance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
