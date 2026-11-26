import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { UI_CONFIG, type UiGlassStrength } from '@zouriel/ui';
import { UI_LIQUID_REFRACTION, uiLiquidBand, uiLiquidMapUrl } from './liquid-glass';

/** How see-through a glass `ui-card` is: the shared strengths plus `'liquid'` (0.102.0). */
export type UiCardGlassStrength = UiGlassStrength | 'liquid';

let liquidIds = 0;

/** Spacing steps accepted by `ui-card [gap]` (maps to `--ui-space-N`). */
export type UiCardGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;

/** Cross-axis alignment for `ui-card` body content. */
export type UiCardAlign = 'stretch' | 'start' | 'center' | 'end';

/**
 * `ui-card` — surface container with optional header/footer slots.
 * Project header content with `[card-header]` and footer with `[card-footer]`.
 */
@Component({
  selector: 'ui-card',
  template: `
    @if (refractMap(); as m) {
      <svg class="lq-defs" aria-hidden="true" focusable="false" width="0" height="0">
        <filter [attr.id]="filterId" x="0" y="0" [attr.width]="m.w" [attr.height]="m.h" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feImage [attr.href]="m.url" x="0" y="0" [attr.width]="m.w" [attr.height]="m.h" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" [attr.scale]="m.scale" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    }
    <div
      class="ui-card"
      [class.glass]="glass()"
      [class.clear]="glass() && glassStrength() === 'clear'"
      [class.liquid]="liquid()"
      [style.--_lq-url]="refractUrl()"
      [class.no-radius]="radius() === false"
      [class.radius-xl]="radius() === 'xl'"
      [class.interactive]="interactive() || pressable()"
      [class.disabled]="(interactive() || pressable()) && disabled()"
      [attr.data-pad]="padding()"
      [attr.role]="pressable() ? 'button' : null"
      [attr.tabindex]="pressable() && !disabled() ? 0 : null"
      [attr.aria-label]="pressable() ? ariaLabel() : null"
      [attr.aria-disabled]="pressable() && disabled() ? 'true' : null"
      (click)="onClick($event)"
      (keydown)="onKeydown($event)"
    >
      <div class="hd"><ng-content select="[card-header]" /></div>
      <div
        class="bd"
        [class.bd-flex]="gap() !== null || align() !== null"
        [attr.data-gap]="gap()"
        [attr.data-align]="align()"
      ><ng-content /></div>
      <div class="ft"><ng-content select="[card-footer], ui-card-actions" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-card {
      display: flex; flex-direction: column;
      /* Fill the host so cards in a stretched context (e.g. a CSS grid) are equal height. In normal
         flow the host height is content-driven, so this resolves to auto and changes nothing. */
      height: 100%;
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
      font-family: var(--ui-font-default); line-height: 1.35;
    }
    /* Opt-in: for cards that are themselves the clickable surface — lifts the whole card on hover
       so it reads as a target, not just decoration. Static/informational cards leave this off. */
    .ui-card.interactive {
      cursor: pointer;
      transition: transform var(--ui-motion-base) var(--ui-ease-standard),
                  box-shadow var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-card.interactive:not(.disabled):hover { transform: translateY(-2px); box-shadow: var(--ui-shadow-2); border-color: var(--ui-color-border-strong); }
    .ui-card.interactive:not(.disabled):active { transform: translateY(-1px) scale(var(--ui-scale-press)); }
    /* The card is the target, so keyboard focus on the card or a link/button inside rings the whole card. */
    .ui-card.interactive:focus-visible,
    .ui-card.interactive:has(:focus-visible) { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-card.interactive.disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) {
      .ui-card.interactive:hover, .ui-card.interactive:active { transform: none; }
    }
    /* Body takes the slack so a [card-footer] (e.g. an actions row) bottom-aligns across a grid of cards. */
    .bd { flex: 1 1 auto; }
    .bd.bd-flex { display: flex; flex-direction: column; }
    .bd[data-gap="0"] { gap: 0; }
    .bd[data-gap="1"] { gap: var(--ui-space-1); }
    .bd[data-gap="2"] { gap: var(--ui-space-2); }
    .bd[data-gap="3"] { gap: var(--ui-space-3); }
    .bd[data-gap="4"] { gap: var(--ui-space-4); }
    .bd[data-gap="5"] { gap: var(--ui-space-5); }
    .bd[data-gap="6"] { gap: var(--ui-space-6); }
    .bd[data-gap="7"] { gap: var(--ui-space-7); }
    .bd[data-gap="8"] { gap: var(--ui-space-8); }
    .bd[data-gap="10"] { gap: var(--ui-space-10); }
    .bd[data-align="stretch"] { align-items: stretch; }
    .bd[data-align="start"] { align-items: flex-start; text-align: start; }
    .bd[data-align="center"] { align-items: center; text-align: center; }
    .bd[data-align="end"] { align-items: flex-end; text-align: end; }
    .ui-card.no-radius { border-radius: 0; }
    .ui-card.radius-xl { border-radius: var(--ui-radius-xl); }
    .ui-card.glass {
      background: var(--ui-glass-bg);
      backdrop-filter: blur(var(--ui-glass-blur));
      border-color: var(--ui-glass-border);
      box-shadow: var(--ui-glass-highlight), var(--ui-shadow-1);
    }
    .ui-card.glass.interactive:not(.disabled):hover { box-shadow: var(--ui-glass-highlight), var(--ui-shadow-2); }
    /* Clear (0.101.0): a light tint over a strongly blurred backdrop that is squeezed into the theme's
       frosted range, so the backdrop's colour and shape show while text stays AA over anything (tokens.css). */
    .ui-card.glass.clear {
      background: var(--ui-glass-card-clear-bg);
      -webkit-backdrop-filter: var(--ui-glass-card-clear-filter);
      backdrop-filter: var(--ui-glass-card-clear-filter);
    }
    /* Liquid (0.102.0), after Apple's Liquid Glass: at most a 20% tint, no squeeze, a light blur and more
       saturation so what is behind stays recognisable; a bright rim (top-left), a soft darker inner edge
       (bottom-right), a thin luminous border and a sheen. In Chromium the backdrop also bends near the rounded
       edge (an SVG displacement map, --_lq-url). Text gets a halo in the page colour instead of a veil, and
       the card's own controls keep their surfaces. It trades guaranteed AA over any backdrop for transparency:
       use it over a scrimmed backdrop (ui-backdrop-slideshow scrim). */
    .lq-defs { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
    .ui-card.glass.liquid {
      background: linear-gradient(135deg, var(--ui-glass-liquid-sheen) 0%, transparent 42%), var(--ui-glass-liquid-bg);
      border-color: var(--ui-glass-liquid-edge);
      -webkit-backdrop-filter: var(--ui-glass-liquid-filter);
      backdrop-filter: var(--_lq-url,) var(--ui-glass-liquid-filter);
      box-shadow:
        inset 1.5px 1.5px 0 -0.5px var(--ui-glass-liquid-rim),
        inset -1px -1px 0 0 var(--ui-glass-liquid-rim-shade),
        inset 0 0 0 1px var(--ui-glass-liquid-edge),
        var(--ui-shadow-2);
      text-shadow: var(--ui-glass-liquid-text-halo);
    }
    .ui-card.glass.liquid .hd, .ui-card.glass.liquid .ft { border-color: var(--ui-glass-liquid-edge); }
    .ui-card.glass.liquid ::ng-deep :is(button, input, textarea, select, [role='radio'], [role='checkbox'], [role='option'], [role='switch'], .ui-btn) { text-shadow: none; }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      .ui-card.glass.liquid {
        background: var(--ui-glass-bg);
        border-color: var(--ui-glass-border);
        -webkit-backdrop-filter: blur(var(--ui-glass-blur));
        backdrop-filter: blur(var(--ui-glass-blur));
        box-shadow: var(--ui-glass-highlight), var(--ui-shadow-1);
        text-shadow: none;
      }
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .ui-card.glass.liquid { background: var(--ui-color-surface); text-shadow: none; }
    }
    /* No backdrop-filter, or the user asks for less transparency / more contrast: an unfiltered backdrop
       under a light tint can't promise contrast, so a clear card is solid. */
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .ui-card.glass.clear { background: var(--ui-color-surface); }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      .ui-card.glass.clear { background: var(--ui-color-surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
    }
    .hd, .bd, .ft { padding: var(--ui-card-pad-md); }
    .ui-card[data-pad="sm"] .hd, .ui-card[data-pad="sm"] .bd, .ui-card[data-pad="sm"] .ft { padding: var(--ui-card-pad-sm); }
    .ui-card[data-pad="lg"] .hd, .ui-card[data-pad="lg"] .bd, .ui-card[data-pad="lg"] .ft { padding: var(--ui-card-pad-lg); }
    .hd { border-bottom: 1px solid var(--ui-color-border); font-weight: 600; font-size: var(--ui-font-size-md); }
    .ft { border-top: 1px solid var(--ui-color-border); }
    /* Collapse empty header/footer slots */
    .hd:empty, .ft:empty { display: none; }
  `,
})
export class UiCard {
  private config = inject(UI_CONFIG);
  padding = input<'sm' | 'md' | 'lg'>('md');
  /** Vertical spacing step between direct body children (enables flex column on the body). */
  gap = input<UiCardGap | null>(null);
  /** Cross-axis alignment of body children (enables flex column on the body). */
  align = input<UiCardAlign | null>(null);
  glass = input<boolean>(this.config.glass);
  /**
   * How see-through `glass` is (0.101.0). `'frosted'` (default): the glass panel as before.
   * `'clear'`: far less tint and a stronger blur, for a card over a busy backdrop (a liquid backdrop,
   * a ui-model-viewer, a photo): the backdrop is squeezed into the theme's frosted range first, so text,
   * muted text, primary and status colours stay AA over anything. Solid where backdrop-filter is missing
   * or under reduced transparency / more contrast.
   * `'liquid'` (0.102.0): Apple-style liquid glass, at least 80% transparent with no squeeze, a light
   * blur, a specular rim and sheen, and (Chromium) edges that bend the backdrop; text gets a halo in the
   * page colour. Not AA over every backdrop: use it over a scrimmed one. Frosted under reduced
   * transparency / more contrast; solid without backdrop-filter.
   */
  glassStrength = input<UiCardGlassStrength>('frosted');
  radius = input<boolean | 'xl'>(this.config.radius);
  /** Opt-in hover lift for cards that are themselves a clickable target, such as a card wrapped in
   *  an `<a>` or `<button>`. Visual only: the wrapping element stays the button. */
  interactive = input(false);
  /** The card itself is the button: hover lift, `role="button"`, focusable, Enter/Space and click
   *  emit `activate`. Use it instead of wrapping the card in a button, never together with one. */
  pressable = input(false);
  /** Accessible name when `pressable` is true. */
  ariaLabel = input<string | null>(null);
  /** Disables activation, focus and hover lift on an interactive or pressable card. */
  disabled = input(false);
  /** Emitted when an enabled pressable card is clicked or activated with Enter or Space. */
  activate = output<void>();

  protected readonly liquid = computed(() => this.glass() && this.glassStrength() === 'liquid');
  protected readonly filterId = `ui-lq-${++liquidIds}`;
  private readonly refractionOn = inject(UI_LIQUID_REFRACTION)();
  private readonly size = signal<{ w: number; h: number; r: number } | null>(null);
  /** The displacement map for the card's current size (Chromium only), rebuilt on resize. */
  protected readonly refractMap = computed(() => {
    const s = this.size();
    if (!this.liquid() || !this.refractionOn || !s || s.w < 8 || s.h < 8) return null;
    const band = uiLiquidBand(s.w, s.h);
    const url = uiLiquidMapUrl(s.w, s.h, s.r, band, this.host.ownerDocument);
    return url ? { url, w: s.w, h: s.h, scale: Math.round(band * 0.9) } : null;
  });
  protected readonly refractUrl = computed(() => (this.refractMap() ? `url(#${this.filterId})` : null));
  private readonly host = inject(ElementRef).nativeElement as HTMLElement;

  constructor() {
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const card = this.host.querySelector<HTMLElement>(':scope > .ui-card');
      if (!card) return;
      const w = Math.round(card.offsetWidth);
      const h = Math.round(card.offsetHeight);
      const r = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0;
      const cur = this.size();
      if (!cur || cur.w !== w || cur.h !== h || cur.r !== r) this.size.set({ w, h, r });
    };
    afterNextRender(() => {
      effect(() => {
        const on = this.liquid() && this.refractionOn;
        untracked(() => {
          if (on && !ro && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(() => measure());
            const card = this.host.querySelector(':scope > .ui-card');
            if (card) ro.observe(card);
            measure();
          } else if (!on && ro) {
            ro.disconnect();
            ro = null;
          }
        });
      }, { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => ro?.disconnect());
  }
  private readonly injector = inject(Injector);

  protected onClick(e: MouseEvent): void {
    if (!this.pressable() || this.disabled()) return;
    const target = e.target as Element | null;
    if (target && target !== e.currentTarget && target.closest('a[href], button, input, select, textarea')) return;
    this.activate.emit();
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (!this.pressable() || this.disabled()) return;
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activate.emit();
    }
  }
}
