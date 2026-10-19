import {
  AfterViewInit, Component, ElementRef, NgZone, OnDestroy, inject, input, viewChild,
} from '@angular/core';

/**
 * `ui-glyph-field` — animated binary/glyph field rendered to a canvas. A
 * reusable, asset-free take on the portfolio's binary-face background: a grid
 * of flickering glyphs lit by a drifting intensity field, tinted along a
 * dim → mid → bright ramp: by default the theme's ember → blood → rose (Dark Orange) or, in themes
 * without them, a ramp built from its primary and accent. The grid holds only whole cells, centred,
 * so no row or column is cut at the edge. Use as a fixed page backdrop (`fixed`)
 * or contained within a positioned parent. Honors `prefers-reduced-motion`.
 */
@Component({
  selector: 'ui-glyph-field',
  template: `<canvas #cv class="gf" [class.fixed]="fixed()" [style.opacity]="opacity()" aria-hidden="true"></canvas>`,
  styles: `
    :host { display: contents; }
    .gf { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; mix-blend-mode: screen; }
    .gf.fixed { position: fixed; z-index: 0; }
  `,
})
export class UiGlyphField implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');

  fixed = input(false);
  opacity = input(0.55);
  chars = input('01');
  cell = input(16);
  speed = input(1);
  /** Color ramp dim → mid → bright (any CSS colours). Defaults to the theme's ramp, see above. */
  colors = input<[string, string, string] | undefined>(undefined);

  private raf = 0;
  private ro?: ResizeObserver;
  private mo?: MutationObserver;
  private destroyed = false;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.cv().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glyphs = this.chars();
    type Rgb = [number, number, number];
    // Any CSS colour to rgb, through the canvas's own colour parser.
    const rgb = (css: string): Rgb | null => {
      if (!css) return null;
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      const v = String(ctx.fillStyle);
      if (v.startsWith('#')) { const n = parseInt(v.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
      const m = v.match(/[\d.]+/g);
      return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : null;
    };
    const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    let cDim: Rgb = [0, 0, 0], cMid: Rgb = [0, 0, 0], cBright: Rgb = [0, 0, 0];
    const ramp = () => {
      const given = this.colors();
      if (given) {
        [cDim, cMid, cBright] = given.map((c) => rgb(c) ?? [0, 0, 0]) as [Rgb, Rgb, Rgb];
        return;
      }
      const cs = getComputedStyle(canvas);
      const v = (name: string) => rgb(cs.getPropertyValue(name).trim());
      const primary = v('--ui-color-primary') ?? [128, 128, 128];
      cDim = v('--ui-color-ember') ?? mix(v('--ui-color-bg') ?? [0, 0, 0], primary, 0.35);
      cMid = v('--ui-color-blood') ?? primary;
      cBright = v('--ui-color-rose') ?? v('--ui-color-accent') ?? primary;
    };
    ramp();

    let w = 0, h = 0, cols = 0, rows = 0, ox = 0, oy = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      const cs = this.cell();
      // Whole cells only, centred: a cut-off row or column reads as a rendering fault.
      cols = Math.max(1, Math.floor(w / cs)); rows = Math.max(1, Math.floor(h / cs));
      ox = (w - cols * cs) / 2; oy = (h - rows * cs) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mono = getComputedStyle(canvas).getPropertyValue('--ui-font-mono').trim() || 'ui-monospace, Menlo, monospace';
      ctx.font = `700 ${Math.round(this.cell() * 0.82)}px ${mono}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    };
    size();
    // Screen only lightens: on a light theme the field would vanish, so darken into it instead. Checked
    // again whenever the root element's attributes change, which is how a theme switch arrives.
    const blend = () => {
      const scheme = getComputedStyle(canvas).colorScheme;
      canvas.style.mixBlendMode = /light/.test(scheme) && !/dark/.test(scheme) ? 'multiply' : '';
    };
    blend();
    if (typeof MutationObserver !== 'undefined') {
      this.mo = new MutationObserver(() => { blend(); ramp(); });
      this.mo.observe(document.documentElement, { attributes: true });
    }
    // Resizing clears the canvas; a static (reduced-motion) field has no next frame to repaint it.
    this.ro = new ResizeObserver(() => { size(); if (reduce) draw(0); });
    this.ro.observe(canvas);

    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const lerpColor = (a: Rgb, b: Rgb, t: number) => {
      const [r, g, bl] = mix(a, b, t);
      return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(bl)})`;
    };

    const cs = () => this.cell();
    const draw = (time: number) => {
      if (this.destroyed) return;
      const t = time * 0.001 * this.speed();
      ctx.clearRect(0, 0, w, h);
      const c = cs();
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          // drifting intensity field, brightest toward centre
          const nx = gx / cols - 0.5, ny = gy / rows - 0.5;
          const wave = Math.sin(gx * 0.18 + t * 0.9) * 0.5 + Math.cos(gy * 0.21 - t * 0.7) * 0.5;
          const radial = 1 - Math.min(1, Math.hypot(nx, ny) * 1.7);
          let lum = radial * 0.7 + wave * 0.25 + 0.05;
          if (lum < 0.12) continue;
          const h0 = hash(gx, gy);
          const phase = Math.floor(t * 0.9 + h0 * 9);
          const flick = hash(gx + phase, gy + 7) > 0.86 ? 1 : 0;
          const idx = (Math.floor(h0 * glyphs.length) + flick) % glyphs.length;
          const col = lum < 0.4 ? lerpColor(cDim, cMid, lum / 0.4) : lerpColor(cMid, cBright, (lum - 0.4) / 0.6);
          ctx.globalAlpha = Math.min(1, lum * 1.2);
          ctx.fillStyle = col;
          ctx.fillText(glyphs[idx], ox + gx * c + c / 2, oy + gy * c + c / 2);
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce) this.raf = requestAnimationFrame(draw);
    };

    this.zone.runOutsideAngular(() => {
      if (reduce) { draw(0); } else { this.raf = requestAnimationFrame(draw); }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.mo?.disconnect();
  }
}
