import { Component, input } from '@angular/core';

/** `ui-marquee` — infinite horizontal scroller with edge fade; pauses on hover. */
@Component({
  selector: 'ui-marquee',
  template: `
    <div class="marquee" [style.--dur]="duration() + 's'" [style.--gap]="gap()">
      <div class="track" [class.reverse]="reverse()">
        @for (item of items(); track $index) {
          <span class="m-item"><span class="txt">{{ item }}</span><span class="star" aria-hidden="true">{{ separator() }}</span></span>
        }
      </div>
      <div class="track" [class.reverse]="reverse()" aria-hidden="true">
        @for (item of items(); track $index) {
          <span class="m-item"><span class="txt">{{ item }}</span><span class="star">{{ separator() }}</span></span>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .marquee { display: flex; gap: var(--gap, 3rem); overflow: hidden;
      mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
    .track { display: flex; gap: var(--gap, 3rem); flex-shrink: 0; animation: ui-marquee var(--dur, 38s) linear infinite; }
    .track.reverse { animation-direction: reverse; }
    .marquee:hover .track, .marquee:focus-within .track { animation-play-state: paused; }
    .m-item { display: inline-flex; align-items: center; gap: var(--ui-space-3); white-space: nowrap;
      font-family: var(--ui-font-display); font-weight: 500; color: var(--ui-color-text); line-height: 1.35;
      font-size: clamp(1.1rem, 2.4vw, 1.9rem); }
    /* Alternate items step back in colour, not opacity: they are content and keep 4.5:1. The only fade
       is the mask at the edges. */
    .m-item:nth-child(even) .txt { color: var(--ui-color-text-muted); }
    .star { color: var(--ui-color-primary); font-size: 0.7em; }
    @keyframes ui-marquee { from { transform: translateX(0); } to { transform: translateX(calc(-100% - var(--gap, 3rem))); } }
    @media (prefers-reduced-motion: reduce) { .track { animation: none; } }
  `,
})
export class UiMarquee {
  items = input<string[]>([]);
  duration = input(38);
  gap = input('3rem');
  reverse = input(false);
  separator = input('✦');
}
