import { Component, computed, input } from '@angular/core';

/** 8/12/20 map to the upper --ui-space-* rhythm steps (32/48/80px) for section-level
 *  gaps — e.g. stacking page sections — on top of the original component-level scale. */
type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 20;

/** `ui-stack` — flexbox row/column with token gap and alignment. */
@Component({
  selector: 'ui-stack',
  template: `<div class="ui-stack" [style.flex-direction]="direction()" [style.gap]="gapVar()"
                  [style.align-items]="align()" [style.justify-content]="justify()"
                  [style.flex-wrap]="wrap() ? 'wrap' : 'nowrap'"><ng-content /></div>`,
  styles: `
    /*
     * text-align: inherit undoes a collision with legacy HTML, not a style choice.
     *
     * "align" is a presentational attribute the HTML rendering spec still honours, and its UA rule
     * is unqualified: [align=center] sets text-align on ANY element, custom ones included. A static
     * align="center" in a template stays in the DOM, so the flex alignment silently centres every
     * piece of text inside the stack as well. Restoring the inherited value keeps the attribute
     * meaning only what this component says it means.
     */
    :host { display: block; text-align: inherit; }
    .ui-stack { display: flex; }
  `,
})
export class UiStack {
  direction = input<'row' | 'column'>('column');
  gap = input<Gap>(3);
  align = input<'start' | 'center' | 'end' | 'stretch'>('stretch');
  justify = input<'start' | 'center' | 'end' | 'space-between'>('start');
  wrap = input(false);

  protected readonly gapVar = computed(() => `var(--ui-space-${this.gap()}, 0px)`);
}
