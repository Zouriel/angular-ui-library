import { NgTemplateOutlet } from '@angular/common';
import { Component, input, model, output } from '@angular/core';

export interface UiSideNavItem {
  label: string;
  value: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
  /**
   * Where the item leads. With an href the item renders as a real `<a>`, so crawlers and
   * "open in new tab" can follow it. A plain click still emits `(navigate)` (and the browser's own
   * navigation is prevented) so the app can route with its router; a modified click (ctrl, cmd,
   * shift, middle button) is left to the browser.
   */
  href?: string;
}
export interface UiSideNavGroup {
  label?: string;
  items: UiSideNavItem[];
}

/**
 * `ui-side-nav` — vertical, grouped navigation rail (docs/app sidebar). Bind
 * `[(active)]` to the selected value and listen to `(navigate)`. Router-
 * agnostic: map the emitted item to a route yourself. Give items an `href` to render them as
 * links (crawlable, open-in-new-tab) while still routing through `(navigate)` on a plain click.
 */
@Component({
  selector: 'ui-side-nav',
  imports: [NgTemplateOutlet],
  template: `
    <nav class="ui-side-nav" [attr.aria-label]="label()">
      @for (group of groups(); track $index) {
        <div class="group">
          @if (group.label) { <div class="group-label">{{ group.label }}</div> }
          <ul role="list">
            @for (item of group.items; track item.value) {
              <li>
                @if (item.href != null) {
                  <a
                    class="item"
                    [attr.href]="item.disabled ? null : item.href"
                    [class.active]="item.value === active()"
                    [attr.aria-current]="item.value === active() ? 'page' : null"
                    [attr.aria-disabled]="item.disabled ? 'true' : null"
                    (click)="follow($event, item)">
                    <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: item }" />
                  </a>
                } @else {
                  <button
                    type="button"
                    class="item"
                    [class.active]="item.value === active()"
                    [attr.aria-current]="item.value === active() ? 'page' : null"
                    [disabled]="item.disabled"
                    (click)="choose(item)">
                    <ng-container [ngTemplateOutlet]="content" [ngTemplateOutletContext]="{ $implicit: item }" />
                  </button>
                }
              </li>
            }
          </ul>
        </div>
      }
    </nav>

    <ng-template #content let-item>
      @if (item.icon) { <span class="icon" aria-hidden="true">{{ item.icon }}</span> }
      <span class="label">{{ item.label }}</span>
      @if (item.badge != null) { <span class="badge">{{ item.badge }}</span> }
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .ui-side-nav { display: flex; flex-direction: column; gap: var(--ui-space-4); font-family: var(--ui-font-default); }
    .group { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .group-label { font-family: var(--ui-font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em;
      color: var(--ui-color-text-muted); padding: 0 var(--ui-space-2); margin-bottom: 2px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
    .item { position: relative; display: flex; align-items: center; gap: var(--ui-space-2); width: 100%;
      padding: var(--ui-space-1) var(--ui-space-3); background: none; border: none; border-radius: var(--ui-radius);
      color: var(--ui-color-text-muted); font: inherit; font-size: var(--ui-font-size-sm); text-align: left; text-decoration: none; cursor: pointer;
      box-sizing: border-box;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .item:hover:not(:disabled):not([aria-disabled='true']) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .item.active { background: color-mix(in srgb, var(--ui-color-primary) 16%, transparent); color: var(--ui-color-text); font-weight: 600; }
    .item.active:hover:not(:disabled):not([aria-disabled='true']) {
      /* Redeclared, not inherited — .item:hover:not(:disabled) above has higher specificity
         (one class + two pseudo-classes) than .item.active (two classes), so without this the
         generic hover background wins and the active highlight disappears on hover. */
      background: color-mix(in srgb, var(--ui-color-primary) 16%, transparent);
    }
    .item.active::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; border-radius: 2px; background: var(--ui-color-primary); }
    .item:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .item:disabled, .item[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; }
    .icon { width: 18px; text-align: center; }
    .label { flex: 1; min-width: 0; }
    .badge { font-size: 10px; font-family: var(--ui-font-mono); padding: 1px 6px; border-radius: 999px;
      background: var(--ui-color-surface-raised); color: var(--ui-color-text-muted); }
  `,
})
export class UiSideNav {
  groups = input<UiSideNavGroup[]>([]);
  active = model<string>('');
  label = input('Sidebar');
  navigate = output<UiSideNavItem>();

  protected choose(item: UiSideNavItem): void {
    if (item.disabled) return;
    this.active.set(item.value);
    this.navigate.emit(item);
  }

  /** A link item: route in-app on a plain primary click, leave anything else to the browser. */
  protected follow(event: MouseEvent, item: UiSideNavItem): void {
    if (item.disabled) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.choose(item);
  }
}
