import { Component, ElementRef, OnDestroy, afterNextRender, computed, inject, input, signal } from '@angular/core';

/**
 * `ui-device-frame` — a phone-shaped frame whose screen is exactly `width` × `height` CSS pixels,
 * scaled to fit the space it's given. What you project renders at true phone size (so a 390px-wide
 * page lays out as it would on a phone) and is scaled down only visually.
 *
 * `scale` is readable from a template reference, for overlays that have to line up with the screen.
 */
@Component({
  selector: 'ui-device-frame',
  host: { class: 'ui-device-frame' },
  template: `
    <div class="fit" [style.width.px]="outerW() * scale()" [style.height.px]="outerH() * scale()">
      <div class="device" [class.bare]="!bezel()" [style.width.px]="outerW()" [style.height.px]="outerH()" [style.transform]="'scale(' + scale() + ')'">
        <div class="screen" [style.width.px]="width()" [style.height.px]="height()">
          <ng-content />
        </div>
        @if (bezel() && island()) { <span class="island" aria-hidden="true"></span> }
      </div>
    </div>
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
    .fit { position: relative; flex: none; }
    .device { position: absolute; left: 0; top: 0; transform-origin: 0 0; box-sizing: border-box; padding: var(--bezel);
      border-radius: 54px; background: var(--ui-winter-black-pine, #111); box-shadow: var(--ui-shadow-3), inset 0 0 0 2px color-mix(in srgb, #fff 12%, transparent); --bezel: 12px; }
    .device.bare { padding: 0; border-radius: 0; background: none; box-shadow: var(--ui-shadow-2); --bezel: 0px; }
    .screen { position: relative; overflow: hidden; border-radius: 42px; background: var(--ui-color-bg); isolation: isolate; }
    .device.bare .screen { border-radius: var(--ui-radius); }
    .island { position: absolute; top: calc(var(--bezel) + 11px); left: 50%; width: 110px; height: 32px; translate: -50% 0;
      border-radius: 20px; background: #000; z-index: 5; pointer-events: none; }
  `,
})
export class UiDeviceFrame implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  width = input(390);
  height = input(844);
  bezel = input(true);
  island = input(true);
  /** Never scale up past this. */
  maxScale = input(1);

  private readonly avail = signal<{ w: number; h: number }>({ w: 0, h: 0 });
  protected readonly outerW = computed(() => this.width() + (this.bezel() ? 24 : 0));
  protected readonly outerH = computed(() => this.height() + (this.bezel() ? 24 : 0));
  readonly scale = computed(() => {
    const { w, h } = this.avail();
    if (!w || !h) return 1;
    return Math.max(0.1, Math.min(this.maxScale(), w / this.outerW(), h / this.outerH()));
  });

  private observer?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.observer = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        this.avail.set({ w: box.width, h: box.height });
      });
      this.observer.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
