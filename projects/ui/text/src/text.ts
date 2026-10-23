import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';

export type TextVariant =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body' | 'caption' | 'label' | 'code' | 'quote';

/** Elements `ui-text` can render through its `as` input. */
export type TextTag =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'p' | 'div' | 'span' | 'small' | 'code' | 'blockquote';

/** The tag each variant renders when `as` is not set. */
const VARIANT_TAG: Record<TextVariant, TextTag> = {
  h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
  body: 'p', caption: 'small', label: 'span', code: 'code', quote: 'blockquote',
};

/**
 * `ui-text` — the typography primitive and the ONLY text element in the
 * library. Renders the correct semantic tag per variant (keeps a11y/SEO
 * intact) and applies an optional `font` that falls back to the token.
 * `as` overrides the tag while keeping the variant's look, e.g. a heading
 * style on a `<p>` that stays out of the document outline, or an `h2` that
 * looks like an `h4`. Styles are keyed on the variant class, not the tag.
 *
 * Projected content lives in a single `<ng-content>` (captured in the
 * `#content` template) and is stamped into the chosen tag via
 * `ngTemplateOutlet`. A naive "one `<ng-content>` per `@case`" template does
 * NOT work — Angular only fills the last default slot, leaving every other
 * variant empty.
 */
@Component({
  selector: 'ui-text',
  imports: [NgTemplateOutlet],
  template: `
    @switch (tag()) {
      @case ('h1') { <h1 [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></h1> }
      @case ('h2') { <h2 [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></h2> }
      @case ('h3') { <h3 [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></h3> }
      @case ('h4') { <h4 [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></h4> }
      @case ('h5') { <h5 [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></h5> }
      @case ('h6') { <h6 [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></h6> }
      @case ('div') { <div [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></div> }
      @case ('span') { <span [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></span> }
      @case ('small') { <small [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></small> }
      @case ('code') { <code [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></code> }
      @case ('blockquote') { <blockquote [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></blockquote> }
      @default { <p [class]="cls()" [style.font-family]="font()"><ng-container [ngTemplateOutlet]="content" /></p> }
    }
    <ng-template #content><ng-content /></ng-template>
  `,
  styles: `
    :host { color: var(--ui-color-text); display: block; }
    :host([inline]) { display: inline; }
    .t {
      margin: 0;
      font-family: var(--ui-font-default); /* used when [font] is not set */
      line-height: 1.35;
    }
    .v-h1, .v-h2, .v-h3 { font-family: var(--ui-font-display); }
    .v-h1, .v-h2, .v-h3, .v-h4, .v-h5, .v-h6 { text-wrap: balance; }
    /* Tracking tapers with size, largest heading first — matches the display type scale
       (tighter at the top, back to normal by h3/body so small text stays legible). */
    .v-h1 { font-size: var(--ui-font-size-h1); font-weight: 700; line-height: 1.1; letter-spacing: var(--ui-tracking-tighter); }
    .v-h2 { font-size: var(--ui-font-size-h2); font-weight: 700; line-height: 1.18; letter-spacing: var(--ui-tracking-tight); }
    .v-h3 { font-size: var(--ui-font-size-h3); font-weight: 600; letter-spacing: var(--ui-tracking-tight); }
    .v-h4 { font-size: var(--ui-font-size-lg); font-weight: 600; }
    .v-h5 { font-size: var(--ui-font-size-h5); font-weight: 600; }
    .v-h6 { font-size: var(--ui-font-size-h6); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-color-text-muted); }
    .v-body { font-size: var(--ui-font-size-md); line-height: 1.45; text-wrap: pretty; }
    .v-caption { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .v-label { font-size: var(--ui-font-size-sm); font-weight: 600; }
    .v-code {
      font-family: var(--ui-font-mono);
      font-size: 0.88em;
      background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-xs);
      padding: 0.1em 0.35em;
    }
    .v-quote {
      border-left: 2px solid var(--ui-color-border-strong);
      padding: var(--ui-space-2) var(--ui-space-4);
      color: var(--ui-color-text-secondary); line-height: 1.45;
      font-style: italic;
    }
  `,
})
export class UiText {
  variant = input<TextVariant>('body');
  /**
   * Element to render instead of the variant's own tag; the variant still sets the look.
   * Use it to keep the document outline right, e.g. `variant="h1" as="p"` for a heading
   * style that is not a heading, or `variant="h4" as="h2"` for a small section heading.
   */
  as = input<TextTag>();
  /** Optional font-family override; the CSS token fills in when undefined. */
  font = input<string>();

  protected readonly tag = computed<TextTag>(() => this.as() ?? VARIANT_TAG[this.variant()] ?? 'p');
  protected readonly cls = computed(() => 't v-' + this.variant());
}
