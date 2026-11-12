import { Component, DestroyRef, booleanAttribute, ElementRef, PLATFORM_ID, afterNextRender, computed, inject, input, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { type UiSize, injectUiStrings } from '@zouriel/ui';

/*
 * The shutter: a camera iris (a ring and six blades) that clicks shut three times and rests.
 * Drawn in a 10 x 10 box so every stroke scales with the size. The same numbers are in the
 * Flutter twin (UiShutterLoader); keep them equal.
 */

/** Ring radius, centre, open blade distance (from the centre), in the 10 x 10 drawing box. */
export const UI_SHUTTER_R = 3.05;
export const UI_SHUTTER_C = 5;
export const UI_SHUTTER_A0 = 1.47;
/** One burst cycle in seconds: clicks at 0, 0.35 and 0.70 s, then open and still until 2.1 s. */
export const UI_SHUTTER_CYCLE = 2.1;
const CLICKS = [0, 0.35, 0.7];
const CLOSE = 0.09;
const OPEN = 0.2;

/** The pixel size of the named sizes: the same boxes as `ui-spinner`. */
export const UI_SHUTTER_SIZES: Record<UiSize, number> = { sm: 14, md: 20, lg: 32 };

function easeOutCubic(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
}

/**
 * How far shut the blades are at `t` seconds into the loop: 0 open, 1 shut. Each click closes over
 * 90 ms (ease-out cubic) and opens over 200 ms; the strongest click wins where two overlap.
 */
export function uiShutterClosure(t: number): number {
  const cyc = ((t % UI_SHUTTER_CYCLE) + UI_SHUTTER_CYCLE) % UI_SHUTTER_CYCLE;
  let v = 0;
  for (const s of CLICKS) {
    const d = cyc - s;
    if (d < 0) continue;
    if (d < CLOSE) v = Math.max(v, easeOutCubic(d / CLOSE));
    else if (d < CLOSE + OPEN) v = Math.max(v, 1 - easeOutCubic((d - CLOSE) / OPEN));
  }
  return v;
}

/** The blades' distance from the centre for a closure `v` (0 open, 1 shut). */
export function uiShutterBladeDistance(v: number): number {
  return UI_SHUTTER_A0 * (1 - 0.92 * v);
}

/** One blade: a straight stroke from (x1, y1) to (x2, y2) in the 10 x 10 box. */
export interface UiShutterBlade { x1: number; y1: number; x2: number; y2: number }

/** The six blades at distance `a` from the centre (see {@link uiShutterBladeDistance}). */
export function uiShutterBlades(a: number): UiShutterBlade[] {
  const R = UI_SHUTTER_R, C = UI_SHUTTER_C, A0 = UI_SHUTTER_A0;
  const sEnd = Math.sqrt(R * R - a * a) * 0.97;
  const sStart = -0.85 * (a / A0) - 0.15 * (1 - a / A0);
  const out: UiShutterBlade[] = [];
  for (let i = 0; i < 6; i++) {
    const th = (i * Math.PI) / 3 + 0.26;
    const nx = Math.cos(th), ny = Math.sin(th);
    const tx = -ny, ty = nx;
    const qx = C + a * nx, qy = C + a * ny;
    out.push({ x1: qx + sStart * tx, y1: qy + sStart * ty, x2: qx + sEnd * tx, y2: qy + sEnd * ty });
  }
  return out;
}

/** Reduced motion: no blade moves; the whole mark breathes 1 -> 0.55 -> 1 over one cycle. */
export function uiShutterPulse(t: number): number {
  const phase = (((t % UI_SHUTTER_CYCLE) + UI_SHUTTER_CYCLE) % UI_SHUTTER_CYCLE) / UI_SHUTTER_CYCLE;
  return 1 - 0.45 * (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
function bladePaths(a: number): string[] {
  return uiShutterBlades(a).map((b) => `M${fmt(b.x1)} ${fmt(b.y1)}L${fmt(b.x2)} ${fmt(b.y2)}`);
}
const OPEN_PATHS = bladePaths(UI_SHUTTER_A0);

/* One animation frame loop for every shutter on the page. */
const live = new Set<UiShutterLoader>();
let frame = 0;
function tick(now: number) {
  frame = 0;
  for (const s of live) s.frame(now);
  if (live.size) frame = requestAnimationFrame(tick);
}
function join(s: UiShutterLoader) {
  live.add(s);
  if (!frame && typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(tick);
}
function leave(s: UiShutterLoader) {
  live.delete(s);
  if (!live.size && frame && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}

/**
 * `ui-shutter-loader`: an indeterminate loading mark shaped like a camera shutter. The blades click
 * shut three times, then rest open (a 2.1 s loop, under three flashes a second). Under reduced
 * motion (or `animations: false`) the blades stay open and the mark gently fades in and out instead.
 *
 * Drawn in the current text colour, so inside a primary button it takes the button's label colour;
 * `color` sets another. Announced like `ui-spinner` (`role="status"`, "Loading" unless `label` says
 * otherwise); `decorative` hides it when something nearby already announces the busy state.
 *
 * `provideUiConfig({ spinner: 'shutter' })` makes every `ui-spinner` and every built-in busy mark
 * in the library (buttons, loading overlay, sign-in buttons, map, lightbox) draw this instead.
 */
@Component({
  selector: 'ui-shutter-loader',
  host: {
    '[attr.data-size]': 'namedSize()',
    '[style.--_shutter-size]': 'sizePx() + "px"',
    '[style.color]': 'color() ?? null',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
  },
  template: `
    <span class="ui-shutter" [attr.role]="decorative() ? null : 'status'" [attr.aria-label]="decorative() ? null : labelText()">
      <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <g #mark fill="none" stroke="currentColor" stroke-linecap="round">
          <circle cx="5" cy="5" r="3.05" stroke-width="1.1" />
          <g stroke-width="0.75">
            @for (d of openPaths; track $index) { <path [attr.d]="d" /> }
          </g>
        </g>
      </svg>
    </span>
  `,
  styles: `
    :host { display: inline-flex; flex: none; width: var(--_shutter-size, 20px); height: var(--_shutter-size, 20px); line-height: 0; }
    .ui-shutter { display: block; width: 100%; height: 100%; }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
  `,
})
export class UiShutterLoader {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly strings = injectUiStrings();
  /** `sm` 14px, `md` 20px, `lg` 32px (the spinner's sizes), or a number of pixels. */
  size = input<UiSize | number>('md');
  /** Any CSS colour; default the current text colour. */
  color = input<string | undefined>(undefined);
  /** Default: the built-in `loading` (Loading…), which follows the app's language. */
  label = input<string | undefined>(undefined);
  /** Hidden from screen readers, for when something nearby already says it's busy. */
  decorative = input(false, { transform: booleanAttribute });

  protected readonly openPaths = OPEN_PATHS;
  protected readonly labelText = computed(() => this.label() ?? this.strings.loading);
  protected readonly namedSize = computed(() => { const s = this.size(); return typeof s === 'number' ? null : s; });
  protected readonly sizePx = computed(() => { const s = this.size(); return typeof s === 'number' ? s : UI_SHUTTER_SIZES[s]; });

  private readonly mark = viewChild<ElementRef<SVGGElement>>('mark');
  private readonly reduceQuery: MediaQueryList | null;
  private start = -1;
  private drawnA = UI_SHUTTER_A0;
  private drawnOpacity = 1;

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const win = this.host.nativeElement.ownerDocument?.defaultView;
    this.reduceQuery = browser && typeof win?.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (browser) afterNextRender(() => join(this));
    inject(DestroyRef).onDestroy(() => leave(this));
  }

  /** @internal Called by the shared frame loop with the frame's timestamp (ms). */
  frame(now: number): void {
    if (this.start < 0) this.start = now;
    this.drawAt((now - this.start) / 1000);
  }

  /** True under prefers-reduced-motion and when the library's animations are off (`.ui-no-anim`). */
  private reduced(): boolean {
    if (this.reduceQuery?.matches) return true;
    const el = this.host.nativeElement;
    return el.ownerDocument?.documentElement.classList.contains('ui-no-anim') || !!el.closest('.ui-no-anim');
  }

  /** @internal Draws the mark as it is `t` seconds into its loop (tests call it directly). */
  drawAt(t: number): void {
    const g = this.mark()?.nativeElement;
    if (!g) return;
    const reduced = this.reduced();
    const a = reduced ? UI_SHUTTER_A0 : uiShutterBladeDistance(uiShutterClosure(t));
    const opacity = reduced ? uiShutterPulse(t) : 1;
    if (a !== this.drawnA) {
      const paths = a === UI_SHUTTER_A0 ? OPEN_PATHS : bladePaths(a);
      g.querySelectorAll('path').forEach((p, i) => p.setAttribute('d', paths[i]));
      this.drawnA = a;
    }
    if (opacity !== this.drawnOpacity) {
      if (opacity === 1) g.removeAttribute('opacity');
      else g.setAttribute('opacity', fmt(opacity));
      this.drawnOpacity = opacity;
    }
  }
}
