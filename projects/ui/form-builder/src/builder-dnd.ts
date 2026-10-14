import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { IconSvgObject } from '@hugeicons/angular';
import { FbBuilderStore } from './builder-store';
import { canDrop, isInside, type UiFbDropTarget } from './definition';
import type { UiFbElement } from './schema';

export type FbDragPayload =
  | { kind: 'new'; label: string; icon: IconSvgObject; create: () => UiFbElement }
  | { kind: 'move'; id: string; label: string; icon: IconSvgObject };

export interface FbDropLine {
  x: number;
  y: number;
  /** Length of the line; horizontal unless `vertical`. */
  length: number;
  vertical: boolean;
}

export interface FbDropState {
  target: UiFbDropTarget | null;
  valid: boolean;
  line: FbDropLine | null;
  /** The list or page tab under the pointer, for highlighting. */
  over: string | null;
}

/** Mouse drags start after this much movement, so clicks stay clicks. */
const MOUSE_SLOP = 4;
/** Touch drags start after holding this long without moving (scrolling wins otherwise). */
const LONG_PRESS_MS = 320;
const TOUCH_SLOP = 8;
const EDGE = 56;

/**
 * Drag and drop for the builder. Hit-testing works on the canvas DOM: lists
 * carry `data-fb-list="<page or group id>"`, items `data-fb-item="<id>"`, page
 * tabs `data-fb-page-drop="<page id>"`, and the scroller `data-fb-scroll`.
 * The innermost list under the pointer wins, so nested sections just work.
 */
@Injectable()
export class FbDnd {
  private readonly store = inject(FbBuilderStore);

  readonly drag = signal<{ payload: FbDragPayload; x: number; y: number } | null>(null);
  readonly drop = signal<FbDropState | null>(null);
  readonly announcement = signal('');

  private element: UiFbElement | null = null;
  private root: HTMLElement | null = null;
  private last = { x: 0, y: 0 };
  private raf = 0;
  private suppressClick = false;
  private cleanup: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.end());
  }

  /** The builder's host element; hit-testing stays inside it. */
  attach(root: HTMLElement): void {
    this.root = root;
  }

  /** True once, right after a drag ended, so the click that follows doesn't also select or add. */
  consumeClick(): boolean {
    const s = this.suppressClick;
    this.suppressClick = false;
    return s;
  }

  /**
   * Starts watching a press. `immediate` (drag handles) starts at once; otherwise
   * mouse needs a small move and touch needs a long press.
   */
  begin(payload: FbDragPayload, e: PointerEvent, opts: { immediate?: boolean } = {}): void {
    if (e.button !== 0 || this.cleanup || !this.root) return;
    const start = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType === 'touch';
    let active = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const activate = () => {
      if (active) return;
      active = true;
      this.element = payload.kind === 'new' ? payload.create() : (this.store.index().get(payload.id)?.element as UiFbElement) ?? null;
      this.drag.set({ payload, x: this.last.x, y: this.last.y });
      document.documentElement.classList.add('ui-fb-dragging');
      // No text gets selected while dragging across the page.
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
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      stop(active);
    };
    const cancel = () => stop(false);
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && active) { ev.preventDefault(); stop(false); this.announcement.set('Move cancelled'); }
    };
    // While dragging by touch, the page must not scroll under the finger.
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
    this.element = null;
    document.documentElement.classList.remove('ui-fb-dragging');
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('-webkit-user-select');
  }

  private commitDrop(payload: FbDragPayload): void {
    const st = this.drop();
    if (!st?.target || !st.valid || !this.element) return;
    if (payload.kind === 'new') {
      this.store.add(this.element, st.target);
      this.announcement.set(`Added ${payload.label}`);
    } else if (this.store.move(payload.id, st.target)) {
      this.announcement.set(`Moved ${payload.label}`);
    }
  }

  /** Scrolls the canvas while the pointer is near its top or bottom edge. */
  private loop(): void {
    const tick = () => {
      if (!this.drag()) return;
      const scroller = this.root?.querySelector<HTMLElement>('[data-fb-scroll]');
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        const y = this.last.y;
        let dy = 0;
        if (y < r.top + EDGE && y > r.top - 40) dy = -Math.ceil(((r.top + EDGE - y) / EDGE) * 14);
        else if (y > r.bottom - EDGE && y < r.bottom + 40) dy = Math.ceil(((y - (r.bottom - EDGE)) / EDGE) * 14);
        if (dy) {
          scroller.scrollTop += dy;
          this.hitTest();
        }
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private hitTest(): void {
    const { x, y } = this.last;
    const el = this.element;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el || !hit || !this.root?.contains(hit)) { this.drop.set({ target: null, valid: false, line: null, over: null }); return; }
    const def = this.store.def();
    const movingId = this.drag()?.payload.kind === 'move' ? el.id : null;

    const tab = hit.closest<HTMLElement>('[data-fb-page-drop]');
    if (tab) {
      const pageId = tab.dataset['fbPageDrop']!;
      const page = def.pages.find((p) => p.id === pageId);
      const target = { containerId: pageId, index: page?.elements.length ?? 0 };
      this.drop.set({ target, valid: canDrop(def, el, pageId), line: null, over: `tab:${pageId}` });
      return;
    }

    let list = hit.closest<HTMLElement>('[data-fb-list]');
    // Over the dragged element itself (or inside it): treat as "leave it where it is".
    if (movingId && list && isInside(def, list.dataset['fbList']!, movingId)) {
      list = list.parentElement?.closest<HTMLElement>(`[data-fb-item="${movingId}"]`)?.parentElement?.closest<HTMLElement>('[data-fb-list]') ?? null;
    }
    if (!list) {
      const canvas = hit.closest('[data-fb-canvas]');
      list = canvas ? this.root.querySelector<HTMLElement>(`[data-fb-list="${this.store.page().id}"]`) : null;
    }
    if (!list) { this.drop.set({ target: null, valid: false, line: null, over: null }); return; }

    const containerId = list.dataset['fbList']!;
    const items = Array.from(list.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.hasAttribute('data-fb-item'));
    const lr = list.getBoundingClientRect();
    const index = fbDropIndex(items.map((it) => it.getBoundingClientRect()), x, y);
    const line = this.lineFor(items, index, lr);
    const valid = canDrop(def, el, containerId) && !(movingId && isInside(def, containerId, movingId));
    this.drop.set({ target: { containerId, index }, valid, line, over: containerId });
  }

  private lineFor(items: HTMLElement[], index: number, lr: DOMRect): FbDropLine {
    const pad = 6;
    if (!items.length) return { x: lr.left + pad, y: lr.top + pad, length: lr.width - pad * 2, vertical: false };
    if (index < items.length) {
      const r = items[index].getBoundingClientRect();
      const p = index > 0 ? items[index - 1].getBoundingClientRect() : null;
      if (p && Math.abs(p.top - r.top) < 4) return { x: (p.right + r.left) / 2, y: r.top, length: r.height, vertical: true };
      if (r.width < lr.width - 24 && (!p || p.bottom <= r.top + 2)) return { x: r.left - 5, y: r.top, length: r.height, vertical: true };
      return { x: lr.left, y: r.top - 5, length: lr.width, vertical: false };
    }
    const l = items[items.length - 1].getBoundingClientRect();
    if (l.right < lr.right - 24) return { x: l.right + 5, y: l.top, length: l.height, vertical: true };
    return { x: lr.left, y: l.bottom + 5, length: lr.width, vertical: false };
  }
}

/** A card's box on screen, as far as choosing a drop place needs. */
export interface FbBox { top: number; bottom: number; left: number; width: number; height: number }

/**
 * Where a drop at (x, y) goes among a list's cards (in order): before the first card the pointer
 * is above, or over. Over a card that shares its row with others, its left half means "before
 * it"; over a card alone on its row (every card on a phone), its top half does. Halving by x
 * there would put a card dragged by its grip, at the left edge, back where it started.
 */
export function fbDropIndex(boxes: readonly FbBox[], x: number, y: number): number {
  for (let i = 0; i < boxes.length; i++) {
    const r = boxes[i];
    if (y < r.top) return i;
    if (y > r.bottom) continue;
    const shared = boxes.some((o, j) => j !== i && o.top < r.bottom - 1 && o.bottom > r.top + 1);
    if (shared ? x < r.left + r.width / 2 : y < r.top + r.height / 2) return i;
  }
  return boxes.length;
}
