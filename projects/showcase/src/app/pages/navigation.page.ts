import { Component, signal } from '@angular/core';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import UserCircleIcon from '@hugeicons/core-free-icons/UserCircleIcon';
import DashboardSquare01Icon from '@hugeicons/core-free-icons/DashboardSquare01Icon';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import CreditCardIcon from '@hugeicons/core-free-icons/CreditCardIcon';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import {
  UiNavbar, UiBreadcrumbs, UiPagination, UiStepper, UiStepBody, UiBottomNav, UiMenubar, UiSideNav, UiAnchorNav,
  type UiBreadcrumb, type UiBottomNavItem, type UiSideNavGroup, type UiMenubarMenu, type UiAnchorItem, type UiStep,
} from '@zouriel/ui/navigation';
import { UiTabs, UiTab } from '@zouriel/ui/tabs';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-navigation',
  imports: [
    UiText, UiButton, UiNavbar, UiBreadcrumbs, UiPagination, UiStepper, UiStepBody, UiBottomNav, UiMenubar, UiSideNav, UiAnchorNav,
    UiTabs, UiTab, DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Navigation"
      lead="Move between views: navbar, tabs, side nav, breadcrumbs, pagination, stepper, menubar, bottom nav and anchor nav. All are router-agnostic: they emit what was chosen and leave routing to you. Tabs come from @zouriel/ui/tabs, the rest from @zouriel/ui/navigation.">

      <doc-section name="Navbar" selector="ui-navbar" [api]="navbarApi" anchor="nav-navbar"
        summary="Top bar surface (glass-capable) with three slots: [navbar-brand] on the left, the default slot for links in the middle, [navbar-actions] on the right. Below 48rem it wraps onto two rows, brand and actions first and the links underneath, and the links row scrolls sideways if it still does not fit.">
        <doc-demo lang="ts + html" code="import { UiNavbar } from '@zouriel/ui/navigation';

<ui-navbar [sticky]=&quot;true&quot; label=&quot;Main&quot;>
  <span navbar-brand>Acme</span>
  <ui-button variant=&quot;ghost&quot;>Docs</ui-button>
  <ui-button navbar-actions variant=&quot;primary&quot;>Sign in</ui-button>
</ui-navbar>">
          <ui-navbar [glass]="false" label="Demo navbar">
            <ui-text navbar-brand variant="label">Acme</ui-text>
            <ui-button variant="ghost" size="sm">Dashboard</ui-button>
            <ui-button navbar-actions variant="primary" size="sm">Sign in</ui-button>
          </ui-navbar>
        </doc-demo>
      </doc-section>

      <doc-section name="Tabs" selector="ui-tabs · ui-tab" [api]="tabsApi" anchor="nav-tabs"
        summary="WAI-ARIA tabs with roving tabindex; ArrowLeft/Right, Home and End move and select (disabled tabs are skipped). selectedIndex is a two-way model. Each ui-tab needs a label and may be disabled or carry a HugeIcons icon; with iconOnly the label stays as the accessible name and tooltip. Inactive panels stay in the DOM but hidden. When the strip scrolls, the selected tab is kept in view.">
        <doc-demo lang="ts + html" code="import { UiTabs, UiTab } from '@zouriel/ui/tabs';

<ui-tabs [(selectedIndex)]=&quot;idx&quot; label=&quot;Project&quot;>
  <ui-tab label=&quot;One&quot;>…</ui-tab>
  <ui-tab label=&quot;Two&quot; [disabled]=&quot;true&quot;>…</ui-tab>
</ui-tabs>">
          <ui-tabs label="Demo">
            <ui-tab label="Overview"><ui-text variant="body">First panel.</ui-text></ui-tab>
            <ui-tab label="Details"><ui-text variant="body">Second panel.</ui-text></ui-tab>
            <ui-tab label="Disabled" [disabled]="true">—</ui-tab>
          </ui-tabs>
        </doc-demo>
      </doc-section>

      <doc-section name="Side nav" selector="ui-side-nav" [api]="sideApi" [outputs]="sideOut" anchor="nav-side"
        summary="Vertical grouped navigation (powers this docs sidebar). active is a two-way model; listen to (navigate) to route. The active item gets aria-current=&quot;page&quot;. An icon may be a HugeIcons icon or a short string. Items with href render as real links (crawlable, open in new tab); a plain click still emits (navigate) and prevents the browser navigation, while modified clicks are left to the browser."
        [shapes]="'interface UiSideNavGroup { label?: string; items: UiSideNavItem[]; }\ninterface UiSideNavItem { label: string; value: string; icon?: string | IconSvgObject; badge?: string|number; disabled?: boolean; href?: string; }'">
        <doc-demo code="<ui-side-nav [groups]=&quot;groups&quot; [(active)]=&quot;active&quot; (navigate)=&quot;go($event)&quot; />">
          <div class="boxed"><ui-side-nav [groups]="navGroups" [(active)]="active" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Breadcrumbs" selector="ui-breadcrumbs" [api]="crumbApi" [outputs]="crumbOut" anchor="nav-crumbs"
        summary="Hierarchical trail in a nav labelled Breadcrumb. The last item is always the current page (plain text, aria-current=&quot;page&quot;). Earlier items with href render as links; the rest are buttons that emit (navigate). Long labels are cut off with an ellipsis at 24 characters' width, and the trail wraps on narrow screens."
        [shapes]="'interface UiBreadcrumb { label: string; href?: string; value?: string; }'">
        <doc-demo code="<ui-breadcrumbs [items]=&quot;crumbs&quot; separator=&quot;/&quot; (navigate)=&quot;go($event)&quot; />">
          <ui-breadcrumbs [items]="crumbs" />
        </doc-demo>
      </doc-section>

      <doc-section name="Pagination" selector="ui-pagination" [api]="pageApi" anchor="nav-pages"
        summary="Page navigation with previous/next buttons. Always shows the first and last page and siblings pages either side of the current one; gaps become an ellipsis. page is a two-way model; the current page gets aria-current=&quot;page&quot;.">
        <doc-demo code="<ui-pagination [(page)]=&quot;page&quot; [total]=&quot;10&quot; [siblings]=&quot;1&quot; />">
          <ui-pagination [(page)]="page" [total]="10" />
        </doc-demo>
      </doc-section>

      <doc-section name="Stepper" selector="ui-stepper" [api]="stepApi" anchor="nav-stepper"
        summary="Progress through ordered steps. Display only, with no clicks or outputs: steps before active show as done, and the active step gets aria-current=&quot;step&quot;. Horizontal by default; when the labels don't fit (a phone) it switches to vertical by itself; orientation=&quot;vertical&quot; stacks the steps and shows a uiStepBody template under each one (details, history, actions). variant=&quot;dots&quot; draws a compact strip of dots: finished and current steps in the tone (the current one ringed), steps not reached as hollow outlined dots, labels kept for screen readers. tone=&quot;success&quot; colours finished steps green."
        [shapes]="'interface UiStep { label: string; description?: string; }'">
        <doc-demo code="<ui-stepper [steps]=&quot;steps&quot; [active]=&quot;step&quot; />">
          <div class="demo-stack">
          <ui-stepper [steps]="steps" [active]="step()" />
          <ui-stepper [steps]="steps" [active]="step()" orientation="vertical" tone="success" label="Checkout">
            <ng-template uiStepBody let-state="state"><span class="step-note">{{ state === 'done' ? 'Done' : state === 'active' ? 'In progress' : 'Not started' }}</span></ng-template>
          </ui-stepper>
          <ui-stepper [steps]="steps" [active]="step()" variant="dots" tone="success" label="Checkout progress" />
          </div>
          <div class="row">
            <ui-button size="sm" variant="outline" (click)="step.set(Math.max(0, step()-1))">Back</ui-button>
            <ui-button size="sm" (click)="step.set(Math.min(3, step()+1))">Next</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Menubar" selector="ui-menubar" [api]="menubarApi" [outputs]="menubarOut" anchor="nav-menubar"
        summary="Application-style horizontal menu bar with dropdowns, one open at a time. Opening a menu focuses its first enabled item; once one is open, hovering another top item switches to it. ArrowLeft/Right move between the top items (and switch the open menu); ArrowDown opens one. Inside a menu, ArrowUp/Down, Home and End move between items; choosing an item or Escape closes it and returns focus to its top item, and Tab closes it. Menus flip or shift to stay on screen."
        [shapes]="'interface UiMenubarMenu { label: string; items: UiMenubarItem[]; }\ninterface UiMenubarItem { label: string; value: string; disabled?: boolean; }'">
        <doc-demo code="<ui-menubar [menus]=&quot;menus&quot; (select)=&quot;run($event)&quot; />">
          <ui-menubar [menus]="menus" />
        </doc-demo>
      </doc-section>

      <doc-section name="Bottom nav" selector="ui-bottom-nav" [api]="bottomApi" anchor="nav-bottom"
        summary="Mobile-style bottom bar: a nav of buttons, the active one marked aria-current=&quot;page&quot;. active is a two-way model; map it to a route yourself. It is not fixed to the screen; place it. Give each item a HugeIcons icon: it is drawn in currentColor, so it follows the theme and the active state. A short string still works, but emoji draw in the platform's own colours."
        [shapes]="'interface UiBottomNavItem { label: string; value: string; icon?: string | IconSvgObject; badge?: string|number; }'">
        <doc-demo code="<ui-bottom-nav [items]=&quot;items&quot; [(active)]=&quot;active&quot; label=&quot;Sections&quot; />">
          <ui-bottom-nav [items]="bottom" [(active)]="bottomActive" label="Demo sections" />
        </doc-demo>
      </doc-section>

      <doc-section name="Anchor nav" selector="ui-anchor-nav" [api]="anchorApi" anchor="nav-anchor"
        summary="Scrollspy for a long page: highlights the section in view (IntersectionObserver) and smooth-scrolls to it on click. items name element ids on the page; they are looked up once just after it renders, so sections added later are not watched. A section counts as in view when its top is between offset px from the top of the window and 35% of the way down. offset does not change where a click scrolls to: give the sections a matching scroll-margin-top. The demo below tracks the sections of this page; scroll and watch it."
        [shapes]="'interface UiAnchorItem { id: string; label: string; }'">
        <doc-demo lang="ts + html" code="import { UiAnchorNav, type UiAnchorItem } from '@zouriel/ui/navigation';

<ui-anchor-nav [items]=&quot;[{ id: 'intro', label: 'Intro' }, { id: 'usage', label: 'Usage' }]&quot; [offset]=&quot;80&quot; />

/* on the sections */
section[id] { scroll-margin-top: 80px; }">
          <div class="boxed"><ui-anchor-nav [items]="anchors" /></div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .step-note { font-size: 12.5px; color: var(--ui-color-text-muted); }
    .demo-stack { display: flex; flex-direction: column; gap: var(--ui-space-6); margin-bottom: var(--ui-space-4); }
    .row { display: flex; gap: var(--ui-space-3); }
    .boxed { max-width: 260px; padding: var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
  `,
})
export class NavigationPage {
  protected readonly Math = Math;
  protected readonly page = signal(3);
  protected readonly step = signal(1);
  protected readonly active = signal('a2');
  protected readonly bottomActive = signal('home');
  protected readonly crumbs: UiBreadcrumb[] = [{ label: 'Home', value: 'h' }, { label: 'Docs', value: 'd' }, { label: 'Nav', value: 'n' }];
  protected readonly steps: UiStep[] = [{ label: 'Account' }, { label: 'Plan' }, { label: 'Payment' }, { label: 'Done' }];
  protected readonly anchors: UiAnchorItem[] = [
    { id: 'nav-navbar', label: 'Navbar' }, { id: 'nav-tabs', label: 'Tabs' }, { id: 'nav-side', label: 'Side nav' },
    { id: 'nav-crumbs', label: 'Breadcrumbs' }, { id: 'nav-pages', label: 'Pagination' }, { id: 'nav-stepper', label: 'Stepper' },
    { id: 'nav-menubar', label: 'Menubar' }, { id: 'nav-bottom', label: 'Bottom nav' }, { id: 'nav-anchor', label: 'Anchor nav' },
  ];
  protected readonly menus: UiMenubarMenu[] = [
    { label: 'File', items: [{ label: 'New', value: 'new' }, { label: 'Open', value: 'open' }] },
    { label: 'Edit', items: [{ label: 'Undo', value: 'undo' }, { label: 'Redo', value: 'redo', disabled: true }] },
  ];
  protected readonly bottom: UiBottomNavItem[] = [
    { label: 'Home', value: 'home', icon: Home01Icon }, { label: 'Search', value: 'search', icon: Search01Icon },
    { label: 'Alerts', value: 'alerts', icon: Notification01Icon, badge: 3 }, { label: 'Profile', value: 'profile', icon: UserCircleIcon },
  ];
  protected readonly navGroups: UiSideNavGroup[] = [
    { label: 'Main', items: [{ label: 'Dashboard', value: 'a1', icon: DashboardSquare01Icon }, { label: 'Reports', value: 'a2', icon: Analytics01Icon }] },
    { label: 'Account', items: [{ label: 'Settings', value: 'a3', icon: Settings01Icon }, { label: 'Billing', value: 'a4', icon: CreditCardIcon, badge: 'pro' }] },
  ];

  protected readonly navbarApi: ApiRow[] = [
    { name: 'label', type: 'string', default: 'undefined', desc: 'Accessible name for the <nav>. Set it when the page has more than one navigation landmark.' },
    { name: 'sticky', type: 'boolean', default: 'false', desc: 'Stick to the top of its scroll container (position: sticky on the host).' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass surface.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '[navbar-brand]', type: 'slot', default: '—', desc: 'Left: logo or product name.' },
    { name: '(default)', type: 'slot', default: '—', desc: 'Middle: links.' },
    { name: '[navbar-actions]', type: 'slot', default: '—', desc: 'Right: buttons. A wrapping div or span lays its children out in a row with a gap.' },
  ];
  protected readonly tabsApi: ApiRow[] = [
    { name: 'tabs: selectedIndex', type: 'number', default: '0', desc: 'Two-way (`[(selectedIndex)]`). Index of the selected tab.' },
    { name: 'tabs: label', type: 'string', default: "'Tabs'", desc: 'tablist aria-label.' },
    { name: 'tab: label', type: 'string (required)', default: '—', desc: 'Tab button text.' },
    { name: 'tab: disabled', type: 'boolean', default: 'false', desc: 'Disable the tab.' },
    { name: 'tab: icon', type: 'IconSvgObject', default: 'undefined', desc: 'HugeIcons icon drawn before the label.' },
    { name: 'tab: iconOnly', type: 'boolean', default: 'false', desc: 'Show only the icon (needs icon). The label stays the accessible name and tooltip.' },
    { name: 'tab: (default)', type: 'slot', default: '—', desc: 'The panel content.' },
  ];
  protected readonly sideApi: ApiRow[] = [
    { name: 'groups', type: 'UiSideNavGroup[]', default: '[]', desc: 'Grouped items.' },
    { name: 'active', type: 'string', default: "''", desc: 'Two-way (`[(active)]`). Value of the active item; set on click.' },
    { name: 'label', type: 'string', default: "'Sidebar'", desc: 'nav aria-label.' },
  ];
  protected readonly sideOut: ApiRow[] = [
    { name: 'navigate', type: 'UiSideNavItem', default: '—', desc: 'Item activated (not for disabled items or modified link clicks).' },
  ];
  protected readonly crumbApi: ApiRow[] = [
    { name: 'items', type: 'UiBreadcrumb[]', default: '[]', desc: 'Trail items.' },
    { name: 'separator', type: 'string', default: "'/'", desc: 'Text between items (hidden from screen readers).' },
  ];
  protected readonly crumbOut: ApiRow[] = [{ name: 'navigate', type: 'UiBreadcrumb', default: '—', desc: 'An item without href, other than the last, was clicked.' }];
  protected readonly pageApi: ApiRow[] = [
    { name: 'page', type: 'number', default: '1', desc: 'Two-way (`[(page)]`). Current page, 1-based; clicks are clamped to 1…total.' },
    { name: 'total', type: 'number', default: '1', desc: 'Total pages.' },
    { name: 'siblings', type: 'number', default: '1', desc: 'Pages shown around current.' },
    { name: 'label', type: 'string', default: "'Pagination'", desc: 'nav aria-label.' },
  ];
  protected readonly stepApi: ApiRow[] = [
    { name: 'steps', type: 'UiStep[]', default: '[]', desc: 'Ordered steps.' },
    { name: 'active', type: 'number', default: '0', desc: 'Index of the current step. Steps before it show as done; set it past the last to show all done.' },
    { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", desc: 'Vertical stacks the steps and shows a uiStepBody template under each.' },
    { name: 'variant', type: "'default' | 'dots'", default: "'default'", desc: 'Dots: small dots only, labels kept for screen readers and as tooltips.' },
    { name: 'tone', type: "'primary' | 'success'", default: "'primary'", desc: 'The colour of finished and current steps.' },
    { name: 'label', type: 'string', default: "''", desc: 'An accessible name for the list of steps.' },
    { name: 'uiStepBody', type: 'ng-template', default: '—', desc: 'Content under each step in a vertical stepper; context: $implicit (the step), index, state (done | active | todo).' },
  ];
  protected readonly menubarApi: ApiRow[] = [{ name: 'menus', type: 'UiMenubarMenu[]', default: '[]', desc: 'Top-level menus.' }];
  protected readonly menubarOut: ApiRow[] = [{ name: 'select', type: 'UiMenubarItem', default: '—', desc: 'Chosen item.' }];
  protected readonly bottomApi: ApiRow[] = [
    { name: 'label', type: 'string', default: 'undefined', desc: 'Accessible name for the <nav>. Set it when the page has more than one navigation landmark.' },
    { name: 'items', type: 'UiBottomNavItem[]', default: '[]', desc: 'Destinations. A truthy badge shows as a red pill with its text.' },
    { name: 'active', type: 'string', default: "''", desc: 'Two-way (`[(active)]`). Value of the active item; set on click.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass surface.' },
    { name: 'iconSize', type: 'number', default: '22', desc: 'Drawn-icon size in px. String icons ignore it.' },
  ];
  protected readonly anchorApi: ApiRow[] = [
    { name: 'items', type: 'UiAnchorItem[]', default: '[]', desc: 'Section links (by element id).' },
    { name: 'offset', type: 'number', default: '80', desc: 'Height in px of a fixed header: a section counts as in view only below it. Read once at init; does not change where a click scrolls to.' },
  ];
}
