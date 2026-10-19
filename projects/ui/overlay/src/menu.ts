import {
  CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition,
} from '@angular/cdk/overlay';
import {
  Component, ElementRef, effect, inject, input, model, output, viewChild,
} from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

export interface UiMenuItem {
  label: string;
  value: string;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * `ui-menu` — dropdown menu anchored to a trigger (CDK Overlay). Project the
 * trigger with `[menu-trigger]`; pass `items` and listen to `(select)`.
 * Arrow keys move focus, Enter activates, Escape closes (WAI-ARIA menu). Choosing an item or
 * pressing Escape puts focus back on the trigger; Tab closes the menu and moves on from the trigger.
 */
@Component({
  selector: 'ui-menu',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <span #trigger class="trigger" cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="toggle()">
      <ng-content select="[menu-trigger]" />
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="open.set(false)"
      (attach)="focusFirst()"
      (detach)="open.set(false)">
      <div
        #panel
        class="ui-menu"
        [class.glass]="glass()"
        [class.no-radius]="!radius()"
        role="menu"
        (keydown)="onKeydown($event)">
        @for (item of items(); track item.value) {
          <button
            type="button"
            role="menuitem"
            class="item"
            [class.danger]="item.danger"
            [disabled]="item.disabled"
            (click)="choose(item)">
            {{ item.label }}
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .trigger { display: inline-flex; }
    .ui-menu {
      display: flex; flex-direction: column; min-width: 180px;
      padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm); line-height: 1.35;
      transform-origin: top left;
      animation: ui-scale-in var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-menu.no-radius { border-radius: 0; }
    .ui-menu.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .item {
      display: flex; align-items: center; gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3);
      background: transparent; border: none; border-radius: var(--ui-radius-xs);
      color: inherit; font: inherit; text-align: left; cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .item:hover:not(:disabled), .item:focus-visible { background: var(--ui-color-elevated-hover); outline: none; }
    /* Keyboard focus also gets an inset ring so it never reads the same as a mouse hover elsewhere. */
    .item:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .item.danger { color: var(--ui-color-danger); }
    .item.danger:hover:not(:disabled), .item.danger:focus-visible { background: color-mix(in srgb, var(--ui-color-danger) 12%, transparent); }
    .item:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) { .ui-menu { animation: none; } }
  `,
})
export class UiMenu {
  private config = inject(UI_CONFIG);
  open = model(false);
  items = input<UiMenuItem[]>([]);
  select = output<UiMenuItem>();
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);

  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  private trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    // Near the right edge of the screen, line up with the trigger's right edge instead.
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  /** The trigger tells screen readers it opens a menu, and whether the menu is open. */
  private readonly triggerAria = effect(() => {
    const open = this.open();
    const host = this.trigger().nativeElement;
    const el = host.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? host;
    el.setAttribute('aria-haspopup', 'menu');
    el.setAttribute('aria-expanded', String(open));
  });

  protected toggle(): void { this.open.update((v) => !v); }

  protected choose(item: UiMenuItem): void {
    if (item.disabled) return;
    this.select.emit(item);
    this.close();
  }

  /** Closes and hands focus back to the trigger, so a keyboard user is not dropped onto <body>. */
  private close(): void {
    this.open.set(false);
    const host = this.trigger().nativeElement;
    const target = host.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? host;
    target.focus();
  }

  protected focusFirst(): void {
    queueMicrotask(() => this.itemEls()[0]?.focus());
  }

  protected onKeydown(e: KeyboardEvent): void {
    const els = this.itemEls();
    if (!els.length) return;
    const current = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(current + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(current - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    // Not prevented: with focus back on the trigger, the browser's own Tab moves on from there.
    else if (e.key === 'Tab') this.close();
  }

  private itemEls(): HTMLButtonElement[] {
    const el = this.panel()?.nativeElement;
    return el ? Array.from(el.querySelectorAll<HTMLButtonElement>('.item:not([disabled])')) : [];
  }
}
