import { Component, DestroyRef, HostAttributeToken, effect, inject, input, output, signal, untracked } from '@angular/core';
import { injectUiStrings, type UiButtonSize } from '@zouriel/ui';
import { UiButton, type UiButtonVariant } from '@zouriel/ui/button';
import { UiConfirmDialog } from '@zouriel/ui/dialog';

import { UiHoldPress } from './hold-press';

let holdSeq = 0;

/**
 * `ui-hold-button` — press and hold to confirm: for an action that shouldn't happen on a stray tap
 * (start a visit, mark as arrived). A fill grows across the button while it is held, `hold` ms long;
 * letting go early cancels it. Space or Enter held works the same from the keyboard.
 *
 * Holding is not accessible to everyone, so a tap (a press shorter than 300ms, a screen reader's
 * activation, a quick Enter) opens a confirm dialog instead, which confirms the same way. The
 * button is described by `holdHint` ("Press and hold to confirm").
 *
 *   <ui-hold-button size="xl" [block]="true" (confirmed)="arrive()">I've arrived</ui-hold-button>
 */
@Component({
  selector: 'ui-hold-button',
  imports: [UiButton, UiConfirmDialog],
  host: { '[attr.aria-label]': 'null', '[class.block]': 'block()' },
  template: `
    <ui-button
      [variant]="variant()" [size]="size()" [block]="block()" [disabled]="disabled()"
      [ariaLabel]="ariaLabel() ?? staticLabel ?? undefined" [ariaDescribedby]="hintId"
      [fill]="progress()" [fillDuration]="duration()"
      (pointerdown)="down($event)" (pointerup)="up(true)" (pointercancel)="up(false)" (pointerleave)="up(false)"
      (keydown)="keyDown($event)" (keyup)="keyUp($event)" (click)="clicked($event)" (contextmenu)="$event.preventDefault()">
      <ng-content />
    </ui-button>
    <span class="sr-only" [id]="hintId">{{ holdHint() ?? strings.holdHint }}</span>
    <ui-confirm-dialog [(open)]="confirming"
      [title]="confirmTitle() ?? strings.confirmTitle" [message]="confirmMessage()"
      [confirmLabel]="confirmLabel() ?? strings.confirm" [cancelLabel]="strings.cancel" [destructive]="destructive()"
      (confirm)="fire()" />
  `,
  styles: `
    :host { display: inline-flex; touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    :host(.block) { display: flex; }
    :host(.block) ui-button { flex: 1; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class UiHoldButton {
  protected readonly strings = injectUiStrings();
  /** How long to hold, in ms. */
  hold = input(2000);
  variant = input<UiButtonVariant>('primary');
  size = input<UiButtonSize>('md');
  block = input(false);
  disabled = input(false);
  /** Accessible name when the text doesn't say enough. A plain `aria-label` works too. */
  ariaLabel = input<string | undefined>(undefined);
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });
  /** What holding does, read with the button; defaults to the built-in holdHint string. */
  holdHint = input<string | undefined>(undefined);
  /** The tap fallback's dialog. */
  confirmTitle = input<string | undefined>(undefined);
  confirmMessage = input('');
  confirmLabel = input<string | undefined>(undefined);
  /** Style the dialog's confirm button as destructive. */
  destructive = input(false);
  /** Held to the end, or confirmed in the dialog. */
  readonly confirmed = output<void>();

  protected readonly hintId = `ui-hold-hint-${holdSeq++}`;
  /** The fill, 0 to 1, and how long it takes to get there. */
  protected readonly progress = signal(0);
  protected readonly duration = signal(0);
  protected readonly confirming = signal(false);

  /** The press-and-hold logic, shared with a holding ui-fab. */
  protected readonly press = new UiHoldPress({
    hold: () => this.hold(),
    disabled: () => this.disabled(),
    fill: (p, ms) => {
      this.duration.set(ms);
      this.progress.set(p);
    },
    openConfirm: () => this.confirming.set(true),
    fire: () => this.fire(),
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.press.destroy());
    // Disabled mid-press (the app reacting to a confirm, say): drop the press, confirm nothing.
    effect(() => {
      if (!this.disabled()) return;
      untracked(() => this.press.abort());
    });
  }

  protected down(e: PointerEvent): void {
    this.press.down(e);
  }

  protected up(released: boolean): void {
    this.press.up(released);
  }

  protected keyDown(e: KeyboardEvent): void {
    this.press.keyDown(e);
  }

  protected keyUp(e: KeyboardEvent): void {
    this.press.keyUp(e);
  }

  protected clicked(e: Event): void {
    this.press.clicked(e);
  }

  protected fire(): void {
    this.confirmed.emit();
  }
}
