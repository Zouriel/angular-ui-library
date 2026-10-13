import { Component, OnInit, input, model, output, signal } from '@angular/core';

/**
 * `ui-intro-loader` — full-screen intro veil that wipes away after `duration`
 * (or when `[(open)]` is set false). Project a logo/wordmark as content.
 */
@Component({
  selector: 'ui-intro-loader',
  template: `
    @if (open()) {
      <div class="veil" [class.leaving]="leaving()" role="status" aria-label="Loading…" aria-live="polite">
        <div class="inner">
          <ng-content />
          <div class="track"><div class="fill"></div></div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .veil { position: fixed; inset: 0; z-index: var(--ui-z-toast, 1200); display: flex; align-items: center; justify-content: center;
      background: var(--ui-color-bg); transition: opacity 600ms cubic-bezier(.16,1,.3,1), transform 700ms cubic-bezier(.16,1,.3,1); }
    .veil.leaving { opacity: 0; transform: translateY(-3%); pointer-events: none; }
    .inner { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-4);
      font-family: var(--ui-font-display); color: var(--ui-color-text); }
    .track { width: 160px; height: 2px; background: var(--ui-color-border); border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; width: 0; border-radius: inherit;
      background: var(--ui-gradient-brand, linear-gradient(90deg, var(--ui-color-primary), var(--ui-color-primary-hover)));
      box-shadow: var(--ui-glow-amber, none); animation: ui-intro-fill var(--ui-intro-dur, 1400ms) cubic-bezier(.16,1,.3,1) forwards; }
    @keyframes ui-intro-fill { from { width: 0; } to { width: 100%; } }
    /* Reduced motion calms the exit (fade only, no lift); the veil itself is shortened in the class. */
    @media (prefers-reduced-motion: reduce) { .veil.leaving { transform: none; } }
  `,
  host: { '[style.--ui-intro-dur]': '(hold() ?? duration()) + "ms"' },
})
export class UiIntroLoader implements OnInit {
  open = model(true);
  duration = input(1400);
  done = output<void>();
  protected readonly leaving = signal(false);
  /** How long the veil actually stays, once known (shorter under reduced motion). */
  protected readonly hold = signal<number | null>(null);

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    // Under reduced motion the veil holds the page back for less time: a third of the run.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const hold = reduce ? Math.round(this.duration() / 3) : this.duration();
    this.hold.set(hold);
    setTimeout(() => this.leaving.set(true), hold);
    setTimeout(() => { this.open.set(false); this.done.emit(); }, hold + 650);
  }
}
