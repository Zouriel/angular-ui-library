import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, inject, input, output, signal, viewChild } from '@angular/core';
import { UI_CONFIG, type UiSize } from '@zouriel/ui';
import type { UiButtonVariant } from './button';

export interface UiDropdownItem { label: string; value: string; disabled?: boolean; danger?: boolean; }

/** `ui-dropdown-button` — a button that opens a menu of actions (CDK Overlay). */
@Component({
  selector: 'ui-dropdown-button',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <button type="button" class="ddb" cdkOverlayOrigin #o="cdkOverlayOrigin" [attr.data-variant]="variant()" [attr.data-size]="size()"
            [class.no-radius]="!radius()" [disabled]="disabled()" aria-haspopup="menu" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <ng-content /><svg class="caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="o" [cdkConnectedOverlayOpen]="open()"
                 [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8" (overlayOutsideClick)="open.set(false)"
                 (attach)="focusItem(0)" (overlayKeydown)="onOverlayKey($event)">
      <div class="menu" role="menu" (keydown)="onMenuKey($event)">
        @for (item of items(); track item.value) {
          <button type="button" role="menuitem" class="mi" tabindex="-1" [class.danger]="item.danger" [disabled]="item.disabled" [attr.title]="item.label" (click)="choose(item)">{{ item.label }}</button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: inline-flex; }
    .ddb { display: inline-flex; align-items: center; gap: var(--ui-space-2); height: var(--ui-size-md); padding: 0 var(--ui-space-4);
      background: var(--ui-color-surface); color: var(--ui-color-text); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); font-family: var(--ui-font-default); font-size: 14px; font-weight: 500;
      letter-spacing: var(--ui-tracking-tight); cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .ddb:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .ddb:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ddb:disabled { opacity: .5; cursor: not-allowed; }
    .ddb:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ddb.no-radius { border-radius: 0; }
    .ddb[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ddb[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    .ddb[data-variant="primary"]:active:not(:disabled) { background: var(--ui-color-primary-active); }
    .ddb[data-variant="secondary"] { background: var(--ui-color-secondary); color: var(--ui-color-secondary-contrast); border-color: transparent; }
    .ddb[data-variant="secondary"]:hover:not(:disabled) { background: var(--ui-color-secondary-hover); }
    .ddb[data-variant="destructive"] { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); border-color: transparent; }
    .ddb[data-variant="destructive"]:hover:not(:disabled) { background: var(--ui-color-danger-hover); }
    .ddb[data-variant="primary"], .ddb[data-variant="secondary"], .ddb[data-variant="destructive"], .mi.danger { --ui-color-icon: currentColor; }
    .ddb[data-variant="outline"] { background: transparent; }
    .ddb[data-variant="ghost"] { background: transparent; border-color: transparent; }
    .ddb[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; padding: 0 var(--ui-space-3); }
    .ddb[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; padding: 0 var(--ui-space-6); }
    .ddb { box-sizing: border-box; }
    .caret { flex: none; opacity: .7; }
    @media (pointer: coarse) {
      .ddb { position: relative; }
      .ddb::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }
    .menu { display: flex; flex-direction: column; min-width: 180px; max-width: 320px; padding: var(--ui-space-1); box-sizing: border-box;
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      line-height: 1.35; }
    .mi { padding: var(--ui-space-2) var(--ui-space-3); background: none; border: none; border-radius: var(--ui-radius-xs); text-align: left;
      cursor: pointer; color: var(--ui-color-text); font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mi:hover:not(:disabled) { background: var(--ui-color-elevated-hover); }
    .mi:focus-visible { outline: none; background: var(--ui-color-elevated-hover); box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .mi.danger { color: var(--ui-color-danger); }
    .mi:disabled { opacity: .5; cursor: not-allowed; }
  `,
})
export class UiDropdownButton {
  private config = inject(UI_CONFIG);
  items = input<UiDropdownItem[]>([]);
  variant = input<UiButtonVariant>('secondary');
  size = input<UiSize>('md');
  disabled = input(false);
  radius = input<boolean>(this.config.radius);
  select = output<UiDropdownItem>();
  protected readonly open = signal(false);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    // Near the right edge of the screen, line up with the trigger's right edge instead.
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];
  private readonly overlay = viewChild.required(CdkConnectedOverlay);
  private readonly trigger = viewChild.required(CdkOverlayOrigin);

  protected choose(item: UiDropdownItem): void {
    if (item.disabled) return;
    this.select.emit(item);
    this.close();
  }

  private menuItems(): HTMLButtonElement[] {
    const pane = this.overlay().overlayRef?.overlayElement;
    return pane ? Array.from(pane.querySelectorAll<HTMLButtonElement>('.mi:not(:disabled)')) : [];
  }

  /** Opening moves focus into the menu so arrow keys work straight away. */
  protected focusItem(index: number): void {
    queueMicrotask(() => {
      const items = this.menuItems();
      if (items.length) items[(index + items.length) % items.length].focus();
    });
  }

  protected onMenuKey(e: KeyboardEvent): void {
    const items = this.menuItems();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); this.focusItem(at + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.focusItem(at < 0 ? -1 : at - 1); }
    else if (e.key === 'Home') { e.preventDefault(); this.focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); this.focusItem(-1); }
    else if (e.key === 'Tab') { this.open.set(false); }
  }

  protected onOverlayKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); }
  }

  /** Closes and hands focus back to the trigger, so keyboard users don't lose their place. */
  private close(): void {
    this.open.set(false);
    (this.trigger().elementRef.nativeElement as HTMLElement).focus();
  }
}
