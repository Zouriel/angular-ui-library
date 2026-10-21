import {
  afterNextRender, booleanAttribute, Component, computed, effect, ElementRef, inject, Injector, input, model, PLATFORM_ID, signal, viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { injectUiStrings } from '@zouriel/ui';
import { UiScrollFade } from '@zouriel/ui/behaviors';

let sidebarSeq = 0;

/**
 * `ui-sidebar-layout` — responsive application shell. A sidebar beside the main column on desktop;
 * at or below `breakpoint` the sidebar becomes an off-canvas drawer over a dimmed backdrop. The
 * sidebar sits on the start side (the right in `dir="rtl"`) and the drawer slides in from there.
 *
 * Project the nav into `[sidebar]`, the top-bar content into `[header]`, and the page into the
 * default slot:
 *
 *   <ui-sidebar-layout [breakpoint]="860">
 *     <my-nav sidebar></my-nav>
 *     <h1 header>Page title</h1>
 *     <router-outlet></router-outlet>
 *   </ui-sidebar-layout>
 *
 * As an app shell with the app's own top bar (`[bar]="false"`) and a full-height content area that
 * scrolls inside itself (`fill`), open the drawer from the app's own menu button, shown only in
 * drawer mode:
 *
 *   <ui-sidebar-layout #shell [bar]="false" fill [(open)]="navOpen">
 *     <my-nav sidebar></my-nav>
 *     <my-top-bar [showMenu]="shell.compact()" (menu)="shell.toggle()" />
 *     <my-chat />
 *   </ui-sidebar-layout>
 *
 * The sidebar can have a fixed top and bottom: `[sidebar-header]` (a New chat button) and
 * `[sidebar-footer]` (account, settings) stay put, docked or in the drawer, and only `[sidebar]`
 * between them scrolls. With `fill` the footer sits at the bottom of the viewport; without it, the
 * header and footer stick to the top and bottom of the screen while the page scrolls.
 *
 *   <ui-sidebar-layout [bar]="false" fill>
 *     <ui-button sidebar-header block>New chat</ui-button>
 *     <my-chat-list sidebar />
 *     <my-account sidebar-footer />
 *     …
 *   </ui-sidebar-layout>
 *
 * Bind `[(open)]` to drive the drawer yourself (e.g. close it on navigation), or call `toggle()` /
 * `close()`. The breakpoint is driven by `matchMedia`, not a hardcoded CSS `@media`, so it stays
 * configurable per app. In drawer mode Escape and the backdrop close the drawer, focus moves into it
 * on open and back to whatever opened it on close, and the page behind is inert; a closed drawer is
 * inert and hidden from screen readers.
 */
@Component({
  selector: 'ui-sidebar-layout',
  imports: [CdkTrapFocus, UiScrollFade],
  host: {
    '[class.ui-compact]': 'compact()',
    '[class.ui-open]': 'drawer()',
    '[class.ui-fill]': 'fill()',
    '[class.ui-no-bar]': '!bar()',
    '[style.--ui-sb-w]': 'sidebarWidth()',
    '(keydown.escape)': 'onEscape($event)',
  },
  template: `
    <div class="backdrop" aria-hidden="true" (click)="close()"></div>
    <aside #side class="sidebar" [id]="sideId" [attr.tabindex]="compact() ? -1 : null"
           [attr.role]="compact() ? 'dialog' : null"
           [attr.aria-modal]="drawer() ? 'true' : null"
           [attr.aria-label]="compact() ? strings.sidebarLabel : null"
           [attr.inert]="compact() && !open() ? '' : null"
           [attr.aria-hidden]="compact() && !open() ? 'true' : null"
           [cdkTrapFocus]="drawer()">
      @if (compact()) {
        <!-- For keyboard and screen-reader users, who have no backdrop to tap: hidden until focused. -->
        <button type="button" class="skip-close" (click)="close()">{{ strings.sidebarClose }}</button>
      }
      <div class="sb-hd" [class.edge]="sbBody.more().start"><ng-content select="[sidebar-header]" /></div>
      <div class="sb-bd" #sbBody="uiScrollFade" uiScrollFade uiScrollFadeAxis="y" [uiScrollFadeSize]="0"><ng-content select="[sidebar]" /></div>
      <div class="sb-ft" [class.edge]="sbBody.more().end"><ng-content select="[sidebar-footer]" /></div>
    </aside>
    <div class="main" [attr.inert]="drawer() ? '' : null">
      @if (bar()) {
        <header class="bar">
          @if (compact()) {
            <button type="button" class="burger" [attr.aria-label]="strings.sidebarToggle"
                    [attr.aria-expanded]="open()" [attr.aria-controls]="sideId" (click)="toggle()">
              <span></span><span></span><span></span>
            </button>
          }
          <ng-content select="[header]" />
        </header>
      }
      <div class="content" [attr.role]="mainLandmark() ? 'main' : null"><ng-content /></div>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--ui-sb-w, 248px) minmax(0, 1fr);
      min-height: 100vh;
      font-family: var(--ui-font-default);
      /* The drawer's offset when closed: off the start edge (left in LTR, right in RTL). */
      --ui-sb-from: -100%;
    }
    /* RTL: ancestors' dir attribute for older browsers, :dir() where supported (it also handles an
       ltr island inside an rtl page, so it comes last). */
    :host-context([dir="rtl"]) { --ui-sb-from: 100%; }
    :host(:dir(rtl)) { --ui-sb-from: 100%; }
    :host(:dir(ltr)) { --ui-sb-from: -100%; }

    .backdrop { display: none; }
    /* A column: fixed header, the scrolling [sidebar] body, fixed footer. The edge padding (the
       safe area in fill and drawer mode) goes on whichever part is first and last; --sb-pt/-pb/-ps
       carry it. */
    .sidebar {
      --sb-pt: var(--ui-space-3); --sb-pb: var(--ui-space-3); --sb-ps: var(--ui-space-3);
      display: flex; flex-direction: column;
      background: var(--ui-color-surface);
      border-inline-end: 1px solid var(--ui-color-border);
      min-width: 0; min-height: 0;
      box-sizing: border-box;
      outline: none;
    }
    .sb-bd {
      flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      padding-block-start: var(--sb-pt); padding-block-end: var(--sb-pb);
      padding-inline-start: var(--sb-ps); padding-inline-end: var(--ui-space-3);
    }
    .sb-hd, .sb-ft {
      flex: none; background: inherit; z-index: 1;
      padding-block: var(--ui-space-3); padding-inline-start: var(--sb-ps); padding-inline-end: var(--ui-space-3);
      border: 0 solid transparent;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .sb-hd { padding-block-start: var(--sb-pt); border-bottom-width: 1px; }
    .sb-ft { padding-block-end: var(--sb-pb); border-top-width: 1px; }
    .sb-hd.edge, .sb-ft.edge { border-color: var(--ui-color-border); }
    .sb-hd:empty, .sb-ft:empty { display: none; }
    .sb-hd:not(:empty) + .sb-bd { padding-block-start: var(--ui-space-3); }
    .sb-bd:has(+ .sb-ft:not(:empty)) { padding-block-end: var(--ui-space-3); }
    /* Docked without fill the sidebar grows with the page: the header and footer stick to the screen. */
    :host(:not(.ui-fill):not(.ui-compact)) .sb-hd { position: sticky; top: 0; }
    :host(:not(.ui-fill):not(.ui-compact)) .sb-ft { position: sticky; bottom: 0; }
    .main { display: flex; flex-direction: column; min-width: 0; }
    .bar {
      display: flex; align-items: center; gap: var(--ui-space-3);
      box-sizing: border-box; min-height: var(--ui-size-touch);
      padding: var(--ui-space-2) var(--ui-space-6);
      border-bottom: 1px solid var(--ui-color-border);
      background: var(--ui-color-bg);
      position: sticky; top: 0; z-index: 5;
    }
    .content { min-width: 0; padding: var(--ui-shell-pad, var(--ui-space-6)); }

    .burger {
      display: inline-flex; flex-direction: column; justify-content: center; gap: 4px;
      width: var(--ui-size-md); height: var(--ui-size-md);
      padding: 0 var(--ui-space-2); background: none; border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); cursor: pointer; flex: none;
    }
    .burger span { display: block; height: 2px; border-radius: 2px; background: var(--ui-color-text); transition: opacity var(--ui-motion-fast) var(--ui-ease-standard); }
    .burger { transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .burger:hover { background: var(--ui-color-surface-hover); }
    .burger:active { transform: scale(var(--ui-scale-press)); }
    .burger:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

    .skip-close {
      position: absolute; inset-block-start: var(--ui-space-2); inset-inline-end: var(--ui-space-2); z-index: 1;
      min-height: var(--ui-size-touch); padding: 0 var(--ui-space-3);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      font: inherit; font-size: var(--ui-font-size-sm); font-weight: 600; cursor: pointer;
      /* Visually hidden until focused. */
      clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; white-space: nowrap;
    }
    .skip-close:focus-visible { clip-path: none; width: auto; height: auto; overflow: visible; outline: none; box-shadow: var(--ui-focus-ring); }

    /* Compact mode — toggled by the matchMedia-driven host class. */
    :host(.ui-compact) { grid-template-columns: minmax(0, 1fr); }
    :host(.ui-compact) .sidebar {
      position: fixed; inset-block: 0; inset-inline-start: 0;
      width: var(--ui-sb-w, 248px); max-width: 84vw; z-index: 30;
      --sb-pt: max(var(--ui-space-3), env(safe-area-inset-top)); --sb-pb: max(var(--ui-space-3), env(safe-area-inset-bottom));
      transform: translateX(var(--ui-sb-from));
      visibility: hidden;
      /* Hidden only once the slide out has finished. */
      transition: transform var(--ui-motion-base) var(--ui-ease-standard), visibility 0s linear var(--ui-motion-base);
    }
    :host(.ui-compact.ui-open) .sidebar {
      transform: translateX(0); visibility: visible; box-shadow: var(--ui-shadow-2);
      transition: transform var(--ui-motion-base) var(--ui-ease-standard), visibility 0s;
    }
    :host(.ui-compact) .backdrop {
      display: block; position: fixed; inset: 0; z-index: 20;
      background: var(--ui-color-overlay);
      opacity: 0; visibility: hidden; pointer-events: none;
      transition: opacity var(--ui-motion-base) var(--ui-ease-standard), visibility 0s linear var(--ui-motion-base);
    }
    :host(.ui-compact.ui-open) .backdrop {
      opacity: 1; visibility: visible; pointer-events: auto;
      transition: opacity var(--ui-motion-base) var(--ui-ease-standard), visibility 0s;
    }
    :host(.ui-compact) .bar { padding: var(--ui-space-2) var(--ui-space-4); }
    :host(.ui-compact) .content { padding: var(--ui-shell-pad, var(--ui-space-4)); }

    /* Fill: exactly the viewport, safe-area aware; the sidebar and the content each scroll inside. */
    :host(.ui-fill) {
      height: 100vh; height: 100dvh; min-height: 0; overflow: hidden;
      grid-template-rows: minmax(0, 1fr);
    }
    :host(.ui-fill) .sidebar {
      --sb-pt: max(var(--ui-space-3), env(safe-area-inset-top)); --sb-pb: max(var(--ui-space-3), env(safe-area-inset-bottom));
    }
    :host(.ui-fill) .main {
      min-height: 0; overflow: hidden;
      padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);
      box-sizing: border-box;
    }
    :host(.ui-fill:not(.ui-compact)) .sidebar:dir(ltr) { --sb-ps: max(var(--ui-space-3), env(safe-area-inset-left)); }
    :host(.ui-fill:not(.ui-compact)) .sidebar:dir(rtl) { --sb-ps: max(var(--ui-space-3), env(safe-area-inset-right)); }
    :host(.ui-fill:not(.ui-compact)) .main:dir(ltr) { padding-left: 0; }
    :host(.ui-fill:not(.ui-compact)) .main:dir(rtl) { padding-right: 0; }
    /* A flex column, so the app's own column (top bar, messages, composer) can take the height
       with flex: 1 and min-height: 0. No padding: the app lays out its own edges. */
    :host(.ui-fill) .content, :host(.ui-fill.ui-compact) .content {
      flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
      display: flex; flex-direction: column;
      padding: 0;
    }
    :host(.ui-fill) .bar { position: static; }

    @media (prefers-reduced-motion: reduce) {
      :host(.ui-compact) .sidebar, :host(.ui-compact.ui-open) .sidebar,
      :host(.ui-compact) .backdrop, :host(.ui-compact.ui-open) .backdrop { transition: none; }
    }
  `,
})
export class UiSidebarLayout {
  protected readonly strings = injectUiStrings();
  /** Max viewport width (px) at which the sidebar collapses into a drawer. */
  breakpoint = input(860);
  /** Sidebar width (any CSS length). */
  sidebarWidth = input('248px');
  /**
   * Whether the content region is the page's `main` landmark. Turn it off when the shell sits inside
   * another `<main>` (a preview, a docs page), since a page should have only one.
   */
  mainLandmark = input(true, { transform: booleanAttribute });
  /**
   * The built-in top bar with the menu button and the `[header]` slot. Turn it off when the app has
   * its own top bar: open the drawer through `[(open)]` / `toggle()` and show the app's menu button
   * only while `compact()`.
   */
  bar = input(true, { transform: booleanAttribute });
  /**
   * Exactly the viewport's height (100dvh, safe-area aware) instead of at least it: the sidebar and
   * the content each scroll inside themselves and the content gets no padding. For app shells with a
   * part docked at the bottom (a chat composer).
   */
  fill = input(false, { transform: booleanAttribute });
  /** Two-way: whether the drawer is open. Ignored above the breakpoint. */
  open = model(false);

  private readonly _compact = signal(false);
  /** True at or below the breakpoint (drawer mode). Read it to show the app's own menu button. */
  readonly compact = this._compact.asReadonly();
  /** The drawer is showing. */
  protected readonly drawer = computed(() => this._compact() && this.open());

  protected readonly sideId = `ui-sidebar-${sidebarSeq++}`;
  private readonly side = viewChild.required<ElementRef<HTMLElement>>('side');
  private readonly platformId = inject(PLATFORM_ID);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  /** What had focus when the drawer opened, to give it back on close. */
  private opener: HTMLElement | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    effect((onCleanup) => {
      const mql = window.matchMedia(`(max-width: ${this.breakpoint()}px)`);
      const apply = () => {
        this._compact.set(mql.matches);
        if (!mql.matches) this.open.set(false); // never leave a stale drawer open on desktop
      };
      apply();
      mql.addEventListener('change', apply);
      onCleanup(() => mql.removeEventListener('change', apply));
    });

    // Focus moves into the drawer on open and back to the opener on close.
    let was = false;
    effect(() => {
      const now = this.drawer();
      if (now === was) return;
      was = now;
      if (now) {
        const active = this.doc.activeElement;
        this.opener = active instanceof HTMLElement && active !== this.doc.body ? active : null;
        afterNextRender(() => this.side().nativeElement.focus({ preventScroll: true }), { injector: this.injector });
      } else {
        const opener = this.opener;
        this.opener = null;
        afterNextRender(() => {
          const active = this.doc.activeElement;
          const lost = !active || active === this.doc.body || this.side().nativeElement.contains(active);
          if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
        }, { injector: this.injector });
      }
    });
  }

  /** Toggle the drawer. */
  toggle(): void { this.open.update((o) => !o); }
  /** Close the drawer (call on navigation). */
  close(): void { this.open.set(false); }

  protected onEscape(e: Event): void {
    if (!this.drawer()) return;
    e.stopPropagation();
    this.close();
  }
}
