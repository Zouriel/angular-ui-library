import { Component } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiLink, UiKbd, UiInlineCode, UiBlockquote } from '@zouriel/ui/link';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-typography',
  imports: [UiText, UiLink, UiKbd, UiInlineCode, UiBlockquote, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Getting started" title="Typography & content"
      lead="ui-text is the text primitive: it renders the right semantic tag for each variant, so headings and paragraphs stay meaningful to screen readers and search engines. ui-link, ui-kbd, ui-inline-code and ui-blockquote (from @zouriel/ui/link) cover links and inline content.">

      <doc-section name="Text" selector="ui-text" [api]="textApi"
        summary="Project the text as content. The variant picks the semantic tag and style: h1–h6, p (body), small (caption), span (label), code and blockquote (quote). h1–h3 use --ui-font-display. Add the bare inline attribute to render it inline instead of as a block."
        [shapes]="VARIANT">
        <doc-demo code="<ui-text variant=&quot;h1&quot;>Heading</ui-text>
<ui-text variant=&quot;body&quot;>Body copy</ui-text>
<ui-text variant=&quot;caption&quot;>caption</ui-text>
<ui-text variant=&quot;code&quot;>inline code</ui-text>
<ui-text variant=&quot;label&quot; inline>Inline label</ui-text>
<ui-text variant=&quot;body&quot; font=&quot;var(--ui-font-mono)&quot;>Override</ui-text>">
          <ui-text variant="h1">Heading 1</ui-text>
          <ui-text variant="h2">Heading 2</ui-text>
          <ui-text variant="h3">Heading 3</ui-text>
          <ui-text variant="h4">Heading 4</ui-text>
          <ui-text variant="h5">Heading 5</ui-text>
          <ui-text variant="h6">Heading 6</ui-text>
          <ui-text variant="body">Body — the default paragraph style.</ui-text>
          <ui-text variant="caption">A small muted caption.</ui-text>
          <ui-text variant="body"><ui-text variant="label" inline>Label, inline</ui-text> beside <ui-text variant="code" inline>code, inline</ui-text></ui-text>
          <ui-text variant="quote">A blockquote variant for pull quotes.</ui-text>
          <ui-text variant="body" font="var(--ui-font-mono)">Body with a font override.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Link" selector="ui-link" [api]="linkApi"
        summary="Themed anchor, underlined at rest so it never relies on colour alone. It renders a plain href (no routerLink), so an internal href loads the page fresh; for in-app routing put a routerLink on your own anchor. external adds target=_blank, rel=noopener noreferrer, an arrow icon and screen-reader text saying it opens in a new tab.">
        <doc-demo code="<ui-link href=&quot;/x&quot;>internal</ui-link>
<ui-link href=&quot;https://angular.dev&quot; [external]=&quot;true&quot;>external</ui-link>
<ui-link href=&quot;/x&quot; tone=&quot;muted&quot;>muted</ui-link>">
          <ui-text variant="body">An <ui-link href="/buttons">internal link</ui-link>, an
            <ui-link href="https://angular.dev" [external]="true">external one</ui-link>, a
            <ui-link href="/forms" tone="muted">muted one</ui-link> and a <ui-link href="/overlays" tone="plain">plain one</ui-link>.</ui-text>
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
        summary="Quotation block (a blockquote element) with an optional citation line below. Project the quote text.">
        <doc-demo code="<ui-blockquote cite=&quot;Author&quot;>Quote text</ui-blockquote>">
          <ui-blockquote cite="Design system">Tokens are the single source of truth.</ui-blockquote>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
})
export class TypographyPage {
  protected readonly VARIANT = `type TextVariant =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body' | 'caption' | 'label' | 'code' | 'quote';`;
  protected readonly textApi: ApiRow[] = [
    { name: 'variant', type: 'TextVariant', default: "'body'", desc: 'Semantic tag and style.' },
    { name: 'font', type: 'string', default: '—', desc: 'CSS font-family override; the token applies when unset.' },
    { name: 'inline', type: 'attribute', default: '—', desc: 'Present: display inline instead of block.' },
  ];
  protected readonly linkApi: ApiRow[] = [
    { name: 'href', type: 'string', default: '—', desc: 'Target URL, set as a plain href.' },
    { name: 'external', type: 'boolean', default: 'false', desc: 'Open in a new tab with safe rel, an arrow icon and hidden "(opens in a new tab)" text.' },
    { name: 'tone', type: "'primary' | 'muted' | 'plain'", default: "'primary'", desc: 'Color. plain inherits the surrounding text colour.' },
  ];
  protected readonly quoteApi: ApiRow[] = [
    { name: 'cite', type: 'string', default: '—', desc: 'Optional citation line.' },
  ];
}
