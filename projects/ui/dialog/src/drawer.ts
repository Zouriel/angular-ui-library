import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, PLATFORM_ID, computed, effect, inject, input, model, output, signal, viewChild } from '@angular/core';
import { UI_ANIM, UI_CONFIG, uiLeaveHidden, injectUiStrings } from '@zouriel/ui';
import { UiScrollFade } from '@zouriel/ui/behaviors';
import { detachLayer, lockBodyScroll, unlockBodyScroll } from './overlay-layer';

export type UiDrawerSide = 'left' | 'right' | 'top' | 'bottom';

let drawerSeq = 0;

/**
 * `ui-drawer` — edge-anchored sheet. Slides in from `side`, traps focus, locks
 * scroll, and dismisses on Escape / backdrop click.
 *
 * Top to bottom: the title bar, an optional fixed `[drawer-header]`, the body (default slot, the
 * only part that scrolls) and an optional fixed `[drawer-footer]`, which stays at the bottom of the
 * panel clear of the home indicator. A hairline shows under the header while the body is scrolled
 * away from its top, and over the footer while more of the body is below it.
 *
 * A bottom drawer rests on the on-screen keyboard while it is up (0.41.3), whether the browser
 * shrinks the page for it or only the visual viewport, its height taken from the part left visible,
 * so its fields and footer stay in view. Until then it stayed at the screen edge, behind the keyboard.
 *
 *   <ui-drawer [(open)]="open" side="left" title="Menu">
 *     <ui-button drawer-header block>New chat</ui-button>
 *     @for (c of chats(); track c.id) { <ui-list-item>…</ui-list-item> }
 *     <div drawer-footer>My visits · Profile</div>
 *   </ui-drawer>
 */
@Component({
  selector: 'ui-drawer',
  imports: [CdkTrapFocus, UiScrollFade],
  template: `
    @if (open()) {
      <div #layer class="ui-layer">
      @if (modal()) {
        <div class="backdrop" animate.enter="ui-backdrop-enter" (animate.leave)="backdropLeave($event)" (click)="onBackdrop()"></div>
      }
      <div
        class="panel"
        [cdkTrapFocus]="modal()"
        [cdkTrapFocusAutoCapture]="modal()"
        [attr.data-side]="side()"
        [class.glass]="glass()"
        [class.no-radius]="!radius()"
        [style.--ui-slide-from]="slideFrom()"
        [style.--ui-drawer-keyboard.px]="side() === 'bottom' && keyboard() ? keyboardEdge() : null"
        [style.--ui-drawer-room.px]="side() === 'bottom' && keyboard() ? visible() : null"
        [class.on-keyboard]="side() === 'bottom' && keyboard() > 0"
        role="dialog"
        [attr.aria-modal]="modal() ? 'true' : null"
        (pointerenter)="panelEnter.emit()"
        (pointerleave)="panelLeave.emit()"
        [attr.aria-labelledby]="title() ? labelId : null"
        (keydown.escape)="onEscape()"
        animate.enter="ui-sheet-enter"
        animate.leave="ui-sheet-leave">
        @if (title()) {
          <header class="hd">
            <span [id]="labelId" class="title">{{ title() }}</span>
            <button class="x" type="button" [attr.aria-label]="strings.close" (click)="open.set(false)"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          </header>
        }
        <div class="dh" [class.edge]="bd.more().start"><ng-content select="[drawer-header]" /></div>
        <div class="bd" #bd="uiScrollFade" uiScrollFade uiScrollFadeAxis="y" [uiScrollFadeSize]="0"><ng-content /></div>
        <div class="df" [class.edge]="bd.more().end"><ng-content select="[drawer-footer]" /></div>
        <!-- Where focus lands on open unless the content marks an element cdkFocusInitial (which comes
             first in the document, so it wins): the panel itself, rather than the close button, which
             showed a focus ring on every open that followed a key press. Tab then reaches the controls. -->
        <span class="focus-start" tabindex="-1" cdkFocusInitial></span>
      </div>
      </div>
    }
  `,
  styles: `
    .ui-layer { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: var(--ui-color-overlay); }
    .panel {
      position: fixed; z-index: var(--ui-z-overlay);
      display: flex; flex-direction: column;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      box-shadow: var(--ui-shadow-3); font-family: var(--ui-font-default); line-height: 1.35;
    }
    .panel.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .panel.no-radius { border-radius: 0; }
    .focus-start { position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: hidden; outline: none; }
    .panel[data-side="left"]   { top: 0; left: 0; bottom: 0; width: min(360px, 90vw); border-radius: 0 var(--ui-radius-lg) var(--ui-radius-lg) 0; }
    .panel[data-side="right"]  { top: 0; right: 0; bottom: 0; width: min(360px, 90vw); border-radius: var(--ui-radius-lg) 0 0 var(--ui-radius-lg); }
    .panel[data-side="top"]    { top: 0; left: 0; right: 0; height: min(320px, 80dvh); padding-top: env(safe-area-inset-top); box-sizing: border-box; border-radius: 0 0 var(--ui-radius-lg) var(--ui-radius-lg); }
    /* On the keyboard while it's up: the drawer sets how far its top edge is from the layout viewport's
       bottom and the visible height (see the class docs). */
    .panel[data-side="bottom"] { bottom: var(--ui-drawer-keyboard, 0px); left: 0; right: 0; height: min(320px, calc(var(--ui-drawer-room, 100dvh) * 0.8)); padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; border-radius: var(--ui-radius-lg) var(--ui-radius-lg) 0 0; }
    .panel[data-side="bottom"].on-keyboard { padding-bottom: 0; }
    .hd { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); padding: var(--ui-space-3) var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border); }
    .title { min-width: 0; overflow-wrap: anywhere; font-weight: 600; font-size: var(--ui-font-size-md); letter-spacing: var(--ui-tracking-tight); }
    .bd { padding: var(--ui-space-3) var(--ui-space-4); overflow: auto; overscroll-behavior: contain; flex: 1; min-height: 0; }
    /* Fixed parts around the body. Each keeps a 1px border so its height never changes; the border
       shows only while the body has content scrolled out of sight on that side. */
    .dh, .df { flex: none; padding: var(--ui-space-3) var(--ui-space-4); border: 0 solid transparent;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard); }
    .dh { border-bottom-width: 1px; }
    .df { border-top-width: 1px; }
    .dh.edge, .df.edge { border-color: var(--ui-color-border); }
    .dh:empty, .df:empty { display: none; }
    /* Left and right drawers run the full height: the footer keeps clear of the home indicator
       (a bottom drawer already pads the whole panel). */
    .panel[data-side="left"] .df, .panel[data-side="right"] .df { padding-bottom: calc(var(--ui-space-3) + env(safe-area-inset-bottom, 0px)); }
    .x {
      position: relative; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; margin: calc(var(--ui-space-1) * -1) 0;
      border: none; background: transparent; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-muted); font: inherit; font-size: calc(16px * var(--ui-font-scale)); line-height: 1; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .x:active { transform: scale(var(--ui-scale-press)); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    /* Touch-only hit-slop: the visible box stays compact on desktop. */
    @media (pointer: coarse) { .x::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2); } }
  `,
})
export class UiDrawer {
  protected readonly strings = injectUiStrings();
  /** Fades the backdrop out and keeps it at 0 until the panel's longer leave ends (no flash back). */
  protected readonly backdropLeave = uiLeaveHidden(UI_ANIM.backdrop.leave);

  private config = inject(UI_CONFIG);
  private doc = inject(DOCUMENT);
  open = model(false);
  side = input<UiDrawerSide>('right');
  title = input<string>();
  closeOnBackdrop = input(true);
  closeOnEscape = input(true);
  /**
   * Modal (default): a backdrop, locked page scroll and focus kept inside. Set false for a panel that
   * sits over the page without blocking it (a peek opened on hover); Escape still closes it.
   */
  modal = input(true);
  /** The pointer entered or left the panel (for hover-opened drawers that close when it leaves). */
  readonly panelEnter = output<void>();
  readonly panelLeave = output<void>();
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  protected readonly labelId = `ui-drawer-${drawerSeq++}`;

  protected readonly slideFrom = computed(() => {
    switch (this.side()) {
      case 'left': return 'translateX(-100%)';
      case 'right': return 'translateX(100%)';
      case 'top': return 'translateY(-100%)';
      case 'bottom': return 'translateY(100%)';
    }
  });

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** How much of the layout viewport's bottom an on-screen keyboard covers (0: none). */
  protected readonly keyboard = signal(0);
  /** Distance from the layout viewport's bottom to the visible bottom while the keyboard is up. */
  protected readonly keyboardEdge = signal(0);
  /** The visible height while the keyboard is up. */
  protected readonly visible = signal(0);
  private readonly layer = viewChild<ElementRef<HTMLElement>>('layer');

  /** The layer this instance last moved to <body>; kept after close so destroy can still find it. */
  private moved: HTMLElement | null = null;
  /** Whether this instance holds one of the document's body-scroll locks. */
  private locked = false;

  constructor() {
    // The keyboard, read as ui-bottom-sheet reads it: what the visual viewport lost, however the
    // browser has panned it (Chrome on Android pans to bring the focused field into view).
    if (this.browser) {
      const onResize = () => {
        const vv = window.visualViewport;
        const lost = vv ? window.innerHeight - vv.height : 0;
        const open = !!vv && lost > 120; // less is browser chrome settling, not a keyboard
        this.keyboard.set(open ? Math.round(lost) : 0);
        this.keyboardEdge.set(open ? Math.max(0, Math.round(window.innerHeight - vv!.height - vv!.offsetTop)) : 0);
        this.visible.set(open ? Math.round(vv!.height) : 0);
      };
      onResize();
      window.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('resize', onResize);
      window.visualViewport?.addEventListener('scroll', onResize);
      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('resize', onResize);
        window.visualViewport?.removeEventListener('scroll', onResize);
      });
    }
    // Opens on its own layer at the end of <body>. Rendered where it is declared, a dialog inside a
    // sticky bar, a card or anything with a transform or backdrop-filter is positioned against that
    // box instead of the screen and comes out clipped or squashed. Angular still removes the layer
    // when it closes, wherever it lives (after the leave animations), but NOT when the owner is
    // destroyed while open: see the onDestroy below.
    effect(() => {
      const el = this.layer()?.nativeElement;
      if (!this.browser || !el || el.parentNode === this.doc.body) return;
      this.doc.body.appendChild(el);
      this.moved = el;
    });

    effect(() => {
      const open = this.open() && this.modal();
      if (!this.browser) return;
      if (open && !this.locked) {
        lockBodyScroll(this.doc);
        this.locked = true;
      } else if (!open && this.locked) {
        unlockBodyScroll(this.doc);
        this.locked = false;
      }
    });

    // Navigating away with the dialog open destroys the owner, and Angular removes only the host
    // element — the layer is not inside it any more. Take the layer down and give scroll back.
    inject(DestroyRef).onDestroy(() => {
      detachLayer(this.moved, this.doc);
      this.moved = null;
      if (this.locked) {
        unlockBodyScroll(this.doc);
        this.locked = false;
      }
    });
  }

  protected onBackdrop(): void { if (this.closeOnBackdrop()) this.open.set(false); }
  protected onEscape(): void { if (this.closeOnEscape()) this.open.set(false); }
}
