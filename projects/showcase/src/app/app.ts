import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { UiText } from 'ui/text';
import { UiThemeService } from 'ui/theme';
import { UiButton, UiIconButton } from 'ui/button';
import { UiSideNav, type UiSideNavGroup } from 'ui/navigation';
import { UiDrawer, UiToastHost } from 'ui/dialog';
import { UiSearchInput } from 'ui/form';
import { UiScrollProgress, UiCursor, UiGrain } from 'ui/fx';
import { UiCommandPalette, type UiCommand } from 'ui/command-palette';
import { NAV } from './app.routes';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, UiText, UiButton, UiIconButton, UiSideNav, UiDrawer,
    UiSearchInput, UiScrollProgress, UiCursor, UiGrain, UiCommandPalette, UiToastHost,
  ],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/" (click)="go('', $event)">
          <span class="logo">◆</span><ui-text variant="label">UI Library</ui-text>
        </a>
        <ui-search-input class="filter" placeholder="Filter…" (input)="onFilter($event)" />
        <div class="nav-scroll">
          <ui-side-nav [groups]="filtered()" [active]="active()" (navigate)="go($event.value)" />
        </div>
        <div class="side-foot">
          <ui-text variant="caption">33 entry points · {{ themeName() }}</ui-text>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <ui-icon-button class="menu-btn" label="Menu" variant="ghost" (click)="navOpen.set(true)">☰</ui-icon-button>
          <ui-button variant="ghost" size="sm" (click)="cmdOpen.set(true)" class="cmd">Search docs ⌘K</ui-button>
          <span class="grow"></span>
          <label class="theme-picker">
            <span class="sr-only">Theme</span>
            <select [value]="themeName()" (change)="theme.set($any($event.target).value)">
              @for (t of THEMES; track t.value) {
                <option [value]="t.value">{{ t.label }}</option>
              }
            </select>
          </label>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>

    <!-- Mobile sidebar -->
    <ui-drawer [(open)]="navOpen" side="left" title="UI Library">
      <ui-side-nav [groups]="NAV" [active]="active()" (navigate)="go($event.value); navOpen.set(false)" />
    </ui-drawer>

    <ui-command-palette [(open)]="cmdOpen" [commands]="commands" (run)="go($event.value)" />

    <ui-scroll-progress />
    @if (fxTheme()) { <ui-grain /> <ui-cursor /> }
    <ui-toast-host position="bottom-right" />
  `,
  styles: `
    :host { display: block; }
    .shell { display: flex; min-height: 100vh; }
    .sidebar { position: sticky; top: 0; align-self: flex-start; height: 100vh; width: 264px; flex: none;
      display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-4);
      border-right: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .brand { display: flex; align-items: center; gap: var(--ui-space-2); text-decoration: none; color: var(--ui-color-text); }
    .logo { color: var(--ui-color-primary); font-size: 18px; }
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
    .content { padding: var(--ui-space-6); max-width: 1000px; margin: 0 auto; width: 100%; box-sizing: border-box; }
    @media (max-width: 900px) {
      .sidebar { display: none; }
      .menu-btn { display: inline-flex; }
      .content { padding: var(--ui-space-4); }
    }
  `,
})
export class App {
  protected readonly theme = inject(UiThemeService);
  private readonly router = inject(Router);
  protected readonly NAV = NAV;

  protected readonly active = signal('');
  protected readonly navOpen = signal(false);
  protected readonly cmdOpen = signal(false);
  protected readonly query = signal('');
  protected readonly themeName = computed(() => this.theme.theme());
  /** Themes that ship the cinematic FX layer (grain + custom cursor). */
  protected readonly fxTheme = computed(() => this.theme.theme() === 'darkOrange');

  /** Theme roster for the top-bar picker (value = data-theme key). */
  protected readonly THEMES = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'darkOrange', label: 'Dark Orange ✦' },
    { value: 'lightOrange', label: 'Light Orange' },
    { value: 'lightPink', label: 'Light Pink' },
    { value: 'darkPink', label: 'Dark Pink' },
    { value: 'goldBlack', label: 'Gold Black' },
    { value: 'goldRed', label: 'Gold Red' },
    { value: 'lightTeal', label: 'Light Teal' },
    { value: 'darkTeal', label: 'Dark Teal' },
    { value: 'lightPurple', label: 'Light Purple' },
    { value: 'darkPurple', label: 'Dark Purple' },
  ];

  protected readonly commands: UiCommand[] = NAV.flatMap((g) =>
    g.items.map((i) => ({ label: i.label, value: i.value, group: g.label, icon: '→' })),
  );

  protected readonly filtered = computed<UiSideNavGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.NAV;
    return this.NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.active.set((e as NavigationEnd).urlAfterRedirects.replace(/^\//, '').split(/[?#]/)[0]);
    });
  }

  protected go(value: string, event?: Event): void {
    event?.preventDefault();
    this.router.navigateByUrl('/' + value);
    this.navOpen.set(false);
  }
  protected onFilter(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
  }
}
