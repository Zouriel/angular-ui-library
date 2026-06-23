import { Component, signal } from '@angular/core';
import { UiText } from 'ui/text';
import { UiButton } from 'ui/button';
import {
  UiNavbar, UiBreadcrumbs, UiPagination, UiStepper, UiBottomNav, UiMenubar, UiSideNav,
  type UiBreadcrumb, type UiBottomNavItem, type UiSideNavGroup,
} from 'ui/navigation';
import { UiTabs, UiTab } from 'ui/tabs';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-navigation',
  imports: [
    UiText, UiButton, UiNavbar, UiBreadcrumbs, UiPagination, UiStepper, UiBottomNav, UiMenubar, UiSideNav,
    UiTabs, UiTab, DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Navigation"
      lead="Move between views: navbar, tabs, side-nav, breadcrumbs, pagination, stepper, menubar, bottom-nav, anchor-nav.">

      <doc-section name="Navbar" selector="ui-navbar" [api]="navbarApi"
        summary="Top bar surface (glass-capable). Slots: [navbar-brand], default (center links), [navbar-actions].">
        <doc-demo code="<ui-navbar [sticky]=&quot;true&quot;>
  <span navbar-brand>◆ Acme</span>
  <ui-button variant=&quot;ghost&quot;>Docs</ui-button>
  <ui-button navbar-actions variant=&quot;primary&quot;>Sign in</ui-button>
</ui-navbar>">
          <ui-navbar [glass]="false">
            <ui-text navbar-brand variant="label">◆ Acme</ui-text>
            <ui-button variant="ghost" size="sm">Dashboard</ui-button>
            <ui-button navbar-actions variant="primary" size="sm">Sign in</ui-button>
          </ui-navbar>
        </doc-demo>
      </doc-section>

      <doc-section name="Tabs" selector="ui-tabs · ui-tab" [api]="tabsApi"
        summary="WAI-ARIA tabs with roving tabindex + Arrow/Home/End. selectedIndex is a two-way model. Each ui-tab needs a label and may be disabled.">
        <doc-demo code="<ui-tabs [(selectedIndex)]=&quot;idx&quot;>
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

      <doc-section name="Side nav" selector="ui-side-nav" [api]="sideApi" [outputs]="sideOut"
        summary="Vertical grouped navigation (powers this docs sidebar). active is a two-way model; emit (navigate) to route."
        [shapes]="'interface UiSideNavGroup { label?: string; items: UiSideNavItem[]; }\ninterface UiSideNavItem { label: string; value: string; icon?: string; badge?: string|number; disabled?: boolean; }'">
        <doc-demo code="<ui-side-nav [groups]=&quot;groups&quot; [(active)]=&quot;active&quot; (navigate)=&quot;go($event)&quot; />">
          <div class="boxed"><ui-side-nav [groups]="navGroups" [(active)]="active" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Breadcrumbs" selector="ui-breadcrumbs" [api]="crumbApi" [outputs]="crumbOut"
        summary="Hierarchical trail. Items with href render as links; otherwise emit (navigate)."
        [shapes]="'interface UiBreadcrumb { label: string; href?: string; value?: string; }'">
        <doc-demo code="<ui-breadcrumbs [items]=&quot;crumbs&quot; separator=&quot;/&quot; (navigate)=&quot;go($event)&quot; />">
          <ui-breadcrumbs [items]="crumbs" />
        </doc-demo>
      </doc-section>

      <doc-section name="Pagination" selector="ui-pagination" [api]="pageApi" [outputs]="pageOut"
        summary="Page navigation with truncation. page is a two-way model.">
        <doc-demo code="<ui-pagination [(page)]=&quot;page&quot; [total]=&quot;10&quot; [siblings]=&quot;1&quot; />">
          <ui-pagination [(page)]="page" [total]="10" />
        </doc-demo>
      </doc-section>

      <doc-section name="Stepper" selector="ui-stepper" [api]="stepApi"
        summary="Horizontal progress through ordered steps."
        [shapes]="'interface UiStep { label: string; description?: string; }'">
        <doc-demo code="<ui-stepper [steps]=&quot;steps&quot; [active]=&quot;step&quot; />">
          <ui-stepper [steps]="steps" [active]="step()" />
          <div class="row">
            <ui-button size="sm" variant="outline" (click)="step.set(Math.max(0, step()-1))">Back</ui-button>
            <ui-button size="sm" (click)="step.set(Math.min(3, step()+1))">Next</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Menubar" selector="ui-menubar" [api]="menubarApi" [outputs]="menubarOut"
        summary="Application-style horizontal menu bar with dropdowns (one open at a time)."
        [shapes]="'interface UiMenubarMenu { label: string; items: UiMenubarItem[]; }\ninterface UiMenubarItem { label: string; value: string; disabled?: boolean; }'">
        <doc-demo code="<ui-menubar [menus]=&quot;menus&quot; (select)=&quot;run($event)&quot; />">
          <ui-menubar [menus]="menus" />
        </doc-demo>
      </doc-section>

      <doc-section name="Bottom nav" selector="ui-bottom-nav" [api]="bottomApi"
        summary="Mobile-style bottom bar. active is a two-way model."
        [shapes]="'interface UiBottomNavItem { label: string; value: string; icon?: string; badge?: string|number; }'">
        <doc-demo code="<ui-bottom-nav [items]=&quot;items&quot; [(active)]=&quot;active&quot; />">
          <ui-bottom-nav [items]="bottom" [(active)]="bottomActive" />
        </doc-demo>
      </doc-section>

      <doc-section name="Anchor nav" selector="ui-anchor-nav" [api]="anchorApi"
        summary="Scrollspy: highlights the section in view (IntersectionObserver) and smooth-scrolls to it on click. items reference element ids on the page."
        [shapes]="'interface UiAnchorItem { id: string; label: string; }'">
        <doc-demo code="<ui-anchor-nav [items]=&quot;[{ id: 'intro', label: 'Intro' }]&quot; [offset]=&quot;80&quot; />"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
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
  protected readonly steps = [{ label: 'Account' }, { label: 'Plan' }, { label: 'Payment' }, { label: 'Done' }];
  protected readonly menus = [
    { label: 'File', items: [{ label: 'New', value: 'new' }, { label: 'Open', value: 'open' }] },
    { label: 'Edit', items: [{ label: 'Undo', value: 'undo' }, { label: 'Redo', value: 'redo', disabled: true }] },
  ];
  protected readonly bottom: UiBottomNavItem[] = [
    { label: 'Home', value: 'home', icon: '🏠' }, { label: 'Search', value: 'search', icon: '🔍' },
    { label: 'Alerts', value: 'alerts', icon: '🔔', badge: 3 }, { label: 'Profile', value: 'profile', icon: '👤' },
  ];
  protected readonly navGroups: UiSideNavGroup[] = [
    { label: 'Main', items: [{ label: 'Dashboard', value: 'a1', icon: '▤' }, { label: 'Reports', value: 'a2', icon: '◷' }] },
    { label: 'Account', items: [{ label: 'Settings', value: 'a3', icon: '⚙' }, { label: 'Billing', value: 'a4', icon: '◫', badge: 'pro' }] },
  ];

  protected readonly navbarApi: ApiRow[] = [
    { name: 'sticky', type: 'boolean', default: 'false', desc: 'Stick to top on scroll.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass surface.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly tabsApi: ApiRow[] = [
    { name: 'tabs: selectedIndex', type: 'number (model)', default: '0', desc: 'Active tab — [(selectedIndex)].' },
    { name: 'tabs: label', type: 'string', default: "'Tabs'", desc: 'tablist aria-label.' },
    { name: 'tab: label', type: 'string (required)', default: '—', desc: 'Tab button text.' },
    { name: 'tab: disabled', type: 'boolean', default: 'false', desc: 'Disable the tab.' },
  ];
  protected readonly sideApi: ApiRow[] = [
    { name: 'groups', type: 'UiSideNavGroup[]', default: '[]', desc: 'Grouped items.' },
    { name: 'active', type: 'string (model)', default: "''", desc: 'Active value — [(active)].' },
    { name: 'label', type: 'string', default: "'Sidebar'", desc: 'nav aria-label.' },
  ];
  protected readonly sideOut: ApiRow[] = [{ name: 'navigate', type: 'UiSideNavItem', default: '—', desc: 'Item activated.' }];
  protected readonly crumbApi: ApiRow[] = [
    { name: 'items', type: 'UiBreadcrumb[]', default: '[]', desc: 'Trail items.' },
    { name: 'separator', type: 'string', default: "'/'", desc: 'Separator glyph.' },
  ];
  protected readonly crumbOut: ApiRow[] = [{ name: 'navigate', type: 'UiBreadcrumb', default: '—', desc: 'Item without href clicked.' }];
  protected readonly pageApi: ApiRow[] = [
    { name: 'page', type: 'number (model)', default: '1', desc: 'Current page — [(page)].' },
    { name: 'total', type: 'number', default: '1', desc: 'Total pages.' },
    { name: 'siblings', type: 'number', default: '1', desc: 'Pages shown around current.' },
    { name: 'label', type: 'string', default: "'Pagination'", desc: 'nav aria-label.' },
  ];
  protected readonly pageOut: ApiRow[] = [{ name: 'pageChange', type: 'number', default: '—', desc: 'Page model change.' }];
  protected readonly stepApi: ApiRow[] = [
    { name: 'steps', type: 'UiStep[]', default: '[]', desc: 'Ordered steps.' },
    { name: 'active', type: 'number', default: '0', desc: 'Current step index.' },
  ];
  protected readonly menubarApi: ApiRow[] = [{ name: 'menus', type: 'UiMenubarMenu[]', default: '[]', desc: 'Top-level menus.' }];
  protected readonly menubarOut: ApiRow[] = [{ name: 'select', type: 'UiMenubarItem', default: '—', desc: 'Chosen item.' }];
  protected readonly bottomApi: ApiRow[] = [
    { name: 'items', type: 'UiBottomNavItem[]', default: '[]', desc: 'Tabs.' },
    { name: 'active', type: 'string (model)', default: "''", desc: 'Active value — [(active)].' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass surface.' },
  ];
  protected readonly anchorApi: ApiRow[] = [
    { name: 'items', type: 'UiAnchorItem[]', default: '[]', desc: 'Section links (by element id).' },
    { name: 'offset', type: 'number', default: '80', desc: 'Scroll offset (px).' },
  ];
}
