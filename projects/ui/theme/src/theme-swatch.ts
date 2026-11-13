import { Component, computed, input } from '@angular/core';

/** The colours a theme preview is drawn in (any CSS colour strings). */
export interface UiThemeSwatchColors {
  /** The page. */
  bg: string;
  /** The card on the page. */
  surface: string;
  /** Text. */
  text: string;
  /** Quieter text; the card's edge is this, faint. */
  muted: string;
  /** The button. */
  accent: string;
}

/**
 * `ui-theme-swatch` — a small picture of a theme: its page, a card with two lines of text and a
 * button. Made for the picture in a `ui-choice-grid` tile, where the tile carries the name, so it is
 * hidden from screen readers unless you give it a `label`.
 */
@Component({
  selector: 'ui-theme-swatch',
  host: {
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[style.--ui-swatch-bg]': 'colors().bg',
    '[style.--ui-swatch-surface]': 'colors().surface',
    '[style.--ui-swatch-text]': 'colors().text',
    '[style.--ui-swatch-muted]': 'colors().muted',
    '[style.--ui-swatch-accent]': 'accentColor()',
  },
  template: `
    <span class="page">
      <span class="card">
        <span class="bar text"></span>
        <span class="bar muted"></span>
        <span class="pill"></span>
      </span>
    </span>
  `,
  styles: `
    /* 4:3 as wide as its box; in a box with its own height (a ui-choice-grid picture, 1.4:1) it stops at
       that height instead of being cropped. */
    :host { display: block; width: 100%; min-width: 0; aspect-ratio: 4 / 3; max-height: 100%; }
    .page {
      display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 100%; height: 100%;
      padding: 12%; background: var(--ui-swatch-bg); border-radius: calc(var(--ui-radius) - 2px); overflow: hidden;
    }
    .card {
      display: flex; flex-direction: column; align-items: flex-start; gap: 9%; box-sizing: border-box; width: 100%; height: 100%;
      padding: 10%; background: var(--ui-swatch-surface); border: 1px solid color-mix(in srgb, var(--ui-swatch-muted) 35%, transparent);
      border-radius: var(--ui-radius-sm);
    }
    .bar { display: block; height: 10%; min-height: 3px; border-radius: var(--ui-radius-pill); }
    .bar.text { width: 75%; background: var(--ui-swatch-text); }
    .bar.muted { width: 50%; background: var(--ui-swatch-muted); }
    .pill { display: block; width: 40%; height: 18%; min-height: 6px; margin-top: auto; border-radius: var(--ui-radius-pill); background: var(--ui-swatch-accent); }
  `,
})
export class UiThemeSwatch {
  colors = input.required<UiThemeSwatchColors>();
  /** Replaces colors.accent for the button (a custom brand colour). */
  accent = input<string | null | undefined>(null);
  /** Names the picture (role="img"); without it the swatch is decorative. */
  label = input<string | null | undefined>(null);

  protected readonly accentColor = computed(() => this.accent() || this.colors().accent);
}
