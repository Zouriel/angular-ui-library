import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Menu01Icon from '@hugeicons/core-free-icons/Menu01Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import HashtagIcon from '@hugeicons/core-free-icons/HashtagIcon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { UiText } from '@zouriel/ui/text';
import { UiThemeService } from '@zouriel/ui/theme';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiSideNav, type UiSideNavGroup } from '@zouriel/ui/navigation';
import { UiSelect } from '@zouriel/ui/form';
// Used only inside @defer blocks below (UiSelect and FormsModule too), so each loads in its own chunk instead of the initial bundle.
// (A library entry point the shell imports eagerly lands in the initial chunk with everything any page
// uses from it, so the shell keeps its eager imports to what the first paint needs.)
import { UiDrawer, UiToastHost, UiSnackbarHost } from '@zouriel/ui/dialog';
import { UiScrollProgress, UiCursor, UiGrain } from '@zouriel/ui/fx';
import { UiCommandPalette } from '@zouriel/ui/command-palette';
import type { UiCommand } from '@zouriel/ui/command-palette';
import { UiKbd } from '@zouriel/ui/link';
import { NAV } from './app.routes';

@Component({
  selector: 'app-root',
  imports: [
    HugeiconsIconComponent, FormsModule, RouterLink, RouterOutlet, UiText, UiButton, UiIconButton, UiSideNav, UiSelect, UiDrawer,
    UiScrollProgress, UiCursor, UiGrain, UiCommandPalette, UiToastHost, UiSnackbarHost, UiKbd,
  ],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip" href="#main" (click)="skipToMain($event)">Skip to content</a>
    <div class="shell">
      <aside class="sidebar" aria-label="Documentation">
        <a class="brand" routerLink="/">
          <img class="logo" src="favicon.svg" alt="" width="24" height="24" /><ui-text variant="label">UI Library</ui-text>
        </a>
        <!-- A plain search box with its own clear button (the browser's search-cancel glyph ignores the theme). -->
        <div class="filter">
          <hugeicons-icon class="filter-icon" aria-hidden="true" [icon]="icons.search" [size]="16" [strokeWidth]="1.8" />
          <input type="search" placeholder="Filter pages" aria-label="Filter pages" [value]="query()" (input)="onFilter($event)" (keydown.escape)="query.set('')" />
          @if (query()) {
            <button type="button" class="filter-clear" aria-label="Clear filter" (click)="clearFilter($event)">
              <hugeicons-icon aria-hidden="true" [icon]="icons.clear" [size]="14" [strokeWidth]="1.8" />
            </button>
          }
        </div>
        <div class="nav-scroll">
          <ui-side-nav label="Documentation" [groups]="filtered()" [active]="active()" (navigate)="go($event.value)" />
          @if (!filtered().length) { <ui-text variant="caption" class="no-match">No pages match “{{ query().trim() }}”.</ui-text> }
        </div>
        <div class="side-foot">
          <ui-text variant="caption">34 entry points · {{ themeLabel() }}</ui-text>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <ui-icon-button class="menu-btn" label="Menu" variant="ghost" (click)="openNav()"><hugeicons-icon aria-hidden="true" [icon]="icons.menu" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
          <ui-button variant="ghost" size="sm" (click)="openSearch()" class="cmd" aria-keyshortcuts="Control+K Meta+K">Search docs <ui-kbd class="hint">{{ shortcut }}</ui-kbd></ui-button>
          <span class="grow"></span>
          <!-- The library select, loaded once the page is idle so the form entry point stays out of the first load;
               until then a box of the same size shows the current theme. -->
          @defer (on idle) {
            <ui-select class="theme-picker" size="sm" label="Theme" [options]="THEMES" [ngModel]="theme.theme()" (ngModelChange)="theme.set($event)" />
          } @placeholder {
            <span class="theme-picker theme-ph" aria-hidden="true">{{ themeLabel() }}</span>
          }
        </header>
        <main id="main" tabindex="-1" class="content" [class.full]="fullWidth.has(active() ?? '')"><router-outlet /></main>
      </div>
    </div>

    <!-- Mobile sidebar: loaded the first time the menu is opened (and fetched early when idle). -->
    @defer (when navWanted(); prefetch on idle) {
      <ui-drawer [(open)]="navOpen" side="left" title="UI Library">
        <ui-side-nav label="Documentation" [groups]="nav" [active]="active()" (navigate)="go($event.value)" />
      </ui-drawer>
    }

    <!-- Search: loaded on first open (button or Ctrl/Cmd+K), together with the section index. -->
    @defer (when commands().length; prefetch on idle) {
      <ui-command-palette [(open)]="cmdOpen" [commands]="commands()" placeholder="Search pages and components…" (run)="go($event.value)" />
    }

    @defer (on idle) {
      <ui-scroll-progress />
      @if (fxTheme()) { <ui-grain /> <ui-cursor /> }
      <ui-toast-host position="bottom-right" />
      <ui-snackbar-host />
    }
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
    .sidebar { position: sticky; top: 0; align-self: flex-start; height: 100vh; width: 264px; flex: none; box-sizing: border-box;
      display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4);
      border-right: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .brand { display: flex; align-items: center; gap: var(--ui-space-2); text-decoration: none; color: var(--ui-color-text); }
    .logo { display: block; flex: none; width: 24px; height: 24px; border-radius: 6px; }
    .filter { position: relative; display: flex; align-items: center; }
    .filter-icon { position: absolute; left: var(--ui-space-3); color: var(--ui-color-text-muted); pointer-events: none; }
    .filter input { width: 100%; box-sizing: border-box; height: var(--ui-size-md); padding: 0 var(--ui-space-3) 0 calc(var(--ui-space-3) + 16px + var(--ui-space-2));
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-pill); background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .filter input::placeholder { color: var(--ui-color-text-muted); }
    .filter input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
    .filter:has(.filter-clear) input { padding-right: calc(var(--ui-space-1) + 22px + var(--ui-space-1)); }
    .filter-clear { position: absolute; right: var(--ui-space-1); display: grid; place-items: center; width: 22px; height: 22px; padding: 0;
      border: none; border-radius: var(--ui-radius-pill); background: transparent; color: var(--ui-color-text-muted); cursor: pointer; }
    .filter-clear:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .filter-clear:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .no-match { display: block; padding: var(--ui-space-2) var(--ui-space-3); color: var(--ui-color-text-muted); }
    .filter input:focus-visible { outline: none; border-color: var(--ui-color-primary); box-shadow: var(--ui-focus-ring); }
    .nav-scroll { flex: 1; overflow: auto; margin: 0 calc(-1 * var(--ui-space-2)); padding: 0 var(--ui-space-2); }
    .side-foot { border-top: 1px solid var(--ui-color-border); padding-top: var(--ui-space-2); }
    .main-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: var(--ui-space-2);
      height: 52px; padding: 0 var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border);
      background: color-mix(in srgb, var(--ui-color-bg) 80%, transparent); backdrop-filter: blur(8px); }
    .grow { flex: 1; }
    .theme-picker { width: 168px; }
    .theme-ph { display: flex; align-items: center; box-sizing: border-box; height: var(--ui-size-sm); padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: nowrap; overflow: hidden; }
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
      .theme-picker { width: 136px; min-width: 0; }
      .topbar { gap: var(--ui-space-1); padding: 0 var(--ui-space-3); }
      .hint { display: none; }
    }
  `,
})
export class App {
  /** Pages that use the whole width beside the sidebar (apps rather than documentation). */
  protected readonly fullWidth = new Set(['form-studio', 'workflow-studio']);
  protected readonly icons = { menu: Menu01Icon, search: Search01Icon, clear: Cancel01Icon };
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
  /** Set the first time the menu opens; until then the drawer isn't loaded. */
  protected readonly navWanted = signal(false);
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

  /**
   * Search covers every page, then every documented section (value is the route plus its anchor).
   * Empty until search is first opened: the section index and the palette load then.
   */
  protected readonly commands = signal<UiCommand[]>([]);
  private commandsLoading: Promise<void> | null = null;

  /** Opens search, loading the section index first the first time (the palette chunk follows it). */
  protected openSearch(): void {
    this.commandsLoading ??= import('./docs/doc-index').then(({ DOC_SECTIONS }) => {
      this.commands.set([
        ...NAV.flatMap((g) => g.items.map((i) => ({ label: i.label, value: i.value, group: 'Page', keywords: g.label, icon: File01Icon }))),
        ...NAV.flatMap((g) => g.items.flatMap((i) =>
          (DOC_SECTIONS[i.value] ?? []).map((s) => ({ label: s.name, value: `${i.value}#${s.anchor}`, group: i.label, icon: HashtagIcon })),
        )),
      ]);
    }).catch((err: unknown) => {
      this.commandsLoading = null; // let the next press retry
      console.error('Search index failed to load', err);
    });
    void this.commandsLoading.then(() => { if (this.commands().length) this.cmdOpen.set(true); });
  }

  protected openNav(): void {
    this.navWanted.set(true);
    this.navOpen.set(true);
  }

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
      this.openSearch();
    }
  }
  protected onFilter(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
  protected clearFilter(e: Event): void {
    this.query.set('');
    ((e.currentTarget as HTMLElement).previousElementSibling as HTMLInputElement | null)?.focus();
  }
}
