import { Directive, ElementRef, NgZone, OnDestroy, afterNextRender, computed, inject, input, signal } from '@angular/core';

/**
 * `uiScrollFade` — on an element that scrolls sideways, fades out each edge that has more content
 * past it, so a cut-off row reads as "scrolls on" rather than "ends here". Nothing changes while the
 * content fits. Used by `ui-table`, `ui-segmented` and `ui-stepper`.
 *
 *   <div class="strip" uiScrollFade style="overflow-x: auto">…</div>
 */
@Directive({
  selector: '[uiScrollFade]',
  host: { '[style.mask-image]': 'mask()' },
})
export class UiScrollFade implements OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  /** Width of the fade, in px. */
  size = input(24, { alias: 'uiScrollFadeSize' });

  /** Whether there is hidden content before (left) and after (right) the visible part. */
  readonly more = signal<{ start: boolean; end: boolean }>({ start: false, end: false });
  protected readonly mask = computed(() => {
    const { start, end } = this.more();
    const s = this.size();
    if (start && end) return `linear-gradient(to right, transparent, #000 ${s}px, #000 calc(100% - ${s}px), transparent)`;
    if (end) return `linear-gradient(to right, #000 calc(100% - ${s}px), transparent)`;
    if (start) return `linear-gradient(to right, transparent, #000 ${s}px)`;
    return null;
  });

  private resize?: ResizeObserver;
  private mutations?: MutationObserver;
  private readonly onScroll = () => this.update();

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.zone.runOutsideAngular(() => {
        el.addEventListener('scroll', this.onScroll, { passive: true });
        if (typeof ResizeObserver !== 'undefined') {
          // The host's own size and its content's size both decide whether anything is hidden.
          this.resize = new ResizeObserver(() => this.update());
          this.observeAll();
          this.mutations = new MutationObserver(() => { this.observeAll(); this.update(); });
          this.mutations.observe(el, { childList: true });
        }
      });
      this.update();
    });
  }

  ngOnDestroy(): void {
    this.host.nativeElement.removeEventListener('scroll', this.onScroll);
    this.resize?.disconnect();
    this.mutations?.disconnect();
  }

  /** Re-measures; call it after changing the content in a way no resize reports. */
  update(): void {
    const el = this.host.nativeElement;
    const left = Math.abs(el.scrollLeft); // negative in right-to-left layouts
    const next = { start: left > 1, end: el.scrollWidth - el.clientWidth - left > 1 };
    const cur = this.more();
    if (next.start !== cur.start || next.end !== cur.end) this.more.set(next);
  }

  private observeAll(): void {
    const el = this.host.nativeElement;
    this.resize!.disconnect();
    this.resize!.observe(el);
    for (const child of Array.from(el.children)) this.resize!.observe(child);
  }
}
