import { Component, input } from '@angular/core';

/** `ui-button-group` — visually joins a row of `ui-button`s into a segmented control. */
@Component({
  selector: 'ui-button-group',
  template: `<div class="ui-btn-group" role="group" [attr.aria-label]="label()"><ng-content /></div>`,
  styles: `
    :host { display: inline-flex; }
    .ui-btn-group { display: inline-flex; }
    .ui-btn-group ::ng-deep ui-button:not(:first-child) .ui-btn { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px; }
    .ui-btn-group ::ng-deep ui-button:not(:last-child) .ui-btn { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .ui-btn-group ::ng-deep ui-button .ui-btn:hover { z-index: 1; }
    /* Above both neighbours so the -1px overlap doesn't cut the focus ring. */
    .ui-btn-group ::ng-deep ui-button .ui-btn:focus-visible { z-index: 2; }
  `,
})
export class UiButtonGroup {
  label = input<string>();
}
