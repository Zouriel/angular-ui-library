import { Component, booleanAttribute, input } from '@angular/core';
import { injectUiConfig } from '@zouriel/ui';

/**
 * `ui-liquid-backdrop` — the liquid themes' backdrop (theme-liquid.css): a slow, flowing satin
 * surface behind glass panels. The main brand colour is the ground; blurred pools of the second and
 * accent colours drift and turn over it, and a soft sheen of the theme's glass highlight slides across.
 *
 * Decorative only: hidden from screen readers and never takes the pointer. It fills the nearest
 * positioned container (or the viewport with `fixed`) behind its siblings; put content after it.
 * It paints from theme tokens (`--ui-liquid-main/second/accent` and their `-strength`), so in a theme
 * without them it pools the secondary and primary colours over the page background. Only transform
 * and opacity animate. The motion stops under prefers-reduced-motion, with
 * provideUiConfig({ animations: false }) and inside `.ui-no-anim`, leaving a still gradient.
 */
@Component({
  selector: 'ui-liquid-backdrop',
  host: {
    'aria-hidden': 'true',
    '[class.still]': '!animate',
    '[class.fixed]': 'fixed()',
    '[style.opacity]': 'opacity()',
  },
  template: `
    <div class="pool second moves"></div>
    <div class="pool accent moves"></div>
    <div class="pool second low moves"></div>
    <div class="sheen moves"></div>
  `,
  styles: [
    `
      :host {
        --_main: var(--ui-liquid-main, var(--ui-color-bg));
        --_second: color-mix(in srgb, var(--ui-liquid-second, var(--ui-color-secondary)) var(--ui-liquid-second-strength, 18%), var(--_main));
        --_accent: color-mix(in srgb, var(--ui-liquid-accent, var(--ui-color-primary)) var(--ui-liquid-accent-strength, 14%), var(--_main));
        position: absolute;
        inset: 0;
        display: block;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        background: var(--_main);
        contain: strict;
      }
      :host(.fixed) {
        position: fixed;
      }
      /* Each pool is a soft disc of one colour, blurred again so its edge melts into the ground. Sized
         from the larger side of the box so a pool always reaches across a phone or a wide screen. */
      .pool {
        position: absolute;
        width: 90vmax;
        height: 90vmax;
        border-radius: 50%;
        filter: blur(48px);
        will-change: transform;
        animation: ui-liquid-flow-a 26s ease-in-out infinite alternate;
      }
      .pool.second {
        top: -45vmax;
        left: -30vmax;
        background: radial-gradient(closest-side, var(--_second), transparent);
      }
      .pool.accent {
        bottom: -50vmax;
        right: -35vmax;
        background: radial-gradient(closest-side, var(--_accent), transparent);
        animation-name: ui-liquid-flow-b;
        animation-duration: 32s;
      }
      .pool.second.low {
        bottom: -60vmax;
        left: -10vmax;
        width: 70vmax;
        height: 70vmax;
        opacity: 0.7;
        animation-name: ui-liquid-flow-c;
        animation-duration: 38s;
      }
      /* The satin: a broad diagonal band of the theme's glass highlight, sliding slowly and breathing. */
      .sheen {
        position: absolute;
        inset: -50%;
        background: linear-gradient(115deg, transparent 38%, var(--ui-glass-highlight-top) 50%, transparent 62%);
        opacity: 0.22;
        animation: ui-liquid-sheen 30s ease-in-out infinite alternate;
      }
      @keyframes ui-liquid-flow-a {
        from { transform: translate(0, 0) rotate(0deg) scale(1); }
        to { transform: translate(18vmax, 12vmax) rotate(40deg) scale(1.15); }
      }
      @keyframes ui-liquid-flow-b {
        from { transform: translate(0, 0) rotate(0deg) scale(1.1); }
        to { transform: translate(-20vmax, -10vmax) rotate(-35deg) scale(0.95); }
      }
      @keyframes ui-liquid-flow-c {
        from { transform: translate(0, 0) scale(1); opacity: 0.5; }
        to { transform: translate(24vmax, -14vmax) scale(1.2); opacity: 0.8; }
      }
      @keyframes ui-liquid-sheen {
        from { transform: translate(-12%, -6%) rotate(0deg); opacity: 0.12; }
        to { transform: translate(12%, 6%) rotate(8deg); opacity: 0.28; }
      }
      :host(.still) *,
      :host-context(.ui-no-anim) * {
        animation: none !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .moves {
          animation: none !important;
        }
      }
    `,
  ],
})
export class UiLiquidBackdrop {
  protected readonly animate = injectUiConfig().animations;
  /** Cover the viewport (position: fixed) instead of the nearest positioned container. */
  fixed = input(false, { transform: booleanAttribute });
  /** Opacity of the whole backdrop, 0-1. */
  opacity = input(1);
}
