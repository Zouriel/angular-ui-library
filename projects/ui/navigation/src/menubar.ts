import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, ElementRef, inject, output, input, signal } from '@angular/core';

export interface UiMenubarItem { label: string; value: string; disabled?: boolean; }
export interface UiMenubarMenu { label: string; items: UiMenubarItem[]; }

let menubarSeq = 0;

/**
 * `ui-menubar` — application-style horizontal menu bar with dropdown menus (one open at a time).
 *
 * <p>Keyboard: ArrowLeft/Right move between the top items (and between open menus); ArrowDown,
 * Enter or Space open a menu and focus its first item; inside a menu ArrowUp/Down, Home and End move
 * between items, Escape closes it and returns focus to its top item, and Tab closes it.</p>
 */
@Component({
  selector: 'ui-menubar',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="mb" role="menubar">
      @for (menu of menus(); track menu.label; let i = $index) {
        <button type="button" class="top" role="menuitem" cdkOverlayOrigin #o="cdkOverlayOrigin"
                aria-haspopup="menu" [attr.aria-expanded]="openIndex() === i"
                [class.open]="openIndex() === i" (click)="toggle(i)" (mouseenter)="hoverOpen(i)" (keydown)="onTopKey($event, i)">
          {{ menu.label }}
        </button>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="o" [cdkConnectedOverlayOpen]="openIndex() === i"
                     [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8" (overlayOutsideClick)="openIndex.set(null)"
                     (attach)="focusFirst()" (detach)="onDetach(i)">
          <div class="panel" [attr.data-menubar-panel]="uid + '-' + i" role="menu" [attr.aria-label]="menu.label" (keydown)="onPanelKey($event, i)">
            @for (item of menu.items; track item.value) {
              <button type="button" role="menuitem" class="mi" [disabled]="item.disabled" (click)="choose(item)">{{ item.label }}</button>
            }
          </div>
        </ng-template>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .mb { display: flex; gap: 2px; background: var(--ui-color-surface); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); padding: 2px; font-family: var(--ui-font-default); line-height: 1.35; }
    .top { padding: var(--ui-space-1) var(--ui-space-3); background: none; border: none; border-radius: var(--ui-radius-xs); cursor: pointer;
      color: var(--ui-color-text); font: inherit; font-size: var(--ui-font-size-sm);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    .top:hover, .top.open { background: var(--ui-color-surface-hover); }
    .top:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .top { min-height: var(--ui-size-touch); } }
    /* The panel renders in the overlay container, outside the host, so it sets its own font and colour. */
    .panel { display: flex; flex-direction: column; min-width: 180px; padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35; }
    .mi { padding: var(--ui-space-2) var(--ui-space-3); background: none; border: none; border-radius: var(--ui-radius-xs); text-align: left;
      cursor: pointer; color: inherit; font: inherit;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    .mi:hover:not(:disabled), .mi:focus-visible { background: var(--ui-color-elevated-hover); outline: none; }
    .mi:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .mi:disabled { opacity: .5; cursor: not-allowed; }
  `,
})
export class UiMenubar {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  menus = input<UiMenubarMenu[]>([]);
  select = output<UiMenubarItem>();
  protected readonly openIndex = signal<number | null>(null);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    // Near the right edge of the screen, line up with the trigger's right edge instead.
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected toggle(i: number): void { this.openIndex.update((cur) => (cur === i ? null : i)); }
  protected hoverOpen(i: number): void { if (this.openIndex() !== null && this.openIndex() !== i) this.openIndex.set(i); }

  /** The overlay also closes itself (Escape is handled by the CDK too); keep the open index in step. */
  protected onDetach(i: number): void { if (this.openIndex() === i) this.openIndex.set(null); }

  protected focusFirst(): void {
    // A task, not a microtask: the panel's items render on the change detection after the attach.
    setTimeout(() => this.panelItems()[0]?.focus());
  }

  protected onTopKey(e: KeyboardEvent, i: number): void {
    const count = this.menus().length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + count) % count;
      this.topButtons()[next]?.focus();
      if (this.openIndex() !== null) this.openIndex.set(next);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.openIndex() === i) this.focusFirst();
      else this.openIndex.set(i);
    }
  }

  /** Arrow keys move between items, Escape closes the open menu. */
  protected onPanelKey(e: KeyboardEvent, i: number): void {
    if (e.key === 'Escape') { e.preventDefault(); this.closeTo(i); return; }
    if (e.key === 'Tab') { this.closeTo(i); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const count = this.menus().length;
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + count) % count;
      this.topButtons()[next]?.focus();
      this.openIndex.set(next);
      return;
    }
    const panel = e.currentTarget as HTMLElement;
    const els = Array.from(panel.querySelectorAll<HTMLButtonElement>('.mi:not([disabled])'));
    if (!els.length) return;
    const current = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(current + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(current - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
  }

  protected choose(item: UiMenubarItem): void {
    if (item.disabled) return;
    const i = this.openIndex();
    this.select.emit(item);
    if (i !== null) this.closeTo(i);
  }

  /** Closes the open menu and puts focus back on its top item. */
  private closeTo(i: number): void {
    this.openIndex.set(null);
    this.topButtons()[i]?.focus();
  }

  private topButtons(): HTMLButtonElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.mb > .top'));
  }

  /** The open panel lives in the overlay container, outside the host. */
  private panelItems(): HTMLButtonElement[] {
    const i = this.openIndex();
    if (i === null) return [];
    const panel = document.querySelector<HTMLElement>(`[data-menubar-panel="${this.uid}-${i}"]`);
    return panel ? Array.from(panel.querySelectorAll<HTMLButtonElement>('.mi:not([disabled])')) : [];
  }
  protected readonly uid = menubarSeq++;
}
