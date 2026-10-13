import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * `uiMagnetic` — the host gently pulls toward the cursor on hover and springs
 * back on leave (a signature "dramatic" micro-interaction). Self-contained;
 * disabled on touch / reduced-motion.
 *
 *   <a uiMagnetic [magneticStrength]="0.4">…</a>
 */
@Directive({
  selector: '[uiMagnetic]',
  host: { 'data-magnetic': '' },
})
export class UiMagnetic implements OnInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  /** Fraction of the cursor offset the element follows (0–1). */
  magneticStrength = input(0.35);
  /** Extra px around the element that still attracts the cursor. */
  magneticRadius = input(0);

  private readonly onEnter = () => (this.rect = this.host.nativeElement.getBoundingClientRect());
  private readonly onMove = (e: PointerEvent) => this.pull(e);
  private readonly onLeave = () => this.reset();
  /** The resting box, taken on entry: measuring while pulled would chase the element's own offset. */
  private rect: DOMRect | null = null;

  ngOnInit(): void {
    if (typeof window === 'undefined' || window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = this.host.nativeElement;
    // The individual `translate` property, so the host's own transform (a press scale, a hover lift)
    // keeps working; and the transition is appended to whatever the host already animates, not
    // written over it — overwriting made every hover colour change snap.
    const own = getComputedStyle(el).transition;
    const pull = 'translate .35s cubic-bezier(.16,1,.3,1)';
    el.style.transition = own && !/^all 0s/.test(own) && own !== 'none' ? `${own}, ${pull}` : pull;
    el.style.willChange = 'translate';
    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointerenter', this.onEnter);
      el.addEventListener('pointermove', this.onMove);
      el.addEventListener('pointerleave', this.onLeave);
    });
  }

  private pull(e: PointerEvent): void {
    const el = this.host.nativeElement;
    const r = this.rect ?? (this.rect = el.getBoundingClientRect());
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const s = this.magneticStrength();
    el.style.translate = `${dx * s}px ${dy * s}px`;
  }
  private reset(): void {
    this.rect = null;
    this.host.nativeElement.style.translate = '0 0';
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    el.removeEventListener('pointerenter', this.onEnter);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
  }
}
