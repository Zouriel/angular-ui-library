import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiScrubber, type UiScrubberLane } from './scrubber';
import { UiSequencer, type UiSequencerRangeChange, type UiSequencerRow } from './sequencer';

/**
 * Bars-only timelines are driven by a finger, so these tests send TOUCH events — the stream a phone
 * delivers for a tap, a hold or a swipe. jsdom lays nothing out: every rect is 0, which makes one
 * pixel one timeline unit here.
 */
function touch(type: string, points: { id?: number; x: number; y: number }[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = points.map((p) => ({ identifier: p.id ?? 1, clientX: p.x, clientY: p.y }));
  Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : list });
  Object.defineProperty(event, 'changedTouches', { value: list });
  Object.defineProperty(event, 'timeStamp', { value: performance.now() });
  return event;
}

@Component({
  imports: [UiSequencer],
  template: `
    <ui-sequencer [rows]="rows()" [length]="1000" [showLabels]="labels()" [end]="600" [(selectedRowId)]="selected"
      (rangeChange)="ranges.push($event)" (rowReorder)="reorders.push($event)" />
  `,
})
class SequencerHost {
  readonly labels = signal(false);
  readonly selected = signal<string | null>(null);
  readonly rows = signal<UiSequencerRow[]>([
    { id: 'a', label: 'Title', start: 100, end: 400 },
    { id: 'b', label: 'Photo', start: 200, end: 500, fixed: true },
  ]);
  readonly ranges: UiSequencerRangeChange[] = [];
  readonly reorders: { rowId: string; toIndex: number }[] = [];
}

describe('UiSequencer, bars only', () => {
  let fixture: ComponentFixture<SequencerHost>;
  let host: SequencerHost;
  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
  const bar = (id: string) => q(`.bar[data-row="${id}"]`)!;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [SequencerHost] }).compileComponents();
    fixture = TestBed.createComponent(SequencerHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => vi.useRealTimers());

  it('draws no label column, and shades what comes after the end', () => {
    expect(q('.label')).toBeNull();
    expect(q('.corner')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.bar').length).toBe(2);
    expect(q('.beyond')).not.toBeNull();
    host.labels.set(true);
    fixture.detectChanges();
    expect(q('.label')).not.toBeNull();
  });

  it('a tap selects the bar and shows its name for a moment', () => {
    bar('a').dispatchEvent(touch('touchstart', [{ x: 10, y: 10 }]));
    bar('a').dispatchEvent(touch('touchend', [{ x: 10, y: 10 }]));
    fixture.detectChanges();
    expect(host.selected()).toBe('a');
    expect(q('.tip')?.textContent).toContain('Title');
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(q('.tip')).toBeNull();
  });

  it('holding a bar lifts it; then it follows the finger along the timeline', () => {
    // A 1000px-wide ruler: one pixel is one unit, and snapping reaches 6 units rather than the whole timeline.
    q('.ruler')!.getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000, top: 0, bottom: 30, height: 30, x: 0, y: 0, toJSON: () => ({}) });
    bar('a').dispatchEvent(touch('touchstart', [{ x: 10, y: 10 }]));
    vi.advanceTimersByTime(500);
    fixture.detectChanges();
    expect(q('.bar.lifted')).toBe(bar('a'));

    const move = touch('touchmove', [{ x: 60, y: 10 }]);
    bar('a').dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
    bar('a').dispatchEvent(touch('touchend', [{ x: 60, y: 10 }]));
    fixture.detectChanges();

    expect(host.ranges.at(-1)).toEqual({ rowId: 'a', start: 150, end: 450, final: true });
    expect(q('.bar.lifted')).toBeNull();
    expect(q('.tip')).toBeNull();
  });

  it('a swipe that starts moving before the hold is a scroll: nothing lifts or moves', () => {
    bar('a').dispatchEvent(touch('touchstart', [{ x: 10, y: 10 }]));
    const move = touch('touchmove', [{ x: 60, y: 30 }]);
    bar('a').dispatchEvent(move);
    vi.advanceTimersByTime(500);
    bar('a').dispatchEvent(touch('touchend', [{ x: 60, y: 30 }]));
    fixture.detectChanges();
    expect(move.defaultPrevented).toBe(false);
    expect(q('.bar.lifted')).toBeNull();
    expect(host.ranges).toEqual([]);
    expect(q('.tip')).toBeNull();
  });

  it('a tap on a keyframe diamond shows the name too', () => {
    host.rows.update((rows) => [{ ...rows[0], keyframes: [{ id: 'k0', at: 0 }] }, rows[1]]);
    fixture.detectChanges();
    const diamond = q('.diamond')!;
    diamond.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 5 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 5 }));
    fixture.detectChanges();
    expect(host.selected()).toBe('a');
    expect(q('.tip')?.textContent).toContain('Title');
  });

  it('a fixed-length bar has no edges to trim', () => {
    expect(bar('a').querySelectorAll('.edge').length).toBe(2);
    expect(bar('b').querySelectorAll('.edge').length).toBe(0);
  });
});

@Component({
  imports: [UiScrubber],
  template: `<ui-scrubber [length]="2000" [lanes]="lanes" [end]="1500" [(value)]="value" (longPress)="presses = presses + 1" />`,
})
class ScrubberHost {
  readonly value = signal(300);
  readonly lanes: UiScrubberLane[] = [{ start: 0, end: 400 }, { start: 200, end: 900, selected: true }];
  presses = 0;
}

describe('UiScrubber lanes and long press', () => {
  // jsdom has no ResizeObserver; the strip only uses it to learn its width.
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;

  let fixture: ComponentFixture<ScrubberHost>;
  let host: ScrubberHost;
  const strip = () => fixture.nativeElement.querySelector('ui-scrubber') as HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [ScrubberHost] }).compileComponents();
    fixture = TestBed.createComponent(ScrubberHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => vi.useRealTimers());

  it('draws a line per lane and shades past the end', () => {
    expect(strip().querySelectorAll('.lane').length).toBe(2);
    expect(strip().querySelector('.lane.selected')).not.toBeNull();
    expect(strip().querySelector('.beyond')).not.toBeNull();
  });

  it('holding still is a long press, and the playhead stays where it was', () => {
    strip().dispatchEvent(touch('touchstart', [{ x: 100, y: 10 }]));
    strip().dispatchEvent(touch('touchmove', [{ x: 103, y: 11 }]));
    vi.advanceTimersByTime(600);
    strip().dispatchEvent(touch('touchend', [{ x: 103, y: 11 }]));
    expect(host.presses).toBe(1);
    expect(host.value()).toBe(300);
  });

  it('a drag scrubs and never counts as a long press', () => {
    strip().dispatchEvent(touch('touchstart', [{ x: 100, y: 10 }]));
    strip().dispatchEvent(touch('touchmove', [{ x: 60, y: 10 }]));
    vi.advanceTimersByTime(600);
    strip().dispatchEvent(touch('touchend', [{ x: 60, y: 10 }]));
    expect(host.presses).toBe(0);
    expect(host.value()).not.toBe(300);
  });
});
