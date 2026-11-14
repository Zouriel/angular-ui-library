import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiBarChart, type UiBarChartSeries } from './bar-chart';
import { uiChartLabels, uiChartScale } from './chart-scale';

@Component({
  imports: [UiBarChart],
  template: `<ui-bar-chart ariaLabel="Income and spending" [categories]="categories()" [series]="series()" [formatValue]="format"
    [showValues]="showValues()" [selectedIndex]="selected()" [minCategoryWidth]="minWidth()" [emptyLabel]="emptyLabel()"
    (categorySelect)="picked.push($event); selected.set($event)" />`,
})
class Host {
  categories = signal(['Jan', 'Feb', 'Mar']);
  series = signal<UiBarChartSeries[]>([
    { name: 'Income', values: [100, 50, -25] },
    { name: 'Spending', values: [40, 75, 10] },
  ]);
  format = (v: number): string => `$${v}`;
  showValues = signal(false);
  selected = signal<number | null>(null);
  minWidth = signal<number | null>(null);
  emptyLabel = signal<string | undefined>(undefined);
  picked: number[] = [];
}

function setup(change?: (h: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const frame = root.querySelector<HTMLElement>('.frame')!;
  const band = (i: number) => root.querySelectorAll<HTMLElement>('.band')[i];
  const key = (k: string) => { frame.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); fixture.detectChanges(); };
  const hover = (i: number) => { band(i).dispatchEvent(new MouseEvent('pointerenter')); fixture.detectChanges(); };
  const tip = () => root.querySelector<HTMLElement>('.tip');
  const tipText = () => {
    const el = tip();
    if (!el) return '';
    const rows = [...el.querySelectorAll('.tip-row')].map((r) => `${r.querySelector('strong')!.textContent} ${r.querySelector('.tip-name')?.textContent ?? ''}`.trim());
    return [el.querySelector('.tip-title')!.textContent, ...rows].join(' | ');
  };
  return { fixture, host: fixture.componentInstance, root, frame, band, key, hover, tip, tipText };
}

const css = () => readFileSync(join(process.cwd(), 'projects/ui/chart/src/bar-chart.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
const pct = (el: HTMLElement, prop: 'bottom' | 'height' | 'top') => parseFloat(el.style[prop]);

describe('uiChartScale', () => {
  it('starts at zero and ends on a round number, with three or four gridlines above the baseline', () => {
    expect(uiChartScale([12, 87, 40])).toEqual({ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] });
    expect(uiChartScale([47])).toEqual({ min: 0, max: 60, ticks: [0, 20, 40, 60] });
    expect(uiChartScale([9300, 4200]).ticks).toEqual([0, 2500, 5000, 7500, 10000]);
    expect(uiChartScale([0.3, 0.1]).ticks).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('never starts above zero, however large the smallest value', () => {
    expect(uiChartScale([900, 950, 1000]).min).toBe(0);
  });

  it('makes room under the zero line for negative values, and keeps a tick on zero', () => {
    const s = uiChartScale([9300, -1200, 4000]);
    expect(s).toEqual({ min: -2500, max: 10000, ticks: [-2500, 0, 2500, 5000, 7500, 10000] });
    expect(uiChartScale([-40, -10])).toEqual({ min: -40, max: 0, ticks: [-40, -30, -20, -10, 0] });
  });

  it('gives all-zero, empty and non-finite data a flat scale with one tick', () => {
    for (const values of [[], [0, 0, 0], [NaN, Infinity]]) {
      expect(uiChartScale(values)).toEqual({ min: 0, max: 1, ticks: [0] });
    }
  });
});

describe('uiChartLabels', () => {
  const overlaps = (widths: number[], band: number, gap: number) => {
    const shown = uiChartLabels(widths, band, gap);
    const boxes = shown.map(({ index, align }) => {
      const w = widths[index];
      const left = align === 'start' ? index * band : align === 'end' ? (index + 1) * band - w : (index + 0.5) * band - w / 2;
      return { left, right: left + w };
    });
    return { shown, boxes, bad: boxes.some((b, i) => i > 0 && b.left < boxes[i - 1].right + gap) };
  };

  it('shows every label when they fit', () => {
    expect(uiChartLabels([30, 30, 30], 60).map((l) => l.index)).toEqual([0, 1, 2]);
  });

  it('thins 30 daily labels to every few, counted back from the latest, never overlapping', () => {
    const widths = Array.from({ length: 30 }, () => 40);
    const { shown, boxes, bad } = overlaps(widths, 14, 8);
    expect(shown.map((l) => l.index)).toEqual([4, 9, 14, 19, 24, 29]);
    expect(bad).toBe(false);
    expect(boxes[0].left).toBeGreaterThanOrEqual(0);
    expect(boxes.at(-1)!.right).toBeLessThanOrEqual(30 * 14);
    expect(shown.at(-1)).toEqual({ index: 29, align: 'end' });
  });

  it('drops a first label that would touch its neighbour once pulled in from the edge', () => {
    const { shown, bad } = overlaps(Array.from({ length: 7 }, () => 40), 12, 8);
    expect(bad).toBe(false);
    expect(shown.map((l) => l.index)).toEqual([6]);
    expect(overlaps(Array.from({ length: 9 }, () => 40), 12, 8).shown.map((l) => l.index)).toEqual([2, 8]);
  });

  it('shows every label until the band has been measured', () => {
    expect(uiChartLabels([40, 40], 0)).toHaveLength(2);
  });
});

describe('UiBarChart', () => {
  it('names the chart and lists every number in a table for screen readers', () => {
    const { root, frame } = setup();
    expect(frame.getAttribute('role')).toBe('group');
    expect(frame.getAttribute('aria-label')).toBe('Income and spending');
    expect(frame.tabIndex).toBe(0);
    const table = root.querySelector('table')!;
    expect(table.querySelector('caption')!.textContent).toBe('Income and spending');
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Income', 'Spending']);
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent));
    expect(rows).toEqual([['Jan', '$100', '$40'], ['Feb', '$50', '$75'], ['Mar', '$-25', '$10']]);
    expect(table.closest('[aria-hidden="true"]')).toBeNull();
    // Hidden from the eye by a box around it: a table itself ignores a 1px size and would still take room.
    expect(table.classList.contains('sr')).toBe(false);
    expect(table.parentElement!.tagName).toBe('DIV');
    expect(table.parentElement!.classList.contains('sr')).toBe(true);
    expect(css()).toMatch(/\.sr \{[^}]*position: absolute[^}]*width: 1px[^}]*height: 1px[^}]*overflow: hidden/);
    // The drawing is for the eye only: the table and the live line carry it for screen readers.
    for (const sel of ['.plot', '.yaxis', '.xaxis', '.legend']) expect(root.querySelector(sel)!.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws one bar per series in each category, from the zero line, negatives hanging below it', () => {
    const { root, band } = setup();
    // Scale: -25 to 100 in steps of 25, so zero sits 20% up.
    expect([...root.querySelectorAll('.ytick')].map((t) => t.textContent!.trim())).toEqual(['$100', '$75', '$50', '$25', '$0', '$-25']);
    const jan = band(0).querySelectorAll<HTMLElement>('.bar');
    expect(jan).toHaveLength(2);
    expect([pct(jan[0], 'bottom'), pct(jan[0], 'height')]).toEqual([20, 80]);
    expect([pct(jan[1], 'bottom'), pct(jan[1], 'height')]).toEqual([20, 32]);
    const mar = band(2).querySelector<HTMLElement>('.bar')!;
    expect(mar.classList.contains('negative')).toBe(true);
    expect([pct(mar, 'bottom'), pct(mar, 'height')]).toEqual([0, 20]);
    const zero = root.querySelector<HTMLElement>('.grid.zero')!;
    expect(pct(zero, 'bottom')).toBe(20);
    expect(root.querySelectorAll('.grid')).toHaveLength(6);
  });

  it('keeps grouped bars thin and 2px apart, rounded at the data end only', () => {
    const s = css();
    expect(s).toMatch(/\.band \{[^}]*display: flex[^}]*gap: 2px/);
    expect(s).toMatch(/\.slot \{[^}]*flex: 0 1 24px/);
    expect(s).toMatch(/\.bar \{[^}]*border-radius: 4px 4px 0 0/);
    expect(s).toMatch(/\.bar\.negative \{[^}]*border-radius: 0 0 4px 4px/);
    // Each bar has its own slot in the band, in series order, so two bars can never share a place.
    const { band } = setup();
    const slots = [...band(0).children];
    expect(slots.map((el) => el.className)).toEqual(['slot', 'slot']);
    expect(slots.map((el) => el.querySelector('.bar')!.getAttribute('data-s'))).toEqual(['0', '1']);
  });

  it('colours series from the chart tokens in order, or from their own colour', () => {
    const { band, host, fixture } = setup();
    const bars = () => [...band(0).querySelectorAll<HTMLElement>('.bar')].map((b) => b.style.background);
    expect(bars()).toEqual(['var(--ui-chart-1)', 'var(--ui-chart-2)']);
    host.series.update((s) => [s[0], { ...s[1], color: 'rgb(1, 2, 3)' }]);
    fixture.detectChanges();
    expect(bars()).toEqual(['var(--ui-chart-1)', 'rgb(1, 2, 3)']);
  });

  it('shows a legend for two or more series, none for one, with names in text colours', () => {
    const { root, host, fixture } = setup();
    expect([...root.querySelectorAll('.legend-name')].map((n) => n.textContent)).toEqual(['Income', 'Spending']);
    expect(css()).toMatch(/\.legend-name \{[^}]*color: var\(--ui-color-text-secondary\)/);
    host.series.update((s) => [s[0]]);
    fixture.detectChanges();
    expect(root.querySelector('.legend')).toBeNull();
  });

  it('shows a category\'s values on hover: the value first, then the series name', () => {
    const { hover, tip, tipText, root, fixture } = setup();
    expect(tip()).toBeNull();
    hover(1);
    expect(tipText()).toBe('Feb | $50 Income | $75 Spending');
    expect(root.querySelectorAll('.band.active')).toHaveLength(1);
    root.querySelector('.bands')!.dispatchEvent(new MouseEvent('pointerleave'));
    fixture.detectChanges();
    expect(tip()).toBeNull();
  });

  it('moves between categories with the arrow keys, the panel following and read out', () => {
    const { key, tipText, root } = setup();
    const live = root.querySelector('[aria-live]')!;
    key('ArrowLeft');
    expect(tipText()).toBe('Mar | $-25 Income | $10 Spending');
    key('ArrowLeft');
    expect(tipText()).toBe('Feb | $50 Income | $75 Spending');
    expect(live.textContent).toBe('Feb: Income $50, Spending $75');
    key('Home');
    expect(tipText()).toContain('Jan');
    key('ArrowLeft');
    expect(tipText()).toContain('Jan');
    key('End');
    key('ArrowRight');
    expect(tipText()).toContain('Mar');
    key('Escape');
    expect(tipText()).toBe('');
  });

  it('emits the category on click and on Enter, and marks the chosen one beyond colour', () => {
    const { band, key, host, root } = setup();
    band(1).click();
    expect(host.picked).toEqual([1]);
    TestBed.tick();
    expect(root.querySelectorAll('.band.selected')).toHaveLength(1);
    expect(band(1).classList.contains('selected')).toBe(true);
    expect(root.querySelectorAll('.xband')[1].classList.contains('selected')).toBe(true);
    const s = css();
    expect(s).toMatch(/\.xband\.selected \{[^}]*border-top-color: var\(--ui-color-text\)/);
    expect(s).toMatch(/\.xband\.selected \.xlabel \{[^}]*font-weight: 600/);
    key('ArrowLeft');
    key('Enter');
    expect(host.picked).toEqual([1, 0]);
  });

  it('writes a value on each bar only with showValues', () => {
    const { root, host, fixture } = setup();
    expect(root.querySelector('.value')).toBeNull();
    host.showValues.set(true);
    fixture.detectChanges();
    expect([...root.querySelectorAll('.value')].map((v) => v.textContent)).toEqual(['$100', '$40', '$50', '$75', '$-25', '$10']);
    const below = root.querySelectorAll<HTMLElement>('.band')[2].querySelector<HTMLElement>('.value')!;
    expect(below.classList.contains('negative')).toBe(true);
    expect(pct(below, 'top')).toBe(100);
    expect(css()).toMatch(/\.value \{[^}]*color: var\(--ui-color-text\)/);
  });

  it('keeps the axes and says there is no data when every value is zero or missing', () => {
    for (const values of [[0, 0, 0], []]) {
      const { root } = setup((h) => { h.series.set([{ name: 'Sales', values }]); h.emptyLabel.set('No data yet'); });
      expect(root.querySelector('.empty')!.textContent).toBe('No data yet');
      expect(root.querySelectorAll('.bar')).toHaveLength(0);
      expect(root.querySelectorAll('.grid.zero')).toHaveLength(1);
      expect(root.querySelectorAll('.xband')).toHaveLength(3);
    }
    expect(setup((h) => h.series.set([])).root.querySelector('.empty')!.textContent).toBe('No data');
    expect(setup().root.querySelector('.empty')).toBeNull();
  });

  it('scrolls inside itself when categories need more room: the plot gets a least width, the y axis stays outside', () => {
    const { root, host, fixture } = setup();
    const inner = root.querySelector<HTMLElement>('.inner')!;
    expect(inner.style.minWidth).toBe('');
    host.minWidth.set(40);
    fixture.detectChanges();
    expect(inner.style.minWidth).toBe('120px');
    const scroller = root.querySelector('.scroller')!;
    expect(scroller.contains(root.querySelector('.plot'))).toBe(true);
    expect(scroller.contains(root.querySelector('.xaxis'))).toBe(true);
    expect(scroller.contains(root.querySelector('.yaxis'))).toBe(false);
    expect(scroller.contains(root.querySelector('.legend'))).toBe(false);
    const s = css();
    expect(s).toMatch(/\.scroller \{[^}]*min-width: 0[^}]*overflow-x: auto/);
    expect(s).toMatch(/\.frame \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)/);
  });

  it('draws at most four series but keeps them all in the table', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `S${i}`, values: [1, 2, 3] }));
    const { root, band } = setup((h) => h.series.set(many));
    expect(band(0).querySelectorAll('.bar')).toHaveLength(4);
    expect(root.querySelectorAll('thead th')).toHaveLength(6);
  });

  it('stops moving for reduced motion and keeps the series apart in forced colours', () => {
    const s = css();
    expect(s).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.bar, \.band \{ transition: none/);
    expect(s).toMatch(/@media \(forced-colors: active\) \{[^@]*\.bar, \.swatch, \.key \{ forced-color-adjust: none/);
  });
});

describe('chart series tokens', () => {
  const styles = join(process.cwd(), 'projects/ui/styles');
  const files = ['tokens.css', 'theme-palettes.css', 'theme-dark-orange.css', 'theme-maldives.css', 'theme-liquid.css'];
  /** Every block that sets a theme's primary: its theme names and its declarations. */
  const themeBlocks = files.flatMap((f) => {
    const src = readFileSync(join(styles, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    return [...src.matchAll(/([^{};]+)\{([^{}]*)\}/g)]
      .filter((m) => /(^|\s)--ui-color-primary\s*:/.test(m[2]) && m[1].includes('[data-theme="'))
      .map((m) => ({ names: [...m[1].matchAll(/\[data-theme="([^"]+)"\]/g)].map((n) => n[1]), body: m[2] }));
  });

  it('finds every built-in theme', () => {
    const names = themeBlocks.flatMap((b) => b.names);
    expect(names.length).toBeGreaterThanOrEqual(27);
    for (const n of ['dark', 'light', 'oxblood', 'oxblood-dark', 'maldives', 'darkOrange', 'goldRed']) expect(names).toContain(n);
  });

  it('gives every built-in theme its own four series colours, all different', () => {
    for (const { names, body } of themeBlocks) {
      const colours = [1, 2, 3, 4].map((i) => new RegExp(`--ui-chart-${i}\\s*:\\s*(#[0-9a-f]{6})\\s*;`).exec(body)?.[1]);
      expect(colours.every(Boolean), names.join(', ')).toBe(true);
      expect(new Set(colours).size, names.join(', ')).toBe(4);
    }
  });

  it('falls back to the primary and a neutral in a theme that sets none', () => {
    const tokens = readFileSync(join(styles, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--ui-chart-1: var\(--ui-color-primary\);/);
    expect(tokens).toMatch(/--ui-chart-2: var\(--ui-color-text-muted\);/);
  });
});
