import { Component } from '@angular/core';

/**
 * `ui-plan-grid` — lays out `ui-plan-card`s: one column under 600px, two under 912px, at most three
 * (fewer cards share the width). Cards in a row are equal height, so their actions line up at the
 * bottom; a little room on top keeps a highlight label clear of what's above.
 */
@Component({
  selector: 'ui-plan-grid',
  template: `<ng-content />`,
  styles: `
    :host {
      display: grid;
      /* Each column is at least 288px and at least a third of the row, so there are never more than
         three and a 600px row is the first to fit two (2 x 288 + the gap). */
      grid-template-columns: repeat(auto-fit, minmax(min(100%, max(288px, calc((100% - 2 * var(--ui-space-6)) / 3))), 1fr));
      align-items: stretch;
      gap: var(--ui-space-6);
      padding-top: var(--ui-space-3);
    }
  `,
})
export class UiPlanGrid {}
