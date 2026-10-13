import {
  Component, contentChildren, forwardRef, inject, input, signal,
} from '@angular/core';

let accSeq = 0;

/** `ui-accordion-item` — a titled, collapsible panel. Use inside `ui-accordion`. */
@Component({
  selector: 'ui-accordion-item',
  template: `
    <div class="item">
      <h3 class="head">
        <button
          type="button"
          class="trigger"
          [id]="btnId"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="panelId"
          (click)="toggle()">
          <span class="title">{{ title() }}</span>
          <span class="chevron" [class.open]="open()" aria-hidden="true"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
      </h3>
      <div class="panel" [class.open]="open()" role="region" [id]="panelId" [attr.aria-labelledby]="btnId" [attr.inert]="open() ? null : ''">
        <div class="panel-inner"><div class="pad"><ng-content /></div></div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; border-bottom: 1px solid var(--ui-color-border); }
    .head { margin: 0; }
    .trigger {
      display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3);
      width: 100%; min-height: var(--ui-size-lg); box-sizing: border-box;
      padding: var(--ui-space-2);
      background: none; border: none; cursor: pointer;
      font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); font-weight: 500; line-height: 1.35;
      color: var(--ui-color-text); text-align: left;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    @media (pointer: coarse) { .trigger { min-height: var(--ui-size-touch); } }
    .trigger:hover { background: var(--ui-color-surface-hover); }
    /* Full-width row: an inset ring, so neighbours and the item borders don't cover it. */
    .trigger:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); border-radius: var(--ui-radius-xs); }
    .title { min-width: 0; overflow-wrap: anywhere; }
    .chevron { flex: none; display: inline-flex; transition: transform var(--ui-motion-base) var(--ui-ease-standard); color: var(--ui-color-text-muted); }
    .chevron.open { transform: rotate(180deg); }
    .panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--ui-motion-base) var(--ui-ease-standard); }
    .panel.open { grid-template-rows: 1fr; }
    .panel-inner { overflow: hidden; }
    .pad { padding: 0 var(--ui-space-2) var(--ui-space-3); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); line-height: 1.45; }
  `,
})
export class UiAccordionItem {
  private parent = inject(forwardRef(() => UiAccordion), { optional: true });
  title = input.required<string>();
  readonly open = signal(false);
  private readonly seq = accSeq++;
  readonly btnId = `ui-acc-btn-${this.seq}`;
  readonly panelId = `ui-acc-panel-${this.seq}`;

  protected toggle(): void {
    if (this.parent) this.parent.toggle(this);
    else this.open.update((v) => !v);
  }
}

/** `ui-accordion` — groups `ui-accordion-item`s. Single-open unless `multiple`. */
@Component({
  selector: 'ui-accordion',
  template: `<div class="ui-accordion"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ui-accordion { border-top: 1px solid var(--ui-color-border); }
  `,
})
export class UiAccordion {
  multiple = input(false);
  readonly items = contentChildren(UiAccordionItem);

  toggle(item: UiAccordionItem): void {
    const willOpen = !item.open();
    if (willOpen && !this.multiple()) {
      for (const other of this.items()) if (other !== item) other.open.set(false);
    }
    item.open.set(willOpen);
  }
}
