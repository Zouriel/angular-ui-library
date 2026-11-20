import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { UI_CONFIG, uiLogicalKey } from '@zouriel/ui';

/** Distance (px) a mouse or pen must move before a drag begins. */
export const UI_DRAG_MOUSE_SLOP = 6;

/** Distance (px) from a scroll container's edge where auto-scroll begins. */
export const UI_DRAG_EDGE_PX = 56;

const STYLE_ID = 'ui-drag-styles';
const LIVE_CLASS = 'ui-drag-live';
const MAX_SCROLL_STEP = 14;

/** Shared styles injected once into the document head; uses tokens from tokens.css only. */
export const UI_DRAG_STYLES = `
.ui-drag-item--dragging {
  opacity: 0.4;
}
.ui-drop-target--over {
  box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-accent);
}
.ui-drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  margin: 0;
  pointer-events: none;
  z-index: var(--ui-z-overlay);
  border-radius: var(--ui-radius);
  box-shadow: var(--ui-shadow-2);
  opacity: 0.96;
  transform-origin: center center;
  transform: scale(1);
  transition: transform var(--ui-motion-fast) var(--ui-ease-decelerate), box-shadow var(--ui-motion-fast) var(--ui-ease-decelerate);
}
.ui-drag-ghost--lifted {
  transform: scale(1.04);
}
.ui-drag-ghost--reduced {
  transition: none;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .ui-drag-ghost,
  .ui-drag-ghost--lifted {
    transition: none;
    transform: none;
  }
}
.${LIVE_CLASS} {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
`;

/** Internal interface implemented by `UiDragItem`. */
export interface UiDragItemHandle<T = unknown> {
  readonly element: HTMLElement;
  getPayload(): T;
  getLabel(): string;
  setDragging(dragging: boolean): void;
  notifyStart(payload: T): void;
  notifyCancel(payload: T): void;
  notifyEnd(payload: T): void;
}

/** Internal interface implemented by `UiDropTarget`. */
export interface UiDropTargetHandle<T = unknown> {
  readonly element: HTMLElement;
  isEnabled(): boolean;
  getLabel(): string;
  canAccept(payload: unknown): boolean;
  setOver(over: boolean): void;
  receiveDrop(payload: T): void;
}

/** Snapshot of an in-progress drag session. */
export interface UiDragSession<T = unknown> {
  readonly payload: T;
  readonly label: string;
  readonly source: UiDragItemHandle<T>;
  readonly keyboard: boolean;
}

/**
 * Coordinates drag-and-drop sessions between `uiDragItem` and `uiDropTarget` directives,
 * managing the floating ghost, edge auto-scrolling, keyboard target selection, and live-region
 * screen-reader announcements.
 */
@Injectable({ providedIn: 'root' })
export class UiDragService {
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly config = inject(UI_CONFIG);

  private readonly targets = new Set<UiDropTargetHandle<unknown>>();
  private ghostEl: HTMLElement | null = null;
  private liveEl: HTMLElement | null = null;
  private grabX = 0;
  private grabY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private scrollRaf: number | null = null;
  private liftRaf: number | null = null;
  private keyboardTargets: UiDropTargetHandle<unknown>[] = [];
  private keyboardIndex = -1;

  /** The currently active drag session, or null when idle. */
  readonly active = signal<UiDragSession | null>(null);
  /** The currently hovered valid drop target, or null. */
  readonly hoveredTarget = signal<UiDropTargetHandle<unknown> | null>(null);
  /** The latest screen-reader announcement (also written to the live region). */
  readonly announcement = signal('');

  private readonly onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onPointerUpBound = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly onPointerCancelBound = () => this.cancel();
  private readonly onTouchMoveBound = (e: TouchEvent) => {
    if (this.active() && !this.active()!.keyboard) e.preventDefault();
  };
  private readonly onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);

  registerTarget(target: UiDropTargetHandle<unknown>): void {
    this.targets.add(target);
  }

  unregisterTarget(target: UiDropTargetHandle<unknown>): void {
    this.targets.delete(target);
    if (this.hoveredTarget() === target) {
      target.setOver(false);
      this.hoveredTarget.set(null);
    }
  }

  /** All currently enabled drop targets that accept `payload`. */
  validTargetsFor(payload: unknown): UiDropTargetHandle<unknown>[] {
    const valid: UiDropTargetHandle<unknown>[] = [];
    for (const t of this.targets) {
      if (t.isEnabled() && t.canAccept(payload)) valid.push(t);
    }
    return valid;
  }

  /** Returns true when reduced motion is preferred or animations are turned off in `UiConfig`. */
  isReducedMotion(): boolean {
    if (this.config.animations === false) return true;
    if (!this.isBrowser) return false;
    const win = this.doc.defaultView;
    return !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  /** Begins a pointer drag (mouse after slop, or touch after long press). */
  startPointerDrag<T>(item: UiDragItemHandle<T>, clientX: number, clientY: number): void {
    if (this.active()) this.cancel();
    this.ensureStyles();
    const payload = item.getPayload();
    const label = item.getLabel();
    const rect = item.element.getBoundingClientRect();
    this.grabX = rect.width ? clientX - rect.left : 0;
    this.grabY = rect.height ? clientY - rect.top : 0;
    this.pointerX = clientX;
    this.pointerY = clientY;

    this.active.set({ payload, label, source: item as UiDragItemHandle<unknown>, keyboard: false });
    item.setDragging(true);
    this.createGhost(item.element, rect);
    this.positionGhost(clientX, clientY);
    this.attachPointerListeners();
    this.startAutoScroll();
    this.updateHoverAt(clientX, clientY);
    item.notifyStart(payload);
  }

  /** Begins a keyboard drag from a focused draggable item. */
  startKeyboardDrag<T>(item: UiDragItemHandle<T>): boolean {
    if (this.active()) this.cancel();
    this.ensureStyles();
    const payload = item.getPayload();
    const label = item.getLabel();
    const valid = this.validTargetsFor(payload);
    if (valid.length === 0) {
      this.announce(`No valid drop targets for ${label}.`);
      return false;
    }

    this.keyboardTargets = valid;
    this.keyboardIndex = 0;
    this.active.set({ payload, label, source: item as UiDragItemHandle<unknown>, keyboard: true });
    item.setDragging(true);
    this.setHovered(valid[0], false);
    this.doc.addEventListener('keydown', this.onKeyDownBound, true);
    item.notifyStart(payload);
    const targetLabel = valid[0].getLabel();
    this.announce(
      `Picked up ${label}. ${valid.length} drop ${valid.length === 1 ? 'target' : 'targets'} available. Over ${targetLabel}. Use arrow keys to choose a target, Enter or Space to drop, Escape to cancel.`,
    );
    return true;
  }

  /** Programmatically drops the active item (or a given item) onto a specific target. */
  dropOn<T>(item: UiDragItemHandle<T>, target: UiDropTargetHandle<T>): boolean {
    const payload = item.getPayload();
    if (!target.isEnabled() || !target.canAccept(payload)) return false;
    target.receiveDrop(payload);
    this.announce(`Dropped ${item.getLabel()} on ${target.getLabel()}`);
    return true;
  }

  /** Cancels the active drag session without dropping. */
  cancel(): void {
    const session = this.active();
    if (!session) return;
    this.teardown();
    session.source.notifyCancel(session.payload);
    session.source.notifyEnd(session.payload);
    this.announce(`Cancelled dragging ${session.label}`);
  }

  /** Commits the active drag onto the currently hovered valid target, or cancels if none. */
  commit(): void {
    const session = this.active();
    if (!session) return;
    const target = this.hoveredTarget();
    this.teardown();
    if (target && target.isEnabled() && target.canAccept(session.payload)) {
      target.receiveDrop(session.payload);
      this.announce(`Dropped ${session.label} on ${target.getLabel()}`);
      session.source.notifyEnd(session.payload);
    } else {
      session.source.notifyCancel(session.payload);
      session.source.notifyEnd(session.payload);
      this.announce(`Cancelled dragging ${session.label}`);
    }
  }

  /** Updates the polite live region so screen readers hear drag state changes. */
  announce(message: string): void {
    this.announcement.set(message);
    if (!this.isBrowser) return;
    this.ensureStyles();
    if (!this.liveEl || !this.doc.body.contains(this.liveEl)) {
      const el = this.doc.createElement('div');
      el.className = LIVE_CLASS;
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      this.doc.body.appendChild(el);
      this.liveEl = el;
    }
    this.liveEl.textContent = message;
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.active() || this.active()!.keyboard) return;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
    this.positionGhost(e.clientX, e.clientY);
    this.updateHoverAt(e.clientX, e.clientY);
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.active() || this.active()!.keyboard) return;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
    this.updateHoverAt(e.clientX, e.clientY);
    this.commit();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const session = this.active();
    if (!session) return;
    const key = uiLogicalKey(e);
    if (key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
      return;
    }
    if (!session.keyboard) return;

    if (key === 'ArrowDown' || key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      this.stepKeyboardTarget(1);
    } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      this.stepKeyboardTarget(-1);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      this.commit();
    }
  }

  private stepKeyboardTarget(delta: number): void {
    const session = this.active();
    if (!session) return;
    const valid = this.validTargetsFor(session.payload);
    this.keyboardTargets = valid;
    if (valid.length === 0) {
      this.cancel();
      return;
    }
    this.keyboardIndex = (this.keyboardIndex + delta + valid.length) % valid.length;
    this.setHovered(valid[this.keyboardIndex], true);
  }

  private updateHoverAt(x: number, y: number): void {
    const session = this.active();
    if (!session) return;
    const hit = this.hitTestTarget(x, y, session.payload);
    this.setHovered(hit, true);
  }

  private hitTestTarget(x: number, y: number, payload: unknown): UiDropTargetHandle<unknown> | null {
    let best: UiDropTargetHandle<unknown> | null = null;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const target of this.targets) {
      if (!target.isEnabled() || !target.canAccept(payload)) continue;
      const rect = target.element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const area = rect.width * rect.height;
        if (area <= bestArea) {
          bestArea = area;
          best = target;
        }
      }
    }
    return best;
  }

  private setHovered(target: UiDropTargetHandle<unknown> | null, announceChange: boolean): void {
    const prev = this.hoveredTarget();
    if (prev === target) return;
    prev?.setOver(false);
    this.hoveredTarget.set(target);
    target?.setOver(true);
    if (announceChange && target) {
      this.announce(`Over ${target.getLabel()}`);
    }
  }

  private createGhost(source: HTMLElement, rect: DOMRect): void {
    if (!this.isBrowser) return;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    clone.classList.remove('ui-drag-item--dragging');
    clone.classList.add('ui-drag-ghost');
    clone.setAttribute('aria-hidden', 'true');
    if (rect.width > 0) clone.style.width = `${rect.width}px`;
    if (rect.height > 0) clone.style.height = `${rect.height}px`;
    const reduced = this.isReducedMotion();
    if (reduced) {
      clone.classList.add('ui-drag-ghost--reduced');
    }
    this.doc.body.appendChild(clone);
    this.ghostEl = clone;
    if (!reduced) {
      const raf = this.doc.defaultView?.requestAnimationFrame;
      if (raf) {
        this.liftRaf = raf(() => {
          this.liftRaf = null;
          this.ghostEl?.classList.add('ui-drag-ghost--lifted');
        });
      } else {
        clone.classList.add('ui-drag-ghost--lifted');
      }
    }
  }

  private positionGhost(clientX: number, clientY: number): void {
    if (!this.ghostEl) return;
    this.ghostEl.style.left = `${clientX - this.grabX}px`;
    this.ghostEl.style.top = `${clientY - this.grabY}px`;
  }

  private removeGhost(): void {
    if (this.liftRaf != null) {
      this.doc.defaultView?.cancelAnimationFrame?.(this.liftRaf);
      this.liftRaf = null;
    }
    this.ghostEl?.remove();
    this.ghostEl = null;
  }

  private attachPointerListeners(): void {
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('pointermove', this.onPointerMoveBound, true);
      this.doc.addEventListener('pointerup', this.onPointerUpBound, true);
      this.doc.addEventListener('pointercancel', this.onPointerCancelBound, true);
      this.doc.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
      this.doc.addEventListener('keydown', this.onKeyDownBound, true);
    });
  }

  private detachListeners(): void {
    this.doc.removeEventListener('pointermove', this.onPointerMoveBound, true);
    this.doc.removeEventListener('pointerup', this.onPointerUpBound, true);
    this.doc.removeEventListener('pointercancel', this.onPointerCancelBound, true);
    this.doc.removeEventListener('touchmove', this.onTouchMoveBound);
    this.doc.removeEventListener('keydown', this.onKeyDownBound, true);
  }

  private startAutoScroll(): void {
    if (!this.isBrowser) return;
    const raf = this.doc.defaultView?.requestAnimationFrame;
    if (!raf) return;
    const step = () => {
      const session = this.active();
      if (!session || session.keyboard) {
        this.scrollRaf = null;
        return;
      }
      if (this.autoScrollStep(session.source.element, this.pointerX, this.pointerY)) {
        this.updateHoverAt(this.pointerX, this.pointerY);
      }
      this.scrollRaf = raf(step);
    };
    this.zone.runOutsideAngular(() => {
      this.scrollRaf = raf(step);
    });
  }

  private stopAutoScroll(): void {
    if (this.scrollRaf != null) {
      this.doc.defaultView?.cancelAnimationFrame?.(this.scrollRaf);
      this.scrollRaf = null;
    }
  }

  /** Scrolls the nearest scrollable ancestor when the pointer is within `UI_DRAG_EDGE_PX` of its edge. */
  autoScrollStep(sourceEl: HTMLElement, x: number, y: number): boolean {
    const container = this.findScrollContainer(sourceEl);
    if (!container) return false;
    const win = this.doc.defaultView;
    const isRoot = container === this.doc.scrollingElement || container === this.doc.documentElement || container === this.doc.body;
    const rect = isRoot
      ? { top: 0, bottom: win?.innerHeight ?? 0, left: 0, right: win?.innerWidth ?? 0 }
      : container.getBoundingClientRect();

    let dy = 0;
    let dx = 0;
    if (container.scrollHeight > container.clientHeight) {
      const topDist = y - rect.top;
      const bottomDist = rect.bottom - y;
      if (topDist >= 0 && topDist < UI_DRAG_EDGE_PX) {
        dy = -Math.ceil(((UI_DRAG_EDGE_PX - topDist) / UI_DRAG_EDGE_PX) * MAX_SCROLL_STEP);
      } else if (bottomDist >= 0 && bottomDist < UI_DRAG_EDGE_PX) {
        dy = Math.ceil(((UI_DRAG_EDGE_PX - bottomDist) / UI_DRAG_EDGE_PX) * MAX_SCROLL_STEP);
      }
    }
    if (container.scrollWidth > container.clientWidth) {
      const leftDist = x - rect.left;
      const rightDist = rect.right - x;
      if (leftDist >= 0 && leftDist < UI_DRAG_EDGE_PX) {
        dx = -Math.ceil(((UI_DRAG_EDGE_PX - leftDist) / UI_DRAG_EDGE_PX) * MAX_SCROLL_STEP);
      } else if (rightDist >= 0 && rightDist < UI_DRAG_EDGE_PX) {
        dx = Math.ceil(((UI_DRAG_EDGE_PX - rightDist) / UI_DRAG_EDGE_PX) * MAX_SCROLL_STEP);
      }
    }
    if (dx === 0 && dy === 0) return false;
    const prevTop = container.scrollTop;
    const prevLeft = container.scrollLeft;
    container.scrollTop += dy;
    container.scrollLeft += dx;
    return container.scrollTop !== prevTop || container.scrollLeft !== prevLeft;
  }

  private findScrollContainer(el: HTMLElement): HTMLElement | null {
    const win = this.doc.defaultView;
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== this.doc.body && node !== this.doc.documentElement) {
      const style = win?.getComputedStyle?.(node);
      const oy = style?.overflowY ?? '';
      const ox = style?.overflowX ?? '';
      const canY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && node.scrollHeight > node.clientHeight;
      const canX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && node.scrollWidth > node.clientWidth;
      if (canY || canX) return node;
      node = node.parentElement;
    }
    const root = this.doc.scrollingElement as HTMLElement | null;
    if (root && (root.scrollHeight > root.clientHeight || root.scrollWidth > root.clientWidth)) {
      return root;
    }
    return null;
  }

  private teardown(): void {
    const session = this.active();
    this.stopAutoScroll();
    this.detachListeners();
    this.removeGhost();
    this.setHovered(null, false);
    this.keyboardTargets = [];
    this.keyboardIndex = -1;
    session?.source.setDragging(false);
    this.active.set(null);
  }

  private ensureStyles(): void {
    if (!this.isBrowser) return;
    if (this.doc.getElementById(STYLE_ID)) return;
    const style = this.doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = UI_DRAG_STYLES;
    this.doc.head.appendChild(style);
  }
}
