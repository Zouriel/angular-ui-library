import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import HashtagIcon from '@hugeicons/core-free-icons/HashtagIcon';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { UiText } from '@zouriel/ui/text';
import { UiThemeService } from '@zouriel/ui/theme';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiSideNav, type UiSideNavGroup } from '@zouriel/ui/navigation';
import { UiDrawer, UiToastHost } from '@zouriel/ui/dialog';
import { UiSearchInput } from '@zouriel/ui/form';
import { UiScrollProgress, UiCursor, UiGrain } from '@zouriel/ui/fx';
import { UiCommandPalette, type UiCommand } from '@zouriel/ui/command-palette';
import { UiKbd } from '@zouriel/ui/link';
import { NAV } from './app.routes';
import { DOC_SECTIONS } from './docs/doc-index';

@Component({
  selector: 'app-root',
  imports: [
    HugeiconsIconComponent, RouterLink, RouterOutlet, UiText, UiButton, UiIconButton, UiSideNav, UiDrawer,
    UiSearchInput, UiScrollProgress, UiCursor, UiGrain, UiCommandPalette, UiToastHost, UiKbd,
  ],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip" href="#main" (click)="skipToMain($event)">Skip to content</a>
    <div class="shell">
      <aside class="sidebar" aria-label="Documentation">
        <a class="brand" routerLink="/">
          <img class="logo" src="favicon.svg" alt="" width="24" height="24" /><ui-text variant="label">UI Library</ui-text>
        </a>
        <ui-search-input class="filter" placeholder="Filter pages" (input)="onFilter($event)" />
        <div class="nav-scroll">
          <ui-side-nav label="Documentation" [groups]="filtered()" [active]="active()" (navigate)="go($event.value)" />
        </div>
        <div class="side-foot">
          <ui-text variant="caption">34 entry points · {{ themeLabel() }}</ui-text>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <ui-icon-button class="menu-btn" label="Menu" variant="ghost" (click)="navOpen.set(true)"><hugeicons-icon aria-hidden="true" [icon]="icons.menu" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
          <ui-button variant="ghost" size="sm" (click)="cmdOpen.set(true)" class="cmd" aria-keyshortcuts="Control+K Meta+K">Search docs <ui-kbd class="hint">{{ shortcut }}</ui-kbd></ui-button>
          <span class="grow"></span>
          <label class="theme-picker">
            <span class="sr-only">Theme</span>
            <select [value]="theme.theme()" (change)="theme.set($any($event.target).value)">
              @for (t of THEMES; track t.value) {
                <option [value]="t.value">{{ t.label }}</option>
              }
            </select>
          </label>
        </header>
        <main id="main" tabindex="-1" class="content" [class.full]="active() === 'form-studio'"><router-outlet /></main>
      </div>
    </div>

    <!-- Mobile sidebar -->
    <ui-drawer [(open)]="navOpen" side="left" title="UI Library">
      <ui-side-nav label="Documentation" [groups]="nav" [active]="active()" (navigate)="go($event.value)" />
    </ui-drawer>

    <ui-command-palette [(open)]="cmdOpen" [commands]="commands" placeholder="Search pages and components…" (run)="go($event.value)" />

    <ui-scroll-progress />
    @if (fxTheme()) { <ui-grain /> <ui-cursor /> }
    <ui-toast-host position="bottom-right" />
  `,
  styles: `
    :host { display: block; }
    /* Hidden until focused: the first Tab on any page offers a jump past the sidebar. */
    .skip { position: fixed; top: var(--ui-space-2); left: var(--ui-space-2); z-index: var(--ui-z-overlay);
      padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm); font-weight: 600; text-decoration: none; transform: translateY(-200%); }
    .skip:focus-visible { transform: none; outline: none; box-shadow: var(--ui-focus-ring); }
    .content:focus { outline: none; }
    .hint { margin-left: var(--ui-space-1); }
    .shell { display: flex; min-height: 100vh; }
    .sidebar { position: sticky; top: 0; align-self: flex-start; height: 100vh; width: 264px; flex: none;
      display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4);
      border-right: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .brand { display: flex; align-items: center; gap: var(--ui-space-2); text-decoration: none; color: var(--ui-color-text); }
    .logo { display: block; flex: none; width: 24px; height: 24px; border-radius: 6px; }
    .filter { display: block; }
    .nav-scroll { flex: 1; overflow: auto; margin: 0 calc(-1 * var(--ui-space-2)); padding: 0 var(--ui-space-2); }
    .side-foot { border-top: 1px solid var(--ui-color-border); padding-top: var(--ui-space-2); }
    .main-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: var(--ui-space-2);
      height: 52px; padding: 0 var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border);
      background: color-mix(in srgb, var(--ui-color-bg) 80%, transparent); backdrop-filter: blur(8px); }
    .grow { flex: 1; }
    .theme-picker select {
      appearance: none; -webkit-appearance: none;
      height: var(--ui-size-sm); padding: 0 var(--ui-space-4) 0 var(--ui-space-3);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
      cursor: pointer; transition: border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .theme-picker select:hover { border-color: var(--ui-color-primary); }
    .theme-picker select:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    .menu-btn { display: none; }
    /* App-like pages (the form studio) use the whole area under the top bar. */
    .content.full { max-width: none; padding: 0; }
    .content { padding: var(--ui-space-6); max-width: 1000px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    @media (max-width: 900px) {
      .sidebar { display: none; }
      .menu-btn { display: inline-flex; }
      .content { padding: var(--ui-space-4); }
      .content.full { padding: 0; }
      /* Phones: the theme picker shrinks (and the search button drops its shortcut hint) so the bar fits 320px. */
      .theme-picker { min-width: 0; }
      .theme-picker select { max-width: 128px; text-overflow: ellipsis; }
      .topbar { gap: var(--ui-space-1); padding: 0 var(--ui-space-3); }
      .hint { display: none; }
    }
  `,
})
export class App {
  protected readonly icons = { menu: Menu01Icon };
  protected readonly theme = inject(UiThemeService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  /** The sidebar, with real hrefs so pages can be opened in a new tab (a plain click still routes). */
  protected readonly nav: UiSideNavGroup[] = NAV.map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, href: this.location.prepareExternalUrl('/' + i.value) })),
  }));

  protected readonly active = signal('');
  protected readonly navOpen = signal(false);
  protected readonly cmdOpen = signal(false);
  protected readonly query = signal('');
  protected readonly themeLabel = computed(() => this.THEMES.find((t) => t.value === this.theme.theme())?.label ?? this.theme.theme());
  /** The shortcut that opens search, written the way this platform's keyboard labels it. */
  protected readonly shortcut = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') ? '⌘ K' : 'Ctrl K';
  /** Themes that ship the cinematic FX layer (grain + custom cursor). */
  protected readonly fxTheme = computed(() => this.theme.theme() === 'darkOrange');

  /** Theme roster for the top-bar picker (value = data-theme key). */
  protected readonly THEMES = [
    { value: 'dark', label: 'Winter Dark' },
    { value: 'light', label: 'Winter Light' },
    { value: 'darkOrange', label: 'Dark Orange' },
    { value: 'lightOrange', label: 'Light Orange' },
    { value: 'lightPink', label: 'Light Pink' },
    { value: 'darkPink', label: 'Dark Pink' },
    { value: 'goldBlack', label: 'Gold Black' },
    { value: 'goldRed', label: 'Gold Red' },
    { value: 'lightTeal', label: 'Light Teal' },
    { value: 'darkTeal', label: 'Dark Teal' },
    { value: 'lightPurple', label: 'Light Purple' },
    { value: 'darkPurple', label: 'Dark Purple' },
    { value: 'lightPurpleGold', label: 'Light Purple Gold' },
  ];

  /** Search covers every page, then every documented section (value is the route plus its anchor). */
  protected readonly commands: UiCommand[] = [
    ...NAV.flatMap((g) => g.items.map((i) => ({ label: i.label, value: i.value, group: 'Page', keywords: g.label, icon: File01Icon }))),
    ...NAV.flatMap((g) => g.items.flatMap((i) =>
      (DOC_SECTIONS[i.value] ?? []).map((s) => ({ label: s.name, value: `${i.value}#${s.anchor}`, group: i.label, icon: HashtagIcon })),
    )),
  ];

  protected readonly filtered = computed<UiSideNavGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.nav;
    return this.nav.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.active.set((e as NavigationEnd).urlAfterRedirects.replace(/^\//, '').split(/[?#]/)[0]);
    });
  }

  /** Routes to a page, or to `page#anchor` and scrolls that section into view. */
  protected go(value: string): void {
    const [page, anchor] = value.split('#');
    this.navOpen.set(false);
    this.router.navigateByUrl('/' + page + (anchor ? '#' + anchor : '')).then(() => {
      // The router scrolls to a new fragment itself, but not to the one already in the URL.
      if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
    });
  }
  protected skipToMain(e: Event): void {
    e.preventDefault();
    document.getElementById('main')?.focus();
  }
  protected onKey(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.cmdOpen.set(true);
    }
  }
  protected onFilter(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
}
