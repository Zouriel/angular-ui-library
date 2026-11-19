import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component, Directive, ElementRef, OnDestroy, inject, input, output, signal, viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { UI_CONFIG, UI_LONG_PRESS_MS, UI_LONG_PRESS_SLOP } from '@zouriel/ui';
import type { UiMenuItem } from './menu';

/** Internal panel rendered in the context-menu overlay. */
@Component({
  selector: 'ui-context-menu-panel',
  template: `
    <div #panel class="cm" [class.glass]="config.glass" [class.no-radius]="!config.radius" role="menu" (keydown)="onKeydown($event)">
      @for (item of items(); track item.value) {
        <button type="button" role="menuitem" class="mi" [class.danger]="item.danger"
                [disabled]="item.disabled" (click)="pick(item)">{{ item.label }}</button>
      }
    </div>
  `,
  styles: `
    .cm { display: flex; flex-direction: column; min-width: 180px; padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
      transform-origin: top left;
      animation: ui-scale-in var(--ui-motion-fast) var(--ui-ease-standard); }
    .cm.no-radius { border-radius: 0; }
    .cm.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); box-shadow: var(--ui-glass-highlight), var(--ui-shadow-2); }
    .mi { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3);
      background: none; border: none; border-radius: var(--ui-radius-xs); text-align: left;
      cursor: pointer; color: inherit; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    .mi:hover:not(:disabled), .mi:focus-visible { background: var(--ui-color-elevated-hover); outline: none; }
    .mi:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .mi.danger { color: var(--ui-color-danger); }
    .mi.danger:hover:not(:disabled), .mi.danger:focus-visible { background: color-mix(in srgb, var(--ui-color-danger) 12%, transparent); }
    .mi:disabled { opacity: .5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) { .cm { animation: none; } }
  `,
})
export class UiContextMenuPanel {
  protected readonly config = inject(UI_CONFIG);
  readonly items = signal<UiMenuItem[]>([]);
  onPick: (item: UiMenuItem) => void = () => {};
  onClose: () => void = () => {};
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected pick(item: UiMenuItem): void {
    if (!item.disabled) this.onPick(item);
  }

  /** Puts focus on the first enabled item, so the menu is keyboard-usable as soon as it opens. */
  focusFirst(): void {
    // A task, not a microtask: the items render on the change detection that follows the attach.
    setTimeout(() => this.itemEls()[0]?.focus());
  }

  protected onKeydown(e: KeyboardEvent): void {
    const els = this.itemEls();
    const current = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.preventDefault(); this.onClose(); return; }
    if (!els.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(current + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(current - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
  }

  private itemEls(): HTMLButtonElement[] {
    const el = this.panel()?.nativeElement;
    return el ? Array.from(el.querySelectorAll<HTMLButtonElement>('.mi:not([disabled])')) : [];
  }
}

/**
 * `uiContextMenu` — opens a menu at the pointer on right-click, on a 500 ms touch long-press, and from the keyboard
 * (the context-menu key or Shift+F10, at the element). With `[openOnClick]` a plain primary click or tap opens it too
 * (Enter/Space on a focused host then opens it as well). CDK Overlay.
 * Bind the items and listen to `(contextSelect)`.
 */
@Directive({
  selector: '[uiContextMenu]',
  host: {
    '(contextmenu)': 'onContextMenu($event)',
    '(click)': 'onClick($event)',
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'cancelPress()',
    '(pointercancel)': 'cancelPress()',
    '(keydown)': 'onKey($event)',
  },
})
export class UiContextMenu implements OnDestroy {
  private overlay = inject(Overlay);
  private readonly document = inject(DOCUMENT);
  items = input<readonly UiMenuItem[]>([], { alias: 'uiContextMenu' });
  contextSelect = output<UiMenuItem>();
  /** Also open on a plain primary click or tap (default off: right-click, long-press and keyboard only). */
  openOnClick = input(false);
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private press: { x: number; y: number; id: number } | null = null;
  /** A long press just opened the menu: the click that follows its release must not toggle anything. */
  private swallowClick = false;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cancelOnScroll = () => this.cancelPress();
  private readonly cancelOnOtherPointer = (event: PointerEvent) => {
    if (this.press && event.pointerId !== this.press.id) this.cancelPress();
  };
  private ref: OverlayRef | null = null;
  /** What had focus before the menu opened; a keyboard close (Escape or choosing) gives it back. */
  private returnTo: HTMLElement | null = null;

  protected onContextMenu(e: MouseEvent): void {
    if (!this.items().length) return;
    if (this.swallowClick) { e.preventDefault(); e.stopPropagation(); return; }
    if (this.press) {
      this.cancelPress();
      this.swallowClick = true;
    }
    e.preventDefault();
    this.open(e.clientX, e.clientY);
  }

  protected onClick(e: MouseEvent): void {
    if (this.swallowClick) { this.swallowClick = false; e.preventDefault(); e.stopPropagation(); return; }
    if (!this.openOnClick() || !this.items().length || e.button !== 0) return;
    // Keyboard activation arrives as a click with no pointer position: anchor it to the element.
    if (e.detail === 0) { this.openAtElement(); return; }
    this.open(e.clientX, e.clientY);
  }

  protected onDown(e: PointerEvent): void {
    this.cancelPress();
    this.swallowClick = false;
    if (!this.items().length || e.pointerType !== 'touch' || e.button !== 0 || !e.isPrimary) return;
    this.press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    this.pressTimer = setTimeout(() => {
      const p = this.press;
      this.cancelPress();
      if (!p) return;
      this.swallowClick = true;
      try {
        (this.document.defaultView?.navigator as Navigator | undefined)?.vibrate?.(10);
      } catch {
        /* vibration not allowed */
      }
      this.open(p.x, p.y);
    }, UI_LONG_PRESS_MS);
    this.document.addEventListener('scroll', this.cancelOnScroll, { capture: true, passive: true });
    this.document.addEventListener('pointerdown', this.cancelOnOtherPointer, { capture: true, passive: true });
  }

  protected onMove(e: PointerEvent): void {
    const p = this.press;
    if (p && e.pointerId === p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > UI_LONG_PRESS_SLOP) this.cancelPress();
  }

  protected cancelPress(): void {
    if (this.pressTimer !== null) clearTimeout(this.pressTimer);
    this.pressTimer = null;
    this.press = null;
    this.document.removeEventListener('scroll', this.cancelOnScroll, { capture: true });
    this.document.removeEventListener('pointerdown', this.cancelOnOtherPointer, { capture: true });
  }

  protected onKey(e: KeyboardEvent): void {
    if (!this.items().length) return;
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      this.openAtElement();
    } else if (this.openOnClick() && (e.key === 'Enter' || e.key === ' ') && !this.hasNativeKeyboardClick()) {
      e.preventDefault();
      this.openAtElement();
    }
  }

  private hasNativeKeyboardClick(): boolean {
    const el = this.host.nativeElement;
    return el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el instanceof HTMLInputElement;
  }

  private openAtElement(): void {
    const r = this.host.nativeElement.getBoundingClientRect();
    this.open(r.left + r.width / 2, r.top + r.height / 2);
  }

  protected open(x: number, y: number): void {
    if (!this.items().length) return;
    this.close();
    this.returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Anchored to the pointer, but flips and pushes so it never runs off the right or bottom edge.
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({ x, y })
      .withPositions([
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'top' },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
        { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
      ])
      .withPush(true)
      .withViewportMargin(8);
    this.ref = this.overlay.create({ positionStrategy, scrollStrategy: this.overlay.scrollStrategies.close() });
    const panel = this.ref.attach(new ComponentPortal(UiContextMenuPanel)).instance;
    panel.items.set([...this.items()]);
    panel.onPick = (item) => { this.contextSelect.emit(item); this.close(true); };
    panel.onClose = () => this.close(true);
    panel.focusFirst();
    setTimeout(() => this.ref?.outsidePointerEvents().subscribe((ev) => {
      if (this.swallowClick && (ev.type === 'click' || ev.type === 'contextmenu')) {
        if (ev.type === 'click') this.swallowClick = false;
        return;
      }
      this.close();
    }));
  }

  private close(restoreFocus = false): void {
    this.ref?.dispose();
    this.ref = null;
    const target = this.returnTo;
    this.returnTo = null;
    if (restoreFocus && target?.isConnected) target.focus();
  }
  ngOnDestroy(): void { this.cancelPress(); this.close(); }
}
