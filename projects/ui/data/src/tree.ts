import { NgTemplateOutlet } from '@angular/common';
import {
  Component, Directive, ElementRef, Injector, OnDestroy, TemplateRef, afterNextRender, computed, contentChild, inject, input, model, output, signal,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import { uiLogicalKey } from '@zouriel/ui';

export interface UiTreeNode {
  label: string;
  value: string;
  /** A HugeIcons icon (drawn in currentColor), or a short string such as a letter. */
  icon?: string | IconSvgObject;
  children?: UiTreeNode[];
  /** Draw the label dimmed (a hidden layer, an archived item). It can still be selected. */
  muted?: boolean;
  /** Can take dropped children while reordering, even with none yet (an empty group). */
  container?: boolean;
}

/** Move node `value` so it ends up as child number `index` of `parent` (null = top level). `index`
 *  counts the list after the node has been taken out of its old place. */
export interface UiTreeMove {
  value: string;
  parent: string | null;
  index: number;
}

export interface UiTreeNodeEndContext {
  $implicit: UiTreeNode;
}

/**
 * Put on an `<ng-template>` inside ui-tree to draw something at the end of every row (eye and lock
 * buttons in a layers panel, a count): `<ng-template uiTreeNodeEnd let-node>…</ng-template>`.
 * Clicks, double clicks and keys inside it stay there: they don't select, open or drag the row.
 */
@Directive({ selector: 'ng-template[uiTreeNodeEnd]' })
export class UiTreeNodeEnd {
  readonly template = inject<TemplateRef<UiTreeNodeEndContext>>(TemplateRef);
  static ngTemplateContextGuard(_d: UiTreeNodeEnd, ctx: unknown): ctx is UiTreeNodeEndContext {
    return true;
  }
}

interface NodeInfo { node: UiTreeNode; parent: string | null; }
type DropPos = 'before' | 'after' | 'inside' | 'first';
interface Drop { value: string; pos: DropPos; move: UiTreeMove; }

/**
 * `ui-tree` — expandable hierarchy following the WAI-ARIA tree view pattern: one tab stop (roving
 * tabindex), arrow-key navigation, nested `role="group"` containers and type-ahead by first letter.
 *
 * Single selection by default. With `multiple`, `selectedValues` is the selection: a click selects
 * only that node, Ctrl/Cmd-click toggles it, Shift-click selects the visible range from the last
 * clicked node, and Space toggles the focused node; `selected` still follows the last clicked node.
 *
 * With `reorderable`, rows can be dragged with a mouse or pen (after a 4px move, so clicks still
 * select) and moved with Alt+Up/Down among their siblings. The tree never changes `nodes` itself:
 * it emits `nodeMove` and the consumer moves the node.
 */
@Component({
  selector: 'ui-tree',
  imports: [NgTemplateOutlet, HugeiconsIconComponent],
  template: `
    <div class="tree" role="tree" [attr.aria-label]="label() || null" [attr.aria-multiselectable]="multiple() || null"
         [class.plain]="multiple() || reorderable()" [class.is-dragging]="dragging() !== null"
         (keydown)="onKey($event)" (focusin)="onFocusIn($event)"
         (pointermove)="onPointerMove($event)" (pointerup)="onPointerUp($event)" (pointercancel)="endDrag()" (lostpointercapture)="endDrag()">
      <ng-container [ngTemplateOutlet]="level" [ngTemplateOutletContext]="{ $implicit: nodes(), depth: 0 }" />
    </div>
    <ng-template #level let-list let-depth="depth">
      @for (n of list; track n.value; let i = $index, count = $count) {
        <div class="item" role="treeitem" [attr.data-value]="n.value" [attr.tabindex]="n.value === tabStop() ? 0 : -1"
             [attr.aria-label]="n.label" [attr.aria-level]="depth + 1" [attr.aria-setsize]="count" [attr.aria-posinset]="i + 1"
             [attr.aria-expanded]="hasKids(n) ? isOpen(n) : null" [attr.aria-selected]="isSel(n)">
          <div class="row" [class.selected]="isSel(n)" [class.muted]="!!n.muted" [class.dragging]="dragging() === n.value"
               [class]="dropClass(n.value)"
               [style.--ui-tree-indent]="'calc(var(--ui-space-2) + ' + depth * 16 + 'px)'"
               [style.padding-inline-start]="'calc(var(--ui-space-2) + ' + depth * 16 + 'px)'"
               (click)="onRowClick(n, $event)" (pointerdown)="onPointerDown(n, $event)">
            @if (hasKids(n)) {
              <span class="chev" aria-hidden="true" [class.open]="isOpen(n)" (click)="toggle(n, $event)"><svg viewBox="0 0 12 12" width="12" height="12"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            } @else { <span class="chev spacer" aria-hidden="true"></span> }
            @if (n.icon) {
              <span class="icon" aria-hidden="true">
                @if (isSvg(n.icon)) { <hugeicons-icon [icon]="n.icon" [size]="16" [strokeWidth]="1.8" /> } @else { {{ n.icon }} }
              </span>
            }
            <span class="label" (dblclick)="activate(n)">{{ n.label }}</span>
            @if (endTpl(); as end) {
              <span class="end" (click)="$event.stopPropagation()" (dblclick)="$event.stopPropagation()" (pointerdown)="$event.stopPropagation()">
                <ng-container [ngTemplateOutlet]="end.template" [ngTemplateOutletContext]="{ $implicit: n }" />
              </span>
            }
          </div>
          @if (hasKids(n) && isOpen(n)) {
            <div role="group">
              <ng-container [ngTemplateOutlet]="level" [ngTemplateOutletContext]="{ $implicit: n.children, depth: depth + 1 }" />
            </div>
          }
        </div>
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .tree { font-family: var(--ui-font-default); }
    .item { outline: none; }
    .row { position: relative; display: flex; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      cursor: pointer; border-radius: var(--ui-radius-xs); color: var(--ui-color-text); font-size: var(--ui-font-size-sm); line-height: 1.35; }
    .row:hover { background: var(--ui-color-surface-hover); }
    .row.selected { background: var(--ui-color-selected); }
    .row.muted .label { color: var(--ui-color-text-muted); }
    .item:focus-visible > .row { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    /* Shift-click and dragging shouldn't select the labels' text. */
    .tree.plain .row { user-select: none; -webkit-user-select: none; }
    .tree.is-dragging, .tree.is-dragging .row { cursor: grabbing; }
    .row.dragging { opacity: 0.5; }
    /* Where a dragged row would land: a line between rows, or the target outlined to drop into it. */
    .row.drop-before::before, .row.drop-after::after, .row.drop-first::after { content: ''; position: absolute; inset-inline: var(--ui-tree-indent) 0;
      height: 2px; border-radius: 1px; background: var(--ui-color-border-focus); pointer-events: none; }
    .row.drop-before::before { top: -1px; }
    .row.drop-after::after, .row.drop-first::after { bottom: -1px; }
    .row.drop-first::after { inset-inline-start: calc(var(--ui-tree-indent) + 16px); }
    .row.drop-inside { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    /* A 24px hit box (WCAG 2.5.8) that draws like the old 16px one: the negative margins give the
       extra 8px back to the row's padding, so the row neither grows nor shifts. */
    .chev { width: 24px; height: 24px; margin: calc(var(--ui-space-1) * -1); flex: none; display: inline-grid; place-items: center;
      color: var(--ui-color-text-muted); cursor: pointer;
      border-radius: var(--ui-radius-xs); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); transform: rotate(0deg); }
    .chev:hover { color: var(--ui-color-text); }
    .chev.open { transform: rotate(90deg); }
    /* Closed, the chevron points into the row: left in RTL; open it points down either way. */
    .chev:dir(rtl) { transform: scaleX(-1); }
    .chev.open:dir(rtl) { transform: rotate(90deg); }
    .chev.spacer { cursor: inherit; }
    .icon { flex: none; width: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: calc(14px * var(--ui-font-scale)); color: var(--ui-color-text-muted); }
    .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .end { flex: none; display: inline-flex; align-items: center; gap: var(--ui-space-1); margin-block: calc(var(--ui-space-1) * -1); cursor: default; }
  `,
})
export class UiTree implements OnDestroy {
  nodes = input<UiTreeNode[]>([]);
  /** The selected node; with `multiple`, the last clicked one. */
  selected = model<string | null>(null);
  /** Accessible name for the tree (`aria-label`). */
  label = input('');
  /** Select several nodes; the selection is then `selectedValues`. */
  multiple = input(false);
  /** The selection when `multiple` is on, in tree order. */
  selectedValues = model<string[]>([]);
  /** Values of the open nodes. Bind it to open a selected node's ancestors; unbound, the tree keeps it. */
  expanded = model<string[]>([]);
  /** Drag rows (mouse, pen) and Alt+Up/Down to move them; the tree emits `nodeMove`. */
  reorderable = input(false);
  nodeSelect = output<UiTreeNode>();
  /** A reorder the user asked for; apply it to `nodes`. */
  nodeMove = output<UiTreeMove>();
  /** Double click on a label, or F2: e.g. start renaming the node. */
  nodeActivate = output<UiTreeNode>();

  protected readonly endTpl = contentChild(UiTreeNodeEnd);
  /** The item that last had focus; it keeps the single tab stop while it is visible. */
  private readonly active = signal<string | null>(null);
  /** Where a Shift-click range starts: the last node clicked (or toggled) without Shift. */
  private anchor: string | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly openSet = computed(() => new Set(this.expanded()));
  private readonly selSet = computed(() => new Set(this.selectedValues()));

  /** Every node by value, with its parent's value. */
  private readonly index = computed(() => {
    const map = new Map<string, NodeInfo>();
    const walk = (list: UiTreeNode[], parent: string | null) => {
      for (const node of list) {
        map.set(node.value, { node, parent });
        if (node.children?.length) walk(node.children, node.value);
      }
    };
    walk(this.nodes(), null);
    return map;
  });

  /** Values of the rows on screen, top to bottom. */
  private readonly visible = computed(() => {
    const out: string[] = [];
    const open = this.openSet();
    const walk = (list: UiTreeNode[]) => {
      for (const node of list) {
        out.push(node.value);
        if (node.children?.length && open.has(node.value)) walk(node.children);
      }
    };
    walk(this.nodes());
    return out;
  });

  /** The one item with tabindex=0: the last focused, else the selected, else the first visible item. */
  protected readonly tabStop = computed(() => {
    const vis = this.visible();
    const active = this.active();
    if (active !== null && vis.includes(active)) return active;
    const sel = this.selected();
    if (sel !== null && vis.includes(sel)) return sel;
    return vis[0] ?? null;
  });

  /** A HugeIcons icon is an array of [tag, attributes] pairs; a text icon is a string. */
  protected isSvg(icon: string | IconSvgObject | undefined): icon is IconSvgObject {
    return Array.isArray(icon);
  }
  protected hasKids(n: UiTreeNode): boolean {
    return !!n.children?.length;
  }
  protected isOpen(n: UiTreeNode): boolean {
    return this.openSet().has(n.value);
  }
  protected isSel(n: UiTreeNode): boolean {
    return this.multiple() ? this.selSet().has(n.value) : n.value === this.selected();
  }

  protected onFocusIn(e: FocusEvent): void {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    if (item?.dataset['value'] !== undefined) this.active.set(item.dataset['value']);
  }

  protected onKey(e: KeyboardEvent): void {
    // Keys pressed on controls in the row's end slot belong to those controls.
    if ((e.target as HTMLElement).closest('.end')) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    const value = item?.dataset['value'];
    const info = value === undefined ? undefined : this.index().get(value);
    if (!info || value === undefined) return;
    const n = info.node;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.reorderable()) {
      e.preventDefault();
      this.moveBy(value, info, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    const vis = this.visible();
    const at = vis.indexOf(value);
    let handled = true;
    // ArrowRight opens and ArrowLeft closes in LTR; mirrored in RTL.
    switch (uiLogicalKey(e)) {
      case 'ArrowDown': this.focusValue(vis[Math.min(vis.length - 1, at + 1)]); break;
      case 'ArrowUp': this.focusValue(vis[Math.max(0, at - 1)]); break;
      case 'Home': this.focusValue(vis[0]); break;
      case 'End': this.focusValue(vis[vis.length - 1]); break;
      case 'ArrowRight':
        if (this.hasKids(n)) this.isOpen(n) ? this.focusValue(n.children![0].value) : this.setOpen(n, true);
        break;
      case 'ArrowLeft':
        if (this.hasKids(n) && this.isOpen(n)) this.setOpen(n, false);
        else if (info.parent !== null) this.focusValue(info.parent);
        break;
      case 'Enter':
        this.multiple() ? this.selectOnly(n) : this.choose(n);
        break;
      case ' ':
        this.multiple() ? this.toggleSel(n) : this.choose(n);
        break;
      case 'F2':
        this.nodeActivate.emit(n);
        break;
      case '*': {
        const next = new Set(this.expanded());
        for (const s of this.siblings(info.parent)) if (s.children?.length) next.add(s.value);
        this.expanded.set([...next]);
        break;
      }
      default:
        handled = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && this.typeAhead(e.key, at);
    }
    if (handled) e.preventDefault();
  }

  /** Focus the next visible item (after `from`, wrapping) whose label starts with `ch`. */
  private typeAhead(ch: string, from: number): boolean {
    const vis = this.visible();
    const want = ch.toLocaleLowerCase();
    if (!want.trim()) return false;
    for (let k = 1; k <= vis.length; k++) {
      const v = vis[(from + k) % vis.length];
      if (this.index().get(v)?.node.label.toLocaleLowerCase().startsWith(want)) {
        this.focusValue(v);
        return true;
      }
    }
    return false;
  }

  private focusValue(value: string | undefined): void {
    if (value === undefined) return;
    this.active.set(value);
    const items = this.host.nativeElement.querySelectorAll<HTMLElement>('[role="treeitem"]');
    for (const el of items) if (el.dataset['value'] === value) { el.focus(); return; }
  }

  private setOpen(n: UiTreeNode, open: boolean): void {
    if (!this.hasKids(n) || this.isOpen(n) === open) return;
    const next = this.expanded().filter((v) => v !== n.value);
    if (open) next.push(n.value);
    this.expanded.set(next);
  }

  private siblings(parent: string | null): UiTreeNode[] {
    return parent === null ? this.nodes() : (this.index().get(parent)?.node.children ?? []);
  }

  /** True when `value` sits somewhere below `ancestor`. */
  private isInside(value: string, ancestor: string): boolean {
    let p = this.index().get(value)?.parent ?? null;
    while (p !== null) {
      if (p === ancestor) return true;
      p = this.index().get(p)?.parent ?? null;
    }
    return false;
  }

  protected toggle(n: UiTreeNode, e: Event): void {
    e.stopPropagation();
    const closing = this.isOpen(n);
    const active = this.active();
    // Collapsing over the focused item would drop focus to <body>; move it to the collapsed parent.
    if (closing && active !== null && this.isInside(active, n.value)) {
      const hadFocus = this.host.nativeElement.contains(document.activeElement);
      this.active.set(n.value);
      if (hadFocus) this.focusValue(n.value);
    }
    this.setOpen(n, !closing);
  }

  // ── Selection ───────────────────────────────────────────────────────────────────────────

  protected onRowClick(n: UiTreeNode, e: MouseEvent): void {
    if (this.suppressClick) return;
    if (!this.multiple()) return this.choose(n);
    if (e.shiftKey) this.selectRange(n, e.ctrlKey || e.metaKey);
    else if (e.ctrlKey || e.metaKey) this.toggleSel(n);
    else this.selectOnly(n);
  }

  protected choose(n: UiTreeNode): void {
    this.selected.set(n.value);
    this.nodeSelect.emit(n);
  }

  /** `values` sorted into the order the nodes appear in the tree. */
  private inTreeOrder(values: Iterable<string>): string[] {
    const order = [...this.index().keys()];
    const want = new Set(values);
    return order.filter((v) => want.has(v));
  }

  private selectOnly(n: UiTreeNode): void {
    this.anchor = n.value;
    this.selectedValues.set([n.value]);
    this.choose(n);
  }

  private toggleSel(n: UiTreeNode): void {
    this.anchor = n.value;
    const next = new Set(this.selectedValues());
    next.has(n.value) ? next.delete(n.value) : next.add(n.value);
    this.selectedValues.set(this.inTreeOrder(next));
    this.choose(n);
  }

  private selectRange(n: UiTreeNode, add: boolean): void {
    const vis = this.visible();
    const from = vis.indexOf(this.anchor ?? this.selected() ?? n.value);
    const to = vis.indexOf(n.value);
    const range = from < 0 ? [n.value] : vis.slice(Math.min(from, to), Math.max(from, to) + 1);
    this.selectedValues.set(this.inTreeOrder(add ? [...this.selectedValues(), ...range] : range));
    this.choose(n);
  }

  protected activate(n: UiTreeNode): void {
    this.nodeActivate.emit(n);
  }

  // ── Reordering ──────────────────────────────────────────────────────────────────────────

  private drag: { value: string; x: number; y: number; id: number; el: HTMLElement; on: boolean } | null = null;
  protected readonly dragging = signal<string | null>(null);
  protected readonly drop = signal<Drop | null>(null);
  private suppressClick = false;
  private readonly onDragKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    this.endDrag();
  };

  protected dropClass(value: string): string {
    const d = this.drop();
    return d?.value === value ? `drop-${d.pos}` : '';
  }

  protected onPointerDown(n: UiTreeNode, e: PointerEvent): void {
    // Touch keeps scrolling the list; mouse and pen drag.
    if (!this.reorderable() || e.button !== 0 || e.pointerType === 'touch') return;
    if ((e.target as HTMLElement).closest('.chev')) return;
    this.drag = { value: n.value, x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget as HTMLElement, on: false };
  }

  protected onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
      d.on = true;
      try { d.el.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
      this.dragging.set(d.value);
      document.addEventListener('keydown', this.onDragKey, true);
    }
    e.preventDefault();
    this.drop.set(this.dropAt(e.clientX, e.clientY, d.value));
  }

  protected onPointerUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const target = this.drop();
    this.endDrag();
    if (!d.on) return;
    // The click that follows this pointerup ends the drag; it must not also select.
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false));
    if (target) this.nodeMove.emit(target.move);
  }

  protected endDrag(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.on) {
      try { d.el.releasePointerCapture(d.id); } catch { /* not captured */ }
      document.removeEventListener('keydown', this.onDragKey, true);
    }
    this.dragging.set(null);
    this.drop.set(null);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.onDragKey, true);
  }

  /** Where `dragged` would land with the pointer at (x, y), or null when it can't go there. */
  private dropAt(x: number, y: number, dragged: string): Drop | null {
    const row = document.elementFromPoint?.(x, y)?.closest<HTMLElement>('.row');
    if (!row || !this.host.nativeElement.contains(row)) return null;
    const value = row.closest<HTMLElement>('[role="treeitem"]')?.dataset['value'];
    const info = value === undefined ? undefined : this.index().get(value);
    // Never into itself or its own descendants.
    if (!info || value === undefined || value === dragged || this.isInside(value, dragged)) return null;
    const n = info.node;
    const box = row.getBoundingClientRect();
    const rel = box.height ? (y - box.top) / box.height : 0.5;
    const canHold = this.hasKids(n) || !!n.container;
    let pos: DropPos = canHold ? (rel < 0.25 ? 'before' : rel > 0.75 ? 'after' : 'inside') : rel < 0.5 ? 'before' : 'after';
    // Just below an open parent the line sits above its first child, so that's where it goes.
    if (pos === 'after' && this.hasKids(n) && this.isOpen(n)) pos = 'first';
    const move = this.moveFor(dragged, value, pos);
    return move ? { value, pos, move } : null;
  }

  /** The move that puts `dragged` at `pos` relative to `target`; null when it would stay put. */
  private moveFor(dragged: string, target: string, pos: DropPos): UiTreeMove | null {
    const idx = this.index();
    const info = idx.get(target)!;
    let parent: string | null;
    let index: number;
    if (pos === 'inside' || pos === 'first') {
      parent = target;
      const kids = (info.node.children ?? []).filter((c) => c.value !== dragged);
      index = pos === 'first' ? 0 : kids.length;
    } else {
      parent = info.parent;
      const list = this.siblings(parent).filter((c) => c.value !== dragged);
      index = list.findIndex((c) => c.value === target) + (pos === 'after' ? 1 : 0);
    }
    const from = idx.get(dragged)!.parent;
    if (from === parent && this.siblings(from).findIndex((c) => c.value === dragged) === index) return null;
    return { value: dragged, parent, index };
  }

  /** Alt+Up/Down: one place among the node's siblings, keeping focus on it. */
  private moveBy(value: string, info: NodeInfo, dir: -1 | 1): void {
    const list = this.siblings(info.parent);
    const to = list.findIndex((c) => c.value === value) + dir;
    if (to < 0 || to >= list.length) return;
    this.nodeMove.emit({ value, parent: info.parent, index: to });
    // Moving the element in the DOM drops its focus; put it back once the new order has rendered.
    afterNextRender(() => this.focusValue(value), { injector: this.injector });
  }
}
