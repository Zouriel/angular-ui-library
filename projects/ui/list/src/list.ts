import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';

/** `ui-list` — semantic list container. Project `ui-list-item` children. */
@Component({
  selector: 'ui-list',
  template: `<div class="ui-list" [class.bordered]="bordered()" role="list"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ui-list { display: flex; flex-direction: column; font-family: var(--ui-font-default); line-height: 1.35; }
    .ui-list.bordered { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .ui-list.bordered ::ng-deep ui-list-item:not(:last-child) .ui-list-item { border-bottom: 1px solid var(--ui-color-border); }
  `,
})
export class UiList {
  bordered = input(false);
}

/** `ui-list-item` — a row in `ui-list`. Optional `[item-leading]` / `[item-trailing]` slots. */
@Component({
  selector: 'ui-list-item',
  // The host is the list item; the inner element keeps its own role (a button stays a button).
  host: { role: 'listitem' },
  imports: [NgTemplateOutlet],
  template: `
    @if (interactive()) {
      <button
        type="button"
        class="ui-list-item interactive"
        [class.selected]="selected()"
        [disabled]="disabled()"
        (click)="activate.emit()">
        <ng-container [ngTemplateOutlet]="body" />
      </button>
    } @else {
      <div class="ui-list-item">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    }
    <!-- Single set of projection slots, stamped into whichever wrapper is active. -->
    <ng-template #body>
      <span class="lead"><ng-content select="[item-leading]" /></span>
      <span class="main"><ng-content /></span>
      <span class="trail"><ng-content select="[item-trailing]" /></span>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .ui-list-item {
      display: flex; align-items: center; gap: var(--ui-space-3); width: 100%;
      padding: var(--ui-space-2) var(--ui-space-4); box-sizing: border-box;
      color: var(--ui-color-text); font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.35;
      text-align: left; background: transparent;
    }
    .ui-list-item.interactive {
      border: none; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    @media (pointer: coarse) { .ui-list-item.interactive { min-height: var(--ui-size-touch); } }
    .ui-list-item.interactive:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    /* Full-width row (and clipped by a bordered list), so the ring sits inside. */
    .ui-list-item.interactive:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .ui-list-item.selected { background: var(--ui-color-selected); }
    /* Redeclared, not inherited — .ui-list-item.interactive:hover:not(:disabled) above has higher
       specificity than the bare .ui-list-item.selected rule (two classes + :hover + :not() vs. two
       classes), so without this the plain hover tint wins and a selected row loses its selected
       look the moment it's hovered. [class.selected] is only ever applied alongside .interactive
       in the template, so this combination is the common case, not an edge case. */
    .ui-list-item.interactive.selected:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-selected), var(--ui-color-surface-hover)); }
    .ui-list-item:disabled { opacity: .5; cursor: not-allowed; }
    .lead:empty, .trail:empty { display: none; }
    .main { flex: 1; min-width: 0; }
    .trail { flex: none; color: var(--ui-color-text-muted); }
    .lead { flex: none; display: inline-flex; }
  `,
})
export class UiListItem {
  interactive = input(false);
  selected = input(false);
  disabled = input(false);
  activate = output<void>();
}
