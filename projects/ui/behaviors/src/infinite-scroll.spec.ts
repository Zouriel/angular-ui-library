import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiInfiniteScroll } from './infinite-scroll';

/**
 * jsdom has no layout, so the scroller's geometry is set by hand: 100px tall, content 30px per row.
 */
@Component({
  imports: [UiInfiniteScroll],
  template: `<div id="box" uiInfiniteScroll [uiInfiniteScrollThreshold]="20" (scrolledToEnd)="loads = loads + 1">
    @for (r of rows(); track r) { <p>{{ r }}</p> }
  </div>`,
})
class Host {
  rows = signal(Array.from({ length: 10 }, (_, i) => i));
  loads = 0;
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const box = fixture.nativeElement.querySelector('#box') as HTMLElement;
  let top = 0;
  Object.defineProperty(box, 'clientHeight', { get: () => 100 });
  Object.defineProperty(box, 'scrollHeight', { get: () => box.querySelectorAll('p').length * 30 });
  Object.defineProperty(box, 'scrollTop', { get: () => top, set: (v: number) => { top = v; } });
  const scrollTo = (v: number) => { top = v; box.dispatchEvent(new Event('scroll')); };
  return { fixture, box, scrollTo };
}

const tick = () => new Promise((r) => setTimeout(r));

describe('UiInfiniteScroll', () => {
  it('fires once near the end and not again until re-armed', () => {
    const { fixture, scrollTo } = setup();
    scrollTo(190); // 300 - 190 - 100 = 10px left
    scrollTo(200);
    expect(fixture.componentInstance.loads).toBe(1);
    scrollTo(100); // back above the line: re-armed
    scrollTo(200);
    expect(fixture.componentInstance.loads).toBe(2);
  });

  it('re-arms when new rows arrive, so a scroll straight to the new end loads again', async () => {
    const { fixture, scrollTo } = setup();
    scrollTo(200);
    expect(fixture.componentInstance.loads).toBe(1);
    // The load adds ten rows while the reader is still at the old end (now 300px from the bottom).
    fixture.componentInstance.rows.update((r) => [...r, ...Array.from({ length: 10 }, (_, i) => r.length + i)]);
    fixture.detectChanges();
    await tick();
    expect(fixture.componentInstance.loads).toBe(1);
    // One big wheel step lands right at the new end, never passing above the line in between.
    scrollTo(500);
    expect(fixture.componentInstance.loads).toBe(2);
  });

  it('loads again at once when the new rows still leave the reader at the end', async () => {
    const { fixture, scrollTo } = setup();
    scrollTo(210);
    // One more row: 330 - 210 - 100 = 20px left, still inside the threshold.
    fixture.componentInstance.rows.update((r) => [...r, r.length]);
    fixture.detectChanges();
    await tick();
    expect(fixture.componentInstance.loads).toBe(2);
  });
});
