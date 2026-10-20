import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, PLATFORM_ID, effect, inject, input, model, viewChild } from '@angular/core';
import { UI_ANIM, UI_CONFIG, uiLeaveHidden } from '@zouriel/ui';
import { detachLayer, lockBodyScroll, unlockBodyScroll } from './overlay-layer';

let modalSeq = 0;

/**
 * `ui-modal` — centered dialog with backdrop. Traps focus (CDK a11y), locks
 * body scroll while open, closes on Escape / backdrop click, and animates with
 * the shared scale + backdrop-fade animations.
 */
@Component({
  selector: 'ui-modal',
  imports: [CdkTrapFocus],
  template: `
    @if (open()) {
      <div #layer class="ui-layer">
      <div class="backdrop" animate.enter="ui-backdrop-enter" (animate.leave)="backdropLeave($event)" (click)="onBackdrop()"></div>
      <div
        class="panel-wrap"
        (keydown.escape)="onEscape()">
        <div
          class="panel"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          [class.glass]="glass()"
          [class.no-radius]="!radius()"
          [attr.data-size]="size()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="title() ? labelId : null"
          animate.enter="ui-scale-enter"
          animate.leave="ui-scale-leave"
          (click)="$event.stopPropagation()">
          @if (title()) {
            <header class="hd">
              <span [id]="labelId" class="title">{{ title() }}</span>
              <button class="x" type="button" aria-label="Close" (click)="open.set(false)"><svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
            </header>
          }
          <div class="bd"><ng-content /></div>
          <footer class="ft"><ng-content select="[modal-footer]" /></footer>
          <!-- Where focus lands on open unless the content marks an element cdkFocusInitial (which comes
               first in the document, so it wins): the panel itself, rather than the close button, which
               showed a focus ring on every open that followed a key press. Tab then reaches the controls. -->
          <span class="focus-start" tabindex="-1" cdkFocusInitial></span>
        </div>
      </div>
      </div>
    }
  `,
  styles: `
    .ui-layer { display: contents; }
    .backdrop {
      position: fixed; inset: 0; z-index: var(--ui-z-overlay);
      background: var(--ui-color-overlay);
    }
    .panel-wrap {
      position: fixed; inset: 0; z-index: var(--ui-z-overlay);
      display: flex; align-items: center; justify-content: center;
      padding: var(--ui-space-4); pointer-events: none;
    }
    .panel {
      position: relative; pointer-events: auto;
      width: 100%; max-width: 480px; max-height: 85dvh; overflow: hidden;
      display: flex; flex-direction: column;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-3); font-family: var(--ui-font-default); line-height: 1.35;
    }
    .panel[data-size="sm"] { max-width: 360px; }
    .panel[data-size="lg"] { max-width: 720px; }
    /* A working window over everything: the whole screen, no margin, no rounding — for editors. */
    .panel-wrap:has(> .panel[data-size="full"]) { padding: 0; }
    .panel[data-size="full"] { max-width: none; max-height: none; width: 100vw; height: 100dvh; border-radius: 0; border: none; overflow: hidden; }
    .panel[data-size="full"] .bd { flex: 1; min-height: 0; min-width: 0; padding: 0; gap: 0; overflow: hidden; }
    .panel.no-radius { border-radius: 0; }
    .focus-start { position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: hidden; outline: none; }
    .panel.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .hd { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); padding: var(--ui-space-3) var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border); }
    .title { min-width: 0; overflow-wrap: anywhere; text-wrap: balance; font-weight: 600; font-size: var(--ui-font-size-md); letter-spacing: var(--ui-tracking-tight); }
    /* Only the body scrolls, so the header and footer stay put on long content. */
    .bd { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: var(--ui-space-3) var(--ui-space-4); display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .ft { flex: none; padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-color-border); display: flex; gap: var(--ui-space-2); justify-content: flex-end; }
    .ft:empty { display: none; }
    /*
      A footer's gap is between .ft's OWN children, and consumers overwhelmingly project one wrapper
      div holding every button — so .ft had a single child, the gap applied to nothing, and the
      buttons sat welded together. The wrapper carries the row instead. Scoped to a plain div so an
      element that IS the action (<ui-button modal-footer>) keeps its own box and the outer gap.
    */
    /* :where() keeps this at the lowest specificity, so a component's own footer layout (a
       destructive confirm's Cancel-left / action-right split) always wins over this default. */
    :where(.ft) ::ng-deep > :where(div[modal-footer], span[modal-footer]) {
      flex: 1 1 auto; display: flex; align-items: center; flex-wrap: wrap;
      gap: var(--ui-space-2); justify-content: flex-end; }
    .x {
      position: relative; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0; margin: calc(var(--ui-space-1) * -1) 0;
      border: none; background: transparent; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-muted); font: inherit; font-size: 16px; line-height: 1; cursor: pointer;
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
export class UiModal {
  /** Fades the backdrop out and keeps it at 0 until the panel's longer leave ends (no flash back). */
  protected readonly backdropLeave = uiLeaveHidden(UI_ANIM.backdrop.leave);

  private config = inject(UI_CONFIG);
  private doc = inject(DOCUMENT);
  open = model(false);
  title = input<string>();
  /** `full` fills the screen, with no padding around the content — for editors opened over a page. */
  size = input<'sm' | 'md' | 'lg' | 'full'>('md');
  closeOnBackdrop = input(true);
  closeOnEscape = input(true);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  protected readonly labelId = `ui-modal-${modalSeq++}`;

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly layer = viewChild<ElementRef<HTMLElement>>('layer');

  /** The layer this instance last moved to <body>; kept after close so destroy can still find it. */
  private moved: HTMLElement | null = null;
  /** Whether this instance holds one of the document's body-scroll locks. */
  private locked = false;

  constructor() {
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
      const open = this.open();
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

  protected onBackdrop(): void {
    if (this.closeOnBackdrop()) this.open.set(false);
  }
  protected onEscape(): void {
    if (this.closeOnEscape()) this.open.set(false);
  }
}
