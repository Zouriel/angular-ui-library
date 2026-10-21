import { Component, signal } from '@angular/core';
import { UiGrid, UiStack, UiSpacer, UiAspectRatio, UiScrollArea, UiSplitter, UiPanelSection, UiSidebarLayout, UiFloatingPanel } from '@zouriel/ui/layout';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiSideNav } from '@zouriel/ui/navigation';
import { UiDivider } from '@zouriel/ui/divider';
import { UiBadge } from '@zouriel/ui/badge';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-layout',
  imports: [
    UiGrid, UiStack, UiSpacer, UiAspectRatio, UiScrollArea, UiSplitter, UiDivider, UiBadge, UiPanelSection, UiButton, UiSegmented, UiSideNav, UiSidebarLayout, UiFloatingPanel,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Layout" title="Layout & grid"
      lead="Structural primitives from @zouriel/ui/layout: grid, stack, spacer, container, aspect ratio, scroll area, splitter, panel section and sidebar layout, plus the divider from @zouriel/ui/divider. Gap values are token steps (--ui-space-N); 8, 12 and 20 are the larger section-level steps. ui-resize-handle, also in this entry point, is documented with the editor pieces on the Design tools page.">

      <doc-section name="Grid" selector="ui-grid" [api]="gridApi"
        summary="CSS grid with a fixed column count (columns: number), a grid-template-columns string, or a responsive auto-fit (min: a CSS length, which overrides columns).">
        <doc-demo code="<ui-grid [columns]=&quot;4&quot; [gap]=&quot;3&quot;> … </ui-grid>
<ui-grid [min]=&quot;'200px'&quot; [gap]=&quot;3&quot;> … </ui-grid>">
          <ui-grid [columns]="4" [gap]="3">
            @for (n of [1,2,3,4,5,6,7,8]; track n) { <div class="tile">{{ n }}</div> }
          </ui-grid>
        </doc-demo>
      </doc-section>

      <doc-section name="Stack" selector="ui-stack" [api]="stackApi"
        summary="Flexbox row or column with a token gap and alignment. A static align attribute only sets align-items; the host resets the legacy HTML align text centring.">
        <doc-demo code="<ui-stack direction=&quot;row&quot; [gap]=&quot;3&quot; align=&quot;center&quot;>
  <ui-badge tone=&quot;primary&quot;>left</ui-badge><ui-spacer /><ui-badge>right</ui-badge>
</ui-stack>">
          <ui-stack direction="row" [gap]="3" align="center">
            <ui-badge tone="primary">left</ui-badge><ui-spacer /><ui-badge>right</ui-badge>
          </ui-stack>
        </doc-demo>
      </doc-section>

      <doc-section name="Floating panel" anchor="floating-panel" selector="ui-floating-panel" [api]="floatApi"
        summary="A raised surface floating over the bottom (or top) of its positioned parent: the details card over a map. Non-modal: it takes no focus and blocks nothing outside its own box, so what is around it stays usable and draggable. It sits 16px in from the edges plus the device's safe-area insets, up to 480px wide and centred, so it fits a 390px phone with a 16px gutter. With ariaLabel it is a named region.">
        <doc-demo code="<div style=&quot;position: relative&quot;>
  <app-map />
  <ui-floating-panel ariaLabel=&quot;Nurse&quot;>…</ui-floating-panel>
</div>">
          <div class="float-demo" (pointerdown)="floatDown($event)" (pointermove)="floatMove($event)" (pointerup)="floatDrag = null">
            <div class="float-map" [style.background-position]="floatPos()[0] + 'px ' + floatPos()[1] + 'px'">Drag the map</div>
            <ui-floating-panel ariaLabel="Nurse" [placement]="floatTop() ? 'top' : 'bottom'">
              <strong>Aminath Hassan, RN</strong>
              <div class="float-meta">12 min away · Home visits</div>
              <div class="float-acts"><ui-button size="sm" (click)="floatTop.set(!floatTop())">Move to {{ floatTop() ? 'bottom' : 'top' }}</ui-button></div>
            </ui-floating-panel>
          </div>
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
        summary="Constrains projected media to a fixed width:height ratio. The direct child is stretched to fill the box with object-fit: cover, and overflow is clipped.">
        <doc-demo code="<ui-aspect-ratio ratio=&quot;16 / 9&quot;><img src=&quot;…&quot;></ui-aspect-ratio>">
          <ui-aspect-ratio ratio="16 / 9" class="ar-demo"><div class="tile">16 / 9</div></ui-aspect-ratio>
        </doc-demo>
      </doc-section>

      <doc-section name="Scroll area" selector="ui-scroll-area" [api]="saApi"
        summary="A scroll container with thin themed scrollbars and a max height. It scrolls on the chosen axis and clips the other.">
        <doc-demo code="<ui-scroll-area maxHeight=&quot;100px&quot;> … </ui-scroll-area>">
          <!-- 4½ lines tall, so the cut-off line shows there is more to scroll. -->
          <ui-scroll-area maxHeight="100px">
            @for (n of lines; track n) { <div class="ln">Scrollable line {{ n }}</div> }
          </ui-scroll-area>
        </doc-demo>
      </doc-section>

      <doc-section name="Splitter" selector="ui-splitter" [api]="splitterApi"
        summary="Two resizable panes with a draggable divider. Project [split-a] and [split-b]. The first pane stays between 10% and 90%. The divider is a focusable separator: Left/Up shrink the first pane by 2%, Right/Down grow it. Dragging works with mouse, pen and touch; the grab area grows on coarse (touch) pointers. The host takes 100% of its parent's height, so give the parent a height.">
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
        summary="A dense, collapsible titled group for inspector and settings panels. The heading is a button with aria-expanded, so Enter and Space toggle it; a collapsed body is removed from the DOM. Header actions go in [panel-actions]; set collapsible to false for a fixed heading.">
        <doc-demo code="<ui-panel-section title=&quot;Sections&quot; badge=&quot;4&quot; [(open)]=&quot;sectionsOpen&quot;>
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
        summary="An app shell: a sidebar beside the main column, with a sticky top bar. At or below breakpoint the sidebar becomes a drawer opened by a built-in menu button, over a dimmed backdrop. The breakpoint is read with matchMedia, so each app picks its own; widening past it closes the drawer. The sidebar sits on the start side, so in dir=rtl it is on the right and the drawer slides in from the right. In drawer mode Escape and the backdrop close it, focus moves into it on open and back to the opener on close, the page behind is inert, and a closed drawer is inert and hidden from screen readers; a Close navigation button appears for keyboard users. The slide is off under prefers-reduced-motion. The menu button's words come from provideUiStrings (sidebarToggle, sidebarClose, sidebarLabel). The content region is the page's main landmark unless mainLandmark is false. [sidebar-header] and [sidebar-footer] are fixed at the top and bottom of the sidebar, docked and in the drawer, and only [sidebar] between them scrolls; a hairline shows under the header and over the footer while it is scrolled out of sight on that side. With fill the footer sits at the bottom of the viewport; without it the header and footer stick to the screen while the page scrolls.">
        <doc-demo code="<ui-sidebar-layout [breakpoint]=&quot;860&quot; [(open)]=&quot;navOpen&quot;>
  <ui-side-nav sidebar [groups]=&quot;nav&quot; />
  <h1 header>Dashboard</h1>
  <router-outlet />
</ui-sidebar-layout>">
          <ui-segmented size="sm" label="Width" [options]="shellWidths" [value]="shellWidth()" (valueChange)="shellWidth.set($any($event)); shellOpen.set(false)" />
          <div class="shell-host" [class.phone]="shellWidth() === 'phone'">
            <ui-sidebar-layout [breakpoint]="shellWidth() === 'phone' ? 100000 : 0" sidebarWidth="190px" mainLandmark="false" [(open)]="shellOpen">
              <ui-side-nav sidebar [groups]="shellNav" [(active)]="shellActive" (navigate)="shellOpen.set(false)" />
              <strong header>{{ shellActive() }}</strong>
              <p class="pane-text">Page content scrolls here while the bar stays put.</p>
            </ui-sidebar-layout>
          </div>
        </doc-demo>
        <doc-demo code="<ui-sidebar-layout #shell [bar]=&quot;false&quot; fill [(open)]=&quot;navOpen&quot;>
  <ui-button sidebar-header [block]=&quot;true&quot;>New chat</ui-button>
  <ui-side-nav sidebar [groups]=&quot;nav&quot; (navigate)=&quot;navOpen.set(false)&quot; />   <!-- only this scrolls -->
  <div sidebar-footer>My nurse visits · Profile</div>                                <!-- stays at the bottom -->
  <header class=&quot;top&quot;>
    @if (shell.compact()) {
      <ui-icon-button ariaLabel=&quot;Menu&quot; (click)=&quot;shell.toggle()&quot;>…</ui-icon-button>
    }
    <strong>Chat</strong>
  </header>
  <div class=&quot;messages&quot;>…</div>   <!-- flex: 1; min-height: 0; overflow-y: auto -->
  <form class=&quot;composer&quot;>…</form>
</ui-sidebar-layout>">
          <div class="row">
            <ui-segmented size="sm" label="Width" [options]="shellWidths" [value]="appWidth()" (valueChange)="appWidth.set($any($event)); appOpen.set(false)" />
            <ui-segmented size="sm" label="Direction" [options]="dirs" [value]="appDir()" (valueChange)="appDir.set($any($event))" />
          </div>
          <div class="shell-host app" [class.phone]="appWidth() === 'phone'" [attr.dir]="appDir()">
            <ui-sidebar-layout #shell [breakpoint]="appWidth() === 'phone' ? 100000 : 0" sidebarWidth="200px" [bar]="false" fill mainLandmark="false" [(open)]="appOpen">
              <ui-button sidebar-header [block]="true" (click)="appOpen.set(false)">{{ appDir() === 'rtl' ? 'އައު ޗެޓެއް' : 'New chat' }}</ui-button>
              <ui-side-nav sidebar [groups]="appNav" [(active)]="appActive" (navigate)="appOpen.set(false)" />
              <div sidebar-footer class="app-foot">
                <ui-button variant="ghost" [block]="true">{{ appDir() === 'rtl' ? 'ނަރުސް ޒިޔާރަތްތައް' : 'My nurse visits' }}</ui-button>
                <ui-button variant="ghost" [block]="true">{{ appDir() === 'rtl' ? 'ޕްރޮފައިލް' : 'Profile' }}</ui-button>
              </div>
              <header class="app-top">
                @if (shell.compact()) {
                  <ui-button variant="ghost" size="sm" (click)="shell.toggle()">{{ appDir() === 'rtl' ? 'މެނޫ' : 'Menu' }}</ui-button>
                }
                <strong>{{ appActive() }}</strong>
              </header>
              <div class="app-msgs">
                @for (n of lines; track n) { <p class="pane-text">Message {{ n }}</p> }
              </div>
              <div class="app-composer"><span class="pane-text">Composer stays at the bottom</span></div>
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
          <ui-divider label="or" />
          <div class="vrow"><span>Edit</span><ui-divider orientation="vertical" /><span>Share</span><ui-divider orientation="vertical" /><span>Delete</span></div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .float-demo { position: relative; height: 280px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; touch-action: none; cursor: grab; }
    .float-map { position: absolute; inset: 0; display: grid; place-items: center; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm);
      background-color: var(--ui-color-surface-subtle);
      background-image: linear-gradient(var(--ui-color-border) 1px, transparent 1px), linear-gradient(90deg, var(--ui-color-border) 1px, transparent 1px);
      background-size: 32px 32px; }
    .float-meta { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); margin-top: var(--ui-space-1); }
    .float-acts { margin-top: var(--ui-space-3); }
    .tile { display: flex; align-items: center; justify-content: center; height: 44px; background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text-muted); font-family: var(--ui-font-mono); }
    .ln { padding: 2px var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .panel-host { max-width: 320px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-color-surface); }
    .ar-demo { max-width: 360px; }
    .ar-demo .tile { display: grid; place-items: center; height: 100%; box-sizing: border-box; }
    .split-host { height: 120px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .shell-host { position: relative; height: 260px; margin-top: var(--ui-space-2); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      overflow: hidden; transform: translateZ(0); /* keeps the drawer's fixed layers inside the demo */ }
    .shell-host.phone { max-width: 390px; }
    .shell-host ui-sidebar-layout { min-height: 100%; height: 100%; }
    /* fill sizes the shell to the viewport; inside this box it takes the box instead. */
    .shell-host.app { height: 400px; }
    .shell-host ui-sidebar-layout.ui-fill { height: 100%; }
    .app-top { display: flex; align-items: center; gap: var(--ui-space-3); min-height: var(--ui-size-touch); padding: 0 var(--ui-space-4);
      border-bottom: 1px solid var(--ui-color-border); background: var(--ui-color-bg); flex: none; }
    .app-msgs { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: var(--ui-space-3) var(--ui-space-4); display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .app-foot { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .app-composer { flex: none; padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); margin-top: var(--ui-space-2); }
    .vrow { display: flex; align-items: center; gap: var(--ui-space-3); height: var(--ui-size-md); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .pane-text { margin: 0; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .pane { padding: var(--ui-space-3); height: 100%; box-sizing: border-box; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class LayoutPage {
  protected readonly floatTop = signal(false);
  protected readonly floatPos = signal([0, 0]);
  protected floatDrag: { x: number; y: number; at: number[] } | null = null;
  protected floatDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest('ui-floating-panel')) return;
    this.floatDrag = { x: e.clientX, y: e.clientY, at: this.floatPos() };
  }
  protected floatMove(e: PointerEvent): void {
    const d = this.floatDrag;
    if (d) this.floatPos.set([d.at[0] + e.clientX - d.x, d.at[1] + e.clientY - d.y]);
  }
  protected readonly floatApi: ApiRow[] = [
    { name: 'placement', type: "'bottom' | 'top'", default: "'bottom'", desc: 'The edge of the parent it floats over.' },
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Names it as a region for screen readers.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'See-through frosted surface, the same as ui-bottom-sheet glass (0.41.2): AA over any backdrop in every theme; solid without backdrop-filter or under reduced transparency / more contrast.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '--ui-floating-panel-width', type: 'CSS length', default: '480px', desc: 'Its widest.' },
  ];
  protected readonly lines = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly shellWidths = [{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }];
  /** Phones start on the Phone preview: the desktop shell would squeeze the page column to a few words a line. */
  protected readonly shellWidth = signal<'desktop' | 'phone'>(globalThis.matchMedia?.('(max-width: 600px)').matches ? 'phone' : 'desktop');
  protected readonly shellOpen = signal(false);
  protected readonly shellActive = signal('Dashboard');
  protected readonly dirs = [{ value: 'ltr', label: 'LTR' }, { value: 'rtl', label: 'RTL' }];
  protected readonly appWidth = signal<'desktop' | 'phone'>(globalThis.matchMedia?.('(max-width: 600px)').matches ? 'phone' : 'desktop');
  protected readonly appDir = signal<'ltr' | 'rtl'>('ltr');
  protected readonly appOpen = signal(false);
  protected readonly appActive = signal('Chat');
  protected readonly appNav = [
    { label: 'Dhirumi', items: [{ label: 'Chat', value: 'Chat' }, { label: 'Doctors', value: 'Doctors' }, { label: 'Bookings', value: 'Bookings' }] },
    { label: 'Past chats', items: Array.from({ length: 20 }, (_, i) => ({ label: `Conversation ${i + 1}`, value: `Conversation ${i + 1}` })) },
  ];
  protected readonly shellNav = [{ label: 'Workspace', items: [{ label: 'Dashboard', value: 'Dashboard' }, { label: 'Events', value: 'Events' }, { label: 'Guests', value: 'Guests' }] }];
  protected readonly sidebarApi: ApiRow[] = [
    { name: 'breakpoint', type: 'number', default: '860', desc: 'Widest viewport (px) that still uses the drawer.' },
    { name: 'sidebarWidth', type: 'string', default: "'248px'", desc: 'Sidebar width, any CSS length.' },
    { name: 'mainLandmark', type: 'boolean', default: 'true', desc: 'The content region has role=main. Set false when the shell is nested inside another main (as in this demo).' },
    { name: 'bar', type: 'boolean', default: 'true', desc: 'The built-in top bar (menu button + [header] slot). false: no bar at all; the app opens the drawer through [(open)] or toggle() from its own button, shown while compact().' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Exactly the viewport height (100dvh, safe-area aware) instead of at least it: the sidebar and the content scroll inside themselves, and the content is an unpadded flex column (give the app\'s scrolling part flex: 1; min-height: 0, and dock a composer below it).' },
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the drawer is open. Ignored above the breakpoint.' },
    { name: 'compact', type: 'Signal<boolean>', default: '—', desc: 'Read-only: true in drawer mode. Show the app\'s own menu button only then.' },
    { name: 'toggle()', type: 'method', default: '—', desc: 'Open or close the drawer.' },
    { name: 'close()', type: 'method', default: '—', desc: 'Close the drawer, e.g. on navigation.' },
    { name: '[sidebar]', type: 'slot', default: '—', desc: 'The navigation; the only part of the sidebar that scrolls.' },
    { name: '[sidebar-header]', type: 'slot', default: '—', desc: 'Fixed at the top of the sidebar, docked and in the drawer (a New chat button). (0.41)' },
    { name: '[sidebar-footer]', type: 'slot', default: '—', desc: 'Fixed at the bottom of the sidebar (account, My visits); with fill at the bottom of the viewport, clear of the home indicator. (0.41)' },
    { name: '[header]', type: 'slot', default: '—', desc: 'Top-bar content, after the menu button.' },
    { name: 'default', type: 'slot', default: '—', desc: 'The page.' },
    { name: '--ui-shell-pad', type: 'CSS variable', default: 'space-6 (space-4 compact)', desc: 'Padding around the page content.' },
  ];
  protected readonly gridApi: ApiRow[] = [
    { name: 'columns', type: 'number | string', default: '12', desc: 'Column count (equal 1fr columns) or a grid-template-columns string.' },
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
    { name: 'axis', type: "'y' | 'x' | 'both'", default: "'y'", desc: 'Which axis scrolls; overflow on the other is clipped.' },
  ];
  protected readonly splitterApi: ApiRow[] = [
    { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: 'Split direction.' },
    { name: 'ratio', type: 'WritableSignal<number>', default: '50', desc: 'Public signal (not an input): size of the first pane in %. Read or set it through a template ref, e.g. #s then s.ratio.set(30).' },
    { name: '[split-a]', type: 'slot', default: '—', desc: 'The first pane (left, or top when vertical).' },
    { name: '[split-b]', type: 'slot', default: '—', desc: 'The second pane; takes the remaining space.' },
  ];
  protected readonly panelApi: ApiRow[] = [
    { name: 'title', type: 'string (required)', default: '—', desc: 'Heading, also the group’s aria-label.' },
    { name: 'open', type: 'boolean', default: 'true', desc: 'Two-way (`[(open)]`). Whether the body is shown.' },
    { name: 'collapsible', type: 'boolean', default: 'true', desc: 'False shows a fixed heading and always renders the body.' },
    { name: 'badge', type: 'string | number | null', default: 'null', desc: 'Small count or note after the title.' },
    { name: '[panel-actions]', type: 'slot', default: '—', desc: 'Header controls, e.g. an Add button.' },
  ];
  protected readonly dividerApi: ApiRow[] = [
    { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: 'Direction.' },
    { name: 'label', type: 'string', default: '—', desc: 'Centered label (horizontal only; a label forces horizontal).' },
  ];
}
