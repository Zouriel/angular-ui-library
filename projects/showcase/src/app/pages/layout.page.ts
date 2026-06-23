import { Component } from '@angular/core';
import { UiGrid, UiStack, UiSpacer, UiAspectRatio, UiScrollArea, UiSplitter } from 'ui/layout';
import { UiDivider } from 'ui/divider';
import { UiBadge } from 'ui/badge';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-layout',
  imports: [
    UiGrid, UiStack, UiSpacer, UiAspectRatio, UiScrollArea, UiSplitter, UiDivider, UiBadge,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Layout" title="Layout & grid"
      lead="Structural primitives — container, grid, stack, spacer, aspect-ratio, scroll-area, splitter, divider. gap values are token steps (0–6 → --ui-space-*).">

      <doc-section name="Grid" selector="ui-grid" [api]="gridApi"
        summary="CSS grid with a fixed column count (columns: number) or a responsive auto-fit (min: a CSS length, which overrides columns).">
        <doc-demo code="<ui-grid [columns]=&quot;4&quot; [gap]=&quot;3&quot;> … </ui-grid>
<ui-grid [min]=&quot;'200px'&quot; [gap]=&quot;3&quot;> … </ui-grid>">
          <ui-grid [columns]="4" [gap]="3">
            @for (n of [1,2,3,4,5,6,7,8]; track n) { <div class="tile">{{ n }}</div> }
          </ui-grid>
        </doc-demo>
      </doc-section>

      <doc-section name="Stack" selector="ui-stack" [api]="stackApi"
        summary="Flexbox row/column with token gap + alignment.">
        <doc-demo code="<ui-stack direction=&quot;row&quot; [gap]=&quot;3&quot; align=&quot;center&quot; justify=&quot;space-between&quot;>
  <ui-badge>left</ui-badge><ui-spacer /><ui-badge>right</ui-badge>
</ui-stack>">
          <ui-stack direction="row" [gap]="3" align="center">
            <ui-badge tone="primary">left</ui-badge><ui-spacer /><ui-badge>right</ui-badge>
          </ui-stack>
        </doc-demo>
      </doc-section>

      <doc-section name="Spacer" selector="ui-spacer"
        summary="A flex spacer (flex: 1) that pushes siblings apart. No inputs.">
        <doc-demo code="<ui-stack direction=&quot;row&quot;>A <ui-spacer /> B</ui-stack>"></doc-demo>
      </doc-section>

      <doc-section name="Container" selector="ui-container" [api]="containerApi"
        summary="Centered max-width wrapper with responsive padding.">
        <doc-demo code="<ui-container size=&quot;md&quot;> … </ui-container>"></doc-demo>
      </doc-section>

      <doc-section name="Aspect ratio" selector="ui-aspect-ratio" [api]="arApi"
        summary="Constrains projected media to a fixed width:height ratio.">
        <doc-demo code="<ui-aspect-ratio ratio=&quot;16 / 9&quot;><img src=&quot;…&quot;></ui-aspect-ratio>">
          <ui-aspect-ratio ratio="16 / 9"><div class="tile" style="height:100%">16 : 9</div></ui-aspect-ratio>
        </doc-demo>
      </doc-section>

      <doc-section name="Scroll area" selector="ui-scroll-area" [api]="saApi"
        summary="Thin themed scrollbars with a max height.">
        <doc-demo code="<ui-scroll-area maxHeight=&quot;120px&quot;> … </ui-scroll-area>">
          <ui-scroll-area maxHeight="110px">
            @for (n of lines; track n) { <div class="ln">Scrollable line {{ n }}</div> }
          </ui-scroll-area>
        </doc-demo>
      </doc-section>

      <doc-section name="Splitter" selector="ui-splitter" [api]="splitterApi"
        summary="Two resizable panes with a draggable divider. Project [split-a] and [split-b]; the divider is keyboard-resizable.">
        <doc-demo code="<ui-splitter orientation=&quot;horizontal&quot;>
  <div split-a>Left</div>
  <div split-b>Right</div>
</ui-splitter>">
          <div class="split-host">
            <ui-splitter>
              <div split-a class="pane">Left pane</div>
              <div split-b class="pane">Right — drag the divider</div>
            </ui-splitter>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Divider" selector="ui-divider" [api]="dividerApi"
        summary="Horizontal or vertical separator, optionally with a centered label (horizontal only).">
        <doc-demo code="<ui-divider />
<ui-divider label=&quot;or&quot; />
<ui-divider orientation=&quot;vertical&quot; />">
          <ui-divider />
          <ui-divider label="section" />
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .tile { display: flex; align-items: center; justify-content: center; height: 44px; background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text-muted); font-family: var(--ui-font-mono); }
    .ln { padding: 2px var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .split-host { height: 120px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .pane { padding: var(--ui-space-3); height: 100%; box-sizing: border-box; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class LayoutPage {
  protected readonly lines = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly gridApi: ApiRow[] = [
    { name: 'columns', type: 'number | string', default: '12', desc: 'Column count or grid-template-columns.' },
    { name: 'min', type: 'string', default: '—', desc: 'Auto-fit min column width (overrides columns).' },
    { name: 'gap', type: '0 | 1 | 2 | 3 | 4 | 6', default: '4', desc: 'Token gap step.' },
  ];
  protected readonly stackApi: ApiRow[] = [
    { name: 'direction', type: "'row' | 'column'", default: "'column'", desc: 'Flex direction.' },
    { name: 'gap', type: '0 | 1 | 2 | 3 | 4 | 6', default: '3', desc: 'Token gap step.' },
    { name: 'align', type: "'start'|'center'|'end'|'stretch'", default: "'stretch'", desc: 'align-items.' },
    { name: 'justify', type: "'start'|'center'|'end'|'space-between'", default: "'start'", desc: 'justify-content.' },
    { name: 'wrap', type: 'boolean', default: 'false', desc: 'Allow wrapping.' },
  ];
  protected readonly containerApi: ApiRow[] = [
    { name: 'size', type: "'sm'|'md'|'lg'|'xl'|'full'", default: "'lg'", desc: 'Max width.' },
  ];
  protected readonly arApi: ApiRow[] = [
    { name: 'ratio', type: "string (e.g. '16 / 9')", default: "'16 / 9'", desc: 'aspect-ratio value.' },
  ];
  protected readonly saApi: ApiRow[] = [
    { name: 'maxHeight', type: 'string', default: "'240px'", desc: 'Max height before scroll.' },
    { name: 'axis', type: "'y' | 'x' | 'both'", default: "'y'", desc: 'Scroll axis.' },
  ];
  protected readonly splitterApi: ApiRow[] = [
    { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: 'Split direction.' },
  ];
  protected readonly dividerApi: ApiRow[] = [
    { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: 'Direction.' },
    { name: 'label', type: 'string', default: '—', desc: 'Centered label (horizontal only).' },
  ];
}
