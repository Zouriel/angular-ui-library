import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { IconSvgObject } from '@hugeicons/angular';
import { isInsideStep, listSteps } from './definition';
import type { UiWfStepType } from './schema';
import { WfBuilderStore } from './store';

export type WfDragPayload =
  | { kind: 'new'; type: UiWfStepType; label: string; icon: IconSvgObject }
  | { kind: 'move'; id: string; label: string; icon: IconSvgObject };

export interface WfDropTarget {
  listId: string;
  index: number;
}

export interface WfDropState {
  target: WfDropTarget | null;
  valid: boolean;
  /** Where to draw the drop line, in viewport coordinates. */
  line: { x: number; y: number; width: number } | null;
}

/** Mouse drags start after this much movement, so clicks stay clicks. */
const MOUSE_SLOP = 4;
/** Touch drags start after holding this long without moving (scrolling wins otherwise). */
const LONG_PRESS_MS = 320;
const TOUCH_SLOP = 8;
const EDGE = 56;

/**
 * Drag and drop of steps. Hit-testing works on the DOM: step lists carry `data-wf-list="<listId>"`,
 * steps `data-wf-item="<id>"`, and the scroller `data-wf-scroll`. The innermost list under the
 * pointer wins, so steps can be dropped into branches and outcomes at any depth. Same pointer rules
 * as the form builder: grips start at once, mouse after a small move, touch after a long press.
 */
@Injectable()
export class WfDnd {
  private readonly store = inject(WfBuilderStore);

  readonly drag = signal<{ payload: WfDragPayload; x: number; y: number } | null>(null);
  readonly drop = signal<WfDropState | null>(null);
  readonly announcement = signal('');

  private root: HTMLElement | null = null;
  private last = { x: 0, y: 0 };
  private raf = 0;
  private suppressClick = false;
  private cleanup: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.cleanup?.();
      this.end();
    });
  }

  attach(root: HTMLElement): void {
    this.root = root;
  }

  /** True once, right after a drag ended, so the click that follows doesn't also select or add. */
  consumeClick(): boolean {
    const s = this.suppressClick;
    this.suppressClick = false;
    return s;
  }

  begin(payload: WfDragPayload, e: PointerEvent, opts: { immediate?: boolean } = {}): void {
    // Nothing moves for someone only looking: no drag, no ghost, nothing announced.
    if (e.button !== 0 || this.cleanup || !this.root || this.store.readOnly()) return;
    const start = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType === 'touch';
    let active = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const activate = () => {
      if (active) return;
      active = true;
      this.drag.set({ payload, x: this.last.x, y: this.last.y });
      document.documentElement.classList.add('ui-wf-dragging');
      document.body.style.setProperty('user-select', 'none');
      document.body.style.setProperty('-webkit-user-select', 'none');
      if (touch) navigator.vibrate?.(8);
      this.hitTest();
      this.loop();
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      this.last = { x: ev.clientX, y: ev.clientY };
      const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (!active) {
        if (touch && !opts.immediate) {
          if (dist > TOUCH_SLOP) stop(false);
          return;
        }
        if (dist > MOUSE_SLOP) activate();
        else return;
      }
      this.drag.update((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      this.hitTest();
    };
    const up = (ev: PointerEvent) => { if (ev.pointerId === e.pointerId) stop(active); };
    const cancel = () => stop(false);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && active) { ev.preventDefault(); stop(false); this.announcement.set('Move cancelled'); }
    };
    const touchmove = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
    const stop = (commit: boolean) => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('touchmove', touchmove);
      this.cleanup = null;
      if (active) {
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false), 0);
        if (commit) this.commitDrop(payload);
      }
      this.end();
    };

    this.last = { ...start };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('touchmove', touchmove, { passive: false });
    this.cleanup = () => stop(false);
    if (opts.immediate) activate();
    else if (touch) timer = setTimeout(activate, LONG_PRESS_MS);
  }

  private end(): void {
    cancelAnimationFrame(this.raf);
    this.drag.set(null);
    this.drop.set(null);
    document.documentElement.classList.remove('ui-wf-dragging');
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('-webkit-user-select');
  }

  private commitDrop(payload: WfDragPayload): void {
    const st = this.drop();
    if (!st?.target || !st.valid) return;
    if (payload.kind === 'new') {
      this.store.addStep(payload.type, st.target.listId, st.target.index);
      this.announcement.set(`Added ${payload.label}`);
    } else if (this.store.moveStep(payload.id, st.target.listId, st.target.index)) {
      this.announcement.set(`Moved ${payload.label}`);
    }
  }

  /** Scrolls the canvas while the pointer is near its top or bottom edge. */
  private loop(): void {
    const tick = () => {
      if (!this.drag()) return;
      const scroller = this.root?.querySelector<HTMLElement>('[data-wf-scroll]');
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        const y = this.last.y;
        let dy = 0;
        if (y < r.top + EDGE && y > r.top - 40) dy = -Math.ceil(((r.top + EDGE - y) / EDGE) * 14);
        else if (y > r.bottom - EDGE && y < r.bottom + 40) dy = Math.ceil(((y - (r.bottom - EDGE)) / EDGE) * 14);
        if (dy) { scroller.scrollTop += dy; this.hitTest(); }
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private hitTest(): void {
    const { x, y } = this.last;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!hit || !this.root?.contains(hit)) { this.drop.set({ target: null, valid: false, line: null }); return; }
    const payload = this.drag()?.payload;
    const movingId = payload?.kind === 'move' ? payload.id : null;
    const def = this.store.def();
    let list = hit.closest<HTMLElement>('[data-wf-list]');
    // Over the dragged step itself (or a list inside it): use the list it sits in.
    while (list && movingId && isInsideStep(def, list.dataset['wfList']!, movingId)) {
      list = list.parentElement?.closest<HTMLElement>('[data-wf-list]') ?? null;
    }
    if (!list) { this.drop.set({ target: null, valid: false, line: null }); return; }
    const listId = list.dataset['wfList']!;
    const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > [data-wf-item]'));
    const boxes = items.map((it) => it.getBoundingClientRect());
    const index = wfDropIndex(boxes, y);
    const lr = list.getBoundingClientRect();
    const lineY = !items.length ? lr.top + 12 : index < items.length ? boxes[index].top - 6 : boxes[boxes.length - 1].bottom + 6;
    const valid = listSteps(def, listId) !== null || listId.includes(':');
    this.drop.set({ target: { listId, index }, valid, line: { x: lr.left + 8, y: lineY, width: Math.max(40, lr.width - 16) } });
  }
}

/** Where a drop at height `y` goes among a list's steps (top to bottom): before the first step whose middle is below it. */
export function wfDropIndex(boxes: readonly { top: number; bottom: number }[], y: number): number {
  for (let i = 0; i < boxes.length; i++) if (y < (boxes[i].top + boxes[i].bottom) / 2) return i;
  return boxes.length;
}
