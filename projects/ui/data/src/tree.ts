import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, inject, input, model, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';

export interface UiTreeNode {
  label: string;
  value: string;
  /** A HugeIcons icon (drawn in currentColor), or a short string such as a letter. */
  icon?: string | IconSvgObject;
  children?: UiTreeNode[];
}

/** `ui-tree` — expandable hierarchy with selection (recursive, WAI-ARIA tree). */
@Component({
  selector: 'ui-tree',
  imports: [NgTemplateOutlet, HugeiconsIconComponent],
  template: `
    <div class="tree" role="tree">
      @for (n of nodes(); track n.value) {
        <ng-container [ngTemplateOutlet]="node" [ngTemplateOutletContext]="{ $implicit: n, depth: 0 }" />
      }
    </div>
    <ng-template #node let-n let-depth="depth">
      <div class="row" role="treeitem" tabindex="0" [attr.aria-expanded]="n.children?.length ? expanded().has(n.value) : null"
           [attr.aria-selected]="n.value === selected()" [attr.aria-level]="depth + 1"
           [class.selected]="n.value === selected()" [style.padding-left]="'calc(var(--ui-space-2) + ' + depth * 16 + 'px)'" (click)="choose(n)"
           (keydown.enter)="choose(n); $event.preventDefault()" (keydown.space)="choose(n); $event.preventDefault()"
           (keydown.arrowright)="expand(n, true)" (keydown.arrowleft)="expand(n, false)"
           (keydown.arrowdown)="move($event, 1)" (keydown.arrowup)="move($event, -1)"
           (keydown.home)="move($event, 'first')" (keydown.end)="move($event, 'last')">
        @if (n.children?.length) {
          <button type="button" class="chev" tabindex="-1" [class.open]="expanded().has(n.value)" (click)="toggle(n, $event)"
                  [attr.aria-label]="(expanded().has(n.value) ? 'Collapse ' : 'Expand ') + n.label"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        } @else { <span class="chev spacer"></span> }
        @if (n.icon) {
          <span class="icon" aria-hidden="true">
            @if (isSvg(n.icon)) { <hugeicons-icon [icon]="n.icon" [size]="16" [strokeWidth]="1.8" /> } @else { {{ n.icon }} }
          </span>
        }
        <span class="label">{{ n.label }}</span>
      </div>
      @if (n.children?.length && expanded().has(n.value)) {
        @for (c of n.children; track c.value) {
          <ng-container [ngTemplateOutlet]="node" [ngTemplateOutletContext]="{ $implicit: c, depth: depth + 1 }" />
        }
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .tree { font-family: var(--ui-font-default); }
    .row { display: flex; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      cursor: pointer; border-radius: var(--ui-radius-xs); color: var(--ui-color-text); font-size: var(--ui-font-size-sm); line-height: 1.35; }
    .row:hover { background: var(--ui-color-surface-hover); }
    .row.selected { background: var(--ui-color-selected); }
    .row:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .chev { width: 16px; height: 16px; flex: none; display: inline-grid; place-items: center; padding: 0; border: none; background: none;
      color: var(--ui-color-text-muted); font: inherit; cursor: pointer;
      border-radius: var(--ui-radius-xs); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); transform: rotate(0deg); }
    .chev:hover { color: var(--ui-color-text); }
    .chev.open { transform: rotate(90deg); }
    .chev:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .chev.spacer { cursor: default; }
    .icon { flex: none; width: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; color: var(--ui-color-text-muted); }
    .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class UiTree {
  nodes = input<UiTreeNode[]>([]);
  selected = model<string | null>(null);
  nodeSelect = output<UiTreeNode>();
  protected readonly expanded = signal<Set<string>>(new Set());
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** A HugeIcons icon is an array of [tag, attributes] pairs; a text icon is a string. */
  protected isSvg(icon: string | IconSvgObject | undefined): icon is IconSvgObject {
    return Array.isArray(icon);
  }

  /** Arrow Up/Down step through the visible rows; Home/End jump to the first/last. */
  protected move(e: Event, step: number | 'first' | 'last'): void {
    e.preventDefault();
    const rows = [...this.host.nativeElement.querySelectorAll<HTMLElement>('.row')];
    const at = rows.indexOf(e.currentTarget as HTMLElement);
    const target = step === 'first' ? 0 : step === 'last' ? rows.length - 1 : at + step;
    const next = Math.max(0, Math.min(rows.length - 1, target));
    rows[next]?.focus();
  }

  protected toggle(n: UiTreeNode, e: Event): void {
    e.stopPropagation();
    const next = new Set(this.expanded());
    next.has(n.value) ? next.delete(n.value) : next.add(n.value);
    this.expanded.set(next);
  }
  protected expand(n: UiTreeNode, open: boolean): void {
    if (!n.children?.length || this.expanded().has(n.value) === open) return;
    const next = new Set(this.expanded());
    open ? next.add(n.value) : next.delete(n.value);
    this.expanded.set(next);
  }
  protected choose(n: UiTreeNode): void {
    this.selected.set(n.value);
    this.nodeSelect.emit(n);
  }
}
