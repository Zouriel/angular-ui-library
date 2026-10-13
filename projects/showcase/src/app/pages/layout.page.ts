import { Component, signal } from '@angular/core';
import { UiGrid, UiStack, UiSpacer, UiAspectRatio, UiScrollArea, UiSplitter, UiPanelSection, UiSidebarLayout } from '@zouriel/ui/layout';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSideNav } from '@zouriel/ui/navigation';
import { UiDivider } from '@zouriel/ui/divider';
import { UiBadge } from '@zouriel/ui/badge';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-layout',
  imports: [
    UiGrid, UiStack, UiSpacer, UiAspectRatio, UiScrollArea, UiSplitter, UiDivider, UiBadge, UiPanelSection, UiButton, UiSegmented, UiSideNav, UiSidebarLayout,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Layout" title="Layout & grid"
      lead="Structural primitives — container, grid, stack, spacer, aspect-ratio, scroll-area, splitter, sidebar layout, divider. gap values are token steps (0–20 → --ui-space-*); 8, 12 and 20 are the larger section-level steps.">

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
        summary="Flexbox row/column with token gap and alignment.">
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
        summary="Centered max-width wrapper with side padding (--ui-space-4). sm 640px, md 860px, lg 1100px, xl 1320px, full has no limit.">
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
        summary="Two resizable panes with a draggable divider. Project [split-a] and [split-b]. The first pane stays between 10% and 90%. The divider is focusable: arrow keys move it 2% at a time. Its grab area grows on coarse (touch) pointers only.">
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

      <doc-section name="Panel section" selector="ui-panel-section" [api]="panelApi"
        summary="A dense, collapsible titled group for inspector and settings panels. Header actions go in [panel-actions]; set collapsible to false for a fixed heading.">
        <doc-demo code="<ui-panel-section title=&quot;Sections&quot; badge=&quot;4&quot;>
  <ui-button panel-actions size=&quot;sm&quot; variant=&quot;ghost&quot;>Add</ui-button>
  …controls…
</ui-panel-section>">
          <div class="panel-host">
            <ui-panel-section title="Sections" badge="4">
              <ui-button panel-actions size="sm" variant="ghost">Add</ui-button>
              <div class="ln">Screen 1 · 844</div>
              <div class="ln">Screen 2 · 844</div>
            </ui-panel-section>
            <ui-panel-section title="Theme colours" [open]="false">
              <div class="ln">Accent</div>
            </ui-panel-section>
            <ui-panel-section title="Layout" [collapsible]="false">
              <div class="ln">Always shown</div>
            </ui-panel-section>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Sidebar layout" selector="ui-sidebar-layout" [api]="sidebarApi"
        summary="An app shell: a sidebar beside a scrolling main column, with a sticky top bar. Below breakpoint the sidebar becomes a drawer opened by a built-in menu button, over a dimmed backdrop. The breakpoint is read with matchMedia, so each app picks its own.">
        <doc-demo code="<ui-sidebar-layout [breakpoint]=&quot;860&quot; [(open)]=&quot;navOpen&quot;>
  <ui-side-nav sidebar [groups]=&quot;nav&quot; />
  <h1 header>Dashboard</h1>
  <router-outlet />
</ui-sidebar-layout>">
          <ui-segmented size="sm" label="Width" [options]="shellWidths" [value]="shellWidth()" (valueChange)="shellWidth.set($any($event)); shellOpen.set(false)" />
          <div class="shell-host" [class.phone]="shellWidth() === 'phone'">
            <ui-sidebar-layout [breakpoint]="shellWidth() === 'phone' ? 100000 : 0" sidebarWidth="190px" [(open)]="shellOpen">
              <ui-side-nav sidebar [groups]="shellNav" [(active)]="shellActive" (navigate)="shellOpen.set(false)" />
              <strong header>{{ shellActive() }}</strong>
              <p class="pane-text">Page content scrolls here while the bar stays put.</p>
            </ui-sidebar-layout>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Divider" selector="ui-divider" [api]="dividerApi"
        summary="Horizontal or vertical separator (role=separator), optionally with a centered label (horizontal only). A vertical divider stretches to the height of its row.">
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
    .panel-host { max-width: 320px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-color-surface); }
    .split-host { height: 120px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .shell-host { position: relative; height: 260px; margin-top: var(--ui-space-2); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      overflow: hidden; transform: translateZ(0); /* keeps the drawer's fixed layers inside the demo */ }
    .shell-host.phone { max-width: 390px; }
    .shell-host ui-sidebar-layout { min-height: 100%; height: 100%; }
    .pane-text { margin: 0; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .pane { padding: var(--ui-space-3); height: 100%; box-sizing: border-box; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class LayoutPage {
  protected readonly lines = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly shellWidths = [{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }];
  protected readonly shellWidth = signal<'desktop' | 'phone'>('desktop');
  protected readonly shellOpen = signal(false);
  protected readonly shellActive = signal('Dashboard');
  protected readonly shellNav = [{ label: 'Workspace', items: [{ label: 'Dashboard', value: 'Dashboard' }, { label: 'Events', value: 'Events' }, { label: 'Guests', value: 'Guests' }] }];
  protected readonly sidebarApi: ApiRow[] = [
    { name: 'breakpoint', type: 'number', default: '860', desc: 'Widest viewport (px) that still uses the drawer.' },
    { name: 'sidebarWidth', type: 'string', default: "'248px'", desc: 'Sidebar width, any CSS length.' },
    { name: '[(open)]', type: 'boolean', default: 'false', desc: 'Whether the drawer is open, e.g. to close it on navigation. Ignored above the breakpoint.' },
    { name: 'toggle() / close()', type: 'method', default: '—', desc: 'Open/close the drawer from code, e.g. close() on navigation.' },
    { name: '[sidebar] / [header] / default', type: 'content slots', default: '', desc: 'The nav, the top-bar content and the page.' },
    { name: '--ui-shell-pad', type: 'CSS variable', default: 'space-6 (space-4 compact)', desc: 'Padding around the page content.' },
  ];
  protected readonly gridApi: ApiRow[] = [
    { name: 'columns', type: 'number | string', default: '12', desc: 'Column count or grid-template-columns.' },
    { name: 'min', type: 'string', default: '—', desc: 'Auto-fit min column width (overrides columns).' },
    { name: 'gap', type: '1 | 2 | 3 | 4 | 6 | 8 | 12 | 20', default: '4', desc: 'Token gap step (--ui-space-N).' },
  ];
  protected readonly stackApi: ApiRow[] = [
    { name: 'direction', type: "'row' | 'column'", default: "'column'", desc: 'Flex direction.' },
    { name: 'gap', type: '0 | 1 | 2 | 3 | 4 | 6 | 8 | 12 | 20', default: '3', desc: 'Token gap step (--ui-space-N).' },
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
    { name: 'ratio', type: 'WritableSignal<number>', default: '50', desc: 'Public signal: size of the first pane in %. Read or set it through a template ref.' },
    { name: '[split-a] / [split-b]', type: 'content slots', default: '—', desc: 'The first and second pane.' },
  ];
  protected readonly panelApi: ApiRow[] = [
    { name: 'title', type: 'string (required)', default: '—', desc: 'Heading, also the group’s aria-label.' },
    { name: 'open', type: 'boolean (model)', default: 'true', desc: 'Two-way expanded state — [(open)].' },
    { name: 'collapsible', type: 'boolean', default: 'true', desc: 'False shows a fixed heading and always renders the body.' },
    { name: 'badge', type: 'string | number | null', default: 'null', desc: 'Small count or note after the title.' },
    { name: '[panel-actions]', type: 'slot', default: '—', desc: 'Header controls, e.g. an Add button.' },
  ];
  protected readonly dividerApi: ApiRow[] = [
    { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: 'Direction.' },
    { name: 'label', type: 'string', default: '—', desc: 'Centered label (horizontal only; a label forces horizontal).' },
  ];
}
