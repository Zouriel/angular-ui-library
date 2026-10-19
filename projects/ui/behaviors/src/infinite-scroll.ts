import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input, output } from '@angular/core';

/**
 * `uiInfiniteScroll` — emits `(scrolledToEnd)` when the host scrolls within
 * `threshold` px of the bottom. Re-arms once scrolled back up, or once the content grows (the
 * new items arrived), and then checks again, so a scroll that jumps straight to the end still loads.
 */
@Directive({
  selector: '[uiInfiniteScroll]',
})
export class UiInfiniteScroll implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  threshold = input(120, { alias: 'uiInfiniteScrollThreshold' });
  disabled = input(false, { alias: 'uiInfiniteScrollDisabled' });
  scrolledToEnd = output<void>();

  private armed = true;
  private lastHeight = 0;
  private mutations?: MutationObserver;
  private readonly onScroll = () => this.check();

  ngOnInit(): void {
    const el = this.host.nativeElement;
    this.lastHeight = el.scrollHeight;
    this.zone.runOutsideAngular(() => {
      el.addEventListener('scroll', this.onScroll, { passive: true });
      if (typeof MutationObserver !== 'undefined') {
        this.mutations = new MutationObserver(() => this.grown());
        this.mutations.observe(el, { childList: true, subtree: true });
      }
    });
  }
  ngOnDestroy(): void {
    this.host.nativeElement.removeEventListener('scroll', this.onScroll);
    this.mutations?.disconnect();
  }

  /**
   * New content arrived. Only after a load (while disarmed): content that was short to begin with
   * still waits for a scroll, as before.
   */
  private grown(): void {
    const h = this.host.nativeElement.scrollHeight;
    const grew = h > this.lastHeight;
    this.lastHeight = h;
    if (!grew || this.armed) return;
    this.armed = true;
    this.check();
  }

  private check(): void {
    if (this.disabled()) return;
    const el = this.host.nativeElement;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= this.threshold()) {
      if (this.armed) { this.armed = false; this.zone.run(() => this.scrolledToEnd.emit()); }
    } else {
      this.armed = true;
    }
  }
}
