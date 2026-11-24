import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import {
  UI_DONUT_MIN_VISIBLE_SHARE,
  UiDonutChart,
  type UiDonutSegment,
  uiDonutPrepareSegments,
} from './donut-chart';

@Component({
  imports: [UiDonutChart],
  template: `
    <div [dir]="dir()">
      <ui-donut-chart
        ariaLabel="Visitor breakdown"
        [segments]="segments()"
        [size]="size()"
        [thickness]="thickness()"
        [centerValue]="centerValue()"
        [centerLabel]="centerLabel()"
        [legend]="legend()"
        [selectedIndex]="selected()"
        (segmentSelect)="picked.push($event); selected.set($event)"
      />
    </div>
  `,
})
class Host {
  dir = signal<'ltr' | 'rtl'>('ltr');
  segments = signal<UiDonutSegment[]>([
    { name: 'Direct', value: 500 },
    { name: 'Search', value: 300 },
    { name: 'Social', value: 200 },
  ]);
  size = signal(180);
  thickness = signal(24);
  centerValue = signal<string | undefined>('1,000');
  centerLabel = signal<string | undefined>('Total');
  legend = signal<'end' | 'bottom' | 'none'>('end');
  selected = signal<number | null>(null);
  picked: number[] = [];
}

describe('uiDonutPrepareSegments', () => {
  it('folds more than 6 segments into a 6th "Other" segment', () => {
    const segs: UiDonutSegment[] = Array.from({ length: 8 }, (_, i) => ({
      name: `S${i + 1}`,
      value: 10,
    }));
    const prepared = uiDonutPrepareSegments(segs, 'Other');
    expect(prepared.length).toBe(6);
    expect(prepared[5].name).toBe('Other');
    expect(prepared[5].isOther).toBe(true);
    expect(prepared[5].value).toBe(30);
    expect(prepared[5].color).toBe('var(--ui-chart-6)');
  });

  it('clamps shares under 3% to a minimum visible arc while preserving true share', () => {
    const prepared = uiDonutPrepareSegments(
      [
        { name: 'Major', value: 990 },
        { name: 'Tiny', value: 10 },
      ],
      'Other',
    );
    expect(prepared[1].share).toBeCloseTo(0.01, 4);
    expect(prepared[1].drawShare).toBe(UI_DONUT_MIN_VISIBLE_SHARE);
    expect(prepared[0].drawShare + prepared[1].drawShare).toBeCloseTo(1, 6);
  });
});

describe('UiDonutChart', () => {
  function setup(fn?: (h: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    fn?.(fixture.componentInstance);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const frame = root.querySelector<HTMLElement>('.frame')!;
    const key = (k: string) => { frame.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); fixture.detectChanges(); };
    return { fixture, host: fixture.componentInstance, root, frame, key };
  }

  it('renders arcs, centre value/label, and legend with value and percentage', () => {
    const { root } = setup();
    expect(root.querySelectorAll('path.seg').length).toBe(3);
    expect(root.querySelector('.center-value')?.textContent?.trim()).toBe('1,000');
    expect(root.querySelector('.center-label')?.textContent?.trim()).toBe('Total');

    const items = [...root.querySelectorAll('.legend-item')];
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Direct');
    expect(items[0].textContent).toContain('500');
    expect(items[0].textContent).toContain('50%');
  });

  it('supports legend="bottom" and legend="none"', () => {
    const { fixture, host, root } = setup((h) => h.legend.set('bottom'));
    expect(root.querySelector('.wrap.legend-bottom .legend')).toBeTruthy();

    host.legend.set('none');
    fixture.detectChanges();
    expect(root.querySelector('.legend')).toBeNull();
  });

  it('draws counter-clockwise in RTL (sweep-flag 0)', () => {
    const { root } = setup((h) => h.dir.set('rtl'));
    const d = root.querySelector('path.seg')?.getAttribute('d') ?? '';
    expect(d).toMatch(/A\s+[\d.]+\s+[\d.]+\s+0\s+\d\s+0\s+/);
  });

  it('supports arrow-key navigation, segmentSelect, and screen-reader table', () => {
    const { host, root, key } = setup();
    key('ArrowRight');
    key('ArrowRight');
    key('Enter');
    expect(host.picked).toEqual([1]);

    const rows = root.querySelectorAll('.sr table tbody tr');
    expect(rows.length).toBe(3);
  });

  it('uses Dhivehi chartOther string when folding > 6 segments', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const { root } = setup((h) => {
      h.segments.set(Array.from({ length: 7 }, (_, i) => ({ name: `Item ${i + 1}`, value: 10 })));
    });
    const names = [...root.querySelectorAll('.legend-name')].map((el) => el.textContent?.trim());
    expect(names[5]).toBe(uiStringsDv.chartOther);
    // All 7 original segments remain in the screen-reader table
    expect(root.querySelectorAll('.sr table tbody tr').length).toBe(7);
  });
});
