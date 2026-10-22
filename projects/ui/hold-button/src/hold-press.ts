/** A press shorter than this is a tap, not an attempt to hold. */
export const UI_HOLD_TAP_MS = 300;

/** What a hold press drives: its host's fill, its confirm fallback and its action. */
export interface UiHoldPressHost {
  /** How long to hold, in ms. */
  hold(): number;
  disabled(): boolean;
  /** Show the fill at `progress` (0 to 1), reaching it over `ms`. */
  fill(progress: number, ms: number): void;
  /** A tap, a quick Enter or an assistive activation: open the confirm dialog. */
  openConfirm(): void;
  /** Held to the end. */
  fire(): void;
}

/**
 * The press-and-hold logic shared by `ui-hold-button` and a holding `ui-fab` (0.44.0): a hold of
 * `hold()` ms fires; letting go early cancels; Space or Enter held works the same; a tap (a press
 * shorter than 300ms, a quick Enter or Space, a screen reader's activation) opens the confirm dialog.
 * Wire its methods to the control's pointer, key and click events.
 */
export class UiHoldPress {
  private pressAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** The press that just ended was a tap: the click that follows opens the dialog. */
  private tapped = false;
  /** A press is under way or just ended; the click that follows is ours to judge. */
  private pressed = false;
  /** The hold just completed: swallow the click that follows the release. */
  private done = false;

  constructor(private readonly host: UiHoldPressHost) {}

  /** Whether a press is under way. */
  get pressing(): boolean {
    return this.pressAt !== null || this.timer !== null;
  }

  down(e: PointerEvent): void {
    if (this.host.disabled() || e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.start();
  }

  up(released: boolean): void {
    if (this.pressAt === null) return;
    const ms = performance.now() - this.pressAt;
    this.pressAt = null;
    if (!this.done) this.cancel();
    this.tapped = released && !this.done && ms < UI_HOLD_TAP_MS;
  }

  keyDown(e: KeyboardEvent): void {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    // Ours to handle: a native button would click on Enter at once (and on Space at keyup).
    e.preventDefault();
    if (e.repeat || this.host.disabled() || this.pressAt !== null) return;
    this.start();
  }

  keyUp(e: KeyboardEvent): void {
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
    if (ms < UI_HOLD_TAP_MS) this.host.openConfirm();
  }

  clicked(e: Event): void {
    if (this.host.disabled()) return;
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
      this.host.openConfirm();
    }
  }

  /** Drops a press under way (the control was disabled mid-press): confirms nothing. */
  abort(): void {
    if (this.pressAt === null && !this.timer) return;
    this.pressAt = null;
    this.pressed = false;
    this.tapped = false;
    this.cancel();
  }

  destroy(): void {
    this.clearTimer();
  }

  private start(): void {
    this.done = false;
    this.tapped = false;
    this.pressed = true;
    this.pressAt = performance.now();
    const ms = this.host.hold();
    this.host.fill(1, ms);
    this.clearTimer();
    this.timer = setTimeout(() => this.complete(), ms);
  }

  private cancel(): void {
    this.clearTimer();
    this.host.fill(0, 160);
  }

  private complete(): void {
    this.timer = null;
    if (this.host.disabled()) return;
    this.done = true;
    if (typeof navigator !== 'undefined') navigator.vibrate?.(30);
    this.host.fire();
    // Let the full fill show for a moment, then empty it.
    setTimeout(() => this.host.fill(0, 160), 250);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
