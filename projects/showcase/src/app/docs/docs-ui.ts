import { Component, input } from '@angular/core';
import { UiText } from 'ui/text';
import { UiTable, type UiColumn } from 'ui/table';
import { UiCodeBlock } from 'ui/data';
import { UiSectionLabel } from 'ui/fx';

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

export interface ApiRow extends Record<string, unknown> {
  name: string;
  type: string;
  default?: string;
  desc: string;
}

/** API reference table (inputs / outputs / models) rendered with ui-table. */
@Component({
  selector: 'doc-api',
  imports: [UiTable, UiText],
  template: `
    @if (title()) { <ui-text variant="label" class="cap">{{ title() }}</ui-text> }
    <ui-table [columns]="cols" [data]="rows()" />
  `,
  styles: `
    :host { display: block; margin: var(--ui-space-3) 0; }
    .cap { display: block; margin-bottom: var(--ui-space-1); color: var(--ui-color-text-muted); }
    ::ng-deep .doc-api-name { font-family: var(--ui-font-mono); color: var(--ui-color-primary); white-space: nowrap; }
  `,
})
export class DocApi {
  rows = input<ApiRow[]>([]);
  title = input('');
  protected readonly cols: UiColumn[] = [
    { key: 'name', header: 'Property' },
    { key: 'type', header: 'Type' },
    { key: 'default', header: 'Default' },
    { key: 'desc', header: 'Description' },
  ];
}

/**
 * A documented component section: heading, selector, summary, projected demo,
 * and optional API tables (inputs + outputs + the shapes of object inputs).
 */
@Component({
  selector: 'doc-section',
  imports: [UiText, UiCodeBlock, DocApi],
  template: `
    <section class="sec" [attr.id]="anchor()">
      <ui-text variant="h3">{{ name() }}</ui-text>
      @if (selector()) { <code class="sel">{{ selector() }}</code> }
      @if (summary()) { <ui-text variant="body" class="sum">{{ summary() }}</ui-text> }
      <ng-content />
      @if (api().length) { <doc-api [rows]="api()" title="Inputs" /> }
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
    .sec:first-of-type { border-top: none; }
    .sel { display: inline-block; margin: 4px 0 var(--ui-space-2); font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm);
      color: var(--ui-color-primary); background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border);
      border-radius: 6px; padding: 2px 8px; }
    .sum { color: var(--ui-color-text-muted); margin-bottom: var(--ui-space-4); display: block; max-width: 66ch; }
    .cap { display: block; margin: var(--ui-space-3) 0 var(--ui-space-1); color: var(--ui-color-text-muted); }
  `,
})
export class DocSection {
  name = input('');
  selector = input('');
  summary = input('');
  anchor = input('');
  api = input<ApiRow[]>([]);
  outputs = input<ApiRow[]>([]);
  /** Optional TS snippet documenting interface shapes for object inputs. */
  shapes = input('');
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
