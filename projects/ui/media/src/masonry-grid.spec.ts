import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiMasonryGrid, UiMasonryRect, UiMasonryTile, uiMasonryLayout } from './masonry-grid';

describe('uiMasonryLayout', () => {
  it('deals each item to the shortest column, gap apart, in its own shape', () => {
    const { rects, height } = uiMasonryLayout(300, [1, 1.5, 0.66, 1, 1.2], 2, 4);
    // Column width (300 - 4) / 2 = 148.
    expect(rects).toEqual([
      { x: 0, y: 0, width: 148, height: 148 },
      { x: 152, y: 0, width: 148, height: 222 },
      { x: 0, y: 152, width: 148, height: 148 * 0.66 },
      // Column 1 (222) is now shorter than column 0 (152 + 97.68).
      { x: 152, y: 226, width: 148, height: 148 },
      { x: 0, y: 152 + 148 * 0.66 + 4, width: 148, height: 148 * 1.2 },
    ]);
    expect(height).toBeCloseTo(152 + 148 * 0.66 + 4 + 148 * 1.2, 6);
  });

  it('three columns, and a bad ratio counts as square', () => {
    const { rects } = uiMasonryLayout(300, [1, NaN, 0, 2], 3, 6);
    const w = (300 - 12) / 3;
    expect(rects.map((r) => [r.x, r.y, r.height])).toEqual([
      [0, 0, w],
      [w + 6, 0, w],
      [2 * (w + 6), 0, w],
      [0, w + 6, 2 * w],
    ]);
  });

  it('never goes below one column', () => {
    expect(uiMasonryLayout(100, [1], 0, 4).rects[0]).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});

@Component({
  imports: [UiMasonryGrid, UiMasonryTile],
  template: `
    <ui-masonry-grid [ratios]="ratios" [(columns)]="columns" [gap]="0" [duration]="300">
      <ng-template uiMasonryTile let-i><span class="t">{{ i }}</span></ng-template>
    </ui-masonry-grid>
  `,
})
class Host {
  readonly ratios = Array.from({ length: 12 }, (_, i) => [1, 1.5, 0.66][i % 3]);
  readonly columns = signal(3);
}

describe('UiMasonryGrid', () => {
  let fixture: ComponentFixture<Host>;
  let grid: UiMasonryGrid;
  let el: HTMLElement;
  let savedMatchMedia: typeof window.matchMedia;

  const cell = (i: number) => el.querySelector<HTMLElement>(`.cell[data-index="${i}"]`)!;
  /** Where a tile is drawn: its laid-out box moved by its transform. */
  function drawn(i: number): UiMasonryRect {
    const c = cell(i);
    const box = { x: parseFloat(c.style.left), y: parseFloat(c.style.top), width: parseFloat(c.style.width), height: parseFloat(c.style.height) };
    const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(c.style.transform);
    if (!m) return box;
    const s = Number(m[3]);
    return { x: box.x + Number(m[1]), y: box.y + Number(m[2]), width: box.width * s, height: box.height * s };
  }
  const between = (v: number, a: number, b: number) => v > Math.min(a, b) + 0.5 && v < Math.max(a, b) - 0.5;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout'] });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 300 });
    // Other specs leave reduced motion on (a matchMedia stub, the no-animations class): start from motion.
    document.documentElement.classList.remove('ui-no-anim');
    savedMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList) as typeof window.matchMedia;
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    grid = fixture.debugElement.children[0].componentInstance as UiMasonryGrid;
    el = fixture.nativeElement.querySelector('ui-masonry-grid');
  });

  afterEach(() => {
    window.matchMedia = savedMatchMedia;
    vi.useRealTimers();
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
  });

  it('lays tiles out at the masonry rects', () => {
    const want = uiMasonryLayout(300, fixture.componentInstance.ratios, 3, 0).rects;
    for (let i = 0; i < 12; i++) expect(drawn(i)).toEqual(want[i]);
  });

  it('moves tiles from the old layout to the new one, between the two mid-way, exactly there at the end', () => {
    const from = uiMasonryLayout(300, fixture.componentInstance.ratios, 3, 0).rects;
    const to = uiMasonryLayout(300, fixture.componentInstance.ratios, 2, 0).rects;
    fixture.componentInstance.columns.set(2);
    fixture.detectChanges();

    // The first frame shows each tile where it was: nothing jumps.
    expect(drawn(4).x).toBeCloseTo(from[4].x, 3);
    expect(drawn(4).width).toBeCloseTo(from[4].width, 3);

    vi.advanceTimersByTime(100);
    const mid = drawn(4);
    expect(between(mid.x, from[4].x, to[4].x) || between(mid.y, from[4].y, to[4].y)).toBe(true);
    expect(between(mid.width, from[4].width, to[4].width)).toBe(true);

    vi.advanceTimersByTime(400);
    for (let i = 0; i < 12; i++) {
      expect(cell(i).style.transform).toBe('');
      expect(drawn(i)).toEqual(to[i]);
    }
  });

  it('a second change mid-way carries on from where the tiles are', () => {
    fixture.componentInstance.columns.set(2);
    fixture.detectChanges();
    // 112 ms: a whole number of 16 ms frames, so the DOM shows exactly this moment.
    vi.advanceTimersByTime(112);
    const before = drawn(5);
    fixture.componentInstance.columns.set(1);
    fixture.detectChanges();
    const after = drawn(5);
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    expect(Math.abs(after.width - before.width)).toBeLessThan(1);
    vi.advanceTimersByTime(500);
    expect(drawn(5)).toEqual(uiMasonryLayout(300, fixture.componentInstance.ratios, 1, 0).rects[5]);
  });

  it('with reduced motion the change is instant', () => {
    document.documentElement.classList.add('ui-no-anim');
    try {
      fixture.componentInstance.columns.set(2);
      fixture.detectChanges();
      const to = uiMasonryLayout(300, fixture.componentInstance.ratios, 2, 0).rects;
      for (let i = 0; i < 12; i++) expect(drawn(i)).toEqual(to[i]);
    } finally {
      document.documentElement.classList.remove('ui-no-anim');
    }
  });

  it('a pinch step changes the count within the limits', () => {
    const step = (apart: boolean) => (grid as unknown as { onStep(s: { apart: boolean; x: number; y: number }): void }).onStep({ apart, x: 10, y: 10 });
    step(true);
    expect(fixture.componentInstance.columns()).toBe(2);
    step(true);
    step(true);
    expect(fixture.componentInstance.columns()).toBe(1);
    for (let k = 0; k < 6; k++) step(false);
    expect(fixture.componentInstance.columns()).toBe(5);
  });

  it('keeps the pinched picture under the fingers by scrolling the page', () => {
    const root = (document.scrollingElement ?? document.documentElement) as HTMLElement;
    let scrolled = 0;
    const spy = vi.fn((v: number) => {
      scrolled = v;
    });
    Object.defineProperty(root, 'scrollTop', { configurable: true, get: () => scrolled, set: spy });
    const from = uiMasonryLayout(300, fixture.componentInstance.ratios, 3, 0).rects;
    // A finger pair over the middle of tile 4 (grid at the top of the page, unscrolled).
    const x = from[4].x + from[4].width / 2;
    const y = from[4].y + from[4].height / 2;
    (grid as unknown as { onStep(s: { apart: boolean; x: number; y: number }): void }).onStep({ apart: true, x, y });
    fixture.detectChanges();
    const to = uiMasonryLayout(300, fixture.componentInstance.ratios, 2, 0).rects;
    // The page scrolled by however far that point moved down.
    expect(spy).toHaveBeenCalled();
    expect(scrolled).toBeCloseTo(to[4].y + to[4].height / 2 - y, 3);
    delete (root as unknown as Record<string, unknown>)['scrollTop'];
  });
});
