import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { provideUiConfig } from '@zouriel/ui';
import {
  UiCoralDecor,
  UiOceanHero,
  UiPalmDecor,
  UiSeaSurface,
  UiSunrise,
  UiTide,
  UiWaveFooter,
  type UiDecorCorner,
} from './sea';
import { UI_SEA_SHAPES } from './sea-shapes';

@Component({
  imports: [UiWaveFooter, UiOceanHero, UiCoralDecor, UiPalmDecor, UiSunrise, UiSeaSurface, UiTide],
  template: `
    <div class="pos" style="position: relative">
      <ui-wave-footer id="w3" [height]="90" [opacity]="0.4" />
      <ui-wave-footer id="w2" [layers]="2" />
    </div>
    <ui-ocean-hero id="hero" [src]="src()" [shimmer]="shimmer()"
      ><h1>Find a doctor</h1></ui-ocean-hero
    >
    <ui-coral-decor id="coral" [corner]="corner()" [scale]="0.5" [opacity]="0.6" />
    <ui-palm-decor id="palm" corner="tr" />
    <ui-sunrise id="sun" [size]="80"><span class="logo">FD</span></ui-sunrise>
    <ui-sea-surface id="sea" [theme]="theme()" coral="bl" [palm]="palm()"
      ><p class="inside">Hello</p></ui-sea-surface
    >
    @for (x of items; track x; let i = $index) {
      <div class="item" [uiTide]="i" [tideDelay]="100" [tideStep]="50">{{ x }}</div>
    }
  `,
})
class Host {
  src = signal<string | null>(null);
  shimmer = signal(true);
  corner = signal<UiDecorCorner>('bl');
  theme = signal<string | null>('maldives');
  palm = signal<UiDecorCorner | null>(null);
  items = ['a', 'b', 'c'];
}

function setup(animations = true) {
  TestBed.configureTestingModule({ providers: [provideUiConfig({ animations })] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement;
  const qa = (sel: string) => [...fixture.nativeElement.querySelectorAll(sel)] as HTMLElement[];
  return { fixture, q, qa, host: fixture.componentInstance };
}

describe('sea backdrops', () => {
  it('wave footer stacks 3 bands (or 2), alternating direction, hidden from screen readers', () => {
    const { q, qa } = setup();
    expect(qa('#w3 svg.band')).toHaveLength(3);
    expect(qa('#w2 svg.band')).toHaveLength(2);
    expect(qa('#w3 svg.band').map((b) => b.classList.contains('rev'))).toEqual([
      false,
      true,
      false,
    ]);
    expect(q('#w3').getAttribute('aria-hidden')).toBe('true');
    expect(q('#w3').style.height).toBe('90px');
    expect(q('#w3').style.opacity).toBe('0.4');
    // Each band drifts on its own slow loop, the back one fastest.
    expect(qa('#w3 svg.band').map((b) => b.style.animationDuration)).toEqual(['30s', '38s', '46s']);
    expect(q('#w3').classList.contains('still')).toBe(false);
  });

  it('every sea component goes still when the library animations are off', () => {
    const { q } = setup(false);
    for (const id of ['#w3', '#hero', '#coral', '#palm', '#sun'])
      expect(q(id).classList.contains('still'), id).toBe(true);
    expect(q('.item').classList.contains('ui-slide-up-enter')).toBe(false);
    expect(q('.item').style.animationDelay).toBe('');
  });

  it('ocean hero projects content above the sky, with an optional decorative photo and sweep', () => {
    const { fixture, q, host } = setup();
    expect(q('#hero .content h1').textContent).toBe('Find a doctor');
    expect(q('#hero .sky').getAttribute('aria-hidden')).toBe('true');
    expect(q('#hero img')).toBeNull();
    expect(q('#hero .sweep')).not.toBeNull();
    host.src.set('beach.jpg');
    host.shimmer.set(false);
    fixture.detectChanges();
    expect(q('#hero img').getAttribute('src')).toBe('beach.jpg');
    expect(q('#hero img').getAttribute('alt')).toBe('');
    expect(q('#hero').classList.contains('has-img')).toBe(true);
    expect(q('#hero .sweep')).toBeNull();
  });

  it('corner decor sits in its corner at its scale, decorative', () => {
    const { fixture, q, host } = setup();
    expect(q('#coral').getAttribute('data-corner')).toBe('bl');
    expect(q('#coral').style.width).toBe('80px');
    expect(q('#coral').style.height).toBe('64px');
    expect(q('#coral').style.opacity).toBe('0.6');
    expect(q('#coral').getAttribute('aria-hidden')).toBe('true');
    expect(q('#palm').getAttribute('data-corner')).toBe('tr');
    expect(q('#palm').style.width).toBe('160px');
    host.corner.set('br');
    fixture.detectChanges();
    expect(q('#coral').getAttribute('data-corner')).toBe('br');
    // Strokes for the branches and trunks, fills for the sand and fronds.
    expect(q('#coral path[fill="none"]')).not.toBeNull();
    expect(q('#palm path:not([fill="none"])')).not.toBeNull();
  });

  it('sunrise wraps the logo slot in a sun of the given size', () => {
    const { q } = setup();
    expect(q('#sun .logo .logo').textContent).toBe('FD');
    expect(q('#sun').style.getPropertyValue('--size')).toBe('80px');
    expect(q('#sun .disc').getAttribute('aria-hidden')).toBe('true');
  });

  it('sea surface scopes maldives with waves and the decor asked for', () => {
    const { fixture, q, host } = setup();
    const sea = q('#sea');
    expect(sea.getAttribute('data-theme')).toBe('maldives');
    expect(sea.classList.contains('ui-surface')).toBe(true);
    expect(q('#sea ui-wave-footer')).not.toBeNull();
    expect(q('#sea ui-coral-decor').getAttribute('data-corner')).toBe('bl');
    expect(q('#sea ui-palm-decor')).toBeNull();
    expect(q('#sea .content .inside').textContent).toBe('Hello');
    host.theme.set(null);
    host.palm.set('tr');
    fixture.detectChanges();
    expect(sea.hasAttribute('data-theme')).toBe(false);
    expect(q('#sea ui-palm-decor').getAttribute('data-corner')).toBe('tr');
  });

  it('uiTide staggers each item by its index', () => {
    const { qa } = setup();
    const items = qa('.item');
    expect(items.every((i) => i.classList.contains('ui-slide-up-enter'))).toBe(true);
    expect(items.map((i) => i.style.animationDelay)).toEqual(['100ms', '150ms', '200ms']);
  });
});

describe('sea shapes', () => {
  const dir = join(process.cwd(), 'projects/ui/fx/assets/maldives');
  const keys: Record<string, keyof typeof UI_SEA_SHAPES> = {
    'wave-1': 'wave1',
    'wave-2': 'wave2',
    'wave-3': 'wave3',
    coral: 'coral',
    palm: 'palm',
  };

  it('match the shared SVG sources exactly', () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.svg'))
      .map((f) => f.replace('.svg', ''))
      .sort();
    expect(files).toEqual(Object.keys(keys).sort());
    for (const [file, key] of Object.entries(keys)) {
      const svg = readFileSync(join(dir, file + '.svg'), 'utf8');
      const parts = [...svg.matchAll(/<path ([^>]*)\/>/g)].map((m) => {
        const a = Object.fromEntries(
          [...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]),
        );
        return {
          tone: a['data-tone'],
          d: a['d'],
          ...(a['stroke-width'] ? { stroke: +a['stroke-width'] } : {}),
          ...(a['opacity'] ? { opacity: +a['opacity'] } : {}),
        };
      });
      expect({ viewBox: svg.match(/viewBox="([^"]+)"/)![1], parts }, file).toEqual(
        UI_SEA_SHAPES[key],
      );
    }
  });

  it('use only absolute M, C, L and Z commands (what the Flutter generator parses)', () => {
    for (const shape of Object.values(UI_SEA_SHAPES)) {
      for (const p of shape.parts) expect(p.d.replace(/[MCLZ\d.\s-]/g, '')).toBe('');
    }
  });

  it('waves repeat every half of their width, so a half-width drift has no seam', () => {
    for (const w of [UI_SEA_SHAPES.wave1, UI_SEA_SHAPES.wave2, UI_SEA_SHAPES.wave3]) {
      const ys = [...w.parts[0].d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
      const at = (x: number) => ys.find((p) => p[0] === x)?.[1];
      expect(at(0)).toBe(at(1440));
      expect(at(1440)).toBe(at(2880));
    }
  });

  it('take every colour from a token', () => {
    const src = readFileSync(join(process.cwd(), 'projects/ui/fx/src/sea.ts'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(src.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d/g)).toBeNull();
  });
});
