import { Component, input } from '@angular/core';

export type UiResultStatus = 'success' | 'error' | 'info' | 'warning' | '404' | '500';

/** `ui-result` — full-page outcome state (success / error / 404 / 500). */
@Component({
  selector: 'ui-result',
  // `title` is an input here, not a tooltip: drop the native attribute so hovering doesn't show one.
  host: { '[attr.title]': 'null' },
  template: `
    <div class="ui-result">
      <div class="glyph" [attr.data-status]="status()" aria-hidden="true">
        @switch (status()) {
          @case ('success') { <svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          @case ('error') { <svg viewBox="0 0 24 24" width="28" height="28"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          @case ('warning') { <svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 4v10M12 19h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          @case ('info') { <svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 10v9M12 5h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          @case ('404') { <svg viewBox="0 0 24 24" width="28" height="28"><path d="M9 9a3 3 0 1 1 4.5 2.6c-.9.5-1.5 1.3-1.5 2.4v.5M12 19h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
          @case ('500') { <svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 4v10M12 19h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> }
        }
      </div>
      <div class="title">{{ title() }}</div>
      @if (subtitle()) { <div class="subtitle">{{ subtitle() }}</div> }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-result {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      gap: var(--ui-space-2); padding: var(--ui-space-6); font-family: var(--ui-font-default); line-height: 1.35;
    }
    .glyph {
      display: flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--ui-color-surface-raised);
    }
    .glyph[data-status="success"] { color: var(--ui-color-success); }
    .glyph[data-status="error"], .glyph[data-status="500"] { color: var(--ui-color-danger); }
    .glyph[data-status="warning"] { color: var(--ui-color-warning); }
    .glyph[data-status="info"], .glyph[data-status="404"] { color: var(--ui-color-info); }
    .title { font-size: var(--ui-font-size-lg); font-weight: 600; color: var(--ui-color-text); margin-top: var(--ui-space-2); text-wrap: balance; }
    .subtitle { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); max-width: 420px; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--ui-space-2); margin-top: var(--ui-space-3); }
    /* A projected wrapper would otherwise be one flex child and swallow the gap — see modal's .ft. */
    .actions ::ng-deep > div, .actions ::ng-deep > span {
      display: flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: var(--ui-space-2); }
    .actions:empty { display: none; }
  `,
})
export class UiResult {
  status = input<UiResultStatus>('info');
  title = input('');
  subtitle = input<string>();
}
