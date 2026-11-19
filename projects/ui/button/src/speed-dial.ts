import { DOCUMENT } from '@angular/common';
import {
  Component, ElementRef, booleanAttribute, computed, contentChild, effect, inject, input, model,
  output, untracked, viewChild,
} from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import { UI_SHUTTER_STILL, UiShutterLoader } from '@zouriel/ui/shutter-loader';
import { UiFab, type UiFabPlacement, type UiFabTone } from './fab';

let speedDialSeq = 0;

/** One action stacked above a `ui-speed-dial` trigger. */
export interface UiSpeedDialAction {
  id: string;
  label: string;
  /** Hugeicons icon data (import one file per icon from `@hugeicons/core-free-icons/<Name>`). */
  icon: IconSvgObject;
  disabled?: boolean;
}

/**
 * `ui-speed-dial` — a floating action button that expands into a stack of smaller round action
 * FABs above the trigger, each paired with a label pill to its inline-start side.
 *
 * - Default trigger icon is a `+` that rotates 45° into an `×` when open (`rotateIcon`).
 * - Project a `<ui-shutter-loader>` as content and it automatically stays still at rest (no
 *   rotation) and plays one burst cycle each time the dial opens or closes.
 * - Bind `[(open)]` and listen to `(action)` for the chosen action's `id`. Tapping either the
 *   action FAB or its label pill activates it and closes the dial.
 * - Dismisses on an outside tap or `Escape` (restoring focus to the trigger button), sets
 *   `aria-expanded` and `aria-controls` on the trigger `<button>`, marks the hidden actions group
 *   `inert`, and calms animations under `prefers-reduced-motion` / `.ui-no-anim`.
 * - Flutter twin: `UiSpeedDial` (`src/button/speed_dial.dart`).
 */
@Component({
  selector: 'ui-speed-dial',
  imports: [HugeiconsIconComponent, UiFab],
  providers: [{ provide: UI_SHUTTER_STILL, useValue: true }],
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
  },
  template: `
    @if (open()) {
      <div
        class="sd-backdrop"
        [attr.data-above]="aboveOverlays() ? '' : null"
        aria-hidden="true"
        (click)="close(false)"
      ></div>
    }
    <div
      class="sd"
      [class.sd-open]="open()"
      [attr.data-position]="position()"
      [attr.data-size]="size()"
      [attr.data-above]="aboveOverlays() ? '' : null"
      [style.--ui-fab-top-offset.px]="topOffset()"
      [style.--ui-fab-bottom-offset.px]="bottomOffset()"
      [style.--_sd-close-ms.ms]="closeDurationMs()"
    >
      <ui-fab
        #triggerFab
        class="sd-trigger"
        position="static"
        [size]="size()"
        [tone]="tone()"
        [disabled]="disabled()"
        [label]="triggerLabel()"
        [expanded]="open()"
        [controls]="actionsId"
        (click)="toggle()"
      >
        <span
          class="sd-trigger-icon"
          aria-hidden="true"
          [class.sd-rotate]="shouldRotate()"
          [class.sd-rotated]="shouldRotate() && open()"
        >
          <ng-content>
            <hugeicons-icon [icon]="addIcon" [size]="triggerIconSize()" [strokeWidth]="2" />
          </ng-content>
        </span>
      </ui-fab>

      <div
        #actionsEl
        [id]="actionsId"
        class="sd-actions"
        role="group"
        [attr.aria-label]="actionsLabel() ?? label()"
        [attr.aria-hidden]="!open() ? 'true' : null"
        [attr.inert]="!open() ? '' : null"
      >
        @for (item of actions(); track item.id; let i = $index) {
          <div
            class="sd-item"
            [class.sd-item-disabled]="item.disabled"
            [style.--_sd-delay.ms]="open() ? i * 45 : (actions().length - 1 - i) * 30"
          >
            <span
              class="sd-label"
              aria-hidden="true"
              (click)="runAction(item)"
            >{{ item.label }}</span>
            <span class="sd-slot">
              <ui-fab
                class="sd-action"
                position="static"
                size="sm"
                [tone]="tone()"
                [label]="item.label"
                [disabled]="item.disabled ?? false"
                (click)="runAction(item)"
              >
                <hugeicons-icon aria-hidden="true" [icon]="item.icon" [size]="18" [strokeWidth]="1.9" />
              </ui-fab>
            </span>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: contents; }
    .sd-backdrop {
      position: fixed; inset: 0;
      z-index: calc(var(--ui-z-docked) + 1);
      background: transparent;
    }
    .sd-backdrop[data-above] { z-index: calc(var(--ui-z-overlay) + 1); }

    .sd {
      --ui-fab-edge: var(--ui-space-6);
      position: fixed; z-index: var(--ui-z-docked);
      display: flex; flex-direction: column-reverse; align-items: flex-end; gap: var(--ui-space-3);
      pointer-events: none;
      transition: bottom var(--ui-motion-base) var(--ui-ease-standard), top var(--ui-motion-base) var(--ui-ease-standard);
    }
    .sd[data-above] { z-index: calc(var(--ui-z-overlay) + 1); }
    .sd.sd-open { z-index: calc(var(--ui-z-docked) + 2); }
    .sd.sd-open[data-above] { z-index: calc(var(--ui-z-overlay) + 2); }

    /* Placement mirrors ui-fab; static lays out inline inside a container. */
    .sd[data-position^="top"] { top: calc(var(--ui-fab-edge) + env(safe-area-inset-top, 0px) + var(--ui-fab-top-offset, 0px)); }
    .sd[data-position^="bottom"] { bottom: calc(var(--ui-fab-edge) + env(safe-area-inset-bottom, 0px) + var(--ui-fab-bottom-offset, 0px)); }
    .sd[data-position$="-right"] { right: calc(var(--ui-fab-edge) + env(safe-area-inset-right, 0px)); }
    .sd[data-position$="-left"] { left: calc(var(--ui-fab-edge) + env(safe-area-inset-left, 0px)); align-items: flex-start; }
    .sd[data-position$="-end"] { inset-inline-end: calc(var(--ui-fab-edge) + max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))); }
    .sd[data-position$="-start"] { inset-inline-start: calc(var(--ui-fab-edge) + max(env(safe-area-inset-left, 0px), env(safe-area-inset-right, 0px))); align-items: flex-start; }
    .sd[data-position$="-center"] { left: 0; right: 0; margin-inline: auto; width: fit-content; }
    .sd[data-position="static"] { position: relative; inset: auto; z-index: auto; }
    .sd.sd-open[data-position="static"] { z-index: calc(var(--ui-z-docked) + 2); }

    .sd-trigger,
    .sd-action { display: inline-flex; }
    .sd-trigger { pointer-events: auto; }

    .sd-trigger-icon {
      display: inline-flex; align-items: center; justify-content: center; line-height: 0; color: inherit;
    }
    .sd-trigger-icon.sd-rotate {
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .sd-trigger-icon.sd-rotated {
      transform: rotate(45deg);
    }

    .sd-actions {
      display: flex; flex-direction: column-reverse; align-items: flex-end; gap: var(--ui-space-3);
      pointer-events: none; visibility: hidden;
      transition: visibility 0ms linear var(--_sd-close-ms, 150ms);
    }
    .sd[data-position$="-start"] .sd-actions,
    .sd[data-position$="-left"] .sd-actions { align-items: flex-start; }
    .sd.sd-open .sd-actions {
      visibility: visible;
      transition: visibility 0ms linear 0ms;
    }

    .sd-item {
      display: flex; align-items: center; justify-content: flex-end; gap: var(--ui-space-2);
      opacity: 0; transform: translateY(10px) scale(0.95); transform-origin: center bottom;
      pointer-events: none; will-change: transform, opacity;
      transition:
        opacity var(--ui-motion-fast) var(--ui-ease-standard) var(--_sd-delay, 0ms),
        transform var(--ui-motion-fast) var(--ui-ease-standard) var(--_sd-delay, 0ms);
    }
    .sd[data-position$="-start"] .sd-item,
    .sd[data-position$="-left"] .sd-item { flex-direction: row-reverse; }
    .sd.sd-open .sd-item {
      opacity: 1; transform: translateY(0) scale(1);
      transition:
        opacity var(--ui-motion-fast) var(--ui-ease-decelerate) var(--_sd-delay, 0ms),
        transform var(--ui-motion-base) var(--ui-ease-spring) var(--_sd-delay, 0ms);
    }
    .sd.sd-open .sd-label,
    .sd.sd-open .sd-action { pointer-events: auto; }

    /* Keep the 40px action FAB horizontally centred directly above the trigger FAB. */
    .sd-slot {
      width: 52px; flex: none;
      display: flex; align-items: center; justify-content: center;
    }
    .sd[data-size="sm"] .sd-slot { width: 40px; }
    @media (pointer: coarse) {
      .sd[data-size="sm"] .sd-slot { width: var(--ui-size-touch); }
    }

    .sd-label {
      display: inline-flex; align-items: center; box-sizing: border-box;
      min-height: var(--ui-size-sm); padding: var(--ui-space-1) var(--ui-space-3);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); font-weight: 500; line-height: 1.2;
      white-space: nowrap; cursor: pointer; user-select: none;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    @media (hover: hover) and (pointer: fine) {
      .sd-item:not(.sd-item-disabled) .sd-label:hover { background: var(--ui-color-elevated-hover); }
    }
    .sd-item-disabled .sd-label { opacity: 0.5; cursor: not-allowed; }

    @media (prefers-reduced-motion: reduce) {
      .sd,
      .sd-trigger-icon.sd-rotate,
      .sd-actions,
      .sd-item,
      .sd.sd-open .sd-item {
        transition: none;
        transition-delay: 0ms;
      }
      .sd-item { transform: none; }
    }
    :host-context(.ui-no-anim) .sd,
    :host-context(.ui-no-anim) .sd-trigger-icon.sd-rotate,
    :host-context(.ui-no-anim) .sd-actions,
    :host-context(.ui-no-anim) .sd-item,
    :host-context(.ui-no-anim) .sd.sd-open .sd-item {
      transition: none;
      transition-delay: 0ms;
    }
    :host-context(.ui-no-anim) .sd-item { transform: none; }
  `,
})
export class UiSpeedDial {
  private readonly doc = inject(DOCUMENT);
  private readonly triggerFab = viewChild<UiFab>('triggerFab');
  private readonly actionsEl = viewChild<ElementRef<HTMLElement>>('actionsEl');
  private readonly shutter = contentChild(UiShutterLoader, { descendants: true });

  /** Actions stacked above the trigger (index 0 sits closest to the trigger). */
  actions = input<readonly UiSpeedDialAction[]>([]);
  /** Accessible name of the trigger while closed (required). */
  label = input.required<string>();
  /** Accessible name of the trigger while open; defaults to `label`. */
  closeLabel = input<string | null>(null);
  /** Accessible name of the actions group; defaults to `label`. */
  actionsLabel = input<string | null>(null);
  /** Whether the speed dial is expanded (`[(open)]`). */
  open = model(false);
  /** Screen placement (same as `ui-fab`, default `'bottom-end'`), or `'static'` for inline layout. */
  position = input<UiFabPlacement | 'static'>('bottom-end');
  /** Colour tone applied to both the trigger and action FABs. */
  tone = input<UiFabTone>('primary');
  /** Trigger FAB diameter (`'md'` 52 px or `'sm'` 40 px). Action FABs are always `'sm'`. */
  size = input<'sm' | 'md'>('md');
  /** Disables the trigger (and closes the dial if currently open). */
  disabled = input(false);
  /** Px added below the top edge for top placements. */
  topOffset = input(0);
  /** Px added above the bottom edge for bottom placements (e.g. a bottom sheet peek). */
  bottomOffset = input(0);
  /** Stacks above sheets, drawers and modal backdrops (`--ui-z-overlay` + 1/+2). */
  aboveOverlays = input(false, { transform: booleanAttribute });
  /**
   * Whether the trigger icon rotates 45° when open. `null` (default) rotates automatically unless
   * a `ui-shutter-loader` is projected inside the trigger.
   */
  rotateIcon = input<boolean | null>(null);

  /** Emits the chosen action's `id` after closing the dial. */
  action = output<string>();

  protected readonly addIcon: IconSvgObject = Add01Icon as IconSvgObject;
  protected readonly actionsId = `ui-speed-dial-actions-${speedDialSeq++}`;
  protected readonly triggerLabel = computed(() => (this.open() ? (this.closeLabel() ?? this.label()) : this.label()));
  protected readonly triggerIconSize = computed(() => (this.size() === 'sm' ? 18 : 22));
  protected readonly shouldRotate = computed(() => this.rotateIcon() ?? !this.shutter());
  protected readonly closeDurationMs = computed(() => 120 + Math.max(0, this.actions().length - 1) * 30);

  private wasOpen: boolean | null = null;

  constructor() {
    effect(() => {
      if (this.disabled() && this.open()) {
        this.open.set(false);
      }
    });

    effect(() => {
      const isOpen = this.open();
      if (this.wasOpen === null) {
        this.wasOpen = isOpen;
        return;
      }
      if (isOpen !== this.wasOpen) {
        this.wasOpen = isOpen;
        untracked(() => this.shutter()?.play());
      }
    });
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
  }

  protected close(restoreFocus = false): void {
    if (!this.open()) return;
    const focusInsideActions = !!this.actionsEl()?.nativeElement.contains(this.doc.activeElement);
    this.open.set(false);
    if (restoreFocus || focusInsideActions) {
      this.triggerFab()?.focus();
    }
  }

  protected runAction(item: UiSpeedDialAction): void {
    if (item.disabled || !this.open()) return;
    // An action button is removed from the focus order as the stack closes. Move focus back to the
    // trigger before emitting so callers that open another surface can take focus from a valid node.
    this.close(true);
    this.action.emit(item.id);
  }

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.close(true);
  }
}
