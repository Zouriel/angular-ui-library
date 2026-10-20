import { Component, DestroyRef, HostAttributeToken, inject, input, output, signal } from '@angular/core';
import { injectUiStrings, type UiButtonSize } from '@zouriel/ui';
import { UiButton, type UiButtonVariant } from '@zouriel/ui/button';
import { UiConfirmDialog } from '@zouriel/ui/dialog';

let holdSeq = 0;

/** A press shorter than this is a tap, not an attempt to hold. */
const TAP_MS = 300;

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

  private pressAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The press that just ended was a tap: the click that follows opens the dialog. */
  private tapped = false;
  /** A press is under way or just ended; the click that follows is ours to judge. */
  private pressed = false;
  /** The hold just completed: swallow the click that follows the release. */
  private done = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  protected down(e: PointerEvent): void {
    if (this.disabled() || e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.start();
  }

  protected up(released: boolean): void {
    if (this.pressAt === null) return;
    const ms = performance.now() - this.pressAt;
    this.pressAt = null;
    if (!this.done) this.cancel();
    this.tapped = released && !this.done && ms < TAP_MS;
  }

  protected keyDown(e: KeyboardEvent): void {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Ours to handle: a native button would click on Enter at once (and on Space at keyup).
    e.preventDefault();
    if (e.repeat || this.disabled() || this.pressAt !== null) return;
    this.start();
  }

  protected keyUp(e: KeyboardEvent): void {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (this.pressAt === null) return;
    const ms = performance.now() - this.pressAt;
    this.pressAt = null;
    if (this.done) {
      this.done = false;
      this.pressed = false;
      return;
    }
    this.cancel();
    this.pressed = false;
    if (ms < TAP_MS) this.openConfirm();
  }

  protected clicked(e: Event): void {
    if (this.disabled()) return;
    if (this.done) {
      this.done = false;
      this.pressed = false;
      return;
    }
    // A click with no press before it is a screen reader or other assistive activation.
    const fallback = this.tapped || !this.pressed;
    this.tapped = false;
    this.pressed = false;
    if (fallback) {
      e.preventDefault();
      this.openConfirm();
    }
  }

  private start(): void {
    this.done = false;
    this.tapped = false;
    this.pressed = true;
    this.pressAt = performance.now();
    this.duration.set(this.hold());
    this.progress.set(1);
    this.clearTimer();
    this.timer = setTimeout(() => this.complete(), this.hold());
  }

  private cancel(): void {
    this.clearTimer();
    this.duration.set(160);
    this.progress.set(0);
  }

  private complete(): void {
    this.timer = null;
    this.done = true;
    if (typeof navigator !== 'undefined') navigator.vibrate?.(30);
    this.fire();
    // Let the full fill show for a moment, then empty it.
    setTimeout(() => {
      this.duration.set(160);
      this.progress.set(0);
    }, 250);
  }

  private openConfirm(): void {
    this.confirming.set(true);
  }

  protected fire(): void {
    this.confirmed.emit();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
