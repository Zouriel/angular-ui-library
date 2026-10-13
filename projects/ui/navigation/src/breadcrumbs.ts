import { Component, input, output } from '@angular/core';

export interface UiBreadcrumb {
  label: string;
  href?: string;
  value?: string;
}

/** `ui-breadcrumbs` — hierarchical trail. Emits `(navigate)` for items without href. */
@Component({
  selector: 'ui-breadcrumbs',
  template: `
    <nav class="ui-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        @for (item of items(); track $index; let last = $last) {
          <li>
            @if (last) {
              <span class="crumb current" aria-current="page">{{ item.label }}</span>
            } @else if (item.href) {
              <a class="crumb" [href]="item.href">{{ item.label }}</a>
            } @else {
              <button type="button" class="crumb link" (click)="navigate.emit(item)">{{ item.label }}</button>
            }
            @if (!last) { <span class="sep" aria-hidden="true">{{ separator() }}</span> }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    :host { display: block; }
    ol { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-1); margin: 0; padding: 0; list-style: none; }
    li { display: inline-flex; align-items: center; gap: var(--ui-space-1); }
    .crumb { display: inline-block; max-width: 24ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom;
      font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35; color: var(--ui-color-text-muted); text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; }
    a.crumb:hover, .crumb.link:hover { color: var(--ui-color-text); text-decoration: underline; }
    .crumb.current { color: var(--ui-color-text); font-weight: 500; cursor: default; }
    .crumb:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    .sep { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class UiBreadcrumbs {
  items = input<UiBreadcrumb[]>([]);
  separator = input('/');
  navigate = output<UiBreadcrumb>();
}
