import { Component, input, model } from '@angular/core';

let panelSeq = 0;

/**
 * `ui-panel-section` — a compact, collapsible titled group for inspector and settings panels. Unlike
 * an accordion it's built for controls: dense spacing, full-contrast content, and a slot for actions
 * in the header (`[panel-actions]`), such as an Add button.
 */
@Component({
  selector: 'ui-panel-section',
  host: { class: 'ui-panel-section', '[class.open]': 'open()' },
  template: `
    <div class="head">
      <button type="button" class="toggle" [attr.aria-expanded]="open()" [attr.aria-controls]="bodyId" (click)="collapsible() && open.set(!open())"
        [class.static]="!collapsible()">
        @if (collapsible()) {
          <svg class="chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        }
        <span class="title">{{ title() }}</span>
        @if (badge()) { <span class="badge">{{ badge() }}</span> }
      </button>
      <div class="actions"><ng-content select="[panel-actions]" /></div>
    </div>
    @if (open() || !collapsible()) {
      <div class="body" [id]="bodyId" role="group" [attr.aria-label]="title()"><ng-content /></div>
    }
  `,
  styles: `
    :host { display: block; border-bottom: 1px solid var(--ui-color-border); }
    .head { display: flex; align-items: center; gap: var(--ui-space-2); min-height: 38px; padding: 0 var(--ui-space-2) 0 0; }
    .toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 var(--ui-space-3);
      border: 0; background: none; color: var(--ui-color-text); font: 600 12px/1 var(--ui-font-default); letter-spacing: .04em;
      text-transform: uppercase; cursor: pointer; text-align: left; }
    .toggle.static { cursor: default; }
    .toggle:focus-visible { outline: none; box-shadow: inset var(--ui-focus-ring); }
    .chev { flex: none; color: var(--ui-color-text-muted); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    :host(.open) .chev { transform: rotate(90deg); }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { flex: none; padding: 1px 6px; border-radius: var(--ui-radius-pill); background: var(--ui-color-surface-subtle);
      color: var(--ui-color-text-muted); font-size: 10.5px; letter-spacing: 0; text-transform: none; font-weight: 500; }
    .actions { display: flex; align-items: center; gap: 4px; }
    .body { display: grid; gap: var(--ui-space-2); padding: 2px var(--ui-space-3) var(--ui-space-3); }
  `,
})
export class UiPanelSection {
  title = input.required<string>();
  open = model(true);
  collapsible = input(true);
  badge = input<string | number | null>(null);
  protected readonly bodyId = `ui-panel-section-${++panelSeq}`;
}
