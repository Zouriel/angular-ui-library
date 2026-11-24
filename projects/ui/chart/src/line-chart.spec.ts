import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { uiChartAutoScale } from './chart-scale';
import { UiLineChart, type UiChartSeries, uiMonotoneLinePath } from './line-chart';

@Component({
  imports: [UiLineChart],
  template: `
    <div [dir]="dir()">
      <ui-line-chart
        ariaLabel="Monthly visitors"
        [categories]="categories()"
        [series]="series()"
        [area]="area()"
        [curve]="curve()"
        [baseline]="baseline()"
        [showValues]="showValues()"
        [selectedIndex]="selected()"
        (categorySelect)="picked.push($event); selected.set($event)"
      />
    </div>
  `,
})
class Host {
  dir = signal<'ltr' | 'rtl'>('ltr');
  categories = signal(['Jan', 'Feb', 'Mar', 'Apr']);
  series = signal<UiChartSeries[]>([
    { name: 'Visitors', values: [120, 180, 150, 210] },
  ]);
  area = signal(false);
  curve = signal<'linear' | 'smooth'>('linear');
  baseline = signal<'zero' | 'auto'>('zero');
  showValues = signal(false);
  selected = signal<number | null>(null);
  picked: number[] = [];
}

describe('uiChartAutoScale', () => {
  it('fits a floating axis around the data range without forcing zero', () => {
    const s = uiChartAutoScale([92, 95, 98, 94]);
    expect(s.min).toBeGreaterThan(0);
    expect(s.min).toBeLessThanOrEqual(92);
    expect(s.max).toBeGreaterThanOrEqual(98);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('uiMonotoneLinePath', () => {
  it('never overshoots local extrema (flat step or spike)', () => {
    // Step: 0, 100, 100, 0 -> cubic control point y values must stay within [0, 100]
    const pts = [
      { x: 0, y: 100 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 100 },
    ];
    const d = uiMonotoneLinePath(pts);
    const ys: number[] = [];
    for (const m of d.matchAll(/C\s*([\d.-]+)\s+([\d.-]+),\s*([\d.-]+)\s+([\d.-]+),\s*([\d.-]+)\s+([\d.-]+)/g)) {
      ys.push(+m[2], +m[4], +m[6]);
    }
    expect(ys.length).toBe(9);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });
});

describe('UiLineChart', () => {
  function setup(fn?: (h: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    fn?.(fixture.componentInstance);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const frame = root.querySelector<HTMLElement>('.frame')!;
    const band = (i: number) => root.querySelectorAll<HTMLElement>('.band')[i];
    const key = (k: string) => { frame.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); fixture.detectChanges(); };
    return { fixture, host: fixture.componentInstance, root, frame, band, key };
  }

  it('draws up to 4 series with distinct marker shapes', () => {
    const { root } = setup((h) => {
      h.series.set([
        { name: 'S1', values: [10, 20, 30, 40] },
        { name: 'S2', values: [15, 25, 35, 45] },
        { name: 'S3', values: [20, 30, 40, 50] },
        { name: 'S4', values: [25, 35, 45, 55] },
        { name: 'S5', values: [30, 40, 50, 60] },
      ]);
    });
    expect(root.querySelectorAll('.legend li').length).toBe(4);
    expect(root.querySelectorAll('path.line').length).toBe(4);
    expect(root.querySelector('.marker[data-s="0"] circle')).toBeTruthy();
    expect(root.querySelector('.marker[data-s="1"] rect')).toBeTruthy();
    expect(root.querySelector('.marker[data-s="2"] polygon')).toBeTruthy();
    expect(root.querySelector('.marker[data-s="3"] polygon')).toBeTruthy();
    // 5th series still present in screen-reader table
    expect(root.querySelectorAll('.sr table thead th').length).toBe(5);
  });

  it('splits lines at null gaps and prints — in the screen-reader table', () => {
    const { root } = setup((h) => {
      h.series.set([{ name: 'Visitors', values: [10, 20, null, 30, 40] }]);
      h.categories.set(['Jan', 'Feb', 'Mar', 'Apr', 'May']);
    });
    expect(root.querySelectorAll('path.line').length).toBe(2);
    const cells = [...root.querySelectorAll('.sr table tbody td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['10', '20', '—', '30', '40']);
  });

  it('draws area fill only for a single series', () => {
    const { fixture, host, root } = setup((h) => h.area.set(true));
    expect(root.querySelectorAll('path.area').length).toBe(1);

    host.series.set([
      { name: 'A', values: [10, 20, 30, 40] },
      { name: 'B', values: [15, 25, 35, 45] },
    ]);
    fixture.detectChanges();
    expect(root.querySelectorAll('path.area').length).toBe(0);
  });

  it('uses smooth cubic curves when curve="smooth"', () => {
    const { root } = setup((h) => h.curve.set('smooth'));
    const d = root.querySelector('path.line')?.getAttribute('d') ?? '';
    expect(d).toContain(' C ');
  });

  it('prints axis range caption when baseline="auto"', () => {
    const { root } = setup((h) => {
      h.baseline.set('auto');
      h.series.set([{ name: 'Score', values: [92, 95, 98, 94] }]);
    });
    const cap = root.querySelector('.axis-caption')?.textContent?.trim();
    expect(cap).toBeTruthy();
    expect(root.querySelector('.sr table caption')?.textContent).toContain(cap!);
  });

  it('supports keyboard navigation, selection, showValues, and RTL', () => {
    const { fixture, host, root, band, key } = setup((h) => h.showValues.set(true));
    expect(root.querySelectorAll('.band .value').length).toBe(4);

    band(1).click();
    fixture.detectChanges();
    expect(host.picked).toEqual([1]);
    expect(band(1).classList.contains('selected')).toBe(true);

    key('ArrowRight');
    key('Enter');
    expect(host.picked).toEqual([1, 2]);
  });
});
