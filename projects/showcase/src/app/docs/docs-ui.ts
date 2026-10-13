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
    :host { display: block; max-width: 920px; }
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

/** API reference table (inputs / outputs / models) rendered with ui-table. */
@Component({
  selector: 'doc-api',
  imports: [UiTable, UiText],
  template: `
    @if (title()) { <ui-text variant="label" class="cap">{{ title() }}</ui-text> }
    <ui-table [columns]="cols()" [data]="rows()" />
  `,
  styles: `
    :host { display: block; margin: var(--ui-space-3) 0; container-type: inline-size; }
    .cap { display: block; margin-bottom: var(--ui-space-1); color: var(--ui-color-text-muted); }
    /* Narrow: the table scrolls sideways inside its border (never the page), and the description keeps
       a readable measure instead of being squeezed to a word per line. */
    @container (max-width: 560px) {
      :host ::ng-deep td:last-child { min-width: 15em; }
      :host ::ng-deep th, :host ::ng-deep td { padding-inline: var(--ui-space-2); }
    }
    ::ng-deep .doc-api-name { font-family: var(--ui-font-mono); color: var(--ui-color-primary); white-space: nowrap; }
  `,
})
export class DocApi {
  rows = input<ApiRow[]>([]);
  title = input('');
  /** The Default column only appears when some row has a default worth showing. */
  protected readonly cols = computed<UiColumn[]>(() => [
    { key: 'name', header: 'Property' },
    { key: 'type', header: 'Type' },
    ...(this.rows().some((r) => hasDefault(r.default)) ? [{ key: 'default', header: 'Default' }] : []),
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
