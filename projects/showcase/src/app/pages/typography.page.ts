import { Component } from '@angular/core';
import { UiText } from 'ui/text';
import { UiLink, UiKbd, UiInlineCode, UiBlockquote } from 'ui/link';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-typography',
  imports: [UiText, UiLink, UiKbd, UiInlineCode, UiBlockquote, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Getting started" title="Typography & content"
      lead="ui-text is the only text element — it renders the correct semantic tag per variant, keeping a11y and SEO intact. Headings (h1–h3) use the --ui-font-display token.">

      <doc-section name="Text" selector="ui-text" [api]="textApi"
        summary="Project the text as content. The variant picks the semantic tag and style.">
        <doc-demo code="<ui-text variant=&quot;h1&quot;>Heading</ui-text>
<ui-text variant=&quot;body&quot;>Body copy</ui-text>
<ui-text variant=&quot;caption&quot;>caption</ui-text>
<ui-text variant=&quot;code&quot;>inline code</ui-text>">
          <ui-text variant="h1">Heading 1</ui-text>
          <ui-text variant="h2">Heading 2</ui-text>
          <ui-text variant="h3">Heading 3</ui-text>
          <ui-text variant="body">Body — the default paragraph style.</ui-text>
          <ui-text variant="caption">A small muted caption.</ui-text>
          <ui-text variant="quote">A blockquote variant for pull quotes.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Link" selector="ui-link" [api]="linkApi"
        summary="Themed anchor. external adds target=_blank + rel=noopener and a marker.">
        <doc-demo code="<ui-link href=&quot;/x&quot;>internal</ui-link>
<ui-link href=&quot;https://angular.dev&quot; [external]=&quot;true&quot;>external</ui-link>">
          <ui-text variant="body">An <ui-link href="#/buttons">internal link</ui-link> and an
            <ui-link href="https://angular.dev" [external]="true">external one</ui-link>.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="kbd" selector="ui-kbd"
        summary="Keyboard key hint. Project the key text. No inputs.">
        <doc-demo code="<ui-kbd>Ctrl</ui-kbd> <ui-kbd>K</ui-kbd>">
          <ui-text variant="body">Press <ui-kbd>Ctrl</ui-kbd> <ui-kbd>K</ui-kbd>.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Inline code" selector="ui-inline-code"
        summary="Inline code token. Project the code text. No inputs.">
        <doc-demo code="Run <ui-inline-code>ng build</ui-inline-code>.">
          <ui-text variant="body">Run <ui-inline-code>ng build</ui-inline-code>.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Blockquote" selector="ui-blockquote" [api]="quoteApi"
        summary="Quotation block with optional citation. Project the quote text.">
        <doc-demo code="<ui-blockquote cite=&quot;Author&quot;>Quote text</ui-blockquote>">
          <ui-blockquote cite="Design system">Tokens are the single source of truth.</ui-blockquote>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
})
export class TypographyPage {
  protected readonly textApi: ApiRow[] = [
    { name: 'variant', type: "'h1'..'h6' | 'body' | 'caption' | 'label' | 'code' | 'quote'", default: "'body'", desc: 'Semantic tag + style.' },
    { name: 'font', type: 'string', default: '—', desc: 'Optional font-family override.' },
  ];
  protected readonly linkApi: ApiRow[] = [
    { name: 'href', type: 'string', default: '—', desc: 'Target URL.' },
    { name: 'external', type: 'boolean', default: 'false', desc: 'Open in new tab + rel + marker.' },
    { name: 'tone', type: "'primary' | 'muted' | 'plain'", default: "'primary'", desc: 'Color.' },
  ];
  protected readonly quoteApi: ApiRow[] = [
    { name: 'cite', type: 'string', default: '—', desc: 'Optional citation line.' },
  ];
}
