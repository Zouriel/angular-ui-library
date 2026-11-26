import { booleanAttribute, Component, input } from '@angular/core';

/** Alignment of actions in a card footer. */
export type UiCardActionsAlign = 'start' | 'center' | 'end' | 'stretch' | 'between';

/**
 * `ui-card-actions` — a wrapping row for buttons or links in a `ui-card` footer.
 * It is a layout-only component and deliberately adds no accessibility role.
 */
@Component({
  selector: 'ui-card-actions',
  host: {
    '[attr.data-align]': 'align()',
    '[attr.data-divided]': 'divided() ? "true" : null',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ui-space-2);
    }
    :host([data-align='start']) {
      justify-content: start;
    }
    :host([data-align='center']) {
      justify-content: center;
    }

    :host([data-align='end']) {
      justify-content: end;
    }
    :host([data-align='between']) {
      justify-content: space-between;
    }
    :host([data-align='stretch']) {
      align-items: stretch;
    }
    :host([data-align='stretch']) ::ng-deep > * {
      flex: 1 1 0;
    }
  `,
})
export class UiCardActions {
  /** Which end the actions occupy; `stretch` gives every action an equal share. */
  align = input<UiCardActionsAlign>('start');
  /** Keep the card footer's divider and top padding band. */
  divided = input(false, { transform: booleanAttribute });
}
