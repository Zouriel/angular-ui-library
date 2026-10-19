import { Component, computed, input } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiTable, type UiColumn } from '@zouriel/ui/table';
import { UiCodeBlock } from '@zouriel/ui/data';
import { UiSectionLabel } from '@zouriel/ui/fx';

/** Documentation page wrapper: eyebrow + title + lead + projected content. */
@Component({
  selector: 'doc-page',
  imports: [UiText, UiSectionLabel],
  template: `
    <article class="doc">
      <header class="doc-head">
        <ui-section-label [label]="eyebrow()" />
        <ui-text variant="h1">{{ title() }}</ui-text>
        @if (lead()) { <ui-text variant="body" class="lead">{{ lead() }}</ui-text> }
      </header>
      <ng-content />
    </article>
  `,
  styles: `
    /* No one-word last lines in summaries, hints and table text. */
    :host { display: block; max-width: 920px; text-wrap: pretty; }
    .doc-head { display: flex; flex-direction: column; gap: var(--ui-space-2); margin-bottom: var(--ui-space-6); }
    .lead { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-lg); max-width: 62ch; }
  `,
})
export class DocPage {
  eyebrow = input('Component');
  title = input('');
  lead = input('');
}

/**
 * The id a doc-section gets when it has no explicit `anchor`: its name in lower case, with every
 * run of other characters turned into one hyphen. The command palette's section index uses the same
 * function, so search results land on the right heading.
 */
export function docAnchor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export interface ApiRow extends Record<string, unknown> {
  name: string;
  type: string;
  default?: string;
  desc: string;
}

/** Whether an API row's default says something (not empty and not the '—' placeholder). */
export function hasDefault(value: string | undefined): boolean {
  const v = value?.trim();
  return !!v && v !== '—' && v !== '-';
}

/**
 * A type for display: a union only breaks after a `|`, so no line starts with a bare `|` and each
 * member stays whole (`'rect' | 'circle'` never splits inside a member).
 */
export function unionBreaks(type: string): string {
  // Written with or without spaces round the bar ('a'|'b' too), a member never starts a line with it.
  return type.replace(/\s*\|\s*/g, '\u00a0| ');
}

/**
 * API reference table (inputs / outputs / models) rendered with ui-table. In a narrow column (a phone)
 * the same rows are stacked as a list instead, so nothing has to scroll sideways.
 */
@Component({
  selector: 'doc-api',
  imports: [UiTable, UiText],
  host: { '[class.has-default]': 'showDefault()' },
  template: `
    @if (title()) { <ui-text variant="label" class="cap">{{ title() }}</ui-text> }
    <ui-table class="tbl" [columns]="cols()" [data]="display()" />
    <div class="stacked" role="list" [attr.aria-label]="title() || null">
      @for (r of display(); track r.name) {
        <div class="item" role="listitem">
          <div class="item-head"><code class="nm">{{ r.name }}</code><code class="ty">{{ r.type }}</code></div>
          @if (hasDefault(r.default)) { <div class="def">Default <code>{{ r.default }}</code></div> }
          <p class="desc">{{ r.desc }}</p>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; margin: var(--ui-space-3) 0; container-type: inline-size; }
    .cap { display: block; margin-bottom: var(--ui-space-1); color: var(--ui-color-text-muted); }
    /* Defaults are short literals; keep each on one line. */
    :host(.has-default) .tbl ::ng-deep td:nth-child(3) { white-space: nowrap; }
    .stacked { display: none; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .item { display: flex; flex-direction: column; gap: var(--ui-space-1); padding: var(--ui-space-3); }
    .item + .item { border-top: 1px solid var(--ui-color-border); }
    .item-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--ui-space-1) var(--ui-space-2); }
    code { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); }
    .nm { color: var(--ui-color-primary); font-weight: 600; }
    .ty, .def { color: var(--ui-color-text-muted); }
    .def { font-size: var(--ui-font-size-sm); }
    .def code { color: var(--ui-color-text-secondary); }
    /* A long selector or literal breaks anywhere rather than running out of the card. */
    .item code { overflow-wrap: anywhere; }
    .desc { margin: 0; font-size: var(--ui-font-size-sm); line-height: 1.5; color: var(--ui-color-text-secondary); }
    @container (max-width: 600px) {
      .tbl { display: none; }
      .stacked { display: block; }
    }
  `,
})
export class DocApi {
  rows = input<ApiRow[]>([]);
  title = input('');
  protected readonly hasDefault = hasDefault;
  /** The Default column only appears when some row has a default worth showing. */
  protected readonly showDefault = computed(() => this.rows().some((r) => hasDefault(r.default)));
  protected readonly display = computed<ApiRow[]>(() => this.rows().map((r) => ({ ...r, type: unionBreaks(r.type) })));
  protected readonly cols = computed<UiColumn[]>(() => [
    { key: 'name', header: 'Property' },
    { key: 'type', header: 'Type' },
    ...(this.showDefault() ? [{ key: 'default', header: 'Default' }] : []),
    { key: 'desc', header: 'Description' },
  ]);
}

/**
 * A documented component section: heading, selector, summary, projected demo,
 * and optional API tables (inputs + outputs + the shapes of object inputs).
 */
@Component({
  selector: 'doc-section',
  imports: [UiText, UiCodeBlock, DocApi],
  template: `
    <section class="sec" [attr.id]="id()">
      <ui-text variant="h2" class="title">{{ name() }}</ui-text>
      @if (selector()) { <code class="sel">{{ selector() }}</code> }
      @if (summary()) { <ui-text variant="body" class="sum">{{ summary() }}</ui-text> }
      <ng-content />
      @if (api().length) { <doc-api [rows]="api()" [title]="apiTitle()" /> }
      @if (outputs().length) { <doc-api [rows]="outputs()" title="Outputs" /> }
      @if (shapes()) {
        <ui-text variant="label" class="cap">Data shapes</ui-text>
        <ui-code-block language="ts" [code]="shapes()" />
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .sec { padding: var(--ui-space-6) 0; border-top: 1px solid var(--ui-color-border); }
    /* Each section is the only .sec in its own host, so the first host is what drops the rule. */
    :host(:first-of-type) .sec { border-top: none; }
    /* Sections are the page's second heading level (the page title is the h1) but read at h3 size. */
    .title ::ng-deep h2 { font-size: 1.375rem; font-weight: 600; line-height: 1.35; letter-spacing: var(--ui-tracking-tight); }
    .sec { scroll-margin-top: calc(52px + var(--ui-space-2)); } /* clears the sticky top bar */
    .sel { display: inline-block; margin: 4px 0 var(--ui-space-2); font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm);
      color: var(--ui-color-primary); background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border);
      border-radius: 6px; padding: 2px 8px; }
    .sum { color: var(--ui-color-text-muted); margin-bottom: var(--ui-space-4); display: block; max-width: 66ch; }
    .title + .sum { margin-top: var(--ui-space-2); }
    .cap { display: block; margin: var(--ui-space-3) 0 var(--ui-space-1); color: var(--ui-color-text-muted); }
  `,
})
export class DocSection {
  name = input('');
  selector = input('');
  summary = input('');
  /** Element id for deep links; defaults to {@link docAnchor} of the name. */
  anchor = input('');
  api = input<ApiRow[]>([]);
  /** Caption of the `api` table. */
  apiTitle = input('Inputs');
  outputs = input<ApiRow[]>([]);
  /** Optional TS snippet documenting interface shapes for object inputs. */
  shapes = input('');

  protected readonly id = computed(() => this.anchor() || docAnchor(this.name()));
}

/** Live example: a framed preview area with an optional code snippet beneath. */
@Component({
  selector: 'doc-demo',
  imports: [UiCodeBlock],
  template: `
    <div class="demo">
      <div class="preview" [class.center]="center()"><ng-content /></div>
      @if (code()) { <ui-code-block [code]="code()" [language]="lang()" /> }
    </div>
  `,
  styles: `
    :host { display: block; margin-bottom: var(--ui-space-4); }
    .preview { padding: var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .preview.center { align-items: flex-start; }
    /* Blocks (inputs, tables, rows) fill the frame, but inline controls keep their own width: a stretched
       host is invisible yet still what tooltips, popovers and menus anchor to. */
    .preview > ::ng-deep :is(ui-button, ui-icon-button, ui-button-group, ui-segmented, ui-toggle-button, ui-split-button,
      ui-dropdown-button, ui-popover, ui-menu, ui-badge, ui-chip, ui-switch, ui-checkbox, ui-rating):not(.block-host) { align-self: flex-start; }
    .demo:not(:has(.preview > *)) .preview { display: none; }
    .demo:has(.preview > *) ui-code-block { display: block; margin-top: -1px; }
    .demo:has(.preview > *) ui-code-block ::ng-deep .cb { border-top-left-radius: 0; border-top-right-radius: 0; }
  `,
})
export class DocDemo {
  code = input('');
  lang = input('html');
  center = input(false);
}
