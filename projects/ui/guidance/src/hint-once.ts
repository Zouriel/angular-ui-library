import { DestroyRef, Directive, effect, inject, input, output, untracked } from '@angular/core';
import { UiHint } from '@zouriel/ui/overlay';
import { injectUiGuidance, type UiTourOutcome } from './guidance';

/**
 * `uiHintOnce` — a one-off `uiHint` that goes through the app's {@link UiGuidance}: it shows once
 * `uiHintOnceWhen` is true (default true: on first render), if tips are on, the id isn't seen, no
 * other tip is on screen and the day's cap isn't reached; then it is seen for good, however it
 * closed.
 *
 *   <ui-icon-button uiHintOnce="tip.me.settings" uiHintOnceText="Your plan, sign-in and tips live here."
 *     [uiHintOnceSkipWhen]="progress.hasEvent" [uiHintOnceWhen]="!loading()" />
 *
 * Placement, duration and the × are uiHint's (`uiHintOncePlacement`, `uiHintOnceDuration`,
 * `uiHintOnceDismissible`, with uiHint's defaults). Needs `provideUiGuidance(...)`; without it,
 * it never shows.
 */
@Directive({
  selector: '[uiHintOnce]',
  hostDirectives: [
    {
      directive: UiHint,
      inputs: ['uiHint: uiHintOnceText', 'uiHintPlacement: uiHintOncePlacement', 'uiHintDuration: uiHintOnceDuration', 'uiHintDismissible: uiHintOnceDismissible'],
    },
  ],
})
export class UiHintOnce {
  /** The tip's id (shared with the other app). */
  readonly id = input.required<string>({ alias: 'uiHintOnce' });
  /** The tip's action is already done: never show it; it is marked seen silently. */
  readonly skipWhen = input(false, { alias: 'uiHintOnceSkipWhen' });
  /** Wait until this is true (the page has loaded, no dialog is open). */
  readonly when = input(true, { alias: 'uiHintOnceWhen' });
  /** How it ended: `closed`, or null when it was not shown (refused or skipped). */
  readonly done = output<UiTourOutcome | null>({ alias: 'uiHintOnceDone' });

  private readonly hint = inject(UiHint);
  private readonly guidance = injectUiGuidance();
  private asked = false;
  private gone = false;
  private settle: ((o: UiTourOutcome) => void) | null = null;

  constructor() {
    const sub = this.hint.closed.subscribe(() => this.finish());
    effect(() => {
      const when = this.when();
      const id = this.id();
      const skipWhen = this.skipWhen();
      if (!when || this.asked) return;
      untracked(() => this.ask(id, skipWhen));
    });
    inject(DestroyRef).onDestroy(() => {
      this.gone = true;
      sub.unsubscribe();
      if (this.settle) {
        this.hint.open.set(false);
        this.finish();
      }
    });
  }

  private ask(id: string, skipWhen: boolean): void {
    if (!this.guidance) return;
    this.asked = true;
    this.guidance
      .requestTip(
        id,
        () =>
          new Promise<UiTourOutcome>((resolve) => {
            this.settle = resolve;
            this.hint.open.set(true);
          }),
        { skipWhen, kind: 'tip' },
      )
      .then((o) => {
        if (!this.gone) this.done.emit(o);
      });
  }

  private finish(): void {
    const s = this.settle;
    this.settle = null;
    s?.('closed');
  }
}
