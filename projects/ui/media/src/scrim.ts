import { Component, input } from '@angular/core';

/**
 * `ui-scrim`: a see-through layer that fades from clear at its top to the media scrim colour at its
 * bottom, with text in the on-scrim colour. Lay it over a picture to put words on it: the fade has
 * reached 60% before the content starts and 88% at the bottom, so on-scrim text keeps at least 4.5:1
 * over any picture, white included. `compact` makes it fit on a grid tile.
 */
@Component({
  selector: 'ui-scrim',
  host: { '[class.compact]': 'compact()' },
  template: `<div class="body"><ng-content /></div>`,
  styles: `
    :host { --ui-scrim-lead: var(--ui-space-12); display: block; color: var(--ui-media-on-scrim);
      background: linear-gradient(to bottom,
        transparent 0,
        color-mix(in srgb, var(--ui-media-scrim) 60%, transparent) var(--ui-scrim-lead),
        color-mix(in srgb, var(--ui-media-scrim) 88%, transparent) 100%);
      padding: var(--ui-scrim-lead) var(--ui-space-4) var(--ui-space-4); }
    .body { max-width: 40rem; margin-inline: auto; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    /* On a tile: a shorter fade and tighter edges, same 60% before the words start. */
    :host(.compact) { --ui-scrim-lead: var(--ui-space-8); padding: var(--ui-scrim-lead) var(--ui-space-2) var(--ui-space-2); }
    :host(.compact) .body { max-width: none; gap: var(--ui-space-1); }
  `,
})
export class UiScrim {
  /** Sized for a tile: the fade is `space8` tall instead of `space12`, with tighter padding. */
  readonly compact = input(false);
}
