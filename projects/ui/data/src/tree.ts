import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, input, model, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import { uiLogicalKey } from '@zouriel/ui';

export interface UiTreeNode {
  label: string;
  value: string;
  /** A HugeIcons icon (drawn in currentColor), or a short string such as a letter. */
  icon?: string | IconSvgObject;
  children?: UiTreeNode[];
}

interface NodeInfo { node: UiTreeNode; parent: string | null; }

/**
 * `ui-tree` — expandable hierarchy with single selection, following the WAI-ARIA
 * tree view pattern: one tab stop (roving tabindex), arrow-key navigation,
 * nested `role="group"` containers and type-ahead by first letter.
 */
@Component({
  selector: 'ui-tree',
  imports: [NgTemplateOutlet, HugeiconsIconComponent],
  template: `
    <div class="tree" role="tree" [attr.aria-label]="label() || null" (keydown)="onKey($event)" (focusin)="onFocusIn($event)">
      <ng-container [ngTemplateOutlet]="level" [ngTemplateOutletContext]="{ $implicit: nodes(), depth: 0 }" />
    </div>
    <ng-template #level let-list let-depth="depth">
      @for (n of list; track n.value; let i = $index, count = $count) {
        <div class="item" role="treeitem" [attr.data-value]="n.value" [attr.tabindex]="n.value === tabStop() ? 0 : -1"
             [attr.aria-label]="n.label" [attr.aria-level]="depth + 1" [attr.aria-setsize]="count" [attr.aria-posinset]="i + 1"
             [attr.aria-expanded]="hasKids(n) ? isOpen(n) : null" [attr.aria-selected]="n.value === selected()">
          <div class="row" [class.selected]="n.value === selected()"
               [style.padding-inline-start]="'calc(var(--ui-space-2) + ' + depth * 16 + 'px)'" (click)="choose(n)">
            @if (hasKids(n)) {
              <span class="chev" aria-hidden="true" [class.open]="isOpen(n)" (click)="toggle(n, $event)"><svg viewBox="0 0 12 12" width="12" height="12"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            } @else { <span class="chev spacer" aria-hidden="true"></span> }
            @if (n.icon) {
              <span class="icon" aria-hidden="true">
                @if (isSvg(n.icon)) { <hugeicons-icon [icon]="n.icon" [size]="16" [strokeWidth]="1.8" /> } @else { {{ n.icon }} }
              </span>
            }
            <span class="label">{{ n.label }}</span>
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
    .row { display: flex; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      cursor: pointer; border-radius: var(--ui-radius-xs); color: var(--ui-color-text); font-size: var(--ui-font-size-sm); line-height: 1.35; }
    .row:hover { background: var(--ui-color-surface-hover); }
    .row.selected { background: var(--ui-color-selected); }
    .item:focus-visible > .row { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
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
  `,
})
export class UiTree {
  nodes = input<UiTreeNode[]>([]);
  selected = model<string | null>(null);
  /** Accessible name for the tree (`aria-label`). */
  label = input('');
  nodeSelect = output<UiTreeNode>();
  protected readonly expanded = signal<Set<string>>(new Set());
  /** The item that last had focus; it keeps the single tab stop while it is visible. */
  private readonly active = signal<string | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
    const open = this.expanded();
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
    return this.expanded().has(n.value);
  }

  protected onFocusIn(e: FocusEvent): void {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    if (item?.dataset['value'] !== undefined) this.active.set(item.dataset['value']);
  }

  protected onKey(e: KeyboardEvent): void {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    const value = item?.dataset['value'];
    const info = value === undefined ? undefined : this.index().get(value);
    if (!info || value === undefined) return;
    const n = info.node;
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
      case ' ':
        this.choose(n);
        break;
      case '*': {
        const siblings = info.parent === null ? this.nodes() : this.index().get(info.parent)!.node.children!;
        const next = new Set(this.expanded());
        for (const s of siblings) if (s.children?.length) next.add(s.value);
        this.expanded.set(next);
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
    const next = new Set(this.expanded());
    open ? next.add(n.value) : next.delete(n.value);
    this.expanded.set(next);
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

  protected choose(n: UiTreeNode): void {
    this.selected.set(n.value);
    this.nodeSelect.emit(n);
  }
}
