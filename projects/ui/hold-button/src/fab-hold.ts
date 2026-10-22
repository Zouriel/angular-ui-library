import { ComponentRef, DestroyRef, Directive, ViewContainerRef, effect, inject, input, output, untracked } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { UiFab } from '@zouriel/ui/button';
import { UiConfirmDialog } from '@zouriel/ui/dialog';
import { UiHoldPress } from './hold-press';

/**
 * `ui-fab [hold]` (0.44.0, Flutter `UiFab(hold:)`): press and hold a floating action button to
 * activate it, as `ui-hold-button` does: an SOS button that a pocket or a stray tap can't set off.
 *
 *   <ui-fab label="SOS, call for help" text="SOS" tone="danger" position="top-center" aboveOverlays
 *     [hold]="2000" confirmTitle="Send an SOS?" confirmLabel="Send SOS" destructive (confirmed)="sos()">…</ui-fab>
 *
 * Import `UiFabHold` next to `UiFab` (it lives here because the confirm dialog does). A fill in the
 * contrast colour grows across the fab from the inline start while it is held `hold` ms; letting go
 * early cancels it. Space or Enter held works the same. A tap (shorter than 300ms), a quick Enter or
 * Space, or a screen reader's activation opens a confirm dialog instead, which confirms the same
 * way. The fab is described by `holdHint` ("Press and hold to confirm"). `[hold]="null"` makes it a
 * plain fab again. Listen to `(confirmed)`, not `(click)`.
 */
@Directive({
  selector: 'ui-fab[hold]',
  host: {
    '(pointerdown)': 'on() && press.down($event)',
    '(pointerup)': 'on() && press.up(true)',
    '(pointercancel)': 'on() && press.up(false)',
    '(pointerleave)': 'on() && press.up(false)',
    '(keydown)': 'on() && press.keyDown($event)',
    '(keyup)': 'on() && press.keyUp($event)',
    '(click)': 'on() && press.clicked($event)',
    '(contextmenu)': 'on() && $event.preventDefault()',
  },
})
export class UiFabHold {
  private readonly strings = injectUiStrings();
  private readonly fab = inject(UiFab);
  /** How long to hold, in ms; null: a plain fab. */
  hold = input<number | null>(2000);
  /** What holding does, read with the fab; defaults to the built-in holdHint string. */
  holdHint = input<string | undefined>(undefined);
  /** The tap fallback's dialog. */
  confirmTitle = input<string | undefined>(undefined);
  confirmMessage = input('');
  confirmLabel = input<string | undefined>(undefined);
  /** Style the dialog's confirm button as destructive. */
  destructive = input(false);
  /** Held to the end, or confirmed in the dialog. */
  readonly confirmed = output<void>();

  private dialog: ComponentRef<UiConfirmDialog> | null = null;
  private readonly vcr = inject(ViewContainerRef);

  protected on(): boolean {
    return this.hold() !== null;
  }

  protected readonly press = new UiHoldPress({
    hold: () => this.hold() ?? 0,
    disabled: () => this.fab.disabled(),
    fill: (p, ms) => {
      this.fab.holdFillDuration.set(ms);
      this.fab.holdFill.set(p);
    },
    openConfirm: () => this.openConfirm(),
    fire: () => this.confirmed.emit(),
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.press.destroy();
      this.dialog?.destroy();
      this.fab.holdFill.set(null);
      this.fab.holdHint.set(null);
    });
    effect(() => {
      const on = this.hold() !== null;
      const hint = this.holdHint() ?? this.strings.holdHint;
      untracked(() => {
        this.fab.holdHint.set(on ? hint : null);
        // The fill exists (at 0) while holding is on, so the first press animates from empty.
        if (on && this.fab.holdFill() === null) this.fab.holdFill.set(0);
        if (!on) {
          this.press.abort();
          this.fab.holdFill.set(null);
        }
      });
    });
    effect(() => {
      if (!this.fab.disabled()) return;
      untracked(() => this.press.abort());
    });
  }

  private openConfirm(): void {
    if (!this.dialog) {
      const ref = this.vcr.createComponent(UiConfirmDialog);
      ref.instance.confirm.subscribe(() => this.confirmed.emit());
      // Closed from inside (cancel, Escape, backdrop): the next open must be a change again.
      ref.instance.open.subscribe((open) => {
        if (!open) ref.setInput('open', false);
      });
      this.dialog = ref;
    }
    const d = this.dialog;
    d.setInput('title', this.confirmTitle() ?? this.strings.confirmTitle);
    d.setInput('message', this.confirmMessage());
    d.setInput('confirmLabel', this.confirmLabel() ?? this.strings.confirm);
    d.setInput('cancelLabel', this.strings.cancel);
    d.setInput('destructive', this.destructive());
    d.setInput('open', true);
  }
}
