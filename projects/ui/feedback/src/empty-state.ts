import { Component, input, computed } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

/**
 * `ui-empty-state` — placeholder for empty content. Slots: `[empty-art]` (a picture of what will fill
 * the page, at most 320 x 200, scaled down on phones), `[empty-icon]`, `[empty-actions]` and
 * `[empty-starters]` (`ui-starter-card`s: stacked on phones, two or three across on wider screens).
 */
@Component({
  selector: 'ui-empty-state',
  template: `
    <div class="ui-empty">
      <div class="art"><ng-content select="[empty-art]" /></div>
      <div class="icon"><ng-content select="[empty-icon]" /></div>
      <div class="title">{{ headingText() }}</div>
      @if (description()) { <div class="desc">{{ description() }}</div> }
      <div class="actions"><ng-content select="[empty-actions]" /></div>
      <div class="starters"><ng-content select="[empty-starters]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-empty {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: var(--ui-space-2); padding: var(--ui-space-6) var(--ui-space-4);
      font-family: var(--ui-font-default); line-height: 1.35;
    }
    .icon { font-size: calc(32px * var(--ui-font-scale)); line-height: 1; color: var(--ui-color-text-muted); }
    .icon:empty { display: none; }
    .title { font-size: var(--ui-font-size-md); font-weight: 600; color: var(--ui-color-text); }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); max-width: 360px; text-wrap: pretty; }
    .actions { display: flex; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    /* A projected wrapper would otherwise be one flex child and swallow the gap — see modal's .ft. */
    .actions ::ng-deep > div[empty-actions], .actions ::ng-deep > span[empty-actions] {
      display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); }
    .actions:empty { display: none; }
    /* The art: as wide as it may be up to 320px, never taller than 200px, keeping its shape. */
    .art { width: min(100%, 320px); margin-bottom: var(--ui-space-2); }
    .art:empty { display: none; }
    .art ::ng-deep > img, .art ::ng-deep > svg, .art ::ng-deep > picture > img {
      display: block; width: 100%; height: auto; max-height: 200px; margin-inline: auto; object-fit: contain; }
    /* Starters: one column on a phone, then two or three across (each at least 200px), centred. */
    .starters {
      display: grid; width: 100%; max-width: 720px; margin-top: var(--ui-space-4); gap: var(--ui-space-3);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); text-align: start;
    }
    .starters ::ng-deep > div[empty-starters], .starters ::ng-deep > span[empty-starters] { display: contents; }
    .starters:empty { display: none; }
  `,
})
export class UiEmptyState {
  protected readonly strings = injectUiStrings();
  /** Default: the built-in `emptyHeading` (Nothing here yet), which follows the app's language. */
  heading = input<string | undefined>(undefined);
  protected readonly headingText = computed(() => this.heading() ?? this.strings.emptyHeading);
  description = input<string>();
}
