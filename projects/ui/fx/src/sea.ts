import { Component, Directive, computed, input } from '@angular/core';
import { UI_ANIM, injectUiConfig } from '@zouriel/ui';
import { UI_SEA_SHAPES, UI_SEA_TONES, type UiSeaShape } from './sea-shapes';

/*
 * The maldives theme's sea backdrops. Decorative only: hidden from screen readers, never take the
 * pointer, paint from theme tokens (the maldives brand colours, or theme roles in other themes).
 * Continuous motion (the tide, the float, the shimmer) stops under prefers-reduced-motion, with
 * provideUiConfig({ animations: false }) and inside .ui-no-anim; one-shot entrances are softened to
 * a fade under reduced motion and skipped when animations are off.
 */

/** A shape's parts with their tone resolved to a CSS colour, for the templates. */
function paint(shape: UiSeaShape) {
  return shape.parts.map((p) => ({ ...p, color: UI_SEA_TONES[p.tone] }));
}

/** Shared by every sea component: the off-switches for continuous motion. */
const STILL = `
  :host(.still) *, :host-context(.ui-no-anim) * { animation: none !important; }
  @media (prefers-reduced-motion: reduce) { .moves { animation: none !important; } }
`;

export type UiWaveLayers = 2 | 3;

/**
 * `ui-wave-footer` — stacked wave bands pinned to the bottom of the nearest positioned container.
 * Each band drifts sideways, alternating direction, on a slow loop (the tide).
 */
@Component({
  selector: 'ui-wave-footer',
  host: {
    'aria-hidden': 'true',
    '[class.still]': '!animate',
    '[style.height.px]': 'height()',
    '[style.opacity]': 'opacity()',
  },
  template: `
    @for (l of bands(); track $index) {
      <svg
        class="band moves"
        [class.rev]="$index % 2 === 1"
        [style.animation-duration.s]="l.duration"
        [style.height.%]="l.height"
        [attr.viewBox]="l.shape.viewBox"
        preserveAspectRatio="none"
        focusable="false"
      >
        @for (p of l.parts; track $index) {
          <path [attr.d]="p.d" [style.fill]="l.color" [style.fill-opacity]="l.alpha" />
        }
      </svg>
    }
  `,
  styles: [
    `
      :host {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: block;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
      }
      /* Twice the container's width, repeating every half, so drifting by half loops seamlessly. */
      .band {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 200%;
        display: block;
        animation: ui-fx-tide 30s linear infinite;
      }
      .band.rev {
        animation-direction: reverse;
      }
      @keyframes ui-fx-tide {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(-50%);
        }
      }
    `,
    STILL,
  ],
})
export class UiWaveFooter {
  protected readonly animate = injectUiConfig().animations;
  /** How many bands, back to front. */
  layers = input<UiWaveLayers>(3);
  /** Height of the tallest band in px. */
  height = input(120);
  /** Opacity of the whole footer. */
  opacity = input(0.5);

  protected readonly bands = computed(() => {
    const all = [
      {
        shape: UI_SEA_SHAPES.wave1,
        height: 100,
        duration: 30,
        alpha: 0.35,
        color: UI_SEA_TONES.lagoon,
      },
      {
        shape: UI_SEA_SHAPES.wave2,
        height: 82,
        duration: 38,
        alpha: 0.55,
        color: UI_SEA_TONES.lagoon,
      },
      {
        shape: UI_SEA_SHAPES.wave3,
        height: 64,
        duration: 46,
        alpha: 1,
        color:
          'color-mix(in srgb, var(--ui-color-lagoon, var(--ui-color-secondary)) 55%, var(--ui-color-mist, var(--ui-color-bg)))',
      },
    ];
    const list = this.layers() === 2 ? [all[0], all[2]] : all;
    return list.map((b) => ({ ...b, parts: b.shape.parts }));
  });
}

/**
 * `ui-ocean-hero` — a full-bleed sea backdrop: the theme's hero gradient (in maldives, a sand and
 * coral sky over lagoon into deep teal), an optional photo, and a slow diagonal light sweep.
 * Project the hero's content; it sits above the backdrop.
 */
@Component({
  selector: 'ui-ocean-hero',
  host: { '[class.still]': '!animate', '[class.fill]': 'fill()', '[class.has-img]': '!!src()' },
  template: `
    <div class="sky" aria-hidden="true">
      @if (src()) {
        <img class="img" [src]="src()" alt="" />
        <div class="tint"></div>
      }
      @if (shimmer()) {
        <div class="sweep moves"></div>
      }
    </div>
    <div class="content"><ng-content /></div>
  `,
  styles: [
    `
      /* The gradient is on the host itself, so anything measuring what sits behind the content
         (contrast checks) sees a gradient rather than the page colour. */
      :host {
        position: relative;
        display: block;
        overflow: hidden;
        isolation: isolate;
        background: var(--ui-gradient-hero);
      }
      :host(.fill) {
        position: absolute;
        inset: 0;
      }
      .sky {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
      }
      .img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .tint {
        position: absolute;
        inset: 0;
        background: var(--ui-gradient-hero);
      }
      /* Over a photo the gradient is repeated as a wash, so the picture shows through. */
      .tint {
        opacity: 0.55;
      }
      .sweep {
        position: absolute;
        inset: -20% -60%;
        opacity: 0.18;
        background: linear-gradient(
          115deg,
          transparent 38%,
          var(--ui-color-mist, var(--ui-color-surface-raised)) 50%,
          transparent 62%
        );
        animation: ui-fx-shimmer 8s var(--ui-ease-standard) infinite;
      }
      @keyframes ui-fx-shimmer {
        0% {
          transform: translateX(-40%);
          opacity: 0;
        }
        20% {
          opacity: 0.18;
        }
        60% {
          opacity: 0.18;
        }
        80%,
        100% {
          transform: translateX(40%);
          opacity: 0;
        }
      }
      .content {
        position: relative;
        height: 100%;
      }
    `,
    STILL,
  ],
})
export class UiOceanHero {
  protected readonly animate = injectUiConfig().animations;
  /** Optional photo under the gradient wash. Decorative (empty alt). */
  src = input<string | null>(null);
  /** The slow light sweep. */
  shimmer = input(true);
  /** Fill the nearest positioned container (position: absolute; inset: 0) instead of flowing. */
  fill = input(false);
}

export type UiDecorCorner = 'bl' | 'br' | 'tl' | 'tr';

/** The corner silhouettes' shared frame: the corner, the mirror, the float. */
const DECOR_STYLES = `
  :host { position: absolute; display: block; pointer-events: none; z-index: 0; line-height: 0; }
  :host([data-corner="bl"]) { left: 0; bottom: 0; }
  :host([data-corner="br"]) { right: 0; bottom: 0; }
  :host([data-corner="tl"]) { left: 0; top: 0; }
  :host([data-corner="tr"]) { right: 0; top: 0; }
  .float { display: block; width: 100%; height: 100%; animation: ui-fx-float 5s var(--ui-ease-standard) infinite alternate; }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  :host([data-corner="br"]) svg { transform: scaleX(-1); }
  :host([data-corner="tl"]) svg { transform: scaleY(-1); }
  :host([data-corner="tr"]) svg { transform: scale(-1, -1); }
  @keyframes ui-fx-float { from { transform: translateY(0); } to { transform: translateY(-4px); } }
`;

const DECOR_TEMPLATE = `
  <span class="float moves">
    <svg [attr.viewBox]="shape.viewBox" focusable="false">
      @for (p of parts; track $index) {
        @if (p.stroke) {
          <path [attr.d]="p.d" fill="none" [style.stroke]="p.color" [attr.stroke-width]="p.stroke" stroke-linecap="round" stroke-linejoin="round" [attr.opacity]="p.opacity ?? null" />
        } @else {
          <path [attr.d]="p.d" [style.fill]="p.color" [attr.opacity]="p.opacity ?? null" />
        }
      }
    </svg>
  </span>
`;

/** `ui-coral-decor` — branching coral on a sand mound, tucked into a corner; floats gently. */
@Component({
  selector: 'ui-coral-decor',
  host: {
    'aria-hidden': 'true',
    '[class.still]': '!animate',
    '[attr.data-corner]': 'corner()',
    '[style.opacity]': 'opacity()',
    '[style.width.px]': '160 * scale()',
    '[style.height.px]': '128 * scale()',
  },
  template: DECOR_TEMPLATE,
  styles: [DECOR_STYLES, STILL],
})
export class UiCoralDecor {
  protected readonly animate = injectUiConfig().animations;
  protected readonly shape = UI_SEA_SHAPES.coral;
  protected readonly parts = paint(this.shape);
  corner = input<UiDecorCorner>('bl');
  /** Size multiplier (1 = 160 × 128px). */
  scale = input(1);
  opacity = input(0.9);
}

/** `ui-palm-decor` — two palm silhouettes leaning out of a corner; floats gently. */
@Component({
  selector: 'ui-palm-decor',
  host: {
    'aria-hidden': 'true',
    '[class.still]': '!animate',
    '[attr.data-corner]': 'corner()',
    '[style.opacity]': 'opacity()',
    '[style.width.px]': '160 * scale()',
    '[style.height.px]': '176 * scale()',
  },
  template: DECOR_TEMPLATE,
  styles: [DECOR_STYLES, STILL],
})
export class UiPalmDecor {
  protected readonly animate = injectUiConfig().animations;
  protected readonly shape = UI_SEA_SHAPES.palm;
  protected readonly parts = paint(this.shape);
  corner = input<UiDecorCorner>('bl');
  /** Size multiplier (1 = 160 × 176px). */
  scale = input(1);
  opacity = input(0.9);
}

/**
 * `ui-sunrise` — a coral sun with a soft sand glow behind a logo slot. It fades in and rises on
 * mount, then idles with a slow glow pulse.
 */
@Component({
  selector: 'ui-sunrise',
  host: { '[class.still]': '!animate', '[style.--size.px]': 'size()' },
  template: `
    <span class="rise">
      <span class="glow moves" aria-hidden="true"></span>
      <span class="disc" aria-hidden="true"></span>
      <span class="logo"><ng-content /></span>
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-grid;
        place-items: center;
        width: calc(var(--size) * 1.6);
        height: calc(var(--size) * 1.6);
      }
      .rise {
        position: relative;
        display: grid;
        place-items: center;
        width: var(--size);
        height: var(--size);
        animation: ui-sunrise-rise calc(var(--ui-motion-slow) * 2) var(--ui-ease-decelerate) both;
      }
      .glow {
        position: absolute;
        inset: -30%;
        border-radius: 50%;
        background: radial-gradient(
          circle,
          var(--ui-color-sand, var(--ui-color-accent-subtle)) 0%,
          transparent 70%
        );
        animation: ui-fx-pulse 4s var(--ui-ease-standard) infinite;
      }
      .disc {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--ui-color-coral, var(--ui-color-accent));
        box-shadow: var(--ui-glow-amber, none);
      }
      .logo {
        position: relative;
        display: grid;
        place-items: center;
        color: var(--ui-color-accent-contrast);
      }
      @keyframes ui-sunrise-rise {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes ui-sunrise-fade {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes ui-fx-pulse {
        0%,
        100% {
          opacity: 0.75;
          transform: scale(1);
        }
        50% {
          opacity: 1;
          transform: scale(1.06);
        }
      }
      /* Reduced motion keeps the entrance as a plain fade; the idle pulse stops (STILL). */
      @media (prefers-reduced-motion: reduce) {
        .rise {
          animation-name: ui-sunrise-fade;
        }
      }
    `,
    STILL,
  ],
})
export class UiSunrise {
  protected readonly animate = injectUiConfig().animations;
  /** Diameter of the sun in px. */
  size = input(120);
}

/**
 * `ui-sea-surface` — a whole sea-themed region in one element: it scopes a theme (maldives by
 * default) like `<ui-theme-provider class="ui-surface">`, paints its background, and adds the wave
 * footer and optional corner decor behind the projected content.
 */
@Component({
  selector: 'ui-sea-surface',
  imports: [UiWaveFooter, UiCoralDecor, UiPalmDecor],
  host: { class: 'ui-surface', '[attr.data-theme]': 'theme()' },
  template: `
    @if (waves()) {
      <ui-wave-footer [layers]="waveLayers()" [height]="waveHeight()" [opacity]="waveOpacity()" />
    }
    @if (coral(); as c) {
      <ui-coral-decor [corner]="c" [scale]="decorScale()" />
    }
    @if (palm(); as p) {
      <ui-palm-decor [corner]="p" [scale]="decorScale()" />
    }
    <div class="content"><ng-content /></div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      isolation: isolate;
      background: var(--ui-color-bg);
      color: var(--ui-color-text);
      font-family: var(--ui-font-default);
    }
    .content {
      position: relative;
      z-index: 1;
    }
  `,
})
export class UiSeaSurface {
  /** Theme scoped to the region; null keeps the page's theme. */
  theme = input<string | null>('maldives');
  waves = input(true);
  waveLayers = input<UiWaveLayers>(3);
  waveHeight = input(120);
  waveOpacity = input(0.5);
  /** Corner for the coral, or null for none. */
  coral = input<UiDecorCorner | null>(null);
  /** Corner for the palms, or null for none. */
  palm = input<UiDecorCorner | null>(null);
  decorScale = input(1);
}

/**
 * `[uiTide]` — staggered entrance for lists and cards: each item fades in and slides up 8px, its
 * start delayed by `tideDelay + index × tideStep` ms. Uses the shared `ui-slide-up-enter` class from
 * animations.css (load it globally), so reduced motion turns it into a fade and `.ui-no-anim` off.
 *
 *   @for (d of doctors; track d.id; let i = $index) { <ui-card [uiTide]="i">…</ui-card> }
 */
@Directive({
  selector: '[uiTide]',
  host: { '[class]': 'cls', '[style.animation-delay.ms]': 'cls ? delay() : null' },
})
export class UiTide {
  /** UI_ANIM.slideUp.enter, or nothing when the library's animations are off. */
  protected readonly cls = injectUiConfig().animations ? UI_ANIM.slideUp.enter : '';
  /** The item's position in its list. */
  uiTide = input(0, { transform: (v: number | string | null | undefined) => Number(v) || 0 });
  /** Base delay in ms before the first item. */
  tideDelay = input(0);
  /** Extra delay per index in ms. */
  tideStep = input(60);
  protected readonly delay = computed(() => this.tideDelay() + this.uiTide() * this.tideStep());
}
